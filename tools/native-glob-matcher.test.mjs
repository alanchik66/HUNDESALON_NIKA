import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { parse } from 'espree';
import matcher, { isMatch, scan } from './lib/native-glob-matcher/index.js';

// Ordinary lint-path results captured from installed picomatch 2.3.2 on 2026-11-17.
// Keeping expected data, rather than importing that engine, survives its removal.
const cases = [
  {
    pattern: 'assets/css/**/*.css',
    options: {},
    inputs: ['assets/css/style.css', 'assets/css/nested/theme.css', 'assets/js/site.js', 'assets/css/.hidden.css'],
    expected: [true, true, false, false],
  },
  {
    pattern: 'assets/css/**/*.css',
    options: { dot: true },
    inputs: ['assets/css/.hidden.css', 'assets/css/.themes/theme.css'],
    expected: [true, true],
  },
  {
    pattern: '**/node_modules/**',
    options: { dot: true },
    inputs: ['C:/repo/node_modules/x.css', '/repo/.cache/node_modules/x.css', '/repo/assets/x.css'],
    expected: [true, true, false],
  },
  {
    pattern: '*.css',
    options: { basename: true },
    inputs: ['assets/theme.css', 'C:\\repo\\theme.css', './assets/theme.css', 'assets/theme.js'],
    expected: [true, true, true, false],
  },
  {
    pattern: 'assets/*.css',
    options: { dot: true, basename: true },
    inputs: ['assets/theme.css', 'theme.css'],
    expected: [false, false],
  },
  {
    pattern: '!**/*.min.css',
    options: {},
    inputs: ['assets/style.css', 'assets/style.min.css'],
    expected: [true, false],
  },
  {
    pattern: ['*.css', '*.md'],
    options: { basename: true },
    inputs: ['assets/style.css', 'ru/help.md', 'assets/site.js'],
    expected: [true, true, false],
  },
  { pattern: [], options: {}, inputs: ['assets/style.css'], expected: [false] },
  {
    pattern: './assets/css/**/*.css',
    options: {},
    inputs: ['assets/css/style.css', './assets/css/style.css'],
    expected: [true, false],
  },
  { pattern: '!assets/css/**/*.css', options: {}, inputs: ['./assets/css/style.css'], expected: [true] },
  {
    pattern: 'C:/PROJEKT/HUNDESALON_NIKA/assets/**/*.css',
    options: {},
    inputs: ['C:/PROJEKT/HUNDESALON_NIKA/assets/css/style.css', 'C:\\PROJEKT\\HUNDESALON_NIKA\\assets\\css\\style.css'],
    expected: [true, true],
  },
  {
    pattern: 'ASSETS/**/*.CSS',
    options: { nocase: true },
    inputs: ['assets/css/style.css', 'assets/site.js'],
    expected: [true, false],
  },
  {
    pattern: 'assets/**/theme.css',
    options: { noglobstar: true },
    inputs: ['assets/theme.css', 'assets/css/theme.css', 'assets/css/dark/theme.css'],
    expected: [false, true, false],
  },
];

function matchInputs(pattern, options, inputs) {
  const matches = matcher(pattern, options);
  return inputs.map(input => matches(input));
}

test('fixed lint globs retain the captured ordinary matching behavior', () => {
  for (const { pattern, options, inputs, expected } of cases) {
    assert.deepEqual(matchInputs(pattern, options, inputs), expected, JSON.stringify({ pattern, options }));
    assert.deepEqual(
      inputs.map(input => isMatch(input, pattern, options)),
      expected
    );
  }
});

test('tinyglobby terminal directory expansion retains CSS files and directory exclusions', () => {
  const options = { dot: undefined, nobrace: false, nocase: false, noextglob: false, noglobstar: false, posix: true };
  assert.deepEqual(
    matchInputs('assets/css/**/*.css/**', options, [
      'assets/css/style.css',
      'assets/css/nested/theme.css',
      'assets/css',
    ]),
    [true, true, false]
  );
  assert.deepEqual(matchInputs('assets/css/**', options, ['assets/css', 'assets/css/', 'assets/css/style.css']), [
    true,
    true,
    true,
  ]);
  assert.deepEqual(
    matchInputs('**/node_modules/**', options, ['node_modules', 'node_modules/x.css', 'assets/style.css']),
    [true, true, false]
  );
  assert.equal(
    isMatch('assets/css', '!assets/css/**', options),
    false,
    'negation applies after both terminal variants'
  );
});

