import { chromium, devices } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const externalBaseUrl = process.argv[2] || '';
const staticServer = externalBaseUrl ? null : await startStaticTestServer();
const baseUrl = externalBaseUrl || staticServer.baseUrl;
const url = new URL('/ru/prays-list.html?mobile-runtime-audit=1', baseUrl).toString();
const consoleErrors = [];
const failedResponses = [];

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
  page.on('response', response => {
    if (response.status() >= 400) failedResponses.push({ status: response.status(), url: response.url() });
  });

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

  const localWeatherUnavailable = Boolean(
    staticServer
      && state.weatherGeoResolved === 'unavailable'
      && failedResponses.length === 1
      && failedResponses[0].status === 404
      && new URL(failedResponses[0].url).pathname === '/api/weather'
  );
  const unexpectedConsoleErrors = consoleErrors.filter(message => {
    if (!localWeatherUnavailable) return true;
    return !message.startsWith('Failed to load resource:')
      && !(message.startsWith('Error loading weather for location:') && message.includes('Location not found'));
  });
  const unexpectedFailedResponses = localWeatherUnavailable ? [] : failedResponses;

  const ok = unexpectedConsoleErrors.length === 0
    && unexpectedFailedResponses.length === 0
    && !state.error
    && state.transformChanged
    && state.timelineAdvanced
    && state.animationsRunning
    && state.overflow === 0
    && ['true', 'unavailable'].includes(state.weatherGeoResolved)
    && state.weatherMounted === 'true';

  console.log(JSON.stringify({
    ok,
    url,
    consoleErrors: unexpectedConsoleErrors,
    failedResponses: unexpectedFailedResponses,
    expectedLocalLimitations: localWeatherUnavailable ? ['Static test server does not execute /api/weather.'] : [],
    state,
  }, null, 2));
  if (!ok) process.exitCode = 1;

  await context.close();
} finally {
  await browser.close();
  await staticServer?.close();
}
