import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:60966/ru/index.html';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.header-weather-widget[data-weather-mounted="true"]', { timeout: 90000 });
await page.waitForTimeout(5000);

const metrics = await page.locator('.header-weather-widget').evaluate((el) => {
  const root = el.shadowRoot;
  if (!root) {
    return { error: 'no shadow' };
  }

  const tempValue = root.querySelector('.weather-header-card__temperature-value');
  const feelsValue = root.querySelector('.weather-header-card__feels-value, .weather-header-card__feels-row');
  const temperature = root.querySelector('.weather-header-card__temperature');
  const chips = root.querySelector('.weather-header-card__temp-row > .weather-header-card__chips');
  const feelsLabel = root.querySelector('.weather-header-card__feels-label');
  const feelsChip = root.querySelector('.weather-header-card__chip--feels-like');
  const feelsPrefix = root.querySelector('.weather-header-card__feels-prefix');
  const tempRow = root.querySelector('.weather-header-card__temp-row');

  const vr = tempValue?.getBoundingClientRect();
  const tr = temperature?.getBoundingClientRect();
  const chr = chips?.getBoundingClientRect();
  const lr = feelsLabel?.getBoundingClientRect();
  const valr = feelsValue?.getBoundingClientRect();
  const cr = feelsChip?.getBoundingClientRect();

  return {
    topDeltaPx: lr && vr ? Math.round((lr.top - vr.top) * 10) / 10 : null,
    bottomDeltaPx: valr && vr ? Math.round((valr.bottom - vr.bottom) * 10) / 10 : null,
    chipTopVsValueTopPx: cr && vr ? Math.round((cr.top - vr.top) * 10) / 10 : null,
    chipsTopVsValueTopPx: chr && vr ? Math.round((chr.top - vr.top) * 10) / 10 : null,
    tempTopVsValueTopPx: tr && vr ? Math.round((tr.top - vr.top) * 10) / 10 : null,
    chipHeightPx: cr ? Math.round(cr.height * 10) / 10 : null,
    valueHeightPx: vr ? Math.round(vr.height * 10) / 10 : null,
    chipMarginTop: feelsChip ? getComputedStyle(feelsChip).marginTop : null,
    chipJustify: feelsChip ? getComputedStyle(feelsChip).justifyContent : null,
    tempRowAlign: tempRow ? getComputedStyle(tempRow).alignItems : null,
    feelsLayout: feelsChip?.getAttribute('data-weather-feels-layout') || null,
    tempRowDisplay: tempRow ? getComputedStyle(tempRow).display : null,
    valueJustify: feelsValue ? getComputedStyle(feelsValue).justifyContent : null,
    valueWidth: feelsValue ? getComputedStyle(feelsValue).width : null,
    prefixLeft: feelsPrefix?.getBoundingClientRect().left,
    tempRight: root.querySelector('.weather-header-card__feels-temp')?.getBoundingClientRect().right,
    chipWidth: feelsChip ? getComputedStyle(feelsChip).width : null,
    labelToValueGapPx:
      lr && valr ? Math.round((valr.top - lr.bottom) * 10) / 10 : null,
    baselineDeltaPx:
      vr && feelsValue
        ? Math.round((vr.bottom - feelsValue.getBoundingClientRect().bottom) * 10) / 10
        : null,
    tempRowAlignItems: tempRow ? getComputedStyle(tempRow).alignItems : null,
    chipGap: feelsChip ? getComputedStyle(feelsChip).gap : null,
  };
});

console.log(JSON.stringify(metrics, null, 2));
await browser.close();
