const cloudAppearanceUrl = new URL('../../assets/js/weather-cloud-motion.js', import.meta.url);
cloudAppearanceUrl.search = new URL(import.meta.url).search;
let resolveCloudAppearance;
// Cloud enhancement must neither block current weather nor disable its static recovery.
void import(cloudAppearanceUrl.href).then(module => { resolveCloudAppearance = module.resolveCloudAppearance; }).catch(() => null);
const solarClockUrl = new URL('../../assets/js/weather-solar-time.js', import.meta.url);
solarClockUrl.search = new URL(import.meta.url).search;
let resolveSolarPhase;
// Weather text/recovery must not wait for optional celestial-clock loading.
export const weatherSceneSolarReady = import(solarClockUrl.href).then(module => {
  resolveSolarPhase = module.solarPhase; return true;
}).catch(() => false);

export const WEATHER_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function weatherCurrentTimestamp(data) {
  const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') &&
    Number.isFinite(Number(value)) ? Number(value) : null;
  for (const value of [data?.weatherMeta?.observedAt, data?.weatherMeta?.validAt]) {
    const timestamp = number(value);
    if (timestamp !== null) return timestamp;
  }
  const epoch = number(data?.current?.last_updated_epoch);
  return epoch === null ? parseWeatherCurrentTime(data?.weatherMeta?.time) : epoch * 1000;
}

export function formatWeatherObservationTime(data, locale = 'en') {
  const timestamp = weatherCurrentTimestamp(data);
  if (timestamp === null) return null;
  const timeZone = data?.location?.tz_id || data?.location?.timezone || data?.weatherMeta?.timezone || 'UTC';
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(timestamp);
  } catch { return null; }
}

export function isCurrentWeatherFresh(data, nowMs = Date.now()) {
  const timestamp = weatherCurrentTimestamp(data);
  return timestamp !== null && Number.isFinite(nowMs) && timestamp >= nowMs - 2 * 60 * 60 * 1000 &&
    timestamp <= nowMs + 10 * 60 * 1000;
}

// Open-Meteo's timezone=auto ISO values have no zone suffix. Use its explicit
// utc_offset_seconds, never the browser's timezone or the time of retrieval.
export function parseWeatherCurrentTime(value, offsetSeconds) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0', fraction = '', zone] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Number((fraction + '000').slice(0, 3)));
  const calendar = new Date(utc);
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() !== Number(month) - 1 ||
    calendar.getUTCDate() !== Number(day) || calendar.getUTCHours() !== Number(hour) ||
    calendar.getUTCMinutes() !== Number(minute) || calendar.getUTCSeconds() !== Number(second)) return null;
  let offset;
  if (zone === 'Z') offset = 0;
  else if (zone) {
    const hours = Number(zone.slice(1, 3)), minutes = Number(zone.slice(4));
    if (hours > 23 || minutes > 59) return null;
    offset = (hours * 3600 + minutes * 60) * (zone[0] === '-' ? -1 : 1);
  } else if (typeof offsetSeconds === 'number' && Number.isFinite(offsetSeconds) && Math.abs(offsetSeconds) <= 86400) offset = offsetSeconds;
  else return null;
  return utc - offset * 1000;
}

export function buildForecastSlots(data, nowMs = Date.now()) {
  if (!data?.current) return [];
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const time = Number.isFinite(nowMs) && Number.isFinite(new Date(nowMs).getTime()) ? nowMs : Date.now();
  let today;
  const timeZone = data.location?.tz_id || data.location?.timezone;
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(time);
      const part = type => parts.find(value => value.type === type)?.value;
      const date = `${part('year')}-${part('month')}-${part('day')}`;
      if (validDate(date)) today = date;
    } catch { /* A provider without a valid IANA zone still supplies its local calendar date. */ }
  }
  if (!today) {
    const localDate = String(data.location?.localtime || '').match(/^(\d{4}-\d{2}-\d{2})(?:[T ]|$)/)?.[1];
    today = validDate(localDate) ? localDate : new Date(time).toISOString().slice(0, 10);
  }
  const finiteTemperature = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
    Number.isFinite(Number(value));
  const actualDays = new Map();
  for (const day of Array.isArray(data.forecast?.forecastday) ? data.forecast.forecastday : []) {
    if (!validDate(day?.date) || day.available === false || !finiteTemperature(day.day?.maxtemp_c) || !finiteTemperature(day.day?.mintemp_c)) continue;
    if (!actualDays.has(day.date)) actualDays.set(day.date, day);
  }
  const firstDay = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: 4 }, (_, offset) => {
    const date = new Date(firstDay + offset * 86400000).toISOString().slice(0, 10);
    const actual = actualDays.get(date);
    return actual ? { ...actual, available: true } : { date, available: false };
  });
}

