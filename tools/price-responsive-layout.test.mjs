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

const priceSource = readFileSync(new URL('../assets/js/price-page.js', import.meta.url), 'utf8');
const placementSource = priceSource.slice(
  priceSource.indexOf('  const positionBreedMenu = toggle => {'),
  priceSource.indexOf('  const startBreedArrowCloseAnimation = toggle => {')
);

function placeBreedMenu({ width, height, top, scale = 1, cardWidth = width - 40 }) {
  const buttonHeight = 44 * scale;
  const controlRect = { left: 20, top, height: buttonHeight };
  const toggleRect = { ...controlRect, right: 140, bottom: top + buttonHeight };
  const rowRect = { left: 20, right: width - 20, width: width - 40 };
  const menu = {
    style: {}, dataset: {},
    getBoundingClientRect: () => ({ height: Math.min(460, Number.parseFloat(menu.style.maxHeight) * scale) }),
  };
  const control = { offsetHeight: 44, getBoundingClientRect: () => controlRect };
  const card = {
    getBoundingClientRect: () => ({ ...rowRect, width: cardWidth }),
    closest: () => ({ getBoundingClientRect: () => rowRect }),
  };
  const toggle = {
    dataset: { priceBreedsToggle: 'breeds' },
    getBoundingClientRect: () => toggleRect,
    closest: selector => selector === '.price-card__breed-control' ? control : card,
  };
  const position = new Function('window', 'document', 'syncBreedMenuScrollIndicator',
    `${placementSource}\nreturn positionBreedMenu;`
  )({ innerHeight: height }, { getElementById: () => menu }, () => {});
  position(toggle);
  const menuTop = top + Number.parseFloat(menu.style.top) * scale;
  const left = controlRect.left + Number.parseFloat(menu.style.left) * scale;
  return {
    menu, toggleRect, top: menuTop, bottom: menuTop + menu.getBoundingClientRect().height,
    left, right: left + Number.parseFloat(menu.style.width) * scale,
  };
}

test('narrow breed menus leave their toggle uncovered and fit above or below it', () => {
  for (const width of [320, 375, 390, 430, 480]) {
    for (const scale of [0.8, 0.96, 1]) {
      for (const buttonTop of [200, 760]) {
        const result = placeBreedMenu({ width, height: 932, top: buttonTop, scale });
        assert.ok(['above', 'below'].includes(result.menu.dataset.priceMenuAlign));
        assert.ok(result.top >= 19 && result.bottom <= 913);
        assert.ok(result.left >= 19 && result.right <= width - 19);
        const gap = result.menu.dataset.priceMenuAlign === 'below'
          ? result.top - result.toggleRect.bottom
          : result.toggleRect.top - result.bottom;
        assert.ok(gap >= 11, `width=${width}, scale=${scale}, gap=${gap}`);
      }
    }
  }
});

test('wide breed menus preserve their lateral placement', () => {
  for (const scale of [0.8, 0.96, 1]) {
    const result = placeBreedMenu({ width: 1440, height: 900, top: 300, cardWidth: 400, scale });
    assert.equal(result.menu.dataset.priceMenuAlign, 'start');
    assert.ok(Math.abs(result.left - result.toggleRect.right - 12) < 0.01);
    assert.ok(result.top >= 19 && result.bottom <= 881);
  }
});

test('an open breed menu stays inside the resized viewport when its anchor leaves view', () => {
  for (const top of [-80, 760]) {
    for (const scale of [0.8, 0.96, 1]) {
      const result = placeBreedMenu({ width: 430, height: 430, top, scale });
      assert.ok(result.top >= 19 && result.bottom <= 411);
    }
  }
});
