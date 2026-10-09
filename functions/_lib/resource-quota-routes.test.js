import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as chat } from '../api/ai-chat.js';
import { onRequest as seo } from '../seo-generate.js';
import { handleMessageDraft as draft } from './draft-service.js';
import { onRequestGet as gifs } from '../api/ai-chat-gifs.js';
import { onRequest as upload, onRequestChunk as uploadChunk } from '../api/ai-chat-upload.js';
import { onRequest as bookingUpload } from '../upload.js';
import { createOneDriveUploadTicket, signOneDriveUploadUrl } from './onedrive.js';
import { withResourceQuotaDatabase } from '../../tools/lib/resource-quota-test-db.mjs';

globalThis.caches = { default: { match: async () => null, put: async () => {} } };
const origin = 'https://hundesalon-nika.com';
const sessionId = '12345678-1234-4234-8234-123456789012';
const sessionToken = 'a'.repeat(64) + '-' + 'b'.repeat(36);
const uploadUrl = 'https://my.microsoftpersonalcontent.com/personal/test/uploadSession';

function sessionDatabase(migrated = true) {
  return withResourceQuotaDatabase(
    {
      prepare(sql) {
        return {
          bind() {
            return this;
          },
          async first() {
            return sql.includes('FROM chat_sessions s')
              ? {
                  session_id: sessionId,
                  customer_id: '00000000-0000-4000-8000-000000000001',
                  status: 'active',
                  conversation_mode: 'ai',
                  locale: 'de',
                }
              : null;
          },
          async run() {
            return { meta: { changes: 1 } };
          },
          async all() {
            return { results: [] };
          },
        };
      },
    },
    { migrated }
  );
}

function environment(settings = {}, migrated = true) {
  return {
    CHAT_DB: sessionDatabase(migrated),
    AI_SERVICE_WEBHOOK_SECRET: 'test-auth',
    OPENAI_API_KEY: 'test-provider-key',
    GIPHY_API_KEY: 'test-giphy-key',
    MS_TENANT_ID: 'consumers',
    MS_CLIENT_ID: 'client-id',
    MS_CLIENT_SECRET: 'test-secret',
    MS_REFRESH_TOKEN: 'refresh-token',
    ONEDRIVE_UPLOAD_FOLDER: 'root-folder',
    ...settings,
  };
}
function post(path, payload) {
  return new Request(origin + path, {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '198.51.100.1',
      Authorization: 'Bearer test-auth',
    },
    body: JSON.stringify(payload),
  });
}
function chatRequest(mode = 'ai') {
  return post('/api/ai-chat', {
    locale: 'de',
    message: 'Hallo',
    history: [],
    pagePath: '/de/index.html',
    sessionId,
    sessionToken,
    clientMessageId: crypto.randomUUID(),
    mode,
  });
}

test('AI chat limit returns localized staff handoff before a second provider call', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  let calls = 0;
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://api.openai.com/v1/responses');
    calls += 1;
    return Response.json({ output_text: 'Hallo!' });
  };
  const env = environment({ RESOURCE_QUOTA_AI_ACCOUNT: '1' });
  assert.equal((await chat({ request: chatRequest(), env })).status, 200);
  const response = await chat({ request: chatRequest(), env });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.handoff, true);
  assert.equal(body.available, false);
  assert.equal(body.reason, 'RESOURCE_DAILY_LIMIT');
  assert.ok(body.answer.length > 10);
  assert.equal(calls, 1);
});

test('chat old schema denies AI while human mode continues working', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => assert.fail('Provider must not be called without quota schema');
  const env = environment({}, false);
  const body = await (await chat({ request: chatRequest(), env })).json();
  assert.equal(body.reason, 'RESOURCE_TEMPORARILY_UNAVAILABLE');
  assert.equal(body.handoff, true);
  const human = await chat({ request: chatRequest('human'), env });
  assert.equal(human.status, 200);
  assert.equal((await human.json()).waitingForStaff, true);
});

test('authenticated draft and SEO use the same account AI budget', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ choices: [{ message: { content: 'Hello' } }] });
  };
  const env = environment({ RESOURCE_QUOTA_AI_ACCOUNT: '1' });
  assert.equal(
    (await draft({ request: post('/message-draft', { messages: [{ role: 'user', content: 'Hello' }] }), env })).status,
    200
  );
  const blocked = await seo({ request: post('/seo-generate', { topic: 'Dog care' }), env });
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json()).error, 'RESOURCE_DAILY_LIMIT');
  assert.equal(calls, 1);
});

test('public fixed-template draft still works with the old schema', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => assert.fail('Public draft must not use paid AI');
  const response = await draft({
    request: post('/message-draft', {
      draft: { language: 'de', formType: 'booking', name: 'Test', service: 'Komplettpflege' },
    }),
    env: environment({}, false),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reason, 'PUBLIC_FIXED_TEMPLATE');
});

