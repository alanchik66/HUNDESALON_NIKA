import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });

await page.goto('http://127.0.0.1:5502/ru/onlayn-bronirovanie.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector('#open-booking-btn')?.click());
await page.waitForSelector('#booking-modal.active');
await page.evaluate(() => {
  document.querySelector('.service-option')?.click();
  document.querySelector('#next-step-1')?.click();
});
await page.waitForTimeout(900);

const before = await page.evaluate(() => {
  const mc = document.querySelector('#booking-modal .modal-content.is-booking-step-2');
  const calendarScroll = document.querySelector('#booking-modal .calendar-days-scroll');
  const timeScroll = document.querySelector('#booking-modal #time-slots-container');
  const primary = document.querySelector('#next-step-2');
  return {
    contentScrollTop: mc?.scrollTop,
    calendarScrollTop: calendarScroll?.scrollTop,
    calendarMaxScroll: calendarScroll ? calendarScroll.scrollHeight - calendarScroll.clientHeight : 0,
    timeScrollTop: timeScroll?.scrollTop,
    timeMaxScroll: timeScroll ? timeScroll.scrollHeight - timeScroll.clientHeight : 0,
    hasPlasma: Boolean(primary?.querySelector('.nav-plasma--active, .nav-plasma')),
    primaryClass: primary?.className,
    buttonsVisible: (() => {
      const buttons = document.querySelector('#step-2 .modal-buttons');
      const contentRect = mc?.getBoundingClientRect();
      const buttonsRect = buttons?.getBoundingClientRect();
      return Boolean(
        buttonsRect &&
          contentRect &&
          buttonsRect.bottom <= contentRect.bottom + 1 &&
          buttonsRect.top >= contentRect.top - 1
      );
    })(),
  };
});

const box = await page.locator('#booking-modal .calendar-days-scroll').boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}
await page.mouse.wheel(0, 500);
await page.waitForTimeout(250);

const afterWheel = await page.evaluate(() => {
  const calendarScroll = document.querySelector('#booking-modal .calendar-days-scroll');
  const body = document.querySelector('#booking-modal .booking-datetime-body');
  return { calendarScrollTop: calendarScroll?.scrollTop, bodyScrollTop: body?.scrollTop };
});

await page.evaluate(() => {
  const calendarScroll = document.querySelector('#booking-modal .calendar-days-scroll');
  if (calendarScroll) calendarScroll.scrollTop = 80;
});

const afterProgrammatic = await page.evaluate(() => {
  const calendarScroll = document.querySelector('#booking-modal .calendar-days-scroll');
  return { calendarScrollTop: calendarScroll?.scrollTop };
});

console.log(
  JSON.stringify(
    {
      before,
      afterWheel,
      afterProgrammatic,
      bodyDidNotScroll: (afterWheel.bodyScrollTop || 0) === 0,
      wheelScrolledCalendar: (afterWheel.calendarScrollTop || 0) > (before.calendarScrollTop || 0),
      programmaticWorks: (afterProgrammatic.scrollTop || 0) > 0,
    },
    null,
    2
  )
);
await browser.close();
