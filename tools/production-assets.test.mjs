import assert from 'node:assert/strict';
import test from 'node:test';

import { isProductionSourceOnlyPath } from './lib/production-assets.mjs';

test('blocks local advertising and source-only brand assets from production', () => {
  assert.equal(isProductionSourceOnlyPath('assets/video/ads/promo.mp4'), true);
  assert.equal(isProductionSourceOnlyPath('assets/images/brand/favicon/favicon-512x512.png'), true);
  assert.equal(isProductionSourceOnlyPath('assets/images/brand/cards/card-crown-nika.png'), true);
  assert.equal(isProductionSourceOnlyPath('assets/images/icons/locomotive-legacy.png'), true);
});

test('keeps public brand and active favicon assets deployable', () => {
  assert.equal(isProductionSourceOnlyPath('assets/images/ads/work/logo-from-card-crown-512.png'), false);
  assert.equal(isProductionSourceOnlyPath('assets/images/favicon/favicon-512x512.png'), false);
  assert.equal(isProductionSourceOnlyPath('assets/images/brand/logo.png'), false);
  assert.equal(isProductionSourceOnlyPath('assets\\images\\brand\\logo.png'), false);
});
