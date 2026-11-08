/** Shared solar clock. NOAA fractional-year approximation is a local fallback,
 * not a replacement for validated provider events or a precision ephemeris.
 * https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
const CLOCK_TAU = Math.PI * 2;
const CLOCK_DAY_MS = 86400000;
const CLOCK_HORIZON_DEG = -0.833;
const CLOCK_CIVIL_DEG = -6;

export function solarPosition(timeMs, latitude, longitude) {
  const unavailable = { elevationDeg: NaN, azimuthDeg: NaN, hourAngleDeg: NaN };
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
  const east = -Math.cos(declination) * Math.sin(hourAngle);
  const north = Math.sin(declination) * Math.cos(latitudeRad)
    - Math.cos(declination) * Math.cos(hourAngle) * Math.sin(latitudeRad);
  const azimuthDeg = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
  return { elevationDeg: Math.asin(Math.max(-1, Math.min(1, sineElevation))) * 180 / Math.PI, azimuthDeg, hourAngleDeg };
}

// Low-precision lunar orbit plus its principal perturbations, Paul Schlyter:
// https://www.stjarnhimlen.se/comp/ppcomp.html (sections4,6,9,12–13).
// Airless topocentric centre at sea level; not a precision eclipse ephemeris.
export function moonPosition(timeMs, latitude, longitude) {
  const unavailable = { elevationDeg: NaN, azimuthDeg: NaN, hourAngleDeg: NaN, distanceKm: NaN };
  if (!Number.isFinite(timeMs) || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || !Number.isFinite(new Date(timeMs).getTime())) return unavailable;
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const days = timeMs / CLOCK_DAY_MS + 2440587.5 - 2451543.5;
  const angle = value => ((value % 360 + 360) % 360) * rad;
  const node = angle(125.1228 - .0529538083 * days);
  const inclination = 5.1454 * rad;
  const periapsis = angle(318.0634 + .1643573223 * days);
  const anomaly = angle(115.3654 + 13.0649929509 * days);
  const sunAnomaly = angle(356.0470 + .9856002585 * days);
  const sunLongitude = sunAnomaly + angle(282.9404 + .0000470935 * days);
  const lunarLongitude = anomaly + periapsis + node;
  const elongation = lunarLongitude - sunLongitude, argumentLatitude = lunarLongitude - node;
  const eccentricity = .0549;
  let eccentricAnomaly = anomaly + eccentricity * Math.sin(anomaly) * (1 + eccentricity * Math.cos(anomaly));
  for (let iteration = 0; iteration < 4; iteration++) {
    eccentricAnomaly -= (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - anomaly)
      / (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  const orbitalX = 60.2666 * (Math.cos(eccentricAnomaly) - eccentricity);
  const orbitalY = 60.2666 * Math.sqrt(1 - eccentricity ** 2) * Math.sin(eccentricAnomaly);
  const trueLongitude = Math.atan2(orbitalY, orbitalX) + periapsis;
  const cosLongitude = Math.cos(trueLongitude), sinLongitude = Math.sin(trueLongitude);
  const x = Math.cos(node) * cosLongitude - Math.sin(node) * sinLongitude * Math.cos(inclination);
  const y = Math.sin(node) * cosLongitude + Math.cos(node) * sinLongitude * Math.cos(inclination);
  const z = sinLongitude * Math.sin(inclination);
  const eclipticLongitude = Math.atan2(y, x) + rad * (
    -1.274 * Math.sin(anomaly - 2 * elongation) + .658 * Math.sin(2 * elongation) - .186 * Math.sin(sunAnomaly)
    - .059 * Math.sin(2 * anomaly - 2 * elongation) - .057 * Math.sin(anomaly - 2 * elongation + sunAnomaly)
    + .053 * Math.sin(anomaly + 2 * elongation) + .046 * Math.sin(2 * elongation - sunAnomaly)
    + .041 * Math.sin(anomaly - sunAnomaly) - .035 * Math.sin(elongation) - .031 * Math.sin(anomaly + sunAnomaly)
    - .015 * Math.sin(2 * argumentLatitude - 2 * elongation) + .011 * Math.sin(anomaly - 4 * elongation));
  const eclipticLatitude = Math.atan2(z, Math.hypot(x, y)) + rad * (
    -.173 * Math.sin(argumentLatitude - 2 * elongation) - .055 * Math.sin(anomaly - argumentLatitude - 2 * elongation)
    - .046 * Math.sin(anomaly + argumentLatitude - 2 * elongation) + .033 * Math.sin(argumentLatitude + 2 * elongation)
    + .017 * Math.sin(2 * anomaly + argumentLatitude));
  const distance = Math.hypot(orbitalX, orbitalY) - .58 * Math.cos(anomaly - 2 * elongation) - .46 * Math.cos(2 * elongation);
  const obliquity = (23.4393 - .0000003563 * days) * rad;
  const eclipticX = distance * Math.cos(eclipticLongitude) * Math.cos(eclipticLatitude);
  const eclipticY = distance * Math.sin(eclipticLongitude) * Math.cos(eclipticLatitude);
  const eclipticZ = distance * Math.sin(eclipticLatitude);
  // Mean sidereal angle, equatorial coordinates of date. UTC is sufficient for
  // this illustrative orbit; TT/UT and nutation remain approximation errors.
  const jd2000 = timeMs / CLOCK_DAY_MS + 2440587.5 - 2451545;
  const centuries = jd2000 / 36525;
  const sidereal = angle(280.46061837 + 360.98564736629 * jd2000
    + .000387933 * centuries ** 2 - centuries ** 3 / 38710000 + longitude);
  const latitudeRad = latitude * rad, cosLatitude = Math.cos(latitudeRad), sinLatitude = Math.sin(latitudeRad);
  const flattening = 1 / 298.257223563, eccentricitySquared = flattening * (2 - flattening);
  const observerRadius = 1 / Math.sqrt(1 - eccentricitySquared * sinLatitude ** 2);
  // Subtract the geodetic WGS84 observer vector before the horizontal transform:
  // lunar parallax can exceed1°, so a geocentric/night-progress icon is unsuitable.
  const topX = eclipticX - observerRadius * cosLatitude * Math.cos(sidereal);
  const topY = eclipticY * Math.cos(obliquity) - eclipticZ * Math.sin(obliquity)
    - observerRadius * cosLatitude * Math.sin(sidereal);
  const topZ = eclipticY * Math.sin(obliquity) + eclipticZ * Math.cos(obliquity)
    - observerRadius * (1 - eccentricitySquared) * sinLatitude;
  const east = -Math.sin(sidereal) * topX + Math.cos(sidereal) * topY;
  const north = -sinLatitude * (Math.cos(sidereal) * topX + Math.sin(sidereal) * topY) + cosLatitude * topZ;
  const up = cosLatitude * (Math.cos(sidereal) * topX + Math.sin(sidereal) * topY) + sinLatitude * topZ;
  return {
    elevationDeg: Math.atan2(up, Math.hypot(east, north)) * deg,
    azimuthDeg: (Math.atan2(east, north) * deg + 360) % 360,
    hourAngleDeg: ((sidereal - Math.atan2(topY, topX)) * deg % 360 + 540) % 360 - 180,
    distanceKm: Math.hypot(topX, topY, topZ) * 6378.137,
  };
}

// Stereographic overhead chart: north up, east left, zenith at the centre.
// Below-horizon coordinates stay physical; only their chart marker is at the rim.
export function projectSkyPosition(position) {
  if (!Number.isFinite(position?.elevationDeg) || !Number.isFinite(position?.azimuthDeg)) {
    return { valid: false, x: .5, y: 1, east: 0, north: 0, up: -1, horizonOpacity: 0, visible: false };
  }
  const elevation = position.elevationDeg * Math.PI / 180, azimuth = position.azimuthDeg * Math.PI / 180;
  const east = Math.cos(elevation) * Math.sin(azimuth), north = Math.cos(elevation) * Math.cos(azimuth), up = Math.sin(elevation);
  const horizonOpacity = solarSmooth(-1, .5, position.elevationDeg);
  const radius = Math.tan((Math.PI / 2 - Math.max(0, elevation)) / 2);
  return { valid: true, skyProjection: 'stereographic', elevationDeg: position.elevationDeg, azimuthDeg: position.azimuthDeg,
    x: solarUnit(.5 - .5 * radius * Math.sin(azimuth)), y: solarUnit(.5 - .5 * radius * Math.cos(azimuth)), east, north, up,
    belowHorizon: position.elevationDeg < 0, horizonOpacity, visible: horizonOpacity > .001 };
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

// Refine a bracketed local height extremum, including a grazing polar horizon.
// The normal crossing scan and its existing time precision remain unchanged.
function solarExtremum(left, right, direction, elevation) {
  for (let iteration = 0; iteration < 32 && right - left > 25; iteration++) {
    const third = (right - left) / 3, first = left + third, second = right - third;
    if (direction * elevation(first) < direction * elevation(second)) left = first;
    else right = second;
  }
  return (left + right) / 2;
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
  const crossings = [[CLOCK_HORIZON_DEG, 'sunrise', 'sunset'], [CLOCK_CIVIL_DEG, 'civilTwilightBegin', 'civilTwilightEnd']];
  let left = dayStart - 18 * 3600000;
  let before = position(left - step), prior = position(left);
  for (let right = left + step; right <= dayStart + 42 * 3600000; right += step) {
    const next = position(right);
    for (const [target, risingKey, fallingKey] of crossings) {
      const rising = prior.elevationDeg <= target && next.elevationDeg > target;
      const falling = prior.elevationDeg >= target && next.elevationDeg < target;
      if (rising || falling) {
        const event = solarCrossing(left, right, target, elevation);
        if (localDate(event) === dateString) result[rising ? risingKey : fallingKey] = event;
      }
    }
    // A short polar day or twilight can cross a threshold twice between scan
    // samples. Inspect its extremum rather than inventing missing rise/set times.
    const maximum = prior.elevationDeg >= before.elevationDeg && prior.elevationDeg >= next.elevationDeg;
    const minimum = prior.elevationDeg <= before.elevationDeg && prior.elevationDeg <= next.elevationDeg;
    const direction = maximum === minimum ? 0 : maximum ? 1 : -1;
    const missed = direction ? crossings.filter(([target]) => [before, prior, next]
      .every(sample => direction * (sample.elevationDeg - target) <= 0)) : [];
    if (missed.length) {
      const extremum = solarExtremum(left - step, right, direction, elevation);
      const height = elevation(extremum);
      for (const [target, risingKey, fallingKey] of missed) {
        if (direction * (height - target) <= 0) continue;
        for (const [start, end, key] of [
          [left - step, extremum, direction > 0 ? risingKey : fallingKey],
          [extremum, right, direction > 0 ? fallingKey : risingKey],
        ]) {
          const event = solarCrossing(start, end, target, elevation);
          if (localDate(event) === dateString) result[key] = event;
        }
      }
    }
    if (prior.hourAngleDeg <= 0 && next.hourAngleDeg > 0 && next.hourAngleDeg - prior.hourAngleDeg < 180) {
      const event = solarCrossing(left, right, 0, hourAngle);
      if (localDate(event) === dateString) result.solarNoon = event;
    }
    before = prior;
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
  // A provider day belongs to one solar rotation, not twelve hours beyond each
  // horizon event: yesterday's long summer day must not hide today's sunrise.
  const noon = orderedDay && Number.isFinite(day.solarNoon) && day.sunrise < day.solarNoon && day.solarNoon < day.sunset
    ? day.solarNoon : orderedDay ? (day.sunrise + day.sunset) / 2 : NaN;
  const recentDay = orderedDay && nowMs >= noon - CLOCK_DAY_MS / 2 && nowMs < noon + CLOCK_DAY_MS / 2;
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
