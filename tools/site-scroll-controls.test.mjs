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

test('scroll arrow clicks retain smooth movement when the system requests reduced motion', () => {
  const body = main.match(/scrollControls\.addEventListener\('click', event => \{([\s\S]*?)\n  \}\);/)[1];
  const calls = [];
  const scroller = { scrollHeight: 2400, scrollTo: options => calls.push(options) };
  const handleClick = new Function('event', 'document', 'window', body);
  for (const direction of ['top', 'bottom']) {
    handleClick(
      { target: { closest: () => ({ dataset: { priceScroll: direction } }) } },
      { querySelector: () => scroller },
      { matchMedia: () => ({ matches: true }) }
    );
  }
  assert.deepEqual(calls, [{ top: 0, behavior: 'smooth' }, { top: 2400, behavior: 'smooth' }]);
});

test('shared arrow activation keeps its configured turns and duration under reduced motion', () => {
  const controls = main.match(/  const siteArrowActivationAnimations = new WeakMap\(\);[\s\S]*?  const playSiteArrowActivation = \(control, state = \{\}\) => \{[\s\S]*?\n  \};/)[0];
  const animations = [];
  const arrow = {
    animate(frames, options) {
      const animation = { frames, options, addEventListener() {}, cancel() { this.cancelled = true; } };
      animations.push(animation);
      return animation;
    },
  };
  const values = { '--site-arrow-activation-duration': '1800ms', '--site-arrow-activation-turn-count': '3' };
  const play = new Function('document', 'getComputedStyle', 'window', 'prefersReducedMotion', `${controls}\nreturn playSiteArrowActivation;`)(
    { documentElement: {} },
    () => ({ getPropertyValue: name => values[name] || '' }),
    { matchMedia: () => ({ matches: true }) },
    true
  );
  const control = { dataset: {}, matches: () => false, querySelectorAll: () => [arrow] };
  play(control);
  assert.equal(animations.length, 1);
  assert.deepEqual(animations[0].frames, [{ rotate: '0deg' }, { rotate: '1080deg' }]);
  assert.equal(animations[0].options.duration, 1800);
  play(control);
  assert.equal(animations[0].cancelled, true, 'repeated activation must still replace the old animation');
  assert.equal(control.dataset.siteArrowActivationTurns, '3');
});
