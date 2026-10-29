import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');
const price = readFileSync(new URL('../assets/js/price-page.js', import.meta.url), 'utf8');
const sharedStyles = readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
const pageStyles = readFileSync(new URL('../assets/css/page-modules.css', import.meta.url), 'utf8');
test('page scroll controls belong to the shared entry point, without price-page duplicates', () => {
  assert.equal((main.match(/scrollControls.className = 'price-scroll-controls'/g) || []).length, 1);
  assert.doesNotMatch(price, /scrollControls.className = 'price-scroll-controls'/);
  assert.match(main, /document.body.appendChild\(scrollControls\)/);
  assert.match(main, /button.dataset.priceScroll === 'top' \? 0 : scroller.scrollHeight/);
  for (const label of ['В начало страницы', 'На початок сторінки', 'Zum Seitenanfang', 'Back to top']) {
    assert.ok(main.includes(label));
  }
});

test('shared scroll controls do not depend on the optional page modules stylesheet', () => {
  const controlStyles = sharedStyles.match(/^\.price-scroll-controls\s*\{([^}]+)\}/m)?.[1];
  assert.ok(controlStyles, 'the stylesheet loaded by every page must position the shared controls');
  assert.match(controlStyles, /position:\s*fixed/);
  assert.match(controlStyles, /right:\s*max\(2px, env\(safe-area-inset-right\)\)/);
  assert.doesNotMatch(pageStyles, /(?:^|\n)\.price-scroll-controls\s*\{/);
});
