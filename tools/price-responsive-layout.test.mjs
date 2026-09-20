import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../assets/css/page-modules.css', import.meta.url), 'utf8');
test('price hero does not reserve an empty viewport-sized area', () => {
  assert.match(css, /\.price-page-hero\[data-price-hero\]\s*\{[^}]*min-height: 0;/);
  assert.ok(!css.includes('min-height: calc(100dvh - 18rem)'));
});
test('breed cards reflow based on available width and wrap long localized titles', () => {
  assert.ok(css.includes('repeat(auto-fit, minmax(min(100%, 18rem), 1fr))'));
  assert.match(css, /\.price-card__title\s*\{[^}]*overflow-wrap: anywhere;/);
});
