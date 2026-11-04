import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from 'espree';
import { transformSync } from 'esbuild';
import { minifyHeaderWeatherStyleTemplate } from './lib/production-style-template.mjs';

const variable = 'HEADER_WEATHER_TRANSPARENT_STYLES';
const sourceFor = body => `const ${variable} = \`${body}\`; globalThis.result = ${variable};`;
const normalCss = css => transformSync(css, { loader: 'css', minify: true, legalComments: 'none' }).code;
function expressions(source) {
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'script', range: true })];
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'VariableDeclarator' && node.id.name === variable) return node.init.expressions.map(expression => source.slice(...expression.range));
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(child => child && typeof child.type === 'string'));
      else if (value && typeof value.type === 'string') pending.push(value);
    }
  }
  throw new Error('Missing test template.');
}
function render(source, context = {}) {
  vm.runInNewContext(source, context, { timeout: 1000 });
  return context.result;
}

test('static CSS is minified while unrelated JavaScript stays byte-for-byte intact', () => {
  const prefix = 'const unrelated = `body { color: red; }`;\n';
  const source = prefix + sourceFor('\n/* CSS comment */ .x { color: rgb(255, 0, 0); padding: 0px 0px; }\n');
  const result = minifyHeaderWeatherStyleTemplate(source);
  assert.ok(result.code.startsWith(prefix));
  assert.equal(result.expressions, 0);
  assert.ok(result.cssBytesAfter < result.cssBytesBefore);
  assert.equal(normalCss(render(source)), normalCss(render(result.code)));
});

test('numeric interpolation, units and quoted string interpolation retain exact JavaScript', () => {
  const source = sourceFor('.x { width: ${width /* retain this comment */}px; height: calc(100% - ${height}px); content: "${label}"; }');
  const result = minifyHeaderWeatherStyleTemplate(source);
  assert.deepEqual(expressions(result.code), expressions(source));
  assert.equal(result.expressions, 3);
  assert.equal(normalCss(render(source, { width: 14, height: 3, label: 'RU / DE' })), normalCss(render(result.code, { width: 14, height: 3, label: 'RU / DE' })));
});

test('nested templates, nested objects and function-call expressions are preserved without evaluation', () => {
  const source = sourceFor('.x { width: ${pick({ nested: `value-${suffix}` }, 12)}px; opacity: ${(() => 0.5)()}; }');
  const result = minifyHeaderWeatherStyleTemplate(source);
  assert.deepEqual(expressions(result.code), expressions(source));
  const context = () => ({ suffix: 'one', pick: (object, value) => object.nested === 'value-one' ? value : 0 });
  assert.equal(normalCss(render(source, context())), normalCss(render(result.code, context())));
});

test('SVG/data URLs and dynamic URL values retain their rendered CSS semantics', () => {
  const source = sourceFor('.x { background-image: url("data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\'><path d=\'M0 0h1v1\'/></svg>"); mask-image: ${icon}; }');
  const result = minifyHeaderWeatherStyleTemplate(source);
  const context = () => ({ icon: 'url("data:image/svg+xml,<svg></svg>")' });
  assert.deepEqual(expressions(result.code), expressions(source));
  assert.equal(normalCss(render(source, context())), normalCss(render(result.code, context())));
});

test('escaped CSS glyphs, literal backticks and literal dollar-braces survive template reconstruction', () => {
  const source = sourceFor(String.raw`.x::before { content: "\\e900 \` \${literal}"; }`);
  const result = minifyHeaderWeatherStyleTemplate(source);
  assert.equal(result.expressions, 0);
  assert.equal(normalCss(render(source)), normalCss(render(result.code)));
});

test('the optimizer never executes template expressions or unrelated program statements', () => {
  const source = sourceFor('.x { width: ${(() => { throw new Error("must not run"); })()}px; }') + '\nthrow new Error("program must not run");';
  assert.equal(minifyHeaderWeatherStyleTemplate(source).expressions, 1);
});

test('template coercion keeps string hints and interpolation evaluation order', () => {
  const source = sourceFor('.x { width: ${first}px; height: ${second}px; }');
  const result = minifyHeaderWeatherStyleTemplate(source);
  const run = code => {
    const calls = [];
    const value = name => ({ [Symbol.toPrimitive](hint) { calls.push([name, hint]); return name === 'first' ? 10 : 20; } });
    const css = render(code, { first: value('first'), second: value('second') });
    return { calls, css: normalCss(css) };
  };
  assert.deepEqual(run(result.code), run(source));
  assert.deepEqual(run(result.code).calls, [['first', 'string'], ['second', 'string']]);
});

test('missing, duplicate, tagged and non-template targets fail closed', () => {
  assert.throws(() => minifyHeaderWeatherStyleTemplate('const other = `a{color:red}`;'), /exactly one untagged/u);
  assert.throws(() => minifyHeaderWeatherStyleTemplate(`const ${variable} = String.raw\`a{color:red}\`;`), /exactly one untagged/u);
  assert.throws(() => minifyHeaderWeatherStyleTemplate(`const ${variable} = 'a{color:red}';`), /exactly one untagged/u);
  assert.throws(() => minifyHeaderWeatherStyleTemplate(`{const ${variable} = \`a{color:red}\`;} {const ${variable} = \`b{color:blue}\`;}`), /exactly one untagged/u);
});

test('reserved marker collisions and CSS compiler warnings are rejected', () => {
  assert.throws(() => minifyHeaderWeatherStyleTemplate(sourceFor('.x { color: __NIKA_INLINE_STYLE_EXPRESSION_0__; }')), /colliding/u);
  assert.throws(() => minifyHeaderWeatherStyleTemplate(sourceFor('.x { width: ${width}px; }'), {
    transformCss: css => ({ code: css, warnings: [{ text: 'compiler warning' }] }),
  }), /warnings/u);
});

test('lost, duplicated and reordered markers are rejected before publication', () => {
  const source = sourceFor('.x { width: ${first}px; height: ${second}px; }');
  for (const kind of ['lost', 'duplicated', 'reordered']) {
    assert.throws(() => minifyHeaderWeatherStyleTemplate(source, {
      transformCss: css => {
        const markers = css.match(/__NIKA_INLINE_STYLE_EXPRESSION_\d+__/gu);
        if (kind === 'lost') return { code: css.replace(markers[0], '0'), warnings: [] };
        if (kind === 'duplicated') return { code: css + markers[0], warnings: [] };
        return { code: css.replace(markers[0], 'SWAP').replace(markers[1], markers[0]).replace('SWAP', markers[1]), warnings: [] };
      },
    }), /lost, duplicated or reordered/u);
  }
});

test('an interpolation inside a removable CSS comment is never silently discarded', () => {
  assert.throws(() => minifyHeaderWeatherStyleTemplate(sourceFor('/* ${sideEffect()} */ .x { color: red; }')), /lost, duplicated or reordered/u);
});

test('the actual maintained weather stylesheet retains every interpolation and remains valid JavaScript', () => {
  const source = readFileSync(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const result = minifyHeaderWeatherStyleTemplate(source);
  assert.equal(result.expressions, expressions(source).length);
  assert.ok(result.expressions > 0);
  assert.ok(result.cssBytesAfter < result.cssBytesBefore);
  assert.deepEqual(expressions(result.code), expressions(source));
  assert.doesNotThrow(() => transformSync(result.code, { loader: 'js', minify: true, legalComments: 'none' }));
});
