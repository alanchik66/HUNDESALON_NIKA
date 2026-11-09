import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';

const filenames = ['style.css', 'page-modules.css', 'ai-chat.css', 'shop.css', 'social-page.css', 'telegram-menu.css', 'price-booking-flow.css', 'reviews-page.css'];
const stylesheet = async filename => postcss.parse(await readFile(new URL(`../assets/css/${filename}`, import.meta.url), 'utf8'));
const rulesFor = (root, selector) => {
  const rules = [];
  root.walkRules(rule => { if (rule.selector === selector) rules.push(rule); });
  return rules;
};
const declaration = (rule, property) => rule?.nodes.find(node => node.type === 'decl' && node.prop === property)?.value;

test('authored page and component styles do not cancel motion through OS or performance preferences', async () => {
  for (const filename of filenames) {
    const root = await stylesheet(filename);
    root.walkAtRules('media', rule => {
      assert.doesNotMatch(rule.params, /prefers-reduced-motion/, `${filename}: normal motion must not depend on the system preference`);
    });
    root.walkRules(rule => {
      if (!/html\.site-perf-(?:lite|balanced)/.test(rule.selector)) return;
      rule.walkDecls(decl => {
        if (/^(?:animation|animation-name|transition)$/.test(decl.prop)) {
          assert.notEqual(decl.value, 'none', `${filename}: ${rule.selector} must retain its authored motion`);
        }
        if (decl.prop === 'transform' && decl.important) {
          assert.notEqual(decl.value, 'none', `${filename}: performance styles must not cancel hover or entry transforms`);
        }
      });
    });
  }
});

test('scroll arrows retain their directional bounce, mobile rhythm and interaction visibility', async () => {
  const root = await stylesheet('style.css');
  const base = rulesFor(root, '.site-icon-arrow')[0];
  assert.equal(declaration(base, 'animation'), 'siteArrowDirectionalBounce 2.35s ease-in-out infinite');
  const mobile = rulesFor(root, '.price-scroll-controls .site-icon-arrow').find(rule => declaration(rule, 'animation-duration'));
  assert.match(mobile.parent.params, /900px/);
  assert.equal(declaration(mobile, 'animation-duration'), '4s');
  assert.equal(declaration(mobile, '--site-arrow-bounce-peak'), '7px');
  assert.equal(declaration(mobile, '--site-arrow-bounce-settle'), '0px');
  assert.equal(declaration(mobile, '--site-arrow-bounce-return'), '2px');
  assert.equal(declaration(rulesFor(root, '.price-scroll-controls [data-price-scroll=\'top\'] .site-icon-arrow')[0], '--arrow-rotate'), 'rotate(180deg)');
  assert.equal(declaration(rulesFor(root, '.site-scroll-root.site-scroll-active ~ .price-scroll-controls').at(-1), '--scroll-control-opacity'), '0.7');
  assert.equal(declaration(rulesFor(root, '.price-scroll-controls button:is(:active, :focus-visible)').at(-1), '--scroll-control-opacity'), '1');
});

test('mobile social rollout and continuous wave preserve their original time and rotation', async () => {
  const root = await stylesheet('style.css');
  const list = rulesFor(root, '.header .social-bar-inner .social-icons-wrap .social-icons')[0];
  assert.equal(declaration(list, '--social-rollout-duration'), '1800ms');
  assert.equal(declaration(list, '--social-rollout-stagger'), '120ms');
  let rollout;
  let wave;
  root.walkAtRules('keyframes', rule => {
    if (rule.params === 'social-icon-rollout') rollout = rule;
    if (rule.params === 'social-icon-idle-wave') wave = rule;
  });
  assert.match(declaration(rollout.nodes.find(rule => rule.selector === '0%'), 'transform'), /rotate\(1440deg\)/);
  assert.match(declaration(rollout.nodes.find(rule => rule.selector === '100%'), 'transform'), /rotate\(0deg\)/);
  assert.ok(wave);
  const waves = [];
  root.walkDecls('animation', decl => { if (decl.value.includes('social-icon-idle-wave')) waves.push(decl.value); });
  assert.ok(waves.some(value => /social-icon-idle-wave 4s ease-in-out infinite both/.test(value)));
});

test('normal visibility gates and established nonzero performance timings are preserved', async () => {
  const root = await stylesheet('style.css');
  assert.match(declaration(rulesFor(root, '#mobile-nav::before')[0], 'animation'), /infinite alternate paused/);
  assert.equal(declaration(rulesFor(root, '#mobile-nav.active::before')[0], 'animation-play-state'), 'running');
  const durations = [];
  root.walkRules(rule => {
    if (!/html\.site-perf-(?:lite|balanced)/.test(rule.selector)) return;
    rule.walkDecls('animation-duration', decl => durations.push(decl.value));
  });
  assert.deepEqual(durations, ['72s', '12s', '22s']);
  const shop = await stylesheet('shop.css');
  const hover = [];
  shop.walkAtRules('media', rule => { if (rule.params.includes('hover: hover')) hover.push(rule.params); });
  assert.ok(hover.includes('(hover: hover)'), 'shop hover interaction must retain its pointer capability guard');
});
