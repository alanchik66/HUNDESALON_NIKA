import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import {
  ACCOUNT_ID,
  cloudflareApi,
  getCloudflareAuthHeaders,
  loadWranglerOAuth,
  refreshWranglerOAuth,
} from './lib/cloudflare-auth.mjs';

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const MAX_BODY_BYTES = 8192;
const COOKIE = 'nika_review_session';
const PENDING_SQL = `SELECT id, locale, customer_message, staff_reply, created_at
  FROM chat_learning_examples WHERE review_status = 'pending' ORDER BY created_at ASC, id ASC LIMIT 20`;

class ReviewError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function secretEquals(actual, expected) {
  const buffer = Buffer.from(String(actual || ''));
  const required = Buffer.from(expected);
  return buffer.length === required.length && timingSafeEqual(buffer, required);
}

export function createReviewAuthenticate({
  readOAuth = loadWranglerOAuth,
  refreshOAuth = refreshWranglerOAuth,
  readApiHeaders = getCloudflareAuthHeaders,
} = {}) {
  return async () => {
    let stored;
    try {
      stored = readOAuth();
    } catch {
      // Only absence/unreadable OAuth configuration permits scoped-token fallback.
      const headers = readApiHeaders();
      if (!headers) throw new Error('Existing D1 admin authentication is unavailable.');
      return headers;
    }
    // Existing Wrangler OAuth is refreshed when expired; a stale scoped token
    // must not shadow a valid administrator session or cause silent auth changes.
    return { Authorization: 'Bearer ' + (await refreshOAuth(stored)) };
  };
}

export function createD1ReviewStore({ databaseId, accountId = ACCOUNT_ID, api = cloudflareApi, authenticate } = {}) {
  if (!UUID.test(databaseId || '') || !/^[a-f0-9]{32}$/i.test(accountId)) throw new Error('Invalid D1 target.');
  const auth = authenticate || createReviewAuthenticate();
  return {
    label: `D1: ${databaseId}`,
    async query(sql, params = []) {
      // Structured parameters keep reviewed text out of executable SQL and shell commands.
      const results = await api(await auth(), `/accounts/${accountId}/d1/database/${databaseId}/query`, {
        method: 'POST',
        body: JSON.stringify({ sql, params }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!Array.isArray(results) || results.length !== 1 || results[0]?.success !== true) {
        throw new Error('D1 query failed.');
      }
      return results[0];
    },
  };
}

export async function createFixtureReviewStore() {
  const { DatabaseSync } = await import('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  for (const name of ['0005_chat_learning_examples.sql', '0006_chat_learning_review.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  sqlite.exec('CREATE TABLE chat_messages (id TEXT PRIMARY KEY, body TEXT NOT NULL)');
  sqlite
    .prepare('INSERT INTO chat_messages VALUES (?, ?)')
    .run('fixture-source', 'Fixture Person at Fixture Street asks about poodle care.');
  const insert = sqlite.prepare(
    'INSERT INTO chat_learning_examples (id, locale, customer_message, staff_reply, created_at, review_status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insert.run(
    '11111111-1111-4111-8111-111111111111',
    'en',
    'Fixture Person at Fixture Street asks about poodle care.',
    'Private reply for Fixture Person about poodle care.',
    '2026-10-09T00:00:00Z',
    'pending'
  );
  insert.run(
    '22222222-2222-4222-8222-222222222222',
    'de',
    'Wie oft benötigt ein Pudel eine Fellpflege?',
    'Ein privater Vorschlag für einen bestimmten Kunden.',
    '2026-10-09T00:00:01Z',
    'pending'
  );
  insert.run(
    '33333333-3333-4333-8333-333333333333',
    'en',
    'How can I find the public grooming prices?',
    'Please consult the published price list.',
    '2026-10-09T00:00:02Z',
    'approved'
  );
  return {
    label: 'Тестовая SQLite — вымышленные данные',
    async query(sql, params = []) {
      const statement = sqlite.prepare(sql);
      if (/^\s*SELECT\b/i.test(sql)) return { success: true, results: statement.all(...params) };
      return { success: true, results: [], meta: { changes: Number(statement.run(...params).changes) } };
    },
    close() {
      sqlite.close();
    },
  };
}

function genericText(value) {
  if (typeof value !== 'string') throw new ReviewError(400, 'Введите общий вопрос и ответ.');
  const text = value.normalize('NFC').trim();
  if (text.length < 12 || text.length > 1200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) {
    throw new ReviewError(400, 'Каждое поле должно содержать от 12 до 1200 символов.');
  }
  // These checks catch obvious identifiers; names and addresses still require human review.
  if (
    /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|https?:\/\/\S+|(?:\+?\d[\d\s()./-]{6,}\d)|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/iu.test(
      text
    )
  ) {
    throw new ReviewError(400, 'Удалите email, ссылки, телефоны и идентификаторы из общего FAQ.');
  }
  return text;
}

async function reviewExample(store, input) {
  if (!UUID.test(input?.id || '') || !['approve', 'reject'].includes(input?.action)) {
    throw new ReviewError(400, 'Некорректное действие.');
  }
  const result = await store.query(
    "SELECT customer_message, staff_reply FROM chat_learning_examples WHERE id = ? AND review_status = 'pending' LIMIT 1",
    [input.id]
  );
  const source = result.results?.[0];
  if (!source) throw new ReviewError(409, 'Этот пример уже обработан. Обновите список.');
  let updated;
  if (input.action === 'reject') {
    updated = await store.query(
      "UPDATE chat_learning_examples SET review_status = 'rejected' WHERE id = ? AND review_status = 'pending'",
      [input.id]
    );
  } else {
    if (input.confirmPrivacy !== true) throw new ReviewError(400, 'Подтвердите ручную проверку персональных данных.');
    const question = genericText(input.question);
    const answer = genericText(input.answer);
    if (question === source.customer_message.trim() || answer === source.staff_reply.trim()) {
      throw new ReviewError(400, 'Перепишите оба исходных поля как общий FAQ.');
    }
    updated = await store.query(
      "UPDATE chat_learning_examples SET customer_message = ?, staff_reply = ?, review_status = 'approved' WHERE id = ? AND review_status = 'pending'",
      [question, answer, input.id]
    );
  }
  if (Number(updated.meta?.changes) !== 1) throw new ReviewError(409, 'Этот пример уже обработан. Обновите список.');
  return { success: true, status: input.action === 'approve' ? 'approved' : 'rejected' };
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || ''))
    throw new ReviewError(415, 'Требуется JSON.');
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) throw new ReviewError(413, 'Слишком большой запрос.');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new ReviewError(413, 'Слишком большой запрос.');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object');
    return value;
  } catch {
    throw new ReviewError(400, 'Некорректный JSON.');
  }
}

