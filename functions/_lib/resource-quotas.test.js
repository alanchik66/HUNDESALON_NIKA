import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { reserveResourceUsage, resourceQuotaResponse } from './resource-quotas.js';
import { withResourceQuotaDatabase } from '../../tools/lib/resource-quota-test-db.mjs';

const instant = Date.parse('2026-10-09T12:00:00Z');
const origin = 'https://hundesalon-nika.com';
function request(ip = '198.51.100.1', forwarded = '') {
  return new Request(origin, {
    headers: { ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...(forwarded ? { 'X-Forwarded-For': forwarded } : {}) },
  });
}
function env(settings = {}, options = {}) {
  return { CHAT_DB: withResourceQuotaDatabase({}, options), ...settings };
}
function reserve(binding, options = {}, req = request()) {
  return reserveResourceUsage(binding, req, { resource: 'ai', sessionId: 'session-1', now: instant, ...options });
}
function account(binding, resource = 'ai', day = '2026-10-09') {
  return binding.CHAT_DB.sqlite
    .prepare("SELECT * FROM resource_usage_daily WHERE day = ? AND resource = ? AND scope_key = 'account'")
    .get(day, resource);
}

test('reserves exactly the account cap and does not partially charge denied requests', async () => {
  const binding = env({ RESOURCE_QUOTA_AI_ACCOUNT: '2' });
  assert.equal((await reserve(binding)).ok, true);
  assert.equal((await reserve(binding)).ok, true);
  assert.deepEqual(await reserve(binding), { ok: false, reason: 'exceeded', retryAfter: 43200 });
  assert.equal(account(binding).units, 2);
  assert.equal(
    binding.CHAT_DB.sqlite.prepare('SELECT COUNT(*) AS total FROM resource_usage_reservations').get().total,
    2
  );
  assert.equal(binding.CHAT_DB.sqlite.prepare('SELECT SUM(units) AS total FROM resource_usage_daily').get().total, 6);
});

test('a full client or session quota leaves other scopes unchanged', async () => {
  for (const cap of ['CLIENT', 'SESSION']) {
    const binding = env({ ['RESOURCE_QUOTA_AI_' + cap]: '1' });
    assert.equal((await reserve(binding)).ok, true);
    assert.equal(
      (await reserve(binding, {}, request(cap === 'SESSION' ? '198.51.100.2' : '198.51.100.1'))).reason,
      'exceeded'
    );
    assert.equal(account(binding).units, 1);
    assert.equal(binding.CHAT_DB.sqlite.prepare('SELECT COUNT(*) AS total FROM resource_usage_daily').get().total, 3);
  }
});

test('rotating claimed sessions cannot evade the trusted client quota', async () => {
  const binding = env({ RESOURCE_QUOTA_AI_CLIENT: '1' });
  assert.equal((await reserve(binding, { sessionId: 'first' })).ok, true);
  assert.equal((await reserve(binding, { sessionId: 'second' })).reason, 'exceeded');
});

test('forwarded or missing client headers cannot create unlimited client buckets', async () => {
  for (const ip of ['198.51.100.1', '']) {
    const binding = env({ RESOURCE_QUOTA_AI_CLIENT: '1' });
    assert.equal((await reserve(binding, {}, request(ip, '198.51.100.22'))).ok, true);
    assert.equal(
      (await reserve(binding, { sessionId: 'new-session' }, request(ip, '198.51.100.33'))).reason,
      'exceeded'
    );
  }
});

test('invalid settings fail closed and no flag disables quotas', async () => {
  for (const invalid of ['0', '-1', 'Infinity', 'disabled', '100001']) {
    assert.equal((await reserve(env({ RESOURCE_QUOTA_AI_ACCOUNT: invalid }))).reason, 'unavailable');
  }
  const binding = env({
    RESOURCE_QUOTA_AI_ACCOUNT: '1',
    RESOURCE_QUOTAS_DISABLED: 'true',
    RESOURCE_QUOTA_AI_ENABLED: 'false',
  });
  assert.equal((await reserve(binding)).ok, true);
  assert.equal((await reserve(binding)).reason, 'exceeded');
});

test('byte reservations cover replay attempts and oversize admissions without partial charge', async () => {
  const binding = env({
    RESOURCE_QUOTA_UPLOADS_ACCOUNT_BYTES: '12',
    RESOURCE_QUOTA_UPLOAD_TRANSFER_ACCOUNT_BYTES: '8',
  });
  assert.equal((await reserve(binding, { resource: 'uploads', bytes: 12 })).ok, true);
  assert.equal((await reserve(binding, { resource: 'uploads', bytes: 1 })).reason, 'exceeded');
  assert.equal(account(binding, 'uploads').bytes, 12);
  assert.equal((await reserve(binding, { resource: 'upload_transfer', bytes: 4 })).ok, true);
  assert.equal((await reserve(binding, { resource: 'upload_transfer', bytes: 4 })).ok, true);
  assert.equal((await reserve(binding, { resource: 'upload_transfer', bytes: 4 })).reason, 'exceeded');
  assert.equal(account(binding, 'upload_transfer').bytes, 8);
});

