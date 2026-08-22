/**
 * Configure Cloudflare WAF rate limiting rules for Pages Functions API routes.
 *
 * Auth: CLOUDFLARE_API_TOKEN with Zone WAF Write (or Wrangler OAuth with zone edit).
 * Usage:
 *   npm run cf:configure-waf-rate-limits
 *   npm run cf:configure-waf-rate-limits -- --status
 */
import { exec } from 'node:child_process';
import {
  ACCOUNT_ID,
  DOMAIN,
  cloudflareApi,
  getCloudflareAuthHeaders,
  loadDevVars,
  loadWranglerOAuth,
  refreshWranglerOAuth,
  resolveZoneId,
} from './lib/cloudflare-auth.mjs';

const RULE_PREFIX = 'HUNDESALON:';
const PHASE = 'http_ratelimit';

const ENDPOINT_LIMITS = [
  {
    path: '/sendmail',
    description: `${RULE_PREFIX} POST /sendmail`,
    requestsPerPeriod: 12,
    period: 60,
    mitigationTimeout: 120,
  },
  {
    path: '/message-draft',
    description: `${RULE_PREFIX} POST /message-draft`,
    requestsPerPeriod: 10,
    period: 60,
    mitigationTimeout: 120,
  },
  {
    path: '/seo-generate',
    description: `${RULE_PREFIX} POST /seo-generate`,
    requestsPerPeriod: 4,
    period: 60,
    mitigationTimeout: 120,
  },
  {
    path: '/subscribe',
    description: `${RULE_PREFIX} POST /subscribe`,
    requestsPerPeriod: 5,
    period: 60,
    mitigationTimeout: 120,
  },
  {
    path: '/upload',
    description: `${RULE_PREFIX} POST /upload`,
    requestsPerPeriod: 4,
    period: 60,
    mitigationTimeout: 120,
  },
  {
    path: '/payment',
    description: `${RULE_PREFIX} POST /payment`,
    requestsPerPeriod: 2,
    period: 60,
    mitigationTimeout: 120,
  },
];

const COMBINED_RULE_DESC = `${RULE_PREFIX} POST protected API endpoints`;
const COMBINED_RULE_LIMIT = {
  requestsPerPeriod: 2,
  period: 10,
  mitigationTimeout: 10,
};

function parseArgs(argv) {
  return { status: argv.includes('--status') };
}

async function resolveAuth() {
  loadDevVars();
  try {
    const headers = getCloudflareAuthHeaders({ allowOAuthToken: true });
    if (headers) return headers;
  } catch {
    // fall through
  }

  const oauth = loadWranglerOAuth();
  const token = await refreshWranglerOAuth(oauth);
  return { Authorization: `Bearer ${token}` };
}

function buildRulePayload({ path, description, requestsPerPeriod, period, mitigationTimeout }) {
  return {
    description,
    expression: `(http.request.uri.path eq "${path}" and http.request.method eq "POST")`,
    action: 'block',
    action_parameters: {
      response: {
        status_code: 429,
        content: '{"error":"Too many requests"}',
        content_type: 'application/json',
      },
    },
    ratelimit: {
      characteristics: ['ip.src', 'cf.colo.id'],
      period,
      requests_per_period: requestsPerPeriod,
      mitigation_timeout: mitigationTimeout,
    },
    enabled: true,
  };
}

function buildCombinedRulePayload() {
  return {
    description: COMBINED_RULE_DESC,
    expression:
      '((http.request.uri.path eq "/sendmail" or http.request.uri.path eq "/message-draft" or http.request.uri.path eq "/seo-generate" or http.request.uri.path eq "/subscribe" or http.request.uri.path eq "/upload" or http.request.uri.path eq "/payment") and http.request.method eq "POST")',
    action: 'block',
    action_parameters: {
      response: {
        status_code: 429,
        content: '{"error":"Too many requests"}',
        content_type: 'application/json',
      },
    },
    ratelimit: {
      characteristics: ['ip.src', 'cf.colo.id'],
      period: COMBINED_RULE_LIMIT.period,
      requests_per_period: COMBINED_RULE_LIMIT.requestsPerPeriod,
      mitigation_timeout: COMBINED_RULE_LIMIT.mitigationTimeout,
    },
    enabled: true,
  };
}

function isSingleRulePhaseLimit(error) {
  return /maximum number of rules in the phase .* out of 1/i.test(String(error?.message || error));
}

async function getPhaseRuleset(auth, zoneId) {
  const headers = typeof auth === 'string' ? { Authorization: `Bearer ${auth}` } : auth;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`,
    { headers: { ...headers, 'Content-Type': 'application/json' } }
  );
  const payload = await response.json();
  if (response.status === 404) {
    return null;
  }
  if (!response.ok || !payload.success) {
    throw new Error(
      `Cloudflare API phases/${PHASE}/entrypoint failed: ${payload.errors?.map(error => error.message).join('; ') || response.status}`
    );
  }
  return payload.result;
}

async function createPhaseRuleset(auth, zoneId, rules) {
  return cloudflareApi(auth, `/zones/${zoneId}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'HUNDESALON NIKA API rate limits',
    description: 'Rate limits for Pages Functions (sendmail, subscribe, upload, payment, AI routes)',
      kind: 'zone',
      phase: PHASE,
      rules,
    }),
  });
}

