import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';

import {
  calculateApparentTemperature,
  normalizeBrightSkyCurrent,
  normalizeMetCurrent,
  onRequest,
  parseWeatherCoordinates,
  parseWeatherLocation,
  weatherCodeFromBrightSky,
  weatherCodeFromMetSymbol,
} from './weather.js';

const COORDINATES = { latitude: 51.3397, longitude: 12.3731 };
const CURRENT_TIME = Date.parse('2026-11-03T12:00:00Z');

function brightSkyFixture(overrides = {}) {
  return { weather: {
    timestamp: new Date(CURRENT_TIME - 30 * 60_000).toISOString(),
    temperature: 7, cloud_cover: 90, icon: 'cloudy', relative_humidity: 80,
    wind_speed_10: 8, pressure_msl: 1015, ...overrides,
  } };
}

function metFixture(entries = Array.from({ length: 4 }, (_, index) => ({
  time: new Date(CURRENT_TIME + index * 24 * 60 * 60_000).toISOString(), temperature: 8 + index,
}))) {
  return { properties: {
    meta: { updated_at: new Date(CURRENT_TIME - 60 * 60_000).toISOString() },
    timeseries: entries.map(({ time, temperature, cloud = 75 }) => ({
      time, data: {
        instant: { details: { air_temperature: temperature, cloud_area_fraction: cloud } },
        next_1_hours: { summary: { symbol_code: 'cloudy' } },
      },
    })),
  } };
}

function brightSkyForecastFixture(days = 4) {
  return { weather: Array.from({ length: days }, (_, index) => [
    { timestamp: `2026-11-${String(3 + index).padStart(2, '0')}T12:00:00Z`, temperature: 10 + index,
      relative_humidity: 62, wind_speed: 12, precipitation: 0.4, cloud_cover: 25, icon: 'partly-cloudy-day' },
    { timestamp: `2026-11-${String(3 + index).padStart(2, '0')}T18:00:00Z`, temperature: 14 + index,
      relative_humidity: 78, wind_speed: 18, precipitation: 0.6, cloud_cover: 90, icon: 'rain' },
  ]).flat() };
}

function cachedWeatherFixture() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(Date.now()).map(part => [part.type, part.value]));
  const today = Date.parse(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  return {
    location: { name: 'Leipzig' },
    weatherMeta: { time: new Date().toISOString(), forecastProviderLabel: 'MET Norway' },
    provider: { forecast: 'MET Norway' },
    forecastStatus: 'complete',
    forecast: { forecastday: Array.from({ length: 4 }, (_, index) => ({
      date: new Date(today + index * 24 * 60 * 60_000).toISOString().slice(0, 10),
      day: { mintemp_c: 5 + index, maxtemp_c: 10 + index },
    })) },
  };
}

function weatherHarness(t, {
  bright = brightSkyFixture(), met = metFixture(), brightForecast = null,
  cache = null, expires, now = CURRENT_TIME, timeZone = 'Europe/Berlin',
} = {}) {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const originalNow = Date.now;
  const calls = [];
  const requests = [];
  Date.now = () => now;
  globalThis.caches = cache ? { default: cache } : undefined;
  globalThis.fetch = async (input, options) => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url.hostname);
    requests.push(url);
    const payload = url.hostname === 'api.met.no' ? met : url.pathname === '/weather' ? brightForecast : bright;
    if (typeof payload === 'function') return payload(url, options);
    if (payload instanceof Error) throw payload;
    return payload ? Response.json(payload, { headers: expires ? { Expires: expires } : {} })
      : new Response(null, { status: 503 });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
    Date.now = originalNow;
  });
  const pending = [];
  return {
    calls, requests, pending,
    request: () => onRequest({
      request: new Request(`https://hundesalon-nika.com/api/weather?latitude=51.3397&longitude=12.3731&timezone=${encodeURIComponent(timeZone)}`),
      waitUntil: operation => pending.push(operation),
    }),
  };
}

test('current observations reject missing, invalid, stale and far-future timestamps without relabeling fetch time', () => {
  for (const timestamp of [undefined, '', 'invalid', new Date(CURRENT_TIME - 120 * 60_000 - 1).toISOString(), new Date(CURRENT_TIME + 10 * 60_000 + 1).toISOString()]) {
    assert.equal(normalizeBrightSkyCurrent(brightSkyFixture({ timestamp }), COORDINATES, 'Europe/Berlin', CURRENT_TIME), null);
  }
  const timestamp = new Date(CURRENT_TIME - 120 * 60_000).toISOString();
  const current = normalizeBrightSkyCurrent(brightSkyFixture({ timestamp }), COORDINATES, 'Europe/Berlin', CURRENT_TIME);
  assert.equal(current.time, timestamp);
  assert.equal(current.observedAt, Date.parse(timestamp));
  assert.equal(current.fetchedAt, CURRENT_TIME);
});

