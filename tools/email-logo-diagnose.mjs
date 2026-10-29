import { chromium } from 'playwright';
import { buildBrandedEmail } from '../dist/functions/_lib/email-template.js';
const browser = await chromium.launch({ headless: true });
try {
  for (const useOrigin of [false, true]) {
    const page = await browser.newPage();
    page.on('requestfailed', r => console.log(JSON.stringify({ useOrigin, url: r.url(), failure: r.failure() })));
    page.on('response', r => {
      if (r.url().includes('/brand/logo.png'))
        console.log(JSON.stringify({ useOrigin, url: r.url(), status: r.status(), type: r.headers()['content-type'] }));
    });
    if (useOrigin) await page.goto('https://hundesalon-nika.com/de/', { waitUntil: 'domcontentloaded' });
    await page.setContent(buildBrandedEmail({ lang: 'ru', title: 'Test', bodyText: 'Test' }));
    console.log(
      JSON.stringify({
        useOrigin,
        images: await page
          .locator('img')
          .evaluateAll(imgs =>
            imgs.map(i => ({ src: i.src, complete: i.complete, width: i.naturalWidth, height: i.naturalHeight }))
          ),
      })
    );
    await page.close();
  }
} finally {
  await browser.close();
}
