import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'espree';
import { solarPosition, moonPosition, projectSkyPosition, normalizeSolarDay, calculateSolarDay, solarPhase, solarNightWindow, solarPresentation } from '../assets/js/weather-solar-time.js';

const date = '2026-11-05';
const zone = 'Europe/Berlin';
const latitude = 51.23;
const longitude = 6.78;
// Independently fetched public-city provider response, 2026-11-05. USNO below
// reports minute precision; these seconds belong only to sunrise-sunset.org.
const provider = {
  status: 'OK',
  results: {
    sunrise: '2026-11-05T07:32:44+01:00',
    sunset: '2026-11-05T17:00:11+01:00',
    solar_noon: '2026-11-05T12:16:28+01:00',
    civil_twilight_begin: '2026-11-05T06:57:27+01:00',
    civil_twilight_end: '2026-11-05T17:35:28+01:00',
  },
};
const day = normalizeSolarDay(provider, date, zone);
const phaseAt = time => solarPhase(time, day, latitude, longitude);
const minute = 60000;

const sceneClock = readFile(new URL('../3d-weather-codrops-main/src/scene.mjs', import.meta.url), 'utf8').then(source => {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const declaration = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id?.name === 'resolveWeatherScenePhase');
  assert.ok(declaration, 'The maintained 3D scene must resolve its solar clock.');
  return runInNewContext(`${source.slice(...declaration.range)}; resolveWeatherScenePhase;`, { solarPhase });
});

function bounded(phase) {
  for (const key of ['sunOpacity', 'moonOpacity', 'starOpacity', 'dayProgress']) {
    assert.ok(Number.isFinite(phase[key]) && phase[key] >= 0 && phase[key] <= 1, `${key}: ${phase[key]}`);
  }
}

test('night timeline spans adjacent sunset and sunrise events, clamps its progress, and preserves missing polar events', () => {
  const astro = { today: day, yesterday: { sunset: day.sunset - 86400000 }, tomorrow: { sunrise: day.sunrise + 86400000 } };
  const beforeDawn = solarNightWindow(astro, day.sunrise - minute);
  assert.equal(beforeDawn.nightStart, astro.yesterday.sunset);
  assert.equal(beforeDawn.nightEnd, day.sunrise);
  assert.equal(beforeDawn.nightDuration, day.sunrise - astro.yesterday.sunset);
  assert.ok(beforeDawn.nightProgress > .9 && beforeDawn.nightProgress < 1);
  const evening = solarNightWindow(astro, day.sunset + minute);
  assert.equal(evening.nightStart, day.sunset);
  assert.equal(evening.nightEnd, astro.tomorrow.sunrise);
  assert.ok(evening.nightProgress > 0 && evening.nightProgress < .1);
  assert.equal(solarNightWindow(astro, day.sunset - minute).nightProgress, 0);
  assert.equal(solarNightWindow(astro, astro.tomorrow.sunrise + minute).nightProgress, 1);
  assert.equal(solarNightWindow({ today: day }, day.sunset + minute), null);
  assert.equal(solarNightWindow({ today: { sunrise: null, sunset: null } }, Date.now()), null);
});

test('the shared presentation preserves both layouts, independent video timelines and the unavailable state', () => {
  const now = day.sunset + 7 * minute;
  const phase = phaseAt(now);
  const astro = { today: day, tomorrow: { sunrise: day.sunrise + 86400000 } };
  const original = structuredClone({ phase, astro });
  const model = solarPresentation(phase, astro, now, (orb, variant) => ({ orb, variant }), 458.233333, 10);
  assert.equal(model.phase, 'sunset');
  assert.equal(model.starOpacity, 0);
  assert.equal(model.sun.active, true);
  assert.equal(model.moon.active, false);
  assert.equal(model.sun.opacity, phase.sunOpacity);
  assert.equal(model.sun.timeline.dayProgress, 1);
  assert.equal(model.sun.timeline.dayStart, day.sunrise);
  assert.equal(model.sun.timeline.dayEnd, day.sunset);
  assert.equal(model.sun.timeline.videoDurationSec, 10);
  assert.equal(model.moon.timeline.nightStart, day.sunset);
  assert.equal(model.moon.timeline.nightEnd, astro.tomorrow.sunrise);
  assert.equal(model.moon.timeline.videoDurationSec, 458.233333);
  for (const orb of ['moon', 'sun']) {
    assert.deepEqual(model[orb].previewLayout, { orb, variant: 'preview' });
    assert.deepEqual(model[orb].dropdownLayout, { orb, variant: 'dropdown' });
  }
  assert.deepEqual({ phase, astro }, original, 'presentation construction must not mutate events or phase');
  const unknown = solarPresentation(solarPhase(now, null, NaN, NaN), null, now, () => ({}), 458.233333, 10);
  assert.equal(unknown.phase, 'unavailable');
  assert.equal(unknown.sun.active || unknown.moon.active, false);
  assert.equal(unknown.starOpacity, 0);
  assert.ok(unknown.moon.timeline.nightProgress >= 0 && unknown.moon.timeline.nightProgress <= 1);
});

