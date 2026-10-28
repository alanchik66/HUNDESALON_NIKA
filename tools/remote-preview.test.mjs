import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createRemoteGateway } from './dev-remote-preview.mjs';

test('phone preview requires the secret link and exposes only public read-only files', async () => {
  const key = 'a'.repeat(43);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const gateway = await createRemoteGateway({ root, key });
  const request = (url, options) => fetch(`${gateway.baseUrl}${url}`, { redirect: 'manual', ...options });
  const headers = { Cookie: `__Host-nika-preview=${key}` };
  try {
    assert.equal((await request('/ru/prays-list.html')).status, 403);
    assert.equal((await request('/__preview_login?key=incorrect')).status, 403);
    const login = await request(`/__preview_login?key=${key}`);
    assert.equal(login.status, 303);
    assert.equal(login.headers.get('location'), '/ru/prays-list.html');
    assert.match(login.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/);
    assert.equal(login.headers.get('referrer-policy'), 'no-referrer');
    const page = await request('/ru/prays-list.html', { headers });
    assert.equal(page.status, 200);
    assert.match(page.headers.get('x-robots-tag'), /noindex/);
    assert.match(page.headers.get('cache-control'), /no-store/);
    assert.match(await page.text(), /data-price-booking-flow/);
    for (const url of [
      '/package.json',
      '/.git/config',
      '/.dev.vars',
      '/tools/dev-remote-preview.mjs',
      '/output/local-preview/remote-config.json',
      '/functions/sendmail.js',
      '/knowledge/MEMORY.md',
      '/assets/.dev.vars',
      '/sw.js',
      '/sp-push-worker-fb.js',
    ]) {
      assert.equal((await request(url, { headers })).status, 403, url);
    }
    const asset = await request('/assets/js/price-page.js', { method: 'HEAD', headers });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.equal((await request('/sendmail', { method: 'POST', headers, body: 'test' })).status, 405);
    assert.equal((await request('/__preview_stop', { method: 'POST' })).status, 403);
  } finally {
    await gateway.close();
  }
});

test('public read-only phone preview keeps internal files and submissions closed', async () => {
  const gateway = await createRemoteGateway({
    root: fileURLToPath(new URL('../', import.meta.url)),
    key: 'b'.repeat(43),
    publicReadOnly: true,
  });
  try {
    const request = (url, options) => fetch(`${gateway.baseUrl}${url}`, options);
    assert.equal((await request('/ru/prays-list.html')).status, 200);
    for (const url of [
      '/output/local-preview/remote-config.json',
      '/.git/config',
      '/.dev.vars',
      '/tools/start-remote-preview.mjs',
      '/functions/sendmail.js',
      '/sw.js',
    ])
      assert.equal((await request(url)).status, 403, url);
    assert.equal((await request('/sendmail', { method: 'POST', body: 'test' })).status, 405);
    assert.equal((await request('/__preview_stop', { method: 'POST' })).status, 405);
    assert.match((await request('/robots.txt')).headers.get('x-robots-tag'), /noindex/);
  } finally {
    await gateway.close();
  }
});
