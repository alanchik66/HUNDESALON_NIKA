import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  authenticateChatSession,
  findReplyForMessage,
  getChatSessionForTelegramReply,
  getLatestBreedImage,
  listChatReplies,
  recordChatMessage,
  registerChatCustomer,
  registerTelegramDelivery,
  renewChatSession,
} from './chat-crm.js';

const profile = {
  firstName: 'New',
  lastName: 'Visitor',
  email: 'customer@example.com',
  phone: '',
  locale: 'en',
  privacyConsent: true,
};

function customerDatabase() {
  const customer = { id: crypto.randomUUID(), phone: '+49 341 5550100' };
  let session;
  return {
    customer,
    get session() {
      return session;
    },
    prepare(sql) {
      let values;
      return {
        bind(...boundValues) {
          values = boundValues;
          return this;
        },
        async run() {
          if (sql.includes('INSERT INTO chat_customers')) {
            Object.assign(customer, {
              first_name: values[1],
              last_name: values[2],
              email: values[3],
              phone: values[4] || customer.phone,
              locale: values[5],
            });
          }
          if (sql.includes('INSERT INTO chat_sessions')) {
            session = { session_id: values[0], customer_id: values[1], token_hash: values[2], status: 'active' };
          }
          return { meta: { changes: 1 } };
        },
        async first() {
          if (sql.includes('FROM chat_customers')) return customer;
          if (sql.includes('FROM chat_sessions s')) {
            return session?.status === 'active' && values[0] === session.session_id && values[1] === session.token_hash
              ? { ...customer, ...session }
              : null;
          }
          return null;
        },
      };
    },
  };
}

test('anonymous CRM registration returns only the submitted profile, preserving the stored phone privately', async () => {
  const database = customerDatabase();
  const result = await registerChatCustomer({ CHAT_DB: database }, profile);
  assert.equal(result.ok, true);
  assert.equal(result.customer.phone, '');
  assert.equal(result.customer.first_name, profile.firstName);
  assert.equal(result.customer.last_name, profile.lastName);
  assert.equal(database.customer.phone, '+49 341 5550100');
});

test('chat authorization fails closed when the D1 binding is missing', async () => {
  const sessionId = crypto.randomUUID();
  const token = 'a'.repeat(100);
  assert.equal(await authenticateChatSession({}, sessionId, token), null);
  assert.equal(await authenticateChatSession({ CHAT_DB: {} }, sessionId, token), null);
});

test('chat authorization matches the stored token hash and rejects wrong tokens and inactive sessions', async () => {
  const database = customerDatabase();
  const env = { CHAT_DB: database };
  const registered = await registerChatCustomer(env, profile);
  assert.equal(registered.ok, true);
  assert.match(database.session.token_hash, /^[a-f0-9]{64}$/);
  assert.notEqual(database.session.token_hash, registered.token);
  const authenticated = await authenticateChatSession(env, registered.sessionId, registered.token);
  assert.equal(authenticated?.session_id, registered.sessionId);
  assert.equal(await authenticateChatSession(env, registered.sessionId, 'b'.repeat(100)), null);
  database.session.status = 'closed';
  assert.equal(await authenticateChatSession(env, registered.sessionId, registered.token), null);
});

function sqliteDatabase(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const migrationDirectory = new URL('../../migrations/', import.meta.url);
  for (const name of readdirSync(migrationDirectory)
    .filter(name => name.endsWith('.sql'))
    .sort()) {
    sqlite.exec(readFileSync(new URL(name, migrationDirectory), 'utf8'));
  }
  return {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...boundValues) {
          values = boundValues;
          return this;
        },
        async first() {
          return statement.get(...values) || null;
        },
        async all() {
          return { results: statement.all(...values) };
        },
        async run() {
          return { meta: { changes: Number(statement.run(...values).changes) } };
        },
      };
    },
  };
}

test('a new visitor with the same email cannot read prior replies, attachments or message history', async t => {
  const env = { CHAT_DB: sqliteDatabase(t) };
  const original = await registerChatCustomer(env, profile);
  const originalSession = await authenticateChatSession(env, original.sessionId, original.token);
  const sourceMessageId = crypto.randomUUID();
  await recordChatMessage(env, originalSession, { id: sourceMessageId, body: 'Original private question' });
  await recordChatMessage(env, originalSession, {
    direction: 'outbound',
    channel: 'telegram',
    body: 'Original private reply',
    replyToMessageId: sourceMessageId,
  });
  await recordChatMessage(env, originalSession, {
    kind: 'file',
    mimeType: 'image/png',
    oneDriveItemId: 'private-image',
    fileSize: 100,
  });

  const visitor = await registerChatCustomer(env, profile);
  const visitorSession = await authenticateChatSession(env, visitor.sessionId, visitor.token);
  assert.equal(visitorSession.customer_id, originalSession.customer_id);
  assert.notEqual(visitorSession.session_id, originalSession.session_id);
  assert.deepEqual(await listChatReplies(env, visitorSession), []);
  assert.equal(await findReplyForMessage(env, visitorSession.session_id, sourceMessageId), null);
  assert.equal(await getLatestBreedImage(env, visitorSession), null);
});

test('staff replies to a closed session cannot switch to a new anonymous session sharing its email', async t => {
  const env = { CHAT_DB: sqliteDatabase(t) };
  const original = await registerChatCustomer(env, profile);
  const originalSession = await authenticateChatSession(env, original.sessionId, original.token);
  await registerTelegramDelivery(env, originalSession, {
    body: { result: { message_id: 71, chat: { id: -100123 } } },
  });
  await env.CHAT_DB.prepare("UPDATE chat_sessions SET status = 'closed' WHERE id = ?").bind(original.sessionId).run();
  const visitor = await registerChatCustomer(env, profile);
  assert.ok(await authenticateChatSession(env, visitor.sessionId, visitor.token));
  assert.equal(await getChatSessionForTelegramReply(env, '-100123', 71), null);
});

test('authenticated renewal transfers staff reply routing only to the renewed session', async t => {
  const env = { CHAT_DB: sqliteDatabase(t) };
  const original = await registerChatCustomer(env, profile);
  const originalSession = await authenticateChatSession(env, original.sessionId, original.token);
  await registerTelegramDelivery(env, originalSession, {
    body: { result: { message_id: 71, chat: { id: -100123 } } },
  });
  assert.equal(await renewChatSession(env, original.sessionId, 'b'.repeat(100)), null);
  assert.equal((await getChatSessionForTelegramReply(env, '-100123', 71)).session_id, original.sessionId);
  const renewed = await renewChatSession(env, original.sessionId, original.token);
  const visitor = await registerChatCustomer(env, profile);
  const visitorSession = await authenticateChatSession(env, visitor.sessionId, visitor.token);
  const staffRecipient = await getChatSessionForTelegramReply(env, '-100123', 71);
  assert.equal(staffRecipient.session_id, renewed.sessionId);
  assert.equal(await authenticateChatSession(env, original.sessionId, original.token), null);
  await recordChatMessage(env, staffRecipient, {
    direction: 'outbound',
    channel: 'telegram',
    body: 'Reply to the verified continuation',
  });
  assert.deepEqual(await listChatReplies(env, visitorSession), []);
  const renewedSession = await authenticateChatSession(env, renewed.sessionId, renewed.token);
  assert.equal((await listChatReplies(env, renewedSession))[0].body, 'Reply to the verified continuation');
});
