/**
 * Bing Webmaster: performance + logo/favicon signals for search.
 * Requires: npm run bing:edge (mail.ru), port 9224
 */
import { getJson, sleep, withCdpSession } from './lib/browser-cdp.mjs';

const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteUrl = 'https://hundesalon-nika.com/';
const siteQ = encodeURIComponent(siteUrl);
const performanceUrl = `https://www.bing.com/webmasters/aiperformance?siteUrl=${siteQ}`;

const logoUrls = [
  'https://hundesalon-nika.com/favicon.ico',
  'https://hundesalon-nika.com/assets/images/search-logo-clear-512.png',
  'https://hundesalon-nika.com/assets/images/logo.png',
  'https://hundesalon-nika.com/assets/images/favicon/favicon-search-512.png',
  'https://hundesalon-nika.com/de/',
];

try {
  await getJson(`http://127.0.0.1:${port}/json/version`);
} catch {
  console.error('Edge CDP not running. Run: npm run bing:edge');
  process.exit(1);
}

const report = { at: new Date().toISOString(), logoUrls };

report.searchPerformance = await withCdpSession({ port, targetPattern: /bing/i }, async ({ send, evalPage }) => {
  await send('Page.navigate', { url: performanceUrl });
  await wait(8000);
  const page = await evalPage(
    `
    const body = document.body?.innerText || '';
    const started = clickMatch('get started|начать|loslegen|view report|просмотреть');
    await sleep(3000);
    return {
      title: document.title,
      url: location.href,
      started,
      hasSearchData: /citation|цитир|performance|упоминан/i.test(body),
      sample: body.slice(0, 1200),
    };
  `
  );
  return page;
});

report.logoSubmit = await withCdpSession({ port, targetPattern: /bing/i }, async ({ send, evalPage }) => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/submiturl?siteUrl=${siteQ}` });
  await wait(7000);
  return evalPage(`
    const urls = ${JSON.stringify(logoUrls)};
    const input = document.querySelector('textarea') || document.querySelector('input');
    if (!input) return { ok: false, reason: 'NO_INPUT' };
    setNativeValue(input, urls.join('\\n'));
    await sleep(800);
    const s1 = clickMatch('submit urls|отправить url');
    await sleep(1500);
    const buttons = Array.from(document.querySelectorAll('button')).filter(el => visible(el));
    const confirm = buttons.find(el => /^(submit|отправить)$/i.test(txt(el)));
  if (confirm) confirm.click();
    else clickMatch('^submit$|^отправить$');
    await sleep(5000);
    return { ok: true, count: urls.length };
  `);
});

for (const url of [
  'https://hundesalon-nika.com/de/',
  'https://hundesalon-nika.com/assets/images/search-logo-clear-512.png',
]) {
  const step = await withCdpSession({ port, targetPattern: /bing/i }, async ({ send, evalPage }) => {
    await send('Page.navigate', {
      url: `https://www.bing.com/webmasters/urlinspection?siteUrl=${siteQ}&urlToInspect=${encodeURIComponent(url)}`,
    });
    await wait(8000);
    return evalPage(`
      clickMatch('inspect|провер');
      await sleep(5000);
      return { url: '${url}', requestIndexing: clickMatch('request indexing|запросить индекс') };
    `);
  });
  report.inspections = report.inspections || [];
  report.inspections.push(step);
}

console.log(JSON.stringify(report, null, 2));
