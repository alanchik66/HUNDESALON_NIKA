import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
const body = source.match(/function resolveHeaderWeatherSunSceneModuleUrl\(\) \{([\s\S]*?)\n  \}/)?.[1];
assert.ok(body, 'the runtime scene resolver must be present');
const resolve = new Function('document', 'window', 'WEATHER_WIDGET_ASSET_VERSION', body);
const location = { href: 'https://hundesalon-nika.com/de/prays-list.html' };

test('scene imports inherit each deployed shell version for immutable cache invalidation', () => {
  for (const version of ['release-one', 'release-two', 'release&variant']) {
    const document = {
      querySelector: () => ({
        src: `https://hundesalon-nika.com/assets/js/site-shell.js?v=${encodeURIComponent(version)}`,
      }),
    };
    const url = new URL(resolve(document, { location }, 'legacy-scene'));
    assert.equal(url.pathname, '/assets/js/header-weather-sun-scene.js');
    assert.equal(url.searchParams.get('v'), version);
    assert.equal([...url.searchParams.keys()].length, 1);
  }
});

test('unversioned and missing shell scripts keep the standalone scene fallback', () => {
  for (const shellScript of [null, { src: 'https://hundesalon-nika.com/assets/js/site-shell.js' }]) {
    const url = new URL(resolve({ querySelector: () => shellScript }, { location }, 'legacy-scene'));
    assert.equal(url.pathname, '/assets/js/header-weather-sun-scene.js');
    assert.equal(url.searchParams.get('v'), 'legacy-scene');
  }
});
