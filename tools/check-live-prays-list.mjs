/**
 * Post-deploy: verify live prays-list pages ship a supported price-page bundle.
 * npm run check:live-prays-list
 */
const ORIGIN = process.env.LIVE_ORIGIN || 'https://hundesalon-nika.com';
const LOCALES = ['ru', 'de', 'en', 'uk'];
const FETCH_OPTS = {
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
};

let failed = false;

async function fetchText(url) {
  const response = await fetch(url, FETCH_OPTS);
  return { response, text: await response.text() };
}

for (const locale of LOCALES) {
  const pageUrl = `${ORIGIN}/${locale}/prays-list`;
  const { response, text } = await fetchText(pageUrl);
  const mainVersion = text.match(/main\.js\?v=([^"']+)/)?.[1] || '';
  const catalogVersion = text.match(/price-catalog\.js\?v=([^"']+)/)?.[1] || '';
  const pricePageVersion = text.match(/price-page\.js\?v=([^"']+)/)?.[1] || '';
  const usesConfigurator = text.includes('data-price-configurator');
  const usesCategoryCards = text.includes('data-price-page');

  const row = (label, ok, detail = '') => {
    const mark = ok ? '✓' : '✗';
    console.log(`  ${mark} ${label}${detail ? `: ${detail}` : ''}`);
    if (!ok) failed = true;
  };

  console.log(pageUrl);
  row('HTTP 200', response.ok, String(response.status));
  row('supported price markup', usesConfigurator || usesCategoryCards);
  row('price page bundle', usesCategoryCards ? Boolean(pricePageVersion) : Boolean(catalogVersion));
  row('page-modules.js', /page-modules\.js\?v=/.test(text));

  if (mainVersion) {
    const mainUrl = `${ORIGIN}/assets/js/main.js?v=${mainVersion}`;
    const { response: mainRes, text: mainJs } = await fetchText(mainUrl);
    row('main.js reachable', mainRes.ok, mainUrl);
    row(
      'site-select optgroup handling',
      mainJs.includes('OPTGROUP') && /querySelectorAll\(["']option["']\)/.test(mainJs)
    );
    row('initSiteSelects', mainJs.includes('initSiteSelects'));
  } else {
    row('main.js version in HTML', false);
  }

  if (usesCategoryCards && pricePageVersion) {
    const pricePageUrl = `${ORIGIN}/assets/js/price-page.js?v=${pricePageVersion}`;
    const { response: pricePageRes, text: pricePageJs } = await fetchText(pricePageUrl);
    row('price-page.js reachable', pricePageRes.ok);
    row('category cards renderer', pricePageJs.includes('price-card') && pricePageJs.includes('data-price-categories'));
  } else if (catalogVersion) {
    const catalogUrl = `${ORIGIN}/assets/js/price-catalog.js?v=${catalogVersion}`;
    const { response: catalogRes, text: catalogJs } = await fetchText(catalogUrl);
    row('price-catalog.js reachable', catalogRes.ok);
    row('expanded catalog', catalogJs.includes("'full-groom'") && catalogJs.includes('breedGroups'));
  } else {
    row('price-catalog.js version in HTML', false);
  }

  console.log('');
}

if (failed) {
  console.error('Live prays-list checks failed. Run: npm run deploy:full');
  process.exit(1);
}

console.log('Live prays-list checks passed for all locales.');
