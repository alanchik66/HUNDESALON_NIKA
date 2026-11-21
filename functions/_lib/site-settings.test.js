import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { withResourceQuotaDatabase } from '../../tools/lib/resource-quota-test-db.mjs';
import { onRequest as session } from '../api/admin/session.js';
import { onRequest as settings } from '../api/admin/settings.js';
import { managedSiteResponse } from './public-site-settings.js';
import { onRequest as middleware } from '../_middleware.js';
import { hashPaymentStatusToken } from './payment-config.js';
import { createPaymentOrder } from './payment-orders.js';
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

test('disabling bookings preserves only the authorized status view for existing Stripe returns', async t => {
  edgeCaches(t);
  const env = fixture();
  for (const filename of ['0011_payment_orders.sql', '0014_site_page_copy.sql']) {
    env.CHAT_DB.sqlite.exec(readFileSync(new URL('../../migrations/' + filename, import.meta.url), 'utf8'));
  }
  const state = await readSiteSettings(env);
  await saveSettingsChange(env, state, { revision: state.revision, key: 'booking', enabled: false });
  const token = 'A'.repeat(43);
  const id = crypto.randomUUID();
  const stored = await createPaymentOrder(env, {
    id,
    tokenHash: await hashPaymentStatusToken(token),
    booking: { lang: 'ru', name: 'Fixture Customer' },
    amount: 2000,
    mode: 'test',
    expiresAt: Date.now() + 3600000,
  });
  assert.equal(stored.ok, true);
  let throttled = false;
  const cache = globalThis.caches.default;
  const readCache = cache.match.bind(cache);
  t.mock.method(cache, 'match', request =>
    throttled && new URL(request.url).pathname.startsWith('/payment-return/')
      ? new Response('90')
      : readCache(request)
  );
  let orderReads = 0;
  const prepare = env.CHAT_DB.prepare.bind(env.CHAT_DB);
  t.mock.method(env.CHAT_DB, 'prepare', sql => {
    if (sql.includes('FROM payment_orders')) orderReads++;
    return prepare(sql);
  });

  const handlers = new Map();
  const previous = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = class {
    on(selector, handler) {
      handlers.set(selector, handler);
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
  const booking = '/ru/onlayn-bronirovanie';
  const query = '?order=' + id + '&token=' + token;
  let assetReads = 0;
  const view = (path, method = 'GET') => middleware({
    env,
    request: req(path, method),
    next: () => {
      assetReads++;
      return new Response(method === 'HEAD' ? null : '<!doctype html><html></html>', {
        headers: { 'Content-Type': 'text/html', 'ETag': 'fixture', 'Cache-Control': 'public, max-age=3600' },
      });
    },
  });
  for (const path of [
    booking,
    booking + query,
    booking + query + '&payment=unknown',
    booking + query + '&payment=success&token=' + token,
    booking + query.replace(token, 'B'.repeat(43)) + '&payment=success',
    booking + query.replace(id, crypto.randomUUID()) + '&payment=success',
    booking + '.html' + query + '&payment=success',
    '/en/onlayn-bronirovanie' + query + '&payment=success',
  ]) {
    assert.equal((await view(path)).status, 404, path);
  }
  assert.equal((await view(booking + query + '&payment=success', 'POST')).status, 404);
  assert.equal((await view('/payment', 'POST')).status, 404);
  assert.equal(assetReads, 0);
  const readsBeforeThrottle = orderReads;
  throttled = true;
  assert.equal((await view(booking + query + '&payment=success')).status, 404);
  assert.equal(orderReads, readsBeforeThrottle);
  throttled = false;

  for (const [method, payment] of [['GET', 'success'], ['HEAD', 'cancelled']]) {
    const response = await view(booking + query + '&payment=' + payment, method);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(response.headers.get('ETag'), null);
    assert.doesNotMatch(await response.text(), /Fixture Customer/);
  }
  assert.equal(assetReads, 2);
  let mount;
  handlers.get('.booking-hero').element({ replace(html) { mount = html; } });
  assert.equal(mount, '<main data-booking-payment-return></main>');
  let removed = false;
  handlers.get('#booking-modal, [data-newsletter-section]').element({ remove() { removed = true; } });
  assert.equal(removed, true);
  const removedBy = (selector, attributes) => {
    let removed = false;
    handlers.get(selector).element({
      getAttribute: name => attributes[name] ?? null,
      hasAttribute: name => Object.hasOwn(attributes, name),
      remove() { removed = true; },
    });
    return removed;
  };
  const cleanReturn = () => {
    assert.equal(removedBy('script[src]', { src: '../assets/js/analytics.js?v=fixture' }), true);
    assert.equal(removedBy('script[src]', { src: 'https://tracker.example.test/pixel.js' }), true);
    assert.equal(removedBy('script[src]', { src: '../assets/js/page-modules.js?v=fixture' }), false);
    assert.equal(removedBy('link[href]', { href: 'https://fonts.googleapis.com/css2', rel: 'stylesheet' }), true);
    assert.equal(removedBy('link[href]', { href: origin + booking, rel: 'canonical' }), false);
  };
  cleanReturn();
  const disabledState = await readSiteSettings(env);
  await saveSettingsChange(env, disabledState, { revision: disabledState.revision, key: 'booking', enabled: true });
  handlers.clear();
  const reopenedReturn = await view(booking + query + '&payment=cancelled');
  assert.equal(reopenedReturn.status, 200);
  assert.equal(reopenedReturn.headers.get('Referrer-Policy'), 'no-referrer');
  assert.equal(handlers.has('.booking-hero'), false, 'enabled booking retains its ordinary form');
  cleanReturn();
  handlers.clear();
  assert.equal((await view(booking)).status, 200);
  assert.equal(handlers.has('script[src]'), false, 'ordinary booking retains consented analytics');
});
