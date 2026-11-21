import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { withResourceQuotaDatabase } from '../../tools/lib/resource-quota-test-db.mjs';
import { onRequest as session } from '../api/admin/session.js';
import { onRequest as settings } from '../api/admin/settings.js';
import { managedSiteResponse } from './public-site-settings.js';
import { onRequest as middleware } from '../_middleware.js';
import { readSiteSettings, saveSettingsChange, sectionForPath, settingsSnapshot } from './site-settings.js';

const origin = 'https://hundesalon-nika.com';
const ownerOrigin = 'http://127.0.0.1:8796';
const key = 'local-test-key-'.repeat(4);
const migration = readFileSync(new URL('../../migrations/0013_site_settings.sql', import.meta.url), 'utf8');

function fixture() {
  const db = withResourceQuotaDatabase({}, { migrated: false });
  db.sqlite.exec(migration);
  db.batch = async statements => Promise.all(statements.map(s => s.run()));
  return { CHAT_DB: db, SITE_ADMIN_KEY: key };
}

function req(path, method = 'GET', body, options = {}, requestOrigin = origin) {
  return new Request(requestOrigin + path, {
    method,
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json', ...options },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const ownerRequest = (path, method, body, headers) => req(path, method, body, headers, ownerOrigin);

function edgeCaches(t) {
  const counts = new Map();
  const original = globalThis.caches;
  globalThis.caches = {
    default: {
      async match(k) {
        return counts.has(k.url) ? new Response(counts.get(k.url)) : undefined;
      },
      async put(k, v) {
        counts.set(k.url, await v.text());
      },
    },
  };
  t.after(() => {
    globalThis.caches = original;
  });
}

test('WebKit can fetch loopback HTTP assets while HTTPS sites retain their upgrade policy', async () => {
  for (const [base, upgrade] of [
    ['http://127.0.0.1:8788', false],
    ['http://localhost:8788', false],
    ['https://hundesalon-nika.com', true],
    ['http://example.invalid', true],
  ]) {
    const response = await middleware({
      request: new Request(base + '/assets/js/site-shell.js'),
      next: () => new Response(''),
    });
    const policy = response.headers.get('Content-Security-Policy');
    assert.equal(policy.includes('upgrade-insecure-requests'), upgrade, base);
    assert.ok(policy.includes("object-src 'none'"));
  }
});

test('only an owner session can see drafts or update settings; logout revokes the token', async t => {
  edgeCaches(t);
  const env = fixture();
  const get = cookie =>
    settings({ env, request: ownerRequest('/api/admin/settings', 'GET', undefined, { Cookie: cookie }) });
  assert.equal((await get('')).status, 401);
  assert.equal(
    (
      await session({
        env,
        request: ownerRequest('/api/admin/session', 'POST', { key }, { Origin: 'https://elsewhere.invalid' }),
      })
    ).status,
    403
  );
  assert.equal(
    (await session({ env, request: ownerRequest('/api/admin/session', 'POST', { key: 'wrong' }) })).status,
    401
  );
  const login = await session({ env, request: ownerRequest('/api/admin/session', 'POST', { key }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  assert.match(
    login.headers.get('Set-Cookie'),
    /^nika-admin-local=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+$/
  );
  const active = await get(cookie);
  assert.equal(active.status, 200);
  assert.equal(active.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(active.headers.get('Vary'), '*');
  const defaults = await active.json();
  assert.equal(defaults.revision, 0);
  assert.equal(defaults.offers.length, 3);
  assert.ok(defaults.offers.every(offer => !offer.enabled));
  assert.equal(defaults.settings.find(x => x.key === 'promotions').enabled, false);
  const patch = (body, more = {}) =>
    settings({ env, request: ownerRequest('/api/admin/settings', 'PATCH', body, { Cookie: cookie, ...more }) });
  assert.equal(
    (await patch({ revision: 0, key: 'promotions', enabled: true }, { Origin: 'https://elsewhere.invalid' })).status,
    403
  );
  assert.equal((await patch({ revision: 0, key: 'admin', enabled: false })).status, 400);
  const [first, other] = await Promise.all([
    patch({ revision: 0, key: 'promotions', enabled: true }),
    patch({ revision: 0, key: 'blog', enabled: false }),
  ]);
  assert.deepEqual([first.status, other.status].sort(), [200, 409]);
  const offer = defaults.offers[0];
  assert.equal((await patch({ revision: 1, offer: { ...offer, locales: {} } })).status, 400);
  offer.locales.ru.title = 'Открытый & честный <текст>';
  const updated = await patch({ revision: 1, offer: { ...offer, enabled: true } });
  assert.equal(updated.status, 200);
  const stored = await (await get(cookie)).json();
  assert.equal(stored.offers[0].locales.ru.title, offer.locales.ru.title);
  assert.equal(stored.offers[0].enabled, true);
  assert.equal(stored.revision, 2);
  assert.equal(
    (
      await settings({
        env: { ...env, SITE_ADMIN_KEY: key + 'changed' },
        request: ownerRequest('/api/admin/settings', 'GET', undefined, { Cookie: cookie }),
      })
    ).status,
    401
  );
  assert.equal(
    (await session({ env, request: ownerRequest('/api/admin/session', 'DELETE', undefined, { Cookie: cookie }) }))
      .status,
    200
  );
  assert.equal((await get(cookie)).status, 401);
});

test('session fails closed without the owner key and limits repeated guesses', async t => {
  edgeCaches(t);
  const env = fixture(),
    request = () => ownerRequest('/api/admin/session', 'POST', { key: 'wrong' });
  assert.equal((await session({ env: { ...env, SITE_ADMIN_KEY: '' }, request: request() })).status, 503);
  for (let n = 0; n < 10; n++) assert.equal((await session({ env, request: request() })).status, 401);
  assert.equal((await session({ env, request: request() })).status, 429);
});

test('managed public routes respect an initial rollout, changed settings, and a database outage', async () => {
  const env = fixture();
  const sandbox = (
    env,
    path,
    method = 'GET',
    body,
    html = '<urlset><url><loc>' + origin + '/ru/blog/blog</loc></url></urlset>'
  ) => {
    const request = req(path, method, body);
    return managedSiteResponse(
      { env, request, next: async () => new Response(html, { headers: { 'Content-Type': 'application/xml' } }) },
      new URL(request.url)
    );
  };
  for (const path of ['/ru/promotions', '/de/promotions.html', '/en/promotions/', '/uk/%70romotions']) {
    assert.equal((await sandbox(env, path)).status, 404);
    assert.equal((await sandbox({}, path)).status, 404);
  }
  assert.equal((await sandbox(env, '/functions/_lib/promotion-defaults.json')).status, 404);
  const missing = withResourceQuotaDatabase({}, { migrated: false });
  assert.equal(
    settingsSnapshot(await readSiteSettings({ CHAT_DB: missing })).settings.find(row => row.key === 'promotions')
      .enabled,
    false
  );
  assert.equal((await sandbox({ CHAT_DB: missing, SITE_ADMIN_KEY: key }, '/ru/promotions')).status, 503);
  assert.equal(
    (
      await sandbox(
        {
          CHAT_DB: {
            prepare() {
              throw new Error('db not reachable');
            },
          },
        },
        '/ru/blog/blog'
      )
    ).status,
    503
  );
  let current = await readSiteSettings(env);
  for (const [key, enabled] of [
    ['promotions', true],
    ['booking', false],
    ['reviews', false],
    ['aiChat', false],
    ['newsletter', false],
    ['blog', false],
  ]) {
    current = (await saveSettingsChange(env, current, { revision: current.revision, key, enabled })).state;
  }
  const xml = await (await sandbox(env, '/sitemap.xml')).text();
  assert.doesNotMatch(xml, /blog\/blog/);
  assert.equal((xml.match(/<loc>[^<]+\/promotions<\/loc>/g) || []).length, 4);
  const rootReviews =
    '<urlset><url><loc>' + origin + '/reviews</loc></url><url><loc>' + origin + '/reviews.html</loc></url></urlset>';
  assert.doesNotMatch(await (await sandbox(env, '/sitemap.xml', 'GET', undefined, rootReviews)).text(), /\/reviews/);
  for (const path of [
    '/ru/blog/blog',
    '/de/blog/anything.html',
    '/reviews',
    '/reviews.html',
    '/api/ai-chat-upload-chunk',
    '/subscribe',
    '/booking-availability',
    '/upload',
    '/payment',
  ]) {
    assert.equal((await sandbox(env, path)).status, 404, path);
  }
  assert.equal((await sandbox(env, '/sendmail', 'POST', { form_type: 'client_registration' })).status, 404);
  assert.equal((await sandbox(env, '/sendmail', 'POST', { form_type: 'feedback' })).status, 404);
  assert.equal(await sandbox(env, '/sendmail', 'POST', { form_type: 'contact' }), null);
  assert.equal((await sandbox(env, '/message-draft', 'POST', { draft: { formType: 'feedback' } })).status, 404);
  assert.equal(await sandbox(env, '/message-draft', 'POST', { draft: { formType: 'contact' } }), null);
  assert.equal(await sandbox(env, '/message-draft', 'POST', { messages: [] }), null);
  assert.equal(await sandbox(env, '/payment-webhook', 'POST', {}), null);
  assert.equal(await sandbox(env, '/payment-status'), null);
  assert.equal(await sandbox(env, '/api/booking-confirm'), null);
  assert.equal(sectionForPath('/de/agb'), null);
  assert.equal(sectionForPath('/reviews/'), 'reviews');
  assert.equal(sectionForPath('/reviews.html'), 'reviews');
  assert.equal(sectionForPath('/reviews/anything'), null);
  assert.equal(sectionForPath('/en/blog/strizhka-koshek.html'), 'blog');
});

test('Telegram button visibility follows the managed destinations and keeps external support', async t => {
  const env = fixture();
  const source = readFileSync(new URL('../../telegram-menu.html', import.meta.url), 'utf8');
  const routes = [...source.matchAll(/<button\b[^>]*\bdata-route="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(routes, ['booking', 'prices', 'contact', 'support']);
  let buttonHandler;
  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = class {
    on(selector, handler) {
      if (selector === 'button[data-route]') buttonHandler = handler;
      return this;
    }
    transform(response) {
      return response;
    }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.HTMLRewriter;
    else globalThis.HTMLRewriter = previous;
  });
  let state = await readSiteSettings(env);
  const check = async (path, expected) => {
    buttonHandler = undefined;
    const request = req(path);
    const next = () => new Response(source, { headers: { 'Content-Type': 'text/html' } });
    const response = await managedSiteResponse({ env, request, next }, new URL(request.url));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
    const visible = routes.filter(route => {
      let removed = false;
      buttonHandler?.element({
        getAttribute: () => route,
        remove: () => {
          removed = true;
        },
      });
      return !removed;
    });
    assert.deepEqual(visible, expected);
  };
  await check('/telegram-menu', routes);
  for (const key of ['booking', 'contacts', 'prices']) {
    state = (await saveSettingsChange(env, state, { revision: state.revision, key, enabled: false })).state;
  }
  await check('/telegram-menu.html?lang=ru', ['support']);
  state = (await saveSettingsChange(env, state, { revision: state.revision, key: 'prices', enabled: true })).state;
  await check('/telegram-menu/', ['prices', 'support']);
});
