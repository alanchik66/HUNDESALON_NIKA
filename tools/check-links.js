import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlRoots = ['.', 'de', 'en', 'ru', 'uk'];
const ignoredDirs = new Set(['.git', '.vscode', 'node_modules', 'dist', 'temp', 'tmp', 'test-results', 'tools']);
const ignoredSchemes = /^(?:https?:|mailto:|tel:|sms:|viber:|whatsapp:|tg:|javascript:|data:|blob:|#)/i;
const attrPattern = /\b(?:href|src|poster|action)\s*=\s*["']([^"']+)["']/gi;
const srcsetPattern = /\bsrcset\s*=\s*["']([^"']+)["']/gi;
const validRoutes = new Set();

const failures = [];

function loadProjectRoutes() {
  const redirectsPath = path.join(root, '_redirects');
  if (fs.existsSync(redirectsPath)) {
    const redirects = fs.readFileSync(redirectsPath, 'utf8').split(/\r?\n/);
    for (const line of redirects) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [source] = trimmed.split(/\s+/);
      if (source?.startsWith('/')) validRoutes.add(source);
    }
  }

  const functionsDir = path.join(root, 'functions');
  if (!fs.existsSync(functionsDir)) return;

  for (const entry of fs.readdirSync(functionsDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      validRoutes.add(`/${entry.name.replace(/\.js$/, '')}`);
    }
  }
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
  }

  return files;
}

function collectHtmlFiles() {
  const files = new Set();

  for (const folder of htmlRoots) {
    const target = path.join(root, folder);
    if (!fs.existsSync(target)) continue;

    if (folder === '.') {
      for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith('.html')) files.add(path.join(target, entry.name));
      }
      continue;
    }

    for (const file of walk(target)) files.add(file);
  }

  return [...files].sort();
}

function stripUrl(rawValue) {
  return rawValue.trim().split('#')[0].split('?')[0].trim();
}

function srcsetUrls(value) {
  return value
    .split(',')
    .map(part => part.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function resolveLocalReference(fromFile, rawValue) {
  const value = stripUrl(rawValue);
  if (!value || ignoredSchemes.test(value) || value.startsWith('//')) return null;
  if (validRoutes.has(value)) return null;

  let resolved = value.startsWith('/')
    ? path.join(root, value.replace(/^\/+/, ''))
    : path.resolve(path.dirname(fromFile), value);

  if (value.endsWith('/')) resolved = path.join(resolved, 'index.html');
  return resolved;
}

function existsAsFileOrDirectoryIndex(resolved) {
  if (!resolved) return true;
  if (fs.existsSync(resolved)) return true;
  if (fs.existsSync(`${resolved}.html`)) return true;
  if (fs.existsSync(path.join(resolved, 'index.html'))) return true;
  return false;
}

loadProjectRoutes();

for (const file of collectHtmlFiles()) {
  const html = fs.readFileSync(file, 'utf8');
  const relativeFile = path.relative(root, file);
  const references = [];

  for (const match of html.matchAll(attrPattern)) references.push(match[1]);

  for (const match of html.matchAll(srcsetPattern)) {
    references.push(...srcsetUrls(match[1]));
  }

  for (const reference of references) {
    const resolved = resolveLocalReference(file, reference);
    if (!resolved || existsAsFileOrDirectoryIndex(resolved)) continue;

    failures.push(`${relativeFile} -> ${reference}`);
  }
}

if (failures.length) {
  console.error('Broken local references found:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Local links and asset references are valid.');
