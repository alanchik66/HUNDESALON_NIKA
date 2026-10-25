import test from 'node:test';
import assert from 'node:assert/strict';

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

test('weather coordinate parsing rejects invalid or out-of-range values', () => {
  assert.deepEqual(parseWeatherCoordinates('51.3397', '12.3731'), COORDINATES);
  assert.deepEqual(parseWeatherLocation('51.3397, 12.3731'), COORDINATES);
  assert.equal(parseWeatherCoordinates('', '12.3731'), null);
  assert.equal(parseWeatherCoordinates('91', '12.3731'), null);
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

  const current = normalizeBrightSkyCurrent(payload, COORDINATES, 'Europe/Berlin', 1_785_258_000_000);
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

  const current = normalizeMetCurrent(payload, COORDINATES, 'Europe/Berlin', 1_785_258_000_000);
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
        return Response.json({ location: { name: 'Leipzig' } });
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
          : Response.json({ location: { name: 'Leipzig' } }),
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
