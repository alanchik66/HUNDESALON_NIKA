import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createProjectReader } from './policy.mjs';

async function fixture(t) {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'nika-mcp-')));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'project');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'README.md'), 'Project source\n');
  await fs.writeFile(path.join(directory, 'private.txt'), 'outside-fixture');
  await fs.writeFile(path.join(root, '.env'), 'secret-fixture');
  return { root, directory, reader: await createProjectReader(root) };
}

test('reads bounded UTF-8 source and lists only permitted entries without writes', async t => {
  const { root, reader } = await fixture(t);
  await fs.mkdir(path.join(root, 'tools'));
  await fs.writeFile(path.join(root, 'tools', 'example.mjs'), 'export const value = 1;\n');
  assert.equal(await reader.read('README.md'), 'Project source\n');
  assert.equal(await reader.read('tools/example.mjs'), 'export const value = 1;\n');
  assert.deepEqual((await reader.list()).entries.map(e => e.name), ['README.md', 'tools']);
  assert.equal((await reader.list('tools')).entries[0].name, 'example.mjs');
});

test('denies traversal, hidden secrets, generated directories, Windows ADS and device paths', async t => {
  const { reader } = await fixture(t);
  for (const value of ['../private.txt', '/etc/passwd', 'C:/Windows/win.ini', 'C:private.txt', '\\\\host\\share', 'tools\\file.mjs', '.env', '.dev.vars', '.git/config', 'node_modules/readme.md', 'dist/index.html', 'credentials.json', 'README.md:secret', 'README.md.', 'README.md ', 'NUL.txt', 'COM1.txt', 'a/../README.md', 'a//b', 'a\0.txt']) {
    await assert.rejects(() => reader.read(value), undefined, value);
  }
  assert.deepEqual((await reader.list()).entries.map(e => e.name), ['README.md']);
});

test('denies symbolic links and junctions even when they point inside the project', async t => {
  const { root, directory, reader } = await fixture(t);
  await fs.mkdir(path.join(root, 'tools'));
  await fs.writeFile(path.join(root, 'tools', 'example.mjs'), 'source');
  await fs.symlink(directory, path.join(root, 'outside'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.symlink(path.join(root, 'tools'), path.join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(() => reader.read('outside/private.txt'));
  await assert.rejects(() => reader.read('alias/example.mjs'));
  assert.equal((await reader.list()).entries.some(e => ['outside', 'alias'].includes(e.name)), false);
});

test('denies hard links, binary content, invalid UTF-8 and oversized files', async t => {
  const { root, directory, reader } = await fixture(t);
  await fs.link(path.join(directory, 'private.txt'), path.join(root, 'linked.txt'));
  await fs.writeFile(path.join(root, 'binary.txt'), Buffer.from([0, 1, 2]));
  await fs.writeFile(path.join(root, 'invalid.txt'), Buffer.from([0xff]));
  await fs.writeFile(path.join(root, 'large.txt'), Buffer.alloc(262145, 65));
  for (const name of ['linked.txt', 'binary.txt', 'invalid.txt', 'large.txt']) await assert.rejects(() => reader.read(name));
});

test('caps directory results and marks truncation', async t => {
  const { root, reader } = await fixture(t);
  await Promise.all(Array.from({ length: 205 }, (_, i) => fs.writeFile(path.join(root, `file-${i}.txt`), 'source')));
  const result = await reader.list();
  assert.equal(result.entries.length, 200);
  assert.equal(result.truncated, true);
});

test('real stdio MCP initialize, tool discovery and denied calls never expose fixture secrets', async t => {
  const { root } = await fixture(t);
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('./server.mjs', import.meta.url)), '--root', root], stderr: 'pipe' });
  const client = new Client({ name: 'project-mcp-test', version: '1.0.0' });
  t.after(() => client.close());
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map(tool => tool.name), ['project_info', 'list_files', 'read_text']);
  assert.ok(tools.every(tool => tool.annotations.readOnlyHint && !tool.annotations.openWorldHint));
  const info = await client.callTool({ name: 'project_info', arguments: {} });
  assert.equal(JSON.parse(info.content[0].text).readOnly, true);
  assert.equal((await client.callTool({ name: 'read_text', arguments: { path: 'README.md' } })).content[0].text, 'Project source\n');
  for (const args of [{ name: 'read_text', arguments: { path: '.env' } }, { name: 'read_text', arguments: { path: '../private.txt' } }, { name: 'read_text', arguments: {} }, { name: 'shell', arguments: { command: 'echo forbidden' } }, { name: 'list_files', arguments: { path: '.', command: 'forbidden' } }]) {
    const result = await client.callTool(args);
    assert.equal(result.isError, true);
    assert.doesNotMatch(JSON.stringify(result), /secret-fixture|outside-fixture|C:\\|\/tmp\//);
  }
});

test('startup without an explicit project root fails closed and emits no protocol output', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./server.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /startup failed/);
});
