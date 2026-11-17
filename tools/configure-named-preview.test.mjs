import test from 'node:test';
import assert from 'node:assert/strict';
import { PREVIEW, desiredConfiguration, matchingConfiguration, inspectNamedPreview, applyNamedPreview,
  cloudflareApi, validatePrivateAcl, updatedRuntimeConfiguration, validatedReceipt } from './configure-named-preview.mjs';

const zoneId = '1'.repeat(32), dnsId = '2'.repeat(32);
const tunnelId = '11111111-2222-4333-8444-555555555555';
const connector = 'unit-test-connector-fixture-not-a-real-credential-0000000000';
const tunnelPath = `/accounts/${PREVIEW.accountId}/cfd_tunnel`;
const record = () => ({ id: dnsId, type: 'CNAME', name: PREVIEW.hostname, content: `${tunnelId}.cfargotunnel.com`, proxied: true, ttl: 1 });
const receipt = (dns = null) => ({ version: 1, accountId: PREVIEW.accountId, zoneId, hostname: PREVIEW.hostname,
  tunnelName: PREVIEW.tunnelName, tunnelId, dnsId: dns });

function fixture(options = {}) {
  const events = [], receipts = [], publicReports = [];
  let configured = options.existing === true, createdDns = options.existing === true, lists = 0;
  const api = async (method, resource, body) => {
    events.push({ method, resource, body });
    if (resource === '/user/tokens/verify') return { result: { status: options.inactive ? 'disabled' : 'active' } };
    if (resource === `/accounts/${PREVIEW.accountId}`) return { result: { id: PREVIEW.accountId } };
    if (resource.startsWith('/zones?')) return { result: [{ id: zoneId, name: PREVIEW.domain, status: 'active', paused: false, account: { id: PREVIEW.accountId } }] };
    if (method === 'GET' && resource.startsWith(`${tunnelPath}?`)) return { result: options.existing ? [{ id: tunnelId, name: PREVIEW.tunnelName }] : [] };
    if (method === 'GET' && resource.includes('/dns_records?')) {
      lists++;
      return { result: options.foreignDns ? [{ ...record(), content: 'unrelated.example.com' }]
        : createdDns || options.race && lists > 1 ? [record()] : [] };
    }
    if (method === 'POST' && resource === tunnelPath) return { result: { id: tunnelId, name: PREVIEW.tunnelName } };
    if (resource === `${tunnelPath}/${tunnelId}/configurations`) {
      if (method === 'PUT') { configured = true; return { result: { config: body.config } }; }
      return { result: { config: options.badConfig ? { ingress: [{ service: 'http://unexpected.invalid' }] }
        : configured ? desiredConfiguration() : {} } };
    }
    if (resource === `${tunnelPath}/${tunnelId}/token`) return { result: connector };
    if (method === 'POST' && resource === `/zones/${zoneId}/dns_records`) { createdDns = true; return { result: record() }; }
    if (method === 'GET' && resource === `/zones/${zoneId}/dns_records/${dnsId}`) return { result: record() };
    throw new Error('An unexpected API route was attempted.');
  };
  const storage = {
    prepare: async () => { events.push({ storage: 'protected-directory' }); if (options.aclFailure) throw new Error('ACL check failed.'); },
    saveReceipt: async value => { receipts.push(structuredClone(value)); events.push({ storage: 'receipt' }); },
    saveToken: async value => { assert.ok(value === connector, 'only the issued connector is stored privately'); events.push({ storage: 'private-token' }); },
    saveRuntime: async () => events.push({ storage: 'runtime' }),
    savePublic: async value => publicReports.push(structuredClone(value)),
  };
  return { api, storage, events, receipts, publicReports };
}

test('inspection verifies the exact authorized identities and performs GET requests only', async () => {
  const h = fixture(), plan = await inspectNamedPreview(h.api);
  assert.equal(plan.canApply, true); assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.accountId, PREVIEW.accountId); assert.equal(plan.zoneId, zoneId);
  assert.equal(plan.publicUrl, 'https://preview.hundesalon-nika.com');
  assert.ok(h.events.every(event => event.method === 'GET'));
  assert.deepEqual(plan.namedTunnels, []); assert.deepEqual(plan.dns, []);
});