export function hasCompleteForecast(data, nowMs = Date.now()) {
  const slots = buildForecastSlots(data, nowMs);
  return slots.length === 4 && slots.every(day => day.available);
}

export function resolveForecastCloudCover(forecastDay) {
  const percent = value => value === null || value === undefined || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))
    ? null : Math.max(0, Math.min(100, Number(value)));
  for (const value of [forecastDay?.day?.cloud, forecastDay?.day?.cloud_cover, forecastDay?.day?.avgcloud]) {
    const cloud = percent(value);
    if (cloud !== null) return cloud;
  }
  const hours = Array.isArray(forecastDay?.hour) ? forecastDay.hour : [];
  const clouds = hours.map(hour => percent(hour?.cloud ?? hour?.cloud_cover)).filter(value => value !== null);
  return clouds.length ? clouds.reduce((sum, cloud) => sum + cloud, 0) / clouds.length : null;
}

export function resolveForecastNoonMs(date, timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const targetMs = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(targetMs) || new Date(targetMs).toISOString().slice(0, 10) !== date) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    let result = targetMs;
    for (let index = 0; index < 3; index += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(result)).map(part => [part.type, part.value]));
      const observed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second));
      if (observed === targetMs) return result;
      result += targetMs - observed;
    }
  } catch {
    // An invalid timezone must not invent a forecast scene time.
  }
  return null;
}

export function buildForecastSceneContext(projected, date, presentation, geoState, timeZone) {
  const appearanceTimeMs = projected ? resolveForecastNoonMs(date, timeZone) : null;
  if (!Number.isFinite(appearanceTimeMs)) return { presentation, geoState, forecast: false };
  const isDay = projected.current?.is_day === 1;
  return {
    forecast: true,
    geoState: { ...geoState, appearanceTimeMs },
    presentation: {
      ...presentation,
      dominantKind: isDay ? 'sun' : 'moon',
      sun: { ...presentation?.sun, active: isDay, opacity: isDay ? 1 : 0 },
      moon: { ...presentation?.moon, active: !isDay, opacity: isDay ? 0 : 1 },
    },
  };
}

