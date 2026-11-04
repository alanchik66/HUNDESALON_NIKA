import { writeFile } from 'node:fs/promises';

const REPORT_FIELDS = ['event', 'target', 'sequence', 'offsetMs', 'width', 'height', 'mobile', 'rangeMobile', 'reducedMotion', 'ua', 'list'];
const LIST_FIELDS = ['open', 'hidden', 'first', 'last', 'firstIcon', 'lastIcon'];
const STYLE_FIELDS = ['animationName', 'animationDuration', 'animationDelay', 'transform', 'opacity'];
const GEOMETRY_FIELDS = ['strip', 'control', 'list', 'first', 'last'];
const PLACEMENT_FIELDS = ['header', 'navigation', 'dropdown'];
const RECT_FIELDS = ['x', 'y', 'width', 'height'];
const HIT_FIELDS = ['center', 'above', 'left', 'right'];
const HEALTH_FIELDS = ['mounted', 'geoSource', 'geoResolved', 'geoAccuracy', 'geoAgeMs', 'geoError', 'geoPending', 'geoSupported', 'secure', 'visible', 'locationHit', 'locationDocumentHit', 'locationDisabled', 'assistantOpacity', 'assistantHidden', 'assistantPulse', 'dataAgeMs', 'observationAgeMs', 'refreshing', 'loading', 'weatherError', 'canvasCount', 'canvasWidth', 'canvasHeight', 'sceneFallback', 'online', 'permission'];
const hasFields = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const integerBetween = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
const printable = (value, maximum) => typeof value === 'string' && value.length <= maximum && /^[\x20-\x7e]*$/.test(value);
const CSS_NUMBER = '[+-]?(?:\\d*\\.\\d+|\\d+)(?:[eE][+-]?\\d+)?';
const NUMBER_VALUE = new RegExp(`^${CSS_NUMBER}$`);
const STROKE_OFFSET_VALUE = new RegExp(`^${CSS_NUMBER}(?:px)?$`);
const TIME_VALUE = new RegExp(`^(${CSS_NUMBER})(?:ms|s)$`);
const ROTATE_VALUE = new RegExp(`^(?:none|(?:[xyz]\\s+|(?:${CSS_NUMBER}\\s+){3})?${CSS_NUMBER}(?:deg|rad|grad|turn))$`);
const POSITION_VALUE = new RegExp(`^(?:${CSS_NUMBER}(?:%|px)?|left|right|center|top|bottom)(?:[ ,]+(?:${CSS_NUMBER}(?:%|px)?|left|right|center|top|bottom))*$`);
const validTimes = (value, nonnegative) => printable(value, 80) && value.split(',').every(time => {
  const match = TIME_VALUE.exec(time.trim());
  return match && Number.isFinite(Number(match[1])) && (!nonnegative || Number(match[1]) >= 0);
});

function sanitizeStyles(value) {
  if (value === null) return null;
  const fields = [...STYLE_FIELDS, ...['rotate', 'backgroundPosition', 'strokeDashoffset'].filter(field => value && Object.hasOwn(value, field))];
  if (!hasFields(value, fields)) return undefined;
  if (!printable(value.animationName, 120) || !/^[\w, .-]+$/.test(value.animationName)) return undefined;
  if (!validTimes(value.animationDuration, true) || !validTimes(value.animationDelay, false)) return undefined;
  if (!printable(value.transform, 512) || !/^(?:none|matrix(?:3d)?\([\dEe+., -]+\))$/.test(value.transform)) return undefined;
  if (!printable(value.opacity, 24) || !NUMBER_VALUE.test(value.opacity) || !Number.isFinite(Number(value.opacity)) ||
      Number(value.opacity) < 0 || Number(value.opacity) > 1) return undefined;
  if (fields.includes('rotate') && (!printable(value.rotate, 120) || !ROTATE_VALUE.test(value.rotate) ||
      !(value.rotate.match(new RegExp(CSS_NUMBER, 'g')) || []).every(number => Number.isFinite(Number(number))))) return undefined;
  if (fields.includes('backgroundPosition') && (!printable(value.backgroundPosition, 120) || !POSITION_VALUE.test(value.backgroundPosition))) return undefined;
  if (fields.includes('strokeDashoffset') && (!printable(value.strokeDashoffset, 32) || !STROKE_OFFSET_VALUE.test(value.strokeDashoffset) ||
      !Number.isFinite(parseFloat(value.strokeDashoffset)) || Math.abs(parseFloat(value.strokeDashoffset)) > 10000)) return undefined;
  return Object.fromEntries(fields.map(field => [field, value[field]]));
}

