import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { parse } from 'espree';

function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const [key, value] of Object.entries(node)) if (key !== 'range') {
    for (const child of Array.isArray(value) ? value : [value]) { const found = find(child, predicate); if (found) return found; }
  }
}

test('native forecast text survives Celsius styling and a second city render with identical date keys', { timeout: 20000 }, async () => {
  const lists = {};
  for (const name of ['header-preview.mjs', 'header-dropdown.mjs', 'widget.mjs']) {
    const source = await readFile(new URL(`../3d-weather-codrops-main/src/${name}`, import.meta.url), 'utf8');
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
    const call = find(ast, node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression' && node.arguments[1].properties.some(property => property.key?.name === 'className' && property.value.type === 'TemplateLiteral' && property.value.quasis[0]?.value.cooked === 'weather-header-dropdown__forecast-list'));
    assert.ok(call, name); lists[name] = source.slice(...call.range);
  }
  const shell = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const normalize = shell.match(/  function normalizeHeaderWeatherCelsiusUnits\([^]*?\n  \}/)?.[0];
  assert.ok(normalize);
  const resources = new Map(await Promise.all(['react-vendor-DdSZTPSL.mjs', 'rolldown-runtime-CwX0HnDi.mjs'].map(async name => [`/${name}`, await readFile(new URL(`../3d-weather-codrops-main/dist-widget/${name}`, import.meta.url))])));
  const server = createServer((request, response) => {
    if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><main></main>'); return; }
    const source = resources.get(request.url);
    response.statusCode = source ? 200 : 404; response.setHeader('Content-Type', 'text/javascript'); response.end(source || '');
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const results = await page.evaluate(async ({ lists, normalize }) => {
      const runtime = await import('/react-vendor-DdSZTPSL.mjs'), jsxRuntime = runtime.n(), ReactDOM = runtime.t();
      const normalizeUnits = new Function('HEADER_WEATHER_CELSIUS_SUFFIX', 'lockHeaderWeatherMainTemperatureTypography', `${normalize};return normalizeHeaderWeatherCelsiusUnits;`)('°C', () => false);
      const dates = ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10'];
      const days = (pairs, city) => pairs.map(([max, min], index) => ({ date: dates[index], available: true, day: { maxtemp_c: max, mintemp_c: min, condition: { text: `${city} condition${index}` } } }));
      const first = days([[16, 14], [17, 11], [17, 12], [20, 12]], 'Sydney');
      const second = days([[11.8, 10], [15.8, 9.1], [10.5, 7.9], [14.1, 8.1]], 'Tokyo');
      const results = [];
      for (const [name, source] of Object.entries(lists)) {
        const build = new Function('ae', 'd', 'B', 'V', 'U', 'u', 'formatForecastDate', 'translateCondition', 'jsxRuntime', `return (${source});`);
        const element = days => build(days, { current: { temp_c: days[0].day.maxtemp_c } }, null, () => {}, { now: 'Now' }, 'en', date => date, condition => condition.text, jsxRuntime);
        const mount = document.createElement('div'); document.querySelector('main').append(mount);
        const root = ReactDOM.createRoot(mount);
        root.render(element(first)); await new Promise(resolve => setTimeout(resolve, 50));
        const cards = () => [...mount.querySelectorAll('[data-forecast-date]')];
        const original = cards().map(card => ({ card, text: [...card.querySelector('strong').childNodes], date: card.querySelector('span'), condition: card.querySelector('em') }));
        normalizeUnits({ shadowRoot: mount });
        root.render(element(second)); await new Promise(resolve => setTimeout(resolve, 50));
        const output = { name, temperatures: cards().map(card => card.querySelector('strong').textContent), dates: cards().map(card => card.querySelector('span').textContent), conditions: cards().map(card => card.querySelector('em').textContent),
          sameCards: cards().every((card, index) => card === original[index].card), connectedText: original.every(item => item.text.every(node => node.isConnected)), connectedSiblings: original.every(item => item.date.isConnected && item.condition.isConnected) };
        normalizeUnits({ shadowRoot: mount });
        output.temperaturesAfterSecondStyle = cards().map(card => card.querySelector('strong').textContent);
        results.push(output); root.unmount();
      }
      return results;
    }, { lists, normalize });
    assert.deepEqual(errors, []);
    for (const result of results) {
      assert.deepEqual(result.temperatures, ['12°C / 10°C', '16°C / 9°C', '11°C / 8°C', '14°C / 8°C'], result.name);
      assert.deepEqual(result.temperaturesAfterSecondStyle, result.temperatures, result.name);
      assert.deepEqual(result.dates, ['2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10']);
      assert.deepEqual(result.conditions, ['Tokyo condition0', 'Tokyo condition1', 'Tokyo condition2', 'Tokyo condition3']);
      assert.ok(result.sameCards && result.connectedText && result.connectedSiblings, result.name);
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});
