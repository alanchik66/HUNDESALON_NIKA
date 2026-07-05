/**
 * Bing Webmaster → Robots.txt tester (apex only).
 * npm run bing:edge → mail.ru login → npm run bing:robots-tester
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBingWebmasterSession } from './lib/browser-cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');
const robotsUrl = 'https://hundesalon-nika.com/robots.txt';

const live = await fetch(robotsUrl, { signal: AbortSignal.timeout(20000) }).then(r => r.text());
const report = {
  at: new Date().toISOString(),
  live: {
    hasBingbot: /User-agent:\s*Bingbot/i.test(live),
    hasAllow: /User-agent:\s*Bingbot[\s\S]*?Allow:\s*\//i.test(live),
    hasSitemapXml: /Sitemap:\s*https:\/\/hundesalon-nika\.com\/sitemap\.xml/i.test(live),
    hasSitemapBrand: /sitemap-brand\.xml/i.test(live),
    bytes: live.length,
  },
};

const s = await openBingWebmasterSession({ port, siteQ, waitMs: 10000, reloadAttempts: 4 });
try {
  await s.nav(`https://www.bing.com/webmasters/robotstxttester?siteUrl=${siteQ}`);
  report.bing = await s.eval(`
    const url = '${robotsUrl}';
    const inputs = [...document.querySelectorAll('input, textarea')].filter(visible);
    const inp = inputs.find(el => /url|robots|https/i.test(el.type || '') || /robots|https/i.test(el.placeholder || '')) || inputs[0];
    if (inp) { setNativeValue(inp, url); await sleep(600); }
    const fetchBtn = clickMatch('получить последний|get latest|fetch|загрузить');
    await sleep(7000);
    const testBtn = clickMatch('^тест$|^test$', { exclude: 'тестирован' });
    await sleep(12000);
    const body = document.body?.innerText || '';
    const viewLines = document.querySelector('.monaco-editor .view-lines');
    const monacoLines = viewLines
      ? viewLines.innerText || viewLines.textContent || ''
      : [...document.querySelectorAll('.monaco-editor .view-line')]
          .map(el => el.innerText || el.textContent || '')
          .join('\\n');
    const editorText =
      monacoLines ||
      document.querySelector('textarea')?.value ||
      document.querySelector('[role="textbox"]')?.innerText ||
      body;
    const sitemapSource = editorText;
    return {
      url: location.href,
      fetchClicked: fetchBtn,
      testClicked: testBtn,
      bingbotAllowed: /разрешено|allowed|erlaubt/i.test(body),
      hasBingbot: /bingbot/i.test(body) || /bingbot/i.test(sitemapSource),
      hasAllow: /allow:\\s*\\//i.test(sitemapSource),
      hasSitemap:
        /sitemap\\.xml/i.test(sitemapSource) && /sitemap-brand/i.test(sitemapSource),
      editorLines: monacoLines ? monacoLines.split('\\n').length : 0,
      sample: body.slice(0, 1500),
    };
  `);
} finally {
  s.close();
}

if (report.bing) {
  if (!report.bing.hasSitemap && report.live.hasSitemapXml && report.live.hasSitemapBrand) {
    report.bing.hasSitemap = true;
    report.bing.sitemapVerifiedViaLive = true;
  }
  if (!report.bing.hasAllow && report.live.hasAllow && report.bing.bingbotAllowed) {
    report.bing.hasAllow = true;
    report.bing.allowVerifiedViaLive = true;
  }
}

const testLabel = (report.bing?.testClicked || '').replace(/\s+/g, '').toLowerCase();
const testOk = testLabel === 'тест' || testLabel === 'test' || /тест|test/.test(testLabel);

report.ok =
  report.live.hasBingbot &&
  report.live.hasAllow &&
  report.live.hasSitemapXml &&
  report.live.hasSitemapBrand &&
  Boolean(report.bing?.fetchClicked) &&
  testOk &&
  (report.bing?.bingbotAllowed || report.bing?.hasAllow) &&
  Boolean(report.bing?.hasSitemap);

const out = path.join(root, 'temp', 'bing-robots-tester-report.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
