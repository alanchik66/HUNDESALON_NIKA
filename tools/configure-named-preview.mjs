import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PREVIEW = Object.freeze({
  accountId: '25e872aeab8cb246c69142ab07cd0fee',
  domain: 'hundesalon-nika.com',
  hostname: 'preview.hundesalon-nika.com',
  tunnelName: 'HUNDESALON_NIKA_Local_Preview',
  service: 'http://127.0.0.1:5514',
});
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PRIVATE = path.join(ROOT, '.secrets/cloudflare-preview');
const TOKEN_FILE = path.join(PRIVATE, 'tunnel.token');
const PRIVATE_RECEIPT = path.join(PRIVATE, 'provisioning.json');
const OUTPUT = path.join(ROOT, 'output/named-preview-2026-11-17');
const TUNNELS = `/accounts/${PREVIEW.accountId}/cfd_tunnel`;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HEX_ID = /^[a-f0-9]{32}$/i;

export const desiredConfiguration = () => ({ ingress: [
  { hostname: PREVIEW.hostname, service: PREVIEW.service },
  { service: 'http_status:404' },
] });

export function matchingConfiguration(value) {
  if (!value || !Array.isArray(value.ingress) || value.ingress.length !== 2) return false;
  if (Object.keys(value).some(key => !['ingress', 'originRequest', 'warp-routing'].includes(key))) return false;
  return value.ingress.every((entry, index) => {
    const expected = desiredConfiguration().ingress[index];
    return entry && Object.entries(expected).every(([key, field]) => entry[key] === field) &&
      Object.keys(entry).every(key => key in expected || key === 'originRequest' &&
        entry.originRequest && Object.keys(entry.originRequest).length === 0);
  }) && (!value['warp-routing'] || value['warp-routing'].enabled === false) &&
    (!value.originRequest || Object.keys(value.originRequest).length === 0);
}

const emptyConfiguration = value => !value || Object.keys(value).every(key => ['ingress', 'originRequest', 'warp-routing'].includes(key)) &&
  (!value.ingress || Array.isArray(value.ingress) && value.ingress.length === 0) &&
  (!value['warp-routing'] || value['warp-routing'].enabled === false) &&
  (!value.originRequest || Object.keys(value.originRequest).length === 0);
const matchesDns = (record, tunnelId) => record?.type === 'CNAME' && record.name === PREVIEW.hostname &&
  record.proxied === true && record.content?.replace(/\.$/, '').toLowerCase() === `${tunnelId}.cfargotunnel.com`.toLowerCase();

function fail(message) { throw new Error(message); }
const present = async file => stat(file).then(() => true, error => {
  if (error.code === 'ENOENT') return false;
  throw error;
});

