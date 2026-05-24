import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:63083/ru/index.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.header-weather-widget[data-weather-mounted="true"]', { timeout: 90000 });
await page.waitForTimeout(5000);

const layout = await page.locator('.header-weather-widget').evaluate(el => {
  const root = el.shadowRoot;
  if (!root) {
    return { error: 'no shadow' };
  }

  const toggle = root.querySelector('.weather-header-card__toggle');
  const infoPanel = root.querySelector('.weather-header-card__info-panel, .weather-header-card__left-stack');
  const tempRow = root.querySelector('.weather-header-card__temp-row');
  const feels = root.querySelector('.weather-header-card__chip--feels-like');
  const cs = n => (n ? getComputedStyle(n) : null);

  return {
    toggleParent: toggle?.parentElement?.className || null,
    togglePosition: cs(toggle)?.position,
    infoPanelChildren: infoPanel ? Array.from(infoPanel.children).map(c => c.className) : null,
    feelsRows: feels
      ? Array.from(feels.children).map(c => ({ cls: c.className, text: c.textContent?.trim() }))
      : null,
    feelsValueInset: root.querySelector('.weather-header-card__feels-value')?.style.paddingLeft,
    feelsGap: feels
      ? getComputedStyle(feels.querySelector('.weather-header-card__feels-value, .weather-header-card__feels-row') || feels)
          .columnGap
      : null,
    mainTempParts: {
      value: root.querySelector('.weather-header-card__temperature-value')?.textContent?.trim(),
      unit: root.querySelector('.weather-header-card__temperature-unit')?.textContent?.trim(),
    },
    tempRowFlex: cs(tempRow)?.flexDirection,
    duplicatePanels: root.querySelectorAll('.weather-header-card__info-panel, .weather-header-card__left-stack')
      .length,
    duplicateTitle: root.querySelectorAll('.weather-header-card__title-block').length,
    feelsLabel: root.querySelector('.weather-header-card__feels-label')?.textContent,
    feelsValue: root.querySelector('.weather-header-card__feels-value')?.textContent,
    eyebrow: root.querySelector('.weather-header-card__eyebrow')?.textContent?.trim(),
    location: root.querySelector('.weather-header-card__location')?.textContent?.trim(),
    temp: root.querySelector('.weather-header-card__temperature')?.textContent?.trim(),
  };
});

console.log(JSON.stringify(layout, null, 2));
await browser.close();
