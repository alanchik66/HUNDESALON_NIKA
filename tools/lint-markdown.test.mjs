import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { findMarkdownFiles, lintMarkdown } from './lint-markdown.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const runnerPath = fileURLToPath(new URL('./lint-markdown.mjs', import.meta.url));
const runFile = promisify(execFile);

async function fixture(t, contents) {
  const parent = path.join(projectRoot, 'output', 'markdownlint-tests');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'fixture-'));
  assert.equal(path.dirname(directory), parent);
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(contents)) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await writeFile(path.join(directory, file), content);
  }
  return directory;
}

test('Markdown scope preserves locale nesting, hidden files, and root-only exclusions', async t => {
  const included = [
    'README.md',
    '.hidden.md',
    'ru/AGENTS.md',
    'ru/nested/notes.md',
    'de/nested/notes.md',
    'en/notes.md',
    'uk/notes.md',
    'blog/nested/notes.md',
    'ru/.hidden/notes.md',
    'ru/.hidden/.deeper/notes.md',
    'ru/node_modules/notes.md',
  ];
  const excluded = [
    'AGENTS.md',
    'vibe-livecheck-report.md',
    'docs/outside.md',
    'node_modules/notes.md',
    'dist/notes.md',
    'temp/notes.md',
    'test-results/notes.md',
    '3d-weather-codrops-main/notes.md',
    '.git/notes.md',
    'Windows-MCP/notes.md',
    'ru/nested/notes.txt',
  ];
  const directory = await fixture(t, Object.fromEntries([...included, ...excluded].map(file => [file, '# Heading\n'])));
  assert.deepEqual(await findMarkdownFiles(directory), included.sort());
});

test('Markdown lint uses the existing rules and fails the CLI for real invalid Markdown', async t => {
  const directory = await fixture(t, {
    'README.md': '# Heading\n\nText.\n',
    'ru/nested/invalid.md': 'Heading\n=======\n',
    'AGENTS.md': 'Excluded heading\n================\n',
  });
  const invalid = await lintMarkdown(directory);
  assert.equal(invalid.files.length, 2);
  assert.equal(invalid.errorCount, 1);
  assert.equal(Object.values(invalid.results).flat()[0].ruleNames[0], 'MD003');
  await assert.rejects(runFile(process.execPath, [runnerPath], { cwd: directory }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stdout, /2 files checked, 1 errors/u);
    assert.match(error.stderr, /MD003/u);
    return true;
  });
  await writeFile(path.join(directory, 'ru/nested/invalid.md'), '# Heading\n\nText.\n');
  const valid = await runFile(process.execPath, [runnerPath], { cwd: directory });
  assert.match(valid.stdout, /2 files checked, 0 errors/u);
  assert.equal(valid.stderr, '');
});

test('hidden directory links preserve every alias to the same Markdown target', async t => {
  const directory = await fixture(t, {
    'ru/.hidden/ordinary.md': '# Heading\n',
    'docs/shared/notes.md': '# Heading\n',
  });
  const target = path.join(directory, 'docs/shared');
  for (const alias of ['ru/.hidden-link', 'ru/.hidden/first', 'ru/.hidden/second']) {
    await symlink(target, path.join(directory, alias), 'junction');
  }
  assert.deepEqual(await findMarkdownFiles(directory), [
    'ru/.hidden-link/notes.md',
    'ru/.hidden/first/notes.md',
    'ru/.hidden/ordinary.md',
    'ru/.hidden/second/notes.md',
  ]);
});

test('hidden Markdown file links retain their scoped alias name', async t => {
  const directory = await fixture(t, {
    'ru/.hidden/ordinary.md': '# Heading\n',
    'docs/shared.md': '# Heading\n',
  });
  try {
    await symlink(path.join(directory, 'docs/shared.md'), path.join(directory, 'ru/.hidden/linked.md'), 'file');
  } catch (error) {
    if (process.platform === 'win32' && error.code === 'EPERM') {
      t.skip('Windows does not grant this process file-symlink creation privileges.');
      return;
    }
    throw error;
  }
  assert.deepEqual(await findMarkdownFiles(directory), ['ru/.hidden/linked.md', 'ru/.hidden/ordinary.md']);
});

test('hidden traversal rejects an ancestor cycle instead of accepting incomplete coverage', async t => {
  const directory = await fixture(t, { 'ru/.hidden/notes.md': '# Heading\n' });
  await symlink(path.join(directory, 'ru/.hidden'), path.join(directory, 'ru/.hidden/cycle'), 'junction');
  await assert.rejects(findMarkdownFiles(directory), /Markdown directory cycle/u);
});

test('hidden traversal errors fail lint and the CLI instead of passing unreadable coverage', async t => {
  const directory = await fixture(t, {
    'ru/.hidden/notes.md': '# Heading\n',
    'docs/target/notes.md': '# Heading\n',
  });
  await symlink(path.join(directory, 'docs/target'), path.join(directory, 'ru/.hidden/unavailable'), 'junction');
  const target = path.resolve(directory, 'docs/target');
  assert.equal(path.dirname(target), path.join(directory, 'docs'));
  await rm(target, { recursive: true });
  await assert.rejects(lintMarkdown(directory), { code: 'ENOENT' });
  await assert.rejects(runFile(process.execPath, [runnerPath], { cwd: directory }), error => {
    assert.equal(error.code, 1);
    assert.match(error.stderr, /ENOENT/u);
    assert.doesNotMatch(error.stdout, /0 errors/u);
    return true;
  });
});