test('current observations accept only finite numeric values or nonblank numeric strings and preserve zero', () => {
  for (const temperature of [false, true, [], [0], {}, ' ', '\t', 'invalid', NaN, Infinity]) {
    assert.equal(normalizeBrightSkyCurrent(brightSkyFixture({ temperature }), COORDINATES, 'Europe/Berlin', CURRENT_TIME), null);
    assert.equal(normalizeMetCurrent(metFixture([
      { time: new Date(CURRENT_TIME).toISOString(), temperature },
    ]), COORDINATES, 'Europe/Berlin', CURRENT_TIME), null);
  }
  for (const temperature of [0, '0', ' 0 ', -2, '-2.5']) {
    assert.equal(normalizeBrightSkyCurrent(brightSkyFixture({ temperature }), COORDINATES, 'Europe/Berlin', CURRENT_TIME).temperature, Number(temperature));
    assert.equal(normalizeMetCurrent(metFixture([
      { time: new Date(CURRENT_TIME).toISOString(), temperature },
    ]), COORDINATES, 'Europe/Berlin', CURRENT_TIME).temperature, Number(temperature));
  }
});

test('MET current selection uses the closest valid temperature and time, not the first array entry', () => {
  const payload = metFixture([
    { time: new Date(CURRENT_TIME - 6 * 60 * 60_000).toISOString(), temperature: 1 },
    { time: new Date(CURRENT_TIME + 60 * 60_000).toISOString(), temperature: 20 },
    { time: new Date(CURRENT_TIME - 60 * 60_000).toISOString(), temperature: 3 },
    { time: new Date(CURRENT_TIME - 5 * 60_000).toISOString(), temperature: null },
    { time: new Date(CURRENT_TIME - 10 * 60_000).toISOString(), temperature: 7 },
    { time: 'invalid', temperature: 30 },
  ]);
  const current = normalizeMetCurrent(payload, COORDINATES, 'Europe/Berlin', CURRENT_TIME);
  assert.equal(current.temperature, 7);
  assert.equal(current.validAt, CURRENT_TIME - 10 * 60_000);
  assert.equal(current.fetchedAt, CURRENT_TIME);
  assert.equal(current.forecastUpdatedAt, payload.properties.meta.updated_at);
  assert.equal(normalizeMetCurrent(metFixture([{ time: 'invalid', temperature: 7 }]), COORDINATES, 'Europe/Berlin', CURRENT_TIME), null);
  assert.equal(normalizeMetCurrent(metFixture([{ time: new Date(CURRENT_TIME + 11 * 60_000).toISOString(), temperature: 7 }]), COORDINATES, 'Europe/Berlin', CURRENT_TIME), null);
});

test('stale DWD observations fall back to fresh MET without claiming a new observation', async t => {
  const harness = weatherHarness(t, { bright: brightSkyFixture({ timestamp: new Date(CURRENT_TIME - 6 * 60 * 60_000).toISOString() }) });
  const response = await harness.request();
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.current.temp_c, 8);
  assert.equal(payload.weatherMeta.source, 'met-norway-locationforecast');
  assert.equal(payload.current.last_updated_epoch, CURRENT_TIME / 1000);
});

test('missing DWD cloud cover uses real fresh MET with field attribution while retaining DWD observations', async t => {
  const harness = weatherHarness(t, { bright: brightSkyFixture({ cloud_cover: null }) });
  const payload = await (await harness.request()).json();
  assert.equal(payload.current.temp_c, 7);
  assert.equal(payload.current.cloud, 75);
  assert.equal(payload.current.condition.text, 'Overcast');
  assert.equal(payload.weatherMeta.cloudCover, 75);
  assert.deepEqual(payload.weatherMeta.fieldSources.cloudCover, { source: 'met-norway-locationforecast', time: new Date(CURRENT_TIME).toISOString() });
});

test('unknown cloud cover stays null when no fresh fallback exists, rather than clearing overcast skies', async t => {
  const harness = weatherHarness(t, { bright: brightSkyFixture({ cloud_cover: null }), met: null });
  const payload = await (await harness.request()).json();
  assert.equal(payload.current.cloud, null);
  assert.equal(payload.weatherMeta.cloudCover, null);
  assert.equal(payload.current.condition.text, 'Overcast');
});

test('unusable provider timestamps return a temporary error instead of invented current weather', async t => {
  const harness = weatherHarness(t, {
    bright: brightSkyFixture({ timestamp: new Date(CURRENT_TIME + 11 * 60_000).toISOString() }),
    met: metFixture([{ time: new Date(CURRENT_TIME - 121 * 60_000).toISOString(), temperature: 8 }]),
  });
  assert.equal((await harness.request()).status, 502);
});

test('zero-zero coordinates are rejected before contacting a weather provider', async t => {
  const harness = weatherHarness(t);
  const response = await onRequest({ request: new Request('https://hundesalon-nika.com/api/weather?latitude=0&longitude=0') });
  assert.equal(response.status, 400);
  assert.equal(harness.calls.length, 0);
});

