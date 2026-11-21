import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { onRequest as siteMiddleware } from '../_middleware.js';
import { onRequest as adminPage } from '../admin/[[path]].js';
import { onRequest as ownerSession } from '../api/admin/session.js';
import { onRequest as ownerSettings } from '../api/admin/settings.js';
import { hasSiteAdminAccess } from './site-admin-access.js';

const adminOrigin = 'https://admin.hundesalon-nika.example';
const issuer = 'https://owner-guard-fixture.cloudflareaccess.com';
const audience = 'a'.repeat(64);
const email = 'owner@example.test';
const accessHeader = 'Cf-Access-Jwt-Assertion';
const kid = 'fixture-signing-key';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };

const configuration = {
  SITE_ADMIN_ORIGIN: adminOrigin,
  SITE_ADMIN_ACCESS_TEAM: issuer,
  SITE_ADMIN_ACCESS_AUD: audience,
  SITE_ADMIN_ACCESS_EMAIL: email,
};

function accessToken(overrides = {}, header = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: issuer,
    aud: [audience],
    email,
    exp: now + 60,
    nbf: now - 5,
    type: 'app',
    sub: 'owner',
    ...overrides,
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const message = encode({ alg: 'RS256', typ: 'JWT', kid, ...header }) + '.' + encode(claims);
  return message + '.' + sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url');
}