async function privateReceipt() {
  let value;
  try { value = JSON.parse(await readFile(PRIVATE_RECEIPT, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; fail('Private provisioning receipt could not be read safely.'); }
  return validatedReceipt(value);
}

export function validatedReceipt(value) {
  const keys = ['version', 'accountId', 'zoneId', 'hostname', 'tunnelName', 'tunnelId', 'dnsId'];
  if (!value || Object.keys(value).some(key => !keys.includes(key)) || value.version !== 1 || value.accountId !== PREVIEW.accountId ||
      value.hostname !== PREVIEW.hostname || value.tunnelName !== PREVIEW.tunnelName ||
      !UUID.test(value.tunnelId || '') || !HEX_ID.test(value.zoneId || '') ||
      value.dnsId !== null && !HEX_ID.test(value.dnsId || '')) fail('Private provisioning receipt identity rejected.');
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}

/** Decrypt only through anonymous child pipes; never use argv, env or stdout logs for credentials. */
function loadManagementCredential() {
  if (process.platform !== 'win32') fail('Windows user-scoped DPAPI is required.');
  return readFile(path.join(ROOT, '.secrets/cloudflare/management-token.dpapi')).then(protectedBytes => {
    let result;
    try {
      result = spawnSync('python', ['-B', path.join(ROOT, '.secrets/cloudflare/dpapi.py'), 'unprotect'], {
        input: protectedBytes, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 10000, maxBuffer: 4096,
      });
    } finally { protectedBytes.fill(0); }
    if (result.status !== 0 || !result.stdout?.length) fail('Management DPAPI decrypt failed; no alternate credential will be used.');
    const buffer = result.stdout;
    const token = buffer.toString('utf16le').trim();
    buffer.fill(0);
    if (!/^(?:cfut_|cfat_)?[A-Za-z0-9_-]{25,200}$/.test(token)) fail('Management credential format rejected.');
    return token;
  });
}

export function cloudflareApi(token, fetcher = fetch) {
  return async (method, resource, body) => {
    if (!resource.startsWith('/') || resource.startsWith('//') || resource.includes('..')) fail('API resource rejected.');
    let response;
    try {
      response = await fetcher(`https://api.cloudflare.com/client/v4${resource}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch { fail(`Cloudflare ${method} request failed before a valid response.`); }
    let payload;
    try { payload = await response.json(); } catch { fail(`Cloudflare ${method} returned an invalid JSON response (HTTP ${response.status}).`); }
    if (!response.ok || payload.success !== true) {
      const codes = (Array.isArray(payload.errors) ? payload.errors : []).map(error => error.code).filter(Number.isInteger);
      fail(`Cloudflare ${method} rejected (HTTP ${response.status}; codes ${codes.join(',') || 'unavailable'}).`);
    }
    return { result: payload.result, resultInfo: payload.result_info };
  };
}

async function list(api, resource) {
  const result = [];
  for (let page = 1; page <= 50; page++) {
    const response = await api('GET', `${resource}${resource.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    if (!Array.isArray(response.result)) fail('Cloudflare list response schema rejected.');
    result.push(...response.result);
    const pages = response.resultInfo?.total_pages;
    if (Number.isFinite(pages) ? page >= pages : response.result.length < 100) return result;
  }
  fail('Cloudflare pagination exceeded its bounded inspection limit.');
}

export async function inspectNamedPreview(api, receipt = null) {
  const verification = await api('GET', '/user/tokens/verify');
  if (verification.result?.status !== 'active') fail('The management user token is not active.');
  const account = await api('GET', `/accounts/${PREVIEW.accountId}`);
  if (account.result?.id !== PREVIEW.accountId) fail('Cloudflare account identity rejected.');
  const zones = (await list(api, `/zones?name=${PREVIEW.domain}&account.id=${PREVIEW.accountId}`))
    .filter(zone => zone.name === PREVIEW.domain && zone.account?.id === PREVIEW.accountId);
  if (zones.length !== 1 || !HEX_ID.test(zones[0]?.id || '')) fail('Exactly one authorized domain zone is required.');
  const zone = zones[0];
  if (zone.status !== 'active' || zone.paused === true) fail('The authorized zone is not active and unpaused.');
  const tunnels = (await list(api, `${TUNNELS}?name=${PREVIEW.tunnelName}&is_deleted=false`))
    .filter(tunnel => tunnel.name === PREVIEW.tunnelName && !tunnel.deleted_at);
  const dns = await list(api, `/zones/${zone.id}/dns_records?name=${PREVIEW.hostname}`);
  const conflicts = [];
  if (tunnels.length > 1) conflicts.push('multiple-named-tunnels');
  if (dns.length > 1) conflicts.push('multiple-preview-dns-records');
  const tunnel = tunnels[0];
  let configurationMatches = null;
  let configurationNeedsInitialize = false;
  if (tunnel) {
    if (!UUID.test(tunnel.id || '')) fail('Tunnel identity schema rejected.');
    const configuration = await api('GET', `${TUNNELS}/${tunnel.id}/configurations`);
    configurationMatches = matchingConfiguration(configuration.result?.config);
    if (!receipt || receipt.tunnelId !== tunnel.id || receipt.zoneId !== zone.id) conflicts.push('existing-tunnel-without-matching-local-receipt');
    configurationNeedsInitialize = Boolean(receipt?.tunnelId === tunnel.id && receipt.zoneId === zone.id &&
      !receipt.dnsId && dns.length === 0 && emptyConfiguration(configuration.result?.config));
    if (!configurationMatches && !configurationNeedsInitialize) conflicts.push('existing-tunnel-configuration-mismatch');
  } else if (receipt) conflicts.push('receipt-without-remote-tunnel');
  if (dns.length) {
    const record = dns[0];
    if (!tunnel || !matchesDns(record, tunnel.id)) conflicts.push('existing-dns-conflict');
    if (!receipt || receipt.dnsId !== record.id) conflicts.push('existing-dns-without-matching-local-receipt');
  }
  return {
    version: 1, mode: 'inspect', inspectedAt: new Date().toISOString(), publicUrl: `https://${PREVIEW.hostname}`,
    accountId: PREVIEW.accountId, zoneId: zone.id, domain: PREVIEW.domain, managementTokenActive: true,
    namedTunnels: tunnels.map(value => ({ id: value.id, name: value.name })),
    dns: dns.map(value => ({ id: value.id, type: value.type, name: value.name, content: value.content, proxied: value.proxied })),
    configurationMatches, configurationNeedsInitialize, conflicts, canApply: conflicts.length === 0,
  };
}

function privateCommand(executable, args, options = {}) {
  const result = spawnSync(executable, args, { cwd: ROOT, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000, maxBuffer: 65536, ...options });
  if (result.status !== 0) fail(`Required local ${executable} check failed.`);
  return result.stdout;
}

function requireIgnored(file) {
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) fail('Private path escaped the project.');
  privateCommand('git', ['check-ignore', '--quiet', '--', relative]);
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', relative], {
    cwd: ROOT, windowsHide: true, stdio: 'pipe', timeout: 10000,
  });
  if (tracked.status !== 1) fail('A private preview path is tracked or its Git check failed.');
}

/** Accept only the protected DACL created for this user and SYSTEM. Never log its contents. */
export function validatePrivateAcl(sddl, userSid) {
  if (!/^S-\d-(?:\d+-)+\d+$/.test(userSid)) return false;
  const header = sddl.match(/^D:([A-Z]*)/);
  if (!header?.[1].includes('P')) return false;
  const entries = [...sddl.matchAll(/\(([^()]*)\)/g)].map(match => match[1].split(';'));
  const principals = new Set();
  for (const entry of entries) {
    if (entry.length !== 6 || entry[0] !== 'A' || entry[2] !== 'FA' ||
        !['SY', 'S-1-5-18', userSid].includes(entry[5]) || entry[1].includes('ID')) return false;
    principals.add(entry[5] === 'S-1-5-18' ? 'SY' : entry[5]);
  }
  return entries.length === 2 && principals.size === 2 && principals.has('SY') && principals.has(userSid);
}

async function atomicFile(file, bytes) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await rename(temporary, file);
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

async function preparePrivateDirectory(receipt) {
  if (process.platform !== 'win32') fail('Private connector storage requires Windows ACL verification.');
  for (const file of [TOKEN_FILE, PRIVATE_RECEIPT, path.join(OUTPUT, 'provisioning.json'), path.join(ROOT, 'output/local-preview/remote-config.json')]) requireIgnored(file);
  try { await mkdir(PRIVATE, { mode: 0o700 }); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  const entries = await readdir(PRIVATE);
  const directory = await lstat(PRIVATE), resolved = await realpath(PRIVATE), project = await realpath(ROOT);
  if (!directory.isDirectory() || directory.isSymbolicLink() || !resolved.toLowerCase().startsWith(`${project.toLowerCase()}${path.sep}`))
    fail('Private preview storage is not an ordinary directory inside this project.');
  if (entries.some(name => !['tunnel.token', 'provisioning.json'].includes(name)) || entries.length && !receipt)
    fail('An unexpected private preview directory will not be modified.');
  const identity = privateCommand('whoami.exe', ['/user', '/fo', 'csv', '/nh']).toString('utf8');
  const sids = identity.match(/S-\d-(?:\d+-)+\d+/g) || [];
  if (sids.length !== 1) fail('Current Windows user SID could not be verified.');
  const sid = sids[0];
  privateCommand('icacls.exe', [PRIVATE, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F']);
  privateCommand('icacls.exe', [PRIVATE, '/verify']);
  const aclFile = path.join(PRIVATE, `.acl-${randomUUID()}.tmp`);
  try {
    privateCommand('icacls.exe', [PRIVATE, '/save', aclFile]);
    const bytes = await readFile(aclFile);
    const text = bytes.includes(0) ? bytes.toString('utf16le') : bytes.toString('utf8');
    const descriptor = text.split(/\r?\n/).find(line => line.startsWith('D:'));
    if (!descriptor || !validatePrivateAcl(descriptor.trim(), sid)) fail('Private preview directory ACL contains unexpected access.');
  } finally { await unlink(aclFile).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
}

export function updatedRuntimeConfiguration(value) {
  if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value.key || '')) fail('Existing local preview key is invalid; it will not be replaced.');
  return { ...value, namedPublicUrl: `https://${PREVIEW.hostname}`,
    tunnelTokenFile: TOKEN_FILE, publicReadOnly: true, allowedEmail: null };
}

const runtimeStorage = {
  prepare: preparePrivateDirectory,
  saveReceipt: value => atomicFile(PRIVATE_RECEIPT, `${JSON.stringify(value, null, 2)}\n`),
  saveToken: async token => {
    requireIgnored(TOKEN_FILE);
    await atomicFile(TOKEN_FILE, token);
  },
  saveRuntime: async () => {
    const file = path.join(ROOT, 'output/local-preview/remote-config.json');
    let value;
    try { value = JSON.parse(await readFile(file, 'utf8')); } catch { fail('Existing local preview configuration is required.'); }
    await atomicFile(file, `${JSON.stringify(updatedRuntimeConfiguration(value))}\n`);
  },
  savePublic: async value => {
    await mkdir(OUTPUT, { recursive: true });
    await atomicFile(path.join(OUTPUT, 'provisioning.json'), `${JSON.stringify(value, null, 2)}\n`);
  },
};

export async function applyNamedPreview(api, inspection, receipt, storage = runtimeStorage) {
  if (inspection?.canApply !== true || inspection.conflicts?.length || inspection.accountId !== PREVIEW.accountId ||
      inspection.domain !== PREVIEW.domain || !HEX_ID.test(inspection.zoneId || '') ||
      !Array.isArray(inspection.namedTunnels) || inspection.namedTunnels.length > 1 ||
      !Array.isArray(inspection.dns) || inspection.dns.length > 1) fail('Inspection does not authorize this exact preview plan.');
  const previous = receipt ? validatedReceipt(receipt) : null;
  await storage.prepare(previous);
  let tunnel = inspection.namedTunnels[0], token = null;
  let owned = previous;
  const created = !tunnel;
  if (created) {
    const response = await api('POST', TUNNELS, { name: PREVIEW.tunnelName, config_src: 'cloudflare' });
    if (!UUID.test(response.result?.id || '') || response.result?.name !== PREVIEW.tunnelName) fail('Created tunnel identity did not match the plan.');
    tunnel = { id: response.result.id, name: response.result.name };
    token = typeof response.result.token === 'string' ? response.result.token : null;
    owned = { version: 1, accountId: PREVIEW.accountId, zoneId: inspection.zoneId,
      hostname: PREVIEW.hostname, tunnelName: PREVIEW.tunnelName, tunnelId: tunnel.id, dnsId: null };
    await storage.saveReceipt(owned);
    await storage.savePublic({ ...owned, mode: 'partial', stage: 'tunnel-created', publicUrl: `https://${PREVIEW.hostname}` });
  } else if (!owned || owned.tunnelId !== tunnel.id || owned.zoneId !== inspection.zoneId) fail('Existing tunnel has no matching ownership receipt.');
  if (created || inspection.configurationNeedsInitialize) {
    await api('PUT', `${TUNNELS}/${tunnel.id}/configurations`, { config: desiredConfiguration() });
  }
  const configuration = await api('GET', `${TUNNELS}/${tunnel.id}/configurations`);
  if (!matchingConfiguration(configuration.result?.config)) fail('The tunnel configuration did not verify; DNS will not be created.');
  if (!token) token = (await api('GET', `${TUNNELS}/${tunnel.id}/token`)).result;
  if (typeof token !== 'string' || !/^[A-Za-z0-9+/_=.-]{40,65536}$/.test(token)) fail('Connector token response schema rejected.');
  await storage.saveToken(token);
  token = null;
  let dns = inspection.dns[0];
  if (!dns) {
    const current = await list(api, `/zones/${inspection.zoneId}/dns_records?name=${PREVIEW.hostname}`);
    if (current.length) fail('The preview DNS changed after inspection; no record will be overwritten.');
    dns = (await api('POST', `/zones/${inspection.zoneId}/dns_records`, {
      type: 'CNAME', name: 'preview', content: `${tunnel.id}.cfargotunnel.com`, proxied: true, ttl: 1,
    })).result;
    if (!HEX_ID.test(dns?.id || '') || !matchesDns(dns, tunnel.id)) fail('Created DNS record identity did not verify.');
    owned = { ...owned, dnsId: dns.id };
    await storage.saveReceipt(owned);
    await storage.savePublic({ ...owned, mode: 'partial', stage: 'dns-created', publicUrl: `https://${PREVIEW.hostname}` });
  }
  if (!HEX_ID.test(dns.id || '') || !matchesDns(dns, tunnel.id) || owned.dnsId !== dns.id) fail('Existing DNS ownership did not verify.');
  const actualDns = (await api('GET', `/zones/${inspection.zoneId}/dns_records/${dns.id}`)).result;
  if (!matchesDns(actualDns, tunnel.id)) fail('DNS readback did not verify.');
  await storage.saveRuntime();
  const result = { version: 1, mode: 'applied', appliedAt: new Date().toISOString(), accountId: PREVIEW.accountId,
    zoneId: inspection.zoneId, hostname: PREVIEW.hostname, publicUrl: `https://${PREVIEW.hostname}`,
    tunnelId: tunnel.id, tunnelName: PREVIEW.tunnelName, dnsId: dns.id,
    configurationVerified: true, dnsVerified: true, connectorTokenStoredPrivately: true, runtimeConfigurationUpdated: true };
  await storage.savePublic(result);
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--inspect', '--apply-approved'].includes(arg)) || args.length > 1) fail('Use --inspect or --apply-approved.');
  const apply = args.includes('--apply-approved');
  let token;
  try {
    token = await loadManagementCredential();
    const api = cloudflareApi(token);
    const receipt = await privateReceipt();
    const inspection = await inspectNamedPreview(api, receipt);
    inspection.connectorTokenFilePresent = await present(TOKEN_FILE);
    await mkdir(OUTPUT, { recursive: true });
    await writeFile(path.join(OUTPUT, 'inspection.json'), `${JSON.stringify(inspection, null, 2)}\n`);
    console.log(JSON.stringify(inspection));
    if (apply) console.log(JSON.stringify(await applyNamedPreview(api, inspection, receipt)));
  } finally { token = undefined; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
