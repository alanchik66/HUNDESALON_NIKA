import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { assertProductionAssetContent, assertProductionSourcePath, isProductionSourceOnlyPath } from './lib/production-assets.mjs';
import { stampWeatherModuleReferences, stampWeatherRuntimeVersions } from './lib/weather-asset-versions.mjs';
import { deployedModulePaths } from '../3d-weather-codrops-main/scripts/module-source.mjs';
import { transformSync } from 'esbuild';
import { stripLocalDevRefreshBootstrap } from './lib/production-dev-refresh.mjs';
import { startStaticTestServer } from './lib/static-test-server.mjs';

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

test('production content rejects Git LFS pointers regardless of asset extension or malformed pointer metadata', t => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'nika-production-lfs-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const version = 'version https://git-lfs.github.com/spec/v1';
  const contents = [
    ['moon.mp4', `${version}\noid sha256:${'a'.repeat(64)}\nsize 843873\n`],
    ['image.jpg', `${version}\r\noid invalid\r\nsize invalid\r\n`],
    ['module.js', version],
  ];
  for (const [name, content] of contents) {
    const file = path.join(fixture, name);
    writeFileSync(file, content);
    assert.throws(() => assertProductionAssetContent(file), error => {
      assert.match(error.message, /unresolved Git LFS pointer/);
      assert.ok(error.message.includes(file.replaceAll('\\', '/')), 'a failed gate must identify the exact artifact');
      return true;
    });
  }
});

test('production content permits binary media and nonleading textual mentions of Git LFS', t => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'nika-production-content-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const contents = [
    ['moon.mp4', Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypisom'), 0, 0, 2, 0])],
    ['image.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...Buffer.from('JFIF')])],
    ['module.js', 'const example = "version https://git-lfs.github.com/spec/v1";\n'],
    ['notes.txt', 'Example pointer:\nversion https://git-lfs.github.com/spec/v1\n'],
    ['empty.txt', ''],
  ];
  for (const [name, content] of contents) {
    const file = path.join(fixture, name);
    writeFileSync(file, content);
    assert.equal(assertProductionAssetContent(file), undefined);
  }
});

