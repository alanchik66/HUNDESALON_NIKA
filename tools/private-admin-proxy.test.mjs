import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { createPrivateAdminProxy } from './lib/private-admin-proxy.mjs';
import {
  GALLERY_COMPARISON_JSON_LIMIT,
  GALLERY_COMPARISON_UPLOAD_LIMIT,
} from '../functions/_lib/gallery-comparisons.js';

const origin = 'https://owner.example.test';
const token = 'a'.repeat(64);
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
async function fixture(t, route, options = {}) {
  const seen = [];
  const backend = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    seen.push({ url: req.url, method: req.method, headers: req.headers, bytes, body: bytes.toString() });
    route(req, res);
  });
  const upstream = 'http://127.0.0.1:' + (await listen(backend));
  let registered = origin;
  const gateway = createPrivateAdminProxy({ ...options, upstream, getOrigin: () => registered });
  const port = await listen(gateway);
  t.after(async () => {
    for (const server of [gateway, backend]) {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
  const send = (url, { method = 'GET', headers = {}, body } = {}) =>
    new Promise((resolve, reject) => {
      const call = request(
        { host: '127.0.0.1', port, path: url, method, headers: { Host: new URL(origin).host, ...headers } },
        res => {
          const chunks = [];
          res.on('data', part => chunks.push(part));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
        }
      );
      call.on('error', reject);
      call.end(body);
    });
  return {
    seen,
    send,
    upstream,
    register: value => {
      registered = value;
    },
  };
}

test('only the registered origin reaches known routes; unregistered and unrelated routes stay closed', async t => {
  const { send, seen, register } = await fixture(t, (_req, res) => res.end('page'));
  register(null);
  assert.equal((await send('/admin/')).status, 503);
  register(origin);
  assert.equal((await send('/admin/', { headers: { Host: 'other.example.test' } })).status, 403);
  for (const path of ['/functions/', '/api/admin/other', '/ru/unknown', '/assets/.env', '/sw.js']) {
    assert.equal((await send(path)).status, 404, path);
  }
  for (const path of ['//other.example.test/admin', '/assets/%2e%2e/api/admin/pages', '/assets/%2fother']) {
    assert.equal((await send(path)).status, 400, path);
  }
  for (const [path, method] of [
    ['/sendmail', 'POST'],
    ['/api/admin/settings', 'DELETE'],
    ['/api/admin/session', 'PATCH'],
  ]) {
    assert.equal((await send(path, { method })).status, 405, path);
  }
  for (const header of [{}, { Origin: 'https://other.example.test', 'X-Forwarded-Host': new URL(origin).host }]) {
    assert.equal((await send('/api/admin/session', { method: 'POST', headers: header })).status, 403);
  }
  assert.equal((await send('/assets/js/site-shell.js', { headers: { 'Service-Worker': 'script' } })).status, 403);
  assert.equal(seen.length, 0);
  for (const path of [
    '/admin/',
    '/ru/',
    '/ru/promotions',
    '/en/blog/blog.html',
    '/assets/css/site-admin.css',
    '/3d-weather-codrops-main/dist-widget/weather-widget.iife.js',
  ]) {
    const copy = await send(path);
    assert.equal(copy.status, 200, path);
    assert.equal(copy.headers['cache-control'], 'private, no-store');
  }
  assert.throws(
    () => createPrivateAdminProxy({ getOrigin: () => origin, upstream: 'https://example.test' }),
    /loopback/
  );
});

test('the transfer landing stays on the protected origin and intercepts only its exact GET path', async t => {
  let active = true;
  let checks = 0;
  const { send, seen } = await fixture(t, (_req, res) => res.end('upstream'), {
    isOwnerKeyTransferActive: async () => {
      checks++;
      return active;
    },
  });
  const landing = '/admin/?key-transfer=1';
  const opened = await send(landing);
  assert.equal(opened.status, 200);
  assert.match(opened.headers['content-type'], /text\/html/);
  assert.equal(opened.headers['cache-control'], 'private, no-store');
  assert.match(opened.bytes.toString(), /href="\/owner-key-transfer\/"/);

  active = false;
  const expired = await send(landing);
  assert.equal(expired.status, 200);
  assert.match(expired.bytes.toString(), /href="\/admin\/"/);
  assert.match(expired.bytes.toString(), /Сеанс переноса закрыт/);
  assert.doesNotMatch(expired.bytes.toString(), /href="\/owner-key-transfer\/"/);

  assert.equal((await send(landing, { headers: { Host: 'other.example.test' } })).status, 403);
  assert.equal((await send(landing, { headers: { Origin: 'https://other.example.test' } })).status, 403);
  assert.equal((await send(landing, { method: 'POST' })).status, 405);
  assert.equal(seen.length, 0);

  const expectedUpstream = [
    ['/admin/', 'GET'],
    ['/admin?key-transfer=1', 'GET'],
    ['/admin/?key-transfer=0', 'GET'],
    ['/admin/?key-transfer=1&key-transfer=1', 'GET'],
    ['/api/admin/settings?key-transfer=1', 'GET'],
    [landing, 'HEAD'],
  ];
  for (const [url, method] of expectedUpstream) {
    assert.equal((await send(url, { method })).status, 200, `${method} ${url}`);
  }
  assert.deepEqual(
    seen.map(({ url, method }) => [url, method]),
    expectedUpstream
  );
  assert.equal(checks, 2);
});

test('the owner session is translated only for the admin API and cleared on logout', async t => {
  const { send, seen, upstream } = await fixture(t, (req, res) => {
    const clear = req.method === 'DELETE';
    res.setHeader('Set-Cookie', [
      'test=ignored',
      'nika-admin-local=' +
        (clear ? '' : token) +
        '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' +
        (clear ? '0' : '28800'),
    ]);
    res.end('ok');
  });
  const writes = { Origin: origin, 'Content-Type': 'application/json' };
  const auth = await send('/api/admin/session', {
    method: 'POST',
    headers: writes,
    body: JSON.stringify({ key: 'test' }),
  });
  assert.equal(auth.status, 200);
  assert.equal(auth.headers['set-cookie'].length, 1);
  const cookie = '__Host-nika-admin=' + token;
  assert.equal(auth.headers['set-cookie'][0], cookie + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=28800');
  assert.equal(seen[0].headers.origin, upstream);
  assert.equal(seen[0].body, '{"key":"test"}');
  const incoming = {
    Cookie: 'junk=1; ' + cookie + '; nika-admin-local=' + 'b'.repeat(64),
    Authorization: 'unexpected',
    Forwarded: 'unexpected',
    'X-Forwarded-Host': 'unrelated.example',
  };
  const page = await send('/api/admin/page?locale=ru&slug=index', { headers: incoming });
  assert.equal(page.status, 200);
  assert.equal(seen.at(-1).headers.cookie, 'nika-admin-local=' + token);
  assert.equal(page.headers['set-cookie'], undefined);
  for (const name of ['authorization', 'forwarded', 'x-forwarded-host'])
    assert.equal(seen.at(-1).headers[name], undefined);
  await send('/assets/js/site-admin.js', { headers: incoming });
  assert.equal(seen.at(-1).headers.cookie, undefined);
  await send('/api/admin/settings', { method: 'PATCH', headers: { ...incoming, ...writes }, body: '{}' });
  assert.equal(seen.at(-1).method, 'PATCH');
  assert.equal(seen.at(-1).body, '{}');
  assert.equal(
    (await send('/api/admin/session', { method: 'POST', headers: writes, body: 'x'.repeat(4097) })).status,
    413
  );
  const logout = await send('/api/admin/session', { method: 'DELETE', headers: { ...incoming, Origin: origin } });
  assert.equal(logout.status, 200);
  assert.equal(
    logout.headers['set-cookie'][0],
    '__Host-nika-admin=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'
  );
});

test('direct media uploads preserve binary requests and their existing per-type size limits', async t => {
  const { send, seen, upstream } = await fixture(t, (_req, res) => res.end('ok'));
  const path = '/api/admin/media?locale=ru&slug=galereya';
  const headers = { Origin: origin, Cookie: '__Host-nika-admin=' + token, 'Content-Type': 'image/png' };
  assert.equal((await send(path, { method: 'POST', headers, body: 'PNG fixture' })).status, 200);
  assert.equal(seen[0].headers.origin, upstream);
  assert.equal(seen[0].headers.cookie, 'nika-admin-local=' + token);
  assert.equal(seen[0].headers['content-type'], 'image/png');
  assert.equal(seen[0].body, 'PNG fixture');

  assert.equal((await send(path, { method: 'POST', headers: { ...headers, Origin: 'https://other.example.test' } })).status, 403);
  assert.equal((await send(path, { method: 'POST', headers: { ...headers, 'Content-Type': 'image/svg+xml' } })).status, 415);
  const oversized = await send(path, { method: 'POST', headers: { ...headers, 'Content-Length': 4194305 } });
  assert.equal(oversized.status, 413);
  assert.equal(oversized.headers.connection, 'close');
  const largeVideo = await send(path, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'video/mp4', 'Content-Length': 12 * 1024 * 1024 + 1 },
  });
  assert.equal(largeVideo.status, 413);
  assert.equal(seen.length, 1);
});

test('video upload control requests are bodyless and binary requests stay within the chunk limit', async t => {
  const { send, seen, upstream } = await fixture(t, (_req, res) => res.end('ok'));
  const ownerHeaders = { Origin: origin, Cookie: '__Host-nika-admin=' + token };
  const binaryHeaders = { ...ownerHeaders, 'Content-Type': 'application/octet-stream' };
  const uploadPath = '/api/admin/media?action=';
  for (const action of ['begin', 'finish', 'abort']) {
    const url = uploadPath + action + '&locale=ru&slug=galereya';
    const result = await send(url, { method: 'POST', headers: ownerHeaders });
    assert.equal(result.status, 200, action);
    const forwarded = seen.at(-1);
    assert.equal(forwarded.url, url);
    assert.equal(forwarded.headers.origin, upstream);
    assert.equal(forwarded.headers.cookie, 'nika-admin-local=' + token);
    assert.equal(forwarded.headers['content-type'], undefined);
    assert.equal(forwarded.bytes.length, 0);

    assert.equal((await send(url, { method: 'POST', headers: binaryHeaders })).status, 415);
    assert.equal((await send(url, { method: 'POST', headers: ownerHeaders, body: 'x' })).status, 413);
  }
  const url = uploadPath + 'chunk&id=fixture&part=1';
  const chunk = Buffer.alloc(1024 * 1024, 255);
  assert.equal((await send(url, { method: 'POST', headers: binaryHeaders, body: chunk })).status, 200);
  const forwarded = seen.at(-1);
  assert.equal(forwarded.url, url);
  assert.equal(forwarded.headers.origin, upstream);
  assert.equal(forwarded.headers.cookie, 'nika-admin-local=' + token);
  assert.equal(forwarded.headers['content-type'], 'application/octet-stream');
  assert.deepEqual(forwarded.bytes, chunk);

  const rejectedOrigin = await send(url, {
    method: 'POST',
    headers: { ...binaryHeaders, Origin: 'https://other.example.test' },
    body: chunk,
  });
  assert.equal(rejectedOrigin.status, 403);
  assert.equal((await send(url, { method: 'POST', headers: ownerHeaders, body: 'x' })).status, 415);
  const oversizedChunk = await send(url, {
    method: 'POST',
    headers: { ...binaryHeaders, 'Transfer-Encoding': 'chunked' },
    body: Buffer.alloc(chunk.length + 1),
  });
  assert.equal(oversizedChunk.status, 413);
  for (const action of ['unknown', 'begin&action=chunk']) {
    assert.equal((await send(uploadPath + action, { method: 'POST', headers: ownerHeaders })).status, 400);
  }
  assert.equal(seen.length, 4);
});

test('private and published video responses preserve accepted byte ranges and HEAD lengths', async t => {
  const sample = Buffer.from([0, 255]);
  const { send, seen } = await fixture(t, (req, res) => {
    res.writeHead(req.method === 'HEAD' ? 200 : 206, {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      ...(req.method === 'HEAD'
        ? { 'Content-Length': 150000000 }
        : { 'Content-Length': sample.length, 'Content-Range': 'bytes 0-1/150000000' }),
    });
    res.end(req.method === 'HEAD' ? undefined : sample);
  });
  const headers = {
    Cookie: '__Host-nika-admin=' + token,
    Range: 'bytes=0-1',
    'If-Range': 'Wed, 18 Nov 2026 00:00:00 GMT',
  };
  for (const [path, upstreamCookie] of [
    ['/api/admin/media?id=fixture', 'nika-admin-local=' + token],
    ['/api/site-media?id=fixture', undefined],
  ]) {
    const result = await send(path, { headers });
    assert.equal(seen.at(-1).headers.cookie, upstreamCookie);
    assert.equal(seen.at(-1).headers.range, headers.Range);
    assert.equal(seen.at(-1).headers['if-range'], headers['If-Range']);
    assert.equal(result.status, 206);
    assert.equal(result.headers['accept-ranges'], 'bytes');
    assert.equal(result.headers['content-type'], 'video/mp4');
    assert.equal(result.headers['content-range'], 'bytes 0-1/150000000');
    assert.equal(result.headers['content-length'], '2');
    assert.deepEqual(result.bytes, sample);

    const head = await send(path, { method: 'HEAD', headers: { Cookie: headers.Cookie } });
    assert.equal(head.status, 200);
    assert.equal(head.headers['content-length'], '150000000');
    assert.equal(head.bytes.length, 0);
  }
});

test('comparison uploads accept bounded JSON and preserve legacy multipart boundaries', async t => {
  const { send, seen, upstream } = await fixture(t, (_req, res) => res.end('ok'));
  const contentType = 'multipart/form-data; boundary=gallery-fixture';
  const body = '--gallery-fixture\r\nContent-Disposition: form-data; name="title"\r\n\r\nComparison\r\n--gallery-fixture--\r\n';
  const headers = { Origin: origin, Cookie: '__Host-nika-admin=' + token, 'Content-Type': contentType };
  assert.equal((await send('/api/admin/comparisons', { method: 'POST', headers, body })).status, 200);
  assert.equal(seen[0].headers['content-type'], contentType);
  assert.equal(seen[0].headers.origin, upstream);
  assert.equal(seen[0].headers.cookie, 'nika-admin-local=' + token);
  assert.equal(seen[0].body, body);

  const json = { ...headers, 'Content-Type': 'application/json' };
  const linked = '{"beforeId":"before","afterId":"after"}';
  assert.equal((await send('/api/admin/comparisons', { method: 'POST', headers: json, body: linked })).status, 200);
  assert.equal(seen[1].headers['content-type'], 'application/json');
  assert.equal(seen[1].body, linked);
  assert.equal((await send('/api/admin/comparisons', {
    method: 'POST', headers: { ...json, 'Content-Length': GALLERY_COMPARISON_JSON_LIMIT + 1 },
  })).status, 413);
  assert.equal((await send('/api/admin/comparisons', {
    method: 'POST', headers: { ...headers, 'Content-Length': GALLERY_COMPARISON_UPLOAD_LIMIT + 1 },
  })).status, 413);
  assert.equal((await send('/api/admin/comparisons', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'text/plain' }, body: 'x',
  })).status, 415);
  assert.equal(seen.length, 2);

  await send('/api/site-comparisons?id=fixture&side=before', { headers: { Cookie: headers.Cookie, Range: 'bytes=0-1' } });
  assert.equal(seen.at(-1).headers.cookie, undefined);
  assert.equal(seen.at(-1).headers.range, 'bytes=0-1');
});

