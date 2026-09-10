import test from 'node:test';
import assert from 'node:assert/strict';

import { AI_CHAT_UPLOAD_CHUNK_MAX_BYTES, AI_CHAT_UPLOAD_MAX_BYTES, onRequest } from './ai-chat-upload.js';

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

test('does not rate-limit completion after an accepted file upload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      id: 'file-1234567890',
      name: 'delivery-check.txt',
      size: '2048',
      mimeType: 'text/plain',
      webViewLink: 'https://drive.google.com/file/d/file-1234567890/view',
      parents: ['folder-123'],
    });
  try {
    for (let attempt = 0; attempt < 13; attempt += 1) {
      const response = await onRequest({
        request: request({ action: 'complete', fileId: 'file-1234567890', kind: 'file' }, 'same-client'),
        env,
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.fileId, 'file-1234567890');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('proxies a validated upload chunk to Drive without browser CORS', async () => {
  const originalFetch = globalThis.fetch;
  const bytes = new Uint8Array([1, 2, 3, 4]);
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test-session');
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['Content-Range'], 'bytes 0-3/4');
    assert.equal(options.headers['Content-Length'], '4');
    assert.deepEqual(new Uint8Array(await new Response(options.body).arrayBuffer()), bytes);
    return Response.json({ id: 'file-1234567890' });
  };
  try {
    const response = await onRequest({
      request: new Request(`${origin}/api/ai-chat-upload?action=chunk`, {
        method: 'POST',
        headers: {
          Origin: origin,
          'CF-Connecting-IP': crypto.randomUUID(),
          'Content-Type': 'application/octet-stream',
          'Content-Range': 'bytes 0-3/4',
          'Content-Length': '4',
          'X-Upload-Url': 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test-session',
        },
        body: bytes,
      }),
      env,
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      complete: true,
      file: { id: 'file-1234567890' },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects unsafe chunk destinations and oversized chunks', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Unsafe chunk must not be proxied');
  try {
    for (const [uploadUrl, range] of [
      ['https://example.com/upload?upload_id=test', 'bytes 0-3/4'],
      [
        'https://www.googleapis.com/upload/drive/v3/files?upload_id=test-session',
        `bytes 0-${AI_CHAT_UPLOAD_CHUNK_MAX_BYTES}/${AI_CHAT_UPLOAD_CHUNK_MAX_BYTES + 1}`,
      ],
    ]) {
      const response = await onRequest({
        request: new Request(`${origin}/api/ai-chat-upload?action=chunk`, {
          method: 'POST',
          headers: {
            Origin: origin,
            'CF-Connecting-IP': crypto.randomUUID(),
            'Content-Type': 'application/octet-stream',
            'Content-Range': range,
            'X-Upload-Url': uploadUrl,
          },
          body: new Uint8Array([1]),
        }),
        env,
      });
      assert.equal(response.status, 400);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
