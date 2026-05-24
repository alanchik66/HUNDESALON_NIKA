/**
 * After favicon deploy: IndexNow, optional Bing API, live checks, favicon HEAD probes.
 */
import { spawn } from 'node:child_process';
import { loadDevVars } from './lib/cloudflare-auth.mjs';

loadDevVars();

function runNpm(script, { optional = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], { stdio: 'inherit', shell: true, env: process.env });
    child.on('close', code => {
      if (code === 0) return resolve();
      if (optional) {
        console.warn(`[seo-post-favicon] skipped ${script} (exit ${code})`);
        return resolve();
      }
      reject(new Error(`${script} failed with exit ${code}`));
    });
  });
}

const probes = [
  'https://hundesalon-nika.com/favicon.ico?v=20260520-brand-bing',
  'https://hundesalon-nika.com/assets/images/favicon/favicon-48x48.png?v=20260520-brand-bing',
  'https://hundesalon-nika.com/de/',
];

console.log('Favicon / SEO post-deploy pipeline\n');

for (const url of probes) {
  try {
    const response = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'HUNDESALON-NIKA-SEO-Probe/1.0' },
    });
    console.log(`${url}\n  → ${response.status} ${response.headers.get('content-type') || ''}`);
  } catch (error) {
    console.warn(`${url}\n  → fetch failed: ${error.message}`);
  }
}

console.log('');
await runNpm('seo:indexnow');
await runNpm('bing:api', { optional: true });
await runNpm('cf:purge-cache', { optional: true });
await runNpm('check:live-html');
await runNpm('google:gsc:audit', { optional: true });

console.log('\nDone. Bing IndexNow notified; favicon in SERP may take 2–4 weeks.');
