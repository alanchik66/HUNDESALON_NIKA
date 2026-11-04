import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { assertProductionSourcePath, isProductionSourceOnlyPath } from './lib/production-assets.mjs';
import { stampWeatherModuleReferences, stampWeatherRuntimeVersions } from './lib/weather-asset-versions.mjs';
import { deployedModulePaths } from '../3d-weather-codrops-main/scripts/module-source.mjs';
import { transformSync } from 'esbuild';

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

test('weather cache versions follow the release across emitted static, dynamic and URL-based module references', t => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'nika-weather-versions-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const directory = path.join(fixture, 'dist');
  const shellDirectory = path.join(directory, 'assets', 'js');
  const modulesDirectory = path.join(directory, '3d-weather-codrops-main', 'dist-widget');
  mkdirSync(shellDirectory, { recursive: true });
  mkdirSync(modulesDirectory, { recursive: true });
  const manifest = JSON.parse(readFileSync(new URL('../3d-weather-codrops-main/build-manifest.json', import.meta.url), 'utf8'));
  const outputs = new Set(manifest.entries.map(entry => entry.output));
  const shell = 'const WEATHER_WIDGET_ASSET_VERSION = "old-release"; const loader = `weather-widget.iife.js?v=${WEATHER_WIDGET_ASSET_VERSION}`;';
  const shellFile = path.join(shellDirectory, 'site-shell.js');
  writeFileSync(shellFile, shell);
  for (const entry of manifest.entries) {
    const source = readFileSync(new URL(`../3d-weather-codrops-main/${entry.source}`, import.meta.url), 'utf8');
    // The same emitter transform used by the production weather compiler.
    const emitted = transformSync(deployedModulePaths(source, manifest), {
      format: entry.output.endsWith('iife.js') ? 'iife' : 'esm', target: 'es2022',
    }).code;
    writeFileSync(path.join(modulesDirectory, entry.output), emitted);
  }
  const vendor = Buffer.from('export const revision = "vendor-unchanged";\n');
  const vendorFile = path.join(modulesDirectory, manifest.vendorInputs[0].file);
  writeFileSync(vendorFile, vendor);
  const version = '20261104-prod-next&variant';
  const result = stampWeatherRuntimeVersions(directory, manifest, version);
  assert.equal(result.files, manifest.entries.length);
  assert.ok(result.references > 10, 'the actual transitive weather graph is covered');
  assert.match(readFileSync(shellFile, 'utf8'), /WEATHER_WIDGET_ASSET_VERSION = "20261104-prod-next&variant"/);
  assert.deepEqual(readFileSync(vendorFile), vendor, 'vendor bytes must not be rewritten');
  const referencePattern = new RegExp(`\\./(?:${[...outputs].map(output => output.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?:\\?[^"'\x60\\s)]*)?`, 'g');
  let references = 0;
  for (const entry of manifest.entries) {
    const code = readFileSync(path.join(modulesDirectory, entry.output), 'utf8');
    for (const [reference] of code.matchAll(referencePattern)) {
      references += 1;
      assert.equal(new URL(reference, 'https://weather.test/').searchParams.get('v'), version, `${entry.output}: ${reference}`);
    }
    assert.doesNotThrow(() => transformSync(code, { format: entry.output.endsWith('iife.js') ? 'iife' : 'esm', target: 'es2022' }));
    const repeated = stampWeatherModuleReferences(code, outputs, version);
    assert.equal(repeated.code, code, `${entry.output} is idempotently stamped`);
    const next = stampWeatherModuleReferences(code, outputs, 'release-two');
    if (next.references) assert.notEqual(next.code, code, `${entry.output} invalidates its authored dependency cache`);
  }
  assert.equal(references, result.references, 'every emitted authored reference has exactly the same release version');
});

test('weather versioning preserves vendor and unrelated URL literals', () => {
  const source = 'import "./authored.mjs?v=old&weather-retry=2#x"; import "./vendor.mjs?v=vendor"; const shader = `uniform float v;`; const lazy = import("./authored.mjs"); const url = new URL(`./authored.mjs?v=old`, import.meta.url);';
  const result = stampWeatherModuleReferences(source, new Set(['authored.mjs']), 'release one');
  assert.equal(result.references, 3);
  assert.match(result.code, /authored\.mjs\?v=release\+one&weather-retry=2#x/);
  assert.ok(result.code.includes('import "./vendor.mjs?v=vendor"'));
  assert.ok(result.code.includes('`uniform float v;`'));
});

test('weather versioning rejects missing or ambiguous shell constants and escaping output paths', t => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'nika-weather-binding-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const shellFile = path.join(fixture, 'assets', 'js', 'site-shell.js');
  mkdirSync(path.dirname(shellFile), { recursive: true });
  for (const source of ['const renamed = "old";', '{const WEATHER_WIDGET_ASSET_VERSION="a";} {const WEATHER_WIDGET_ASSET_VERSION="b";}', 'const WEATHER_WIDGET_ASSET_VERSION = getVersion();']) {
    writeFileSync(shellFile, source);
    assert.throws(() => stampWeatherRuntimeVersions(fixture, { entries: [{ output: 'scene.mjs' }] }, 'release'), /Expected one literal/);
    assert.equal(readFileSync(shellFile, 'utf8'), source, 'a failed precondition cannot mutate the shell');
  }
  assert.throws(() => stampWeatherRuntimeVersions(fixture, { entries: [{ output: '../outside.mjs' }] }, 'release'), /Invalid maintained/);
});
