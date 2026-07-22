const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9225');
  const pages = browser.contexts()[0].pages();
  const page = pages[0];

  try {
    await page.click('text=Reject All', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch (e) {}

  await page.goto('https://dash.cloudflare.com/25e872aeab8cb246c69142ab07cd0fee/api-tokens', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(5000);

  const bodyText = await page.textContent('body');
  console.log('=== API TOKENS PAGE ===');

  // Find token names and their details
  const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
  const tokenLines = lines.filter(l =>
    /automation|hundesalon|token|created|last used/i.test(l)
  );
  console.log(tokenLines.join('\n'));

  // Dump relevant section around "HUNDESALON"
  const idx = bodyText.indexOf('HUNDESALON');
  if (idx >= 0) {
    console.log('=== TOKEN CONTEXT ===');
    console.log(bodyText.substring(Math.max(0, idx - 200), idx + 400));
  }

  await browser.close();
  console.log('DONE');
})();
