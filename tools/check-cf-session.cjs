const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9225');
  const pages = browser.contexts()[0].pages();
  const page = pages[0];

  // Accept cookies first
  try {
    await page.click('text=Reject All', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch (e) {}

  await page.goto('https://dash.cloudflare.com/25e872aeab8cb246c69142ab07cd0fee/members', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // Extract member emails from the table or list
  const emails = await page.$$eval('table tbody tr td, [data-testid*="member"]', els => els.map(e => e.textContent.trim()).filter(t => t.includes('@')));
  console.log('=== MEMBER EMAILS ===');
  console.log(emails.join('\n'));

  // Also try to get user menu email
  const userMenuBtn = await page.$('[data-testid="user-menu"], button:has-text("Account"), [aria-label*="account"]');
  if (userMenuBtn) {
    try {
      await userMenuBtn.click();
      await page.waitForTimeout(2000);
      const menuText = await page.textContent('[role="menu"], [data-testid="user-menu-content"]');
      console.log('=== USER MENU ===');
      console.log(menuText);
    } catch (e2) {}
  }

  console.log('=== FULL PAGE TEXT (relevant) ===');
  const fullText = await page.textContent('body');
  const emailLines = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  console.log([...new Set(emailLines)].join('\n'));

  await browser.close();
})();
