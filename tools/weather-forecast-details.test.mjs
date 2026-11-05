import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildForecastSlots, hasCompleteForecast, createWeatherController, resolveForecastCloudCover, resolveForecastNoonMs, parseWeatherCurrentTime, isCurrentWeatherFresh } from '../3d-weather-codrops-main/src/weather-lifecycle.mjs';

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
    return { data: { current: { time: new Date().toISOString(), temperature_2m: 7, weather_code: 0 }, daily: {
      time: dates, temperature_2m_max: [10, 11, 12, 13, 14], temperature_2m_min: [4, 5, 6, 7, 8], weather_code: [0, 1, 2, 3, 0],
    } } };
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
  const normalize = new Function('Gn', 'J', 'Y', 'Cn', 'Tn', 'wn', 'Bn', 'zn', 'Rn', 'Dn', 'En', 'parseWeatherCurrentTime', 'isCurrentWeatherFresh', `return (${binding(source, 'Kn', 'qn')});`)(
    daily, round, convert, convert, convert, convert, condition, Date.parse, value => value.replace('T', ' '), () => 'N', convert, parseWeatherCurrentTime, isCurrentWeatherFresh
  );
  const openMeteo = new Function('axios', 'Hn', 'Z', 'gn', 'Kn', `return (${binding(source, 'Yn', 'weatherService')});`)(
    axios, async () => location, value => value, 'https://open-meteo.test', normalize
  );
  const normalized = await openMeteo({ query: 'Leipzig' }, { locale: 'ru' });
  assert.equal(requests[1].params.forecast_days, 4);
  assert.deepEqual(normalized.forecast.forecastday.map(day => day.date), dates.slice(0, 4));
  assert.equal(new Set(normalized.forecast.forecastday.map(day => day.date)).size, 4);
});

test('fallback daily normalization preserves unknown temperatures and conditions without inventing zero degrees', async () => {
  const source = await readSource('weather-service.mjs');
  const daily = new Function('J', 'Y', 'Cn', 'Tn', 'Bn', 'zn', `return (${binding(source, 'Gn', 'Kn')});`)(
    value => Math.round(Number(value) * 10) / 10, Number, Number, Number,
    code => ({ code, text: 'Actual condition' }), Date.parse
  );
  const date = '2026-11-04';
  for (const value of [undefined, null, '', ' ', [], {}, false, NaN, Infinity]) {
    const normalized = daily({ time: [date], temperature_2m_max: [value], temperature_2m_min: [value] }, 0);
    assert.equal(normalized.day.maxtemp_c, null);
    assert.equal(normalized.day.mintemp_c, null);
    assert.equal(normalized.day.avgtemp_c, null);
    assert.equal(normalized.day.maxtemp_f, null);
    assert.equal(normalized.day.condition.code, null);
    assert.equal(hasCompleteForecast({ current: {}, location: { tz_id: 'UTC' }, forecast: { forecastday: [normalized] } }, Date.parse(`${date}T12:00:00Z`)), false);
  }
  const zero = daily({ time: [date], temperature_2m_max: [0], temperature_2m_min: [0], weather_code: [0] }, 0);
  assert.equal(zero.day.maxtemp_c, 0);
  assert.equal(zero.day.mintemp_c, 0);
  assert.equal(zero.day.condition.code, 0);
  assert.equal(daily({ temperature_2m_max: [10], temperature_2m_min: [5] }, 0).date, '', 'a missing provider date must not become today');
});

const forecastDay = (date, maximum = 10, minimum = 5) => ({
  date, day: { maxtemp_c: maximum, mintemp_c: minimum, condition: { text: `Weather for ${date}` } },
});

