import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceDirectory = new URL('../3d-weather-codrops-main/src/', import.meta.url);
const readSource = name => readFile(new URL(name, sourceDirectory), 'utf8');

test('current weather metadata works behind the personal preview session', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const declaration = source.match(/  async function fetchHeaderWeatherCurrent\([^)]*\) \{[\s\S]*?\n  \}/)[0];
  const initialize = new Function('environment', `
    const { window, fetch, URL, HEADER_WEATHER_CURRENT_ENDPOINT, resolveHeaderWeatherTimeZone,
      getHeaderWeatherPressureLang, getHeaderWeatherTimestampMs, getHeaderWeatherNowMs,
      getHeaderWeatherFiniteNumber } = environment;
    ${declaration}
    return fetchHeaderWeatherCurrent;
  `);
  const requests = [];
  const metadata = { temperature: 5, pressureMsl: 1031.4 };
  const getCurrent = initialize({
    window: { location: { origin: 'https://preview.example' } },
    URL, HEADER_WEATHER_CURRENT_ENDPOINT: '/api/weather',
    resolveHeaderWeatherTimeZone: () => 'Europe/Berlin',
    getHeaderWeatherPressureLang: () => 'ru',
    getHeaderWeatherTimestampMs: () => null,
    getHeaderWeatherNowMs: () => 123456,
    getHeaderWeatherFiniteNumber: value => Number.isFinite(value) ? value : null,
    fetch: async (url, options) => {
      requests.push({ url: new URL(url), options });
      const authenticated = options.credentials === 'same-origin';
      return { ok: authenticated, status: authenticated ? 200 : 403, json: async () => ({ weatherMeta: metadata }) };
    },
  });
  const result = await getCurrent({}, { latitude: 51.3397, longitude: 12.3731 });
  assert.equal(result.temperature, 5);
  assert.equal(result.pressureMsl, 1031.4);
  assert.equal(result.latitude, 51.3397);
  assert.equal(requests[0].url.origin, 'https://preview.example');
  assert.equal(requests[0].url.pathname, '/api/weather');
  assert.equal(requests[0].url.searchParams.get('lang'), 'ru');
  assert.equal(requests[0].options.cache, 'no-store');
});

function binding(source, name, nextName) {
  const startMarker = `  ${name} = `;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(`,\n  ${nextName} = `, start);
  assert.ok(start >= 0 && end > start, `Cannot find ${name}`);
  return source.slice(start + startMarker.length, end);
}

test('weather requests and normalization retain four distinct forecast days', async () => {
  const source = await readSource('weather-service.mjs');
  const dates = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
  const requests = [];
  const axios = { get: async (url, options) => {
    requests.push({ url, ...options });
    return { data: { current: {}, daily: { time: dates } } };
  } };
  const location = { latitude: 51.34, longitude: 12.37, name: 'Leipzig' };
  const direct = new Function('axios', 'fn', 'pn', `return (${binding(source, 'Jn', 'Yn')});`)(axios, 'https://weather.test', 'fixture');
  await direct('Leipzig');
  assert.equal(requests[0].params.days, 4);
  assert.equal(requests[0].params.q, 'Leipzig');

  const round = value => Math.round(Number(value) * 10) / 10;
  const convert = value => Number(value);
  const condition = () => ({ text: 'Clear', code: 1000 });
  const daily = new Function('J', 'Y', 'Cn', 'Tn', 'Bn', 'zn', `return (${binding(source, 'Gn', 'Kn')});`)(
    round, convert, convert, convert, condition, Date.parse
  );
  const normalize = new Function('Gn', 'J', 'Y', 'Cn', 'Tn', 'wn', 'Bn', 'zn', 'Rn', 'Dn', 'En', `return (${binding(source, 'Kn', 'qn')});`)(
    daily, round, convert, convert, convert, convert, condition, Date.parse, value => value.replace('T', ' '), () => 'N', convert
  );
  const openMeteo = new Function('axios', 'Hn', 'Z', 'gn', 'Kn', `return (${binding(source, 'Yn', 'weatherService')});`)(
    axios, async () => location, value => value, 'https://open-meteo.test', normalize
  );
  const normalized = await openMeteo({ query: 'Leipzig' }, { locale: 'ru' });
  assert.equal(requests[1].params.forecast_days, 4);
  assert.deepEqual(normalized.forecast.forecastday.map(day => day.date), dates.slice(0, 4));
  assert.equal(new Set(normalized.forecast.forecastday.map(day => day.date)).size, 4);
});

for (const filename of ['widget.mjs', 'header-preview.mjs', 'header-dropdown.mjs']) {
  test(`${filename}: the fourth forecast tile selects its own date and weather`, async () => {
    const source = await readSource(filename);
    const listExpression = source.match(/\bae = (d\?\.forecast\?\.forecastday\?\.slice\([^\n]+),\n/)[1];
    const selectedExpression = source.match(/\bQ = (B === null[^\n]+),\n/)[1];
    const select = new Function('d', 'B', `const ae = ${listExpression}; const Q = ${selectedExpression}; return { days: ae, selected: Q };`);
    const forecastDay = new Function(`return (${binding(source, 'weatherForForecastDay', 'weatherStatistics')});`)();
    const dates = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    const data = {
      current: { temp_c: 8, pressure_mb: 1013.25 },
      location: { name: 'Leipzig', localtime: '2026-11-03 06:37' },
      forecast: { forecastday: dates.map((date, index) => ({
        date, day: { maxtemp_c: 10 + index, mintemp_c: 5 + index, condition: { text: `Day ${index}` } },
      })) },
    };
    const { days, selected } = select(data, 3);
    assert.deepEqual(days.map(day => day.date), dates.slice(0, 4));
    assert.equal(selected.date, '2026-11-06');
    const selectedWeather = forecastDay(data, selected);
    assert.equal(selectedWeather.location.localtime, '2026-11-06 12:00');
    assert.equal(selectedWeather.current.temp_c, 13);
    assert.equal(selectedWeather.current.condition.text, 'Day 3');
    assert.equal(select(data, null).selected, null);
    assert.equal(forecastDay(data, null), data, 'current weather remains available');
    assert.deepEqual(select({ forecast: { forecastday: days.slice(0, 3) } }, 3).selected, null, 'a shorter fallback must not invent a fourth day');
  });

  test(`${filename}: pressure is converted to localized millimetres of mercury`, async () => {
    const source = await readSource(filename);
    const copy = new Function(`return (${binding(source, 'localeCopy', 'conditionCodeLabels')});`)();
    const statisticsStart = source.indexOf('  weatherStatistics = ');
    const statisticsEnd = source.indexOf(';\nfunction WeatherApp(', statisticsStart);
    assert.ok(statisticsStart >= 0 && statisticsEnd > statisticsStart);
    const statistics = new Function(`return (${source.slice(statisticsStart + '  weatherStatistics = '.length, statisticsEnd)});`)();
    for (const [locale, unit] of [['ru', 'мм рт. ст.'], ['uk', 'мм рт. ст.'], ['de', 'mmHg'], ['en', 'mmHg']]) {
      const data = { current: { pressure_mb: 1013.25 } };
      const reading = statistics(data, copy[locale]).find(item => item.label === copy[locale].pressure);
      assert.equal(reading.value, `760 ${unit}`, locale);
      assert.equal(statistics(data, copy[locale]).find(item => item.label === copy[locale].pressure).value, reading.value, 'repeated rendering must not convert an already displayed value again');
      assert.equal(data.current.pressure_mb, 1013.25, 'provider units remain unchanged');
    }
  });
}
