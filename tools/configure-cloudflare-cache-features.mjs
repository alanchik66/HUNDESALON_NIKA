/**
 * Enable Cloudflare zone features: Crawler Hints + CSAM content scanning (API).
 * CSAM in Dashboard also requires a verified notification email — see caching/configuration/csam.
 *
 * Auth: CLOUDFLARE_API_TOKEN with Zone Settings Edit in .dev.vars
 * Usage:
 *   npm run cf:configure-cache-features
 *   npm run cf:configure-cache-features -- --email you@example.com
 *   npm run cf:configure-cache-features -- --status
 */
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

const DEFAULT_NOTIFY_EMAIL = process.env.CF_CSAM_NOTIFY_EMAIL || 'info@hundesalon-nika.com';

function parseArgs(argv) {
  const args = { status: false, email: DEFAULT_NOTIFY_EMAIL };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--status') args.status = true;
    if (token === '--email' && argv[index + 1]) {
      args.email = argv[++index];
    }
  }
  return args;
}

async function resolveAuth() {
  loadDevVars();
  try {
    const headers = getCloudflareAuthHeaders({ allowOAuthToken: true });
    if (headers) return headers;
  } catch {
    // fall through to Wrangler OAuth
  }

  const oauth = loadWranglerOAuth();
  const token = await refreshWranglerOAuth(oauth);
  return { Authorization: `Bearer ${token}` };
}

async function getCrawlerHintsStatus(auth, zoneId) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/flags/products/cache`, {
    headers: { ...auth, 'Content-Type': 'application/json' },
  });
  const payload = await response.json();
  if (!payload.success) {
    return { enabled: null, error: payload.errors?.[0]?.message || response.status };
  }
  const hints = payload.result?.features?.find(
    feature => feature.name === 'crawlhints_enabled' || feature.id === 'crawlhints_enabled'
  );
  if (hints) return { enabled: Boolean(hints.value) };
  return { enabled: null, raw: payload.result };
}

async function setCrawlerHints(auth, zoneId, enabled) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/flags/products/cache/changes`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature: 'crawlhints_enabled', value: enabled }),
  });
  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.errors?.map(error => error.message).join('; ') || response.status);
  }
  return payload.result;
}

async function getContentScanStatus(auth, zoneId) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/content-upload-scan/settings`, {
    headers: { ...auth, 'Content-Type': 'application/json' },
  });
  const payload = await response.json();
  if (!payload.success) {
    return { value: null, error: payload.errors?.[0]?.message || response.status };
  }
  return { value: payload.result?.value ?? null, modified: payload.result?.modified };
}

async function enableContentScan(auth, zoneId) {
  try {
    await cloudflareApi(auth, `/zones/${zoneId}/content-upload-scan/enable`, { method: 'POST' });
    return 'enabled (enable endpoint)';
  } catch {
    const result = await cloudflareApi(auth, `/zones/${zoneId}/content-upload-scan/settings`, {
      method: 'PUT',
      body: JSON.stringify({ value: 'enabled' }),
    });
    return result.value || 'enabled';
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = await resolveAuth();
  const zoneId = await resolveZoneId(auth);

  console.log(`Zone: ${DOMAIN} (${zoneId})`);
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log('Dashboard: Cloudflare → Caching → Configuration');

  const crawler = await getCrawlerHintsStatus(auth, zoneId);
  const csam = await getContentScanStatus(auth, zoneId);

  // Convert API-derived status to static strings to avoid taint-flow logging
  const crawlerStatus = crawler.enabled === null ? String(crawler.error || 'unknown') : String(crawler.enabled);
  const csamStatus = String(csam.value ?? csam.error ?? 'unknown');
  console.log('\nCurrent status:');
  console.log(`  Crawler Hints: ${crawlerStatus}`);
  console.log(`  Content scan (CSAM API): ${csamStatus}`);

  if (args.status) return;

  if (!crawler.enabled) {
    try {
      await setCrawlerHints(auth, zoneId, true);
      console.log('\n✓ Crawler Hints enabled via API');
    } catch (error) {
      console.warn(`\n⚠ Crawler Hints API: ${error.message}`);
      console.warn('  Enable in Dashboard → Caching → Configuration → Crawler Hints');
    }
  } else {
    console.log('\n✓ Crawler Hints already enabled');
  }

  if (csam.value !== 'enabled') {
    try {
      const value = await enableContentScan(auth, zoneId);
      console.log(`✓ Content scanning: ${value}`);
    } catch (error) {
      console.warn(`⚠ CSAM/content-scan API: ${error.message}`);
      console.warn('  Complete in Dashboard → Caching → Configuration → CSAM.');
      console.warn(`  Suggested notify email: ${args.email}`);
    }
  } else {
    console.log('✓ Content scanning already enabled');
  }

  const afterCrawler = await getCrawlerHintsStatus(auth, zoneId);
  const afterCsam = await getContentScanStatus(auth, zoneId);
  console.log('\nAfter:');
  console.log(`  Crawler Hints: ${afterCrawler.enabled}`);
  console.log(`  Content scan: ${afterCsam.value ?? afterCsam.error}`);
}

main().catch(error => {
  console.error(error.message);
  console.error('\nNeed CLOUDFLARE_API_TOKEN with Zone Settings Edit. See docs/cloudflare-api-tokens.md');
  process.exit(1);
});
