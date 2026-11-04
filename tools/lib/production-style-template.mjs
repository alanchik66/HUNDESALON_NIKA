import { parse } from 'espree';
import { transformSync } from 'esbuild';

const TARGET = 'HEADER_WEATHER_TRANSPARENT_STYLES';
const MARKER = '__NIKA_INLINE_STYLE_EXPRESSION_';
const escapeTemplateText = value => value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');

function findStyleTemplate(source) {
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'script', range: true })];
  const matches = [];
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === TARGET) matches.push(node.init);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(child => child && typeof child.type === 'string'));
      else if (value && typeof value.type === 'string') pending.push(value);
    }
  }
  if (matches.length !== 1 || matches[0]?.type !== 'TemplateLiteral') throw new Error(`Expected exactly one untagged ${TARGET} template.`);
  return matches[0];
}

/** Minify only weather CSS text; never evaluate, combine, or reorder JavaScript interpolation. */
export function minifyHeaderWeatherStyleTemplate(source, { transformCss = transformSync } = {}) {
  const template = findStyleTemplate(source);
  const markers = template.expressions.map((_, index) => `${MARKER}${index}__`);
  const parts = template.quasis.map(quasi => {
    if (typeof quasi.value.cooked !== 'string' || quasi.value.cooked.includes(MARKER)) throw new Error('Invalid or colliding weather CSS template text.');
    return quasi.value.cooked;
  });
  const css = parts.map((text, index) => text + (markers[index] || '')).join('');
  const result = transformCss(css, { loader: 'css', minify: true, legalComments: 'none', sourcefile: 'header-weather-inline.css' });
  if (result.warnings?.length || typeof result.code !== 'string') throw new Error('Inline weather CSS minification produced warnings or invalid output.');

  let previous = -1;
  const positions = markers.map(marker => {
    const position = result.code.indexOf(marker);
    if (position <= previous || result.code.indexOf(marker, position + marker.length) !== -1) {
      throw new Error('Inline weather CSS minification lost, duplicated or reordered interpolation.');
    }
    previous = position;
    return position;
  });
  let replacement = '`';
  let offset = 0;
  template.expressions.forEach((expression, index) => {
    replacement += escapeTemplateText(result.code.slice(offset, positions[index]));
    replacement += '${' + source.slice(...expression.range) + '}';
    offset = positions[index] + markers[index].length;
  });
  replacement += escapeTemplateText(result.code.slice(offset)) + '`';
  const code = source.slice(0, template.range[0]) + replacement + source.slice(template.range[1]);
  const restored = findStyleTemplate(code);
  const originalExpressions = template.expressions.map(expression => source.slice(...expression.range));
  const restoredExpressions = restored.expressions.map(expression => code.slice(...expression.range));
  if (JSON.stringify(originalExpressions) !== JSON.stringify(restoredExpressions)) throw new Error('Inline weather CSS changed JavaScript interpolation.');
  return { code, expressions: originalExpressions.length, cssBytesBefore: Buffer.byteLength(css), cssBytesAfter: Buffer.byteLength(result.code) };
}
