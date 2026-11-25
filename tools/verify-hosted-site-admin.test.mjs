import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyHostedSiteAdmin } from './verify-hosted-site-admin.mjs';

const admin = 'https://admin.hundesalon-nika.com';
const apex = 'https://hundesalon-nika.com';
const pages = 'https://hundesalon-nika.pages.dev';
const team = 'https://hundesalon-nika.cloudflareaccess.com';
const build = '20261120-prod-49b0b23-fefdcc55';
const secretCanary = 'NEVER_PRINT_THIS_RESPONSE_TOKEN';
const audience = 'c'.repeat(64);
const compact = data => Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');

function challenge(path, { host = team, destination = path, appAudience = audience, metadataHost, configure } = {}) {
  const url = new URL('/cdn-cgi/access/login/admin.hundesalon-nika.com', host);
  const claims = {
    aud: appAudience,
    type: 'meta',
    hostname: metadataHost || 'admin.hundesalon-nika.com',
    redirect_url: destination,
  };
  const meta = [compact({ alg: 'RS256' }), compact(claims), compact(secretCanary)].join('.');
  url.searchParams.set('kid', 'test-key');
  url.searchParams.set('meta', meta);
  url.searchParams.set('redirect_url', destination);
  configure?.(url);
  return new Response(null, { status: 302, headers: { Location: url.href, 'Set-Cookie': 'test=' + secretCanary } });
}

function home(stamp = build) {
  return new Response(
    '<html lang="ru"><head><title>HUNDESALON_NIKA</title></head><body><main>' + stamp + '</main></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function fixtures(override = () => null) {
  return async (href, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.body, undefined);
    assert.deepEqual([...new Headers(options.headers)], []);
    const url = new URL(href);
    assert.ok([admin, apex, pages].includes(url.origin), 'Do not follow a login redirect');
    const special = override(url);
    if (special) return special;
    if (url.origin === admin) return challenge(url.pathname);
    if (url.origin === apex && url.pathname === '/ru/') return home();
    return new Response(null, { status: 404 });
  };
}

test('the expected Access challenge, alternate-origin guard, and current public page pass', async () => {
  const result = await verifyHostedSiteAdmin({ request: fixtures(), expectedPublicRelease: build });
  assert.equal(result.ok, true);
  assert.equal(result.sameAccessApplication, true);
  assert.equal(result.publicHome.valid, true);
  assert.ok(result.adminChecks.every(check => check.accessChallenge));
  assert.ok(result.directChecks.every(check => check.blocked));
  const output = JSON.stringify(result);
  for (const internal of [secretCanary, audience, 'test-key', compact(secretCanary)]) {
    assert.ok(!output.includes(internal));
  }
});

test('a related host or login, different Access audience, or wrong return address cannot pass', async () => {
  const cases = [
    { host: 'https://other-access.cloudflareaccess.com' },
    { destination: '/admin/' },
    { metadataHost: 'other.hundesalon-nika.com' },
    { appAudience: 'a'.repeat(64) },
    { configure: url => url.searchParams.set('access_token', secretCanary) },
    { configure: url => url.searchParams.append('redirect_url', '/admin/') },
  ];
  for (const invalid of cases) {
    const request = fixtures(url =>
      url.origin === admin && url.pathname === '/api/admin/media' ? challenge(url.pathname, invalid) : null
    );
    const result = await verifyHostedSiteAdmin({ request });
    assert.equal(result.ok, false);
    assert.equal(result.sameAccessApplication, false);
    assert.ok(!JSON.stringify(result).includes(secretCanary));
  }
});

test('direct admin surfaces must be hidden even if redirected through Access', async () => {
  const request = fixtures(url => {
    if (url.origin === apex && url.pathname === '/api/admin/settings') return new Response('{}', { status: 200 });
    if (url.origin === pages && url.pathname === '/admin/') return challenge(url.pathname);
    return null;
  });
  const result = await verifyHostedSiteAdmin({ request });
  assert.equal(result.ok, false);
  assert.equal(result.sameAccessApplication, true);
  assert.deepEqual(
    result.directChecks.filter(check => !check.blocked).map(check => check.status),
    [200, 302]
  );
});

test('public release mismatches and transport failures fail without revealing response contents', async () => {
  const request = fixtures(url => {
    if (url.origin === admin) throw new Error(secretCanary);
    if (url.origin === apex && url.pathname === '/ru/') return home('20261121-prod-abcdef0-aaed1200');
    return null;
  });
  const result = await verifyHostedSiteAdmin({ request, expectedPublicRelease: build });
  assert.equal(result.ok, false);
  assert.equal(result.publicHome.valid, false);
  assert.ok(result.adminChecks.every(check => check.status === null));
  assert.ok(!JSON.stringify(result).includes(secretCanary));
});