async function addRule(auth, zoneId, rulesetId, rule) {
  return cloudflareApi(auth, `/zones/${zoneId}/rulesets/${rulesetId}/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

async function updateRule(auth, zoneId, rulesetId, ruleId, rule) {
  return cloudflareApi(auth, `/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(rule),
  });
}

function ruleNeedsUpdate(existing, desired) {
  const existingLimit = existing?.ratelimit;
  const desiredLimit = desired.ratelimit;
  return (
    existing?.expression !== desired.expression ||
    existing?.action !== desired.action ||
    existingLimit?.period !== desiredLimit.period ||
    existingLimit?.requests_per_period !== desiredLimit.requests_per_period ||
    existingLimit?.mitigation_timeout !== desiredLimit.mitigation_timeout
  );
}

async function ensureRules(auth, zoneId) {
  const desiredRules = ENDPOINT_LIMITS.map(buildRulePayload);
  let ruleset = await getPhaseRuleset(auth, zoneId);

  if (!ruleset) {
    try {
      ruleset = await createPhaseRuleset(auth, zoneId, desiredRules);
      console.log(`Created ${PHASE} ruleset with ${desiredRules.length} rate limit rules.`);
    } catch (error) {
      if (!isSingleRulePhaseLimit(error)) throw error;
      const combinedRule = buildCombinedRulePayload();
      ruleset = await createPhaseRuleset(auth, zoneId, [combinedRule]);
      console.log(`Created ${PHASE} ruleset with single fallback rule: ${combinedRule.description}.`);
    }
    return ruleset;
  }

  const rulesetId = ruleset.id;
  const existingRules = Array.isArray(ruleset.rules) ? ruleset.rules : [];
  const combinedRule = buildCombinedRulePayload();
  const existingCombined = existingRules.find(rule => rule.description === COMBINED_RULE_DESC);
  if (existingCombined) {
    if (ruleNeedsUpdate(existingCombined, combinedRule)) {
      await updateRule(auth, zoneId, rulesetId, existingCombined.id, combinedRule);
      console.log(`WAF rate limits: updated fallback rule ${COMBINED_RULE_DESC}.`);
    } else {
      console.log(`WAF rate limits: fallback rule ${COMBINED_RULE_DESC} unchanged.`);
    }
    return getPhaseRuleset(auth, zoneId);
  }
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const desired of desiredRules) {
    const existing = existingRules.find(rule => rule.description === desired.description);
    if (!existing) {
      try {
        await addRule(auth, zoneId, rulesetId, desired);
      } catch (error) {
        if (!isSingleRulePhaseLimit(error)) throw error;
        if (existingRules.length === 0) {
          await addRule(auth, zoneId, rulesetId, combinedRule);
          console.log(`WAF rate limits: created fallback rule ${COMBINED_RULE_DESC}.`);
          return getPhaseRuleset(auth, zoneId);
        }
        throw error;
      }
      created += 1;
      continue;
    }

    if (ruleNeedsUpdate(existing, desired)) {
      await updateRule(auth, zoneId, rulesetId, existing.id, desired);
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  console.log(`WAF rate limits: ${created} created, ${updated} updated, ${unchanged} unchanged.`);
  return getPhaseRuleset(auth, zoneId);
}

async function printStatus(auth, zoneId) {
  const ruleset = await getPhaseRuleset(auth, zoneId);
  if (!ruleset) {
    console.log(`No ${PHASE} entry point ruleset on ${DOMAIN}.`);
    return;
  }

  const rules = (ruleset.rules || []).filter(rule => String(rule.description || '').startsWith(RULE_PREFIX));
  if (!rules.length) {
    console.log(`Ruleset ${ruleset.id} exists but no ${RULE_PREFIX} rules found.`);
    return;
  }

  for (const rule of rules) {
    const limit = rule.ratelimit || {};
    console.log(
      `- ${rule.description}: ${limit.requests_per_period}/${limit.period}s, mitigation ${limit.mitigation_timeout}s, enabled=${rule.enabled !== false}`
    );
  }
}

function openDashboard() {
  const url = `https://dash.cloudflare.com/${ACCOUNT_ID}/${DOMAIN}/security/waf/rate-limiting-rules`;
  // Log static message only - do not log the URL containing account IDs
  console.log('\nOpen Cloudflare dashboard → Security → WAF → Rate limiting rules.');
  const start =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(start, () => {});
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = await resolveAuth();
  const zoneId = await resolveZoneId(auth);

  if (args.status) {
    await printStatus(auth, zoneId);
    return;
  }

  try {
    await ensureRules(auth, zoneId);
    await printStatus(auth, zoneId);
  } catch (error) {
    console.error(`\n${error.message}`);
    console.error('Token needs Zone → WAF Write. Create a custom API token or configure rules in Dashboard.');
    openDashboard();
    process.exitCode = 1;
  }
}

main();