test('cached observations that have aged beyond the current window are refreshed', async t => {
  const harness = weatherHarness(t, { cache: {
    match: async request => new URL(request.url).hostname === 'weather-cache.hundesalon-nika.internal'
      ? Response.json({ current: { temp_c: -99 }, weatherMeta: { time: new Date(CURRENT_TIME - 121 * 60_000).toISOString() } })
      : null,
    put: async () => {},
  } });
  const response = await harness.request();
  assert.equal(response.headers.get('X-Weather-Cache'), 'MISS');
  assert.equal((await response.json()).current.temp_c, 7);
});

test('cache read and write failures do not prevent live weather, including the optional cache rate limiter', async t => {
  const harness = weatherHarness(t, { cache: {
    match: async () => { throw new Error('Cache unavailable'); },
    put: () => { throw new Error('Cache unavailable'); },
  }, expires: new Date(CURRENT_TIME + 20 * 60_000).toUTCString() });
  const response = await harness.request();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).current.temp_c, 7);
  await Promise.all(harness.pending);
});

test('asynchronous cache write rejections are handled even without waitUntil', async t => {
  const harness = weatherHarness(t, { cache: {
    match: async () => null,
    put: async () => { throw new Error('Cache unavailable'); },
  } });
  const response = await onRequest({ request: new Request('https://hundesalon-nika.com/api/weather?latitude=51.3397&longitude=12.3731') });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).current.temp_c, 7);
  assert.equal(harness.calls.length, 2);
  await new Promise(resolve => setImmediate(resolve));
});

test('MET provider cache honors Expires across five-minute combined-cache misses and refetches after expiry', async t => {
  const records = new Map();
  const cache = {
    match: async request => {
      const url = new URL(request.url);
      if (url.hostname !== 'met-forecast-cache.hundesalon-nika.internal') return null;
      return records.get(request.url)?.clone() || null;
    },
    put: async (request, response) => {
      if (new URL(request.url).hostname === 'met-forecast-cache.hundesalon-nika.internal') {
        assert.equal(response.headers.get('Cache-Control'), 'max-age=1200');
        records.set(request.url, response.clone());
      }
    },
  };
  const harness = weatherHarness(t, { cache, expires: new Date(CURRENT_TIME + 20 * 60_000).toUTCString() });
  assert.equal((await harness.request()).status, 200);
  await Promise.all(harness.pending);
  Date.now = () => CURRENT_TIME + 6 * 60_000;
  assert.equal((await harness.request()).status, 200);
  assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 1);
  Date.now = () => CURRENT_TIME + 21 * 60_000;
  assert.equal((await harness.request()).status, 200);
  assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 2);
});

test('weather coordinate parsing rejects invalid or out-of-range values', () => {
  assert.deepEqual(parseWeatherCoordinates('51.3397', '12.3731'), COORDINATES);
  assert.deepEqual(parseWeatherLocation('51.3397, 12.3731'), COORDINATES);
  assert.equal(parseWeatherCoordinates('', '12.3731'), null);
  assert.equal(parseWeatherCoordinates('91', '12.3731'), null);
  assert.equal(parseWeatherCoordinates('0', '0'), null);
  assert.deepEqual(parseWeatherCoordinates('0', '12'), { latitude: 0, longitude: 12 });
  assert.equal(parseWeatherLocation('Leipzig'), null);
});

test('Bright Sky current observations map to the unified weather metadata', () => {
  const payload = {
    weather: {
      source_id: 11748,
      timestamp: '2026-07-28T17:30:00+02:00',
      cloud_cover: 0,
      relative_humidity: 38,
      pressure_msl: 1021.5,
      precipitation_10: 0,
      temperature: 25.1,
      visibility: 48660,
      wind_direction_10: 310,
      wind_speed_10: 8.6,
      wind_gust_speed_10: 17.3,
      icon: 'clear-day',
    },
    sources: [
      {
        id: 11748,
        station_name: 'Leipzig-Holzhausen',
        distance: 5775,
      },
    ],
  };

  const current = normalizeBrightSkyCurrent(payload, COORDINATES, 'Europe/Berlin', Date.parse('2026-07-28T16:00:00Z'));
  assert.equal(current.source, 'dwd-bright-sky');
  assert.equal(current.weatherCode, 0);
  assert.equal(current.temperature, 25.1);
  assert.equal(current.humidity, 38);
  assert.equal(current.windSpeedKph, 8.6);
  assert.equal(current.stationName, 'Leipzig-Holzhausen');
  assert.equal(current.stationDistanceMeters, 5775);
  assert.ok(current.apparentTemperature > 20 && current.apparentTemperature < 27);
});