export const HEADER_WEATHER_RECOVERY_STYLES = `
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery {
  position: absolute !important; inset: 0 !important; width: 100% !important; height: 100% !important;
  min-width: 0 !important; min-height: 0 !important; box-sizing: border-box !important;
  padding: 4px 8px !important; overflow: hidden !important; pointer-events: none !important; z-index: 50 !important;
}
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery .weather-header-state__inner {
  display: flex !important; align-items: center !important; justify-content: center !important;
  width: 100% !important; min-width: 0 !important; max-height: 100% !important;
  padding: 0 !important; overflow: hidden !important; pointer-events: none !important;
}
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery .weather-header-state__inner--error .weather-header-state__notice {
  margin: 0 !important; padding: 0 !important; overflow-wrap: anywhere; text-align: center;
  font-size: 10px !important; line-height: 1.25 !important; letter-spacing: 0 !important; text-transform: none !important;
}
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery .weather-header-state__inner--geolocation {
  flex-direction: column !important; gap: 4px !important; padding-bottom: 24px !important; box-sizing: border-box !important;
}
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery .weather-header-state__geolocation {
  pointer-events: auto !important; min-height: 24px !important; max-width: 100% !important; margin: 0 !important;
  padding: 3px 10px !important; border: 1px solid #d6c38a88 !important; border-radius: 999px !important;
  background: #0a2419cc !important; color: #fff2c5 !important; font-size: 11px !important; line-height: 1.25 !important;
  letter-spacing: 0 !important; text-transform: none !important; cursor: pointer;
}
:host([data-weather-variant='header']) .weather-header-preview .weather-header-state--recovery .weather-header-state__geolocation:focus-visible {
  outline: 2px solid #fff2c5; outline-offset: 2px;
}
.weather-scene-recovery,
:host([data-weather-variant='header']) .weather-header-preview .weather-scene-recovery,
:host([data-weather-variant='header']) .weather-header-dropdown .weather-scene-recovery {
  position: absolute; inset: 0; overflow: hidden !important; pointer-events: none; isolation: isolate;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 24%, #000 76%, transparent) !important;
  mask-image: linear-gradient(90deg, transparent, #000 24%, #000 76%, transparent) !important;
}
.weather-scene-recovery__clouds { position: absolute; inset: -18% -8% 0; }
.weather-scene-recovery__cloud {
  position: absolute; top: 0; left: -16%; width: 72%; height: 94%;
  background: url('/assets/images/weather/cloud-9225a9f1.png') center / contain no-repeat;
  opacity: .5; filter: brightness(1.1) drop-shadow(0 6px 10px #101c2b55);
}
.weather-scene-recovery__cloud:nth-child(2) { left: 24%; top: 8%; opacity: .45; }
.weather-scene-recovery__cloud:nth-child(3) { left: 62%; top: -8%; opacity: .4; }
.weather-scene-recovery--night .weather-scene-recovery__cloud {
  filter: brightness(.42) sepia(.45) saturate(1.2) hue-rotate(150deg) drop-shadow(0 6px 10px #070e1899);
}
.weather-scene-recovery--unknown .weather-scene-recovery__cloud { filter: brightness(.65) saturate(.4); }
.weather-scene-recovery--foggy .weather-scene-recovery__clouds { opacity: .7; filter: blur(8px); }
[data-weather-renderer='primary'] { width:100%; height:100%; transition:opacity .4s ease; }
[data-weather-renderer='primary'][data-weather-visible='false'] { opacity:0!important; pointer-events:none!important; transition:none!important; }
@media(prefers-reduced-motion:reduce) { [data-weather-renderer='primary'] { transition:none!important; } }
.weather-scene-recovery__orb {
  position: absolute; left: 50%; top: 18%; width: min(26%, 120px); aspect-ratio: 1;
  border-radius: 50%; transform: translateX(-50%);
  background: radial-gradient(circle at 35% 30%, #fffde5 0%, #ffdc81 42%, #ee9e31 76%, #d77525 100%);
  box-shadow: 0 0 22px #ffce6055, 0 0 48px #f1b74222;
  animation: weatherRecoveryOrbGlow 5s ease-in-out infinite alternate;
}
.weather-scene-recovery--night .weather-scene-recovery__orb {
  background: radial-gradient(circle at 28% 36%, #adb2ba 0 6%, transparent 7%), radial-gradient(circle at 65% 60%, #9299a4 0 9%, transparent 10%), radial-gradient(circle at 38% 30%, #f3f1e5, #a8b0bd 75%, #6f7c8b);
  box-shadow: 0 0 20px #dce9ff33;
}
.weather-scene-recovery__precipitation { position: absolute; inset: 25% 0 0; opacity: .65; }
.weather-scene-recovery--rainy .weather-scene-recovery__precipitation,
.weather-scene-recovery--stormy .weather-scene-recovery__precipitation {
  background: linear-gradient(105deg, transparent 45%, #b6d7ed 46% 48%, transparent 49%) 0 0 / 24px 42px;
  animation: weatherRecoveryRain .8s linear infinite;
}
.weather-scene-recovery--snowy .weather-scene-recovery__precipitation {
  background: radial-gradient(circle, #edf5ff 0 1.5px, transparent 2px) 0 0 / 31px 43px;
  animation: weatherRecoverySnow 5s linear infinite;
}
.weather-scene-recovery--stormy::after,
:host([data-weather-variant='header']) .weather-header-preview .weather-scene-recovery--stormy::after {
  content: ''; position: absolute; top: 28%; left: 58%; width: 9%; height: 35%; opacity: 0;
  clip-path: polygon(50% 0, 10% 58%, 45% 55%, 25% 100%, 95% 35%, 56% 40%, 78% 0) !important;
  background: #eef4ff; filter: drop-shadow(0 0 8px #c4e6ff); animation: weatherRecoveryLightning 6s linear infinite;
}
@keyframes weatherRecoveryOrbGlow { from { filter: brightness(.96); } to { filter: brightness(1.08); } }
@keyframes weatherRecoveryRain { to { background-position: -12px 42px; } }
@keyframes weatherRecoverySnow { to { background-position: 12px 86px; } }
@keyframes weatherRecoveryLightning { 0%, 70%, 73%, 76%, 100% { opacity: 0; } 71%, 74% { opacity: .8; } }
`;