test('a disabled management token stops inspection without trying another credential or account', async () => {
  const h = fixture({ inactive: true });
  await assert.rejects(inspectNamedPreview(h.api), /not active/);
  assert.equal(h.events.length, 1); assert.equal(h.events[0].resource, '/user/tokens/verify');
});

test('foreign DNS and unowned named resources block all writes', async () => {
  for (const options of [{ foreignDns: true }, { existing: true }]) {
    const h = fixture(options), plan = await inspectNamedPreview(h.api);
    assert.equal(plan.canApply, false);
    await assert.rejects(applyNamedPreview(h.api, plan, null, h.storage), /does not authorize/);
    assert.ok(h.events.every(event => event.method === 'GET'));
  }
});

test('fresh provisioning creates only the exact tunnel, read-only loopback ingress and preview DNS', async () => {
  const h = fixture(), plan = await inspectNamedPreview(h.api);
  const result = await applyNamedPreview(h.api, plan, null, h.storage);
  const writes = h.events.filter(event => ['POST', 'PUT'].includes(event.method));
  assert.deepEqual(writes, [
    { method: 'POST', resource: tunnelPath, body: { name: PREVIEW.tunnelName, config_src: 'cloudflare' } },
    { method: 'PUT', resource: `${tunnelPath}/${tunnelId}/configurations`, body: { config: desiredConfiguration() } },
    { method: 'POST', resource: `/zones/${zoneId}/dns_records`, body: { type: 'CNAME', name: 'preview', content: `${tunnelId}.cfargotunnel.com`, proxied: true, ttl: 1 } },
  ]);
  const protect = h.events.findIndex(event => event.storage === 'protected-directory');
  const create = h.events.findIndex(event => event.method === 'POST');
  const privateToken = h.events.findIndex(event => event.storage === 'private-token');
  const publishDns = h.events.findIndex(event => event.method === 'POST' && event.resource.includes('/dns_records'));
  assert.ok(protect >= 0 && protect < create && privateToken < publishDns);
  assert.equal(h.receipts[0].tunnelId, tunnelId); assert.equal(h.receipts.at(-1).dnsId, dnsId);
  assert.equal(result.mode, 'applied'); assert.equal(result.configurationVerified, true);
  assert.equal(result.connectorTokenStoredPrivately, true);
  assert.ok(!JSON.stringify([result, h.receipts, h.publicReports]).includes(connector), 'receipts never contain connector credentials');
});

test('a matching owned tunnel and DNS are reused without creating or reconfiguring anything', async () => {
  const h = fixture({ existing: true }), owned = receipt(dnsId);
  const plan = await inspectNamedPreview(h.api, owned);
  assert.equal(plan.canApply, true);
  await applyNamedPreview(h.api, plan, owned, h.storage);
  assert.ok(h.events.filter(event => event.method).every(event => event.method === 'GET'));
  assert.equal(h.events.filter(event => event.storage === 'private-token').length, 1);
});

test('failure to protect the new credential folder prevents every API mutation', async () => {
  const h = fixture({ aclFailure: true }), plan = await inspectNamedPreview(h.api);
  await assert.rejects(applyNamedPreview(h.api, plan, null, h.storage), /ACL check failed/);
  assert.ok(h.events.filter(event => event.method).every(event => event.method === 'GET'));
  assert.equal(h.receipts.length, 0);
});

test('a newly occupied DNS name is never overwritten after inspection', async () => {
  const h = fixture({ race: true }), plan = await inspectNamedPreview(h.api);
  await assert.rejects(applyNamedPreview(h.api, plan, null, h.storage), /DNS changed/);
  assert.ok(!h.events.some(event => event.method !== 'GET' && event.resource?.includes('/dns_records')));
  assert.equal(h.receipts.at(-1).tunnelId, tunnelId);
  assert.equal(h.receipts.at(-1).dnsId, null, 'partial creation retains its resource identity for recovery');
});

