import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const packageMetadata = name => {
  let directory = path.dirname(realpathSync(require.resolve(name)));
  while (directory !== path.dirname(directory)) {
    const file = path.join(directory, 'package.json');
    if (existsSync(file)) {
      const metadata = JSON.parse(readFileSync(file, 'utf8'));
      if (metadata.name === name) return metadata;
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Package metadata missing: ${name}`);
};

test('the lint toolchain contains the owned matcher instead of the removed parser chain', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const removed = new Set(['micromatch', 'braces', 'fast-glob', 'globby', 'markdownlint-cli2']);
  for (const name of Object.keys(lock.packages)) {
    assert.ok(!removed.has(name.split('node_modules/').at(-1)), `Unexpected removed dependency: ${name}`);
  }
  const expected = path.join(root, 'tools/lib/native-glob-matcher/index.js');
  const resolved = realpathSync(require.resolve('picomatch'));
  assert.equal(readFileSync(resolved, 'utf8'), readFileSync(expected, 'utf8'));
  // npm may either link local packages or copy them with install-links=true.
  for (const consumer of ['stylelint', 'tinyglobby', 'fdir']) {
    const resolveFromConsumer = createRequire(require.resolve(consumer));
    assert.equal(
      realpathSync(resolveFromConsumer.resolve('picomatch')),
      resolved,
      `${consumer} must resolve the same replacement implementation`
    );
  }
  const metadata = JSON.parse(readFileSync(path.join(path.dirname(resolved), 'package.json'), 'utf8'));
  assert.equal(metadata.name, '@hundesalon-nika/native-glob-matcher');
  assert.equal(metadata.dependencies.minimatch, '11.0.4');
  assert.equal(
    existsSync(path.join(path.dirname(resolved), 'lib/parse.js')),
    false,
    'legacy parser must not be shipped'
  );
  assert.equal(packageMetadata('minimatch').version, '11.0.4');
  assert.equal(packageMetadata('stylelint').version, '18.0.0');
  assert.equal(packageMetadata('tinyglobby').version, '0.2.17');
});

test('published package scripts retain full audit and the original Markdown rule configuration', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts['check:security-dependencies'], 'npm run audit:all');
  assert.equal(manifest.scripts['audit:root'], 'npm audit');
  assert.equal(manifest.scripts['audit:gateway'], 'npm --prefix integrations/google-gateway audit');
  assert.equal(manifest.scripts['lint:md'], 'node tools/lint-markdown.mjs');
  assert.equal(manifest.overrides.picomatch, '$picomatch');
  assert.equal(manifest.devDependencies.picomatch, 'file:tools/lib/native-glob-matcher');
  const rules = JSON.parse(readFileSync(path.join(root, '.markdownlint.json'), 'utf8'));
  assert.equal(rules.default, true);
  assert.deepEqual(rules.MD003, { style: 'atx' });
});
