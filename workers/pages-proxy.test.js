import assert from 'node:assert/strict';
import test from 'node:test';

import worker from './pages-proxy.js';

test('rejects source-only assets before requesting the Pages origin', async () => {
  const originalFetch = globalThis.fetch;
  let originCalled = false;
  globalThis.fetch = async () => {
    originCalled = true;
    return new Response('unexpected');
  };

  try {
    const response = await worker.fetch(
      new Request('https://hundesalon-nika.com/assets/video/ads/hundesalon-nika-promo.mp4')
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(originCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('continues proxying public brand assets', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async request => new Response(new URL(request.url).pathname, { status: 200 });

  try {
    const response = await worker.fetch(
      new Request('https://hundesalon-nika.com/assets/images/ads/work/logo-from-card-crown-512.png')
    );
    assert.equal(response.status, 200);
    assert.equal(await response.text(), '/assets/images/ads/work/logo-from-card-crown-512.png');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
