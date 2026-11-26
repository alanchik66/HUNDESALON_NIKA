import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const headersSource = readFileSync(new URL('../_headers', import.meta.url), 'utf8');

// Model the relative/splat subset used here, with ordered append/detach semantics:
// https://developers.cloudflare.com/pages/configuration/headers/ (checked 2026-11-25).
function staticHeadersFor(pathname, rules = headersSource) {
  const headers = new Map();
  let matches = false;
  for (const line of rules.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      assert.ok(line.startsWith('/') && line.split('*').length <= 2, 'extend the test model before adding unsupported URL patterns');
      const pattern = line.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
      matches = new RegExp(`^${pattern}$`).test(pathname);
      continue;
    }
    const instruction = line.match(/^\s+(!\s+)?([A-Za-z0-9-]+)(?::\s*(.*))?$/);
    assert.ok(instruction, 'header instructions have an explicit name and attach/detach form');
    const [, detach, rawName, value] = instruction;
    const name = rawName.toLowerCase();
    assert.equal(detach ? value : undefined, undefined, 'detach instructions have no header value');
    if (!detach) assert.notEqual(value, undefined, 'attached headers have a value');
    if (!matches) continue;
    if (detach) headers.delete(name);
    else headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
  }
  return headers;
}

function fetchEvent({ cached, response, writeError, fetchError, destination = 'image', path = '/asset.png', cache = 'default', headers = {} } = {}) {
  const handlers = new Map();
  const pending = [];
  const writes = [];
  const calls = { match: 0, open: 0, fetch: 0, respondWith: 0 };
  let respondWith;
  const request = { method: 'GET', url: new URL(path, 'https://example.com').href, destination, mode: 'cors', cache, headers };
  vm.runInNewContext(source, {
    URL,
    self: { location: { origin: 'https://example.com' }, addEventListener: (type, fn) => handlers.set(type, fn) },
    caches: {
      match: async () => { calls.match += 1; return cached; },
      open: async () => {
        calls.open += 1;
        return {
          put: async (key, value) => {
            if (writeError) throw writeError;
            writes.push([key, value]);
          },
        };
      },
    },
    fetch: async () => {
      calls.fetch += 1;
      if (fetchError) throw fetchError;
      return response;
    },
  });
  handlers.get('fetch')({
    request,
    waitUntil: promise => pending.push(promise),
    respondWith: promise => {
      calls.respondWith += 1;
      respondWith = promise;
    },
  });
  return { request, pending, writes, calls, response: respondWith };
}

test('current and metadata weather requests use the browser network without service-worker interception or cache access', async t => {
  for (const [name, options] of [
    ['current conditions', { path: '/api/weather?location=51.23%2C6.78&forecast_contract=four-day-v2' }],
    ['forced current refresh', { path: '/api/weather?location=51.23%2C6.78', headers: { 'Cache-Control': 'no-cache' } }],
    ['metadata refresh', { path: '/api/weather?location=51.23%2C6.78&meta_only=1', cache: 'no-store' }],
    ['bare endpoint', { path: '/api/weather' }],
    ['satellite observations', { path: '/api/satellite-clouds' }],
  ]) {
    await t.test(name, async () => {
      const event = fetchEvent({ ...options, destination: '', cached: { current: { temp_c: 1 }, stale: true },
        response: { ok: true, clone: () => ({ current: { temp_c: 7 } }) } });
      assert.equal(event.response, undefined, 'the browser must retain the default network path');
      assert.deepEqual(event.calls, { match: 0, open: 0, fetch: 0, respondWith: 0 });
      assert.equal(event.pending.length, 0, 'the worker must not start a background weather refresh');
      assert.equal(event.writes.length, 0, 'even an existing stale weather cache entry must remain unused');
    });
  }
});

test('cached assets keep the refresh and cache write alive', async () => {
  const cached = { cached: true };
  const updated = { ok: true, clone: () => ({ updated: true }) };
  const event = fetchEvent({ cached, response: updated });
  assert.equal(await event.response, cached);
  assert.ok(event.pending.length > 0);
  // Cache writes register their own lifetime promise when the network response resolves.
  for (let index = 0; index < event.pending.length; index++) await event.pending[index];
  assert.equal(event.writes.length, 1);
  assert.equal(event.writes[0][0], event.request);
});

test('cache quota rejection does not reject a successful navigation', async () => {
  const response = { ok: true, clone: () => ({ copy: true }) };
  const event = fetchEvent({ response, destination: 'document', writeError: new Error('QuotaExceededError') });
  assert.equal(await event.response, response);
  assert.equal(event.pending.length, 1);
  await Promise.all(event.pending);
});

test('offline asset refresh preserves the cached response and fulfills its lifetime promise', async () => {
  const cached = { cached: true };
  const event = fetchEvent({ cached, fetchError: new Error('offline') });
  assert.equal(await event.response, cached);
  await Promise.all(event.pending);
  assert.equal(event.writes.length, 0);
});

test('administration, public managed pages and feature feeds bypass previously cached responses', () => {
  for (const path of ['/admin', '/admin/', '/api/admin/settings', '/api/admin/page?id=contacts', '/ru/promotions.html',
    '/uk/blog/blog', '/de/', '/reviews', '/reviews.html/', '/telegram-menu', '/telegram-menu.html?lang=uk',
    '/telegram-menu/', '/sitemap.xml', '/api/maps-config', '/blog', '/payment-status']) {
    const event = fetchEvent({path,cached:{old:true},destination:''});
    assert.equal(event.response,undefined,path);
    assert.deepEqual(event.calls,{match:0,open:0,fetch:0,respondWith:0});
  }
});