export function resolveWeatherSceneFallback(weather, { getSolarPhase, now = Date.now } = {}) {
  if (!weather?.current) return null;
  const current = weather.current;
  const code = Number(current.condition?.code);
  const text = String(current.condition?.text || '').toLowerCase();
  const cover = [current.cloud, weather.weatherMeta?.cloudCover].find(value =>
    (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)));
  let phase;
  const appearanceTime = weather.weatherMeta?.appearanceTimeMs;
  try {
    // A current sky callback must not overwrite a selected future forecast's time.
    if (!Number.isFinite(appearanceTime)) phase = getSolarPhase?.(now());
  } catch { /* A failed optional clock leaves the valid provider day flag usable. */ }
  if (!['day', 'night', 'dawn', 'sunset'].includes(phase?.phase)) {
    const coordinate = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) ? Number(value) : NaN;
    const latitude = coordinate(weather.location?.lat ?? weather.weatherMeta?.latitude);
    const longitude = coordinate(weather.location?.lon ?? weather.weatherMeta?.longitude);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      try { phase = resolveSolarPhase?.(Number.isFinite(appearanceTime) ? appearanceTime : now(), null, latitude, longitude); }
      catch { /* Unknown astronomy stays neutral instead of inventing local fixed hours. */ }
    }
  }
  const astronomical = ['day', 'night', 'dawn', 'sunset'].includes(phase?.phase);
  const night = astronomical ? Number.isFinite(phase.starOpacity) ? phase.starOpacity > .02 : phase.phase === 'night'
    : Number.isFinite(appearanceTime) ? null
      : current.is_day === 0 || current.is_day === '0' ? true : current.is_day === 1 || current.is_day === '1' ? false : null;
  const kind = [1087, 1273, 1276, 1279, 1282].includes(code) || /thunder|storm/.test(text) ? 'stormy'
    : [1066, 1069, 1114, 1117, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264].includes(code) || /snow|sleet|blizzard|ice pellet/.test(text) ? 'snowy'
      : [1063, 1072, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246].includes(code) || /rain|drizzle|shower/.test(text) ? 'rainy'
        : [1030, 1135, 1147].includes(code) || /fog|mist/.test(text) ? 'foggy'
          : code === 1000 || /sunny|clear/.test(text) ? 'clear' : 'cloudy';
  return { kind, night, clouds: resolveCloudAppearance ? resolveCloudAppearance(weather).opacity > 0 : kind !== 'clear' || Number(cover) > 0, orb: kind === 'clear' || code === 1003 || /partly/.test(text), precipitation: ['rainy', 'snowy', 'stormy'].includes(kind) };
}