test('provider events retain explicit offsets and civil twilight, without fabricating noon for partial data', () => {
  assert.equal(day.source, 'api');
  assert.equal(day.sunset, Date.parse('2026-11-05T16:00:11Z'));
  assert.equal(day.civilTwilightEnd, Date.parse('2026-11-05T16:35:28Z'));
  assert.equal(day.civilTwilightBegin, Date.parse('2026-11-05T05:57:27Z'));
  const partial = structuredClone(provider);
  delete partial.results.solar_noon;
  delete partial.results.civil_twilight_begin;
  delete partial.results.civil_twilight_end;
  const normalized = normalizeSolarDay(partial, date, zone);
  assert.equal(normalized.sunset, day.sunset);
  assert.equal(normalized.solarNoon, null);
  assert.equal(normalized.civilTwilightBegin, null);
  assert.equal(normalized.civilTwilightEnd, null);
  const malformedOptional = structuredClone(provider);
  malformedOptional.results.solar_noon = 'not a date';
  malformedOptional.results.civil_twilight_begin = provider.results.sunset;
  malformedOptional.results.civil_twilight_end = provider.results.sunrise;
  const retained = normalizeSolarDay(malformedOptional, date, zone);
  assert.equal(retained.sunset, day.sunset);
  assert.equal(retained.solarNoon, null);
  assert.equal(retained.civilTwilightBegin, null);
  assert.equal(retained.civilTwilightEnd, null);
});

test('error responses, non-ISO dates, wrong calendar days and reversed events cannot become precise server events', () => {
  for (const value of [null, {}, { ...provider, status: 'INVALID_REQUEST' }]) assert.equal(normalizeSolarDay(value, date, zone), null);
  for (const value of ['not a date', '2026-11-05T17:00:11', '2026-11-06T17:00:11+01:00', '2026-11-05T07:00:00+01:00']) {
    const input = structuredClone(provider);
    input.results.sunset = value;
    assert.equal(normalizeSolarDay(input, date, zone), null, value);
  }
  assert.equal(normalizeSolarDay(provider, '2026-02-29', zone), null);
  assert.equal(normalizeSolarDay(provider, date, 'Invalid/Zone'), null);
  const overflow = structuredClone(provider);
  overflow.results.sunrise = '2026-02-30T07:32:44+01:00';
  overflow.results.sunset = '2026-03-02T17:00:11+01:00';
  assert.equal(normalizeSolarDay(overflow, '2026-03-02', zone), null, 'an invalid ISO calendar date must not roll into another date');
  const fractional = structuredClone(provider);
  fractional.results.sunset = '2026-11-05T17:00:11.1234567+01:00';
  assert.equal(normalizeSolarDay(fractional, date, zone).sunset, day.sunset + 123);
});

const usnoEvents = [
  ['sunrise', '07:33'], ['solarNoon', '12:16'], ['sunset', '17:00'],
  ['civilTwilightBegin', '06:57'], ['civilTwilightEnd', '17:35'],
];

test('the primary provider agrees with independent USNO public-city events at minute precision', () => {
  // https://aa.usno.navy.mil/api/rstt/oneday?date=2026-11-05&coords=51.23,6.78&tz=1&dst=false
  for (const [key, localTime] of usnoEvents) {
    const independent = Date.parse(`${date}T${localTime}:00+01:00`);
    assert.ok(Math.abs(day[key] - independent) <= minute, `${key}: API and minute-rounded USNO disagree`);
  }
});

test('the fractional-year fallback stays within three minutes for this independent USNO fixture', () => {
  // A failed one-minute expectation measured a 128s sunrise error. This bounded
  // regression fixture is not a universal accuracy claim for NOAA or all dates.
  const calculated = calculateSolarDay(date, zone, latitude, longitude);
  assert.equal(calculated.source, 'calculated');
  const comparisons = usnoEvents.map(([key, localTime]) => {
    const independent = Date.parse(`${date}T${localTime}:00+01:00`);
    return { key, usnoMinute: localTime, fallbackUtc: new Date(calculated[key]).toISOString(), differenceSeconds: (calculated[key] - independent) / 1000 };
  });
  assert.ok(comparisons.every(row => Math.abs(row.differenceSeconds) <= 180), JSON.stringify(comparisons));
});

