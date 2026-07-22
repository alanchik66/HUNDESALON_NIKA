const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9225');
  const pages = browser.contexts()[0].pages();
  const page = pages[0];

  try {
    await page.click('text=Reject All', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch (e) {}

  await page.goto('https://dash.cloudflare.com/profile', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 4000));

  const t = await page.textContent('body');
  const m = t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  console.log('EMAILS:', [...new Set(m)].join(', '));

  const ls = t.split('\n').map(l => l.trim()).filter(l => /sign.out|my.profile|email/i.test(l));
  console.log('LINES:', ls.slice(0, 20).join(' | '));

  // Also check page title for user clues
  console.log('TITLE:', await page.title());

  await browser.close();
  console.log('DONE');
})();
