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

test('registration does not disclose an existing CRM phone to an anonymous email match', async () => {
  const restoreCache = installCacheStub();
  const storedPhone = '+49 341 5550100';
  const database = {
    prepare() {
      return {
        bind() { return this; },
        async run() { return { meta: { changes: 1 } }; },
        async first() {
          return { id: crypto.randomUUID(), first_name: 'Stored', last_name: 'Contact', email: 'customer@example.com', phone: storedPhone, locale: 'de' };
        },
      };
    },
  };
  try {
    const response = await onRequest({
      request: createRequest({ action: 'register', firstName: 'New', lastName: 'Visitor', email: 'customer@example.com', phone: '', privacyConsent: true }),
      env: { CHAT_DB: database },
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.customer.phone, '');
    assert.equal(payload.customer.firstName, 'New');
    assert.equal(payload.customer.lastName, 'Visitor');
    assert.equal(JSON.stringify(payload).includes(storedPhone), false);
    assert.match(payload.sessionToken, /^[a-f0-9-]{64,160}$/i);
  } finally {
    restoreCache();
  }
});

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
