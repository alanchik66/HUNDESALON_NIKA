import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyNamedPrivateAdminEdge, verifyPrivateAdminEdge } from './lib/private-admin-edge.mjs';

test('the console, settings and media must independently challenge for this exact tunnel', async () => {
  const origin = 'https://salon-demo.trycloudflare.com';
  const state = 'a'.repeat(43);
  const challenge = new Response(null, {
    status: 302,
    headers: {
      location: `https://login.trycloudflare.com/authorize?hostname=salon-demo.trycloudflare.com&state=${state}`,
      'set-cookie': '__Secure-cloudflared-qt-auth-state-test=x; Secure; HttpOnly',
    },
  });
  const visited = [];
  assert.equal(
    await verifyPrivateAdminEdge(origin, async (url, options) => {
      visited.push(url);
      assert.equal(options.redirect, 'manual');
      assert.equal(options.credentials, 'omit');
      return challenge.clone();
    }),
    true
  );
  assert.deepEqual(visited, ['/admin/', '/api/admin/settings', '/api/admin/media', '/api/admin/comparisons'].map(path => origin + path));
  assert.equal(
    await verifyPrivateAdminEdge(origin, async url =>
      url.endsWith('/media') ? new Response(null) : challenge.clone()
    ),
    false
  );
  assert.equal(await verifyPrivateAdminEdge('https://other.trycloudflare.com', async () => challenge.clone()), false);
  assert.equal(
    await verifyPrivateAdminEdge('https://invalid.example', () => assert.fail('unexpected external request')),
    false
  );
});

const namedOrigin = 'https://admin-preview.hundesalon-nika.com';
const teamOrigin = 'https://salon-team.cloudflareaccess.com';
const loginPath = '/cdn-cgi/access/login/admin-preview.hundesalon-nika.com';

test('all named owner entry points independently require the configured Access application', async () => {
  const visited = [];
  assert.equal(
    await verifyNamedPrivateAdminEdge({ origin: namedOrigin, teamOrigin }, async (url, options) => {
      visited.push(url);
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'manual');
      assert.equal(options.credentials, 'omit');
      assert.equal(options.cache, 'no-store');
      return new Response(null, {
        status: 302,
        headers: { location: `${teamOrigin}${loginPath}?redirect_url=${encodeURIComponent(new URL(url).pathname)}` },
      });
    }),
    true
  );
  assert.deepEqual(
    visited,
    ['/', '/admin/', '/api/admin/settings', '/api/admin/pages', '/api/admin/media', '/api/admin/comparisons'].map(path => namedOrigin + path)
  );
});

test('the named check fails closed for exposed routes and unrelated or malformed challenges', async () => {
  const configured = { origin: namedOrigin, teamOrigin };
  const challenge = new Response(null, { status: 302, headers: { location: teamOrigin + loginPath } });
  for (const denied of [
    new Response(null),
    new Response(null, { status: 403 }),
    new Response(null, { status: 302 }),
    ...[
      loginPath,
      'https://other-team.cloudflareaccess.com' + loginPath,
      teamOrigin + '/cdn-cgi/access/login/preview.hundesalon-nika.com',
      'https://account@salon-team.cloudflareaccess.com' + loginPath,
      teamOrigin + loginPath + '#token',
      teamOrigin + loginPath + '?CF_Authorization=token',
    ].map(location => new Response(null, { status: 302, headers: { location } })),
  ]) {
    const verified = await verifyNamedPrivateAdminEdge(configured, async url =>
      url.endsWith('/media') ? denied.clone() : challenge.clone()
    );
    assert.equal(verified, false);
  }

  const unexpected = () => assert.fail('unexpected external request');
  assert.equal(await verifyNamedPrivateAdminEdge({ ...configured, origin: namedOrigin + '/' }, unexpected), false);
  assert.equal(
    await verifyNamedPrivateAdminEdge({ ...configured, teamOrigin: teamOrigin + '.example' }, unexpected),
    false
  );
});
