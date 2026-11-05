import test from 'node:test';
import assert from 'node:assert/strict';
import { solarPosition, normalizeSolarDay, calculateSolarDay, solarPhase, solarNightWindow, solarPresentation } from '../assets/js/weather-solar-time.js';

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