test('GIF daily cap and missing migration both block the upstream provider', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ data: [] });
  };
  const request = () =>
    new Request(origin + '/api/ai-chat-gifs?locale=ru', { headers: { 'CF-Connecting-IP': '198.51.100.1' } });
  const env = environment({ RESOURCE_QUOTA_GIFS_ACCOUNT: '1' });
  assert.equal((await gifs({ request: request(), env })).status, 200);
  assert.equal((await gifs({ request: request(), env })).status, 429);
  assert.equal((await gifs({ request: request(), env: environment({}, false) })).status, 503);
  assert.equal(calls, 1);
});

test('upload admission missing schema fails before OneDrive token or folder work', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => assert.fail('OneDrive must not be called');
  const env = environment({}, false);
  const payload = {
    action: 'start',
    sessionId,
    sessionToken,
    clientMessageId: crypto.randomUUID(),
    fileName: 'test.txt',
    mimeType: 'text/plain',
    size: 4,
    contentSha256: 'a'.repeat(64),
  };
  assert.equal((await upload({ request: post('/api/ai-chat-upload', payload), env })).status, 503);
  const form = new FormData();
  form.set('file', new File([Uint8Array.of(255, 216, 255, 224)], 'test.jpg', { type: 'image/jpeg' }));
  form.set('upload_session_id', 'booking-session-1234567890');
  assert.equal(
    (
      await bookingUpload({
        request: new Request(origin + '/upload', { method: 'POST', headers: { Origin: origin }, body: form }),
        env,
      })
    ).status,
    503
  );
});

test('chunk replay uses byte quota and does not forward falsified large bodies', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  let calls = 0;
  globalThis.fetch = async url => {
    assert.equal(String(url), uploadUrl);
    calls += 1;
    return Response.json({ id: 'item' }, { status: 201 });
  };
  const env = environment({ RESOURCE_QUOTA_UPLOAD_TRANSFER_ACCOUNT_BYTES: '12' });
  const uploadTicket = await createOneDriveUploadTicket(env, { uploadUrl, size: 4, sessionId });
  const signature = await signOneDriveUploadUrl(env, uploadTicket);
  const chunkRequest = body =>
    new Request(origin + '/api/ai-chat-upload-chunk', {
      method: 'POST',
      headers: {
        Origin: origin,
        'CF-Connecting-IP': '198.51.100.1',
        'Content-Range': 'bytes 0-3/4',
        'Content-Length': '4',
        'X-Upload-Url': uploadTicket,
        'X-Upload-Signature': signature,
      },
      body,
    });
  assert.equal((await uploadChunk({ request: chunkRequest(new Uint8Array(100)), env })).status, 400);
  assert.equal((await uploadChunk({ request: chunkRequest(new Uint8Array(4)), env })).status, 200);
  assert.equal((await uploadChunk({ request: chunkRequest(new Uint8Array(4)), env })).status, 200);
  assert.equal((await uploadChunk({ request: chunkRequest(new Uint8Array(4)), env })).status, 429);
  assert.equal(calls, 2);
});

test('chunk bounds also apply without Content-Length and on failed streams or providers', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  const env = environment();
  const uploadTicket = await createOneDriveUploadTicket(env, { uploadUrl, size: 4, sessionId });
  const signature = await signOneDriveUploadUrl(env, uploadTicket);
  const headers = {
    Origin: origin,
    'CF-Connecting-IP': '198.51.100.1',
    'Content-Range': 'bytes 0-3/4',
    'X-Upload-Url': uploadTicket,
    'X-Upload-Signature': signature,
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return Response.json({ id: 'item' }, { status: 201 });
  };
  const valid = await uploadChunk({
    request: new Request(origin + '/api/ai-chat-upload-chunk', { method: 'POST', headers, body: new Uint8Array(4) }),
    env,
  });
  assert.equal(valid.status, 200);
  const failedStream = new ReadableStream({
    start(controller) {
      controller.error(new Error('private-stream-error'));
    },
  });
  const invalid = await uploadChunk({
    request: new Request(origin + '/api/ai-chat-upload-chunk', {
      method: 'POST',
      headers,
      body: failedStream,
      duplex: 'half',
    }),
    env,
  });
  assert.equal(invalid.status, 400);
  assert.equal(calls, 1);
  globalThis.fetch = async () => {
    throw new Error('private-provider-error');
  };
  const failure = await uploadChunk({
    request: new Request(origin + '/api/ai-chat-upload-chunk', { method: 'POST', headers, body: new Uint8Array(4) }),
    env,
  });
  assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /private-provider-error/);
});

test('chunk total must match admission and raw storage URLs cannot bypass the proxy', async t => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async () => assert.fail('Rejected ticket must not forward data');
  const env = environment();
  const uploadTicket = await createOneDriveUploadTicket(env, { uploadUrl, size: 4, sessionId });
  const signed = await signOneDriveUploadUrl(env, uploadTicket);
  for (const [value, signature, range] of [
    [uploadTicket, signed, 'bytes 0-7/8'],
    [uploadUrl, await signOneDriveUploadUrl(env, uploadUrl), 'bytes 0-3/4'],
  ]) {
    const response = await uploadChunk({
      request: new Request(origin + '/api/ai-chat-upload-chunk', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Range': range, 'X-Upload-Url': value, 'X-Upload-Signature': signature },
        body: new Uint8Array(4),
      }),
      env,
    });
    assert.equal(response.status, 400);
  }
});
