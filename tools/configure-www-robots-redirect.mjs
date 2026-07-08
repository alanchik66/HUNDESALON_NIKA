/**
 * Ensure www /robots.txt → apex (Page Rule, dynamic redirect, or live verify).
 * npm run cf:www-robots-redirect
 */
import { execFileSync } from 'node:child_process';
import { DOMAIN, cloudflareApi, loadDevVars, resolveZoneId } from './lib/cloudflare-auth.mjs';
import { resolveCfAuth } from './lib/cf-api-token.mjs';

const PHASE = 'http_request_dynamic_redirect';
const RULE_DESC = 'HUNDESALON www robots.txt → apex';
const PAGE_RULE_URL = 'www.hundesalon-nika.com/robots.txt';
const WWW_WILDCARD = 'www.hundesalon-nika.com/*';
const APEX_ROBOTS = 'https://hundesalon-nika.com/robots.txt';

function verifyLiveRedirect() {
  try {
    const raw = execFileSync('curl', ['-sS', '-I', 'https://www.hundesalon-nika.com/robots.txt'], {
      encoding: 'utf8',
      timeout: 25000,
    });
    const status = Number(raw.match(/HTTP\/\S+\s+(\d+)/)?.[1] || 0);
    const loc = raw.match(/^location:\s*(.+)$/im)?.[1]?.trim() || '';
    const locationUrl = loc ? new URL(loc) : null;
    const ok =
      status >= 301 &&
      status < 400 &&
      locationUrl?.hostname === 'hundesalon-nika.com' &&
      locationUrl?.pathname === '/robots.txt';
    return { ok, status, loc };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function listPageRules(auth, zoneId) {
  return cloudflareApi(auth, `/zones/${zoneId}/pagerules`);
}

function hasWildcardRedirect(rules) {
  const isApexRedirectTarget = urlValue => {
    try {
      return new URL(String(urlValue || '')).hostname.toLowerCase() === 'hundesalon-nika.com';
    } catch {
      return false;
    }
  };

  return (rules || []).some(
    r =>
      r.targets?.[0]?.constraint?.value === WWW_WILDCARD &&
      r.actions?.[0]?.id === 'forwarding_url' &&
      isApexRedirectTarget(r.actions?.[0]?.value?.url)
  );
}

function hasRobotsRedirect(rules) {
  return (rules || []).some(
    r => r.targets?.[0]?.constraint?.value === PAGE_RULE_URL && r.actions?.[0]?.id === 'forwarding_url'
  );
}

async function createRobotsPageRule(auth, zoneId) {
  return cloudflareApi(auth, `/zones/${zoneId}/pagerules`, {
    method: 'POST',
    body: JSON.stringify({
      targets: [
        {
          target: 'url',
          constraint: { operator: 'matches', value: PAGE_RULE_URL },
        },
      ],
      actions: [
        {
          id: 'forwarding_url',
          value: { url: APEX_ROBOTS, status_code: 301 },
        },
      ],
      priority: 1,
      status: 'active',
    }),
  });
}

async function getRedirectEntrypoint(auth, zoneId) {
  return cloudflareApi(auth, `/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`);
}

async function createRedirectEntrypoint(auth, zoneId, rules) {
  return cloudflareApi(auth, `/zones/${zoneId}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({
      name: `${DOMAIN} dynamic redirects`,
      kind: 'zone',
      phase: PHASE,
      rules,
    }),
  });
}

async function addRedirectRule(auth, zoneId, rulesetId, rule) {
  return cloudflareApi(auth, `/zones/${zoneId}/rulesets/${rulesetId}/rules`, {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

const desiredRule = {
  description: RULE_DESC,
  enabled: true,
  expression: '(http.host eq "www.hundesalon-nika.com" and http.request.uri.path eq "/robots.txt")',
  action: 'redirect',
  action_parameters: {
    from_value: {
      status_code: 301,
      target_url: {
        expression: 'concat("https://hundesalon-nika.com", http.request.uri.path)',
      },
      preserve_query_string: true,
    },
  },
};

loadDevVars();
const auth = resolveCfAuth();
if (!auth) {
  console.error('Set CLOUDFLARE_API_TOKEN or run: npm run cf:open-api-token');
  process.exit(1);
}

const live = verifyLiveRedirect();
if (live.ok) {
  console.log(`OK live: www /robots.txt → ${live.status} ${live.loc}`);
}

const zoneId = await resolveZoneId(auth);
let rules = [];
try {
  rules = await listPageRules(auth, zoneId);
} catch (e) {
  console.warn(`Page Rules list: ${e.message}`);
}

if (hasRobotsRedirect(rules)) {
  console.log(`Page Rule exists for ${PAGE_RULE_URL}.`);
} else if (hasWildcardRedirect(rules)) {
  console.log(`Covered by Page Rule ${WWW_WILDCARD} → apex.`);
} else {
  try {
    await createRobotsPageRule(auth, zoneId);
    console.log(`Created Page Rule: ${PAGE_RULE_URL} → apex.`);
  } catch (e) {
    console.warn(`Could not create Page Rule: ${e.message}`);
    console.warn('Add token with Page Rules Edit, or: npm run cf:open-www-robots-redirect');
  }
}

if (!live.ok) {
  try {
    let ruleset = await getRedirectEntrypoint(auth, zoneId);
    if (!ruleset) {
      await createRedirectEntrypoint(auth, zoneId, [desiredRule]);
      console.log(`Created dynamic redirect ruleset: ${RULE_DESC}`);
    } else if (!(ruleset.rules || []).some(r => r.description === RULE_DESC)) {
      await addRedirectRule(auth, zoneId, ruleset.id, desiredRule);
      console.log(`Added dynamic redirect: ${RULE_DESC}`);
    } else {
      console.log(`Dynamic redirect rule already present.`);
    }
  } catch (e) {
    console.warn(`Dynamic redirect API: ${e.message}`);
  }

  const retry = verifyLiveRedirect();
  if (!retry.ok) {
    console.error('www /robots.txt still does not 301 to apex. Use Dashboard redirect rule.');
    console.error('  npm run cf:open-www-robots-redirect');
    process.exit(1);
  }
  console.log(`OK live after API: ${retry.status} ${retry.loc}`);
}

console.log('Bing Webmaster: test only https://hundesalon-nika.com/robots.txt');
process.exit(0);
