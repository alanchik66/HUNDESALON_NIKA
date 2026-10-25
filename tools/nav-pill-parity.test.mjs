import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');

test('price categories use the same plasma effect as gallery tabs', () => {
  const effects = source.slice(source.indexOf('const mountActivePlasma ='), source.indexOf('const siteArrowActivationAnimations ='));
  assert.ok(effects.includes('.filter-btn'));
  assert.ok(effects.includes("addEventListener('mouseenter'"));
  assert.ok(effects.includes("addEventListener('focus'"));
  assert.ok(effects.includes('playNavPillClickFlash(link);'));
  assert.ok(!effects.includes('data-price-section-action'));
  assert.ok(!source.includes('mountPlasmaGlobe'));
});
