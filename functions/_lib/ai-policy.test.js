import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_PROVIDER_POLICY,
  APPROVED_AI_MODEL,
  hasAiServiceAuth,
  parseBoundedTokens,
  resolveApprovedModel,
} from './ai-policy.js';

const request = authorization =>
  new Request('https://hundesalon-nika.com/message-draft', {
    headers: { Authorization: authorization || '' },
  });

test('allows only the existing Gemini model and fixed Google provider policy', () => {
  assert.equal(resolveApprovedModel(APPROVED_AI_MODEL), APPROVED_AI_MODEL);
  assert.equal(resolveApprovedModel(''), APPROVED_AI_MODEL);
  assert.equal(resolveApprovedModel('other/model'), '');
  assert.deepEqual(AI_PROVIDER_POLICY, {
    only: ['google-ai-studio'],
    allow_fallbacks: false,
    require_parameters: true,
  });
});

test('requires the server-side AI service secret', () => {
  const context = { env: { AI_SERVICE_WEBHOOK_SECRET: 'secret-value' } };
  assert.equal(hasAiServiceAuth(request(''), context), false);
  assert.equal(hasAiServiceAuth(request('Bearer wrong'), context), false);
  assert.equal(hasAiServiceAuth(request('Bearer secret-value'), context), true);
});

test('bounds output tokens conservatively', () => {
  assert.equal(parseBoundedTokens('9999', 320, 64, 320), 320);
  assert.equal(parseBoundedTokens('1', 320, 64, 320), 64);
  assert.equal(parseBoundedTokens('', 320, 64, 320), 320);
});
