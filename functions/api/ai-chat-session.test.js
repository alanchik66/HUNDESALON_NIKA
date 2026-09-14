import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './ai-chat-session.js';

const SESSION_ID = '12345678-1234-4234-8234-123456789012';
const SESSION_TOKEN = `${'a'.repeat(64)}-${'b'.repeat(36)}`;

function installCacheStub() {
  const original = globalThis.caches;
  globalThis.caches = { default: { async match() { return null; }, async put() {} } };
  return () => {
    if (original === undefined) delete globalThis.caches;
    else globalThis.caches = original;
  };
}

function createRequest(body) {
  return new Request('https://hundesalon-nika.com/api/ai-chat-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://hundesalon-nika.com' },
    body: JSON.stringify(body),
  });
}

function chatDatabase(initialMode = 'human') {
  let mode = initialMode;
  const updates = [];
  return {
    updates,
    prepare(sql) {
      let values = [];
      return {
        bind(...boundValues) {
          values = boundValues;
          return this;
        },
        async first() {
          if (!sql.includes('FROM chat_sessions s')) return null;
          return {
            session_id: SESSION_ID,
            customer_id: '00000000-0000-4000-8000-000000000001',
            locale: 'de',
            status: 'active',
            conversation_mode: mode,
            first_name: 'Test',
            last_name: 'Customer',
            email: 'test@example.com',
            phone: '',
          };
        },
        async run() {
          if (sql.includes('UPDATE chat_sessions SET conversation_mode')) {
            mode = values[0];
            updates.push(mode);
          }
          return { meta: { changes: 1 } };
        },
      };
    },
  };
}

test('a registered client can switch a personal consultation back to AI mode', async () => {
  const restoreCache = installCacheStub();
  const database = chatDatabase('human');
  try {
    const response = await onRequest({
      request: createRequest({
        action: 'set-mode',
        mode: 'ai',
        sessionId: SESSION_ID,
        sessionToken: SESSION_TOKEN,
      }),
      env: { CHAT_DB: database },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { success: true, mode: 'ai' });
    assert.deepEqual(database.updates, ['ai']);
  } finally {
    restoreCache();
  }
});

test('conversation mode update rejects unsupported values', async () => {
  const restoreCache = installCacheStub();
  const database = chatDatabase('human');
  try {
    const response = await onRequest({
      request: createRequest({
        action: 'set-mode',
        mode: 'staff',
        sessionId: SESSION_ID,
        sessionToken: SESSION_TOKEN,
      }),
      env: { CHAT_DB: database },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(database.updates, []);
  } finally {
    restoreCache();
  }
});