function reviewPage(csrf, nonce) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Проверка примеров AI — NIKA</title>
<style nonce="${nonce}">:root{font:16px/1.5 system-ui,sans-serif;color:#14253b;background:#f3f6fa}body{margin:0}main{max-width:850px;margin:0 auto;padding:24px}h1{font-size:1.8rem}p{max-width:70ch}article{background:#fff;border:1px solid #ccd6e3;border-radius:12px;padding:20px;margin:20px 0}summary{cursor:pointer;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;background:#f3f6fa;padding:12px}label{display:block;margin:16px 0 6px;font-weight:600}textarea{box-sizing:border-box;width:100%;min-height:110px;padding:12px;font:inherit;border:1px solid #8b9aaf;border-radius:6px}button{font:inherit;border:0;border-radius:6px;padding:10px 16px;cursor:pointer;background:#163b64;color:white;margin:12px 8px 0 0}button.secondary{background:#e7ecf3;color:#14253b}button:disabled{opacity:.5;cursor:wait}:focus-visible{outline:3px solid #d99712;outline-offset:3px}.check{font-weight:400}.message{min-height:1.5em;font-weight:600}.error{color:#a32020}.meta{color:#52667f;font-size:.9rem}@media(max-width:600px){main{padding:16px}article{padding:16px}h1{font-size:1.5rem}button{width:100%;margin-right:0}}</style></head>
<body><main><h1>Проверка примеров AI</h1><p id="target" class="meta"></p><p>Перепишите полезную тему как общий FAQ: без имён, адресов, контактов и деталей конкретного клиента. Только после вашей проверки пример станет доступен AI. Исходная история CRM сохраняется.</p><button id="refresh" class="secondary">Обновить список</button><p id="notice" class="message" role="status" aria-live="polite"></p><section id="examples" aria-label="Ожидающие проверки примеры"></section></main>
<script nonce="${nonce}">
const csrf = '${csrf}';
const notice = document.getElementById('notice');
const examples = document.getElementById('examples');
async function api(path, body) {
  const options = { headers: { 'X-Review-CSRF': csrf } };
  if (body) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не удалось обработать запрос.');
  return result;
}
function element(tag, text, parent) { const node = document.createElement(tag); if (text) node.textContent = text; if (parent) parent.append(node); return node; }
function field(label, id, parent) { const caption = element('label', label, parent); caption.htmlFor = id; const input = element('textarea', '', parent); input.id = id; input.minLength = 12; input.maxLength = 1200; input.required = true; return input; }
function showError(error) { notice.textContent = error.message; notice.classList.add('error'); }
async function load(message = '') {
  const data = await api('/api/pending');
  document.getElementById('target').textContent = data.target;
  examples.replaceChildren();
  notice.classList.remove('error');
  notice.textContent = message || (data.examples.length ? 'Ожидают проверки: ' + data.examples.length + ' (до 20 за раз).' : 'Ожидающих примеров нет.');
  for (const row of data.examples) {
    const card = element('article', '', examples);
    element('h2', 'Пример · ' + row.locale.toUpperCase(), card);
    const meta = element('p', row.created_at, card); meta.className = 'meta';
    const details = element('details', '', card); element('summary', 'Исходный материал — приватный', details);
    element('h3', 'Вопрос клиента', details); element('pre', row.customer_message, details);
    element('h3', 'Ответ сотрудника', details); element('pre', row.staff_reply, details);
    const form = element('form', '', card);
    const question = field('Общий вопрос FAQ', 'question-' + row.id, form);
    const answer = field('Общий ответ FAQ', 'answer-' + row.id, form);
    const checkLabel = element('label', '', form); checkLabel.className = 'check';
    const check = element('input', '', checkLabel); check.type = 'checkbox'; check.required = true;
    checkLabel.append(document.createTextNode(' Я вручную удалил личные данные и проверил, что ответ подходит любому клиенту.'));
    const approve = element('button', 'Одобрить общий FAQ', form); approve.type = 'submit';
    const reject = element('button', 'Отклонить пример', form); reject.type = 'button'; reject.className = 'secondary';
    async function save(action) {
      approve.disabled = reject.disabled = true;
      try { await api('/api/review', { id: row.id, action, question: question.value, answer: answer.value, confirmPrivacy: check.checked }); await load(action === 'approve' ? 'Общий FAQ одобрен.' : 'Пример отклонён.'); }
      catch (error) { showError(error); approve.disabled = reject.disabled = false; }
    }
    form.addEventListener('submit', event => { event.preventDefault(); void save('approve'); });
    reject.addEventListener('click', () => { void save('reject'); });
  }
}
document.getElementById('refresh').addEventListener('click', () => { void load().catch(showError); });
void load().catch(showError);
</script></body></html>`;
}

export async function startReviewServer({ store, port = 0 } = {}) {
  if (!store?.query || !Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('Invalid review server options.');
  const session = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  let origin;
  const server = createServer(async (request, response) => {
    const nonce = randomBytes(18).toString('base64');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`
    );
    function send(status, data, type = 'application/json; charset=utf-8') {
      response.writeHead(status, { 'Content-Type': type });
      response.end(type.startsWith('text/html') ? data : JSON.stringify(data));
    }
    try {
      // Host checks prevent DNS rebinding; origin, cookie and CSRF checks protect local admin authority.
      if (
        request.socket.remoteAddress !== '127.0.0.1' ||
        request.headers.host !== new URL(origin).host ||
        (request.headers.origin && request.headers.origin !== origin) ||
        (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))
      ) {
        throw new ReviewError(403, 'Доступ разрешён только из локального интерфейса.');
      }
      if (request.url === '/' && request.method === 'GET') {
        response.setHeader('Set-Cookie', `${COOKIE}=${session}; HttpOnly; SameSite=Strict; Path=/`);
        send(200, reviewPage(csrf, nonce), 'text/html; charset=utf-8');
        return;
      }
      const cookies = String(request.headers.cookie || '')
        .split(';')
        .map(value => value.trim());
      if (
        !cookies.some(value => secretEquals(value, `${COOKIE}=${session}`)) ||
        !secretEquals(request.headers['x-review-csrf'], csrf)
      ) {
        throw new ReviewError(403, 'Откройте локальную страницу review заново.');
      }
      if (request.url === '/api/pending' && request.method === 'GET') {
        const data = await store.query(PENDING_SQL);
        send(200, { target: store.label || 'Выбранная база D1', examples: data.results || [] });
      } else if (request.url === '/api/review' && request.method === 'POST') {
        if (request.headers.origin !== origin) throw new ReviewError(403, 'Требуется запрос из локальной страницы.');
        send(200, await reviewExample(store, await readJson(request)));
      } else {
        throw new ReviewError(request.url?.startsWith('/api/') ? 405 : 404, 'Запрос не поддерживается.');
      }
    } catch (error) {
      // Do not expose SQL, credentials or private source material through backend errors.
      send(error instanceof ReviewError ? error.status : 502, {
        error:
          error instanceof ReviewError
            ? error.message
            : 'Не удалось обратиться к базе. Проверьте доступ D1 и миграцию 0006.',
      });
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    server,
    origin,
    close: () => new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      fixture: { type: 'boolean' },
      'database-id': { type: 'string' },
      'account-id': { type: 'string' },
      port: { type: 'string', default: '8767' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'node tools/chat-learning-review.mjs --fixture\nnode tools/chat-learning-review.mjs --database-id <D1 UUID> [--account-id <account>] [--port 8767]'
    );
    return;
  }
  if (Boolean(values.fixture) === Boolean(values['database-id']))
    throw new Error('Choose either --fixture or an explicit --database-id.');
  const store = values.fixture
    ? await createFixtureReviewStore()
    : createD1ReviewStore({ databaseId: values['database-id'], accountId: values['account-id'] || ACCOUNT_ID });
  const instance = await startReviewServer({ store, port: Number(values.port) });
  console.log(`Локальная проверка AI: ${instance.origin}\n${store.label}\nОстановить: Ctrl+C`);
  process.once('SIGINT', () => {
    void instance.close().then(() => {
      store.close?.();
    });
  });
  process.once('SIGTERM', () => {
    void instance.close().then(() => {
      store.close?.();
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error('Не удалось запустить review. Проверьте аргументы (--help), порт и существующий доступ D1.');
    process.exitCode = 1;
  });
}