function sqliteD1(t) {
  const raw = new DatabaseSync(':memory:');
  t.after(() => raw.close());
  raw.exec(readFileSync(new URL('../../migrations/0013_site_settings.sql', import.meta.url), 'utf8'));
  return {
    prepare(query) {
      const statement = raw.prepare(query);
      return {
        bind(...values) {
          return {
            first: () => statement.get(...values) ?? null,
            run: () => ({ meta: { changes: statement.run(...values).changes } }),
          };
        },
      };
    },
    batch(statements) {
      raw.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.run());
        raw.exec('COMMIT');
        return results;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

test('non-local admin routes fail closed before trusting origin or email from request headers', async t => {
  const mockFetch = t.mock.method(globalThis, 'fetch', async () => assert.fail('Unexpected keys request'));
  const warning = t.mock.method(console, 'warn', () => {});
  const untrusted = new Request('https://site.pages.dev/admin/', {
    headers: {
      [accessHeader]: accessToken(),
      'Cf-Access-Authenticated-User-Email': email,
      'X-Hundesalon-Public-Origin': adminOrigin,
      'X-Forwarded-Host': new URL(adminOrigin).hostname,
    },
  });
  assert.equal((await adminPage({ request: untrusted, env: configuration })).status, 404);
  for (const path of ['/assets/css/site-admin.css', '/assets/js/site-%61dmin.js', '/assets//js/site-admin.js']) {
    const request = new Request('https://site.pages.dev' + path, { headers: untrusted.headers });
    const response = await siteMiddleware({ request, env: configuration, next: () => assert.fail('Private asset served') });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
  assert.equal((await adminPage({ request: new Request(adminOrigin + '/admin/'), env: configuration })).status, 404);
  for (const field of Object.keys(configuration)) {
    assert.equal(
      await hasSiteAdminAccess(new Request(adminOrigin + '/admin/', { headers: { [accessHeader]: accessToken() } }), {
        ...configuration,
        [field]: '',
      }),
      false
    );
  }
  const request = new Request(adminOrigin + '/api/admin/session', {
    method: 'POST',
    headers: { Origin: adminOrigin, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal((await ownerSession({ request, env: configuration })).status, 404);
  assert.equal(mockFetch.mock.callCount(), 0);
  const local = new Request('http://127.0.0.1:8796/admin/');
  assert.equal((await adminPage({ request: new Request(adminOrigin + '/admin/'), env: {} })).status, 404);
  assert.equal((await adminPage({ request: local, env: {} })).status, 200);
  assert.deepEqual(warning.mock.calls.slice(0, 1).map(call => call.arguments), [
    ['[site-admin-access] Access assertion rejected:', 'origin'],
  ]);
});

test('a redirect from the Cloudflare Access signing keys endpoint does not grant access', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const mockFetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.redirect('https://different.example.test/keys', 302)
  );
  const request = new Request(adminOrigin + '/admin/', { headers: { [accessHeader]: accessToken() } });
  assert.equal(await hasSiteAdminAccess(request, configuration), false);
  assert.equal(mockFetch.mock.callCount(), 1);
  assert.equal(mockFetch.mock.calls[0].arguments[1].redirect, 'manual');
  assert.deepEqual(warning.mock.calls.map(call => call.arguments), [
    ['[site-admin-access] Access assertion rejected:', 'key'],
  ]);
});

test('Cloudflare Access proof is signed for the single owner and cannot replace the owner key or session', async t => {
  const warning = t.mock.method(console, 'warn', () => {});
  const mockFetch = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, issuer + '/cdn-cgi/access/certs');
    assert.equal(options.redirect, 'manual');
    return Response.json({ keys: [jwk] });
  });
  const now = Math.floor(Date.now() / 1000);
  const [validHeader, validClaims, validSignature] = accessToken().split('.');
  const changedClaims = JSON.parse(Buffer.from(validClaims, 'base64url').toString('utf8'));
  changedClaims.sub = 'tampered';
  const tampered = [validHeader, Buffer.from(JSON.stringify(changedClaims)).toString('base64url'), validSignature].join(
    '.'
  );
  const accessRequest = (token, path = '/admin/') =>
    new Request(adminOrigin + path, { headers: { [accessHeader]: token } });
  for (const token of [
    'invalid',
    tampered,
    accessToken({}, { alg: 'HS256' }),
    accessToken({}, { kid: 'unknown' }),
    accessToken({ email: 'other@example.test' }),
    accessToken({ iss: 'https://other.cloudflareaccess.com' }),
    accessToken({ aud: ['wrong'] }),
    accessToken({ aud: [audience, 'extra'] }),
    accessToken({ exp: now - 1 }),
    accessToken({ nbf: now + 600 }),
    accessToken({ type: 'org' }),
  ])
    assert.equal(await hasSiteAdminAccess(accessRequest(token), configuration), false);
  assert.deepEqual(warning.mock.calls.map(call => call.arguments[1]), [
    'format', 'signature', 'header', 'key', 'owner', 'issuer', 'audience', 'audience', 'time', 'time', 'subject',
  ]);

  const previousCaches = globalThis.caches;
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  t.after(() => {
    globalThis.caches = previousCaches;
  });
  const env = { ...configuration, CHAT_DB: sqliteD1(t), SITE_ADMIN_KEY: crypto.randomUUID() };
  const token = accessToken();
  assert.equal((await adminPage({ request: accessRequest(token), env })).status, 200);
  const asset = await siteMiddleware({
    request: accessRequest(token, '/assets/js/site-admin.js'), env,
    next: () => new Response('console source'),
  });
  assert.equal(await asset.text(), 'console source');
  assert.equal(asset.headers.get('cache-control'), 'private, no-store');
  assert.equal((await ownerSettings({ request: accessRequest(token, '/api/admin/settings'), env })).status, 401);

  const startSession = (key, origin = adminOrigin) =>
    ownerSession({
      env,
      request: new Request(adminOrigin + '/api/admin/session', {
        method: 'POST',
        headers: { [accessHeader]: token, Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      }),
    });
  assert.equal((await startSession(env.SITE_ADMIN_KEY, 'https://other.example.test')).status, 403);
  assert.equal((await startSession('wrong owner key')).status, 401);
  const login = await startSession(env.SITE_ADMIN_KEY);
  assert.equal(login.status, 200);
  const setCookie = login.headers.get('set-cookie');
  assert.match(setCookie, /^__Host-nika-admin=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict;.*; Secure$/);
  const cookie = setCookie.split(';', 1)[0];
  const cookieOnly = new Request(adminOrigin + '/api/admin/settings', { headers: { Cookie: cookie } });
  assert.equal((await ownerSettings({ request: cookieOnly, env })).status, 404);
  const owner = new Request(adminOrigin + '/api/admin/settings', {
    headers: { [accessHeader]: token, Cookie: cookie },
  });
  assert.equal((await ownerSettings({ request: owner, env })).status, 200);
  assert.equal(mockFetch.mock.callCount(), 1);
});
