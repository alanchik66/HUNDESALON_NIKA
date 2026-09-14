import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isOneDriveUploadUrl,
  oneDriveContentFileName,
  oneDriveContentIdentity,
  saveOneDriveTranscript,
  signOneDriveUploadUrl,
} from '../_lib/onedrive.js';
import { TELEGRAM_FILE_MAX_BYTES } from '../_lib/platform-integrations.js';
import { AI_CHAT_UPLOAD_CHUNK_MAX_BYTES, AI_CHAT_UPLOAD_MAX_BYTES, onRequest } from './ai-chat-upload.js';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };

const origin = 'https://hundesalon-nika.com';
const env = {
  MS_TENANT_ID: 'consumers', MS_CLIENT_ID: 'client-id', MS_CLIENT_SECRET: 'test-secret',
  MS_REFRESH_TOKEN: 'refresh-token', ONEDRIVE_UPLOAD_FOLDER: 'root-folder',
};
const uploadUrl = 'https://my.microsoftpersonalcontent.com/personal/test/uploadSession';
const sessionId = '12345678-1234-4234-8234-123456789012';
const sessionToken = `${'a'.repeat(64)}-${'b'.repeat(36)}`;
const contentSha256 = 'a'.repeat(64);
const downloadUrl = 'https://public.dm.files.1drv.com/temporary-original-file';

test('accepts Microsoft personal upload hosts without allowing lookalike domains', () => {
  assert.equal(isOneDriveUploadUrl(uploadUrl), true);
  assert.equal(isOneDriveUploadUrl('https://region.microsoftpersonalcontent.com/uploadSession'), true);
  assert.equal(isOneDriveUploadUrl('https://my.microsoftpersonalcontent.com.evil.example/uploadSession'), false);
  assert.equal(isOneDriveUploadUrl('http://my.microsoftpersonalcontent.com/uploadSession'), false);
});

function request(body, ip = crypto.randomUUID()) {
  return new Request(`${origin}/api/ai-chat-upload`, {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify({ sessionToken, clientMessageId: crypto.randomUUID(), ...body }),
  });
}

function graphFetch({ itemParent = 'session-folder', itemName = 'delivery-check.txt', existingItem = null } = {}) {
  return async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.includes(`/items/root-folder:/session-${sessionId}`)) {
      return Response.json({ id: 'session-folder', folder: {} });
    }
    if (target.endsWith('/createUploadSession')) return Response.json({ uploadUrl });
    if (target.includes('/items/session-folder:/') && target.includes('?$select=')) {
      return existingItem ? Response.json(existingItem) : new Response(null, { status: 404 });
    }
    if (target.includes('/items/session-folder/children?')) return Response.json({ value: [] });
    if (target === uploadUrl && options.method === 'PUT') return Response.json({ id: 'completion-receipt' }, { status: 201 });
    if (target.endsWith(':/content') && options.method === 'PUT') return Response.json({ id: 'transcript-item' });
    if (target.includes('/me/drive/items/file-1234567890')) return Response.json({
      id: 'file-1234567890', name: itemName, size: 2048,
      file: { mimeType: 'text/plain' }, webUrl: 'https://1drv.ms/u/test', parentReference: { id: itemParent },
      '@microsoft.graph.downloadUrl': downloadUrl,
    });
    throw new Error(`Unexpected fetch: ${target}`);
  };
}

