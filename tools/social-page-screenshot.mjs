import { chromium } from 'playwright';

const [, , url, screenshotPath, viewportMode = 'desktop'] = process.argv;

if (!url || !screenshotPath) {
  console.error('Usage: node tools/social-page-screenshot.mjs <url> <screenshotPath> [desktop|mobile]');
  process.exit(1);
}

const isMobile = viewportMode === 'mobile';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext(
  isMobile
    ? {
        viewport: { width: 390, height: 844 },
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      }
    : {
        viewport: { width: 1440, height: 1600 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
      }
);

const page = await context.newPage();

try {
  await context.addInitScript(() => {
    localStorage.setItem(
      'hundesalon_cookie_consent',
      JSON.stringify({ choice: 'accept', analytics: true, updatedAt: '2026-08-27T00:00:00.000Z' })
    );
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  process.stdout.write(`saved:${screenshotPath}`);
} finally {
  await context.close();
  await browser.close();
}