test('sunset does not switch to Moon at the provider instant or seven minutes later', () => {
  assert.equal(phaseAt(day.sunset - 1).phase, 'day');
  const exact = phaseAt(day.sunset);
  assert.equal(exact.phase, 'sunset');
  assert.equal(exact.sunOpacity, 1);
  assert.equal(exact.moonOpacity, 0);
  assert.equal(exact.starOpacity, 0);
  const following = phaseAt(day.sunset + 1);
  assert.ok(Math.abs(following.sunOpacity - exact.sunOpacity) < 1e-8);
  const sevenMinutes = phaseAt(day.sunset + 7 * minute);
  assert.equal(sevenMinutes.phase, 'sunset');
  assert.ok(sevenMinutes.sunOpacity > .8);
  assert.equal(sevenMinutes.moonOpacity, 0);
  assert.equal(sevenMinutes.starOpacity, 0);
  assert.equal(sevenMinutes.dayProgress, 1, 'afterglow must not jump back to a sunrise frame');
  assert.equal(sevenMinutes.source, 'api');
  const middle = phaseAt((day.sunset + day.civilTwilightEnd) / 2);
  assert.equal(middle.phase, 'sunset');
  assert.ok(middle.sunOpacity > .5 && middle.sunOpacity < .7);
  assert.equal(middle.moonOpacity, 0);
});

test('civil dusk is bounded, monotonic and continuous into night; server events take priority', () => {
  let previous = phaseAt(day.sunset);
  for (let index = 1; index <= 100; index += 1) {
    const next = phaseAt(day.sunset + (day.civilTwilightEnd - day.sunset) * index / 100);
    bounded(next);
    assert.ok(next.sunOpacity <= previous.sunOpacity);
    assert.ok(next.moonOpacity >= previous.moonOpacity);
    assert.ok(next.starOpacity >= previous.starOpacity);
    assert.equal(next.dayProgress, 1);
    previous = next;
  }
  const end = phaseAt(day.civilTwilightEnd);
  assert.deepEqual([end.phase, end.sunOpacity, end.moonOpacity, end.starOpacity], ['night', 0, 1, 1]);
  for (const delta of [-1, 1]) {
    const sample = phaseAt(day.civilTwilightEnd + delta);
    bounded(sample);
    assert.ok(Math.abs(sample.moonOpacity - end.moonOpacity) < 1e-8);
    assert.ok(Math.abs(sample.sunOpacity - end.sunOpacity) < 1e-8);
  }
  const noCoordinates = solarPhase(day.sunset + 7 * minute, day, NaN, NaN);
  assert.equal(noCoordinates.phase, 'sunset');
  assert.equal(noCoordinates.source, 'api');
  assert.ok(noCoordinates.sunOpacity > .8, 'validated server events do not depend on another approximate horizon calculation');
});

test('civil dawn mirrors the transition and noon remains completely daytime', () => {
  assert.equal(phaseAt(day.civilTwilightBegin - 1).phase, 'night');
  const start = phaseAt(day.civilTwilightBegin);
  assert.deepEqual([start.phase, start.sunOpacity, start.moonOpacity, start.starOpacity], ['dawn', 0, 1, 1]);
  const middle = phaseAt((day.civilTwilightBegin + day.sunrise) / 2);
  assert.equal(middle.phase, 'dawn');
  assert.ok(middle.sunOpacity > .5);
  assert.equal(middle.moonOpacity, 0);
  const beforeRise = phaseAt(day.sunrise - 1);
  const rise = phaseAt(day.sunrise);
  assert.ok(Math.abs(beforeRise.sunOpacity - rise.sunOpacity) < 1e-8);
  for (const time of [day.sunrise, day.solarNoon, day.sunset - 1]) {
    const sample = phaseAt(time);
    assert.equal(sample.phase, 'day');
    assert.deepEqual([sample.sunOpacity, sample.moonOpacity, sample.starOpacity], [1, 0, 0]);
    bounded(sample);
  }
});

test('missing twilight falls back to actual elevation, and stale data never imposes a fixed 06:00/19:00 day', () => {
  const partial = { ...day, civilTwilightBegin: null, civilTwilightEnd: null };
  const afterSunset = solarPhase(day.sunset + 7 * minute, partial, latitude, longitude);
  assert.equal(afterSunset.phase, 'sunset');
  assert.equal(afterSunset.source, 'calculated');
  assert.ok(afterSunset.sunOpacity > .5);
  const stale = solarPhase(Date.parse('2026-11-06T12:00:00Z'), day, latitude, longitude);
  assert.equal(stale.phase, 'day');
  assert.equal(stale.source, 'calculated');
  assert.ok(stale.dayProgress > .4 && stale.dayProgress < .7, 'yesterday\'s completed day must not pin today\'s noon progress to 1');
  const remoteNight = solarPhase(Date.parse('2026-11-05T14:00:00Z'), null, 35.68, 139.69);
  assert.equal(remoteNight.phase, 'night', 'Tokyo night must not be guessed from a browser afternoon hour');
});

