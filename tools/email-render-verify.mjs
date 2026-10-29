import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildBrandedEmail } from '../dist/functions/_lib/email-template.js';
// Before publication, verify the built assets; --live-images checks the deployed responses.
const liveImages = process.argv.includes('--live-images');
const dir = 'work/email-width-verification';
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const lang of ['de', 'en', 'ru', 'uk'])
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      if (!liveImages) {
        await page.route(/^https:\/\/hundesalon-nika(?:\.pages\.dev|\.com)\/assets\/images\/email\/[^/?]+\.png$/, route =>
          route.fulfill({
            path: path.resolve('dist/assets/images/email', path.basename(new URL(route.request().url()).pathname)),
            contentType: 'image/png',
          })
        );
      }
      await page.setContent(
        buildBrandedEmail({
          lang,
          title: {
            de: 'Ihre Buchungsanfrage',
            en: 'Your booking request',
            ru: 'Ваша заявка на запись',
            uk: 'Ваша заявка на запис',
          }[lang],
          bodyText: {
            de: 'Vielen Dank für Ihre Anfrage.',
            en: 'Thank you for your request.',
            ru: 'Спасибо за вашу заявку.',
            uk: 'Дякуємо за вашу заявку.',
          }[lang],
        })
      );
      const images = await page
        .locator('img')
        .evaluateAll(imgs =>
          imgs.map(i => ({ src: i.src, complete: i.complete, width: i.naturalWidth, height: i.naturalHeight }))
        );
      if (images.some(i => !i.complete || !i.width || !i.height))
        throw new Error(`Unloaded email image: ${JSON.stringify(images)}`);
      const result = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        viewport: window.innerWidth,
        shell: document.querySelector('.shell').getBoundingClientRect().width,
        scroll: document.documentElement.scrollWidth,
        wrongLocaleLinks: [...document.querySelectorAll('a[href*="hundesalon-nika.com/"]')]
          .map(a => a.getAttribute('href'))
          .filter(h => !/\/assets\//.test(h) && !h.includes('/' + document.documentElement.lang + '/')),
      }));
      result.images = images;
      results.push(result);
      if (Math.abs(result.shell - width) > 2 || result.scroll > width || result.wrongLocaleLinks.length)
        throw new Error(JSON.stringify(result));
      await page.locator('.shell').screenshot({ path: `${dir}/${lang}-${width}.png` });
      await page.close();
    }
} finally {
  await browser.close();
  writeFileSync(`${dir}/report.json`, JSON.stringify(results, null, 2));
}
console.log(
  JSON.stringify(
    results.map(({ images, ...geometry }) => ({
      ...geometry,
      imagesLoaded: images.length,
      logoPixels: [images[0].width, images[0].height],
    }))
  )
);
