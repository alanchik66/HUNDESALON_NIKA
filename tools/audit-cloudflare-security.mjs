import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCloudflareAuthHeaders } from './lib/cloudflare-auth.mjs';

const PHASES = [
  ['Custom WAF rules', 'http_request_firewall_custom'],
  ['Managed WAF rules', 'http_request_firewall_managed'],
  ['Rate limiting rules', 'http_ratelimit'],
];

export async function auditCloudflareSecurity({
  siteUrl = 'https://hundesalon-nika.com',
  authHeaders = null,
  zoneId = '',
  fetchImpl = globalThis.fetch,
} = {}) {
  const site = new URL(siteUrl);
  if (site.protocol !== 'https:') throw new Error('SITE_ORIGIN must use HTTPS.');
  const checks = [];
  const api = async pathname => {
    const response = await fetchImpl(`https://api.cloudflare.com/client/v4${pathname}`, {
      method: 'GET',
      headers: authHeaders,
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      const error = new Error('Cloudflare configuration not verified.');
      error.status = response.status;
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
    try {
      if (!zoneId) {
        const zones = await api(`/zones?name=${encodeURIComponent(site.hostname)}`);
        zoneId = zones.find(zone => zone.name === site.hostname)?.id || '';
        if (!zoneId) throw new Error('Cloudflare zone not found.');
      }
      const results = await Promise.all(
        PHASES.map(async ([check, phase]) => {
          try {
            const ruleset = await api(`/zones/${encodeURIComponent(zoneId)}/rulesets/phases/${phase}/entrypoint`);
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
              message:
                error.status === 404
                  ? 'No phase entrypoint is available.'
                  : `Configuration not verified (HTTP ${error.status || 'unavailable'}).`,
            };
          }
        })
      );
      checks.push(...results);
      try {
        const bots = await api(`/zones/${encodeURIComponent(zoneId)}/bot_management`);
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
          message: `Configuration not verified (HTTP ${error.status || 'unavailable'}).`,
        });
      }
    } catch (error) {
      checks.push({
        check: 'Cloudflare zone access',
        status: error.status === 403 ? 'unknown' : 'error',
        message: 'Zone configuration could not be read.',
      });
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
      : checks.some(check => check.status !== 'ok')
        ? 'incomplete'
        : 'passed',
    checks,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const authHeaders = process.argv.includes('--public-only')
      ? null
      : getCloudflareAuthHeaders({ allowOAuthToken: true });
    const report = await auditCloudflareSecurity({
      siteUrl: process.env.SITE_ORIGIN || 'https://hundesalon-nika.com',
      zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
      authHeaders,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.status === 'failed') process.exitCode = 1;
  } catch {
    console.error('Security audit could not start; check local configuration. Credentials were not logged.');
    process.exitCode = 1;
  }
}
