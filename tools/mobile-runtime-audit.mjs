import { chromium, devices } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:5505';
const url = new URL('/ru/prays-list.html?mobile-runtime-audit=1', baseUrl).toString();
const consoleErrors = [];

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: 'ru-RU',
  });
  const page = await context.newPage();

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.site-icon-euro', { timeout: 15000 });
  await page.waitForTimeout(10000);

  const state = await page.evaluate(async () => {
    const icon = Array.from(document.querySelectorAll('.site-icon-euro')).find(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const weatherHost = document.querySelector('.header-weather-widget[data-weather-widget]');
    if (!icon) return { error: 'No rendered euro icon.' };

    const readMotion = () => ({
      transform: getComputedStyle(icon).transform,
      currentTimes: icon.getAnimations().map(animation => Number(animation.currentTime || 0)),
      playStates: icon.getAnimations().map(animation => animation.playState),
    });
    const before = readMotion();
    await new Promise(resolve => setTimeout(resolve, 900));
    const after = readMotion();

    return {
      before,
      after,
      transformChanged: before.transform !== after.transform,
      timelineAdvanced: before.currentTimes.some((time, index) => after.currentTimes[index] > time),
      animationsRunning: before.playStates.length > 0 && before.playStates.every(state => state === 'running'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      weatherGeoResolved: weatherHost?.dataset.weatherGeoResolved || '',
      weatherMounted: weatherHost?.dataset.weatherMounted || '',
    };
  });

  const ok = consoleErrors.length === 0
    && !state.error
    && state.transformChanged
    && state.timelineAdvanced
    && state.animationsRunning
    && state.overflow === 0
    && ['true', 'unavailable'].includes(state.weatherGeoResolved)
    && state.weatherMounted === 'true';

  console.log(JSON.stringify({ ok, url, consoleErrors, state }, null, 2));
  if (!ok) process.exitCode = 1;

  await context.close();
} finally {
  await browser.close();
}
