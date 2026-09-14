import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { createHash } from 'node:crypto';

import { onRequest } from './upload.js';
import { oneDriveContentIdentity } from './_lib/onedrive.js';

globalThis.File ||= File;
globalThis.caches = {
  default: { match: async () => null, put: async () => {} },
};

const origin = 'https://hundesalon-nika.com';
const uploadSessionId = 'booking-session-1234567890';
const oneDriveEnv = {
  MS_TENANT_ID: 'consumers',
  MS_CLIENT_ID: 'client-id',
  MS_REFRESH_TOKEN: 'refresh-token',
  ONEDRIVE_UPLOAD_FOLDER: 'root-folder',
};

async function handle(request, env = {}) {
  return onRequest({ request, env });
}

test('rejects the legacy direct-upload session contract', async () => {
  const response = await handle(
    new Request(`${origin}/upload`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: 'session', mimeType: 'image/jpeg', size: 100 }),
    })
  );

  assert.equal(response.status, 415);
});

test('rejects an oversized multipart request before parsing its body', async () => {
  const response = await handle(
    new Request(`${origin}/upload`, {
      method: 'POST',
      headers: {
        Origin: origin,
        'Content-Type': 'multipart/form-data; boundary=test',
        'Content-Length': String(17 * 1024 * 1024),
      },
      body: '--test--',
    })
  );

  assert.equal(response.status, 413);
});

test('rejects a booking photo when secure OneDrive storage is not configured', async () => {
  const formData = new FormData();
  formData.append('file', new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)], 'pet.jpg', { type: 'image/jpeg' }));
  formData.append('lang', 'de');
  formData.append('upload_session_id', uploadSessionId);

  const response = await handle(
    new Request(`${origin}/upload`, {
      method: 'POST',
      headers: { Origin: origin },
      body: formData,
    })
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.deepEqual(body, { error: 'Internal server error' });
});

test('stores a booking photo only in OneDrive', async () => {
  const originalFetch = globalThis.fetch;
  const destinations = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    destinations.push(target);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.includes('/items/root-folder:/session-booking-')) {
      return Response.json({ id: 'booking-folder', folder: {} });
    }
    if (target.includes('/items/booking-folder:/') && target.includes('?$select=')) {
      return new Response(null, { status: 404 });
    }
    if (target.includes('/items/booking-folder/children?')) return Response.json({ value: [] });
    if (target.endsWith(':/content') && options.method === 'PUT') {
      return Response.json({
        id: 'photo-item',
        size: 4,
        file: { mimeType: 'image/jpeg' },
        webUrl: 'https://1drv.ms/i/test-photo',
      });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const formData = new FormData();
    formData.append('file', new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)], 'pet.jpg', { type: 'image/jpeg' }));
    formData.append('lang', 'de');
    formData.append('service', 'Grooming');
    formData.append('upload_session_id', uploadSessionId);
    const response = await handle(
      new Request(`${origin}/upload`, { method: 'POST', headers: { Origin: origin }, body: formData }),
      oneDriveEnv
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.storage, 'onedrive');
    assert.equal(body.deduplicated, false);
    assert.equal(body.fileId, 'photo-item');
    assert.equal(body.fileUrl, 'https://1drv.ms/i/test-photo');
    assert.match(body.fileProof, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(destinations.some(target => /googleapis\.com.*(?:drive|upload)/i.test(target)), false);
    assert.equal(destinations.some(target => target.includes('graph.microsoft.com')), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reuses an identical booking photo in the same session without a second upload', async () => {
  const originalFetch = globalThis.fetch;
  let uploadRequests = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.includes('/items/root-folder:/session-booking-')) {
      return Response.json({ id: 'booking-folder', folder: {} });
    }
    if (target.includes('/items/booking-folder:/') && target.includes('?$select=')) {
      return Response.json({
        id: 'existing-photo',
        size: 4,
        file: { mimeType: 'image/jpeg' },
        webUrl: 'https://1drv.ms/i/existing-photo',
      });
    }
    if (target.endsWith(':/content') && options.method === 'PUT') uploadRequests += 1;
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const formData = new FormData();
    formData.append('file', new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)], 'pet.jpg', { type: 'image/jpeg' }));
    formData.append('upload_session_id', uploadSessionId);
    const response = await handle(
      new Request(`${origin}/upload`, { method: 'POST', headers: { Origin: origin }, body: formData }),
      oneDriveEnv
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.deduplicated, true);
    assert.equal(body.fileId, 'existing-photo');
    assert.equal(body.fileUrl, 'https://1drv.ms/i/existing-photo');
    assert.match(body.fileProof, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(uploadRequests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deduplicates identical booking bytes even when an existing item has another extension', async () => {
  const originalFetch = globalThis.fetch;
  const bytes = Uint8Array.of(0xff, 0xd8, 0xff, 0xe0);
  const contentSha256 = createHash('sha256').update(bytes).digest('hex');
  const identity = await oneDriveContentIdentity({ scope: 'booking', sessionId: uploadSessionId, contentSha256 });
  let uploadRequests = 0;
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/oauth2/v2.0/token')) return Response.json({ access_token: 'access-token' });
    if (target.includes('/items/root-folder:/session-booking-')) {
      return Response.json({ id: 'booking-folder', folder: {} });
    }
    if (target.includes('/items/booking-folder:/') && target.includes('?$select=')) {
      return new Response(null, { status: 404 });
    }
    if (target.includes('/items/booking-folder/children?')) {
      return Response.json({
        value: [
          {
            id: 'existing-photo-other-extension',
            name: `${identity}.png`,
            size: bytes.byteLength,
            file: { mimeType: 'image/png' },
            webUrl: 'https://1drv.ms/i/existing-photo-other-extension',
          },
        ],
      });
    }
    if (target.endsWith(':/content') && options.method === 'PUT') uploadRequests += 1;
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const formData = new FormData();
    formData.append('file', new File([bytes], 'pet.jpg', { type: 'image/jpeg' }));
    formData.append('upload_session_id', uploadSessionId);
    const response = await handle(
      new Request(`${origin}/upload`, { method: 'POST', headers: { Origin: origin }, body: formData }),
      oneDriveEnv
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.deduplicated, true);
    assert.equal(body.fileId, 'existing-photo-other-extension');
    assert.equal(body.fileUrl, 'https://1drv.ms/i/existing-photo-other-extension');
    assert.equal(uploadRequests, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects an image MIME type with an invalid file signature', async () => {
  const formData = new FormData();
  formData.append('file', new File(['not-an-image'], 'pet.jpg', { type: 'image/jpeg' }));

  const response = await handle(
    new Request(`${origin}/upload`, {
      method: 'POST',
      headers: { Origin: origin },
      body: formData,
    })
  );

  assert.equal(response.status, 400);
});
