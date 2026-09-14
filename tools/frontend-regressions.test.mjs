import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('booking title remains readable inside narrow viewports', async () => {
  const styles = await readFile(path.join(root, 'assets/css/page-modules.css'), 'utf8');

  assert.match(styles, /\.booking-container \.booking-title \{[\s\S]*?max-width: 100%/);
  assert.match(styles, /\.booking-container \.booking-title \{[\s\S]*?overflow-wrap: anywhere/);
  assert.match(styles, /@media \(width <= 480px\) \{[\s\S]*?font-size: clamp\(1\.35rem, 6\.4vw, 1\.7rem\)/);
});

test('analytics ignores malformed Microsoft Clarity project IDs', async () => {
  const source = await readFile(path.join(root, 'assets/js/analytics.js'), 'utf8');
  const env = await readFile(path.join(root, 'config/env.js'), 'utf8');

  assert.match(source, /const isClarityProjectId = value => \/\^\[a-z0-9\]\{6,24\}\$\/i/);
  assert.match(source, /if \(!isClarityProjectId\(id\) \|\| window\.__hundesalonClarityReady\)/);
  assert.match(env, /export const MS_CLARITY_ID = ''/);
  assert.doesNotMatch(env, /efbb2b19-7440-48bf-bc3a-166725c69d1b/);
});

test('weather geocoding rejects the technical Null Island coordinate', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');

  assert.match(source, /!\(latitude === 0 && longitude === 0\)/);
  assert.match(source, /if \(headerWeatherReverseGeoProxyUnavailable \|\| !hasValidHeaderWeatherCoordinates\(latitude, longitude\)\)/);
});
