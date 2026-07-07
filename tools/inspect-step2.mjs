import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto('http://127.0.0.1:5502/ru/onlayn-bronirovanie.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector('#open-booking-btn')?.click());
await page.waitForSelector('#booking-modal.active');
await page.waitForTimeout(700);
await page.evaluate(() => {
  document.querySelector('.service-option')?.click();
  document.querySelector('#next-step-1')?.click();
});
await page.waitForTimeout(900);

const info = await page.evaluate(() => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    return el ? { w: el.offsetWidth, h: el.offsetHeight } : null;
  };

  return {
    status: r('[data-booking-datetime-status]'),
    calendarBlock: r('.booking-datetime-block--calendar'),
    timeBlock: r('.booking-datetime-block--time'),
    calendar: r('#calendar-container'),
    slots: r('#time-slots-container'),
    choice: r('[data-booking-datetime-choice]'),
    serviceList: r('.service-list'),
    hasStatus: Boolean(document.querySelector('[data-booking-datetime-status]')),
    hasChoice: Boolean(document.querySelector('[data-booking-datetime-choice]')),
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
