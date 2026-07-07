import { chromium } from 'playwright';

const viewports = [
  { name: 'desktop', width: 1280, height: 700 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await chromium.launch({ headless: true });
const results = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  await page.goto('http://127.0.0.1:5502/ru/onlayn-bronirovanie.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => document.querySelector('#open-booking-btn')?.click());
  await page.waitForSelector('#booking-modal.active');
  await page.evaluate(() => {
    document.querySelector('.service-option')?.click();
    document.querySelector('#next-step-1')?.click();
  });
  await page.waitForTimeout(800);

  const report = await page.evaluate(() => {
    const content = document.querySelector('#booking-modal .modal-content.is-booking-step-2');
    const contentRect = content?.getBoundingClientRect();
    const buttons = document.querySelector('#step-2 .modal-buttons');
    const buttonsRect = buttons?.getBoundingClientRect();
    const calendarScroll = document.querySelector('.calendar-days-scroll');
    const timeScroll = document.querySelector('#time-slots-container');

    const fitsViewport = Boolean(
      contentRect && contentRect.top >= 0 && contentRect.bottom <= window.innerHeight + 1
    );

    const allVisible = ['.booking-datetime-status', '.booking-datetime-choice', '#step-2 .modal-buttons'].every(
      selector => {
        const el = document.querySelector(selector);
        if (!el || !contentRect) return false;
        const r = el.getBoundingClientRect();
        return r.bottom <= contentRect.bottom + 1 && r.top >= contentRect.top - 1;
      }
    );

    return {
      fitsViewport,
      allVisible,
      buttonsVisible: Boolean(
        buttonsRect && contentRect && buttonsRect.bottom <= contentRect.bottom + 1
      ),
      contentH: Math.round(contentRect?.height || 0),
      calendarNeedsScroll: (calendarScroll?.scrollHeight || 0) > (calendarScroll?.clientHeight || 0) + 2,
      timeNeedsScroll: (timeScroll?.scrollHeight || 0) > (timeScroll?.clientHeight || 0) + 2,
      splitLayout: window.matchMedia('(min-width: 520px)').matches,
    };
  });

  results.push({ viewport: viewport.name, ...report });
  await page.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
