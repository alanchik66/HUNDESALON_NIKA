import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAiResponse } from './ai-upstream.js';

test('AI request preserves provider status and buffers the body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-only');
    assert.equal(options.signal.aborted, false);
    return new Response('provider failure', { status: 429 });
  };
  try {
    const result = await fetchAiResponse('https://example.invalid', {
      headers: { Authorization: 'Bearer test-only' },
    });
    assert.equal(result.response.status, 429);
    assert.equal(result.text, 'provider failure');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const stage of ['headers', 'body']) {
  test(`AI timeout aborts stalled ${stage}`, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, { signal }) => {
      const pending = () =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new globalThis.DOMException('Aborted', 'AbortError')), {
            once: true,
          });
        });
      return stage === 'headers' ? pending() : { text: pending };
    };
    try {
      await assert.rejects(fetchAiResponse('https://example.invalid', {}, 10), { name: 'AbortError' });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
