import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:5502/ru/do-i-posle.html';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', err => errors.push(String(err)));
page.on('console', msg => {
  if (msg.type() === 'error') errors.push(msg.text());
});

let response;
try {
  response = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
} catch (error) {
  console.log(JSON.stringify({ ok: false, stage: 'goto', error: String(error), url }, null, 2));
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(1500);

const state = await page.evaluate(() => {
  const gallery = document.getElementById('before-after-gallery');
  const cards = gallery?.querySelectorAll('.before-after-card')?.length ?? 0;
  const sliders = gallery?.querySelectorAll('.before-after-wrapper')?.length ?? 0;
  const filters = document.querySelectorAll('.before-after-filters .filter-btn')?.length ?? 0;
  const pageModules = [...document.styleSheets].some(s => s.href?.includes('page-modules.css'));
  return {
    galleryExists: Boolean(gallery),
    galleryHtmlLength: gallery?.innerHTML?.length ?? 0,
    cards,
    sliders,
    filters,
    pageModulesCss: pageModules,
    scripts: [...document.scripts].map(s => s.src).filter(Boolean),
  };
});

console.log(
  JSON.stringify(
    {
      ok: true,
      url,
      status: response?.status(),
      state,
      errors,
    },
    null,
    2
  )
);

await browser.close();