test('a private or no-store response cannot be added to the static cache', async () => {
  for (const value of ['private, max-age=60','no-store']) {
    const event = fetchEvent({response:{ok:true,headers:{get:()=>value}}});
    await event.response;
    await Promise.all(event.pending);
    assert.equal(event.writes.length,0);
  }
});

test('Pages header precedence keeps one intended max-age on ordinary and narrowly overridden assets', () => {
  for (const [path, seconds, immutable] of [
    ['/assets/images/brand/logo.png', 86400, false],
    ['/assets/images/favicon/favicon-32x32.png', 86400, false],
    ['/favicon.ico', 86400, false],
    ['/assets/images/icons/search.png', 31536000, false],
    ['/assets/images/hero/salon.webp', 31536000, false],
    ['/assets/images/before-after/dog.webp', 31536000, false],
    ['/assets/images/preloader/paws-atlas-v1.webp', 31536000, false],
    ['/assets/images/email/logo.png', 31536000, false],
    ['/assets/js/site-loader.js', 31536000, true],
    ['/assets/css/site-loader.css', 31536000, true],
    ['/assets/fonts/inter.woff2', 31536000, true],
    ['/ru/', 0, false],
    ['/sw.js', 0, false],
    ['/sp-push-worker-fb.js', 0, false],
    ['/robots.txt', 0, false],
  ]) {
    const cache = staticHeadersFor(path).get('cache-control');
    assert.ok(cache, path);
    const directives = cache.split(',').map(value => value.trim());
    assert.deepEqual(directives.filter(value => /^max-age\s*=/i.test(value)), [`max-age=${seconds}`], path);
    assert.equal(directives.includes('immutable'), immutable, path);
    if (seconds === 0) assert.ok(directives.includes('must-revalidate'), path);
  }
});

test('the Pages model follows documented append order rather than treating an early detach as a future override', () => {
  const broad = '/*\n  Cross-Origin-Resource-Policy: same-origin\n';
  const narrow = '/email.png\n  ! Cross-Origin-Resource-Policy\n';
  assert.equal(staticHeadersFor('/email.png', narrow + broad).get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(staticHeadersFor('/email.png', broad + narrow).has('cross-origin-resource-policy'), false);
  assert.equal(staticHeadersFor('/asset.png', '/*\n  Cache-Control: public, max-age=31536000\n/asset.png\n  Cache-Control: public, max-age=86400\n').get('cache-control'),
    'public, max-age=31536000, public, max-age=86400');
});

test('email artwork has a narrow cross-site exception while other static resources keep their security policy', () => {
  const ordinary = staticHeadersFor('/assets/images/weather/moon-albedo.webp');
  const security = new Map([...ordinary].filter(([name]) => name !== 'cache-control'));
  for (const path of ['/assets/js/site-loader.js', '/assets/images/brand/logo.png', '/assets/images/email-other/logo.png', '/ru/']) {
    assert.deepEqual(new Map([...staticHeadersFor(path)].filter(([name]) => name !== 'cache-control')), security, path);
  }
  assert.equal(ordinary.get('cross-origin-resource-policy'), 'same-origin');
  for (const image of ['logo', 'whatsapp', 'telegram', 'viber', 'phone', 'facebook', 'mail', 'social-links']) {
    const email = staticHeadersFor(`/assets/images/email/${image}.png`);
    assert.equal(email.has('cross-origin-resource-policy'), false, `${image}: the narrow detach runs after the broad security rule`);
    for (const name of ['content-security-policy', 'cross-origin-opener-policy', 'x-content-type-options',
      'x-frame-options', 'referrer-policy', 'strict-transport-security', 'permissions-policy']) {
      assert.ok(ordinary.has(name), name);
      assert.equal(email.get(name), ordinary.get(name), `${image}: ${name}`);
    }
    assert.equal(email.get('x-content-type-options'), 'nosniff');
    assert.equal(email.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(email.get('cross-origin-opener-policy'), 'same-origin');
  }
});

test('Pages header rules stay within the documented rule and whole-line limits', () => {
  const lines = headersSource.split(/\r?\n/);
  assert.ok(lines.filter(line => line && !/^(?:\s|#)/.test(line)).length <= 100);
  for (const [index, line] of lines.entries()) assert.ok([...line].length <= 2000, `line ${index + 1} exceeds 2000 characters`);
});

test('deployment metadata always bypasses stored responses', async t => {
  for (const [name, options] of [
    ['ordinary request', {}],
    ['query string', { path: '/config/deploy-asset-version.txt?release=next' }],
    ['explicit no-store request', { cache: 'no-store' }],
  ]) {
    await t.test(name, () => {
      const event = fetchEvent({ path: '/config/deploy-asset-version.txt', destination: '', cached: { stamp: 'old' },
        response: { ok: true, headers: { get: () => 'public, max-age=0, must-revalidate' }, clone: () => ({ stamp: 'new' }) }, ...options });
      assert.equal(event.response, undefined, 'the browser must read release metadata through the network path');
      assert.deepEqual(event.calls, { match: 0, open: 0, fetch: 0, respondWith: 0 });
      assert.equal(event.pending.length, 0);
      assert.equal(event.writes.length, 0);
    });
  }
});

test('deployment metadata lookalike retains ordinary asset refresh', async () => {
  const cached = { asset: 'cached' };
  const event = fetchEvent({ path: '/config/deploy-asset-version.txt.backup?release=next', destination: '', cached,
    response: { ok: true, clone: () => ({ asset: 'updated' }) } });
  assert.equal(await event.response, cached, 'the exception applies only to the exact metadata pathname');
  for (let index = 0; index < event.pending.length; index++) await event.pending[index];
  assert.deepEqual(event.calls, { match: 1, open: 1, fetch: 1, respondWith: 1 });
  assert.equal(event.writes.length, 1);
  assert.equal(event.writes[0][0], event.request);
});