let fallbackCloudModule;
function fallbackCloudRef(weather) {
  let node, controller, revision = 0;
  return element => {
    const current = ++revision;
    controller?.dispose(); controller = null; node = element;
    if (!node) return;
    if (!fallbackCloudModule) {
      const url = new URL('../../assets/js/weather-cloud-motion.js', import.meta.url);
      url.search = new URL(import.meta.url).search;
      fallbackCloudModule = import(url.href).catch(error => { fallbackCloudModule = null; throw error; });
    }
    fallbackCloudModule.then(module => {
      if (current === revision && node?.isConnected !== false) controller = module.createFallbackCloudMotion(node, weather);
    }).catch(() => {}); // Keep the existing static raster clouds if enhancement is unavailable.
  };
}

export function renderWeatherSceneFallback(jsx, { weatherData, embedded, variant, getSolarPhase, now } = {}, loadingFallback) {
  const model = resolveWeatherSceneFallback(weatherData, { getSolarPhase, now });
  if (!model) return loadingFallback;
  const children = [];
  // The header panel's Sun and Moon are shared shell overlays, not duplicate icons.
  if (model.orb && !(embedded && variant === 'header-panel')) children.push(jsx('span', { className: 'weather-scene-recovery__orb' }, 'orb'));
  if (model.clouds) children.push(jsx('div', { className: 'weather-scene-recovery__clouds', ref: fallbackCloudRef(weatherData), children: [0, 1, 2].map(key => jsx('span', { className: 'weather-scene-recovery__cloud' }, key)) }, 'clouds'));
  if (model.precipitation) children.push(jsx('div', { className: 'weather-scene-recovery__precipitation' }, 'precipitation'));
  return jsx('div', {
    className: `weather-scene-recovery weather-scene-recovery--${model.kind}${model.night === true ? ' weather-scene-recovery--night' : model.night === null ? ' weather-scene-recovery--unknown' : ''}`,
    'data-weather-fallback-kind': model.kind,
    'aria-hidden': true,
    children,
  });
}

export function resolveWeatherLocationNotice(state, copy) {
  if (state.geoStatus === 'pending') return null;
  const keys = {
    denied: ['locationDeniedStatus', 'locationPermissionDenied'],
    timeout: ['locationTimeoutStatus', 'locationTimeout'],
    unavailable: ['locationUnavailableStatus', 'locationUnavailable'],
    aborted: ['locationUnavailableStatus', 'locationUnavailable'],
  };
  if (keys[state.geoStatus]) return keys[state.geoStatus].map(key => copy[key]).find(Boolean);
  return state.error ? copy.unavailable || copy.loadError : null;
}

const locationKey = location => typeof location === 'string'
  ? location.trim()
  : `${Number(location?.latitude)},${Number(location?.longitude)}`;

