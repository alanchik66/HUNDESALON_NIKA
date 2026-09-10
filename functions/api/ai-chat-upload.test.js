import test from 'node:test';
import assert from 'node:assert/strict';

import { isOneDriveUploadUrl, signOneDriveUploadUrl } from '../_lib/onedrive.js';
import { AI_CHAT_UPLOAD_CHUNK_MAX_BYTES, AI_CHAT_UPLOAD_MAX_BYTES, onRequest } from './ai-chat-upload.js';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };

const origin = 'https://hundesalon-nika.com';
const env = {
  MS_TENANT_ID: 'consumers', MS_CLIENT_ID: 'client-id', MS_CLIENT_SECRET: 'test-secret',
  MS_REFRESH_TOKEN: 'refresh-token', ONEDRIVE_UPLOAD_FOLDER: 'root-folder',
};
const uploadUrl = 'https://my.microsoftpersonalcontent.com/personal/test/uploadSession';

test('accepts Microsoft personal upload hosts without allowing lookalike domains', () => {
  assert.equal(isOneDriveUploadUrl(uploadUrl), true);
  assert.equal(isOneDriveUploadUrl('https://region.microsoftpersonalcontent.com/uploadSession'), true);
  assert.equal(isOneDriveUploadUrl('https://my.microsoftpersonalcontent.com.evil.example/uploadSession'), false);
  assert.equal(isOneDriveUploadUrl('http://my.microsoftpersonalcontent.com/uploadSession'), false);
});

function request(body, ip = crypto.randomUUID()) {
  return new Request(`${origin}/api/ai-chat-upload`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
}

function graphFetch({ itemParent = 'session-folder' } = {}) {
  return async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.endsWith('/createUploadSession')) return Response.json({ uploadUrl });
    if (target.endsWith(':/content') && options.method === 'PUT') return Response.json({ id: 'transcript-item' });
    if (target.includes('session-')) return Response.json({ id: 'session-folder', folder: {} });
    if (target.includes('/me/drive/items/file-1234567890')) return Response.json({
      id: 'file-1234567890', name: 'delivery-check.txt', size: 2048,
      file: { mimeType: 'text/plain' }, webUrl: 'https://1drv.ms/u/test', parentReference: { id: itemParent },
    });
    throw new Error(`Unexpected fetch: ${target}`);
  };
}

test('rejects files larger than 150 MiB before contacting OneDrive', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('OneDrive must not be contacted');
  try {
    const response = await onRequest({ request: request({ action: 'start', fileName: 'large.bin', size: AI_CHAT_UPLOAD_MAX_BYTES + 1 }), env });
    assert.equal(response.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test('starts a signed resumable OneDrive upload session', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = graphFetch();
  try {
    const response = await onRequest({ request: request({ action: 'start', fileName: 'sample.bin', size: 4096, sessionId: 'abc' }), env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.uploadUrl, uploadUrl);
    assert.equal(body.chunkSize, AI_CHAT_UPLOAD_CHUNK_MAX_BYTES);
    assert.match(body.uploadSignature, /^[\w-]{40,}$/);
  } finally { globalThis.fetch = originalFetch; }
});

test('verifies the OneDrive session folder before accepting completion', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = graphFetch({ itemParent: 'another-folder' });
  try {
    const response = await onRequest({ request: request({ action: 'complete', fileId: 'file-1234567890', sessionId: 'abc' }), env });
    assert.equal(response.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test('stores the current transcript in the matching OneDrive session folder', async () => {
  const originalFetch = globalThis.fetch;
  let transcript;
  globalThis.fetch = async (url, options = {}) => {
    const response = await graphFetch()(url, options);
    if (String(url).endsWith(':/content')) transcript = JSON.parse(options.body);
    return response;
  };
  try {
    const response = await onRequest({ request: request({ action: 'transcript', sessionId: 'abc', locale: 'ru', messages: [{ role: 'user', content: 'Здравствуйте' }] }), env });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).transcriptId, 'transcript-item');
    assert.equal(transcript.messages[0].content, 'Здравствуйте');
  } finally { globalThis.fetch = originalFetch; }
});

test('proxies only a signed OneDrive upload chunk', async () => {
  const originalFetch = globalThis.fetch;
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const signature = await signOneDriveUploadUrl(env, uploadUrl);
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), uploadUrl);
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers['Content-Range'], 'bytes 0-3/4');
    return Response.json({ id: 'file-1234567890' }, { status: 201 });
  };
  try {
    const response = await onRequest({ request: new Request(`${origin}/api/ai-chat-upload?action=chunk`, {
      method: 'POST', headers: {
        Origin: origin, 'CF-Connecting-IP': crypto.randomUUID(), 'Content-Type': 'application/octet-stream',
        'Content-Range': 'bytes 0-3/4', 'Content-Length': '4', 'X-Upload-Url': uploadUrl,
        'X-Upload-Signature': signature,
      }, body: bytes,
    }), env });
    assert.deepEqual(await response.json(), { success: true, complete: true, file: { id: 'file-1234567890' } });
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects unsigned destinations and oversized chunks', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Invalid chunk must not be proxied');
  try {
    for (const [target, signature, range] of [
      ['https://example.com/upload', 'bad', 'bytes 0-3/4'],
      [uploadUrl, 'bad', `bytes 0-${AI_CHAT_UPLOAD_CHUNK_MAX_BYTES}/${AI_CHAT_UPLOAD_CHUNK_MAX_BYTES + 1}`],
    ]) {
      const response = await onRequest({ request: new Request(`${origin}/api/ai-chat-upload?action=chunk`, {
        method: 'POST', headers: { Origin: origin, 'CF-Connecting-IP': crypto.randomUUID(), 'Content-Type': 'application/octet-stream', 'Content-Range': range, 'X-Upload-Url': target, 'X-Upload-Signature': signature },
        body: new Uint8Array([1]),
      }), env });
      assert.equal(response.status, 400);
    }
  } finally { globalThis.fetch = originalFetch; }
});
