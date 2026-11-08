import assert from 'node:assert/strict';
import test from 'node:test';
import { hasOutdatedBusinessCity } from './lib/project-city-content.mjs';

test('internal documentation, memory, graph and development tools can discuss astronomy cities', () => {
  for (const file of ['docs/release.md', 'knowledge/03_Resources/astronomy.md', 'memory-bank/activeContext.md',
    'graphify-out/graph.json', 'graphify-out/2026-11-07/graph.json', 'tools/astronomy-fixture.mjs',
    '.\\memory-bank\\activeContext.md']) {
    assert.equal(hasOutdatedBusinessCity(file, 'Reference city: Berlin'), false, file);
  }
});

test('JavaScript test fixtures are development content regardless of their source directory', () => {
  for (const file of ['functions/api/weather.test.js', 'workers/solar.test.mjs', 'src/solar.test.cjs']) {
    assert.equal(hasOutdatedBusinessCity(file, 'Compare Berlin and Sydney astronomy'), false, file);
  }
});

test('public HTML, runtime assets and business configuration still reject the outdated business city', () => {
  for (const file of ['de/index.html', 'en/kontakty.html', 'ru/kontakty.html', 'uk/kontakty.html',
    'assets/js/site-shell.js', 'assets/css/style.css', 'config/brand-profiles.mjs', 'data/documents.json',
    'functions/api/business.js', 'tools-extra/business.js', 'de/docs/history.html', 'assets/tools/public.js', 'assets\\tools\\public.js',
    'assets/js/test-helper.js', 'src/solar.spec.js']) {
    assert.equal(hasOutdatedBusinessCity(file, '{"addressLocality":"BERLIN"}'), true, file);
  }
});

test('the exact Europe/Berlin timezone exception never hides a separate outdated business address', () => {
  assert.equal(hasOutdatedBusinessCity('config/env.js', 'const timezone="Europe/Berlin";'), false);
  assert.equal(hasOutdatedBusinessCity('assets/js/solar.js', '"Europe/Berlin"; "Europe/Berlin";'), false);
  assert.equal(hasOutdatedBusinessCity('de/index.html', 'Europe/Berlin; addressLocality: Berlin'), true);
  assert.equal(hasOutdatedBusinessCity('config/env.js', 'const timezone="Europe/BERLIN";'), true);
  assert.equal(hasOutdatedBusinessCity('config/env.js', 'const timezone="europe/Berlin";'), true);
  assert.equal(hasOutdatedBusinessCity('de/index.html', 'addressLocality: Leipzig'), false);
  assert.equal(hasOutdatedBusinessCity('assets/js/copy.js', 'Berliner reference'), false);
});
