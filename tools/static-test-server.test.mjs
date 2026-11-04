import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { mkdtemp, mkdir, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startStaticTestServer } from './lib/static-test-server.mjs';

test('canceling video ranges closes every source file and leaves the preview usable', { timeout: 10000 }, async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'nika-canceled-video-'));
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'index.html'), 'still usable');
  await writeFile(path.join(root, 'assets', 'video.mp4'), Buffer.alloc(8 * 1024 * 1024));
  const streams = [];
  const createReadStream = fs.createReadStream;
  const mock = t.mock.method(fs, 'createReadStream', (...args) => {
    const stream = createReadStream(...args);
    streams.push(stream);
    return stream;
  });
  syncBuiltinESMExports();
  let server;
  try {
    server = await startStaticTestServer(root);
    await Promise.all(Array.from({ length: 8 }, () => new Promise((resolve, reject) => {
      let received = false;
      const request = get(`${server.baseUrl}/assets/video.mp4`, { headers: { Range: 'bytes=0-' } }, response => {
        received = true;
        assert.equal(response.statusCode, 206);
        response.once('data', () => response.destroy());
        response.once('close', resolve);
        response.on('error', () => {});
      });
      request.on('error', error => { if (!received) reject(error); });
    })));
    assert.equal(streams.length, 8);
    for (let attempt = 0; attempt < 100 && streams.some(stream => !stream.closed); attempt++) await delay(10);
    assert.ok(streams.every(stream => stream.closed && stream.destroyed && stream.fd === null), 'canceled ranges must release all file descriptors');
    assert.equal(await (await fetch(server.baseUrl)).text(), 'still usable');
  } finally {
    streams.forEach(stream => stream.destroy());
    await server?.close();
    mock.mock.restore();
    syncBuiltinESMExports();
    await rm(root, { recursive: true, force: true });
  }
});

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
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${server.baseUrl}${route}`, { method });
      assert.equal(response.status, 403, `${method} ${route}`);
      assert.equal(response.headers.get('content-type'), 'text/plain; charset=utf-8');
      assert.equal(await response.text(), method === 'HEAD' ? '' : 'Forbidden');
    }
  }
  for (const method of ['GET', 'HEAD']) {
    const malformed = await fetch(`${server.baseUrl}/%ZZ`, { method });
    assert.equal(malformed.status, 400);
    assert.equal(malformed.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(await malformed.text(), method === 'HEAD' ? '' : 'Bad request');
    const missing = await fetch(`${server.baseUrl}/assets/missing.txt`, { method });
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('content-type'), 'text/plain; charset=utf-8');
    assert.equal(await missing.text(), method === 'HEAD' ? '' : 'Not found');
  }
  const submission = await fetch(`${server.baseUrl}/sendmail`, { method: 'POST' });
  assert.equal(submission.status, 501);
  assert.equal(submission.headers.get('content-type'), 'text/plain; charset=utf-8');
  assert.equal(submission.headers.get('allow'), 'GET, HEAD');
  assert.equal(await submission.text(), 'Use the Cloudflare Functions preview for form submissions');
  assert.equal((await fetch(`${server.baseUrl}/`)).status, 200);
  assert.equal(await (await fetch(`${server.baseUrl}/assets/public.txt`)).text(), 'public');
});

test('weather preview overlays only authored module URLs and keeps build files private', async t => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'nika-weather-preview-'));
  t.after(() => rm(fixture, { force: true, recursive: true }));
  const root = path.join(fixture, 'site');
  const weather = path.join(root, '3d-weather-codrops-main');
  const runtime = path.join(weather, 'dist-widget');
  const candidate = path.join(root, 'output', 'weather-local');
  await mkdir(runtime, { recursive: true });
  await mkdir(candidate, { recursive: true });
  await writeFile(path.join(weather, 'build-manifest.json'), JSON.stringify({ entries: [{ output: 'widget.mjs' }] }));
  await writeFile(path.join(runtime, 'widget.mjs'), 'baseline');
  await writeFile(path.join(runtime, 'vendor.mjs'), 'original vendor');
  await writeFile(path.join(candidate, 'widget.mjs'), 'updated module');
  await writeFile(path.join(candidate, 'widget.mjs.map'), '{}');
  await writeFile(path.join(candidate, 'vendor.mjs'), 'must not replace vendor');
  const server = await startStaticTestServer(root, { weatherModuleDirectory: candidate });
  t.after(() => server.close());
  const get = route => fetch(`${server.baseUrl}${route}`);
  assert.equal(await (await get('/3d-weather-codrops-main/dist-widget/widget.mjs?v=current')).text(), 'updated module');
  assert.equal(await (await get('/3d-weather-codrops-main/dist-widget/widget.mjs.map')).text(), '{}');
  assert.equal(await (await get('/3d-weather-codrops-main/dist-widget/vendor.mjs')).text(), 'original vendor');
  assert.equal((await get('/output/weather-local/widget.mjs')).status, 403);
  assert.equal((await get('/3d-weather-codrops-main/build-manifest.json')).status, 403);
  await assert.rejects(startStaticTestServer(root, { weatherModuleDirectory: fixture }), /inside the site workspace/);
});

test('preview streams actual video byte ranges with HEAD, suffix and If-Range semantics', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nika-video-preview-'));
  await mkdir(path.join(root, 'assets'));
  const filename = path.join(root, 'assets', 'clip.mp4');
  const body = '0123456789abcdefghij';
  const modified = new Date('2026-11-03T08:00:00Z');
  await writeFile(filename, body);
  await writeFile(path.join(root, 'assets', 'empty.mp4'), '');
  await utimes(filename, modified, modified);
  const server = await startStaticTestServer(root);
  const request = (method, headers = {}, route = '/assets/clip.mp4') => fetch(`${server.baseUrl}${route}`, { method, headers });
  try {
    for (const method of ['GET', 'HEAD']) {
      const full = await request(method);
      assert.equal(full.status, 200);
      assert.equal(full.headers.get('content-type'), 'video/mp4');
      assert.equal(full.headers.get('content-length'), '20');
      assert.equal(full.headers.get('accept-ranges'), 'bytes');
      assert.equal(full.headers.get('last-modified'), modified.toUTCString());
      assert.equal(await full.text(), method === 'HEAD' ? '' : body);
      for (const [range, start, end] of [
        ['bytes=0-3', 0, 3], ['bytes=4-', 4, 19], ['bytes=-5', 15, 19],
        ['bytes=19-19', 19, 19], ['bytes=0-999', 0, 19], ['bytes=-999999999999999999999999', 0, 19],
      ]) {
        const partial = await request(method, { Range: range });
        assert.equal(partial.status, 206, range);
        assert.equal(partial.headers.get('content-type'), 'video/mp4');
        assert.equal(partial.headers.get('content-range'), `bytes ${start}-${end}/20`);
        assert.equal(partial.headers.get('content-length'), String(end - start + 1));
        assert.equal(await partial.text(), method === 'HEAD' ? '' : body.slice(start, end + 1));
      }
      for (const range of ['bytes=20-', 'bytes=100-199', 'bytes=-0', 'bytes=999999999999999999999999-']) {
        const unsatisfiable = await request(method, { Range: range });
        assert.equal(unsatisfiable.status, 416, range);
        assert.equal(unsatisfiable.headers.get('content-range'), 'bytes */20');
        assert.equal(unsatisfiable.headers.get('content-length'), '0');
        assert.equal(await unsatisfiable.text(), '');
      }
      for (const range of ['bytes=0-1,4-5', 'bytes=9-2', 'bytes=garbage', 'other=0-3']) {
        const ignored = await request(method, { Range: range });
        assert.equal(ignored.status, 200, range);
        assert.equal(ignored.headers.get('content-range'), null);
        assert.equal(await ignored.text(), method === 'HEAD' ? '' : body);
      }
      const matched = await request(method, { Range: 'bytes=0-3', 'If-Range': modified.toUTCString() });
      assert.equal(matched.status, 206);
      assert.equal(await matched.text(), method === 'HEAD' ? '' : '0123');
      for (const ifRange of ['Mon, 02 Nov 2026 08:00:00 GMT', 'Wed, 04 Nov 2026 08:00:00 GMT', 'invalid', '"unsupported-tag"']) {
        const changed = await request(method, { Range: 'bytes=0-3', 'If-Range': ifRange });
        assert.equal(changed.status, 200, ifRange);
        assert.equal(changed.headers.get('content-range'), null);
        assert.equal(await changed.text(), method === 'HEAD' ? '' : body);
      }
      const empty = await request(method, { Range: 'bytes=0-3' }, '/assets/empty.mp4');
      assert.equal(empty.status, 416);
      assert.equal(empty.headers.get('content-range'), 'bytes */0');
      assert.equal(await empty.text(), '');
    }
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
