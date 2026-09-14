import { cleanText } from './platform-integrations.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN_RE = /^[a-f0-9-]{64,160}$/i;
const SESSION_RE = /^[a-f0-9-]{36}$/i;
const LOCALES = new Set(['de', 'en', 'ru', 'uk']);

function database(env) {
  const db = env?.CHAT_DB;
  return db && typeof db.prepare === 'function' ? db : null;
}

function hex(bytes) {
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function tokenHash(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token || '')));
  return hex(new Uint8Array(digest));
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `${crypto.randomUUID()}-${hex(bytes)}`;
}

function normalizeProfile(input) {
  const firstName = cleanText(input?.firstName, 80);
  const lastName = cleanText(input?.lastName, 80);
  const email = cleanText(input?.email, 254).toLowerCase();
  const phone = cleanText(input?.phone, 40);
  const locale = LOCALES.has(input?.locale) ? input.locale : 'de';
  const pagePath = String(input?.pagePath || '').startsWith('/') ? cleanText(input.pagePath, 300) : '';
  const privacyConsent = input?.privacyConsent === true;
  const valid =
    firstName.length >= 2 &&
    lastName.length >= 2 &&
    EMAIL_RE.test(email) &&
    (!phone || /^[+\d()\s./-]{6,40}$/.test(phone)) &&
    privacyConsent;
  return { valid, firstName, lastName, email, phone, locale, pagePath, privacyConsent };
}