test('rejects files larger than 150 MiB before contacting OneDrive', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('OneDrive must not be contacted');
  try {
    const response = await onRequest({
      request: request({
        action: 'start', fileName: 'large.bin', size: AI_CHAT_UPLOAD_MAX_BYTES + 1, sessionId, contentSha256,
      }),
      env,
    });
    assert.equal(response.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test('rejects a missing or invalid content hash before contacting OneDrive', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('OneDrive must not be contacted');
  try {
    const response = await onRequest({
      request: request({ action: 'start', fileName: 'sample.bin', size: 4096, sessionId, contentSha256: 'invalid' }),
      env,
    });
    assert.equal(response.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test('starts a signed resumable OneDrive upload session', async () => {
  const originalFetch = globalThis.fetch;
  let uploadProperties;
  const mockGraphFetch = graphFetch();
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/createUploadSession')) uploadProperties = JSON.parse(options.body);
    return mockGraphFetch(url, options);
  };
  try {
    const response = await onRequest({
      request: request({ action: 'start', fileName: 'sample.bin', size: 4096, sessionId, contentSha256 }),
      env,
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.uploadUrl, uploadUrl);
    assert.equal(body.chunkSize, AI_CHAT_UPLOAD_CHUNK_MAX_BYTES);
    assert.match(body.uploadSignature, /^[\w-]{40,}$/);
    assert.equal(uploadProperties.item['@microsoft.graph.conflictBehavior'], 'fail');
    assert.equal(uploadProperties.item.name.endsWith('.bin'), true);
    assert.equal(Object.hasOwn(uploadProperties.item, 'fileSize'), false);
  } finally { globalThis.fetch = originalFetch; }
});

test('deduplicates the same file in one chat session before creating an upload session', async () => {
  const originalFetch = globalThis.fetch;
  let sessionCreated = false;
  const existingItem = {
    id: 'existing-file',
    size: 4096,
    file: { mimeType: 'application/octet-stream' },
    webUrl: 'https://1drv.ms/u/existing',
    parentReference: { id: 'session-folder' },
  };
  const mockGraphFetch = graphFetch({ existingItem });
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith('/createUploadSession')) sessionCreated = true;
    return mockGraphFetch(url, options);
  };
  try {
    const response = await onRequest({
      request: request({ action: 'start', fileName: 'sample.bin', size: 4096, sessionId, contentSha256 }),
      env,
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.deduplicated, true);
    assert.equal(body.storage, 'onedrive');
    assert.equal(sessionCreated, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('verifies the OneDrive session folder before accepting completion', async () => {
  const originalFetch = globalThis.fetch;
  const itemName = await oneDriveContentFileName({
    scope: 'ai-chat', sessionId, contentSha256, fileName: 'delivery-check.txt', mimeType: 'text/plain',
  });
  globalThis.fetch = graphFetch({ itemParent: 'another-folder', itemName });
  try {
    const response = await onRequest({
      request: request({
        action: 'complete', fileId: 'file-1234567890', fileName: 'delivery-check.txt', size: 2048,
        mimeType: 'text/plain', sessionId, contentSha256,
      }),
      env,
    });
    assert.equal(response.status, 400);
  } finally { globalThis.fetch = originalFetch; }
});

test('accepts completion only for the deterministic OneDrive item identity', async () => {
  const originalFetch = globalThis.fetch;
  const itemName = await oneDriveContentFileName({
    scope: 'ai-chat', sessionId, contentSha256, fileName: 'delivery-check.txt', mimeType: 'text/plain',
  });
  globalThis.fetch = graphFetch({ itemName });
  try {
    const response = await onRequest({
      request: request({
        action: 'complete', fileId: 'file-1234567890', fileName: 'delivery-check.txt', size: 2048,
        mimeType: 'text/plain', sessionId, contentSha256,
      }),
      env,
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.storage, 'onedrive');
    assert.equal(body.deduplicated, false);
  } finally { globalThis.fetch = originalFetch; }
});

test('replayed completion creates only one staff notification', async () => {
  const originalFetch = globalThis.fetch;
  const itemName = await oneDriveContentFileName({
    scope: 'ai-chat', sessionId, contentSha256, fileName: 'delivery-check.txt', mimeType: 'text/plain',
  });
  let receiptCommits = 0;
  let telegramCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.includes(`/items/root-folder:/session-${sessionId}`)) {
      return Response.json({ id: 'session-folder', folder: {} });
    }
    if (target.includes('/me/drive/items/file-1234567890')) {
      return Response.json({
        id: 'file-1234567890', name: itemName, size: 2048, file: { mimeType: 'text/plain' },
        webUrl: 'https://1drv.ms/u/test', parentReference: { id: 'session-folder' },
        '@microsoft.graph.downloadUrl': downloadUrl,
      });
    }
    if (target.includes('/items/session-folder/children?')) return Response.json({ value: [] });
    if (target.endsWith('/createUploadSession')) return Response.json({ uploadUrl });
    if (target === uploadUrl && options.method === 'PUT') {
      receiptCommits += 1;
      return receiptCommits === 1
        ? Response.json({ id: 'completion-receipt' }, { status: 201 })
        : Response.json({ error: { code: 'nameAlreadyExists' } }, { status: 409 });
    }
    if (target === downloadUrl) {
      return new Response(new Uint8Array(2048), { headers: { 'Content-Length': '2048', 'Content-Type': 'text/plain' } });
    }
    if (target.includes('api.telegram.org') && target.endsWith('/sendDocument')) {
      telegramCalls += 1;
      assert.match(options.headers['Content-Type'], /^multipart\/form-data; boundary=/);
      return Response.json({ ok: true, result: { message_id: telegramCalls } });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  const completionRequest = () => request({
    action: 'complete', fileId: 'file-1234567890', fileName: 'delivery-check.txt', size: 2048,
    mimeType: 'text/plain', sessionId, contentSha256,
  });
  const completionEnv = {
    ...env,
    SITE_NOTIFICATIONS_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_CHAT_ID: '12345',
  };
  try {
    const [first, second] = await Promise.all([
      onRequest({ request: completionRequest(), env: completionEnv }),
      onRequest({ request: completionRequest(), env: completionEnv }),
    ]);
    const results = await Promise.all([first.json(), second.json()]);
    assert.equal(results.filter(result => result.deduplicated === false).length, 1);
    assert.equal(results.filter(result => result.deduplicated === true).length, 1);
    assert.equal(results.filter(result => result.telegramFileAttached === true).length, 1);
    assert.equal(telegramCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps files above the Telegram limit in OneDrive and sends an explicit link notice', async () => {
  const originalFetch = globalThis.fetch;
  const largeSize = TELEGRAM_FILE_MAX_BYTES + 1;
  const itemName = await oneDriveContentFileName({
    scope: 'ai-chat', sessionId, contentSha256, fileName: 'large-video.mp4', mimeType: 'video/mp4',
  });
  const item = {
    id: 'large-file-1234567890',
    name: itemName,
    size: largeSize,
    file: { mimeType: 'video/mp4' },
    webUrl: 'https://1drv.ms/v/large',
    parentReference: { id: 'session-folder' },
    '@microsoft.graph.downloadUrl': downloadUrl,
  };
  let telegramCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.includes(`/items/root-folder:/session-${sessionId}`)) {
      return Response.json({ id: 'session-folder', folder: {} });
    }
    if (target.includes(`/me/drive/items/${item.id}`)) return Response.json(item);
    if (target.includes('/items/session-folder/children?')) return Response.json({ value: [item] });
    if (target.endsWith('/createUploadSession')) return Response.json({ uploadUrl });
    if (target === uploadUrl && options.method === 'PUT') {
      return Response.json({ id: 'completion-receipt' }, { status: 201 });
    }
    if (target.includes('api.telegram.org') && target.endsWith('/sendMessage')) {
      telegramCalls += 1;
      const payload = JSON.parse(options.body);
      assert.match(payload.text, /больше 50 МБ/);
      assert.match(payload.text, /https:\/\/1drv\.ms\/v\/large/);
      return Response.json({ ok: true, result: { message_id: 10 } });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const response = await onRequest({
      request: request({
        action: 'complete',
        fileId: item.id,
        fileName: 'large-video.mp4',
        size: largeSize,
        mimeType: 'video/mp4',
        sessionId,
        contentSha256,
      }),
      env: {
        ...env,
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'bot-token',
        TELEGRAM_CHAT_ID: '12345',
      },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.telegramDelivery, 'link');
    assert.equal(body.telegramFileAttached, false);
    assert.equal(telegramCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reconciles concurrent copies with different extensions to one physical OneDrive item', async () => {
  const originalFetch = globalThis.fetch;
  const identity = await oneDriveContentIdentity({ scope: 'ai-chat', sessionId, contentSha256 });
  const winner = {
    id: 'file-winner-12345',
    name: `${identity}.txt`,
    size: 2048,
    createdDateTime: '2030-01-01T00:00:00Z',
    file: { mimeType: 'text/plain' },
    webUrl: 'https://1drv.ms/u/winner',
    parentReference: { id: 'session-folder' },
    '@microsoft.graph.downloadUrl': downloadUrl,
  };
  const loser = {
    ...winner,
    id: 'file-loser-123456',
    name: `${identity}.bin`,
    createdDateTime: '2030-01-01T00:00:01Z',
    webUrl: 'https://1drv.ms/u/loser',
  };
  const deleted = [];
  let telegramCalls = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.includes(`/items/root-folder:/session-${sessionId}`)) {
      return Response.json({ id: 'session-folder', folder: {} });
    }
    if (target.includes(`/me/drive/items/${loser.id}`) && options.method !== 'DELETE') return Response.json(loser);
    if (target.includes(`/me/drive/items/${winner.id}`)) return Response.json(winner);
    if (target.includes('/items/session-folder/children?')) return Response.json({ value: [winner, loser] });
    if (target.includes(`/me/drive/items/${loser.id}`) && options.method === 'DELETE') {
      deleted.push(loser.id);
      return new Response(null, { status: 204 });
    }
    if (target.endsWith('/createUploadSession')) return Response.json({ uploadUrl });
    if (target === uploadUrl && options.method === 'PUT') {
      return Response.json({ id: 'completion-receipt' }, { status: 201 });
    }
    if (target === downloadUrl) {
      return new Response(new Uint8Array(2048), { headers: { 'Content-Length': '2048', 'Content-Type': 'text/plain' } });
    }
    if (target.includes('api.telegram.org') && target.endsWith('/sendDocument')) {
      telegramCalls += 1;
      return Response.json({ ok: true, result: { message_id: 1 } });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };
  try {
    const response = await onRequest({
      request: request({
        action: 'complete',
        fileId: loser.id,
        fileName: 'delivery-check.bin',
        size: 2048,
        mimeType: 'application/octet-stream',
        sessionId,
        contentSha256,
      }),
      env: {
        ...env,
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'bot-token',
        TELEGRAM_CHAT_ID: '12345',
      },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.fileId, winner.id);
    assert.equal(body.fileUrl, winner.webUrl);
    assert.equal(body.deduplicated, true);
    assert.deepEqual(deleted, [loser.id]);
    assert.equal(telegramCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('releases a completion claim after a Telegram API rejection so a replay can notify staff', async () => {
  const originalFetch = globalThis.fetch;
  const identity = await oneDriveContentIdentity({ scope: 'ai-chat', sessionId, contentSha256 });
  const itemName = await oneDriveContentFileName({
    scope: 'ai-chat',
    sessionId,
    contentSha256,
    fileName: 'delivery-check.txt',
    mimeType: 'text/plain',
  });
  const item = {
    id: 'file-1234567890',
    name: itemName,
    size: 2048,
    file: { mimeType: 'text/plain' },
    webUrl: 'https://1drv.ms/u/test',
    parentReference: { id: 'session-folder' },
  };
  let receiptExists = false;
  let telegramCalls = 0;
  let receiptDeletes = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.includes(`/items/root-folder:/session-${sessionId}`)) {
      return Response.json({ id: 'session-folder', folder: {} });
    }
    if (target.endsWith('/me/drive/items/file-1234567890/content')) {
      return new Response(null, { status: 302, headers: { Location: downloadUrl } });
    }
    if (target.includes('/me/drive/items/file-1234567890')) return Response.json(item);
    if (target.includes('/items/session-folder/children?')) return Response.json({ value: [item] });
    if (target.endsWith('/createUploadSession')) return Response.json({ uploadUrl });
    if (target.includes(`/items/session-folder:/receipt-${identity}.json`) && options.method !== 'DELETE') {
      return receiptExists
        ? Response.json({ id: 'receipt-item', name: `receipt-${identity}.json` })
        : new Response(null, { status: 404 });
    }
    if (target.includes('/me/drive/items/receipt-item') && options.method === 'DELETE') {
      receiptExists = false;
      receiptDeletes += 1;
      return new Response(null, { status: 204 });
    }
    if (target === uploadUrl && options.method === 'PUT') {
      receiptExists = true;
      return Response.json({ id: 'completion-receipt' }, { status: 201 });
    }
    if (target === downloadUrl) {
      return new Response(new Uint8Array(2048), { headers: { 'Content-Length': '2048', 'Content-Type': 'text/plain' } });
    }
    if (target.includes('api.telegram.org') && target.endsWith('/sendDocument')) {
      telegramCalls += 1;
      if (telegramCalls === 1) return Response.json({ ok: false, description: 'temporary Telegram rejection' });
      return Response.json({ ok: true, result: { message_id: 2 } });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };
  const completionRequest = () =>
    request({
      action: 'complete',
      fileId: item.id,
      fileName: 'delivery-check.txt',
      size: 2048,
      mimeType: 'text/plain',
      sessionId,
      contentSha256,
    });
  const completionEnv = {
    ...env,
    SITE_NOTIFICATIONS_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_CHAT_ID: '12345',
  };
  try {
    const first = await onRequest({ request: completionRequest(), env: completionEnv });
    assert.equal((await first.json()).notified, false);
    assert.equal(receiptExists, false);
    const second = await onRequest({ request: completionRequest(), env: completionEnv });
    assert.equal((await second.json()).notified, true);
    assert.equal(telegramCalls, 2);
    assert.equal(receiptDeletes, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stores the current transcript in the matching OneDrive session folder', async () => {
  const originalFetch = globalThis.fetch;
  let transcript;
  let createPrecondition;
  globalThis.fetch = async (url, options = {}) => {
    const response = await graphFetch()(url, options);
    if (String(url).endsWith(':/content')) {
      transcript = JSON.parse(options.body);
      createPrecondition = options.headers['If-None-Match'];
    }
    return response;
  };
  try {
    const response = await onRequest({ request: request({ action: 'transcript', sessionId, revision: 1, locale: 'ru', messages: [{ role: 'user', content: 'Здравствуйте' }] }), env });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).transcriptId, 'transcript-item');
    assert.equal(transcript.revision, 1);
    assert.equal(transcript.messages[0].content, 'Здравствуйте');
    assert.equal(createPrecondition, '*');
  } finally { globalThis.fetch = originalFetch; }
});

test('keeps the newest transcript revision when an older conditional write finishes later', async () => {
  const originalFetch = globalThis.fetch;
  const transcriptName = `transcript-${sessionId}.json`;
  let stored = { revision: 1, messages: [{ role: 'user', content: 'one' }] };
  let etag = 'etag-1';
  let releaseOlderWrite;
  const olderWriteBlocked = new Promise(resolve => {
    releaseOlderWrite = resolve;
  });
  let olderWriteStarted;
  const olderWriteReady = new Promise(resolve => {
    olderWriteStarted = resolve;
  });

  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes(`/items/session-folder:/${transcriptName}`) && target.includes('?$select=')) {
      return Response.json({ id: 'transcript-item', name: transcriptName, eTag: etag, file: {} });
    }
    if (target.endsWith('/items/transcript-item/content') && options.method !== 'PUT') {
      return Response.json(stored);
    }
    if (target.endsWith('/items/transcript-item/content') && options.method === 'PUT') {
      const incoming = JSON.parse(options.body);
      const suppliedEtag = options.headers['If-Match'];
      if (incoming.revision === 2) {
        olderWriteStarted();
        await olderWriteBlocked;
      }
      if (suppliedEtag !== etag) return Response.json({ error: 'precondition' }, { status: 412 });
      stored = incoming;
      etag = `etag-${incoming.revision}`;
      return Response.json({ id: 'transcript-item', eTag: etag });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const older = saveOneDriveTranscript('token', 'session-folder', sessionId, {
      revision: 2,
      messages: [{ role: 'user', content: 'two' }],
    });
    await olderWriteReady;
    const newer = saveOneDriveTranscript('token', 'session-folder', sessionId, {
      revision: 3,
      messages: [{ role: 'user', content: 'three' }],
    });
    await newer;
    releaseOlderWrite();
    await older;
    assert.equal(stored.revision, 3);
    assert.equal(stored.messages[0].content, 'three');
  } finally {
    releaseOlderWrite();
    globalThis.fetch = originalFetch;
  }
});

test('rejects an invalid transcript session before contacting OneDrive', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('OneDrive must not be contacted');
  try {
    const response = await onRequest({
      request: request({ action: 'transcript', sessionId: '!!!', messages: [{ role: 'user', content: 'test' }] }),
      env,
    });
    assert.equal(response.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