test('a provider day expires at solar midnight before the next summer sunrise', () => {
  for (const [dateString, timeZone, lat, lon] of [
    ['2026-06-21', 'Europe/Berlin', latitude, longitude],
    ['2026-12-21', 'Europe/Berlin', latitude, longitude],
    ['2026-12-21', 'Australia/Sydney', -33.8688, 151.2093],
  ]) {
    const previous = { ...calculateSolarDay(dateString, timeZone, lat, lon), source: 'api' };
    const nextDate = new Date(Date.parse(`${dateString}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const next = calculateSolarDay(nextDate, timeZone, lat, lon);
    const morning = next.sunrise + 2 * 3600000;
    const actual = solarPhase(morning, previous, lat, lon);
    assert.equal(actual.phase, 'day', `${dateString}: yesterday cannot hide an already risen Sun`);
    assert.equal(actual.source, 'calculated');
    assert.deepEqual(actual, solarPhase(morning, null, lat, lon));
    for (const boundary of [previous.solarNoon - 43200000, previous.solarNoon + 43200000]) {
      const before = solarPhase(boundary - 1, previous, lat, lon);
      const after = solarPhase(boundary + 1, previous, lat, lon);
      for (const key of ['sunOpacity', 'moonOpacity', 'starOpacity']) {
        assert.ok(Math.abs(before[key] - after[key]) < 1e-6, `${dateString}: ${key} stays continuous at solar midnight`);
      }
    }
    const midpoint = (previous.sunrise + previous.sunset) / 2;
    for (const solarNoon of [null, NaN, previous.sunrise - 1, previous.sunset + 1]) {
      const invalidNoon = { ...previous, solarNoon };
      assert.equal(solarPhase(midpoint, invalidNoon, lat, lon).source, 'api');
      assert.equal(solarPhase(midpoint + 43200000, invalidNoon, lat, lon).source, 'calculated');
    }
  }
  for (const time of ['2026-06-21T00:00:00Z', '2026-12-21T12:00:00Z']) {
    const polar = { sunrise: null, sunset: null, solarNoon: Date.parse(time), source: 'api' };
    assert.deepEqual(solarPhase(Date.parse(time), polar, 69.6492, 18.9553),
      solarPhase(Date.parse(time), null, 69.6492, 18.9553));
  }
});

test('crossings are filtered to the requested IANA local date across UTC midnight and DST', () => {
  for (const [target, timeZone, lat, lng] of [
    [date, 'Pacific/Kiritimati', 1.87, -157.43],
    [date, 'America/Adak', 51.88, -176.65],
    ['2026-10-24', zone, latitude, longitude],
    ['2026-10-25', zone, latitude, longitude],
  ]) {
    const calculated = calculateSolarDay(target, timeZone, lat, lng);
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    for (const key of ['sunrise', 'sunset', 'solarNoon', 'civilTwilightBegin', 'civilTwilightEnd']) {
      assert.ok(Number.isFinite(calculated[key]), `${timeZone} ${key}`);
      const parts = Object.fromEntries(formatter.formatToParts(new Date(calculated[key])).map(part => [part.type, part.value]));
      assert.equal(`${parts.year}-${parts.month}-${parts.day}`, target, `${timeZone} ${key}`);
    }
  }
  const before = calculateSolarDay('2026-10-24', zone, latitude, longitude);
  const after = calculateSolarDay('2026-10-25', zone, latitude, longitude);
  assert.ok(Math.abs(after.sunset - before.sunset - 86400000) < 5 * minute, 'DST cannot insert an artificial hour into the UTC ephemeris');
});

test('polar day and night retain null crossings and use solar height rather than fabricated hours', () => {
  for (const [target, expected] of [['2026-06-21', 'day'], ['2026-12-21', 'night']]) {
    const polar = calculateSolarDay(target, 'UTC', 90, 0);
    assert.equal(polar.sunrise, null);
    assert.equal(polar.sunset, null);
    assert.equal(polar.civilTwilightBegin, null);
    assert.equal(polar.civilTwilightEnd, null);
    for (const hour of ['00', '06', '12', '18']) {
      const sample = solarPhase(Date.parse(`${target}T${hour}:00:00Z`), polar, 90, 0);
      assert.equal(sample.phase, expected);
      assert.equal(sample.source, 'calculated');
      bounded(sample);
    }
  }
  const winter = calculateSolarDay('2026-12-21', 'Europe/Oslo', 69.65, 18.96);
  assert.equal(winter.sunrise, null);
  assert.equal(winter.sunset, null);
  assert.ok(Number.isFinite(winter.civilTwilightBegin) && Number.isFinite(winter.civilTwilightEnd), 'polar night can still have civil twilight');
});

test('invalid inputs remain unavailable with finite weights; zero coordinates are valid', () => {
  for (const [target, timeZone, lat, lng] of [[date, 'Invalid/Zone', latitude, longitude], ['2026-02-29', zone, latitude, longitude], [date, zone, 91, longitude], [date, zone, latitude, 181]]) {
    assert.equal(calculateSolarDay(target, timeZone, lat, lng), null);
  }
  for (const now of [NaN, Infinity]) {
    const sample = solarPhase(now, day, latitude, longitude);
    assert.equal(sample.phase, 'unavailable');
    bounded(sample);
  }
  const unknown = solarPhase(Date.now(), null, NaN, NaN);
  assert.equal(unknown.phase, 'unavailable');
  bounded(unknown);
  assert.ok(Number.isNaN(solarPosition(Date.now(), 91, 0).elevationDeg));
  const equator = calculateSolarDay(date, 'UTC', 0, 0);
  assert.ok(Number.isFinite(equator.sunrise) && Number.isFinite(equator.sunset));
});

test('3D stars follow winter and summer solar time rather than a fixed 19:00 boundary', async () => {
  const resolve = await sceneClock;
  const weather = { location: { lat: latitude, lon: longitude }, current: { is_day: 1 } };
  const winter = resolve(weather, Date.parse('2026-11-05T18:00:00+01:00'));
  assert.equal(winter.phase, 'night', 'winter night begins before 19:00');
  assert.equal(winter.starOpacity, 1);
  const summer = resolve(weather, Date.parse('2026-06-21T20:30:00+02:00'));
  assert.equal(summer.phase, 'day', 'summer daylight continues after 19:00');
  assert.equal(summer.starOpacity, 0);
});

test('3D star visibility follows twilight smoothly and ignores an older observation clock', async () => {
  const resolve = await sceneClock;
  const weather = {
    location: { localtime: '2026-11-05 12:00', lat: latitude, lon: longitude },
    current: { is_day: 1, last_updated_epoch: Date.parse('2026-11-05T12:00:00+01:00') / 1000 },
  };
  const values = ['17:00', '17:10', '17:20', '17:30', '17:40'].map(time =>
    resolve(weather, Date.parse(`2026-11-05T${time}:00+01:00`)).starOpacity);
  assert.equal(values[0], 0);
  assert.equal(values.at(-1), 1);
  assert.ok(values.some(value => value > 0 && value < 1));
  assert.ok(values.every((value, index) => index === 0 || value >= values[index - 1]));
  assert.equal(resolve(weather, Date.parse('2026-11-05T22:00:00+01:00')).phase, 'night');
});

test('3D forecast appearance uses its explicit projection time without relabelling the observation', async () => {
  const resolve = await sceneClock;
  const observedAt = Date.parse('2026-11-05T21:30:00+01:00');
  const weather = {
    location: { lat: latitude, lon: longitude },
    current: { is_day: 0, last_updated_epoch: observedAt / 1000 },
    weatherMeta: { observedAt, appearanceTimeMs: Date.parse('2026-11-06T12:00:00+01:00') },
  };
  const phase = resolve(weather, Date.parse('2026-11-05T22:00:00+01:00'));
  assert.equal(phase.phase, 'day');
  assert.equal(phase.starOpacity, 0);
  assert.equal(weather.weatherMeta.observedAt, observedAt);
  assert.equal(weather.current.last_updated_epoch, observedAt / 1000);
});

test('3D sky accepts numeric coordinates but does not turn missing coordinates into zero', async () => {
  const resolve = await sceneClock;
  const now = Date.parse('2026-06-21T20:30:00+02:00');
  assert.equal(resolve({ weatherMeta: { latitude: '51.23', longitude: '6.78' } }, now).phase, 'day');
  const unknown = resolve({ location: { lat: null, lon: '' }, current: { is_day: 0 } }, now);
  assert.equal(unknown.phase, 'night', 'with no coordinates use the explicit provider flag, not Greenwich');
  assert.equal(resolve({ current: { is_day: 1 } }, now).starOpacity, 0);
});

test('3D uses the synchronized primary solar presentation when the device clock is wrong', async () => {
  const resolve = await sceneClock;
  const weather = { location: { lat: latitude, lon: longitude }, current: { is_day: 1 } };
  const wrongDeviceTime = Date.parse('2026-11-05T16:00:00+01:00');
  const synchronized = phaseAt(Date.parse('2026-11-05T18:00:00+01:00'));
  assert.equal(resolve(weather, wrongDeviceTime).phase, 'day');
  assert.equal(resolve(weather, wrongDeviceTime, synchronized), synchronized);
  const forecast = { ...weather, weatherMeta: { appearanceTimeMs: Date.parse('2026-11-06T12:00:00+01:00') } };
  assert.equal(resolve(forecast, wrongDeviceTime, synchronized).phase, 'day', 'an explicit forecast projection stays independent of the current night');
});

// Independent JPL Horizons observer ephemerides fetched2026-11-06, not generated
// by the production orbit. Public city sites, sea-level WGS84, AIRLESS, quantity4.
// Query contract: https://ssd-api.jpl.nasa.gov/doc/horizons.html
// Raw responses/URLs: output/solar-cycle-2026-11-06/sky-v7/horizons-reference.json.
const lunarReferences = [
  [51.23, 6.78, '2026-11-06T00:00:00Z', 58.344770700, -29.444577461, 390133.25026],
  [51.23, 6.78, '2026-11-06T06:00:00Z', 132.170239087, 20.263102055, 385632.43889],
  [51.23, 6.78, '2026-11-06T12:00:00Z', 226.360427015, 19.327078403, 386585.14883],
  [51.23, 6.78, '2026-11-06T18:00:00Z', 298.101213859, -32.642976794, 393006.86441],
  [-33.8688, 151.2093, '2026-03-20T00:00:00Z', 51.187445827, 32.680014947, 366764.49549],
  [-33.8688, 151.2093, '2026-03-20T12:00:00Z', 252.707042897, -42.021915455, 373252.94829],
  [-33.8688, 151.2093, '2026-06-21T12:00:00Z', 283.910890743, 18.732749762, 384004.61117],
  [-33.8688, 151.2093, '2026-12-21T00:00:00Z', 122.170437647, -69.874215910, 373023.50667],
  [69.6492, 18.9553, '2026-06-21T00:00:00Z', 298.558061852, -7.723989390, 383952.74085],
  [69.6492, 18.9553, '2026-06-21T12:00:00Z', 112.492937275, 7.192707575, 385249.57876],
  [69.6492, 18.9553, '2026-12-21T00:00:00Z', 255.354803475, 27.452230745, 364065.52696],
  [69.6492, 18.9553, '2026-12-21T12:00:00Z', 53.691017605, 11.283414976, 363106.86591],
];
const angleDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// Same public sites/UTC instants, independently queried Horizons target10(Sun).
// NOAA fractional-year remains deliberately approximate and preserves palette.
const solarReferences = [
  [17.821786001, -53.628052625], [108.394161362, -5.810271787],
  [191.278003391, 22.032961750], [268.007500315, -19.282024478],
  [47.009878662, 45.757139022], [226.717649609, -45.553201229],
  [255.505128413, -62.422159850], [74.523760229, 63.219897132],
  [16.994865360, 4.033806020], [203.256737115, 42.491953402],
  [24.483683939, -42.351531413], [197.826790608, -4.132762949],
];

test('the preserved NOAA Sun model and its azimuth stay within the bounded independent JPL fixtures', () => {
  for (let index = 0; index < lunarReferences.length; index++) {
    const [lat, lon, iso] = lunarReferences[index], [azimuth, elevation] = solarReferences[index];
    const actual = solarPosition(Date.parse(iso), lat, lon);
    assert.ok(angleDifference(actual.azimuthDeg, azimuth) < .65, `${iso}: azimuth${actual.azimuthDeg}/${azimuth}`);
    assert.ok(Math.abs(actual.elevationDeg - elevation) < .65, `${iso}: elevation${actual.elevationDeg}/${elevation}`);
  }
});

test('the independent lunar orbit agrees with twelve airless topocentric JPL public-city fixtures', () => {
  for (const [lat, lon, iso, azimuth, elevation, distance] of lunarReferences) {
    const actual = moonPosition(Date.parse(iso), lat, lon);
    assert.ok(angleDifference(actual.azimuthDeg, azimuth) < .08, `${iso}: azimuth${actual.azimuthDeg}/${azimuth}`);
    assert.ok(Math.abs(actual.elevationDeg - elevation) < .08, `${iso}: elevation${actual.elevationDeg}/${elevation}`);
    assert.ok(Math.abs(actual.distanceKm - distance) < 500, `${iso}: distance${actual.distanceKm}/${distance}`);
    assert.ok(actual.hourAngleDeg >= -180 && actual.hourAngleDeg <= 180);
  }
});

test('the Moon follows its own horizon and may be visible during day but absent at night', () => {
  const daytime = Date.parse('2026-11-06T12:00:00Z'), nighttime = Date.parse('2026-11-06T18:00:00Z');
  assert.ok(solarPosition(daytime, 51.23, 6.78).elevationDeg > 0);
  assert.ok(solarPosition(nighttime, 51.23, 6.78).elevationDeg < -6);
  assert.equal(projectSkyPosition(moonPosition(daytime, 51.23, 6.78)).visible, true);
  assert.equal(projectSkyPosition(moonPosition(nighttime, 51.23, 6.78)).visible, false);
  assert.equal(projectSkyPosition(solarPosition(nighttime, 51.23, 6.78)).visible, false);
});

test('the overhead dome separates all compass bearings and stays continuous through zenith and north', () => {
  assert.ok(projectSkyPosition({ elevationDeg: 0, azimuthDeg: 90 }).x < 1e-12);
  assert.ok(Math.abs(projectSkyPosition({ elevationDeg: 0, azimuthDeg: 270 }).x - 1) < 1e-12);
  const zenithEast = projectSkyPosition({ elevationDeg: 89.999, azimuthDeg: 90 });
  const zenithWest = projectSkyPosition({ elevationDeg: 89.999, azimuthDeg: 270 });
  assert.ok(Math.abs(zenithEast.x - zenithWest.x) < .00002, 'azimuth can flip at zenith without moving the screen position');
  assert.ok(Math.abs(zenithEast.y - .5) < 1e-8 && Math.abs(zenithWest.y - .5) < 1e-8);
  const north = projectSkyPosition({ elevationDeg: 0, azimuthDeg: 0 });
  const south = projectSkyPosition({ elevationDeg: 0, azimuthDeg: 180 });
  assert.ok(Math.abs(north.x - .5) < 1e-12 && north.y < 1e-12);
  assert.ok(Math.abs(south.x - .5) < 1e-12 && Math.abs(south.y - 1) < 1e-12);
  const northBefore = projectSkyPosition({ elevationDeg: 30, azimuthDeg: 359.999 });
  const northAfter = projectSkyPosition({ elevationDeg: 30, azimuthDeg: .001 });
  assert.ok(Math.abs(northBefore.x - northAfter.x) < .00002);
  let previous = 0;
  for (let i = -90; i <= 90; i++) for (let azimuth = 0; azimuth <= 360; azimuth += 15) {
    const point = projectSkyPosition({ elevationDeg: i, azimuthDeg: azimuth });
    for (const value of [point.x, point.y, point.horizonOpacity]) assert.ok(value >= 0 && value <= 1);
    assert.ok(Math.abs(point.east ** 2 + point.north ** 2 + point.up ** 2 - 1) < 1e-12);
    assert.ok(Math.hypot(point.x - .5, point.y - .5) <= .5 + 1e-12);
    assert.equal(point.belowHorizon, i < 0);
    assert.equal(point.elevationDeg, i, 'the boundary marker must not falsify the real altitude');
    if (i < 0) assert.ok(Math.abs(Math.hypot(point.x - .5, point.y - .5) - .5) < 1e-12);
  }
  for (let i = 0; i <= 300; i++) {
    const point = projectSkyPosition({ elevationDeg: -1 + i / 200, azimuthDeg: 90 });
    assert.ok(point.horizonOpacity >= previous && point.horizonOpacity - previous < .006);
    previous = point.horizonOpacity;
  }
  assert.equal(previous, 1);
});

test('stereographic dome is invertible over the whole visible hemisphere without north-south aliasing', () => {
  for (let altitude = 0; altitude < 90; altitude += 3) for (let azimuth = 0; azimuth < 360; azimuth += 3) {
    const p = projectSkyPosition({ elevationDeg: altitude, azimuthDeg: azimuth });
    const east = 1 - 2 * p.x, north = 1 - 2 * p.y, r = Math.hypot(east, north);
    const recoveredAltitude = 90 - 2 * Math.atan(r) * 180 / Math.PI;
    const recoveredAzimuth = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
    assert.ok(Math.abs(recoveredAltitude - altitude) < 1e-10);
    assert.ok(angleDifference(recoveredAzimuth, azimuth) < 1e-10);
  }
});

test('lunar and solar screen positions remain continuous at midnight, leap day and both Berlin DST boundaries', () => {
  const pairs = [
    ['2026-11-06T23:59:59Z', '2026-11-07T00:00:00Z'],
    ['2024-02-28T23:59:59Z', '2024-02-29T00:00:00Z'],
    ['2024-02-29T23:59:59Z', '2024-03-01T00:00:00Z'],
    ['2026-03-29T01:59:59+01:00', '2026-03-29T03:00:00+02:00'],
    ['2026-10-25T02:59:59+02:00', '2026-10-25T02:00:00+01:00'],
    ['2026-12-31T23:59:59Z', '2027-01-01T00:00:00Z'],
  ];
  for (const position of [solarPosition, moonPosition]) for (const [before, after] of pairs) {
    const leftMs = Date.parse(before), rightMs = Date.parse(after);
    assert.equal(rightMs - leftMs, 1000);
    const left = position(leftMs, 51.23, 6.78), right = position(rightMs, 51.23, 6.78);
    assert.ok(Math.abs(left.elevationDeg - right.elevationDeg) < .01);
    const a = projectSkyPosition(left), b = projectSkyPosition(right);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < .0002, `${position.name}: ${before}/${after}`);
  }
});

test('solar and lunar paths handle polar day/night and reject missing or malformed coordinates', () => {
  const summer = Date.parse('2026-06-21T00:00:00Z'), winter = Date.parse('2026-12-21T12:00:00Z');
  assert.ok(solarPosition(summer, 69.6492, 18.9553).elevationDeg > 0);
  assert.equal(projectSkyPosition(solarPosition(summer, 69.6492, 18.9553)).visible, true);
  assert.ok(solarPosition(winter, 69.6492, 18.9553).elevationDeg < -1);
  assert.equal(projectSkyPosition(solarPosition(winter, 69.6492, 18.9553)).visible, false);
  for (const position of [solarPosition, moonPosition]) {
    for (const values of [[summer, NaN, 0], [summer, null, 0], [summer, 0, ''], [summer, 91, 0], [summer, 0, -181], [Infinity, 0, 0], [1e20, 0, 0]]) {
      const invalid = position(...values);
      assert.ok(Number.isNaN(invalid.elevationDeg)); assert.ok(Number.isNaN(invalid.azimuthDeg));
      assert.equal(projectSkyPosition(invalid).visible, false);
    }
    for (const lat of [-90, 0, 90]) for (const lon of [-180, 0, 180]) {
      const point = position(summer, lat, lon);
      assert.ok(Number.isFinite(point.elevationDeg) && Number.isFinite(point.azimuthDeg));
      assert.ok(point.azimuthDeg >= 0 && point.azimuthDeg < 360);
    }
  }
});


// Counterexamples for the former five-minute sign-only scan: brief polar
// maxima and minima cross the same threshold twice between sampled instants.
test('grazing polar horizon and civil twilight retain both crossings shorter than a minute', () => {
  for (const [targetDate, lat, lng, threshold] of [["2026-12-21",67.4131147581935,0,-0.833],["2026-12-21",72.58011475822082,0,-6],["2026-06-21",65.71493751856596,180,-0.833],["2026-06-21",60.54793751377835,180,-6]]) {
    const actual = calculateSolarDay(targetDate, 'UTC', lat, lng);
    const keys = threshold === -.833 ? ['sunrise', 'sunset'] : ['civilTwilightBegin', 'civilTwilightEnd'];
    for (const [index, key] of keys.entries()) {
      const event = actual[key];
      assert.ok(Number.isFinite(event), key + ' ' + lat + '/' + lng);
      const before = solarPosition(event - 1000, lat, lng).elevationDeg;
      const after = solarPosition(event + 1000, lat, lng).elevationDeg;
      assert.ok(index === 0 ? before < threshold && after > threshold : before > threshold && after < threshold, key + ' must cross in its actual direction');
      assert.ok(Math.abs(solarPosition(event, lat, lng).elevationDeg - threshold) < 1e-6);
      assert.equal(new Date(event).toISOString().slice(0, 10), targetDate);
    }
    const duration = Math.abs(actual[keys[1]] - actual[keys[0]]);
    assert.ok(duration > 15000 && duration < 60000, 'this regression must remain shorter than the old scan interval');
  }
});

test('grazing refinement does not fabricate events on the polar side of the tangent', () => {
  for (const [targetDate, lat, lng, threshold] of [["2026-12-21",67.4131147581935,0,-0.833],["2026-12-21",72.58011475822082,0,-6],["2026-06-21",65.71493751856596,180,-0.833],["2026-06-21",60.54793751377835,180,-6]]) {
    const actual = calculateSolarDay(targetDate, 'UTC', lat + .001, lng);
    const keys = threshold === -.833 ? ['sunrise', 'sunset'] : ['civilTwilightBegin', 'civilTwilightEnd'];
    for (const key of keys) assert.equal(actual[key], null, key + ' ' + lat + '/' + lng);
  }
});
