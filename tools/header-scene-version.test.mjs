import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'espree';

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

test('the Sun renderer inherits its complete module query when importing the shared solar clock', async () => {
  const scene = await readFile(new URL('../assets/js/header-weather-sun-scene.js', import.meta.url), 'utf8');
  const program = parse(scene, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const imported = program.body.filter(node => node.type === 'VariableDeclaration')
    .flatMap(node => node.declarations).find(node => node.init?.type === 'AwaitExpression')?.init.argument;
  assert.equal(imported?.type, 'ImportExpression');
  const expression = scene.slice(...imported.source.range).replaceAll('import.meta.url', 'sceneModuleUrl');
  const clockUrl = new Function('sceneModuleUrl', 'URL', `return ${expression};`);
  for (const query of ['?v=release-one', '?v=release%26variant&weather-retry=2', '?qa=local&dpr=3']) {
    const original = new URL(`https://hundesalon-nika.com/assets/js/header-weather-sun-scene.js${query}`);
    const clock = new URL(clockUrl(original.href, URL));
    assert.equal(clock.pathname, '/assets/js/weather-solar-time.js');
    assert.equal(clock.search, original.search, 'an immutable cached clock must follow the scene version and retry');
  }
});