export function createWeatherController({ service, locale = 'en', initialLocation = '', fallbackLocation = 'Leipzig', useGeolocation = false, requireLocation = false, now = Date.now, schedule = setTimeout, cancelSchedule = clearTimeout }) {
  let location = initialLocation || null;
  let generation = 0;
  let pending = null;
  let locating = null;
  let disposed = false;
  let partialRetry = null;
  const clearPartialRetry = () => {
    if (partialRetry !== null) cancelSchedule(partialRetry);
    partialRetry = null;
  };
  const listeners = new Set();
  let state = { weather: null, location, lastUpdatedAt: 0, loading: false, error: null, geoStatus: requireLocation && !location ? 'pending' : null };
  const publish = patch => {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  };
  const request = target => {
    if (disposed) return Promise.reject(new Error('Weather widget is unmounted.'));
    clearPartialRetry();
    const key = locationKey(target);
    if (pending?.key === key) return pending.promise;
    location = target;
    const token = ++generation;
    publish({ loading: true, error: null, geoStatus: null });
    const promise = Promise.resolve().then(() => service.getCurrentWeather(target, { locale, forceRefresh: true })).then(weather => {
      if (disposed || token !== generation) return false;
      if (!weather?.current || !Array.isArray(weather.forecast?.forecastday)) throw new Error('Incomplete weather response.');
      if (weather.stale) {
        if (!state.weather) publish({ weather });
        throw new Error('Only stale weather is available.');
      }
      publish({ weather, location: target, lastUpdatedAt: now(), error: null });
      if (!disposed && token === generation && !hasCompleteForecast(weather, now())) {
        partialRetry = schedule(() => {
          if (disposed || token !== generation) return;
          partialRetry = null;
          request(target).catch(() => {});
        }, 30000);
        partialRetry?.unref?.();
      }
      return weather;
    }).catch(error => {
      if (disposed || token !== generation) return false;
      publish({ error });
      throw error;
    }).finally(() => {
      if (!disposed && token === generation) publish({ loading: false });
      if (pending?.promise === promise) pending = null;
    });
    pending = { key, promise };
    return promise;
  };
  const currentLocation = () => {
    if (disposed) return Promise.reject(new Error('Weather widget is unmounted.'));
    if (locating) return locating;
    clearPartialRetry();
    const token = ++generation;
    pending = null;
    publish({ loading: true, error: null, geoStatus: 'pending' });
    const promise = Promise.resolve().then(() => service.getCurrentLocation()).then(target => {
      if (disposed || token !== generation) return false;
      return request(target);
    }, error => {
      if (disposed || token !== generation) return false;
      publish({ loading: false, geoStatus: error?.code === 1 ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable' });
      throw error;
    }).finally(() => { if (locating === promise) locating = null; });
    locating = promise;
    return promise;
  };
  return {
    refresh: () => {
      if (!location && requireLocation) {
        const error = new Error('Device location is required.');
        return Promise.reject(error);
      }
      return location ? request(location) : useGeolocation ? currentLocation() : request(fallbackLocation);
    },
    setLocation: request,
    setLocationStatus({ status, code } = {}) {
      if (disposed) return;
      if (status === 'none' || status === 'aborted') {
        publish({ geoStatus: null });
        return;
      }
      const geoStatus = status === 'pending' ? 'pending' : status === 'denied' || code === 1 ? 'denied' : status === 'timeout' || code === 3 ? 'timeout' : 'unavailable';
      publish({ geoStatus });
    },
    currentLocation,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    cancel() {
      clearPartialRetry();
      generation += 1;
      pending = null;
      locating = null;
    },
    dispose() {
      clearPartialRetry();
      disposed = true;
      generation += 1;
      pending = null;
      locating = null;
      listeners.clear();
    },
  };
}

export function createRetryableModuleLoader(url, importModule = value => import(value), pause = delay => new Promise(resolve => setTimeout(resolve, delay))) {
  let pending;
  let retry = 0;
  const loader = () => {
    if (pending) return pending;
    const load = async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const target = new URL(url);
        if (retry) target.searchParams.set('weather-retry', String(retry));
        try {
          return await importModule(target.href);
        } catch (error) {
          retry += 1;
          if (attempt === 2) throw error;
          await pause(300 * 2 ** attempt);
        }
      }
    };
    pending = load().catch(error => { pending = null; throw error; });
    return pending;
  };
  loader.reset = () => { pending = null; retry += 1; };
  return loader;
}

