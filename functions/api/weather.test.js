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

function metFixture(entries = [{ time: new Date(CURRENT_TIME).toISOString(), temperature: 8 }]) {
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

function weatherHarness(t, { bright = brightSkyFixture(), met = metFixture(), cache = null, expires } = {}) {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const originalNow = Date.now;
  const calls = [];
  Date.now = () => CURRENT_TIME;
  globalThis.caches = cache ? { default: cache } : undefined;
  globalThis.fetch = async url => {
    const host = new URL(url).hostname;
    calls.push(host);
    const payload = host === 'api.met.no' ? met : bright;
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
    calls, pending,
    request: () => onRequest({
      request: new Request('https://hundesalon-nika.com/api/weather?latitude=51.3397&longitude=12.3731'),
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
        assert.match(new URL(request.url).pathname, /^\/v4\//);
        return Response.json({ location: { name: 'Leipzig' }, weatherMeta: { time: new Date().toISOString() } });
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
          : Response.json({ location: { name: 'Leipzig' }, weatherMeta: { time: new Date().toISOString() } }),
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
              assert.match(new URL(request.url).pathname, /^\/v4\//);
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
      assert.equal(providerCalls, 2);
    });
  }
});