test('forecast slots keep four dated positions without inventing unavailable weather', () => {
  const actual = forecastDay('2026-11-04', 0, -2);
  const data = { current: { temp_c: 8 }, location: { tz_id: 'Europe/Berlin' }, forecast: { forecastday: [actual] } };
  const original = structuredClone(data);
  const slots = buildForecastSlots(data, Date.parse('2026-11-04T12:00:00Z'));
  assert.deepEqual(slots.map(day => day.date), ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  assert.equal(slots[0].available, true, 'actual zero degrees remains valid');
  assert.equal(slots[0].day, actual.day, 'actual forecast details are retained');
  assert.deepEqual(slots.slice(1), slots.slice(1).map(({ date }) => ({ date, available: false })));
  assert.deepEqual(data, original, 'render slots must not pad or alter the provider payload');
  assert.equal(data.forecast.forecastday.length, 1);
  for (const forecast of [undefined, { forecastday: [] }, { forecastday: null }]) {
    const empty = buildForecastSlots({ ...data, forecast }, Date.parse('2026-11-04T12:00:00Z'));
    assert.equal(empty.length, 4);
    assert.ok(empty.every(day => day.available === false && !('day' in day)));
  }
  assert.deepEqual(buildForecastSlots(null), []);
  assert.deepEqual(buildForecastSlots({ forecast: data.forecast }), [], 'no forecast UI before current weather exists');
});

test('forecast slots validate temperatures and dates, deduplicate and order actual days', () => {
  const fourth = forecastDay('2026-11-07', 13, 4);
  const first = forecastDay('2026-11-04', 9, 0);
  const second = forecastDay('2026-11-05', '11', '-1');
  const data = { current: {}, location: { localtime: '2026-11-04 23:55' }, forecast: { forecastday: [
    fourth, forecastDay('2026-11-04', null), first, forecastDay('2026-11-04', 99),
    forecastDay('2026-11-03'), forecastDay('2026-11-08'), forecastDay('2026-02-30'),
    forecastDay('2026-11-06', ''), forecastDay('2026-11-06', Infinity),
    forecastDay('2026-11-06', NaN), forecastDay('2026-11-06', true),
    forecastDay('2026-11-06', []), forecastDay('2026-11-06', {}),
    { ...forecastDay('2026-11-06'), available: false }, second,
  ] } };
  const original = structuredClone(data);
  const slots = buildForecastSlots(data, Date.parse('2026-11-05T08:00:00Z'));
  assert.deepEqual(slots.map(day => day.date), ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  assert.equal(new Set(slots.map(day => day.date)).size, 4);
  assert.equal(slots[0].day, first.day, 'first valid duplicate wins');
  assert.equal(slots[1].day, second.day);
  assert.deepEqual(slots[2], { date: '2026-11-06', available: false });
  assert.equal(slots[3].day, fourth.day);
  assert.deepEqual(data, original);
});

test('forecast dates follow the location timezone across midnight, DST and leap days', () => {
  const slotsAt = (timeZone, time, localtime = '2026-01-01 00:00') => buildForecastSlots({
    current: {}, location: { tz_id: timeZone, localtime }, forecast: { forecastday: [] },
  }, Date.parse(time)).map(day => day.date);
  assert.deepEqual(slotsAt('Europe/Berlin', '2026-11-04T22:59:59Z'), ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  assert.deepEqual(slotsAt('Europe/Berlin', '2026-11-04T23:00:00Z'), ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(slotsAt('Europe/Berlin', '2026-03-28T23:30:00Z'), ['2026-03-29', '2026-03-30', '2026-03-31', '2026-04-01']);
  assert.deepEqual(slotsAt('Europe/Berlin', '2026-10-24T22:30:00Z'), ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28']);
  assert.deepEqual(slotsAt('UTC', '2028-02-28T23:30:00Z'), ['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02']);
  assert.equal(slotsAt('Pacific/Kiritimati', '2026-11-04T10:30:00Z')[0], '2026-11-05');
  assert.equal(slotsAt('America/Los_Angeles', '2026-11-04T10:30:00Z')[0], '2026-11-04');
  assert.equal(slotsAt('Invalid/Zone', '2026-11-04T10:30:00Z', '2026-11-03 23:59')[0], '2026-11-03');
  assert.equal(slotsAt(null, '2026-11-04T10:30:00Z', '2026-02-30 23:59')[0], '2026-11-04');
});

test('complete forecasts require four actual days covering the location calendar', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const days = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map(date => forecastDay(date));
  const data = { current: {}, location: { tz_id: 'Europe/Berlin' }, forecast: { forecastday: days } };
  assert.equal(hasCompleteForecast(data, now), true);
  assert.equal(hasCompleteForecast({ ...data, forecast: { forecastday: [...days].reverse() } }, now), true);
  assert.equal(hasCompleteForecast({ ...data, forecast: { forecastday: [days[0], days[0], days[1], days[2]] } }, now), false);
  assert.equal(hasCompleteForecast({ ...data, forecast: { forecastday: days.slice(0, 3) } }, now), false);
  assert.equal(hasCompleteForecast(data, Date.parse('2026-11-04T23:00:00Z')), false, 'a newly missing fourth local date invalidates completeness at midnight');
  assert.equal(hasCompleteForecast(null, now), false);
  assert.equal(hasCompleteForecast({ forecast: data.forecast }, now), false);
});

test('a partial forecast preserves current weather and retries once per 30 seconds until complete', async () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const days = ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map(date => forecastDay(date));
  const partial = { current: { temp_c: 8 }, location: { tz_id: 'Europe/Berlin' }, forecast: { forecastday: days.slice(0, 1) } };
  const complete = { ...partial, current: { temp_c: 9 }, forecast: { forecastday: days } };
  const timers = new Map();
  let nextTimer = 0;
  let calls = 0;
  const controller = createWeatherController({
    initialLocation: 'Location', now: () => now,
    service: { getCurrentWeather: async () => (++calls < 3 ? partial : complete) },
    schedule: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    cancelSchedule: id => timers.delete(id),
  });
  const tick = async () => { for (let turn = 0; turn < 8; turn += 1) await Promise.resolve(); };
  try {
    assert.equal(await controller.refresh(), partial);
    assert.equal(controller.getState().weather, partial);
    assert.equal(controller.getState().error, null, 'missing forecast days are not a current weather failure');
    for (let retry = 0; retry < 2; retry += 1) {
      assert.equal(timers.size, 1, 'at most one retry is scheduled');
      const [id, timer] = [...timers][0];
      assert.equal(timer.delay, 30000);
      timers.delete(id);
      timer.callback();
      await tick();
      assert.equal(calls, retry + 2);
    }
    assert.equal(controller.getState().weather, complete);
    assert.equal(timers.size, 0, 'complete four-day forecasts keep the existing normal refresh schedule');
  } finally { controller.dispose(); }
});

test('partial retry cleanup rejects old location callbacks and follows request, cancel and dispose', async () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const timers = new Map();
  let nextTimer = 0;
  let calls = 0;
  const controller = createWeatherController({
    initialLocation: 'A', now: () => now,
    service: {
      getCurrentWeather: async location => {
        calls += 1;
        return { current: {}, location: { name: location, tz_id: 'UTC' }, forecast: { forecastday: [] } };
      },
      getCurrentLocation: async () => 'C',
    },
    schedule: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    cancelSchedule: id => timers.delete(id),
  });
  try {
    await controller.refresh();
    const stale = [...timers.values()][0].callback;
    const moving = controller.setLocation('B');
    assert.equal(timers.size, 0, 'new requests clear the old retry immediately');
    await moving;
    stale();
    assert.equal(calls, 2, 'an already queued callback cannot return to the previous location');
    assert.equal(timers.size, 1, 'an old callback must not erase the new timer ownership');
    controller.cancel();
    assert.equal(timers.size, 0);
    await controller.refresh();
    assert.equal(timers.size, 1);
    const locating = controller.currentLocation();
    assert.equal(timers.size, 0, 'starting device geolocation clears the selected place retry');
    await locating;
    assert.equal(controller.getState().weather.location.name, 'C');
    const disposed = [...timers.values()][0].callback;
    controller.dispose();
    assert.equal(timers.size, 0);
    disposed();
    assert.equal(calls, 4, 'disposed controllers cannot fetch from a queued retry');
  } finally { controller.dispose(); }
});

for (const filename of ['widget.mjs', 'header-preview.mjs', 'header-dropdown.mjs']) {
  test(`${filename}: the fourth forecast tile selects its own date and weather`, async () => {
    const source = await readSource(filename);
    const listExpression = source.match(/\bae = ([^\n]+),\n/)[1];
    const selectedExpression = source.match(/\bQ = (B === null[^\n]+),\n/)[1];
    const select = new Function('buildForecastSlots', 'd', 'B', `const ae = ${listExpression}; const Q = ${selectedExpression}; return { days: ae, selected: Q };`).bind(null, data => buildForecastSlots(data, Date.parse('2026-11-03T12:00:00Z')));
    const forecastDay = new Function('resolveForecastCloudCover', 'resolveForecastNoonMs', `return (${binding(source, 'weatherForForecastDay', 'weatherStatistics')});`)(resolveForecastCloudCover, resolveForecastNoonMs);
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
    const partial = { ...data, forecast: { forecastday: data.forecast.forecastday.slice(0, 3) } };
    const incomplete = select(partial, 3);
    assert.equal(incomplete.days.length, 4);
    assert.deepEqual(incomplete.days[3], { date: '2026-11-06', available: false });
    assert.equal(incomplete.selected, null, 'a missing forecast must not be selected for details');
    assert.equal(forecastDay(partial, incomplete.days[3]), partial, 'placeholder selection keeps current details');
    assert.equal(partial.forecast.forecastday.length, 3, 'a shorter fallback must not invent provider weather');
  });

  test(`${filename}: four localized cards keep unavailable weather empty and non-selectable`, async () => {
    const source = await readSource(filename);
    const copy = new Function(`return (${binding(source, 'localeCopy', 'conditionCodeLabels')});`)();
    const localeTags = new Function(`return (${binding(source, 'localeTags', 'formatCountry')});`)();
    const formatDate = new Function('localeTags', `return (${binding(source, 'formatForecastDate', 'translateCondition')});`)(localeTags);
    const translate = new Function('conditionCodeLabels', 'conditionTextLabels', `return (${binding(source, 'translateCondition', 'weatherForForecastDay')});`)(
      new Function(`return (${binding(source, 'conditionCodeLabels', 'conditionTextLabels')});`)(),
      new Function(`return (${binding(source, 'conditionTextLabels', 'localeTags')});`)()
    );
    const start = source.indexOf('                        ae.map(');
    const end = source.indexOf('\n                      ],', start);
    assert.ok(start >= 0 && end > start, 'forecast card rendering must be present');
    const render = new Function('ae', 'u', 'U', 'B', 'V', 'jsxRuntime', 'formatForecastDate', 'translateCondition',
      `return (${source.slice(start, end).trim().replace(/,$/, '')});`);
    const jsx = (type, props, key) => ({ type, props, key });
    const actual = forecastDay('2026-11-04', 0, -2);
    actual.day.condition = { code: 1000, text: 'Sunny' };
    const data = { current: {}, location: { localtime: '2026-11-04 12:00' }, forecast: { forecastday: [actual] } };
    const slots = buildForecastSlots(data);
    for (const [locale, unavailable] of [['ru', 'Прогноз недоступен'], ['uk', 'Прогноз недоступний'], ['de', 'Vorhersage nicht verfügbar'], ['en', 'Forecast unavailable']]) {
      const selections = [];
      let selectedIndex = 1;
      const select = updater => { selectedIndex = updater(selectedIndex); selections.push(selectedIndex); };
      const cards = render(slots, locale, copy[locale], selectedIndex, select, { jsx, jsxs: jsx }, formatDate, translate);
      assert.equal(cards.length, 4, locale);
      assert.equal(new Set(cards.map(card => card.key)).size, 4);
      assert.deepEqual(cards.map(card => card.props['data-forecast-date']), slots.map(day => day.date));
      assert.deepEqual(cards.map(card => card.props.children[0].props.children), slots.map(day => formatDate(day.date, locale)));
      assert.deepEqual(cards[0].props.children[1].props.children, [0, '° / ', -2, '°']);
      assert.equal(cards[0].props.children[2].props.children, translate(actual.day.condition, locale));
      cards[0].props.onClick();
      assert.deepEqual(selections, [0]);
      for (const card of cards.slice(1)) {
        assert.equal(card.props.disabled, true);
        assert.equal(card.props['aria-disabled'], true);
        assert.equal(card.props.children[1].props.children, '— / —');
        assert.equal(card.props.children[2].props.children, unavailable);
        assert.ok(!card.props.className.includes('is-active'));
        card.props.onClick();
      }
      assert.deepEqual(selections, [0], 'unavailable cards cannot change the selected detail day');
    }
  });

  test(`${filename}: selecting a daily tile again returns to current weather without another control`, async () => {
    const source = await readSource(filename);
    const start = source.indexOf('                        ae.map(');
    const end = source.indexOf('\n                      ],', start);
    assert.ok(start >= 0 && end > start, 'forecast card rendering must be present');
    const render = new Function('ae', 'B', 'V', 'U', 'u', 'jsxRuntime', 'formatForecastDate', 'translateCondition',
      `return (${source.slice(start, end).trim().replace(/,$/, '')});`);
    const jsx = (type, props, key) => ({ type, props, key });
    const data = { current: {}, location: { localtime: '2026-11-04 22:39' }, forecast: {
      forecastday: ['2026-11-04', '2026-11-06', '2026-11-07'].map(date => forecastDay(date)),
    } };
    const slots = buildForecastSlots(data, Date.parse('2026-11-04T21:39:00Z'));
    let selected = null;
    const queued = [];
    const select = updater => {
      assert.equal(typeof updater, 'function', 'selection must use React functional state so batched taps see the latest state');
      queued.push(updater);
    };
    const flush = () => { for (const updater of queued.splice(0)) selected = updater(selected); };
    const cards = render(slots, selected, select, { forecastUnavailable: 'Unavailable' }, 'en',
      { jsx, jsxs: jsx }, date => date, condition => condition.text);
    cards[0].props.onClick();
    flush();
    assert.equal(selected, 0, 'a first tap selects the real daily forecast');
    cards[0].props.onClick();
    flush();
    assert.equal(selected, null, 'a second tap returns to current weather');
    cards[2].props.onClick();
    flush();
    assert.equal(selected, 2);
    cards[3].props.onClick();
    flush();
    assert.equal(selected, 3, 'another available tile selects its own date');
    cards[0].props.onClick();
    cards[0].props.onClick();
    assert.equal(queued.length, 2);
    flush();
    assert.equal(selected, null, 'rapid repeated taps toggle correctly before React renders again');
    cards[1].props.onClick();
    assert.equal(queued.length, 0, 'an unavailable tile must not call the state setter');
    assert.equal(selected, null);
    assert.equal(data.forecast.forecastday.length, 3);
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
