import test from 'node:test';
import assert from 'node:assert/strict';

import { AI_CHAT_UPLOAD_MAX_BYTES, onRequest } from './ai-chat-upload.js';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };

const origin = 'https://hundesalon-nika.com';
const env = { DRIVE_UPLOAD_FOLDER: 'folder-123', GOOGLE_OAUTH_ACCESS_TOKEN: 'test-token' };

function request(body, ip = crypto.randomUUID()) {
  return new Request(`${origin}/api/ai-chat-upload`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

test('rejects files larger than 150 MB before contacting Drive', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Drive must not be contacted');
  try {
    const response = await onRequest({
      request: request({ action: 'start', fileName: 'large.bin', size: AI_CHAT_UPLOAD_MAX_BYTES + 1 }),
      env,
    });
    assert.equal(response.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('starts a resumable Drive upload for an arbitrary file type', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /uploadType=resumable/);
    assert.equal(options.headers['X-Upload-Content-Type'], 'application/x-custom-format');
    assert.equal(options.headers['X-Upload-Content-Length'], '4096');
    return new Response(null, {
      status: 200,
      headers: { Location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test-session' },
    });
  };
  try {
    const response = await onRequest({
      request: request({
        action: 'start',
        fileName: 'sample.custom',
        size: 4096,
        mimeType: 'application/x-custom-format',
        kind: 'file',
      }),
      env,
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.match(body.uploadUrl, /^https:\/\/www\.googleapis\.com\/upload\//);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('verifies the Drive folder before accepting completion', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      id: 'file-1234567890',
      name: 'voice.webm',
      size: '2048',
      mimeType: 'audio/webm',
      parents: ['another-folder'],
    });
  try {
    const response = await onRequest({
      request: request({ action: 'complete', fileId: 'file-1234567890', kind: 'voice' }),
      env,
    });
    assert.equal(response.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
