import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { PREVIEW_MOTION_SCRIPT, sanitizeMotionDiagnostic } from './lib/preview-motion-diagnostics.mjs';

test('passive phone layout reports accept only bounded public element rectangles', () => {
  const geometry = {
    strip: { x: 12, y: 180, width: 351, height: 44 },
    control: { x: 150, y: 228, width: 213, height: 44 },
    list: null, first: null, last: null,
  };
  const report = { event: 'load', target: 'social', sequence: 1, offsetMs: 0,
    width: 375, height: 615, mobile: true, rangeMobile: true, reducedMotion: true,
    ua: 'iPhone test fixture', list: null, geometry };
  assert.deepEqual(sanitizeMotionDiagnostic(JSON.stringify(report)).geometry, geometry);
  for (const value of [-1, 20001, '375']) {
    const invalid = structuredClone(report);
    invalid.geometry.control.width = value;
    assert.equal(sanitizeMotionDiagnostic(JSON.stringify(invalid)), null);
  }
  const extra = structuredClone(report);
  extra.geometry.control.text = 'private data';
  assert.equal(sanitizeMotionDiagnostic(JSON.stringify(extra)), null);
  assert.match(PREVIEW_MOTION_SCRIPT, /getBoundingClientRect\(\)/);
  assert.doesNotMatch(PREVIEW_MOTION_SCRIPT, /\.click\(|localStorage|document\.cookie/);
});

test('arrow motion reports retain finite individual rotation without accepting invalid CSS values', () => {
  const style = { animationName: 'iconSiteArrowMotion', animationDuration: '4s', animationDelay: '0s',
    transform: 'matrix(1, 0, 0, 1, 0, -3)', opacity: '1', rotate: '268.245deg' };
  const report = { event: 'scroll', target: 'arrows', sequence: 4, offsetMs: 250,
    width: 375, height: 615, mobile: true, rangeMobile: true, reducedMotion: true,
    ua: 'iPhone test fixture', list: { open: true, hidden: false,
      first: style, last: style, firstIcon: style, lastIcon: style } };
  assert.equal(sanitizeMotionDiagnostic(JSON.stringify(report)).list.firstIcon.rotate, '268.245deg');
  for (const rotate of ['NaNdeg', '1e309deg', 'rotate(1deg)', 'private text']) {
    const invalid = structuredClone(report);
    invalid.list.firstIcon.rotate = rotate;
    assert.equal(sanitizeMotionDiagnostic(JSON.stringify(invalid)), null);
  }
});

test('weather telemetry observes shadow button bounds and a complete rim cycle without operating controls', () => {
  const timers = [];
  const requests = [];
  const listeners = new Map();
  const hitPoints = [];
  class Element {
    matches(selector) { return this.isToggle && selector.includes('.weather-header-card__toggle'); }
    closest() { return null; }
    getBoundingClientRect() { return this.rect; }
  }
  const label = Object.assign(new Element(), { rect: { x: 100, y: 140, width: 70, height: 8 } });
  const arrow = Object.assign(new Element(), { rect: { x: 174, y: 140, width: 8, height: 8 } });
  const toggle = Object.assign(new Element(), { isToggle: true, hidden: false, querySelectorAll: () => [label, arrow], rect: { x: 92, y: 135, width: 98, height: 18 } });
  const host = Object.assign(new Element(), { rect: { x: 12, y: 60, width: 351, height: 120 }, dataset: { weatherExpanded: 'true' }, shadowRoot: {
    querySelector: selector => selector === '.weather-header-card__toggle' ? toggle : { getBoundingClientRect: () => ({ x: 12, y: 60, width: 351, height: 120 }) },
    elementFromPoint: (x, y) => { hitPoints.push([x, y]); return toggle; },
  } });
  const base = { animationName: 'none', animationDuration: '0s', animationDelay: '0s', transform: 'none', opacity: '1', rotate: 'none', backgroundPosition: '0% 50%' };
  runInNewContext(PREVIEW_MOTION_SCRIPT, {
    document: { readyState: 'complete', querySelector: selector => selector === '[data-weather-variant="header"]' ? host : null,
      addEventListener: (type, handler) => listeners.set(type, handler) },
    Element, innerWidth: 375, innerHeight: 615, navigator: { userAgent: 'iPhone fixture' },
    matchMedia: () => ({ matches: true }),
    getComputedStyle: (node, pseudo) => ({ ...base,
      ...(node === arrow ? { animationName: 'siteArrowDirectionalBounce', animationDuration: '2.35s' } : {}),
      ...(node === toggle && pseudo === '::before' ? { animationName: 'weatherHeaderMenuRimFlow', animationDuration: '12.8s', backgroundPosition: '0% 0%', backgroundPositionX: '72.5%', backgroundPositionY: '50%' } : {}) }),
    setTimeout: (callback, offset) => timers.push({ callback, offset }),
    fetch: (url, options) => { requests.push({ url, options }); return Promise.resolve(); },
  });
  assert.equal(timers.length, 26);
  listeners.get('click')({ isTrusted: true, target: host, composedPath: () => [arrow, toggle, host] });
  assert.deepEqual(timers.slice(-7).map(timer => timer.offset), [0, 250, 1000, 3000, 7000, 14000, 30000]);
  timers.at(-1).callback();
  const report = sanitizeMotionDiagnostic(new URL(requests[0].url, 'http://localhost').searchParams.get('data'));
  assert.equal(report.target, 'weather');
  assert.equal(report.offsetMs, 30000);
  assert.equal(report.list.last.animationName, 'siteArrowDirectionalBounce');
  assert.equal(report.list.firstIcon.animationDuration, '12.8s');
  assert.equal(report.list.firstIcon.backgroundPosition, '72.5% 50%');
  assert.equal(report.geometry.last.x - (report.geometry.first.x + report.geometry.first.width), 4);
  assert.deepEqual(report.hit, { center: true, above: true, left: true, right: true });
  assert.equal(report.health.geoAccuracy, null);
  assert.equal(report.health.geoAgeMs, null);
  assert.equal(report.health.permission, 'unknown');
  assert.equal(report.health.canvasCount, 0);
  assert.equal(report.health.weatherError, false);
  assert.deepEqual(hitPoints, [[187.5, 120], [141, 144], [141, 125], [84, 144], [198, 144]]);
  const invalid = structuredClone(report);
  invalid.list.firstIcon.backgroundPosition = 'url(private-data)';
  assert.equal(sanitizeMotionDiagnostic(JSON.stringify(invalid)), null);
  const invalidHit = structuredClone(report);
  invalidHit.hit.above = 'private-data';
  assert.equal(sanitizeMotionDiagnostic(JSON.stringify(invalidHit)), null);
});

test('weather health diagnostics retain bounded status without accepting device coordinates or private text', () => {
  const health = { mounted: 'true', geoSource: 'gps', geoResolved: 'true', geoAccuracy: 12,
    geoError: 'none', geoPending: false, geoSupported: true, secure: true, visible: true,
    locationHit: 'clear', locationDocumentHit: 'clear', locationDisabled: false,
    assistantOpacity: 0.2, assistantHidden: false,
    assistantPulse: null,
    geoAgeMs: 1000, dataAgeMs: 5000, observationAgeMs: 600000, refreshing: false, loading: false,
    weatherError: false, canvasCount: 1, canvasWidth: 900, canvasHeight: 360,
    sceneFallback: false, online: true, permission: 'granted' };
  const report = { event: 'load', target: 'weather', sequence: 1, offsetMs: 14000,
    width: 375, height: 615, mobile: true, rangeMobile: true, reducedMotion: true,
    ua: 'iPhone test fixture', list: null, health };
  assert.deepEqual(sanitizeMotionDiagnostic(JSON.stringify(report)).health, health);
  for (const [field, value] of [['latitude', 51.35], ['address', 'private'], ['permission', 'private'],
    ['geoAccuracy', -1], ['geoAgeMs', 604800001], ['dataAgeMs', '1'], ['canvasWidth', 16385]]) {
    const invalid = structuredClone(report);
    invalid.health[field] = value;
    assert.equal(sanitizeMotionDiagnostic(JSON.stringify(invalid)), null, field);
  }
  const wrongTarget = { ...report, target: 'social' };
  assert.equal(sanitizeMotionDiagnostic(JSON.stringify(wrongTarget)), null);
  assert.doesNotMatch(PREVIEW_MOTION_SCRIPT, /\.(?:getCurrentPosition|watchPosition)\s*\(|latitude|longitude/);
});