export function createRecoverableScene(React, jsx, load, environment = globalThis) {
  const window = environment.window || environment;
  const document = environment.document;
  return class WeatherSceneBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null, contextLost: false, readyWeather: null, generationReady: false, recovering: false, readiness: 0, Scene: React.lazy(load), version: 0 };
      this.attempts = 0;
      this.lossTimers = new Map();
      this.retry = () => {
        if (!this.mounted || !this.state.error || document?.hidden) return;
        window.clearTimeout(this.retryTimer);
        for (const timer of this.lossTimers.values()) window.clearTimeout(timer);
        this.lossTimers.clear();
        load.reset?.();
        this.setState(state => ({ error: null, contextLost: false, readyWeather: null, generationReady: false, recovering: true, readiness: state.readiness + 1, Scene: React.lazy(load), version: state.version + 1 }));
      };
      this.resume = () => {
        if (document?.hidden) return;
        this.attempts = 0;
        this.retry();
      };
      this.lost = event => {
        event.preventDefault?.();
        const canvas = event.target;
        if (this.lossTimers.has(canvas)) return;
        this.setState(state => ({ contextLost: true, readyWeather: null, generationReady: false, recovering: true, readiness: state.readiness + 1 }));
        this.lossTimers.set(canvas, window.setTimeout(() => {
          this.lossTimers.delete(canvas);
          if (!this.mounted) return;
          this.setState({ error: new Error('Weather WebGL context did not restore.') }, () => this.scheduleRetry());
        }, 5000));
      };
      this.restored = event => {
        window.clearTimeout(this.lossTimers.get(event.target));
        this.lossTimers.delete(event.target);
        this.setState({ contextLost: this.lossTimers.size > 0 });
      };
      this.sceneReady = (weather, readiness) => {
        if (!this.mounted || this.state.error || this.state.contextLost || readiness !== this.state.readiness ||
            !weather?.current || weather !== this.props.weatherData || this.state.readyWeather === weather) return;
        this.setState({ readyWeather: weather, generationReady: true, recovering: false });
      };
    }
    static getDerivedStateFromError(error) { return { error, readyWeather: null, generationReady: false, recovering: true }; }
    componentDidCatch() { this.scheduleRetry(); }
    scheduleRetry() {
      window.clearTimeout(this.retryTimer);
      if (!this.mounted || this.attempts >= 3 || document?.hidden) return;
      this.retryTimer = window.setTimeout(this.retry, [1000, 4000, 12000][this.attempts++]);
    }
    componentDidMount() {
      this.mounted = true;
      void weatherSceneSolarReady.then(ready => {
        if (ready && this.mounted && !this.state.generationReady) this.forceUpdate?.();
      }).catch(() => null);
      window.addEventListener?.('online', this.resume);
      document?.addEventListener('visibilitychange', this.resume);
      this.node?.addEventListener('webglcontextlost', this.lost, true);
      this.node?.addEventListener('webglcontextrestored', this.restored, true);
    }
    componentWillUnmount() {
      this.mounted = false;
      window.clearTimeout(this.retryTimer);
      for (const timer of this.lossTimers.values()) window.clearTimeout(timer);
      this.lossTimers.clear();
      window.removeEventListener?.('online', this.resume);
      document?.removeEventListener('visibilitychange', this.resume);
      this.node?.removeEventListener('webglcontextlost', this.lost, true);
      this.node?.removeEventListener('webglcontextrestored', this.restored, true);
    }
    render() {
      const { fallback, ...props } = this.props;
      const visualFallback = renderWeatherSceneFallback(jsx, props, fallback);
      const readiness = this.state.readiness;
      const recovering = Boolean(this.state.error || this.state.contextLost || this.state.recovering);
      const primaryVisible = this.state.generationReady && !recovering;
      const header = props.embedded && props.variant === 'header-panel';
      const showFallback = Boolean(visualFallback && (recovering || !header && !this.state.generationReady));
      const scene = jsx(React.Suspense, {
        fallback: null,
        children: jsx(this.state.Scene, { ...props, sceneRecoveryVersion: readiness,
          onSceneReady: weather => this.sceneReady(weather, readiness) }, this.state.version),
      });
      // Opacity retains Canvas layout and frame production. The native image and
      // the primary renderer never paint together, including retry/asset recovery.
      const primary = jsx('div', {
        'data-weather-renderer': 'primary', 'data-weather-visible': String(primaryVisible),
        style: { width: '100%', height: '100%', opacity: primaryVisible ? 1 : 0 }, children: scene,
      });
      return jsx('div', {
        ref: node => { this.node = node; },
        'data-weather-scene-owner': primaryVisible ? 'primary' : showFallback ? 'fallback' : 'loading',
        style: { position: 'relative', width: '100%', height: '100%' },
        children: this.state.error ? visualFallback : showFallback ? [primary, visualFallback] : primary,
      });
    }
  };
}