test('scan preserves crawl roots and raw pruning parts for repository and absolute paths', () => {
  const fixtures = [
    ['assets/css/**/*.css', ['assets', 'css', '**', '*.css'], true, false],
    ['**/node_modules/**', ['**', 'node_modules', '**'], true, false],
    ['**/*.min.css', ['**', '*.min.css'], true, false],
    ['3d-weather-codrops-main/dist-widget/**', ['3d-weather-codrops-main', 'dist-widget', '**'], true, false],
    ['ru/**/*.md', ['ru', '**', '*.md'], true, false],
    ['*.md', [], true, false],
    ['!AGENTS.md', [], false, true],
    ['./assets/css/**/*.css', ['assets', 'css', '**', '*.css'], true, false],
    [
      'C:/PROJEKT/HUNDESALON_NIKA/assets/css/**/*.css',
      ['C:', 'PROJEKT', 'HUNDESALON_NIKA', 'assets', 'css', '**', '*.css'],
      true,
      false,
    ],
    ['/repo/assets/*.css', ['/repo', 'assets', '*.css'], true, false],
    ['assets/style.css', ['assets', 'style.css'], false, false],
  ];
  for (const [pattern, parts, isGlob, negated] of fixtures) {
    assert.deepEqual(scan(pattern, { parts: true }), { parts, isGlob, negated }, pattern);
    assert.deepEqual(scan(pattern), { isGlob, negated }, pattern);
  }
});

test('only the pinned Boolean options and bounded simple pattern contract are accepted', () => {
  for (const options of [{ unknown: true }, { dot: 'true' }, { posix: false }, { basename: 1 }, null, []]) {
    assert.throws(() => matcher('assets/*.css', options), /Native glob matcher: unsupported/);
  }
  assert.throws(() => scan('assets/*.css', { tokens: true }), /unsupported option tokens/);
  for (const pattern of [
    'assets/{css,js}/site.css',
    'assets/[ab].css',
    'assets/(draft).css',
    'assets\\site.css',
    'assets//site.css',
    '!!assets/site.css',
  ]) {
    assert.throws(() => matcher(pattern), /Native glob matcher: unsupported/);
    assert.throws(() => scan(pattern), /Native glob matcher: unsupported/);
  }
  assert.throws(() => matcher('assets/*.css', undefined, true), /unsupported factory argument/);
  assert.throws(() => matcher('assets/*.css')('assets/site.css', true), /unsupported matcher input/);
  assert.equal(matcher('assets/*.css')(''), false);
});

test('CJS and ESM consumers share one implementation with honest package identity', async () => {
  const require = createRequire(import.meta.url);
  assert.equal(require('./lib/native-glob-matcher/index.js'), matcher);
  assert.equal(matcher.isMatch, isMatch);
  assert.equal(matcher.scan, scan);
  const manifest = JSON.parse(
    await readFile(new URL('./lib/native-glob-matcher/package.json', import.meta.url), 'utf8')
  );
  assert.equal(manifest.name, '@hundesalon-nika/native-glob-matcher');
  assert.equal(manifest.private, true);
  assert.equal(manifest.license, 'MIT');
  assert.deepEqual(manifest.dependencies, { minimatch: '11.0.4' });
  assert.equal(manifest.scripts, undefined, 'no install-time execution is added');
});

test('the actual adapter dependency graph delegates only to Minimatch and Node path', async () => {
  const source = await readFile(new URL('./lib/native-glob-matcher/index.js', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const dependencies = [],
    pending = [ast];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    assert.notEqual(node.type, 'ImportExpression', 'no hidden dynamic engine import');
    if (node.type === 'CallExpression' && ['require', 'eval', 'Function'].includes(node.callee?.name)) {
      assert.equal(node.callee.name, 'require', 'no generated implementation');
      assert.equal(node.arguments.length, 1);
      assert.equal(node.arguments[0].type, 'Literal', 'all dependencies are literal and reviewable');
      dependencies.push(node.arguments[0].value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value);
      else if (value && typeof value === 'object') pending.push(value);
    }
  }
  assert.deepEqual(dependencies.sort(), ['minimatch', 'node:path']);
});