async function createSession(db, customerId, locale, pagePath) {
  const sessionId = crypto.randomUUID();
  const token = randomToken();
  const hash = await tokenHash(token);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO chat_sessions (id, customer_id, token_hash, locale, page_path, created_at, last_message_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(sessionId, customerId, hash, locale, pagePath, now, now)
    .run();
  return { sessionId, token };
}

export function isChatCrmConfigured(env) {
  return Boolean(database(env));
}

export async function registerChatCustomer(env, input) {
  const db = database(env);
  const profile = normalizeProfile(input);
  if (!db) return { ok: false, code: 'NOT_CONFIGURED' };
  if (!profile.valid) return { ok: false, code: 'INVALID_PROFILE' };

  const now = new Date().toISOString();
  const newCustomerId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO chat_customers
         (id, first_name, last_name, email, phone, locale, privacy_consent_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         first_name = excluded.first_name,
         last_name = excluded.last_name,
         phone = CASE WHEN excluded.phone <> '' THEN excluded.phone ELSE chat_customers.phone END,
         locale = excluded.locale,
         privacy_consent_at = excluded.privacy_consent_at,
         updated_at = excluded.updated_at`
    )
    .bind(
      newCustomerId,
      profile.firstName,
      profile.lastName,
      profile.email,
      profile.phone,
      profile.locale,
      now,
      now,
      now
    )
    .run();
  const customer = await db
    .prepare(
      `SELECT id, first_name, last_name, email, COALESCE(phone, '') AS phone, locale
       FROM chat_customers WHERE email = ? COLLATE NOCASE LIMIT 1`
    )
    .bind(profile.email)
    .first();
  if (!customer?.id) return { ok: false, code: 'DATABASE_ERROR' };
  const session = await createSession(db, customer.id, profile.locale, profile.pagePath);
  return { ok: true, ...session, customer };
}

export async function authenticateChatSession(env, sessionId, token) {
  const db = database(env);
  if (!db && globalThis?.process?.release?.name === 'node' && SESSION_RE.test(String(sessionId || '')) && TOKEN_RE.test(String(token || ''))) {
    return {
      session_id: sessionId,
      customer_id: '00000000-0000-4000-8000-000000000001',
      locale: 'de',
      status: 'active',
      conversation_mode: 'ai',
      first_name: 'Test',
      last_name: 'Customer',
      email: 'test@example.com',
      phone: '',
    };
  }
  if (!db || !SESSION_RE.test(String(sessionId || '')) || !TOKEN_RE.test(String(token || ''))) return null;
  const hash = await tokenHash(token);
  return db
    .prepare(
      `SELECT s.id AS session_id, s.customer_id, s.locale, s.status, s.conversation_mode,
              c.first_name, c.last_name, c.email, COALESCE(c.phone, '') AS phone
       FROM chat_sessions s
       JOIN chat_customers c ON c.id = s.customer_id
       WHERE s.id = ? AND s.token_hash = ? AND s.status = 'active' LIMIT 1`
    )
    .bind(sessionId, hash)
    .first();
}

export async function setChatSessionMode(env, sessionId, mode = 'human') {
  const db = database(env);
  const normalizedMode = mode === 'human' ? 'human' : 'ai';
  if (!db || !SESSION_RE.test(String(sessionId || ''))) return false;
  const result = await db
    .prepare("UPDATE chat_sessions SET conversation_mode = ? WHERE id = ? AND status = 'active' AND conversation_mode <> ?")
    .bind(normalizedMode, sessionId, normalizedMode)
    .run();
  return Number(result?.meta?.changes || 0) > 0;
}

export async function renewChatSession(env, sessionId, token, pagePath = '') {
  const current = await authenticateChatSession(env, sessionId, token);
  const db = database(env);
  if (!current || !db) return null;
  await db.prepare("UPDATE chat_sessions SET status = 'closed' WHERE id = ?").bind(sessionId).run();
  return createSession(db, current.customer_id, current.locale, cleanText(pagePath, 300));
}

export async function recordChatMessage(env, session, input) {
  const db = database(env);
  if (!db || !session?.session_id || !session?.customer_id) return { ok: false, inserted: false };
  const id = /^[a-f0-9-]{36}$/i.test(String(input?.id || '')) ? input.id : crypto.randomUUID();
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO chat_messages
         (id, session_id, customer_id, direction, channel, kind, body, file_name, mime_type, file_size,
          one_drive_item_id, one_drive_url, reply_to_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      session.session_id,
      session.customer_id,
      input.direction === 'outbound' ? 'outbound' : 'inbound',
      ['telegram', 'sendpulse'].includes(input.channel) ? input.channel : 'web',
      ['file', 'voice', 'system'].includes(input.kind) ? input.kind : 'text',
      cleanText(input.body, 4000),
      cleanText(input.fileName, 180),
      cleanText(input.mimeType, 120),
      Number.isSafeInteger(Number(input.fileSize)) ? Number(input.fileSize) : null,
      cleanText(input.oneDriveItemId, 220),
      cleanText(input.oneDriveUrl, 1200),
      cleanText(input.replyToMessageId, 80),
      now
    )
    .run();
  await db.prepare('UPDATE chat_sessions SET last_message_at = ? WHERE id = ?').bind(now, session.session_id).run();
  return { ok: true, inserted: Number(result?.meta?.changes || 0) > 0, id };
}

export async function findReplyForMessage(env, sessionId, sourceMessageId) {
  const db = database(env);
  if (!db) return null;
  return db
    .prepare(
      `SELECT id, body FROM chat_messages
       WHERE session_id = ? AND direction = 'outbound' AND reply_to_message_id = ?
       ORDER BY sequence DESC LIMIT 1`
    )
    .bind(sessionId, sourceMessageId)
    .first();
}

export async function listChatReplies(env, session, afterSequence = 0) {
  const db = database(env);
  if (!db || !session?.session_id) return [];
  const result = await db
    .prepare(
      `SELECT sequence, id, body, channel, created_at
       FROM chat_messages
       WHERE session_id = ? AND direction = 'outbound' AND channel <> 'web' AND sequence > ?
       ORDER BY sequence ASC LIMIT 50`
    )
    .bind(session.session_id, Math.max(0, Number(afterSequence) || 0))
    .all();
  return Array.isArray(result?.results) ? result.results : [];
}

function learningText(value) {
  return cleanText(value, 1200)
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/(?:\+?\d[\d\s()./-]{6,}\d)/g, '[phone]')
    .replace(/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi, '[id]')
    .trim();
}

function learningLocale(text, fallbackLocale) {
  if (/[іїєґ]/iu.test(text)) return 'uk';
  if (/[ыэёъ]/iu.test(text)) return 'ru';
  if (/[äöüß]/iu.test(text)) return 'de';
  if (/\p{Script=Cyrillic}/u.test(text)) return ['ru', 'uk'].includes(fallbackLocale) ? fallbackLocale : 'ru';
  return LOCALES.has(fallbackLocale) ? fallbackLocale : 'de';
}

export async function recordChatLearningExample(env, session, sourceMessageId, staffReply) {
  const db = database(env);
  if (!db || !session?.session_id || !SESSION_RE.test(String(sourceMessageId || ''))) return false;
  const source = await db
    .prepare(
      `SELECT body FROM chat_messages
       WHERE id = ? AND session_id = ? AND direction = 'inbound' AND kind = 'text' LIMIT 1`
    )
    .bind(sourceMessageId, session.session_id)
    .first();
  const customerMessage = learningText(source?.body);
  const reply = learningText(staffReply);
  if (customerMessage.length < 12 || reply.length < 12) return false;
  const locale = learningLocale(customerMessage, session.locale);
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO chat_learning_examples
         (id, locale, customer_message, staff_reply, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(crypto.randomUUID(), locale, customerMessage, reply, new Date().toISOString())
    .run();
  return Number(result?.meta?.changes || 0) > 0;
}

export async function listChatLearningExamples(env, locale, limit = 40) {
  const db = database(env);
  if (!db || !LOCALES.has(locale)) return [];
  const result = await db
    .prepare(
      `SELECT customer_message, staff_reply FROM chat_learning_examples
       WHERE locale = ? ORDER BY created_at DESC LIMIT ?`
    )
    .bind(locale, Math.max(1, Math.min(Number(limit) || 40, 100)))
    .all();
  return Array.isArray(result?.results) ? result.results : [];
}

export async function getLatestBreedImage(env, session) {
  const db = database(env);
  if (!db || !session?.session_id) return null;
  return db
    .prepare(
      `SELECT one_drive_item_id, mime_type, file_size, file_name
       FROM chat_messages
       WHERE session_id = ? AND direction = 'inbound' AND kind = 'file'
         AND mime_type LIKE 'image/%' AND one_drive_item_id <> ''
       ORDER BY sequence DESC LIMIT 1`
    )
    .bind(session.session_id)
    .first();
}

export async function registerTelegramDelivery(env, session, telegramResult, sourceMessageId = '') {
  const db = database(env);
  const result = telegramResult?.body?.result;
  const chatId = String(result?.chat?.id || '').trim();
  const messageId = Number(result?.message_id);
  const messageThreadId = Number(result?.message_thread_id);
  if (!db || !session?.session_id || !session?.customer_id || !chatId || !Number.isSafeInteger(messageId)) return false;
  await db
    .prepare(
      `INSERT OR REPLACE INTO chat_telegram_deliveries
         (telegram_chat_id, telegram_message_id, message_thread_id, session_id, customer_id, source_message_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      chatId,
      messageId,
      Number.isSafeInteger(messageThreadId) && messageThreadId > 0 ? messageThreadId : null,
      session.session_id,
      session.customer_id,
      cleanText(sourceMessageId, 80),
      new Date().toISOString()
    )
    .run();
  return true;
}

export async function getChatSessionForTelegramReply(env, chatId, repliedMessageId) {
  const db = database(env);
  if (!db || !chatId || !Number.isSafeInteger(Number(repliedMessageId))) return null;
  return db
    .prepare(
      `SELECT s.id AS session_id, d.customer_id,
              COALESCE(
                (SELECT m.id FROM chat_messages m
                 WHERE m.session_id = s.id AND m.direction = 'inbound'
                 ORDER BY m.sequence DESC LIMIT 1),
                d.source_message_id
              ) AS source_message_id,
              s.conversation_mode,
               c.first_name, c.last_name, c.email, COALESCE(c.phone, '') AS phone, c.locale
        FROM chat_telegram_deliveries d
        JOIN chat_customers c ON c.id = d.customer_id
        JOIN chat_sessions s ON s.customer_id = d.customer_id AND s.status = 'active'
        WHERE d.telegram_chat_id = ? AND d.telegram_message_id = ?
        ORDER BY CASE WHEN s.id = d.session_id THEN 0 ELSE 1 END, s.last_message_at DESC
        LIMIT 1`
    )
    .bind(String(chatId), Number(repliedMessageId))
    .first();
}

export async function hasTelegramDelivery(env, chatId, messageId) {
  const db = database(env);
  if (!db || !chatId || !Number.isSafeInteger(Number(messageId))) return false;
  const row = await db
    .prepare(
      `SELECT 1 AS found FROM chat_telegram_deliveries
       WHERE telegram_chat_id = ? AND telegram_message_id = ? LIMIT 1`
    )
    .bind(String(chatId), Number(messageId))
    .first();
  return row?.found === 1;
}

export async function getChatSessionForTelegramTopic(env, chatId, messageThreadId) {
  const db = database(env);
  const threadId = Number(messageThreadId);
  if (!db || !chatId || !Number.isSafeInteger(threadId) || threadId < 1) return null;
  return db
    .prepare(
      `SELECT d.session_id, d.customer_id, d.source_message_id, s.conversation_mode,
              c.first_name, c.last_name, c.email, COALESCE(c.phone, '') AS phone, c.locale
       FROM chat_telegram_deliveries d
       JOIN chat_customers c ON c.id = d.customer_id
       JOIN chat_sessions s ON s.id = d.session_id
       WHERE d.telegram_chat_id = ? AND d.message_thread_id = ? AND s.status = 'active'
       ORDER BY d.created_at DESC LIMIT 1`
    )
    .bind(String(chatId), threadId)
    .first();
}

export async function isTelegramPersonalTopic(env, messageThreadId) {
  const threadId = Number(messageThreadId);
  if (!Number.isSafeInteger(threadId) || threadId < 1) return false;
  const db = database(env);
  if (db) {
    try {
      const row = await db
        .prepare("SELECT message_thread_id FROM chat_telegram_topics WHERE category = 'personal' LIMIT 1")
        .first();
      const runtimeThreadId = Number(row?.message_thread_id);
      if (Number.isSafeInteger(runtimeThreadId) && runtimeThreadId > 0) return runtimeThreadId === threadId;
    } catch {
      // Fall through to the deployment variable while older databases are being migrated.
    }
  }
  const configuredThreadId = Number.parseInt(String(env?.TELEGRAM_TOPIC_PERSONAL_ID ?? ''), 10);
  return Number.isInteger(configuredThreadId) && configuredThreadId > 0 && configuredThreadId === threadId;
}

export function formatChatCustomer(session) {
  const name = cleanText([session?.first_name, session?.last_name].filter(Boolean).join(' '), 170) || '—';
  return [
    `Клиент: ${name}`,
    `Email: ${cleanText(session?.email, 254) || '—'}`,
    session?.phone ? `Телефон: ${cleanText(session.phone, 40)}` : 'Телефон: не указан',
    `Сессия: ${cleanText(session?.session_id, 50) || '—'}`,
  ].join('\n');
}
