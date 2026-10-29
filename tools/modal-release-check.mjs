import fs from 'node:fs';
const response = await fetch('https://hundesalon-nika.com/assets/css/page-modules.css');
const live = await response.text();
const dist = fs.readFileSync('dist/assets/css/page-modules.css', 'utf8');
console.log({ status: response.status, liveLength: live.length, distLength: dist.length, equal: live === dist });
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
for (const locale of ['de', 'en', 'ru', 'uk']) {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`https://hundesalon-nika.com/${locale}/onlayn-bronirovanie`, { waitUntil: 'networkidle' });
    await page.locator('#open-booking-btn').click({ force: true });
    await page.waitForTimeout(1200);
    const result = await page.locator('#booking-modal').evaluate(m => {
      m.classList.add('active');
      const c = m.querySelector('.modal-content');
      m.querySelectorAll('.booking-step').forEach(x => x.classList.toggle('active', x.id === 'step-3'));
      c.classList.remove('is-booking-step-1', 'is-booking-step-2');
      c.classList.add('is-booking-step-3');
      c.style.transition = 'none';
      c.style.animation = 'none';
      m.style.animation = 'none';
      return [...m.querySelectorAll('.step-indicator .step,#booking-form .modal-buttons button')].map(e => {
        const range = document.createRange();
        range.selectNodeContents(e);
        const rect = e.getBoundingClientRect();
        const textRects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        return {
          text: e.innerText,
          width: Math.round(rect.width),
          wrap: getComputedStyle(e).whiteSpace,
          clipped:
            getComputedStyle(e).overflow === 'hidden' &&
            textRects.some(r => r.left < rect.left - 1 || r.right > rect.right + 1),
        };
      });
    });
    await page.waitForTimeout(800);
    await page.locator('#booking-form').evaluate(f => (f.scrollTop = f.scrollHeight));
    fs.mkdirSync('output/playwright', { recursive: true });
    await page.screenshot({ path: `output/playwright/modal-live-${locale}-${width}.png` });
    console.log(JSON.stringify({ locale, width, result }));
    if (result.some(x => x.clipped || x.wrap === 'nowrap' || x.width === 0)) process.exitCode = 1;
    await page.close();
  }
}
await browser.close();
