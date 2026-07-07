import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const port = 5515;

const server = http.createServer((req, res) => {
  let urlPath = req.url?.split('?')[0] || '/';
  if (urlPath === '/') {
    urlPath = '/ru/index.html';
  }
  const filePath = path.resolve(root, urlPath.replace(/^\//, ''));
  const isInsideRoot = filePath === root || filePath.startsWith(`${root}${path.sep}`);
  if (!isInsideRoot || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200);
  fs.createReadStream(filePath).pipe(res);
});

await new Promise(resolve => server.listen(port, resolve));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(`http://127.0.0.1:${port}/ru/?probe=${Date.now()}`, {
  waitUntil: 'domcontentloaded',
  timeout: 120000,
});

await page.waitForFunction(
  () => {
    const host = document.querySelector('.header-weather-widget.is-mounted');
    return Boolean(host?.shadowRoot?.querySelector('.weather-header-card__temperature'));
  },
  { timeout: 120000 }
);

await page.waitForTimeout(3500);

const report = await page.evaluate(() => {
  const host = document.querySelector('.header-weather-widget');
  const card = host?.shadowRoot?.querySelector('.weather-header-card');
  const content = card?.querySelector('.weather-header-card__content');
  const top = card?.querySelector('.weather-header-card__top');
  const toggle = card?.querySelector('.weather-header-card__toggle');
  const bottom = card?.querySelector('.weather-header-card__bottom');
  const temp = card?.querySelector('.weather-header-card__temperature');
  const chips = card?.querySelector('.weather-header-card__bottom .weather-header-card__chips');
  const feels = chips?.querySelector('.weather-header-card__chip');
  const rightCol = card?.querySelector('.weather-header-card__right-column');
  const sideCond = card?.querySelector('.weather-header-card__side .weather-header-card__condition');
  const rcCond = rightCol?.querySelector('.weather-header-card__condition');

  const cs = el => (el ? getComputedStyle(el) : null);
  const rect = el => {
    if (!el) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };

  return {
    script: [...document.scripts].find(s => s.src.includes('site-shell'))?.src || null,
    topPosition: cs(top)?.position || null,
    toggleParent: toggle?.parentElement?.className || null,
    toggleRect: rect(toggle),
    tempRect: rect(temp),
    feelsRect: rect(feels),
    rightColRect: rect(rightCol),
    rcCondRect: rect(rcCond),
    sideCondDisplay: cs(sideCond)?.display || null,
    rcCondDisplay: cs(rcCond)?.display || null,
    bottomLeft: cs(bottom)?.left || null,
  };
});

console.log(JSON.stringify(report, null, 2));

const ok =
  report.script?.includes('weather-layout-fix2') &&
  report.topPosition === 'static' &&
  report.toggleParent?.includes('weather-header-card__content') &&
  report.sideCondDisplay === 'none' &&
  report.rcCondDisplay === 'block' &&
  report.toggleRect &&
  report.tempRect &&
  report.toggleRect.y > report.tempRect.y - 5;

console.log(ok ? 'LAYOUT_PROBE_OK' : 'LAYOUT_PROBE_FAIL');

await page.screenshot({ path: 'tools/probe-weather-layout.png' });
await browser.close();
server.close();

process.exit(ok ? 0 : 1);
