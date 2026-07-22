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
  await page.waitForTimeout(4000);

  // Click on snaiper's row (first link/button containing the email)
  const snaiperRow = await page.$('text=snaiper1984@gmail.com');
  if (snaiperRow) {
    await snaiperRow.click();
    await page.waitForTimeout(5000);

    // Read role detail panel
    const detailText = await page.textContent('body');
    console.log('=== SNIPER DETAIL ===');
    // Print lines near "Role" or "Super Administrator"
    const lines = detailText.split('\n').map(l => l.trim()).filter(Boolean);
    const roleLines = lines.filter(l =>
      /role|super|admin|member|administrator/i.test(l)
    );
    console.log(roleLines.join('\n'));

    // Also print all select/option combos
    const selects = await page.$$eval('select, [role="listbox"], [role="combobox"]', els =>
      els.map(e => ({
        tag: e.tagName,
        text: e.textContent.trim().substring(0, 200)
      }))
    );
    console.log('=== SELECTS ===');
    console.log(JSON.stringify(selects, null, 2));

    // All buttons
    const buttons = await page.$$eval('button', els =>
      els.map(e => e.textContent.trim()).filter(Boolean)
    );
    console.log('=== BUTTONS ===');
    console.log(buttons.join('\n'));
  } else {
    console.log('Could not find snaiper row');
  }

  await browser.close();
  console.log('DONE');
})();
