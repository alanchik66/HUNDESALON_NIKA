/* Native foreground rain owns no astronomy or network weather state. A failed
 * optional module leaves the existing 3D/CSS rain available. */
const records = new Map(), styledRoots = new WeakMap();
let rainModule, retryAt = 0;
const now = () => globalThis.performance.now();
const finite = (...values) => values.find(value => value !== null && value !== '' && Number.isFinite(Number(value)));

export function headerWeatherRainOptions(host, forecast) {
  const weather = host?.__weatherWidgetInstance?.getState?.()?.weather || host?.__weatherWidgetData;
  const day = forecast?.day, current = day || weather?.current || {};
  const meta = day ? {} : host?.__weatherCurrentMeta || weather?.weatherMeta || {};
  const code = Number(finite(meta.weatherCode, current.condition?.code));
  const text = String(current.condition?.text || '').toLowerCase();
  const snow = (code >= 71 && code <= 77) || code === 85 || code === 86
    || [1066,1069,1114,1117,1204,1207,1210,1213,1216,1219,1222,1225,1237,1249,1252,1255,1258,1261,1264,1279,1282].includes(code)
    || /snow|sleet|снег|сніг|schnee/.test(text);
  const rain = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)
    || [1063,1072,1087,1150,1153,1168,1171,1180,1183,1186,1189,1192,1195,1198,1201,1240,1243,1246,1273,1276].includes(code)
    || /rain|drizzle|shower|storm|thunder|дожд|дощ|лив|морось|мряк|гроз|regen|schauer|gewitter|niesel/.test(text);
  const precipitation = Number(finite(meta.precipitation, current.precip_mm, current.totalprecip_mm) ?? 0);
  return { kind: !snow && (rain || (!Number.isFinite(code) && !text && precipitation > 0)) ? 'rain' : 'none',
    // A daily forecast total is an average rate, not a current hourly reading.
    precipitationMm: Math.max(0, day ? precipitation / 24 : precipitation),
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
