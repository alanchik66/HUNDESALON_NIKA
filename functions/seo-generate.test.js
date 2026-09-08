import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from './seo-generate.js';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };
const origin = 'https://hundesalon-nika.com';

function context(authorized = true) {
  return {
    request: new Request(`${origin}/seo-generate`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
        ...(authorized ? { Authorization: 'Bearer test-auth' } : {}),
      },
      body: JSON.stringify({ topic: 'Dog grooming' }),
    }),
    env: { AI_SERVICE_WEBHOOK_SECRET: 'test-auth', SERVICE_GATEWAY_API_KEY: 'test-provider-key' },
  };
}

test('SEO rejects unauthenticated requests without calling the provider', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Unexpected provider call');
  };
  try {
    const response = await onRequest(context(false));
    assert.equal(response.status, 401);
  } finally {
    globalThis.fetch = original;
  }
});

for (const failure of ['provider', 'network', 'body']) {
  test(`SEO hides sensitive details of ${failure} failures`, async () => {
    const original = globalThis.fetch;
    const sensitive = 'test-provider-key private upstream detail';
    globalThis.fetch = async () => {
      if (failure === 'network') throw new Error(sensitive);
      if (failure === 'body')
        return {
          text: async () => {
            throw new Error(sensitive);
          },
        };
      return new Response(sensitive, { status: 401 });
    };
    try {
      const response = await onRequest(context());
      assert.equal(response.status, 502);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      const body = await response.text();
      assert.doesNotMatch(body, /test-provider-key|private upstream detail/);
      assert.match(body, /error/);
    } finally {
      globalThis.fetch = original;
    }
  });
}
