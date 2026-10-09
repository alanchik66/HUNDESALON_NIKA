import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  authenticateChatSession,
  findReplyForMessage,
  getChatSessionForTelegramReply,
  getChatSessionForTelegramTopic,
  getLatestBreedImage,
  listChatLearningExamples,
  listChatReplies,
  recordChatLearningExample,
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
  const customer = { id: crypto.randomUUID(), email: profile.email, phone: '+49 341 5550100' };
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
          if (sql.includes('INSERT INTO chat_sessions')) {
            session = {
              session_id: values[0],
              customer_id: values[1],
              token_hash: values[2],
              locale: values[3],
              status: 'active',
              first_name: values[7],
              last_name: values[8],
              email: values[9],
              phone: values[10],
              privacy_consent_at: values[11],
            };
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

function sqliteDatabase(t, { through = '' } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  const migrationDirectory = new URL('../../migrations/', import.meta.url);
  for (const name of readdirSync(migrationDirectory)
    .filter(name => name.endsWith('.sql') && (!through || name <= through))
    .sort()) {
    sqlite.exec(readFileSync(new URL(name, migrationDirectory), 'utf8'));
  }
  return {
    applyMigration(name) {
      sqlite.exec(readFileSync(new URL(name, migrationDirectory), 'utf8'));
    },
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

test('anonymous email matches preserve the shared CRM identity and use their own session profile', async t => {
  const database = sqliteDatabase(t);
  const env = { CHAT_DB: database };
  const originalProfile = {
    ...profile,
    firstName: 'Original',
    lastName: 'Contact',
    phone: '+49 341 5550100',
    locale: 'de',
  };
  const original = await registerChatCustomer(env, originalProfile);
  const before = await database.prepare('SELECT * FROM chat_customers WHERE id = ?').bind(original.customer.id).first();
  const submitted = { ...profile, firstName: 'Guest', lastName: 'Visitor', phone: '+49 341 5550200', locale: 'uk' };
  const visitor = await registerChatCustomer(env, submitted);
  assert.deepEqual(
    await database.prepare('SELECT * FROM chat_customers WHERE id = ?').bind(original.customer.id).first(),
    before
  );
  const originalSession = await authenticateChatSession(env, original.sessionId, original.token);
  assert.equal(originalSession.first_name, 'Original');
  assert.equal(originalSession.phone, originalProfile.phone);
  assert.equal(originalSession.locale, 'de');
  const guestSession = await authenticateChatSession(env, visitor.sessionId, visitor.token);
  assert.equal(guestSession.first_name, submitted.firstName);
  assert.equal(guestSession.last_name, submitted.lastName);
  assert.equal(guestSession.phone, submitted.phone);
  assert.equal(guestSession.locale, 'uk');
  assert.equal(guestSession.email, profile.email);
  await registerTelegramDelivery(env, guestSession, {
    body: { result: { message_id: 72, message_thread_id: 19, chat: { id: -100123 } } },
  });
  for (const routed of [
    await getChatSessionForTelegramReply(env, '-100123', 72),
    await getChatSessionForTelegramTopic(env, '-100123', 19),
  ]) {
    assert.equal(routed.session_id, visitor.sessionId);
    assert.equal(routed.first_name, submitted.firstName);
    assert.equal(routed.phone, submitted.phone);
    assert.equal(routed.locale, 'uk');
  }
  const blankPhoneVisitor = await registerChatCustomer(env, profile);
  const blankSession = await authenticateChatSession(env, blankPhoneVisitor.sessionId, blankPhoneVisitor.token);
  assert.equal(blankSession.phone, '');
  const renewed = await renewChatSession(env, blankPhoneVisitor.sessionId, blankPhoneVisitor.token);
  const renewedSession = await authenticateChatSession(env, renewed.sessionId, renewed.token);
  assert.equal(renewedSession.phone, '');
  assert.equal(renewedSession.first_name, profile.firstName);
  assert.equal(renewedSession.privacy_consent_at, blankSession.privacy_consent_at);
  assert.deepEqual(
    await database.prepare('SELECT * FROM chat_customers WHERE id = ?').bind(original.customer.id).first(),
    before
  );
});

test('the profile migration preserves legacy session authentication and existing CRM data', async t => {
  const database = sqliteDatabase(t, { through: '0006_chat_learning_review.sql' });
  const customerId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const token = 'a'.repeat(100);
  const tokenBytes = new TextEncoder().encode(token);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', tokenBytes)), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  await database
    .prepare('INSERT INTO chat_customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(
      customerId,
      'Legacy',
      'Contact',
      profile.email,
      '+49 341 5550100',
      'de',
      '2026-01-01',
      '2026-01-01',
      '2026-01-01'
    )
    .run();
  await database
    .prepare(
      'INSERT INTO chat_sessions (id, customer_id, token_hash, locale, created_at, last_message_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(sessionId, customerId, hash, 'en', '2026-01-01', '2026-01-01')
    .run();
  const before = await database.prepare('SELECT * FROM chat_customers').first();
  database.applyMigration('0007_chat_session_profiles.sql');
  const authenticated = await authenticateChatSession({ CHAT_DB: database }, sessionId, token);
  assert.equal(authenticated.first_name, 'Legacy');
  assert.equal(authenticated.phone, '+49 341 5550100');
  assert.equal(authenticated.locale, 'en');
  assert.equal(authenticated.privacy_consent_at, '2026-01-01');
  assert.deepEqual(await database.prepare('SELECT * FROM chat_customers').first(), before);
  assert.equal((await database.prepare('SELECT profile_phone FROM chat_sessions').first()).profile_phone, null);
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

test('legacy learning rows stay private before and after the review migration without losing their contents', async t => {
  const database = sqliteDatabase(t, { through: '0005_chat_learning_examples.sql' });
  const env = { CHAT_DB: database };
  const id = crypto.randomUUID();
  const customerMessage = 'Private visitor Fixture Person asks about poodle care.';
  const staffReply = 'Private reply concerning Fixture Street and poodle care.';
  await database
    .prepare(
      'INSERT INTO chat_learning_examples (id, locale, customer_message, staff_reply, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(id, 'en', customerMessage, staffReply, '2026-10-09T00:00:00Z')
    .run();
  assert.deepEqual(await listChatLearningExamples(env, 'en'), []);

  database.applyMigration('0006_chat_learning_review.sql');
  const retained = await database
    .prepare('SELECT customer_message, staff_reply, review_status FROM chat_learning_examples WHERE id = ?')
    .bind(id)
    .first();
  assert.equal(retained.customer_message, customerMessage);
  assert.equal(retained.staff_reply, staffReply);
  assert.equal(retained.review_status, 'pending');
  assert.deepEqual(await listChatLearningExamples(env, 'en'), []);
});

test('automatic staff learning remains pending and only reviewed approved examples reach shared guidance', async t => {
  const database = sqliteDatabase(t);
  const env = { CHAT_DB: database, CHAT_STAFF_LEARNING_ENABLED: 'true' };
  const registered = await registerChatCustomer(env, profile);
  const session = await authenticateChatSession(env, registered.sessionId, registered.token);
  const sourceMessageId = crypto.randomUUID();
  const privateQuestion = 'Fixture Person at Fixture Street asks about poodle care.';
  const privateReply = 'A private staff reply to Fixture Person about poodle care.';
  await recordChatMessage(env, session, { id: sourceMessageId, body: privateQuestion });
  assert.equal(await recordChatLearningExample(env, session, sourceMessageId, privateReply), true);
  const candidate = await database.prepare('SELECT review_status FROM chat_learning_examples').first();
  assert.equal(candidate.review_status, 'pending');
  assert.deepEqual(await listChatLearningExamples(env, 'en'), []);

  for (const [locale, question, reply, status] of [
    ['en', 'How is poodle care priced?', 'Use the verified public price list.', 'approved'],
    ['en', 'Rejected private poodle care question.', 'Rejected private poodle care reply.', 'rejected'],
    ['de', 'Wie wird die Pudelpflege berechnet?', 'Die veröffentlichte Preisliste gilt.', 'approved'],
  ]) {
    await database
      .prepare(
        'INSERT INTO chat_learning_examples (id, locale, customer_message, staff_reply, created_at, review_status) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(crypto.randomUUID(), locale, question, reply, '2026-10-09T00:00:00Z', status)
      .run();
  }
  const guidance = await listChatLearningExamples(env, 'en');
  assert.equal(guidance.length, 1);
  assert.equal(guidance[0].customer_message, 'How is poodle care priced?');
  assert.equal(guidance[0].staff_reply, 'Use the verified public price list.');
  const crmSource = await database.prepare('SELECT body FROM chat_messages WHERE id = ?').bind(sourceMessageId).first();
  assert.equal(crmSource.body, privateQuestion);
});
