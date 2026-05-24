/**
 * Chrome CDP for Cloudflare Dashboard.
 * npm run cf:chrome-dashboard
 */
process.env.CF_CDP_BROWSER = 'chrome';
process.env.CF_CDP_PORT = '9226';

const { CF_CDP_PORT, ensureCfCdp, userDataDir } = await import('./lib/cf-cdp.mjs');

console.log(`Chrome debug profile: ${userDataDir()}`);
console.log(`Port: ${CF_CDP_PORT}`);
console.log('URL: https://dash.cloudflare.com/profile/api-tokens\n');
console.log('1. Sign in to Cloudflare in the Chrome window');
console.log('2. Run: npm run cf:chrome-fix-token\n');

await ensureCfCdp('https://dash.cloudflare.com/profile/api-tokens');
console.log(`\nDebug OK on http://127.0.0.1:${CF_CDP_PORT}/json/version`);
