/* Native foreground rain owns no astronomy or network weather state. A failed
 * optional module leaves the existing 3D/CSS rain available. */
const records = new Map(), styledRoots = new WeakMap();
let rainModule, retryAt = 0;
const now = () => globalThis.performance.now();
const finite = (...values) => values.find(value => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)));
const nonnegative = value => { const parsed = finite(value); return parsed === undefined || Number(parsed) < 0 ? null : Number(parsed); };

function precipitationKind(code, text, amount) {
  if ([96,99].includes(code) || [95,1087,1273,1276].includes(code) && /hail|hagel|град/.test(text)) return 'hail';
  if ([51,53,55,56,57,1072,1150,1153,1168,1171].includes(code)) return 'drizzle';
  if ([61,63,65,66,67,80,81,82,95,97,1063,1087,1180,1183,1186,1189,1192,1195,1198,1201,1240,1243,1246,1273,1276].includes(code)) return 'rain';
  if ([0,1,2,3,45,48,71,73,75,77,85,86,1000,1003,1006,1009,1030,1066,1069,1114,1117,1135,1147,1204,1207,1210,1213,1216,1219,1222,1225,1237,1249,1252,1255,1258,1261,1264,1279,1282].includes(code)) return 'none';
  if (/hail|hagel|град/.test(text)) return 'hail';
  if (/snow|sleet|ice pellet|снег|сніг|schnee|graupel/.test(text)) return 'none';
  if (/drizzle|niesel|морось|мряк/.test(text)) return 'drizzle';
  if (/rain|shower|storm|thunder|дожд|дощ|лив|гроз|regen|schauer|gewitter/.test(text)) return 'rain';
  return !Number.isFinite(code) && !text && amount > 0 ? 'rain' : 'none';
}

function precipitationIntensity(code, text, rate) {
  // Rate is an interval-normalized mean, not an instantaneous drop measurement.
  if (rate > 0) return rate <= 2.5 ? 'light' : rate <= 7.6 ? 'moderate' : 'heavy';
  if (code === 82 || /violent|extreme|екстрем|экстрем/.test(text)) return 'violent';
  if ([55,57,65,67,75,86,97,99,1171,1192,1195,1201,1246,1276].includes(code) || /heavy|strong|stark|сильн|сильний/.test(text)) return 'heavy';
  if ([53,63,81,95,1153,1186,1189,1243,1273].includes(code) || /moderate|mäßig|помірн|умерен/.test(text)) return 'moderate';
  return 'light';
}

export function headerWeatherRainOptions(host, forecast) {
  const weather = host?.__weatherWidgetInstance?.getState?.()?.weather || host?.__weatherWidgetData;
  const day = forecast?.day, current = day || weather?.current || {};
  const meta = day ? {} : host?.__weatherCurrentMeta || weather?.weatherMeta || {};
  const code = Number(finite(day?.weatherCode, meta.weatherCode, current.condition?.code));
  const text = String(current.condition?.text || '').toLowerCase();
  const amount = nonnegative(Object.hasOwn(meta, 'precipitation') ? meta.precipitation : finite(current.precip_mm, current.totalprecip_mm));
  const seconds = nonnegative(meta.precipitationIntervalSeconds);
  const explicitRate = nonnegative(meta.precipitationRateMmPerHour);
  // Never treat 10/15-minute accumulation or a daily total as an hourly rate.
  const computedRate = Number.isInteger(seconds) && seconds > 0 && seconds <= 3600 && amount !== null ? amount * (3600 / seconds) : null;
  const rate = day ? null : explicitRate ?? (Number.isFinite(computedRate) ? computedRate : null);
  return { kind: precipitationKind(code, text, amount), precipitationMm: rate,
    intensity: precipitationIntensity(code, text, rate),
    showers: [80,81,82,1240,1243,1246].includes(code) || /shower|schauer|лив/.test(text),
    windKph: Math.max(0, Number(day ? finite(day.avgwind_kph, day.maxwind_kph) ?? 0 : finite(meta.windSpeedKph, current.wind_kph) ?? 0)),
    windDegree: Number(day ? finite(day.wind_degree, day.windDegree) ?? 0 : finite(meta.windDirection, current.wind_degree) ?? 0) };
}

function loadRainModule() {
  if (!rainModule) {
    const url = new URL(`./header-weather-rain-layer.js${new URL(import.meta.url).search}`, import.meta.url);
    if (retryAt) url.searchParams.set('rain-retry', String(retryAt));
    rainModule = import(url.href).catch(error => { rainModule = null; retryAt = now() + 15000; throw error; });
  }
  return rainModule;
}

function installStyle(region) {
  const root = region.getRootNode();
  const parent = root.head || root;
  if (styledRoots.get(root)?.parentNode === parent) return;
  const style = region.ownerDocument.createElement('style');
  style.textContent = '[data-weather-native-rain="ready"] .weather-scene-recovery--rainy .weather-scene-recovery__precipitation,[data-weather-native-rain="ready"] .weather-scene-recovery--stormy .weather-scene-recovery__precipitation{display:none!important}';
  parent.append(style); styledRoots.set(root, style);
}

function release(region, record) {
  record.cancelled = true;
  region.removeAttribute('data-weather-native-rain');
  try { record.controller?.dispose(); } catch { /* Legacy weather remains available. */ }
  records.delete(region);
}

export function disposeHeaderWeatherRain(root) {
  for (const [region, record] of records) {
    if (!region.isConnected || root === region || root === record.canvas || root?.contains?.(region)
      || root?.contains?.(record.canvas)) release(region, record);
  }
}

export function syncHeaderWeatherRain(region, { host, forecast, active = true } = {}) {
  disposeHeaderWeatherRain();
  if (!region?.isConnected || !active) { disposeHeaderWeatherRain(region); return; }
  let record = records.get(region);
  const options = headerWeatherRainOptions(host, forecast);
  if (record?.controller) {
    try { record.controller.update(options); return; }
    catch { release(region, record); retryAt = now() + 15000; return; }
  }
  if (record) { record.options = options; return; }
  if (now() < retryAt) return;
  record = { options, controller: null, canvas: null, cancelled: false };
  records.set(region, record); region.setAttribute('data-weather-native-rain', 'loading');
  loadRainModule().then(module => {
    if (record.cancelled || !region.isConnected || records.get(region) !== record) return;
    installStyle(region);
    record.controller = module.createHeaderWeatherRainLayer(region, record.options);
    record.canvas = region.querySelector('canvas[data-weather-layer="rain"]');
    if (!record.canvas || !record.controller?.update || !record.controller?.dispose) throw new Error('Native rain unavailable.');
    if (record.cancelled || !region.isConnected || records.get(region) !== record) { record.controller.dispose(); return; }
    region.setAttribute('data-weather-native-rain', 'ready');
  }).catch(() => {
    if (records.get(region) === record) release(region, record);
    retryAt = now() + 15000;
  });
}