test('only media responses preserve the upstream document attachment header', async t => {
  const disposition = 'attachment; filename="prices.pdf"';
  const { send } = await fixture(t, (_req, res) =>
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': disposition }).end('document')
  );
  for (const path of ['/api/admin/media?id=fixture', '/api/site-media?id=fixture']) {
    const response = await send(path);
    assert.equal(response.headers['content-disposition'], disposition);
    assert.equal(response.headers['content-type'], 'application/pdf');
    assert.equal(response.bytes.toString(), 'document');
  }
  assert.equal((await send('/admin/')).headers['content-disposition'], undefined);
});

test('redirects stay inside the preview and owner data is never replayed to a redirect target', async t => {
  const { send, seen } = await fixture(t, (req, res) => {
    let location = '/ru/';
    if (req.url.includes('absolute')) location = origin + '/ru/social?lang=ru#section';
    if (req.url.includes('outside')) location = 'https://other.example.test/';
    if (req.url.includes('private')) location = '/__preview_stop';
    res.writeHead(307, { Location: location }).end();
  });
  assert.equal((await send('/ru/index.html')).headers.location, origin + '/ru/');
  assert.equal((await send('/ru/?absolute')).headers.location, origin + '/ru/social?lang=ru#section');
  assert.equal((await send('/ru/?outside')).status, 502);
  assert.equal((await send('/ru/?private')).status, 502);
  const write = await send('/api/admin/session', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(write.status, 502);
  assert.equal(write.headers.location, undefined);
  assert.equal(seen.length, 5);
});

test('preview preserves the original charset and sends decoded response bytes with no stale compression metadata', async t => {
  const bytes = Buffer.from([0x4e, 0x69, 0x6b, 0x61, 0x20, 0xe4]);
  const encoded = gzipSync(bytes);
  const { send, seen } = await fixture(t, (_req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=windows-1252',
      'Content-Encoding': 'gzip',
      'Content-Length': encoded.length,
      'Content-Security-Policy': "object-src 'none'",
    });
    res.end(encoded);
  });
  const received = await send('/de/', { headers: { 'Accept-Encoding': 'br, gzip' } });
  assert.equal(seen[0].headers['accept-encoding'], 'identity');
  assert.deepEqual(received.bytes, bytes);
  assert.equal(received.headers['content-type'], 'text/html; charset=windows-1252');
  assert.equal(received.headers['content-encoding'], undefined);
  assert.equal(received.headers['content-length'], undefined);
  assert.match(received.headers['content-security-policy'], /script-src 'self'/);
});
