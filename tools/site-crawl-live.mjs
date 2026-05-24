/**
 * Live crawl: all sitemap URLs (+ www mirror HEAD) on production.
 * Usage: npm run check:live-crawl
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apex = 'https://hundesalon-nika.com';
const concurrency = 3;
const timeoutMs = 25000;
const retries = 2;

function sitemapUrls() {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>(https:\/\/hundesalon-nika\.com\/[^<]*)<\/loc>/g)].map(m => m[1].trim());
}

async function fetchStatus(url, method = 'HEAD') {
  let lastError = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      let res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { 'User-Agent': 'HUNDESALON-NIKA-site-audit/1.0' },
      });
      if (method === 'HEAD' && res.status === 405) {
        res = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          signal: ctrl.signal,
          headers: { 'User-Agent': 'HUNDESALON-NIKA-site-audit/1.0' },
        });
      }
      return { url, status: res.status, ok: res.ok, finalUrl: res.url, attempts: attempt + 1 };
    } catch (e) {
      lastError = e.message;
    } finally {
      clearTimeout(timer);
    }
  }
  return { url, status: 0, ok: false, error: lastError, attempts: retries + 1 };
}

async function pool(items, worker) {
  const results = [];
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

const urls = sitemapUrls();
console.log(`Crawling ${urls.length} sitemap URLs on ${apex}…`);
const apexResults = await pool(urls, u => fetchStatus(u));

let wwwHead;
try {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const r = await fetch('https://www.hundesalon-nika.com/de/', { redirect: 'manual', signal: ctrl.signal });
  clearTimeout(timer);
  wwwHead = { status: r.status, location: r.headers.get('location') };
} catch (e) {
  wwwHead = { error: e.message };
}

const failed = apexResults.filter(r => !r.ok);
const report = {
  crawledAt: new Date().toISOString(),
  total: urls.length,
  ok: apexResults.filter(r => r.ok).length,
  failed: failed.map(r => ({ url: r.url, status: r.status, error: r.error })),
  www: { redirect: wwwHead },
  indexnowKey: await fetchStatus(`${apex}/indexnow-key.txt`),
  favicon: await fetchStatus(`${apex}/favicon.ico`),
  sitemap: await fetchStatus(`${apex}/sitemap.xml`),
};

const outPath = path.join(root, 'temp', 'site-crawl-report.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({ summary: { ok: report.ok, failed: report.failed.length, out: path.relative(root, outPath) } }, null, 2));
if (failed.length) {
  console.error('Failed URLs:', failed);
  process.exit(1);
}
