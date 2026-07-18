/**
 * One-shot Bing URL submit + sitemap check via Edge CDP (port 9224).
 * Prerequisite: npm run bing:edge
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withCdpSession, sleep } from './lib/browser-cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_EDGE_PORT || 9224);
const listPath = path.join(root, 'tools', 'bing-submit-urls.txt');
const urls = fs
  .readFileSync(listPath, 'utf8')
  .split(/\r?\n/)
  .map(s => s.trim())
  .filter(s => s.startsWith('https://hundesalon-nika.com'))
  .slice(0, 100);

const submit = await withCdpSession({ port, targetPattern: /bing/i }, async ({ send, evalPage }) => {
  await send('Page.navigate', {
    url: 'https://www.bing.com/webmasters/submiturl?siteUrl=https%3A%2F%2Fhundesalon-nika.com%2F',
  });
  await sleep(10000);
  const payload = JSON.stringify(urls);
  return evalPage(`
    const urls = ${payload};
    clickMatch('отправить url|submit urls');
    await sleep(1500);
    const ta = document.querySelector('textarea');
    if (!ta) return { ok: false, reason: 'NO_TEXTAREA', sample: (document.body.innerText || '').slice(0, 400) };
    setNativeValue(ta, urls.join('\\n'));
    await sleep(800);
    const confirm = clickMatch('^(отправить|submit|send)$');
    const fallback = confirm || clickMatch('отправить|submit', { exclude: 'отправить url|submit urls' });
    await sleep(8000);
    const body = document.body.innerText || '';
    return {
      ok: !!(confirm || fallback),
      clicked: confirm || fallback,
      count: urls.length,
      quota: body.match(/Оставшаяся на сегодня квота[^\\n]{0,50}/)?.[0] || '',
      sent: body.match(/отправлен[^\\n]{0,80}/i)?.[0] || '',
      sample: body.replace(/\\s+/g, ' ').slice(0, 500),
    };
  `);
});

const sitemaps = await withCdpSession({ port, targetPattern: /bing/i }, async ({ send, evalPage }) => {
  await send('Page.navigate', {
    url: 'https://www.bing.com/webmasters/sitemaps?siteUrl=https%3A%2F%2Fhundesalon-nika.com%2F',
  });
  await sleep(9000);
  return evalPage(`
    const body = document.body?.innerText || '';
    return {
      hasSitemap: body.includes('sitemap.xml'),
      hasBrand: body.includes('sitemap-brand'),
      sample: body.replace(/\\s+/g, ' ').slice(0, 700),
    };
  `);
});

console.log(JSON.stringify({ submit, sitemaps }, null, 2));
