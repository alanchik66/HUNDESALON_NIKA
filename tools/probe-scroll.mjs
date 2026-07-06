import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5502';

async function probe(path) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(String(err)));
  const url = `${BASE}${path}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate(() => {
    const scrollRoot = document.querySelector('.site-scroll-root');
    const body = document.body;
    const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
    return {
      scripts,
      siteShellDefined: typeof window.SiteShell !== 'undefined',
      bodyChildCount: body.childElementCount,
      bodyChildTags: Array.from(body.children).map(el => el.tagName + (el.className ? `.${String(el.className).split(' ')[0]}` : '') + (el.id ? `#${el.id}` : '')),
      hasScrollRoot: !!scrollRoot,
      scrollRootScrollHeight: scrollRoot?.scrollHeight ?? null,
      scrollRootClientHeight: scrollRoot?.clientHeight ?? null,
      scrollRootOverflow: scrollRoot ? getComputedStyle(scrollRoot).overflow : null,
      scrollTopBefore: scrollRoot?.scrollTop ?? null,
      bodyClasses: body.className,
      bodyOverflow: getComputedStyle(body).overflow,
      bodyPosition: getComputedStyle(body).position,
      htmlOverflow: getComputedStyle(document.documentElement).overflow,
    };
  });

  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(400);

  const afterWheel = await page.evaluate(() => {
    const scrollRoot = document.querySelector('.site-scroll-root');
    return {
      scrollTopAfter: scrollRoot?.scrollTop ?? null,
    };
  });

  await page.keyboard.press('PageDown');
  await page.waitForTimeout(400);

  const afterKey = await page.evaluate(() => {
    const scrollRoot = document.querySelector('.site-scroll-root');
    return {
      scrollTopAfterKey: scrollRoot?.scrollTop ?? null,
    };
  });

  await browser.close();

  return { url, ...metrics, ...afterWheel, ...afterKey, consoleErrors, pageErrors };
}

const paths = ['/ru/', '/ru/do-i-posle.html', '/de/'];
const results = [];
for (const path of paths) {
  try {
    results.push(await probe(path));
  } catch (err) {
    results.push({ path, error: String(err) });
  }
}

console.log(JSON.stringify(results, null, 2));
