import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { assertProductionSourcePath, isProductionSourceOnlyPath } from './lib/production-assets.mjs';

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

test('production excludes credential and private database artifacts in every public directory', () => {
  for (const file of [
    'config/.env.production',
    'data/.dev.vars',
    'assets/private.token',
    'assets/keys/server.pem',
    'data/customers.sqlite',
    'config/.secrets/account.json',
  ]) {
    assert.equal(isProductionSourceOnlyPath(file), true, file);
  }
  assert.equal(isProductionSourceOnlyPath('.well-known/security.txt'), false);
});

test('production copy refuses external inputs and symbolic directories', t => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'nika-production-input-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const root = path.join(fixture, 'project');
  const outside = path.join(fixture, 'private');
  mkdirSync(root);
  mkdirSync(outside);
  writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.equal(assertProductionSourcePath(root, path.join(root, 'index.html')).isFile(), true);
  assert.throws(() => assertProductionSourcePath(root, outside), /outside the project root/);
  assert.throws(() => assertProductionSourcePath(root, path.join(root, 'linked')), /symbolic production input/);
});
