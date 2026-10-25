import assert from 'node:assert/strict';
import test from 'node:test';
import { auditCloudflareSecurity } from './audit-cloudflare-security.mjs';

const liveHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'SAMEORIGIN',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=()',
  'content-security-policy': "default-src 'self'",
};
const authHeaders = { Authorization: 'Bearer fixture-token' };

function createFetch({
  bots = { fight_mode: true },
  apiStatus = 200,
  rules = [{ enabled: true }],
  headers = liveHeaders,
} = {}) {
  return async (url, options) => {
    assert.equal(options.method, 'GET');
    const target = new URL(url);
    if (target.hostname !== 'api.cloudflare.com') {
      assert.equal(options.headers, undefined);
      return new Response(null, { status: target.pathname === '/' ? 200 : 405, headers });
    }
    assert.equal(options.headers.Authorization, 'Bearer fixture-token');
    if (apiStatus !== 200)
      return Response.json({ success: false, errors: [{ message: 'private provider detail' }] }, { status: apiStatus });
    const result = target.pathname.endsWith('/bot_management') ? bots : { rules };
    return Response.json({ success: true, result });
  };
}

test('checks live headers and modern rulesets without sending credentials to the site', async () => {
  const report = await auditCloudflareSecurity({ authHeaders, zoneId: 'fixture-zone', fetchImpl: createFetch() });
  assert.equal(report.checks.find(check => check.check === 'Rate limiting rules').activeRules, 1);
  assert.equal(report.checks.find(check => check.check === 'Bot Fight Mode').status, 'ok');
  assert.equal(report.checks.find(check => check.check === 'Account 2FA').status, 'unknown');
  assert.equal(report.status, 'incomplete');
});

test('does not confuse JavaScript detection with Bot Fight Mode', async () => {
  const report = await auditCloudflareSecurity({
    authHeaders,
    zoneId: 'fixture-zone',
    fetchImpl: createFetch({ bots: { enable_js: true, fight_mode: false } }),
  });
  assert.equal(report.checks.find(check => check.check === 'Bot Fight Mode').status, 'warning');
});

test('does not report disabled rules as active', async () => {
  const report = await auditCloudflareSecurity({
    authHeaders,
    zoneId: 'fixture-zone',
    fetchImpl: createFetch({ rules: [{ enabled: false }] }),
  });
  assert.equal(report.checks.find(check => check.check === 'Rate limiting rules').status, 'warning');
});

test('reports insufficient permissions as unknown without exposing provider responses', async () => {
  const report = await auditCloudflareSecurity({
    authHeaders,
    zoneId: 'fixture-zone',
    fetchImpl: createFetch({ apiStatus: 403 }),
  });
  assert.equal(report.checks.find(check => check.check === 'Custom WAF rules').status, 'unknown');
  assert.doesNotMatch(JSON.stringify(report), /fixture-token|private provider detail/);
});

test('supports public-only checks and identifies missing live headers', async () => {
  const report = await auditCloudflareSecurity({ fetchImpl: createFetch({ headers: {} }) });
  assert.equal(report.checks.find(check => check.check === 'Live headers /').status, 'warning');
  assert.equal(report.checks.find(check => check.check === 'Cloudflare configuration').status, 'unknown');
});

test('reports unreachable live endpoints as audit failures', async () => {
  const report = await auditCloudflareSecurity({
    fetchImpl: async () => {
      throw new Error('network failed');
    },
  });
  assert.equal(report.status, 'failed');
});

test('follows the canonical locale redirect without leaving the site', async () => {
  const requests = [];
  const fixtureFetch = createFetch();
  const report = await auditCloudflareSecurity({
    fetchImpl: async (url, options) => {
      const target = new URL(url);
      requests.push(target.pathname);
      if (target.pathname === '/') return new Response(null, { status: 301, headers: { location: '/de/' } });
      if (target.pathname === '/de/') return new Response(null, { status: 200, headers: liveHeaders });
      return fixtureFetch(url, options);
    },
  });
  assert.deepEqual(requests, ['/', '/de/', '/sendmail']);
  assert.equal(report.checks.find(check => check.check === 'Live headers /').status, 'ok');
});

test('refuses a redirect to another origin', async () => {
  const report = await auditCloudflareSecurity({
    fetchImpl: async url => {
      assert.equal(new URL(url).hostname, 'hundesalon-nika.com');
      return new Response(null, { status: 302, headers: { location: 'https://other.example/' } });
    },
  });
  assert.equal(report.status, 'failed');
});
