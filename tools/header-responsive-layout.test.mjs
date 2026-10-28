import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
const body = source.match(/const getHeaderLayoutMode = \([^)]*\) => \{([\s\S]*?)\n  \};/)[1];
const mode = new Function(
  'viewportWidth',
  'availableWidth',
  'requiredWidth',
  'centeredWeatherWidth',
  'previousMode',
  body
);
const navigationBody = source.match(/const getHeaderNavigationWidth = navigation => \{([\s\S]*?)\n  \};/)[1];
const navigationWidth = new Function('navigation', 'getComputedStyle', navigationBody);

test('navigation measurement ignores progress and plasma decoration', () => {
  const item = (width, control) => ({ getBoundingClientRect: () => ({ width }), matches: () => control });
  const navigation = { children: [item(100, true), item(1200, false), item(150, true), item(80, true)] };
  assert.equal(
    navigationWidth(navigation, () => ({ columnGap: '12px' })),
    354
  );
  assert.equal(
    navigationWidth({ children: [item(1200, false)] }, () => ({ columnGap: '12px' })),
    0
  );
  assert.equal(
    navigationWidth({ children: [item(100.25, true), item(150.25, true), item(80.25, true)] }, () => ({ columnGap: '12px' })),
    355
  );
});

test('the 900px boundary consistently selects the mobile header', () => {
  assert.equal(mode(900, 876, 400, 300, 'inline'), 'mobile');
  assert.equal(mode(901, 877, 600, 300, 'mobile'), 'inline');
});

test('localized content width selects the desktop row layout', () => {
  assert.equal(mode(1440, 1416, 1320, 700, 'stacked'), 'inline');
  assert.equal(mode(1440, 1416, 1450, 700, 'inline'), 'stacked');
});

test('weather receives its own centered row when side controls leave too little room', () => {
  assert.equal(mode(901, 877, 1400, 240, 'stacked'), 'weather-row');
  assert.equal(mode(1272, 1248, 1400, 600, 'weather-row'), 'stacked');
});

test('re-entry clearance prevents switching back and forth around the fit boundary', () => {
  assert.equal(mode(1440, 1416, 1412, 600, 'inline'), 'inline');
  assert.equal(mode(1440, 1416, 1412, 600, 'stacked'), 'stacked');
  assert.equal(mode(1440, 1420, 1412, 600, 'stacked'), 'inline');
});
