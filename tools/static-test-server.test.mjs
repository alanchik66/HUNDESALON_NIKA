import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startStaticTestServer } from './lib/static-test-server.mjs';

test('preview serves public assets and rejects credentials, source files, links and malformed URLs', async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'nika-preview-'));
  t.after(() => rm(fixture, { force: true, recursive: true }));
  const root = path.join(fixture, 'site');
  await mkdir(path.join(root, 'assets'), { recursive: true });
  await mkdir(path.join(root, 'work'));
  await mkdir(path.join(fixture, 'outside'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html>');
  await writeFile(path.join(root, 'assets', 'public.txt'), 'public');
  await writeFile(path.join(root, 'assets', 'private.token'), 'private fixture');
  await writeFile(path.join(root, '.dev.vars'), 'TEST_ONLY=fixture');
  await writeFile(path.join(root, 'work', 'private.txt'), 'private fixture');
  await writeFile(path.join(root, 'package.json'), '{}');
  await writeFile(path.join(fixture, 'outside', 'private.txt'), 'private fixture');
  await symlink(
    path.join(fixture, 'outside'),
    path.join(root, 'assets', 'linked'),
    process.platform === 'win32' ? 'junction' : 'dir'
  );
  const server = await startStaticTestServer(root);
  t.after(() => server.close());
  for (const route of [
    '/.dev.vars',
    '/work/private.txt',
    '/package.json',
    '/assets/linked/private.txt',
    '/assets/private.token',
  ]) {
    assert.equal((await fetch(`${server.baseUrl}${route}`)).status, 403, route);
  }
  assert.equal((await fetch(`${server.baseUrl}/%ZZ`)).status, 400);
  assert.equal((await fetch(`${server.baseUrl}/sendmail`, { method: 'POST' })).status, 501);
  assert.equal((await fetch(`${server.baseUrl}/`)).status, 200);
  assert.equal(await (await fetch(`${server.baseUrl}/assets/public.txt`)).text(), 'public');
});
