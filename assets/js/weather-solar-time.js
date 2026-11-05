/** Shared solar clock. NOAA fractional-year approximation is a local fallback,
 * not a replacement for validated provider events or a precision ephemeris.
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
const CLOCK_TAU = Math.PI * 2;
const CLOCK_DAY_MS = 86400000;
const CLOCK_HORIZON_DEG = -0.833;
const CLOCK_CIVIL_DEG = -6;

export function solarPosition(timeMs, latitude, longitude) {
  const unavailable = { elevationDeg: NaN, hourAngleDeg: NaN };
  if (!Number.isFinite(timeMs) || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return unavailable;
  const date = new Date(timeMs);
  const year = date.getUTCFullYear();
  if (!Number.isFinite(year)) return unavailable;
  const start = Date.UTC(year, 0, 1);
  const yearDays = (Date.UTC(year + 1, 0, 1) - start) / CLOCK_DAY_MS;
  const dayOfYear = Math.floor((timeMs - start) / CLOCK_DAY_MS) + 1;
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes()
    + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
  const gamma = CLOCK_TAU / yearDays * (dayOfYear - 1 + (minutes / 60 - 12) / 24);
  const equationMinutes = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const solarMinutes = ((minutes + equationMinutes + 4 * longitude) % 1440 + 1440) % 1440;
  const hourAngleDeg = solarMinutes / 4 - 180;
  const hourAngle = hourAngleDeg * Math.PI / 180;
  const latitudeRad = latitude * Math.PI / 180;
  const sineElevation = Math.sin(latitudeRad) * Math.sin(declination)
    + Math.cos(latitudeRad) * Math.cos(declination) * Math.cos(hourAngle);
  return { elevationDeg: Math.asin(Math.max(-1, Math.min(1, sineElevation))) * 180 / Math.PI, hourAngleDeg };
}

function solarDateFormatter(dateString, timeZone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString || '')) return null;
  const stamp = Date.parse(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== dateString) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    return timeMs => {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(timeMs)).map(part => [part.type, part.value]));
      return `${parts.year}-${parts.month}-${parts.day}`;
    };
  } catch {
    return null;
  }
}

function solarIsoTime(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/);
  if (!match) return null;
  const date = match[1].slice(0, 10);
  const dateMs = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(dateMs) || new Date(dateMs).toISOString().slice(0, 10) !== date
    || Number(match[1].slice(11, 13)) >= 24) return null;
  const fraction = match[2] ? `.${match[2].padEnd(3, '0').slice(0, 3)}` : '';
  const stamp = Date.parse(`${match[1]}${fraction}${match[3]}`);
  return Number.isFinite(stamp) ? stamp : null;
}

export function normalizeSolarDay(payload, dateString, timeZone = 'UTC') {
  const localDate = solarDateFormatter(dateString, timeZone);
  if (!localDate || payload?.status !== 'OK') return null;
  const results = payload.results;
  const sunrise = solarIsoTime(results?.sunrise);
  const sunset = solarIsoTime(results?.sunset);
  const noon = solarIsoTime(results?.solar_noon);
  if (![sunrise, sunset].every(Number.isFinite) || sunrise >= sunset
    || [sunrise, sunset].some(time => localDate(time) !== dateString)) return null;
  const solarNoon = Number.isFinite(noon) && sunrise < noon && noon < sunset && localDate(noon) === dateString ? noon : null;
  const civilBegin = solarIsoTime(results.civil_twilight_begin);
  const civilEnd = solarIsoTime(results.civil_twilight_end);
  return {
    date: dateString, sunrise, sunset, solarNoon,
    civilTwilightBegin: Number.isFinite(civilBegin) && civilBegin < sunrise && localDate(civilBegin) === dateString ? civilBegin : null,
    civilTwilightEnd: Number.isFinite(civilEnd) && civilEnd > sunset && localDate(civilEnd) === dateString ? civilEnd : null,
    source: 'api',
  };
}

function solarCrossing(left, right, target, valueAt) {
  let leftValue = valueAt(left) - target;
  if (leftValue === 0) return left;
  for (let iteration = 0; iteration < 24 && right - left > 100; iteration += 1) {
    const middle = (left + right) / 2;
    const value = valueAt(middle) - target;
    if ((value >= 0) === (leftValue >= 0)) {
      left = middle;
      leftValue = value;
    } else right = middle;
  }
  return Math.round(right);
}

export function calculateSolarDay(dateString, timeZone = 'UTC', latitude, longitude) {
  const localDate = solarDateFormatter(dateString, timeZone);
  const dayStart = Date.parse(`${dateString}T00:00:00Z`);
  if (!localDate || !Number.isFinite(solarPosition(dayStart, latitude, longitude).elevationDeg)) return null;
  const result = { date: dateString, sunrise: null, sunset: null, solarNoon: null,
    civilTwilightBegin: null, civilTwilightEnd: null, source: 'calculated' };
  const position = time => solarPosition(time, latitude, longitude);
  const elevation = time => position(time).elevationDeg;
  const hourAngle = time => position(time).hourAngleDeg;
  const step = 5 * 60000;
  let left = dayStart - 18 * 3600000;
  let prior = position(left);
  for (let right = left + step; right <= dayStart + 42 * 3600000; right += step) {
    const next = position(right);
    for (const [target, risingKey, fallingKey] of [
      [CLOCK_HORIZON_DEG, 'sunrise', 'sunset'],
      [CLOCK_CIVIL_DEG, 'civilTwilightBegin', 'civilTwilightEnd'],
    ]) {
      const rising = prior.elevationDeg <= target && next.elevationDeg > target;
      const falling = prior.elevationDeg >= target && next.elevationDeg < target;
      if (rising || falling) {
        const event = solarCrossing(left, right, target, elevation);
        if (localDate(event) === dateString) result[rising ? risingKey : fallingKey] = event;
      }
    }
    if (prior.hourAngleDeg <= 0 && next.hourAngleDeg > 0 && next.hourAngleDeg - prior.hourAngleDeg < 180) {
      const event = solarCrossing(left, right, 0, hourAngle);
      if (localDate(event) === dateString) result.solarNoon = event;
    }
    left = right;
    prior = next;
  }
  return result;
}

export function solarNightWindow(astroData, nowMs) {
  if (!astroData?.today?.sunrise || !astroData?.today?.sunset) return null;
  const beforeSunrise = nowMs < astroData.today.sunrise;
  const nightStart = beforeSunrise ? astroData.yesterday?.sunset : astroData.today.sunset;
  const nightEnd = beforeSunrise ? astroData.today.sunrise : astroData.tomorrow?.sunrise;
  if (!Number.isFinite(nightStart) || !Number.isFinite(nightEnd) || nightEnd <= nightStart) return null;
  const nightDuration = nightEnd - nightStart;
  return { nightStart, nightEnd, nightDuration, nightProgress: solarUnit((nowMs - nightStart) / Math.max(nightDuration, 1)) };
}

function solarUnit(value) {
  return Math.max(0, Math.min(1, value));
}

export function solarPresentation(phase, astroData, nowMs, layout, moonDuration, sunDuration) {
  const { moonOpacity, sunOpacity } = phase;
  const nightWindow = solarNightWindow(astroData, nowMs);
  return {
    phase: phase.phase,
    starOpacity: phase.starOpacity,
    moon: {
      active: moonOpacity > 0.02,
      opacity: moonOpacity,
      previewLayout: layout('moon', 'preview'),
      dropdownLayout: layout('moon', 'dropdown'),
      timeline: {
        ...nightWindow,
        nightProgress: nightWindow?.nightProgress ?? ((nowMs % CLOCK_DAY_MS + CLOCK_DAY_MS) % CLOCK_DAY_MS) / CLOCK_DAY_MS,
        videoDurationSec: moonDuration,
      },
    },
    sun: {
      active: sunOpacity > 0.02,
      opacity: sunOpacity,
      previewLayout: layout('sun', 'preview'),
      dropdownLayout: layout('sun', 'dropdown'),
      timeline: {
        dayStart: astroData?.today?.sunrise,
        dayEnd: astroData?.today?.sunset,
        dayProgress: phase.dayProgress,
        videoDurationSec: sunDuration,
      },
    },
    dominantKind: sunOpacity >= moonOpacity ? 'sun' : 'moon',
  };
}

function solarSmooth(low, high, value) {
  const weight = solarUnit((value - low) / (high - low));
  return weight * weight * (3 - 2 * weight);
}

function solarTransition(phase, progress) {
  const p = solarUnit(progress);
  if (phase === 'sunset') return {
    sunOpacity: 1 - solarSmooth(.1, 1, p),
    moonOpacity: solarSmooth(.75, 1, p),
    starOpacity: solarSmooth(.5, 1, p),
  };
  return {
    sunOpacity: 1 - solarSmooth(.1, 1, 1 - p),
    moonOpacity: solarSmooth(.75, 1, 1 - p),
    starOpacity: solarSmooth(.5, 1, 1 - p),
  };
}

export function solarPhase(nowMs, day, latitude, longitude) {
  const position = solarPosition(nowMs, latitude, longitude);
  const { elevationDeg, hourAngleDeg } = position;
  const orderedDay = Number.isFinite(day?.sunrise) && Number.isFinite(day?.sunset) && day.sunrise < day.sunset;
  const recentDay = orderedDay && nowMs >= day.sunrise - CLOCK_DAY_MS / 2 && nowMs <= day.sunset + CLOCK_DAY_MS / 2;
  const dayProgress = recentDay ? solarUnit((nowMs - day.sunrise) / (day.sunset - day.sunrise))
    : Number.isFinite(hourAngleDeg) ? solarUnit((hourAngleDeg + 180) / 360) : 0;
  const make = (phase, weights, source) => ({ phase, ...weights, dayProgress, elevationDeg, source });
  const dayWeights = { sunOpacity: 1, moonOpacity: 0, starOpacity: 0 };
  const nightWeights = { sunOpacity: 0, moonOpacity: 1, starOpacity: 1 };
  if (!Number.isFinite(nowMs)) return make('unavailable', { sunOpacity: 0, moonOpacity: 0, starOpacity: 0 }, 'unavailable');
  if (recentDay) {
    const source = day.source === 'api' ? 'api' : 'calculated';
    if (nowMs >= day.sunrise && nowMs < day.sunset) return make('day', dayWeights, source);
    const evening = nowMs >= day.sunset;
    const boundary = evening ? day.civilTwilightEnd : day.civilTwilightBegin;
    const validBoundary = Number.isFinite(boundary) && (evening ? boundary > day.sunset : boundary < day.sunrise);
    if (validBoundary) {
      if (evening && nowMs < boundary) return make('sunset', solarTransition('sunset', (nowMs - day.sunset) / (boundary - day.sunset)), source);
      if (!evening && nowMs >= boundary) return make('dawn', solarTransition('dawn', (nowMs - boundary) / (day.sunrise - boundary)), source);
      return make('night', nightWeights, source);
    }
    if (Number.isFinite(elevationDeg)) {
      if (elevationDeg <= CLOCK_CIVIL_DEG) return make('night', nightWeights, 'calculated');
      const duskProgress = (CLOCK_HORIZON_DEG - elevationDeg) / (CLOCK_HORIZON_DEG - CLOCK_CIVIL_DEG);
      return make(evening ? 'sunset' : 'dawn', solarTransition(evening ? 'sunset' : 'dawn', evening ? duskProgress : 1 - duskProgress), 'calculated');
    }
  }
  if (!Number.isFinite(elevationDeg)) return make('unavailable', { sunOpacity: 0, moonOpacity: 0, starOpacity: 0 }, 'unavailable');
  if (elevationDeg >= CLOCK_HORIZON_DEG) return make('day', dayWeights, 'calculated');
  if (elevationDeg <= CLOCK_CIVIL_DEG) return make('night', nightWeights, 'calculated');
  const phase = hourAngleDeg >= 0 ? 'sunset' : 'dawn';
  const duskProgress = (CLOCK_HORIZON_DEG - elevationDeg) / (CLOCK_HORIZON_DEG - CLOCK_CIVIL_DEG);
  return make(phase, solarTransition(phase, phase === 'sunset' ? duskProgress : 1 - duskProgress), 'calculated');
}
