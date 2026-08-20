import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8788';
const outDir = path.resolve('test-results', 'booking-scheduling-production');
const locales = (process.argv[3] ? process.argv[3].split(',') : ['ru', 'uk', 'en', 'de']).filter(Boolean);
const localeCopy = {
  ru: { coat: 'Состояние шерсти', behaviour: 'Поведение питомца', fallback: 'консервативные окна' },
  uk: { coat: 'Стан шерсті', behaviour: 'Поведінка улюбленця', fallback: 'консервативні вікна' },
  en: { coat: 'Coat condition', behaviour: 'Pet behaviour', fallback: 'conservative windows' },
  de: { coat: 'Fellzustand', behaviour: 'Verhalten des Tieres', fallback: 'Konservative Zeitfenster' },
};

const checks = [];
const assert = (name, condition, detail = '') => {
  const ok = Boolean(condition);
  checks.push({ name, ok, detail });
  if (!ok) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
};

const isoDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const locale of locales) {
    for (const [deviceLabel, viewport, mobile] of [
      ['desktop', { width: 1440, height: 1000 }, false],
      ['mobile', devices['iPhone 13'].viewport, true],
    ]) {
      const context = await browser.newContext({
        viewport,
        isMobile: mobile,
        hasTouch: mobile,
        serviceWorkers: 'block',
        locale: locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale === 'uk' ? 'uk-UA' : 'ru-RU',
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));

      try {
        await page.goto(`${baseUrl}/${locale}/onlayn-bronirovanie.html`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });

        const cookieAccept = page.locator('[data-cookie-choice="accept"]');
        if (await cookieAccept.count()) await cookieAccept.first().click();

        await page.locator('#open-booking-btn').click();
        await page.waitForSelector('#booking-modal.active', { timeout: 15000 });
        await page.waitForSelector('[data-booking-breed]', { timeout: 15000 });

        const initialState = await page.evaluate(copy => {
          const modal = document.querySelector('#booking-modal');
          const selection = document.querySelector('.booking-selection');
          return {
            modalOpen: Boolean(modal?.classList.contains('active')),
            bodyLocked:
              document.body.classList.contains('booking-modal-open') &&
              document.documentElement.classList.contains('booking-modal-open'),
            overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
            breedOptions: document.querySelectorAll('[data-booking-breed] option').length,
            serviceOptions: document.querySelectorAll('[data-booking-service] option').length,
            riskSelects: document.querySelectorAll('[data-booking-client-type], [data-booking-coat-condition], [data-booking-behavior]').length,
            labels: selection?.textContent || '',
            localizedLabels: selection?.textContent?.includes(copy.coat) && selection?.textContent?.includes(copy.behaviour),
          };
        }, localeCopy[locale]);

        assert(`${locale} ${deviceLabel}: booking modal opens`, initialState.modalOpen);
        assert(`${locale} ${deviceLabel}: page scroll locked`, initialState.bodyLocked);
        assert(`${locale} ${deviceLabel}: no horizontal overflow`, !initialState.overflowX);
        assert(`${locale} ${deviceLabel}: breed catalog rendered`, initialState.breedOptions > 10);
        assert(`${locale} ${deviceLabel}: service catalog rendered`, initialState.serviceOptions > 0);
        assert(`${locale} ${deviceLabel}: risk selectors rendered`, initialState.riskSelects === 3);
        assert(`${locale} ${deviceLabel}: localized risk labels`, initialState.localizedLabels, initialState.labels);

        await page.locator('[data-booking-client-type]').selectOption('new');
        await page.locator('[data-booking-coat-condition]').selectOption('good');
        await page.locator('[data-booking-behavior]').selectOption('calm');
        const standardTiming = (await page.locator('[data-booking-timing]').textContent())?.trim() || '';

        await page.locator('[data-booking-coat-condition]').selectOption('severe_matting');
        await page.locator('[data-booking-behavior]').selectOption('aggressive');
        const riskTiming = (await page.locator('[data-booking-timing]').textContent())?.trim() || '';

        assert(`${locale} ${deviceLabel}: timing preview rendered`, standardTiming.length > 0);
        assert(`${locale} ${deviceLabel}: risk changes timing`, riskTiming.length > 0 && riskTiming !== standardTiming);

        await page.locator('[data-booking-coat-condition]').selectOption('good');
        await page.locator('[data-booking-behavior]').selectOption('calm');
        if (locale === 'ru') {
          await page.screenshot({ path: path.join(outDir, `ru-${deviceLabel}-step-1.png`), fullPage: false });
        }
        await page.locator('#next-step-1').click();
        await page.waitForSelector('#step-2.active', { timeout: 15000 });

        const futureDate = await page.evaluate(() => {
          const today = new Date();
          const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          return [...document.querySelectorAll('.calendar-day[data-date]:not(.is-disabled)')]
            .map(button => button.dataset.date)
            .find(date => date > todayIso) || '';
        });
        assert(`${locale} ${deviceLabel}: future calendar date available`, Boolean(futureDate));
        await page.locator(`[data-date="${futureDate}"]`).click();

        await page.waitForSelector('[data-booking-availability-status]', { timeout: 15000 });
        await page.waitForFunction(
          () => document.querySelector('[data-booking-availability-status]')?.dataset.state !== 'loading',
          null,
          { timeout: 15000 }
        );
        await page.waitForFunction(
          () => document.querySelectorAll('#time-slots-container .time-slot').length > 0,
          null,
          { timeout: 15000 }
        );

        const datetimeState = await page.evaluate(copy => ({
          status: document.querySelector('[data-booking-availability-status]')?.textContent?.trim() || '',
          safeSlots: [...document.querySelectorAll('#time-slots-container .time-slot')].map(button => button.textContent.trim()),
          selectedDate: document.querySelector('#selected-date')?.value || '',
          overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
          fallbackVisible: document.querySelector('[data-booking-availability-status]')?.textContent?.includes(copy.fallback),
        }), localeCopy[locale]);

        assert(`${locale} ${deviceLabel}: availability status rendered`, datetimeState.status.length > 0);
        assert(`${locale} ${deviceLabel}: safe time slots rendered`, datetimeState.safeSlots.length > 0);
        assert(`${locale} ${deviceLabel}: fallback is explicit`, datetimeState.fallbackVisible, datetimeState.status);
        assert(`${locale} ${deviceLabel}: selected future date`, datetimeState.selectedDate === futureDate);
        assert(`${locale} ${deviceLabel}: datetime step has no overflow`, !datetimeState.overflowX);

        await page.locator('#time-slots-container .time-slot').first().click();
        assert(`${locale} ${deviceLabel}: time can be selected`, await page.locator('#time-slots-container .time-slot.active').count() === 1);

        if (locale === 'ru') {
          await page.screenshot({ path: path.join(outDir, `ru-${deviceLabel}-step-2.png`), fullPage: false });
        }

        await page.locator('#booking-modal .modal-close').click();
        await page.waitForFunction(() => !document.querySelector('#booking-modal')?.classList.contains('active'), null, {
          timeout: 15000,
        });
        const unlocked = await page.evaluate(
          () => !document.body.classList.contains('booking-modal-open') && !document.documentElement.classList.contains('booking-modal-open')
        );
        assert(`${locale} ${deviceLabel}: page scroll unlocks`, unlocked);
        assert(`${locale} ${deviceLabel}: no page errors`, pageErrors.length === 0, pageErrors.join(' | '));
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, screenshots: [
  path.join(outDir, 'ru-desktop-step-1.png'),
  path.join(outDir, 'ru-desktop-step-2.png'),
  path.join(outDir, 'ru-mobile-step-1.png'),
  path.join(outDir, 'ru-mobile-step-2.png'),
], checks }, null, 2));
