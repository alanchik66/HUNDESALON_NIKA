import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cloudPixel, cloudTopFromColor, decodeCloudGrid, isInSatelliteCoverage, isRecentCloudSnapshot, raySurfacePosition, sampleCloudGrid,
  sampleLunarCloudRay, skyDirectionFromCloudProjection, validateCloudSnapshot,
} from '../assets/js/header-weather-satellite-clouds.js';

const now = Date.parse('2026-11-20T19:45:00Z');
const observedAt = '2026-11-20T19:15:00Z';
const snapshot = {
  source: 'eumetsat-msg', observedAt, bbox: [12.25, 51.2, 12.55, 51.44],
  width: 16, height: 16, maskPng: 'iVBORw0KGgo=', cloudTopPng: null,
};

test('fresh bounded satellite frames accept their own time and reject bad metadata and imagery', () => {
  assert.equal(validateCloudSnapshot(snapshot, now), true);
  assert.equal(isRecentCloudSnapshot(snapshot, now + 31 * 60000), false);
  assert.equal(isRecentCloudSnapshot(snapshot, now - 32 * 60000), false);
  for (const data of [
    { source: 'forecast' }, { bbox: [13, 51, 12, 50] }, { bbox: [11, 49, 17, 52] }, { bbox: [5, 47, 16, 56] },
    { width: 385 },
    { width: 65535 }, { maskPng: 'data:image/png;base64,iVBORw0KGgo=' }, { cloudTopPng: 'bad' },
  ]) {
    assert.equal(validateCloudSnapshot({ ...snapshot, ...data }, now), false);
  }
});

test('the fixed German raster covers Hamburg and does not expand with the viewer location', () => {
  assert.ok(validateCloudSnapshot({ ...snapshot, bbox: [5, 47, 16, 55.8], width: 384, height: 384 }, now));
  assert.equal(isInSatelliteCoverage({ latitude: 53.55, longitude: 9.99 }), true);
  assert.equal(isInSatelliteCoverage({ latitude: 51.32, longitude: 12.4 }), true);
  assert.equal(isInSatelliteCoverage({ latitude: 55.9, longitude: 9.99 }), false);
  assert.equal(isInSatelliteCoverage({ latitude: 47.1, longitude: 4.9 }), false);
  assert.equal(isInSatelliteCoverage({ latitude: null, longitude: 9.99 }), false);
});

test('MSG Cloud Mask categories and cloud top legend distinguish clouds, clear land, clear water and unknown', () => {
  assert.equal(cloudPixel(255, 255, 255, 255), 1);
  assert.equal(cloudPixel(0, 192, 0, 255), 0);
  assert.equal(cloudPixel(0, 0, 192, 255), 0);
  assert.equal(cloudPixel(0, 0, 0, 0), 255);
  assert.equal(cloudPixel(0, 0, 0, 255), 255);
  assert.ok(Math.abs(cloudTopFromColor(0, 192, 0, 255) - 7.7) < .7);
  assert.ok(Math.abs(cloudTopFromColor(255, 255, 255, 255) - 16) < .2);
  assert.equal(cloudTopFromColor(255, 255, 255, 0), null);
});

test('north is the top of the raster and unknown samples are not misread as clear', () => {
  const size = 4 * snapshot.width * snapshot.height;
  const raw = new Uint8ClampedArray(size), top = new Uint8ClampedArray(size);
  for (let y = 0; y < snapshot.height; y += 1) {
    for (let x = 0; x < snapshot.width; x += 1) {
      const i = 4 * (y * snapshot.width + x);
      raw.set(x < 4 ? [0, 0, 0, 0] : y < 8 ? [255, 255, 255, 255] : [0, 192, 0, 255], i);
      top.set([0, 192, 0, 255], i);
    }
  }
  const grid = decodeCloudGrid(snapshot, raw, top);
  assert.ok(grid);
  assert.equal(sampleCloudGrid(grid, { latitude: 51.4, longitude: 12.45 }).fraction, 1);
  assert.ok(sampleCloudGrid(grid, { latitude: 51.4, longitude: 12.45 }).topKm > 7);
  assert.deepEqual(sampleCloudGrid(grid, { latitude: 51.23, longitude: 12.45 }), { fraction: 0, topKm: null });
  assert.equal(sampleCloudGrid(grid, { latitude: 51.4, longitude: 12.26 }), null);
  assert.equal(sampleCloudGrid(grid, { latitude: 50, longitude: 12.45 }), null);
  assert.equal(decodeCloudGrid(snapshot, new Uint8ClampedArray(size), null), null);
});

test('topocentric rays head east or west according to lunar azimuth and preserve unknown horizons', () => {
  const observer = { latitude: 51.32, longitude: 12.4 };
  const east = raySurfacePosition(observer.latitude, observer.longitude, 90, 45, 5);
  const west = raySurfacePosition(observer.latitude, observer.longitude, 270, 45, 5);
  assert.ok(east.longitude > 12.46);
  assert.ok(west.longitude < 12.34);
  assert.equal(raySurfacePosition(observer.latitude, observer.longitude, 90, 4, 5), null);
  const mask = new Uint8Array(snapshot.width * snapshot.height);
  const tops = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) {
    if (i % snapshot.width >= 8) {
      mask[i] = 1;
      tops[i] = 7.7;
    }
  }
  const grid = { ...snapshot, mask, tops };
  const cloudy = sampleLunarCloudRay(grid, observer, 45, 90);
  const clear = sampleLunarCloudRay(grid, observer, 45, 270);
  assert.ok(cloudy > .6 && clear === 0, `cloudy=${cloudy}; clear=${clear}`);
  assert.equal(sampleLunarCloudRay(grid, observer, 2, 90), null);
  assert.equal(sampleLunarCloudRay(grid, { latitude: 51, longitude: 10 }, 45, 90), null);
});

test('observed rays follow the existing dome orientation around the south-facing lunar marker', () => {
  const south = skyDirectionFromCloudProjection(0, .42);
  const eastOfSouth = skyDirectionFromCloudProjection(-.1, .42);
  const westOfSouth = skyDirectionFromCloudProjection(.1, .42);
  assert.equal(south.azimuth, 180);
  assert.ok(south.elevation > 43 && south.elevation < 46);
  assert.ok(eastOfSouth.azimuth < 180 && westOfSouth.azimuth > 180);
  assert.equal(skyDirectionFromCloudProjection(0, -.5).azimuth, 0);
  assert.equal(skyDirectionFromCloudProjection(-.5, 0).azimuth, 90);
});
