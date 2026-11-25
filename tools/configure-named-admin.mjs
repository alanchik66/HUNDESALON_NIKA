import assert from 'node:assert/strict';
import { open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  atomicFile,
  connectCloudflareManagement,
  prepareCloudflareConnectorStorage,
  PREVIEW,
} from './configure-named-preview.mjs';

const host = `admin-preview.${PREVIEW.domain}`;
const origin = `https://${host}`;
const name = 'HUNDESALON NIKA – Local Admin';
const tunnelName = 'HUNDESALON_NIKA_Local_Admin';
const service = 'http://127.0.0.1:5515';
const account = `/accounts/${PREVIEW.accountId}`;
const apps = `${account}/access/apps`;
const tunnels = `${account}/cfd_tunnel`;
const privateDirectory = path.resolve(import.meta.dirname, '../.secrets/cloudflare-admin');
const receiptFile = path.join(privateDirectory, 'provisioning.json');
const tokenFile = path.join(privateDirectory, 'tunnel.token');
const runtimeFile = path.join(privateDirectory, 'runtime.json');
const lockFile = path.join(privateDirectory, 'provisioning.lock');
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const hex = /^[a-f0-9]{32}$/i;
const audPattern = /^[a-f0-9]{64}$/i;
const emailPattern = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

async function list(api, resource) {
  const { result, resultInfo } = await api('GET', `${resource}${resource.includes('?') ? '&' : '?'}per_page=100`);
  assert.ok(
    Array.isArray(result) && (resultInfo?.total_pages ?? 1) <= 1 && result.length < 100,
    'Cloudflare list is incomplete.'
  );
  return result;
}