test('MET Norway timeseries maps to the fallback weather metadata', () => {
  const payload = {
    properties: {
      timeseries: [
        {
          time: '2026-07-28T16:00:00Z',
          data: {
            instant: {
              details: {
                air_pressure_at_sea_level: 1021.7,
                air_temperature: 24.4,
                cloud_area_fraction: 5.5,
                relative_humidity: 36.5,
                wind_from_direction: 302.4,
                wind_speed: 2.7,
              },
            },
            next_1_hours: {
              summary: { symbol_code: 'clearsky_day' },
              details: { precipitation_amount: 0 },
            },
          },
        },
      ],
    },
  };

  const current = normalizeMetCurrent(payload, COORDINATES, 'Europe/Berlin', Date.parse('2026-07-28T16:00:00Z'));
  assert.equal(current.source, 'met-norway-locationforecast');
  assert.equal(current.weatherCode, 0);
  assert.equal(current.temperature, 24.4);
  assert.equal(current.windSpeedKph, 9.72);
  assert.equal(current.isDay, 1);
  assert.equal(current.pressureMmHg, 766);
});

test('provider condition tokens map to WMO-compatible weather codes', () => {
  assert.equal(weatherCodeFromBrightSky('partly-cloudy-night', 50), 2);
  assert.equal(weatherCodeFromBrightSky('thunderstorm', 100), 95);
  assert.equal(weatherCodeFromMetSymbol('heavyrainshowersandthunder_day', 100), 95);
  assert.equal(weatherCodeFromMetSymbol('snowshowers_night', 100), 85);
});

test('apparent temperature remains finite for normal current observations', () => {
  assert.equal(calculateApparentTemperature(null, 50, 10), null);
  assert.equal(calculateApparentTemperature(20, null, null), 20);
  assert.ok(Number.isFinite(calculateApparentTemperature(25, 40, 10)));
});

test('weather rate limit rejects named locations before contacting any geocoder', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let upstreamCalls = 0;
  globalThis.fetch = async () => {
    upstreamCalls += 1;
    throw new Error('Unexpected upstream request');
  };
  globalThis.caches = {
    default: {
      match: async request => {
        assert.equal(new URL(request.url).hostname, 'rate-limit.hundesalon-nika.internal');
        return new Response('24');
      },
      put: async () => assert.fail('Rejected requests must not update the cache'),
    },
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/api/weather?location=Leipzig'),
    });
    assert.equal(response.status, 429);
    assert.equal(upstreamCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test('cached weather coordinates avoid upstream requests even when the rate limit is reached', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  globalThis.fetch = async () => assert.fail('Cached coordinates must not contact a provider');
  globalThis.caches = {
    default: {
      match: async request => {
        assert.equal(new URL(request.url).hostname, 'weather-cache.hundesalon-nika.internal');
        assert.match(new URL(request.url).pathname, /^\/v5\//);
        return Response.json(cachedWeatherFixture());
      },
      put: async () => assert.fail('Cache hits must not consume a rate-limit allowance'),
    },
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/api/weather?latitude=51.3397&longitude=12.3731'),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Weather-Cache'), 'HIT');
    assert.equal((await response.json()).cached, true);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test('a named location consumes one rate-limit allowance before reading cached weather', async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  let upstreamCalls = 0;
  let limiterWrites = 0;
  globalThis.fetch = async url => {
    upstreamCalls += 1;
    assert.equal(new URL(url).searchParams.get('q'), 'Leipzig');
    return Response.json({
      features: [{ geometry: { coordinates: [12.3731, 51.3397] }, properties: { name: 'Leipzig' } }],
    });
  };
  globalThis.caches = {
    default: {
      match: async request =>
        new URL(request.url).hostname === 'rate-limit.hundesalon-nika.internal'
          ? null
          : Response.json(cachedWeatherFixture()),
      put: async (request, response) => {
        assert.equal(new URL(request.url).hostname, 'rate-limit.hundesalon-nika.internal');
        assert.equal(await response.text(), '1');
        limiterWrites += 1;
      },
    },
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/api/weather?location=Leipzig'),
    });
    assert.equal(response.status, 200);
    assert.equal(upstreamCalls, 1);
    assert.equal(limiterWrites, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
  }
});

