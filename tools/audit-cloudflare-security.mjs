import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCOUNT_ID,
  getCloudflareAuthHeaders,
  loadDevVars,
  loadWranglerOAuth,
  refreshWranglerOAuth,
} from './lib/cloudflare-auth.mjs';

const API = 'https://api.cloudflare.com/client/v4';
const PHASES = [
  ['Custom WAF rules', 'http_request_firewall_custom'],
  ['Managed WAF rules', 'http_request_firewall_managed'],
  ['Rate limiting rules', 'http_ratelimit'],
];

function isExpiredToken(response, payload) {
  return (
    (response.ok && payload?.success === true && payload.result?.status === 'expired') ||
    payload?.errors?.some(error => Number(error.code) === 9109)
  );
}

async function verifyToken(token, fetchImpl) {
  try {
    const response = await fetchImpl(`${API}/user/tokens/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    const payload = await response.json().catch(() => null);
    return { expired: isExpiredToken(response, payload) };
  } catch {
    // A verification outage must not suppress the actual read-only audit.
    return { expired: false };
  }
}

/** Resolve a dedicated audit token first; an expired shared token falls back to Wrangler OAuth. */
export async function resolveSecurityAuditAuthHeaders({
  fetchImpl = globalThis.fetch,
  dedicatedToken,
  currentAuthHeaders,
  getCurrentAuth = () => getCloudflareAuthHeaders({ allowOAuthToken: true }),
  loadLocalVars = loadDevVars,
  loadOAuth = loadWranglerOAuth,
  refreshOAuth = refreshWranglerOAuth,
} = {}) {
  loadLocalVars();

  const auditToken = String(dedicatedToken ?? process.env.CLOUDFLARE_SECURITY_AUDIT_API_TOKEN ?? '').trim();
  if (auditToken) {
    const verification = await verifyToken(auditToken, fetchImpl);
    if (verification.expired) {
      const error = new Error('The dedicated Cloudflare security-audit token is expired or invalid.');
      error.code = 'CLOUDFLARE_AUDIT_TOKEN_EXPIRED';
      throw error;
    }
    return { headers: { Authorization: `Bearer ${auditToken}` }, source: 'security-audit-token' };
  }

  let configuredHeaders = currentAuthHeaders;
  if (configuredHeaders === undefined) {
    try {
      configuredHeaders = getCurrentAuth();
    } catch {
      configuredHeaders = null;
    }
  }

  let expiredConfiguredToken = false;
  const configuredToken = configuredHeaders?.Authorization?.replace(/^Bearer\s+/i, '').trim();
  if (configuredToken) {
    const verification = await verifyToken(configuredToken, fetchImpl);
    expiredConfiguredToken = verification.expired;
    if (!expiredConfiguredToken) return { headers: configuredHeaders, source: 'configured-token' };
  }

  try {
    const storedOAuth = loadOAuth();
    const freshOAuthToken = await refreshOAuth(storedOAuth);
    if (freshOAuthToken) {
      return { headers: { Authorization: `Bearer ${freshOAuthToken}` }, source: 'wrangler-oauth' };
    }
  } catch {
    if (expiredConfiguredToken) {
      const error = new Error('The configured Cloudflare API token is expired and Wrangler OAuth fallback is unavailable.');
      error.code = 'CLOUDFLARE_AUDIT_TOKEN_EXPIRED';
      throw error;
    }
  }

  if (configuredHeaders) return { headers: configuredHeaders, source: 'configured-token' };
  return null;
}

function permissionFailure(error, permission, { account = false } = {}) {
  if (Number(error.code) === 9109) return 'Cloudflare rejected this credential as expired or invalid.';
  if (error.status === 401) return 'Authentication was rejected (HTTP 401); refresh or replace the credential.';
  if (error.status === 403) {
    const accountPlan = account ? ' Check the account role and whether the plan exposes account-level WAF.' : '';
    return `Access denied (HTTP 403); this check requires ${permission}.${accountPlan}`;
  }
  if (error.status === 404) {
    return account
      ? 'No account phase entrypoint is available; account-level WAF may not be enabled for this plan.'
      : 'No phase entrypoint is available.';
  }
  const providerCode = error.code == null ? '' : `, code ${error.code}`;
  return `Configuration not verified (HTTP ${error.status || 'unavailable'}${providerCode}).`;
}

export async function auditCloudflareSecurity({
  siteUrl = 'https://hundesalon-nika.com',
  authHeaders = null,
  zoneId = '',
  accountId = ACCOUNT_ID,
  fetchImpl = globalThis.fetch,
} = {}) {
  const site = new URL(siteUrl);
  if (site.protocol !== 'https:') throw new Error('SITE_ORIGIN must use HTTPS.');
  const checks = [];
  const api = async pathname => {
    const response = await fetchImpl(`${API}${pathname}`, {
      method: 'GET',
      headers: authHeaders,
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      const error = new Error('Cloudflare configuration not verified.');
      error.status = response.status;
      error.code = payload?.errors?.find(item => item.code != null)?.code;
      throw error;
    }
    return payload.result;
  };

  for (const pathname of ['/', '/sendmail']) {
    const check = `Live headers ${pathname}`;
    try {
      let target = new URL(pathname, site.origin);
      let response;
      for (let redirectCount = 0; redirectCount < 5; redirectCount++) {
        response = await fetchImpl(target, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });
        if (![301, 302, 303, 307, 308].includes(response.status)) break;
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('Redirect without a destination.');
        target = new URL(location, target);
        if (target.origin !== site.origin) throw new Error('Unexpected redirect origin.');
      }
      const headers = response.headers;
      const requirements = {
        'x-content-type-options': headers.get('x-content-type-options')?.toLowerCase() === 'nosniff',
        'x-frame-options': /^(deny|sameorigin)$/i.test(headers.get('x-frame-options') || ''),
        'referrer-policy': /^(no-referrer|same-origin|strict-origin|strict-origin-when-cross-origin)$/i.test(
          headers.get('referrer-policy') || ''
        ),
        'permissions-policy': Boolean(headers.get('permissions-policy')),
        ...(pathname === '/' ? { 'content-security-policy': Boolean(headers.get('content-security-policy')) } : {}),
      };
      const missing = Object.keys(requirements).filter(name => !requirements[name]);
      const expectedStatus = pathname === '/' ? response.status === 200 : response.status === 405;
      checks.push({
        check,
        status: !expectedStatus ? 'error' : missing.length ? 'warning' : 'ok',
        httpStatus: response.status,
        message: !expectedStatus
          ? 'Unexpected HTTP response; application headers not verified.'
          : missing.length
            ? `Missing or unexpected headers: ${missing.join(', ')}`
            : 'Headers verified on the live response.',
      });
      await response.body?.cancel();
    } catch {
      checks.push({ check, status: 'error', message: 'Live response could not be read.' });
    }
  }

  if (authHeaders) {
    let resolvedZoneId = zoneId;
    if (!resolvedZoneId) {
      try {
        const zones = await api(`/zones?name=${encodeURIComponent(site.hostname)}`);
        resolvedZoneId = zones.find(zone => zone.name === site.hostname)?.id || '';
        if (!resolvedZoneId) throw new Error('Cloudflare zone not found.');
      } catch (error) {
        checks.push({
          check: 'Cloudflare zone access',
          status: error.status === 403 ? 'unknown' : 'error',
          message: error.status === 403
            ? permissionFailure(error, 'Zone Read for hundesalon-nika.com')
            : error.status === 404
              ? 'Zone lookup failed (HTTP 404).'
              : permissionFailure(error, 'Zone Read for hundesalon-nika.com'),
        });
      }
    }

    if (resolvedZoneId) {
      const zoneResults = await Promise.all(
        PHASES.map(async ([check, phase]) => {
          try {
            const ruleset = await api(`/zones/${encodeURIComponent(resolvedZoneId)}/rulesets/phases/${phase}/entrypoint`);
            const activeRules = ruleset.rules?.filter(rule => rule.enabled !== false).length || 0;
            return {
              check,
              status: activeRules ? 'ok' : 'warning',
              activeRules,
              message: `${activeRules} enabled rules; matching traffic and effectiveness require separate verification.`,
            };
          } catch (error) {
            return {
              check,
              status: error.status === 404 ? 'warning' : error.status === 403 ? 'unknown' : 'error',
              message: permissionFailure(error, 'Zone WAF Read for hundesalon-nika.com'),
            };
          }
        })
      );
      checks.push(...zoneResults);

      try {
        const bots = await api(`/zones/${encodeURIComponent(resolvedZoneId)}/bot_management`);
        checks.push({
          check: 'Bot Fight Mode',
          status: bots.fight_mode === true ? 'ok' : bots.fight_mode === false ? 'warning' : 'unknown',
          message:
            bots.fight_mode === true
              ? 'fight_mode is enabled.'
              : bots.fight_mode === false
                ? 'fight_mode is disabled.'
                : 'fight_mode was not returned; status is unknown.',
        });
      } catch (error) {
        checks.push({
          check: 'Bot Fight Mode',
          status: error.status === 403 ? 'unknown' : 'error',
          message: permissionFailure(error, 'Bot Management Read for hundesalon-nika.com'),
        });
      }
    }

    let zonePlan = '';
    if (resolvedZoneId) {
      try {
        const zone = await api(`/zones/${encodeURIComponent(resolvedZoneId)}`);
        zonePlan = String(zone.plan?.name || '');
        checks.push({
          check: 'Cloudflare zone plan',
          status: zonePlan ? 'ok' : 'unknown',
          ...(zonePlan ? { plan: zonePlan } : {}),
          message: zonePlan ? `Zone plan verified: ${zonePlan}.` : 'Zone plan was not returned by the API.',
        });
      } catch (error) {
        checks.push({
          check: 'Cloudflare zone plan',
          status: error.status === 403 ? 'unknown' : 'error',
          message: permissionFailure(error, 'Zone Read for hundesalon-nika.com'),
        });
      }
    }

    if (/enterprise/i.test(zonePlan)) {
      const accountResults = await Promise.all(
        PHASES.map(async ([check, phase]) => {
          try {
            const ruleset = await api(`/accounts/${encodeURIComponent(accountId)}/rulesets/phases/${phase}/entrypoint`);
            const activeRules = ruleset.rules?.filter(rule => rule.enabled !== false).length || 0;
            return {
              check: `Account ${check}`,
              status: activeRules ? 'ok' : 'warning',
              activeRules,
              message: `${activeRules} enabled account-level rules; matching traffic and effectiveness require separate verification.`,
            };
          } catch (error) {
            return {
              check: `Account ${check}`,
              status: error.status === 404 ? 'warning' : error.status === 403 ? 'unknown' : 'error',
              message: permissionFailure(error, 'Account Rulesets Read or Account WAF Read', { account: true }),
            };
          }
        })
      );
      checks.push(...accountResults);
    } else {
      const notApplicable = /free|pro|business/i.test(zonePlan);
      checks.push(
        ...PHASES.map(([check]) => ({
          check: `Account ${check}`,
          status: notApplicable ? 'not-applicable' : 'unknown',
          message: notApplicable
            ? `Account-level WAF requires Enterprise; the current zone plan is ${zonePlan}.`
            : 'Account-level WAF entitlement is unverified; account-level checks were not attempted.',
        }))
      );
    }
  } else {
    checks.push({
      check: 'Cloudflare configuration',
      status: 'unknown',
      message: 'No API credentials supplied; only public responses were checked.',
    });
  }
  checks.push(
    {
      check: 'Account 2FA',
      status: 'unknown',
      message: 'Not verified by this audit; review account authentication settings.',
    },
    {
      check: 'Billing controls',
      status: 'unknown',
      message: 'No spending cap verified; review the actual plan, usage and supported billing controls.',
    }
  );
  return {
    site: site.origin,
    checkedAt: new Date().toISOString(),
    status: checks.some(check => check.status === 'error')
      ? 'failed'
      : checks.some(check => !['ok', 'not-applicable'].includes(check.status))
        ? 'incomplete'
        : 'passed',
    checks,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const publicOnly = process.argv.includes('--public-only');
    const credential = publicOnly ? null : await resolveSecurityAuditAuthHeaders();
    const report = await auditCloudflareSecurity({
      siteUrl: process.env.SITE_ORIGIN || 'https://hundesalon-nika.com',
      zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
      authHeaders: credential?.headers || null,
    });
    report.credentialSource = credential?.source || 'none';
    console.log(JSON.stringify(report, null, 2));
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) {
    if (error.code === 'CLOUDFLARE_AUDIT_TOKEN_EXPIRED') {
      console.error(error.message);
    } else {
      console.error('Security audit could not start; check local configuration. Credentials were not logged.');
    }
    process.exitCode = 1;
  }
}