async function readReceipt() {
  try {
    const result = JSON.parse(await readFile(receiptFile, 'utf8'));
    assert.ok(
      result.version === 1 &&
        result.hostname === host &&
        result.accountId === PREVIEW.accountId &&
        hex.test(result.zoneId),
      'Admin provisioning receipt identity rejected.'
    );
    assert.ok(
      (!result.appId || uuid.test(result.appId)) && (!result.tunnelId || uuid.test(result.tunnelId)),
      'Admin provisioning receipt IDs rejected.'
    );
    return result;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function policyMatches(policy, email) {
  const rule = policy?.include?.[0];
  return (
    policy?.decision === 'allow' &&
    policy.include?.length === 1 &&
    Object.keys(rule ?? {}).length === 1 &&
    rule?.email?.email === email &&
    !policy.require?.length &&
    !policy.exclude?.length
  );
}

function appMatches(app, otpId) {
  return (
    app?.name === name &&
    app.type === 'self_hosted' &&
    app.domain === host &&
    audPattern.test(app.aud) &&
    app.destinations?.length === 1 &&
    app.destinations[0].type === 'public' &&
    app.destinations[0].uri === host &&
    !app.destinations[0].overrides?.length &&
    app.allowed_idps?.length === 1 &&
    app.allowed_idps[0] === otpId &&
    app.auto_redirect_to_identity === true &&
    !app.allow_authenticate_via_warp &&
    !app.options_preflight_bypass &&
    app.session_duration === '1h' &&
    app.http_only_cookie_attribute === true
  );
}

function tunnelMatches(config, teamName, audience) {
  const [rule, fallback] = config?.ingress ?? [];
  const access = rule?.originRequest?.access;
  return (
    config?.ingress?.length === 2 &&
    rule.hostname === host &&
    !rule.path &&
    rule.service === service &&
    access?.required === true &&
    access.teamName === teamName &&
    access.audTag?.length === 1 &&
    access.audTag[0] === audience &&
    fallback.service === 'http_status:404' &&
    !fallback.hostname &&
    !fallback.path &&
    !config['warp-routing']?.enabled
  );
}

async function configure(api, email, apply) {
  const [organization, providers, zones, foundApps, foundTunnels] = await Promise.all([
    api('GET', `${account}/access/organizations`).then(value => value.result),
    list(api, `${account}/access/identity_providers`),
    list(api, `/zones?name=${PREVIEW.domain}&account.id=${PREVIEW.accountId}`),
    list(api, `${apps}?domain=${host}&exact=true`),
    list(api, `${tunnels}?name=${tunnelName}&is_deleted=false`),
  ]);
  const team = /^(?:https:\/\/)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.cloudflareaccess\.com$/.exec(
    organization?.auth_domain || ''
  );
  const otp = providers.filter(item => item.type === 'onetimepin');
  const zone = zones.find(item => item.name === PREVIEW.domain && item.account?.id === PREVIEW.accountId);
  assert.ok(
    team && otp.length === 1 && /^(?:[a-f0-9]{32}|[a-f0-9-]{36})$/i.test(otp[0].id),
    'Existing Cloudflare team or single email PIN provider could not be verified.'
  );
  assert.ok(
    zone?.status === 'active' && !zone.paused && hex.test(zone.id),
    'Authorized Cloudflare zone was not verified.'
  );
  const teamOrigin = `https://${team[1]}.cloudflareaccess.com`;
  const dnsResource = `/zones/${zone.id}/dns_records`;
  const dns = await list(api, `${dnsResource}?name=${host}`);
  let receipt = await readReceipt();
  if (receipt) assert.equal(receipt.zoneId, zone.id, 'Admin provisioning receipt belongs to another zone.');
  assert.ok(
    foundApps.length <= 1 && (foundApps[0]?.id ?? null) === (receipt?.appId ?? null),
    'Existing Access app does not match the admin provisioning receipt.'
  );
  assert.ok(
    foundTunnels.length <= 1 && (foundTunnels[0]?.id ?? null) === (receipt?.tunnelId ?? null),
    'Existing tunnel does not match the admin provisioning receipt.'
  );
  const validDns = (record, tunnelId) =>
    uuid.test(tunnelId) &&
    record?.type === 'CNAME' &&
    record.name === host &&
    record.proxied === true &&
    record.content?.replace(/\.$/, '') === `${tunnelId}.cfargotunnel.com`;
  assert.ok(
    !dns.length || (dns.length === 1 && validDns(dns[0], receipt?.tunnelId)),
    'Conflicting DNS exists on the admin hostname.'
  );
  if (!apply)
    assert.ok(receipt?.appId && receipt.tunnelId && dns.length, 'The named admin address is not yet provisioned.');
  if (apply)
    await prepareCloudflareConnectorStorage(
      privateDirectory,
      ['provisioning.json', 'tunnel.token', 'runtime.json', 'provisioning.lock'],
      receipt
    );
  const lock = apply ? await open(lockFile, 'wx', 0o600) : null;
  try {
    receipt ??= { version: 1, hostname: host, accountId: PREVIEW.accountId, zoneId: zone.id };
    const saveReceipt = () => atomicFile(receiptFile, JSON.stringify(receipt));
    if (!receipt.appId) {
      const { result } = await api('POST', apps, {
        name,
        domain: host,
        type: 'self_hosted',
        destinations: [{ type: 'public', uri: host }],
        allowed_idps: [otp[0].id],
        auto_redirect_to_identity: true,
        allow_authenticate_via_warp: false,
        app_launcher_visible: false,
        options_preflight_bypass: false,
        session_duration: '1h',
        http_only_cookie_attribute: true,
      });
      assert.ok(uuid.test(result?.id) && result.domain === host, 'Created Access app identity did not verify.');
      receipt.appId = result.id;
      await saveReceipt();
    }
    const appResource = `${apps}/${receipt.appId}`;
    const app = (await api('GET', appResource)).result;
    assert.ok(appMatches(app, otp[0].id), 'The Access application does not match the required protection.');
    const policyResource = `${appResource}/policies`;
    const policies = await list(api, policyResource);
    if (apply && policies.length === 0) {
      await api('POST', policyResource, {
        name: 'Salon owner',
        decision: 'allow',
        include: [{ email: { email } }],
        exclude: [],
        require: [],
        precedence: 1,
      });
    }
    const verifiedPolicies = await list(api, policyResource);
    assert.ok(
      verifiedPolicies.length === 1 && policyMatches(verifiedPolicies[0], email),
      'The Access policy does not authorize exactly the approved email.'
    );

    if (!receipt.tunnelId) {
      const { result } = await api('POST', tunnels, { name: tunnelName, config_src: 'cloudflare' });
      assert.ok(uuid.test(result?.id) && result.name === tunnelName, 'Created tunnel identity did not verify.');
      receipt.tunnelId = result.id;
      await saveReceipt();
    }
    const configResource = `${tunnels}/${receipt.tunnelId}/configurations`;
    const readConfiguration = async () => (await api('GET', configResource)).result?.config;
    const current = await readConfiguration();
    if (
      apply &&
      !current?.ingress?.length &&
      !current?.['warp-routing']?.enabled &&
      !Object.keys(current?.originRequest ?? {}).length
    ) {
      await api('PUT', configResource, {
        config: {
          ingress: [
            {
              hostname: host,
              service,
              originRequest: { access: { required: true, teamName: team[1], audTag: [app.aud] } },
            },
            { service: 'http_status:404' },
          ],
        },
      });
    }
    assert.ok(
      tunnelMatches(await readConfiguration(), team[1], app.aud),
      'The tunnel does not enforce the verified Access audience.'
    );

    if (apply) {
      const token = (await api('GET', `${tunnels}/${receipt.tunnelId}/token`)).result;
      assert.ok(
        typeof token === 'string' && /^[A-Za-z0-9+/_=.-]{40,65536}$/.test(token),
        'Connector token response schema rejected.'
      );
      await atomicFile(tokenFile, token);
      await atomicFile(runtimeFile, JSON.stringify({ version: 1, origin, teamOrigin }));
      if (!dns.length) {
        assert.equal(
          (await list(api, `${dnsResource}?name=${host}`)).length,
          0,
          'DNS changed during admin provisioning.'
        );
        await api('POST', dnsResource, {
          type: 'CNAME',
          name: host,
          content: `${receipt.tunnelId}.cfargotunnel.com`,
          proxied: true,
          ttl: 1,
        });
      }
    }
    const finalDns = await list(api, `${dnsResource}?name=${host}`);
    assert.ok(finalDns.length === 1 && validDns(finalDns[0], receipt.tunnelId), 'Admin DNS did not verify.');
    return { url: `${origin}/admin/`, accessPolicyVerified: true, tunnelJwtVerified: true, dnsVerified: true };
  } finally {
    if (lock) {
      await lock.close();
      await unlink(lockFile);
    }
  }
}

const [mode, rawEmail, ...rest] = process.argv.slice(2);
try {
  assert.ok(
    ['--apply-approved', '--verify'].includes(mode) && !rest.length && emailPattern.test(rawEmail ?? ''),
    'Use --apply-approved or --verify followed by the approved email.'
  );
  const api = await connectCloudflareManagement();
  console.log(JSON.stringify(await configure(api, rawEmail.toLowerCase(), mode === '--apply-approved')));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