test('missing migration or a database failure denies resource work', async () => {
  assert.equal((await reserve(env({}, { migrated: false }))).reason, 'unavailable');
  assert.equal((await reserve({})).reason, 'unavailable');
  assert.equal(
    (
      await reserve({
        CHAT_DB: {
          prepare() {
            throw new Error('private-query-value');
          },
        },
      })
    ).reason,
    'unavailable'
  );
});

test('UTC rollover refreshes daily caps and prunes only quota metadata after seven dates', async () => {
  const binding = env({ RESOURCE_QUOTA_AI_ACCOUNT: '1' });
  binding.CHAT_DB.sqlite.exec("CREATE TABLE protected_crm(id TEXT); INSERT INTO protected_crm VALUES ('preserved');");
  assert.equal((await reserve(binding, { now: Date.parse('2026-10-09T23:59:59Z') })).ok, true);
  assert.equal((await reserve(binding, { now: Date.parse('2026-10-10T00:00:00Z') })).ok, true);
  assert.equal((await reserve(binding, { now: Date.parse('2026-10-16T00:00:00Z') })).ok, true);
  assert.equal(account(binding, 'ai', '2026-10-09'), undefined);
  assert.equal(account(binding, 'ai', '2026-10-10').units, 1);
  assert.equal(binding.CHAT_DB.sqlite.prepare('SELECT id FROM protected_crm').get().id, 'preserved');
});

test('ledger stores only pseudonymous scope hashes and numeric counters', async () => {
  const binding = env();
  await reserve(binding);
  const row = binding.CHAT_DB.sqlite.prepare('SELECT * FROM resource_usage_reservations').get();
  assert.match(row.client_key, /^client:[a-f0-9]{64}$/);
  assert.match(row.session_key, /^session:[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(row), /198\.51\.100\.1|session-1/);
});

test('friendly limits are localized, uncached and expose only stable codes', async () => {
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    const response = resourceQuotaResponse({ reason: 'exceeded', retryAfter: 123 }, origin, locale);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '123');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const payload = await response.json();
    assert.equal(payload.error, 'RESOURCE_DAILY_LIMIT');
    assert.ok(payload.message.length > 20);
  }
});

test('independent concurrent SQLite connections never exceed the global cap', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'nika-quota-'));
  const databasePath = join(directory, 'quota.sqlite');
  const sqlite = new DatabaseSync(databasePath);
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec(readFileSync(new URL('../../migrations/0008_resource_usage_quotas.sql', import.meta.url), 'utf8'));
  t.after(() => {
    sqlite.close();
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')));
    assert.match(directory, /nika-quota-[^\\/]+$/);
    rmSync(directory, { recursive: true, force: true });
  });
  const workerCode = `
    const { parentPort, workerData } = require('node:worker_threads');
    const { DatabaseSync } = require('node:sqlite');
    (async () => {
      const { reserveResourceUsage } = await import(workerData.module);
      const sqlite = new DatabaseSync(workerData.databasePath);
      sqlite.exec('PRAGMA busy_timeout = 10000;');
      const db = { prepare(sql) {
        const stmt = sqlite.prepare(sql);
        return { bind(...values) { return { run: async () => ({ meta: { changes: Number(stmt.run(...values).changes) } }) }; } };
      } };
      const req = new Request('https://hundesalon-nika.com', { headers: { 'CF-Connecting-IP': '198.51.100.' + (workerData.index + 10) } });
      const results = await Promise.all(Array.from({ length: 50 }, (_, i) =>
        reserveResourceUsage({ CHAT_DB: db, RESOURCE_QUOTA_AI_ACCOUNT: '37' }, req,
          { resource: 'ai', sessionId: 'worker-' + workerData.index + '-' + i, now: 1791547200000 })
      ));
      sqlite.close();
      parentPort.postMessage(results);
    })().catch(error => { throw error; });
  `;
  const results = (
    await Promise.all(
      Array.from(
        { length: 8 },
        (_, index) =>
          new Promise((resolveResult, reject) => {
            const worker = new Worker(workerCode, {
              eval: true,
              workerData: { module: new URL('./resource-quotas.js', import.meta.url).href, databasePath, index },
            });
            worker.once('message', resolveResult);
            worker.once('error', reject);
            worker.once('exit', code => {
              if (code) reject(new Error('Quota worker exited ' + code));
            });
          })
      )
    )
  ).flat();
  assert.equal(results.filter(result => result.ok).length, 37);
  assert.equal(results.filter(result => result.reason === 'exceeded').length, 363);
  assert.equal(results.filter(result => result.reason === 'unavailable').length, 0);
  assert.equal(sqlite.prepare("SELECT units FROM resource_usage_daily WHERE scope_key = 'account'").get().units, 37);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM resource_usage_reservations').get().total, 37);
});

test('D1 trigger-inclusive change counts are accepted only after a successful reservation', async () => {
  const binding = env();
  const prepare = binding.CHAT_DB.prepare.bind(binding.CHAT_DB);
  binding.CHAT_DB.prepare = sql => {
    const statement = prepare(sql);
    const run = statement.run.bind(statement);
    statement.run = async () => {
      await run();
      return { success: true, meta: { changes: 4 } };
    };
    return statement;
  };
  assert.equal((await reserve(binding)).ok, true);
  assert.equal(account(binding).units, 1);
});
