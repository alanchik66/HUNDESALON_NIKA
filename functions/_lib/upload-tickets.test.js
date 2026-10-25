import test from 'node:test';
import assert from 'node:assert/strict';
import { createOneDriveUploadTicket, readOneDriveUploadTicket, signOneDriveUploadUrl } from './onedrive.js';

const env = {
  MS_TENANT_ID: 'consumers',
  MS_CLIENT_ID: 'client-id',
  MS_CLIENT_SECRET: 'test-secret',
  MS_REFRESH_TOKEN: 'refresh-token',
  ONEDRIVE_UPLOAD_FOLDER: 'root-folder',
};
const uploadUrl = 'https://my.microsoftpersonalcontent.com/personal/test/uploadSession?secret=private-bearer';
const sessionId = '12345678-1234-4234-8234-123456789012';
const now = Date.parse('2026-10-09T12:00:00Z');

test('opaque authenticated tickets hide the storage bearer and bind size/session/expiry', async () => {
  const ticket = await createOneDriveUploadTicket(env, { uploadUrl, size: 4, sessionId, now });
  assert.match(ticket, /^nika-upload-v1\.[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(ticket, /private-bearer|microsoftpersonalcontent|12345678/);
  const signature = await signOneDriveUploadUrl(env, ticket);
  const opened = await readOneDriveUploadTicket(env, ticket, signature, now + 1000);
  assert.deepEqual(opened, { uploadUrl, size: 4, sessionId, expiresAt: now + 3_600_000 });
  assert.equal(await readOneDriveUploadTicket(env, ticket, signature, now + 3_600_000), null);
  const other = await createOneDriveUploadTicket(env, { uploadUrl, size: 4, sessionId, now });
  assert.notEqual(ticket, other);
});

test('modified ciphertext, wrong key and raw OneDrive bearer URLs cannot authorize chunks', async () => {
  const ticket = await createOneDriveUploadTicket(env, { uploadUrl, size: 4, sessionId, now });
  const signature = await signOneDriveUploadUrl(env, ticket);
  assert.equal(
    await readOneDriveUploadTicket({ ...env, MS_CLIENT_SECRET: 'different-secret' }, ticket, signature, now),
    null
  );
  const changed = ticket.slice(0, -5) + (ticket.at(-5) === 'A' ? 'B' : 'A') + ticket.slice(-4);
  // Even a valid HMAC of modified bytes cannot overcome AES-GCM authentication.
  assert.equal(await readOneDriveUploadTicket(env, changed, await signOneDriveUploadUrl(env, changed), now), null);
  assert.equal(await readOneDriveUploadTicket(env, uploadUrl, await signOneDriveUploadUrl(env, uploadUrl), now), null);
  assert.equal(await readOneDriveUploadTicket(env, ticket, 'wrong-signature', now), null);
});

test('tickets reject unapproved hosts, excess size and invalid sessions before issuance', async () => {
  for (const patch of [
    { uploadUrl: 'https://example.com/upload' },
    { size: 150 * 1024 * 1024 + 1 },
    { size: 0 },
    { sessionId: '../invalid' },
  ]) {
    assert.equal(await createOneDriveUploadTicket(env, { uploadUrl, size: 4, sessionId, now, ...patch }), '');
  }
  assert.equal(await createOneDriveUploadTicket({}, { uploadUrl, size: 4, sessionId, now }), '');
});