export function sanitizeMotionDiagnostic(data) {
  if (typeof data !== 'string' || Buffer.byteLength(data, 'utf8') > 6144) return null;
  let report;
  try { report = JSON.parse(data); } catch { return null; }
  const hasGeometry = report && Object.hasOwn(report, 'geometry');
  const hasHit = report && Object.hasOwn(report, 'hit');
  const hasHealth = report && Object.hasOwn(report, 'health');
  const fields = [...REPORT_FIELDS, ...(hasGeometry ? ['geometry'] : []), ...(hasHit ? ['hit'] : []), ...(hasHealth ? ['health'] : [])];
  if (!hasFields(report, fields) || !['load', 'click', 'scroll'].includes(report.event) ||
      !['social', 'music', 'arrows', 'weather', 'language'].includes(report.target) || !integerBetween(report.sequence, 1, 1000000) ||
      ![0, 250, 1000, 3000, 7000, 14000, 30000].includes(report.offsetMs) || !integerBetween(report.width, 0, 10000) ||
      !integerBetween(report.height, 0, 10000) || !printable(report.ua, 160) ||
      !['mobile', 'rangeMobile', 'reducedMotion'].every(field => typeof report[field] === 'boolean')) return null;
  let list = null;
  if (report.list !== null) {
    if (!hasFields(report.list, LIST_FIELDS) || typeof report.list.open !== 'boolean' || typeof report.list.hidden !== 'boolean') return null;
    list = { open: report.list.open, hidden: report.list.hidden };
    for (const field of ['first', 'last', 'firstIcon', 'lastIcon']) {
      const value = sanitizeStyles(report.list[field]);
      if (value === undefined) return null;
      list[field] = value;
    }
  }
  let geometry;
  if (hasGeometry) {
    const hasPlacement = report.geometry && Object.hasOwn(report.geometry, 'header');
    const geometryFields = [...GEOMETRY_FIELDS, ...(hasPlacement ? PLACEMENT_FIELDS : [])];
    if ((hasPlacement && report.target !== 'weather') || !hasFields(report.geometry, geometryFields)) return null;
    geometry = {};
    for (const field of geometryFields) {
      const rect = report.geometry[field];
      if (rect === null) { geometry[field] = null; continue; }
      if (!hasFields(rect, RECT_FIELDS) || !RECT_FIELDS.every(key => Number.isFinite(rect[key]) &&
          Math.abs(rect[key]) <= 20000 && (!['width', 'height'].includes(key) || rect[key] >= 0))) return null;
      geometry[field] = Object.fromEntries(RECT_FIELDS.map(key => [key, rect[key]]));
    }
  }
  let hit;
  if (hasHit) {
    if (report.target !== 'weather' || !hasFields(report.hit, HIT_FIELDS) ||
        !HIT_FIELDS.every(field => report.hit[field] === null || typeof report.hit[field] === 'boolean')) return null;
    hit = Object.fromEntries(HIT_FIELDS.map(field => [field, report.hit[field]]));
  }
  let health;
  if (hasHealth) {
    const value = report.health;
    const assistantPulse = value?.assistantPulse === null ? null : sanitizeStyles(value?.assistantPulse);
    if (report.target !== 'weather' || !hasFields(value, HEALTH_FIELDS) ||
        !['loading', 'true', 'false', 'error', 'unknown'].includes(value.mounted) ||
        !['gps', 'cache', 'stale-cache', 'manual', 'fallback', 'unavailable', 'unknown'].includes(value.geoSource) ||
        !['true', 'false', 'unavailable', 'unknown'].includes(value.geoResolved) ||
        !['none', 'denied', 'timeout', 'unavailable', 'aborted', 'unsupported', 'insecure', 'unknown'].includes(value.geoError) ||
        !['clear', 'blocked', 'missing', 'unknown'].includes(value.locationHit) ||
        !['clear', 'blocked', 'missing', 'unknown'].includes(value.locationDocumentHit) ||
        !['granted', 'denied', 'prompt', 'unknown'].includes(value.permission) ||
        !['refreshing', 'loading', 'weatherError', 'sceneFallback', 'online', 'geoPending', 'geoSupported', 'secure', 'visible', 'locationDisabled', 'assistantHidden'].every(field => typeof value[field] === 'boolean') ||
        !(value.assistantOpacity === null || (Number.isFinite(value.assistantOpacity) && value.assistantOpacity >= 0 && value.assistantOpacity <= 1)) ||
        assistantPulse === undefined ||
        !['geoAgeMs', 'dataAgeMs', 'observationAgeMs'].every(field => value[field] === null || integerBetween(value[field], 0, 604800000)) ||
        !(value.geoAccuracy === null || (Number.isFinite(value.geoAccuracy) && value.geoAccuracy >= 0 && value.geoAccuracy <= 10000000)) ||
        !integerBetween(value.canvasCount, 0, 8) || !integerBetween(value.canvasWidth, 0, 16384) || !integerBetween(value.canvasHeight, 0, 16384)) return null;
    health = { ...Object.fromEntries(HEALTH_FIELDS.map(field => [field, value[field]])), assistantPulse };
  }
  return { ...Object.fromEntries(REPORT_FIELDS.map(field => [field, field === 'list' ? list : report[field]])),
    ...(hasGeometry ? { geometry } : {}), ...(hasHit ? { hit } : {}), ...(hasHealth ? { health } : {}) };
}

