import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestGet } from './ai-chat-gifs.js';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };

function request(query = '', ip = crypto.randomUUID(), cf) {
  const value = new Request(`https://hundesalon-nika.com/api/ai-chat-gifs${query}`, {
    headers: { 'CF-Connecting-IP': ip },
  });
  if (cf) Object.defineProperty(value, 'cf', { value: cf });
  return value;
}

test('reports an unconfigured GIF provider without an API key', async () => {
  const response = await onRequestGet({ request: request(), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'Internal server error');
});

test('uses safe-search and returns only normalized GIPHY media URLs', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/v1/gifs/search');
    assert.equal(parsed.searchParams.get('q'), 'happy dog');
    assert.equal(parsed.searchParams.get('rating'), 'g');
    assert.equal(parsed.searchParams.get('lang'), 'ru');
    assert.equal(parsed.searchParams.get('country_code'), 'DE');
    assert.equal(parsed.searchParams.get('region'), 'SN');
    assert.equal(parsed.searchParams.get('remove_low_contrast'), 'true');
    return Response.json({
      data: [
        {
          id: 'safe-gif',
          title: 'Happy dog',
          images: {
            fixed_width_downsampled: { webp: 'https://media2.giphy.com/media/safe/200w_d.webp' },
            original: { webp: 'https://media2.giphy.com/media/safe/giphy.webp' },
          },
        },
        {
          id: 'unsafe-host',
          title: 'Unsafe',
          images: {
            fixed_width_downsampled: { webp: 'https://example.com/preview.webp' },
            original: { webp: 'https://example.com/original.webp' },
          },
        },
      ],
    });
  };
  try {
    const response = await onRequestGet({
      request: request('?q=happy%20dog&locale=ru', crypto.randomUUID(), { country: 'de', regionCode: 'sn' }),
      env: { GIPHY_API_KEY: 'test' },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.items.length, 1);
    assert.equal(payload.items[0].title, 'Happy dog');
    assert.match(payload.items[0].url, /^https:\/\/media2\.giphy\.com\//);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
