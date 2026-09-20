import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

test('breed counter uses compact supporting typography at every breakpoint', () => {
  const css = readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
  const blocks = [...css.matchAll(/body\.price-page \.price-page-hero\[data-price-hero\] \.price-breed-search__result-count\s*\{([^}]+)\}/g)].map(match => match[1]);
  assert.equal(blocks.length, 3);
  assert.match(blocks[0], /font-family:\s*var\(--font-body\)/);
  assert.match(blocks[0], /letter-spacing:\s*normal/);
  for (const block of blocks) {
    assert.match(block, /font-size:\s*(16|18)px;/);
    assert.doesNotMatch(block, /liquid-gold|font-display/);
  }
});
