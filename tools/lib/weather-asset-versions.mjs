import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'espree';

function nodes(source) {
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true })];
  const result = [];
  while (pending.length) {
    const node = pending.pop();
    result.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(item => item?.type));
      else if (value?.type) pending.push(value);
    }
  }
  return result;
}

const stringValue = node => node?.type === 'Literal' && typeof node.value === 'string'
  ? node.value
  : node?.type === 'TemplateLiteral' && node.expressions.length === 0 ? node.quasis[0].value.cooked : null;

function replaceRanges(source, replacements) {
  for (const { start, end, value } of replacements.sort((left, right) => right.start - left.start)) {
    source = source.slice(0, start) + JSON.stringify(value) + source.slice(end);
  }
  return source;
}

const RUNTIME_PATH = '/3d-weather-codrops-main/dist-widget/';

export function weatherRuntimeOutputNames(manifest) {
  const outputs = new Set([...manifest.entries.map(entry => entry.output), ...(manifest.vendorInputs || []).map(entry => entry.file)]);
  if (!outputs.size || [...outputs].some(output => typeof output !== 'string' || /[\\/]/u.test(output) || path.basename(output) !== output || !/\.(?:mjs|js)$/.test(output))) {
    throw new Error('Invalid maintained weather output paths.');
  }
  return outputs;
}

/** Version only URLs resolving to the reviewed weather outputs, regardless of importer location. */
export function stampWeatherModuleReferences(source, outputs, version, importerPath = `${RUNTIME_PATH}_entry.mjs`) {
  const replacements = [];
  for (const node of nodes(source)) {
    const value = stringValue(node);
    if (!value || !(value.startsWith('.') || value.startsWith('/'))) continue;
    const url = new URL(value, `https://weather-build.invalid${importerPath}`);
    if (url.origin !== 'https://weather-build.invalid' || !url.pathname.startsWith(RUNTIME_PATH) || !outputs.has(url.pathname.slice(RUNTIME_PATH.length))) continue;
    url.searchParams.set('v', version);
    const referencePath = value.split(/[?#]/u, 1)[0];
    replacements.push({ start: node.range[0], end: node.range[1], value: `${referencePath}${url.search}${url.hash}` });
  }
  return { code: replaceRanges(source, replacements), references: replacements.length };
}

export function findPublicWeatherImporters(directory, manifest) {
  const outputs = weatherRuntimeOutputNames(manifest), importers = [];
  const walk = current => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.isFile() && /\.(?:mjs|js)$/u.test(entry.name)) {
        const source = readFileSync(file, 'utf8');
        if (![...outputs].some(output => source.includes(output))) continue;
        const relative = path.relative(directory, file).replaceAll('\\', '/');
        if (stampWeatherModuleReferences(source, outputs, 'discovery', `/${relative}`).references) importers.push(relative);
      }
    }
  };
  walk(path.join(directory, 'assets', 'js'));
  return importers.sort();
}

/** Run on the production copy before minifying the shell, after computing its version. */
export function stampWeatherRuntimeVersions(directory, manifest, version) {
  if (typeof version !== 'string' || !version.trim()) throw new Error('A production weather asset version is required.');
  const outputs = weatherRuntimeOutputNames(manifest);
  const shellFile = path.join(directory, 'assets', 'js', 'site-shell.js');
  const shell = readFileSync(shellFile, 'utf8');
  const bindings = nodes(shell).filter(node => node.type === 'VariableDeclarator' && node.id?.name === 'WEATHER_WIDGET_ASSET_VERSION');
  if (bindings.length !== 1 || stringValue(bindings[0].init) === null) {
    throw new Error('Expected one literal WEATHER_WIDGET_ASSET_VERSION binding before production minification.');
  }
  writeFileSync(shellFile, replaceRanges(shell, [{ start: bindings[0].init.range[0], end: bindings[0].init.range[1], value: version }]));

  let references = 0;
  for (const output of outputs) {
    const file = path.join(directory, '3d-weather-codrops-main', 'dist-widget', output);
    const result = stampWeatherModuleReferences(readFileSync(file, 'utf8'), outputs, version);
    references += result.references;
    writeFileSync(file, result.code);
  }
  const publicImporters = findPublicWeatherImporters(directory, manifest);
  for (const relative of publicImporters) {
    const file = path.join(directory, relative);
    const result = stampWeatherModuleReferences(readFileSync(file, 'utf8'), outputs, version, `/${relative}`);
    references += result.references;
    writeFileSync(file, result.code);
  }
  return { files: outputs.size, references, publicImporters };
}