test('weather forecast returns four successive real days and preserves partial provider data', async t => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const originalNow = Date.now;
  const now = Date.parse('2026-11-03T06:00:00Z');
  Date.now = () => now;
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.caches = originalCaches;
    Date.now = originalNow;
  });

  for (const days of [5, 2]) {
    await t.test(`${days} available days`, async () => {
      const timeseries = Array.from({ length: days }, (_, index) => ({
        time: `2026-11-${String(3 + index).padStart(2, '0')}T06:00:00Z`,
        data: {
          instant: {
            details: {
              air_pressure_at_sea_level: 1013.25,
              air_temperature: 10 + index,
              cloud_area_fraction: 20,
              relative_humidity: 60,
              wind_speed: 3,
            },
          },
          next_1_hours: {
            summary: { symbol_code: 'clearsky_day' },
            details: { precipitation_amount: 0 },
          },
        },
      }));
      // An incomplete extra day must not produce a fabricated forecast tile.
      timeseries.push({ time: '2026-11-09T12:00:00Z', data: { instant: { details: {} } } });
      let providerCalls = 0;
      globalThis.fetch = async url => {
        providerCalls += 1;
        return new URL(url).hostname === 'api.met.no'
          ? Response.json({ properties: { timeseries } })
          : new Response(null, { status: 503 });
      };
      globalThis.caches = {
        default: {
          match: async request => {
            if (new URL(request.url).hostname === 'weather-cache.hundesalon-nika.internal') {
              assert.match(new URL(request.url).pathname, /^\/v5\//);
            }
            return null;
          },
          put: async () => {},
        },
      };

      const response = await onRequest({
        request: new Request('https://hundesalon-nika.com/api/weather?latitude=51.3397&longitude=12.3731&lang=ru'),
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(
        payload.forecast.forecastday.map(day => day.date),
        ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].slice(0, days)
      );
      assert.deepEqual(
        payload.forecast.forecastday.map(day => day.day.maxtemp_c),
        [10, 11, 12, 13].slice(0, days)
      );
      assert.equal(payload.forecastStatus, days >= 4 ? 'complete' : 'partial');
      assert.equal(providerCalls, days >= 4 ? 2 : 3);
    });
  }
});

test('MET failure or an empty successful response uses real Bright Sky forecast hours and preserves DWD current observations', async t => {
  for (const [failure, met] of [
    ['503', null],
    ['timeout', new globalThis.DOMException('Mocked provider timeout', 'AbortError')],
    ['empty 200', metFixture([])],
  ]) {
    await t.test(failure, async t => {
      const harness = weatherHarness(t, { met, brightForecast: brightSkyForecastFixture() });
      const response = await harness.request();
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.current.temp_c, 7);
      assert.equal(payload.current.cloud, 90);
      assert.equal(payload.weatherMeta.source, 'dwd-bright-sky');
      assert.equal(payload.forecastStatus, 'complete');
      assert.equal(payload.provider.forecast, 'DWD via Bright Sky');
      assert.equal(payload.weatherMeta.forecastProviderLabel, 'DWD via Bright Sky');
      assert.deepEqual(payload.forecast.forecastday.map(day => day.date), [
        '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
      ]);
      assert.deepEqual(payload.forecast.forecastday.map(day => day.day.mintemp_c), [10, 11, 12, 13]);
      assert.deepEqual(payload.forecast.forecastday.map(day => day.day.maxtemp_c), [14, 15, 16, 17]);
      assert.equal(payload.forecast.forecastday[0].day.maxwind_kph, 18);
      assert.equal(payload.forecast.forecastday[0].day.totalprecip_mm, 1);
      assert.equal(payload.forecast.forecastday[0].day.avghumidity, 70);
      const backup = harness.requests.filter(url => url.pathname === '/weather');
      assert.equal(backup.length, 1);
      assert.equal(backup[0].searchParams.get('date'), '2026-11-03');
      assert.equal(backup[0].searchParams.get('last_date'), '2026-11-07');
      assert.equal(backup[0].searchParams.get('tz'), 'Europe/Berlin');
      assert.equal(backup[0].searchParams.get('units'), 'dwd');
      assert.equal(backup[0].searchParams.get('max_dist'), '50000');
      assert.equal(harness.requests.filter(url => url.pathname === '/current_weather').length, 1);
    });
  }
});

test('unavailable forecast providers retain real current weather without inventing a daily temperature', async t => {
  const writes = [];
  const cooldowns = [];
  const harness = weatherHarness(t, { met: null, cache: {
    match: async () => null,
    put: async (request, response) => {
      const host = new URL(request.url).hostname;
      writes.push(host);
      if (host === 'met-forecast-cache.hundesalon-nika.internal') {
        cooldowns.push(await response.json());
      }
    },
  } });
  const response = await harness.request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /\bno-store\b/);
  const payload = await response.json();
  assert.equal(payload.current.temp_c, 7);
  assert.equal(payload.weatherMeta.source, 'dwd-bright-sky');
  assert.equal(payload.forecastStatus, 'unavailable');
  assert.deepEqual(payload.forecast.forecastday, []);
  assert.equal(payload.provider.forecast, null);
  assert.equal(payload.weatherMeta.forecastProviderLabel, null);
  await Promise.all(harness.pending);
  assert.ok(!writes.includes('weather-cache.hundesalon-nika.internal'));
  assert.deepEqual(cooldowns, [{ unavailable: true, expiresAt: CURRENT_TIME + 30_000 }]);
});

