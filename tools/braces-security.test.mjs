import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const braces = require('braces');
const micromatch = require('micromatch');

test('resolved braces snapshot contains the reviewed security guard', () => {
  const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const dependency = lockfile.packages['node_modules/braces'];
  assert.equal(
    dependency.resolved,
    'https://codeload.github.com/Im-Fran/braces/tar.gz/11568474fd2d330d4a56a3aba63f8f90030ba15e'
  );
  assert.match(dependency.integrity, /^sha512-[A-Za-z0-9+/=]+$/);
  assert.equal(require('braces/package.json').version, '3.0.4');
  assert.equal(require('braces/lib/constants').MAX_DEPTH, 100);
  assert.equal(require.resolve('braces'), createRequire(require.resolve('micromatch')).resolve('braces'));
});

test('deep input is rejected before recursive walkers exhaust the stack', () => {
  const depth = 3000;
  const patterns = [
    '{'.repeat(depth) + 'a,b' + '}'.repeat(depth),
    '('.repeat(depth) + 'a' + ')'.repeat(depth),
    '{'.repeat(depth),
    '('.repeat(depth),
  ];
  for (const pattern of patterns) {
    for (const operation of [braces.parse, braces, braces.expand, braces.stringify]) {
      assert.throws(
        () => operation(pattern),
        error => error instanceof SyntaxError && error.message.includes('max depth')
      );
    }
  }
});

test('normal brace expansion and toolchain glob matching remain compatible', () => {
  assert.deepEqual(braces.expand('assets/{css,js}/*.{css,js}'), [
    'assets/css/*.css',
    'assets/css/*.js',
    'assets/js/*.css',
    'assets/js/*.js',
  ]);
  assert.deepEqual(braces.expand('file-{1..3}'), ['file-1', 'file-2', 'file-3']);
  assert.deepEqual(
    micromatch(['assets/css/style.css', 'assets/js/main.js', 'ru/index.html'], 'assets/{css,js}/**/*.{css,js}'),
    ['assets/css/style.css', 'assets/js/main.js']
  );
  const boundary = '{a,'.repeat(100) + 'a' + '}'.repeat(100);
  assert.equal(braces.expand(boundary).length, 101);
  assert.doesNotThrow(() => braces(boundary));
});