test('production content reads only a bounded prefix and closes descriptors after success, rejection and I/O failure', t => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'nika-production-content-io-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const media = path.join(fixture, 'large.mp4');
  const pointer = path.join(fixture, 'pointer.mp4');
  writeFileSync(media, Buffer.alloc(1024 * 1024, 0x61));
  writeFileSync(pointer, 'version https://git-lfs.github.com/spec/v1\n');
  const open = fs.openSync;
  const read = fs.readSync;
  const close = fs.closeSync;
  const opened = [];
  const closed = [];
  const reads = [];
  let readFailure = false;
  t.mock.method(fs, 'openSync', (...args) => {
    const descriptor = open(...args);
    opened.push(descriptor);
    return descriptor;
  });
  t.mock.method(fs, 'readSync', (descriptor, buffer, offset, length, position) => {
    reads.push({ offset, length, position });
    if (readFailure) throw new Error('Fixture read failure');
    return read(descriptor, buffer, offset, length, position);
  });
  t.mock.method(fs, 'closeSync', descriptor => {
    closed.push(descriptor);
    return close(descriptor);
  });
  assert.doesNotThrow(() => assertProductionAssetContent(media));
  assert.throws(() => assertProductionAssetContent(pointer), /unresolved Git LFS pointer/);
  readFailure = true;
  assert.throws(() => assertProductionAssetContent(media), /Fixture read failure/);
  assert.equal(reads.length, 3);
  assert.ok(reads.every(item => item.offset === 0 && item.position === 0 && item.length <= 256));
  assert.deepEqual(closed, opened, 'every opened asset descriptor must close even when content or I/O fails');
  for (const descriptor of closed) assert.throws(() => fs.fstatSync(descriptor), { code: 'EBADF' });
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
  const outputs = new Set([...manifest.entries.map(entry => entry.output), ...manifest.vendorInputs.map(entry => entry.file)]);
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
  for (const item of manifest.vendorInputs) writeFileSync(path.join(modulesDirectory, item.file), vendor);
  const version = '20261104-prod-next&variant';
  const result = stampWeatherRuntimeVersions(directory, manifest, version);
  assert.equal(result.files, outputs.size);
  assert.ok(result.references > 10, 'the actual transitive weather graph is covered');
  assert.match(readFileSync(shellFile, 'utf8'), /WEATHER_WIDGET_ASSET_VERSION = "20261104-prod-next&variant"/);
  assert.deepEqual(readFileSync(vendorFile), vendor, 'opaque vendor code without weather imports is unchanged');
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

test('a generated vendor invalidates cached imports in weather modules and every public JS importer using one URI', t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nika-weather-vendor-cache-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const runtime = path.join(directory, '3d-weather-codrops-main/dist-widget');
  const assets = path.join(directory, 'assets/js');
  mkdirSync(runtime, { recursive: true });
  mkdirSync(assets, { recursive: true });
  const manifest = { entries: [{ output: 'scene.mjs' }], vendorInputs: [{ file: 'vendor.mjs' }, { file: 'interop.mjs' }] };
  writeFileSync(path.join(assets, 'site-shell.js'), 'const WEATHER_WIDGET_ASSET_VERSION="old";');
  writeFileSync(path.join(runtime, 'scene.mjs'), 'import "./vendor.mjs?v=old";');
  writeFileSync(path.join(runtime, 'vendor.mjs'), 'import "./interop.mjs";export const patched=true;');
  writeFileSync(path.join(runtime, 'interop.mjs'), 'export const interop=true;');
  for (const file of ['header-weather-sun-scene.js', 'future-rain.js']) {
    writeFileSync(path.join(assets, file), 'import "../../3d-weather-codrops-main/dist-widget/vendor.mjs?v=old";');
  }
  const unrelated = 'import "../../unrelated/vendor.mjs?v=pinned";';
  writeFileSync(path.join(assets, 'software.js'), unrelated);
  const version = '20261108-prod-reviewed-vendor';
  const result = stampWeatherRuntimeVersions(directory, manifest, version);
  const specifier = file => readFileSync(file, 'utf8').match(/import\s+["']([^"']+)/u)?.[1];
  const sceneURI = new URL(specifier(path.join(runtime, 'scene.mjs')), 'https://site.test/3d-weather-codrops-main/dist-widget/scene.mjs').href;
  assert.equal(new URL(sceneURI).searchParams.get('v'), version, 'old browser vendor URI must be invalidated');
  for (const file of ['header-weather-sun-scene.js', 'future-rain.js']) {
    const uri = new URL(specifier(path.join(assets, file)), `https://site.test/assets/js/${file}`).href;
    assert.equal(uri, sceneURI, 'all importers share one Three/React module namespace');
  }
  assert.equal(new URL(specifier(path.join(runtime, 'vendor.mjs')), 'https://site.test/3d-weather-codrops-main/dist-widget/vendor.mjs').searchParams.get('v'), version);
  assert.equal(readFileSync(path.join(assets, 'software.js'), 'utf8'), unrelated);
  assert.deepEqual(result.publicImporters, ['assets/js/future-rain.js', 'assets/js/header-weather-sun-scene.js']);
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

const localRefreshIf = [
  "if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {",
  "  const refreshScript = document.createElement('script');",
  '  refreshScript.src = `/assets/js/local-dev-refresh.js?boot=${Date.now()}`;',
  '  document.head.appendChild(refreshScript);',
  '}',
].join('\n');
const refreshFixture = body => `(function siteShellBootstrap() {\n${body}\nconst WEATHER_WIDGET_ASSET_VERSION = 'literal-release';\nwindow.keepBusinessLogic();\n})();`;

test('the production shell removes only the exact local refresh AST range from the actual source', () => {
  const source = readFileSync(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const result = stripLocalDevRefreshBootstrap(source);
  assert.equal(result.code.includes('local-dev-refresh.js'), false, 'production must not load the dev refresh helper');
  assert.ok(result.removedRange, 'the dev hook must be removed, not only minified');
  const [start, end] = result.removedRange;
  assert.equal(result.code, source.slice(0, start) + source.slice(end), 'all bytes outside the targeted IfStatement stay unchanged');
  assert.match(result.code, /const WEATHER_WIDGET_ASSET_VERSION\s*=/u);
  assert.match(result.code, /const SUPPORTED_LANGS\s*=/u);
  assert.doesNotThrow(() => transformSync(result.code, { loader: 'js', target: 'es2022' }));
});

test('production refresh stripping fails closed on missing, duplicate or changed bootstrap structure', () => {
  for (const source of [
    refreshFixture('window.keepBusinessLogic();'),
    refreshFixture(`${localRefreshIf}\n${localRefreshIf}`),
    refreshFixture(localRefreshIf.replace("'127.0.0.1'", "'other-host'")),
    refreshFixture(localRefreshIf).replace('siteShellBootstrap', 'anotherBootstrap'),
    `${refreshFixture(localRefreshIf)}\n${refreshFixture(localRefreshIf)}`,
    refreshFixture(`function nested(){${localRefreshIf}}`),
  ]) assert.throws(() => stripLocalDevRefreshBootstrap(source), /Expected exactly one/u);
});

test('production refresh stripping preserves unrelated statements and the weather version binding', () => {
  const before = 'window.before = "unchanged";\n';
  const after = '\nwindow.after = "unchanged";';
  const source = before + refreshFixture(localRefreshIf) + after;
  const result = stripLocalDevRefreshBootstrap(source);
  assert.equal(result.code, before + refreshFixture('') + after);
});

test('the dev refresh asset is excluded from production while the isolated local static server still serves its exact bytes', async t => {
  const relative = 'assets/js/local-dev-refresh.js';
  assert.equal(isProductionSourceOnlyPath(relative), true);
  const fixture = mkdtempSync(path.join(tmpdir(), 'nika-dev-refresh-boundary-'));
  let server;
  t.after(async () => {
    await server?.close();
    assert.equal(path.dirname(fixture), tmpdir());
    assert.ok(path.basename(fixture).startsWith('nika-dev-refresh-boundary-'));
    rmSync(fixture, { recursive: true, force: true });
  });
  const bytes = readFileSync(new URL(`../${relative}`, import.meta.url));
  mkdirSync(path.dirname(path.join(fixture, relative)), { recursive: true });
  writeFileSync(path.join(fixture, relative), bytes);
  server = await startStaticTestServer(fixture);
  const response = await fetch(`${server.baseUrl}/${relative}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /javascript/u);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});