test('an existing tunnel with unexpected ingress is never silently adopted or overwritten', async () => {
  const h = fixture({ existing: true, badConfig: true }), owned = receipt(dnsId);
  const plan = await inspectNamedPreview(h.api, owned);
  assert.equal(plan.canApply, false);
  assert.ok(plan.conflicts.includes('existing-tunnel-configuration-mismatch'));
  await assert.rejects(applyNamedPreview(h.api, plan, owned, h.storage), /does not authorize/);
  assert.ok(h.events.every(event => event.method === 'GET'));
});

test('remote configuration permits only the authorized hostname, loopback service and final catch-all404', () => {
  assert.equal(matchingConfiguration(desiredConfiguration()), true);
  assert.equal(matchingConfiguration({ ...desiredConfiguration(), 'warp-routing': { enabled: false } }), true);
  for (const value of [
    { ingress: [...desiredConfiguration().ingress, { service: 'http://other.invalid' }] },
    { ingress: [{ hostname: 'other.example.com', service: PREVIEW.service }, { service: 'http_status:404' }] },
    { ...desiredConfiguration(), originRequest: { noTLSVerify: true } },
    { ...desiredConfiguration(), 'warp-routing': { enabled: true } },
  ]) assert.equal(matchingConfiguration(value), false);
});

test('the private DACL must protect exactly the current user and SYSTEM', () => {
  const sid = 'S-1-5-21-100-200-300-1001';
  const own = `(A;OICI;FA;;;${sid})`, system = '(A;OICI;FA;;;SY)';
  assert.equal(validatePrivateAcl(`D:P${own}${system}`, sid), true);
  for (const value of [`D:${own}${system}`, `D:P${own}${system}(A;;FA;;;WD)`, `D:P${own}(A;;FA;;;BA)`,
    `D:P(A;OICIID;FA;;;${sid})${system}`, `D:P${own}`]) assert.equal(validatePrivateAcl(value, sid), false);
});

test('runtime mode preserves the existing local admin key and unrelated configuration', () => {
  const original = { key: 'a'.repeat(43), allowedEmail: 'old@example.invalid', custom: { retained: true } };
  const updated = updatedRuntimeConfiguration(original);
  assert.equal(updated.key, original.key); assert.deepEqual(updated.custom, original.custom);
  assert.equal(updated.publicReadOnly, true); assert.equal(updated.allowedEmail, null);
  assert.equal(updated.namedPublicUrl, 'https://preview.hundesalon-nika.com');
  assert.match(updated.tunnelTokenFile.replaceAll('\\', '/'), /\/.secrets\/cloudflare-preview\/tunnel\.token$/);
  assert.equal(original.allowedEmail, 'old@example.invalid');
  assert.throws(() => updatedRuntimeConfiguration({ key: 'invalid' }), /will not be replaced/);
});

test('ownership receipts cannot carry arbitrary fields into public reports', () => {
  assert.deepEqual(validatedReceipt(receipt()), receipt());
  assert.throws(() => validatedReceipt({ ...receipt(), extraSecret: 'must-not-be-published' }), /identity rejected/);
});

test('API errors never echo server credential messages and redirects remain forbidden', async () => {
  let request;
  const api = cloudflareApi('unit-test-auth-not-live', async (url, options) => {
    request = { url, options };
    return { ok: false, status: 403, json: async () => ({ success: false, errors: [{ code: 10000, message: connector }] }) };
  });
  await assert.rejects(api('GET', '/user/tokens/verify'), error => error.message.includes('HTTP 403') && !error.message.includes(connector));
  assert.equal(request.options.redirect, 'error'); assert.ok(request.options.signal instanceof AbortSignal);
  const failed = cloudflareApi('unit-test-auth-not-live', async () => { throw new Error(connector); });
  await assert.rejects(failed('GET', '/user/tokens/verify'), error => !error.message.includes(connector));
});