export function createMotionDiagnosticRecorder(filename) {
  const reports = [];
  let pending = Promise.resolve();
  return report => {
    reports.push(report);
    if (reports.length > 10) reports.shift();
    pending = pending.catch(() => {}).then(() => writeFile(filename, JSON.stringify(reports, null, 2), { mode: 0o600 }));
    return pending;
  };
}

// Passive preview telemetry: observe styles and genuine user clicks; never operate controls.
export const PREVIEW_MOTION_SCRIPT = String.raw`(function () {
  let sequence = 0;
  let geoPermission = null;
  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      navigator.permissions.query({ name: 'geolocation' }).then(function (value) { geoPermission = value; }).catch(function () {});
    }
  } catch (error) {}
  const weatherHealth = function (host, root) {
    const data = host && host.dataset || {};
    let state = null;
    try { state = host && host.__weatherWidgetInstance && host.__weatherWidgetInstance.getState && host.__weatherWidgetInstance.getState(); } catch (error) {}
    const number = function (value) { return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value); };
    const age = function (value) { const time = number(value); return time === null ? null : Math.min(604800000, Math.max(0, Math.round(Date.now() - time))); };
    const canvases = root && root.querySelectorAll ? root.querySelectorAll('canvas') : [];
    const canvas = canvases[0];
    const source = data.weatherManualLocation === 'true' ? 'manual' : data.weatherGeoSource;
    const observation = number(state && state.weather && state.weather.current && state.weather.current.last_updated_epoch);
    const locationButton = root && root.querySelector('.weather-location-selector__current');
    const assistant = document.querySelector('.hn-ai-launcher');
    const assistantStyle = assistant && getComputedStyle(assistant);
    const assistantSurface = assistant && assistant.querySelector('.hn-ai-launcher-surface');
    const assistantSurfaceStyle = assistantSurface ? getComputedStyle(assistantSurface) : assistantStyle;
    const locationRect = locationButton && locationButton.getBoundingClientRect();
    const hit = function (surface, expected) {
      if (!locationRect) return 'missing';
      if (typeof surface.elementFromPoint !== 'function') return 'unknown';
      const node = surface.elementFromPoint(locationRect.x + locationRect.width / 2, locationRect.y + locationRect.height / 2);
      return node && (node === expected || expected && typeof expected.contains === 'function' && expected.contains(node)) ? 'clear' : 'blocked';
    };
    return {
      mounted: ['loading', 'true', 'false', 'error'].includes(data.weatherMounted) ? data.weatherMounted : 'unknown',
      geoSource: ['gps', 'cache', 'stale-cache', 'manual', 'fallback', 'unavailable'].includes(source) ? source : 'unknown',
      geoResolved: ['true', 'false', 'unavailable'].includes(data.weatherGeoResolved) ? data.weatherGeoResolved : 'unknown',
      geoAccuracy: number(data.weatherGeoAccuracy), geoAgeMs: age(data.weatherGeoUpdatedAt),
      geoError: ['none', 'denied', 'timeout', 'unavailable', 'aborted', 'unsupported', 'insecure'].includes(data.weatherGeoError) ? data.weatherGeoError : 'unknown',
      geoPending: data.weatherGeoPending === 'true', geoSupported: !!(navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function'),
      secure: globalThis.isSecureContext === true, visible: document.hidden !== true,
      locationHit: locationButton ? hit(root, locationButton) : 'missing',
      locationDocumentHit: locationButton ? hit(document, host) : 'missing', locationDisabled: !!(locationButton && locationButton.disabled),
      assistantOpacity: assistantSurfaceStyle ? number(assistantSurfaceStyle.opacity) : null,
      assistantHidden: !assistantStyle || assistantStyle.display === 'none' || assistantStyle.visibility === 'hidden' || number(assistantStyle.opacity) === 0,
      assistantPulse: assistant ? (assistant.querySelector('.hn-ai-launcher-rim-trace')
        ? styles(assistant.querySelector('.hn-ai-launcher-rim-trace')) : styles(assistant, '::before')) : null,
      dataAgeMs: age(state && state.lastUpdatedAt || data.weatherDataUpdatedAt),
      observationAgeMs: observation === null ? null : age(observation * 1000),
      refreshing: data.weatherRefreshing === 'true', loading: !!(state && state.loading), weatherError: !!(state && state.error),
      canvasCount: Math.min(8, canvases.length), canvasWidth: Math.min(16384, canvas && canvas.width || 0), canvasHeight: Math.min(16384, canvas && canvas.height || 0),
      sceneFallback: !!(root && root.querySelector('.weather-app__scene-fallback')), online: navigator.onLine !== false,
      permission: geoPermission && ['granted', 'denied', 'prompt'].includes(geoPermission.state) ? geoPermission.state : 'unknown'
    };
  };
  const bounds = function (node) {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
  };
  const weatherHit = function (root, toggle) {
    const rect = toggle.getBoundingClientRect();
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const hit = function (x, y) {
      if (typeof root.elementFromPoint !== 'function') return null;
      const node = root.elementFromPoint(x, y);
      return !!node && (node === toggle || toggle.contains(node));
    };
    return { center: hit(centerX, centerY), above: hit(centerX, rect.y - 10),
      left: hit(rect.x - 8, centerY), right: hit(rect.x + rect.width + 8, centerY) };
  };
  const styles = function (node, pseudo) {
    if (!node) return null;
    const value = getComputedStyle(node, pseudo || null);
    return {
      animationName: value.animationName.slice(0, 120),
      animationDuration: value.animationDuration.slice(0, 80),
      animationDelay: value.animationDelay.slice(0, 80),
      transform: value.transform.slice(0, 512),
      opacity: value.opacity.slice(0, 24),
      rotate: (value.rotate || 'none').slice(0, 120),
      ...(node.classList && node.classList.contains('hn-ai-launcher-rim-trace') ? { strokeDashoffset: (value.strokeDashoffset || '0').slice(0, 32) } : {}),
      ...(pseudo ? { backgroundPosition: (value.backgroundPositionX && value.backgroundPositionY
        ? value.backgroundPositionX + ' ' + value.backgroundPositionY : value.backgroundPosition).slice(0, 120) } : {})
    };
  };
  const snapshot = function (event, target, sequence, offsetMs) {
    const arrows = target === 'arrows';
    const weather = target === 'weather';
    const language = target === 'language';
    const weatherHost = weather ? document.querySelector('[data-weather-variant="header"]') : null;
    const weatherRoot = weatherHost && weatherHost.shadowRoot;
    const list = weather ? weatherRoot && weatherRoot.querySelector('.weather-header-card__toggle') : document.querySelector(language ? '.header-controls .lang-dropdown-btn' : arrows ? '.price-scroll-controls' : target === 'social' ? '#social-icons-list' : '#social-service-picker');
    const links = list ? list.querySelectorAll(language ? 'i' : weather ? 'span' : arrows ? 'button[data-price-scroll]' : target === 'social' ? '.social-icon' : '.social-service-btn') : [];
    const first = links[0];
    const last = links[links.length - 1];
    const recovery = weatherRoot && !list ? weatherRoot.querySelector('.weather-header-state__inner') : null;
    const header = weatherHost && weatherHost.closest('header.header');
    const navigation = header && Array.from(header.querySelectorAll('.nav-main, .social-bar'))
      .filter(function (node) {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.height > 0 && rect.width > 0 && style.display !== 'none' &&
          style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.02;
      })
      .sort(function (first, second) { return second.getBoundingClientRect().bottom - first.getBoundingClientRect().bottom; })[0];
    const report = {
      event: event, target: target, sequence: sequence, offsetMs: offsetMs,
      width: Math.round(innerWidth), height: Math.round(innerHeight),
      mobile: matchMedia('(max-width: 900px)').matches,
      rangeMobile: matchMedia('(width <= 900px)').matches,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      ua: navigator.userAgent.slice(0, 160),
      ...(weather ? { health: weatherHealth(weatherHost, weatherRoot) } : {}),
      ...(weatherRoot && list ? { hit: weatherHit(weatherRoot, list) } : {}),
      geometry: {
        strip: bounds(language ? list && list.closest('.header-controls') : weatherRoot ? weatherRoot.querySelector('.weather-header-card') || recovery : document.querySelector('.social-bar-inner')),
        control: bounds(language ? list : weather ? weatherHost : document.querySelector('.social-motion-toggle')),
        list: bounds(list), first: bounds(first || recovery && recovery.querySelector('p')),
        last: bounds(last || recovery && recovery.querySelector('.weather-location-selector__current')),
        ...(weather ? { header: bounds(header), navigation: bounds(navigation), dropdown: bounds(weatherRoot && weatherRoot.querySelector('.weather-header-dropdown')) } : {})
      },
      list: list ? {
        open: language ? !!list.closest('.language-dropdown.open') : weather ? weatherHost.dataset.weatherExpanded === 'true' : arrows ? !!document.querySelector('.site-scroll-root.site-scroll-active') : list.classList.contains('is-open'), hidden: list.hidden,
        first: styles(first), last: styles(last),
        firstIcon: weather ? styles(list, '::before') : styles(first && first.querySelector(arrows ? '.site-icon-arrow' : 'i, img')),
        lastIcon: weather ? styles(list, '::after') : styles(last && last.querySelector(arrows ? '.site-icon-arrow' : 'i, img'))
      } : null
    };
    const data = JSON.stringify(report);
    if (data.length <= 6000) {
      fetch('/__preview_motion?data=' + encodeURIComponent(data), {
        method: 'GET', credentials: 'same-origin', cache: 'no-store', keepalive: true
      }).catch(function () {});
    }
  };
  const schedule = function (event, target) {
    const current = ++sequence;
    (target === 'weather' || target === 'language' ? [0, 250, 1000, 3000, 7000, 14000, 30000] : [0, 250, 1000, 3000]).forEach(function (offset) {
      setTimeout(function () { snapshot(event, target, current, offset); }, offset);
    });
  };
  const ready = function () { schedule('load', 'social'); schedule('load', 'music'); schedule('load', 'arrows'); schedule('load', 'weather'); schedule('load', 'language'); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, { once: true });
  else ready();
  document.addEventListener('click', function (event) {
    if (!event.isTrusted || !(event.target instanceof Element)) return;
    const weatherButton = typeof event.composedPath === 'function' && event.composedPath().find(function (node) {
      return node instanceof Element && node.matches('.weather-header-card__toggle, .weather-location-selector__current');
    });
    if (weatherButton) { schedule('click', 'weather'); return; }
    const button = event.target.closest('.social-icons-toggle, .social-player-toggle, [data-price-scroll], .lang-dropdown-btn');
    if (button) schedule('click', button.classList.contains('lang-dropdown-btn') ? 'language' : button.classList.contains('social-icons-toggle') ? 'social' : button.classList.contains('social-player-toggle') ? 'music' : 'arrows');
  }, { capture: true, passive: true });
  let lastScroll = 0;
  document.addEventListener('scroll', function (event) {
    const now = Date.now();
    if (!event.isTrusted || now - lastScroll < 4000) return;
    lastScroll = now;
    schedule('scroll', 'arrows');
  }, { capture: true, passive: true });
})();`;