test('the backup forecast preserves fresh MET cloud attribution for a DWD current observation with unknown cloud cover', async t => {
  const harness = weatherHarness(t, {
    bright: brightSkyFixture({ cloud_cover: null }),
    met: metFixture([{ time: new Date(CURRENT_TIME).toISOString(), temperature: 8, cloud: 75 }]),
    brightForecast: brightSkyForecastFixture(),
  });
  const payload = await (await harness.request()).json();
  assert.equal(payload.current.temp_c, 7);
  assert.equal(payload.current.cloud, 75);
  assert.equal(payload.weatherMeta.source, 'dwd-bright-sky');
  assert.deepEqual(payload.weatherMeta.fieldSources.cloudCover, {
    source: 'met-norway-locationforecast', time: new Date(CURRENT_TIME).toISOString(),
  });
  assert.equal(payload.forecastStatus, 'complete');
  assert.equal(payload.provider.forecast, 'DWD via Bright Sky');
});

test('partial forecasts retain only real source days and are not cached as a healthy forecast', async t => {
  for (const provider of ['MET Norway', 'DWD via Bright Sky']) {
    await t.test(provider, async t => {
      const writes = [];
      const cooldowns = [];
      const harness = weatherHarness(t, {
        met: provider === 'MET Norway' ? metFixture([
          { time: '2026-11-03T12:00:00Z', temperature: 10 },
          { time: '2026-11-04T12:00:00Z', temperature: 11 },
        ]) : null,
        brightForecast: provider === 'DWD via Bright Sky' ? brightSkyForecastFixture(2) : null,
        expires: new Date(CURRENT_TIME + 20 * 60_000).toUTCString(),
        cache: { match: async () => null, put: async (request, response) => {
          const host = new URL(request.url).hostname;
          writes.push(host);
          if (host === 'met-forecast-cache.hundesalon-nika.internal') {
            cooldowns.push(await response.json());
          }
        } },
      });
      const response = await harness.request();
      assert.match(response.headers.get('Cache-Control'), /\bno-store\b/);
      const payload = await response.json();
      assert.equal(payload.forecastStatus, 'partial');
      assert.equal(payload.provider.forecast, provider);
      assert.equal(payload.weatherMeta.forecastProviderLabel, provider);
      assert.deepEqual(payload.forecast.forecastday.map(day => day.date), ['2026-11-03', '2026-11-04']);
      assert.deepEqual(payload.forecast.forecastday.map(day => day.day.maxtemp_c), provider === 'MET Norway' ? [10, 11] : [14, 15]);
      await Promise.all(harness.pending);
      assert.ok(!writes.includes('weather-cache.hundesalon-nika.internal'));
      assert.deepEqual(cooldowns, [{
        unavailable: true, expiresAt: CURRENT_TIME + (provider === 'MET Norway' ? 20 * 60_000 : 30_000),
      }]);
    });
  }
});

test('four MET dates with a missing target day use the complete backup forecast', async t => {
  const harness = weatherHarness(t, {
    met: metFixture([0, 2, 3, 4].map(index => ({
      time: new Date(CURRENT_TIME + index * 24 * 60 * 60_000).toISOString(), temperature: 1 + index,
    }))),
    brightForecast: brightSkyForecastFixture(),
  });
  const payload = await (await harness.request()).json();
  assert.equal(payload.forecastStatus, 'complete');
  assert.equal(payload.provider.forecast, 'DWD via Bright Sky');
  assert.deepEqual(payload.forecast.forecastday.map(day => day.date), [
    '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
  ]);
  assert.equal(harness.requests.filter(url => url.pathname === '/weather').length, 1);
});

test('provider cache with future expiry still requires four valid consecutive target dates', async t => {
  for (const [coverage, entries] of [
    ['legacy malformed payload without an unavailable marker', null],
    ['empty', []],
    ['partial', [{ time: '2026-11-03T12:00:00Z', temperature: 1 }]],
    ['missing target day', [0, 2, 3, 4].map(index => ({
      time: new Date(CURRENT_TIME + index * 24 * 60 * 60_000).toISOString(), temperature: 1,
    }))],
    ['invalid temperatures', [0, 1, 2, 3].map(index => ({
      time: new Date(CURRENT_TIME + index * 24 * 60 * 60_000).toISOString(), temperature: null,
    }))],
  ]) {
    await t.test(coverage, async t => {
      const harness = weatherHarness(t, { cache: {
        match: async request => {
          const url = new URL(request.url);
          if (url.hostname !== 'met-forecast-cache.hundesalon-nika.internal') return null;
          assert.match(url.pathname, /^\/v2\//);
          return Response.json({ payload: entries === null ? {} : metFixture(entries), expiresAt: CURRENT_TIME + 20 * 60_000 });
        },
        put: async () => {},
      } });
      const payload = await (await harness.request()).json();
      assert.equal(payload.forecastStatus, 'complete');
      assert.equal(payload.provider.forecast, 'MET Norway');
      assert.deepEqual(payload.forecast.forecastday.map(day => day.day.maxtemp_c), [8, 9, 10, 11]);
      assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 1);
      assert.equal(harness.requests.filter(url => url.pathname === '/weather').length, 0);
    });
  }
});

