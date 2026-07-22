const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9225');
  const pages = browser.contexts()[0].pages();
  const page = pages[0];

  // Reject cookies
  try {
    await page.click('text=Reject All', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch (e) {}

  await page.goto('https://dash.cloudflare.com/25e872aeab8cb246c69142ab07cd0fee/members', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(5000);

  // Get all rows from the members table
  const rows = await page.$$eval('table tbody tr', rows =>
    rows.map(row => {
      const cells = row.querySelectorAll('td');
      return Array.from(cells).map(c => c.textContent.trim()).join(' | ');
    })
  );
  console.log('=== MEMBER ROWS ===');
  console.log(rows.join('\n'));

  // Also dump all text with emails nearby
  const fullText = await page.textContent('body');
  const emailLines = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  console.log('=== EMAILS ===');
  [...new Set(emailLines)].forEach(e => console.log(e));

  // Look for role info near emails
  const roleSection = await page.$$eval('td', els => els.map(e => e.textContent.trim()));
  console.log('=== ALL TD CELLS ===');
  console.log(roleSection.join('\n'));

  await browser.close();
  console.log('DONE');
})();
