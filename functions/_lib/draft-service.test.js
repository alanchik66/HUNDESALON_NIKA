import test from 'node:test';
import assert from 'node:assert/strict';

import { handleMessageDraft } from './draft-service.js';

globalThis.caches = {
  default: { match: async () => null, put: async () => {} },
};

const origin = 'https://hundesalon-nika.com';

function context(body, env = {}) {
  return {
    request: new Request(`${origin}/message-draft`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Authorization: `Bearer ${env.AI_SERVICE_WEBHOOK_SECRET || 'secret-value'}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
    env,
  };
}

test('rejects caller-selected providers before any upstream call', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({});
  };

  try {
    const response = await handleMessageDraft(
      context(
        {
          messages: [{ role: 'user', content: 'hello' }],
          provider: { only: ['other-provider'] },
        },
        { AI_SERVICE_WEBHOOK_SECRET: 'secret-value', SERVICE_GATEWAY_API_KEY: 'key' }
      )
    );
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('sends one bounded Gemini request with fallbacks disabled', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return Response.json({ choices: [{ message: { role: 'assistant', content: 'OK' } }] });
  };

  try {
    const response = await handleMessageDraft(
      context(
        {
          messages: [{ role: 'user', content: 'hello' }],
          model: 'google/gemini-2.5-flash-lite',
          max_tokens: 9999,
          stream: true,
        },
        { AI_SERVICE_WEBHOOK_SECRET: 'secret-value', SERVICE_GATEWAY_API_KEY: 'key' }
      )
    );
    assert.equal(response.status, 200);
    assert.equal(captured.body.model, 'google/gemini-2.5-flash-lite');
    assert.deepEqual(captured.body.provider, {
      only: ['google-ai-studio'],
      allow_fallbacks: false,
      require_parameters: true,
    });
    assert.equal(captured.body.max_tokens, 320);
    assert.equal('stream' in captured.body, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
