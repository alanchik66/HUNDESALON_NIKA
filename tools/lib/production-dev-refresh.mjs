import { parse } from 'espree';

const parseScript = source => parse(source, { ecmaVersion: 'latest', sourceType: 'script', range: true });
const shape = node => JSON.stringify(node, (key, value) => ['start', 'end', 'range', 'raw'].includes(key) ? undefined : value);
const expectedIf = parseScript([
  "if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {",
  "  const refreshScript = document.createElement('script');",
  '  refreshScript.src = `/assets/js/local-dev-refresh.js?boot=${Date.now()}`;',
  '  document.head.appendChild(refreshScript);',
  '}',
].join('\n')).body[0];
const expectedShape = shape(expectedIf);

/** Remove only the reviewed dev-only IfStatement from the production copy, without re-emitting other code. */
export function stripLocalDevRefreshBootstrap(source) {
  const program = parseScript(source);
  const bootstraps = program.body
    .filter(node => node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression' && node.expression.arguments.length === 0)
    .map(node => node.expression.callee)
    .filter(node => node.type === 'FunctionExpression' && node.id?.name === 'siteShellBootstrap' &&
      !node.async && !node.generator && node.params.length === 0);
  if (bootstraps.length !== 1) throw new Error('Expected exactly one named siteShellBootstrap IIFE.');
  const bootstrap = bootstraps[0], matches = [], pending = [bootstrap.body];
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'IfStatement' && shape(node) === expectedShape) matches.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(child => child?.type));
      else if (value?.type) pending.push(value);
    }
  }
  if (matches.length !== 1 || !bootstrap.body.body.includes(matches[0])) {
    throw new Error('Expected exactly one direct local dev-refresh IfStatement in siteShellBootstrap.');
  }
  const [start, end] = matches[0].range;
  return { code: source.slice(0, start) + source.slice(end), removedRange: [start, end] };
}
