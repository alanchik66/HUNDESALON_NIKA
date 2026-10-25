import { parse } from 'espree';
import { analyze } from 'eslint-scope';
import { transformSync } from 'esbuild';

function recordParents(node, parents) {
  if (!node || typeof node !== 'object') return;
  for (const value of Object.values(node)) {
    const children = Array.isArray(value) ? value : [value];
    for (const child of children) {
      if (!child?.type) continue;
      parents.set(child, node);
      recordParents(child, parents);
    }
  }
}

/** Rename module bindings while preserving import/export names and object keys. */
export function renameModuleBindings(source, names) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const parents = new Map();
  recordParents(ast, parents);
  const manager = analyze(ast, { ecmaVersion: 2024, sourceType: 'module', ignoreEval: true });
  const moduleScope = manager.scopes.find(scope => scope.type === 'module');
  const replacements = new Map();

  for (const variable of moduleScope.variables) {
    const newName = names[variable.name];
    if (!newName) continue;
    if (moduleScope.variables.some(other => other !== variable && other.name === newName)) {
      throw new Error(`Module binding collision: ${variable.name} -> ${newName}`);
    }
    const identifiers = [...variable.identifiers, ...variable.references.map(reference => reference.identifier)];
    for (const identifier of identifiers) {
      const parent = parents.get(identifier);
      let text = newName;
      if (parent?.type === 'ImportSpecifier' && parent.imported.range[0] === parent.local.range[0]) {
        text = `${variable.name} as ${newName}`;
      }
      if (parent?.type === 'Property' && parent.shorthand) {
        text = `${parent.key.name}: ${newName}`;
      }
      if (parent?.type === 'ExportSpecifier' && parent.exported.range[0] === parent.local.range[0]) {
        text = `${newName} as ${variable.name}`;
      }
      replacements.set(identifier.range[0], {
        start: identifier.range[0],
        end: identifier.range[1],
        text,
      });
    }
  }

  for (const replacement of [...replacements.values()].sort((left, right) => right.start - left.start)) {
    source = source.slice(0, replacement.start) + replacement.text + source.slice(replacement.end);
  }
  return source;
}

/** Source modules have readable paths; emitted modules retain the deployed URLs. */
export function deployedModulePaths(source, manifest) {
  for (const entry of manifest.entries) {
    const sourceName = entry.source.slice('src/'.length);
    source = source.replaceAll(`./${sourceName}`, `./${entry.output}`);
  }
  for (const vendor of manifest.vendorInputs) {
    source = source.replaceAll(`../dist-widget/${vendor.file}`, `./${vendor.file}`);
  }
  return source;
}

/**
 * Reverse only the documented recovery renames before comparing compiler output.
 * This ignores formatting and descriptive binding names, but retains literals,
 * statements, property keys, import/export contracts, shaders, and CSS values.
 */
export function canonicalRecoveredModule(source, entry, manifest) {
  const originalNames = Object.fromEntries(
    Object.entries(entry.recoveredNames).map(([original, recovered]) => [recovered, original])
  );
  const restored = renameModuleBindings(deployedModulePaths(source, manifest), originalNames);
  return canonicalModule(restored, entry.output);
}

export function canonicalModule(source, outputName) {
  return transformSync(source, {
    format: outputName.endsWith('iife.js') ? 'iife' : 'esm',
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    target: 'es2022',
    legalComments: 'none',
  }).code;
}
