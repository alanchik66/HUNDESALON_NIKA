/**
 * Replace duplicated static header/mobile-nav markup with site-shell placeholders.
 * Canonical shell is built at runtime by assets/js/site-shell.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const langs = ['de', 'en', 'ru', 'uk'];
const SHELL_STUB = `<!-- Header and mobile nav (built by site-shell.js) -->
<header class="header"></header>
<div id="mobile-nav-overlay" hidden aria-hidden="true"></div>
<nav id="mobile-nav" aria-hidden="true"></nav>`;
const SHELL_COMMENT = /header|шапка|seitenkopf|site-shell|mobile nav|меню|menü|preloader|прелоад|ladeanimation/i;

function listLocalizedHtmlFiles() {
  const files = [];
  for (const lang of langs) {
    const langDir = path.join(root, lang);
    if (!fs.existsSync(langDir)) continue;
    for (const file of walk(langDir)) {
      if (file.endsWith('.html')) files.push(file);
    }
  }
  return files.sort();
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function isMinimalShell(html) {
  return /<header class="header">\s*<\/header>/.test(html) && !html.includes('class="nav-main"');
}

function skipWhitespaceAndComments(html, pos) {
  while (pos < html.length) {
    const rest = html.slice(pos);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) {
      pos += whitespace[0].length;
      continue;
    }
    const comment = rest.match(/^<!--[\s\S]*?-->/);
    if (comment) {
      pos += comment[0].length;
      continue;
    }
    break;
  }
  return pos;
}

function findHeaderStart(html) {
  const bodyMatch = html.match(/<body\b[^>]*>/i);
  const searchFrom = bodyMatch ? bodyMatch.index + bodyMatch[0].length : 0;
  const headerStart = html.indexOf('<header class="header">', searchFrom);
  return headerStart === -1 ? -1 : headerStart;
}

function findShellEnd(html, headerStart) {
  const headerClose = html.indexOf('</header>', headerStart);
  if (headerClose === -1) return -1;

  let pos = headerClose + '</header>'.length;
  pos = skipWhitespaceAndComments(html, pos);

  if (html.slice(pos).startsWith('<div id="mobile-nav-overlay"')) {
    const overlayClose = html.indexOf('</div>', pos);
    if (overlayClose === -1) return -1;
    pos = overlayClose + '</div>'.length;
    pos = skipWhitespaceAndComments(html, pos);
  }

  const navStart = html.indexOf('<nav id="mobile-nav"', pos);
  if (navStart === -1 || navStart > pos + 800) {
    return pos;
  }

  const navClose = html.indexOf('</nav>', navStart);
  if (navClose === -1) return -1;
  return navClose + '</nav>'.length;
}

function skipWhitespaceBack(html, pos) {
  while (pos > 0 && /\s/.test(html[pos - 1])) {
    pos -= 1;
  }
  return pos;
}

function findShellStart(html, headerStart) {
  let replaceStart = headerStart;
  let pos = headerStart;

  while (pos > 0) {
    pos = skipWhitespaceBack(html, pos);
    const commentStart = html.lastIndexOf('<!--', pos - 1);
    if (commentStart === -1) break;

    const commentEnd = html.indexOf('-->', commentStart);
    if (commentEnd === -1 || commentEnd + 3 > pos) break;

    const comment = html.slice(commentStart, commentEnd + 3);
    if (!SHELL_COMMENT.test(comment)) break;

    replaceStart = commentStart;
    pos = commentStart;
  }

  return replaceStart;
}

function stripStaticShell(html) {
  if (isMinimalShell(html)) {
    return { html, changed: false, reason: 'already-minimal' };
  }

  const headerStart = findHeaderStart(html);
  if (headerStart === -1) {
    return { html, changed: false, reason: 'no-header' };
  }

  const shellEnd = findShellEnd(html, headerStart);
  if (shellEnd === -1) {
    return { html, changed: false, reason: 'parse-failed' };
  }

  const replaceStart = findShellStart(html, headerStart);
  const next = `${html.slice(0, replaceStart)}${SHELL_STUB}${html.slice(shellEnd)}`;

  if (!next.includes('<head') || !next.includes('<body')) {
    return { html, changed: false, reason: 'unsafe-strip' };
  }

  return { html: next, changed: true, reason: 'stripped' };
}

const files = listLocalizedHtmlFiles();
let changedCount = 0;
const failures = [];

for (const file of files) {
  const relativePath = path.relative(root, file).replaceAll('\\', '/');
  const original = fs.readFileSync(file, 'utf8');
  const result = stripStaticShell(original);

  if (result.changed) {
    fs.writeFileSync(file, result.html, 'utf8');
    changedCount += 1;
    console.log(`stripped: ${relativePath}`);
    continue;
  }

  if (result.reason === 'parse-failed' || result.reason === 'no-header' || result.reason === 'unsafe-strip') {
    failures.push(`${relativePath}: ${result.reason}`);
  }
}

if (failures.length) {
  console.error('\nFailed files:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`\nDone. Updated ${changedCount} file(s), skipped ${files.length - changedCount - failures.length}.`);