test('an empty MET 200 stores only cooldown metadata and recovers after its advertised expiry', async t => {
  const records = new Map();
  let available = false;
  const harness = weatherHarness(t, {
    met: () => Response.json(available ? metFixture() : metFixture([]), {
      headers: { Expires: new Date(CURRENT_TIME + 20 * 60_000).toUTCString() },
    }),
    cache: {
      match: async request => records.get(request.url)?.clone() || null,
      put: async (request, response) => records.set(request.url, response.clone()),
    },
  });
  const degraded = await harness.request();
  assert.match(degraded.headers.get('Cache-Control'), /\bno-store\b/);
  assert.equal((await degraded.json()).forecastStatus, 'unavailable');
  await Promise.all(harness.pending);
  assert.ok([...records.keys()].every(key => new URL(key).hostname !== 'weather-cache.hundesalon-nika.internal'));
  const cooldown = [...records.entries()].find(([key]) => new URL(key).hostname === 'met-forecast-cache.hundesalon-nika.internal');
  assert.ok(cooldown);
  assert.deepEqual(await cooldown[1].clone().json(), { unavailable: true, expiresAt: CURRENT_TIME + 20 * 60_000 });

  available = true;
  Date.now = () => CURRENT_TIME + 60_000;
  const suppressed = await harness.request();
  assert.equal((await suppressed.json()).forecastStatus, 'unavailable');
  assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 1);
  assert.equal(harness.requests.filter(url => url.pathname === '/weather').length, 2);

  Date.now = () => CURRENT_TIME + 20 * 60_000 + 1;
  const recovered = await harness.request();
  assert.equal(recovered.headers.get('X-Weather-Cache'), 'MISS');
  assert.equal((await recovered.json()).forecastStatus, 'complete');
  await Promise.all(harness.pending);
  assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 2);
  const healthyCache = [...records.entries()].find(([key]) => new URL(key).hostname === 'weather-cache.hundesalon-nika.internal');
  assert.ok(healthyCache);
  assert.match(new URL(healthyCache[0]).pathname, /^\/v5\//);
  assert.equal(healthyCache[1].headers.get('Cache-Control'), 'max-age=300');

  const hit = await harness.request();
  assert.equal(hit.headers.get('X-Weather-Cache'), 'HIT');
  assert.equal((await hit.json()).forecastStatus, 'complete');
  assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 2);
});

test('forecast days start at local today across a UTC date boundary and exclude other calendar days', async t => {
  const now = Date.parse('2026-11-03T23:30:00Z');
  const harness = weatherHarness(t, {
    now,
    bright: brightSkyFixture({ timestamp: new Date(now - 30 * 60_000).toISOString() }),
    met: metFixture([
      { time: new Date(now - 60 * 60_000).toISOString(), temperature: -99 },
      ...Array.from({ length: 4 }, (_, index) => ({
        time: new Date(now + index * 24 * 60 * 60_000).toISOString(), temperature: 10 + index,
      })),
      { time: new Date(now + 4 * 24 * 60 * 60_000).toISOString(), temperature: 99 },
    ]),
  });
  const payload = await (await harness.request()).json();
  const dates = payload.forecast.forecastday.map(day => day.date);
  assert.deepEqual(dates, ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07']);
  assert.equal(new Set(dates).size, 4);
  assert.deepEqual(payload.forecast.forecastday.map(day => day.day.maxtemp_c), [10, 11, 12, 13]);
  assert.equal(payload.forecastStatus, 'complete');
  assert.equal(payload.provider.forecast, 'MET Norway');
  assert.equal(harness.requests.filter(url => url.pathname === '/weather').length, 0);
});

test('forecast providers skip boolean, array, object and blank temperatures while retaining real zero temperatures', async t => {
  const entries = [false, [], {}, ' '].map(temperature => ({
    time: new Date(CURRENT_TIME).toISOString(), temperature,
  })).concat([0, '0', 5].map((temperature, index) => ({
    time: new Date(CURRENT_TIME + (index + 1) * 24 * 60 * 60_000).toISOString(), temperature,
  })));
  for (const provider of ['MET Norway', 'DWD via Bright Sky']) {
    await t.test(provider, async t => {
      const harness = weatherHarness(t, {
        met: provider === 'MET Norway' ? metFixture(entries) : null,
        brightForecast: provider === 'DWD via Bright Sky' ? { weather: entries.map(entry => ({
          timestamp: entry.time, temperature: entry.temperature, icon: 'cloudy',
        })) } : null,
      });
      const payload = await (await harness.request()).json();
      assert.equal(payload.current.temp_c, 7);
      assert.equal(payload.forecastStatus, 'partial');
      assert.equal(payload.provider.forecast, provider);
      assert.deepEqual(payload.forecast.forecastday.map(day => day.date), ['2026-11-04', '2026-11-05', '2026-11-06']);
      assert.deepEqual(payload.forecast.forecastday.map(day => [day.day.mintemp_c, day.day.maxtemp_c]), [[0, 0], [0, 0], [5, 5]]);
    });
  }
});

test('partial and invalid MET 200 responses retain first-call real data but only metadata during the advertised cooldown', async t => {
  for (const [coverage, initial, temperatures] of [
    ['partial', metFixture([
      { time: '2026-11-03T12:00:00Z', temperature: 10 },
      { time: '2026-11-04T12:00:00Z', temperature: 11 },
    ]), [10, 11]],
    ['invalid', {}, []],
  ]) {
    await t.test(coverage, async t => {
      const records = new Map();
      let available = false;
      const expiresAt = CURRENT_TIME + 20 * 60_000;
      const harness = weatherHarness(t, {
        met: () => Response.json(available ? metFixture() : initial, {
          headers: { Expires: new Date(expiresAt).toUTCString() },
        }),
        cache: {
          match: async request => records.get(request.url)?.clone() || null,
          put: async (request, response) => {
            if (new URL(request.url).hostname === 'met-forecast-cache.hundesalon-nika.internal') {
              records.set(request.url, response.clone());
            }
          },
        },
      });
      const first = await (await harness.request()).json();
      assert.deepEqual(first.forecast.forecastday.map(day => day.day.maxtemp_c), temperatures);
      assert.equal(first.forecastStatus, temperatures.length ? 'partial' : 'unavailable');
      await Promise.all(harness.pending);
      assert.equal(records.size, 1);
      assert.deepEqual(await [...records.values()][0].clone().json(), { unavailable: true, expiresAt });

      available = true;
      Date.now = () => CURRENT_TIME + 60_000;
      const suppressed = await harness.request();
      assert.match(suppressed.headers.get('Cache-Control'), /\bno-store\b/);
      const repeated = await suppressed.json();
      assert.equal(repeated.current.temp_c, 7);
      assert.equal(repeated.forecastStatus, 'unavailable');
      assert.deepEqual(repeated.forecast.forecastday, []);
      assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 1);
      assert.equal(harness.requests.filter(url => url.pathname === '/weather').length, 2);

      Date.now = () => expiresAt + 1;
      const recovered = await (await harness.request()).json();
      assert.equal(recovered.forecastStatus, 'complete');
      assert.equal(recovered.provider.forecast, 'MET Norway');
      assert.equal(recovered.forecast.forecastday.length, 4);
      assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 2);
    });
  }
});

