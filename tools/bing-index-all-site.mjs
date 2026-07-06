/**
 * Index entire site: IndexNow (all sitemap URLs) + Bing Submit URLs (up to 100/day).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { getJson, sleep, withCdpSession } from './lib/browser-cdp.mjs';
import { SITE_URL, WWW_SITE_URL, siteQuery } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || process.env.BING_EDGE_PORT || 9224);
const siteUrl = SITE_URL;
const wwwSiteUrl = WWW_SITE_URL;
const siteQ = siteQuery(siteUrl);
const listPath = path.join(root, 'tools', 'bing-submit-urls.txt');
const apexOrigin = 'https://hundesalon-nika.com';
const wwwOrigin = 'https://www.hundesalon-nika.com';

const wwwRemOnly = process.argv.includes('--www-rem');

function prioritizeForBingSubmit(urls) {
  const apex = urls.filter(u => u.startsWith(apexOrigin));
  const www = urls.filter(u => u.startsWith(wwwOrigin));
  if (wwwRemOnly) return www.slice(0, 100);
  return [...apex, ...www].slice(0, 100);
}

function runNpm(script) {
  return new Promise((resolve, reject) => {
    const p = spawn('npm', ['run', script], { cwd: root, shell: true, stdio: 'inherit' });
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${script} failed`))));
  });
}

const report = { at: new Date().toISOString() };

if (!wwwRemOnly) {
  console.log('1/4 IndexNow — apex + www (все URL из sitemap)…');
  await runNpm('seo:indexnow');
} else {
  console.log('1/4 IndexNow — пропуск (--www-rem, только Bing Submit www)');
}

const allUrls = fs.existsSync(listPath)
  ? fs
      .readFileSync(listPath, 'utf8')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.startsWith('https://'))
  : [];
const urls = prioritizeForBingSubmit(allUrls);
report.indexnow = {
  total: allUrls.length,
  apex: allUrls.filter(u => u.startsWith(apexOrigin)).length,
  www: allUrls.filter(u => u.startsWith(wwwOrigin)).length,
};
console.log(
  `   ${report.indexnow.apex} apex + ${report.indexnow.www} www → Bing Submit: ${urls.length} (квота 100/день)`
);

try {
  await getJson(`http://127.0.0.1:${port}/json/version`);
} catch {
  console.error(`Edge CDP не на порту ${port}. Запустите: npm run bing:edge`);
  process.exit(1);
}

console.log('2/4 Bing Submit URLs — apex + www (до 100)…');
report.bingSubmit = await withCdpSession({ port, targetPattern: /bing/i }, async ({ send, evalPage }) => {
  const payload = JSON.stringify(urls);
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/submiturl?siteUrl=${siteQ}` });
  await sleep(8000);
  return evalPage(`
    const urls = ${payload};
    const textarea = document.querySelector('textarea');
    const input = textarea || document.querySelector('input[type="text"], input:not([type="hidden"])');
    if (!input) return { ok: false, reason: 'NO_INPUT' };
    setNativeValue(input, urls.join('\\n'));
    await sleep(1000);
    const step1 = clickMatch('submit urls|отправить url');
    await sleep(2000);
    const buttons = Array.from(document.querySelectorAll('button, [role="button"]')).filter(el => visible(el) && !el.disabled);
    const confirm = buttons.find(el => /^(submit|отправить|send)$/i.test(txt(el)));
    const step2 = confirm ? (confirm.click(), txt(confirm)) : clickMatch('^submit$|^отправить$');
    await sleep(8000);
    const body = document.body?.innerText || '';
    const sentToday = body.match(/отправлено сегодня|submitted today[^\\n]*/i)?.[0] || '';
    return { ok: !!(step1 && step2), step1, step2, count: urls.length, sentToday, sample: body.slice(0, 600) };
  `);
});

const priorityInspect = [
  'https://hundesalon-nika.com/de/',
  'https://hundesalon-nika.com/en/',
  'https://hundesalon-nika.com/ru/',
  'https://hundesalon-nika.com/uk/',
  'https://hundesalon-nika.com/',
  'https://hundesalon-nika.com/favicon.ico',
  'https://www.hundesalon-nika.com/',
  'https://www.hundesalon-nika.com/de/',
];

console.log('3/4 URL Inspection — apex + www…');
report.inspections = [];
for (const url of priorityInspect) {
  const step = await withCdpSession({ port, targetPattern: /bing/i }, async ({ send, evalPage }) => {
    await send('Page.navigate', {
      url: `https://www.bing.com/webmasters/urlinspection?siteUrl=${siteQ}&urlToInspect=${encodeURIComponent(url)}`,
    });
    await sleep(9000);
    return evalPage(`
      const target = '${url}';
      const input = document.querySelector('input[placeholder*="URL" i], input[type="url"], input[type="search"], input[type="text"]');
      if (input) { setNativeValue(input, target); await sleep(500); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await sleep(5000); }
      for (const b of document.querySelectorAll('button')) {
        if (visible(b) && /^inspect$/i.test(txt(b))) { b.click(); break; }
      }
      await sleep(6000);
      const req = clickMatch('request indexing|запросить индексирование|indexierung');
      return { url: target, requestIndexing: req };
    `);
  });
  report.inspections.push(step);
  await sleep(1000);
}

console.log('4/4 Bing — свойство www.hundesalon-nika.com…');
report.wwwProperty = await withCdpSession({ port, targetPattern: /bing/i }, async ({ send, evalPage }) => {
  await send('Page.navigate', { url: 'https://www.bing.com/webmasters/home' });
  await sleep(7000);
  const listed = await evalPage(`
    const body = document.body?.innerText || '';
    return { hasWww: body.includes('www.hundesalon-nika.com'), sample: body.slice(0, 500) };
  `);
  if (listed.hasWww) return { alreadyListed: true };

  await send('Page.navigate', { url: 'https://www.bing.com/webmasters/' });
  await sleep(6000);
  await evalPage(`
    const input = document.querySelector('input');
    if (input) { setNativeValue(input, '${wwwSiteUrl}'); await sleep(500); }
    clickMatch('^add$|добавить');
    await sleep(5000);
    return { added: true };
  `);
  await evalPage(`
    clickMatch('verify now|проверить сейчас|proceed|перейти к проверке');
    await sleep(3000);
    clickMatch('мета-тег html|html meta|meta tag');
    await sleep(2000);
    const v = clickMatch('^verify$|^проверить$');
    await sleep(6000);
    return { verifyClicked: v, url: location.href };
  `);
}).catch(e => ({ error: String(e.message) }));

console.log(JSON.stringify(report, null, 2));
