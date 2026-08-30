import test from 'node:test';
import assert from 'node:assert/strict';
import { File } from 'node:buffer';

import { onRequest } from './upload.js';

globalThis.File ||= File;
globalThis.caches = {
  default: { match: async () => null, put: async () => {} },
};

const origin = 'https://hundesalon-nika.com';

async function handle(request) {
  return onRequest({ request, env: {} });
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

test('accepts a bounded JPEG and keeps booking optional when Drive is not configured', async () => {
  const formData = new FormData();
  formData.append('file', new File([Uint8Array.of(0xff, 0xd8, 0xff, 0xe0)], 'pet.jpg', { type: 'image/jpeg' }));
  formData.append('lang', 'de');

  const response = await handle(
    new Request(`${origin}/upload`, {
      method: 'POST',
      headers: { Origin: origin },
      body: formData,
    })
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.configured, false);
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