test('MET failures honor retry headers or a 30-second default cooldown while backups continue and expiry permits recovery', async t => {
  for (const [failure, retryMs] of [
    ['503', 30_000], ['AbortError', 30_000],
    ['429 Retry-After', 120_000], ['invalid JSON with Expires', 20 * 60_000],
  ]) {
    await t.test(failure, async t => {
      const records = new Map();
      let available = false;
      const harness = weatherHarness(t, {
        met: () => {
          if (available) return Response.json(metFixture());
          if (failure === '503') return new globalThis.Response(null, { status: 503 });
          if (failure === '429 Retry-After') return new globalThis.Response(null, { status: 429, headers: { 'Retry-After': '120' } });
          if (failure === 'invalid JSON with Expires') {
            return new globalThis.Response('{', { headers: { Expires: new Date(CURRENT_TIME + retryMs).toUTCString() } });
          }
          throw new globalThis.DOMException('Mocked provider timeout', 'AbortError');
        },
        brightForecast: brightSkyForecastFixture(2),
        cache: {
          match: async request => records.get(request.url)?.clone() || null,
          put: async (request, response) => {
            if (new URL(request.url).hostname === 'met-forecast-cache.hundesalon-nika.internal') {
              records.set(request.url, response.clone());
            }
          },
        },
      });
      const first = await (await harness.request()).json();
      assert.equal(first.forecastStatus, 'partial');
      assert.equal(first.provider.forecast, 'DWD via Bright Sky');
      await Promise.all(harness.pending);
      assert.equal(records.size, 1);
      assert.deepEqual(await [...records.values()][0].clone().json(), { unavailable: true, expiresAt: CURRENT_TIME + retryMs });

      available = true;
      Date.now = () => CURRENT_TIME + retryMs - 1;
      const suppressed = await (await harness.request()).json();
      assert.equal(suppressed.forecastStatus, 'partial');
      assert.equal(suppressed.provider.forecast, 'DWD via Bright Sky');
      assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 1);
      assert.equal(harness.requests.filter(url => url.pathname === '/weather').length, 2);

      Date.now = () => CURRENT_TIME + retryMs + 1;
      const recovered = await (await harness.request()).json();
      assert.equal(recovered.forecastStatus, 'complete');
      assert.equal(recovered.provider.forecast, 'MET Norway');
      assert.equal(recovered.forecast.forecastday.length, 4);
      assert.equal(harness.calls.filter(host => host === 'api.met.no').length, 2);
      assert.equal(harness.requests.filter(url => url.pathname === '/weather').length, 2);
    });
  }
});
