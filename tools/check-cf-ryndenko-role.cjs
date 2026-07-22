const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9225');
  const pages = browser.contexts()[0].pages();
  const page = pages[0];

  try {
    await page.click('text=Reject All', { timeout: 3000 });
    await page.waitForTimeout(1000);
  } catch (e) {}

  await page.goto('https://dash.cloudflare.com/25e872aeab8cb246c69142ab07cd0fee/members', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(4000);

  // Click on ryndenko's row
  const ryndenkoRow = await page.$('text=ryndenko1982@gmail.com');
  if (ryndenkoRow) {
    await ryndenkoRow.click();
    await page.waitForTimeout(5000);

    const detailText = await page.textContent('body');
    console.log('=== RYNDENKO DETAIL ===');
    const lines = detailText.split('\n').map(l => l.trim()).filter(Boolean);
    const roleLines = lines.filter(l =>
      /role|super|admin|member|administrator|privilege/i.test(l)
    );
    console.log(roleLines.join('\n'));

    // Extract role from the policy table
    const policyText = detailText.match(/Scope[^]*?Actions/);
    if (policyText) console.log('POLICY:', policyText[0].substring(0, 300));
  }

  await browser.close();
  console.log('DONE');
})();
