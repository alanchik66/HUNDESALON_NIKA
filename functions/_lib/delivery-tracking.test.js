import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { setImmediate as waitImmediate } from 'node:timers/promises';
import { createDeliveryTracker, pruneDeliveryMetadata } from './delivery-tracking.js';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const INSTANT = new Date('2026-10-09T12:00:00.000Z');

function database(t, { failInsert = false, failUpdate = false, migrated = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  if (migrated) {
    sqlite.exec(readFileSync(new URL('../../migrations/0009_delivery_tracking.sql', import.meta.url), 'utf8'));
  }
  const db = {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              if ((failInsert && /^INSERT/i.test(sql)) || (failUpdate && /^UPDATE/i.test(sql))) {
                throw new Error('Private customer@example.com / provider-token');
              }
              return { success: true, meta: { changes: Number(sqlite.prepare(sql).run(...params).changes) } };
            },
          };
        },
      };
    },
  };
  return { sqlite, db };
}

function captureLogs(t) {
  const logs = [];
  for (const method of ['info', 'error']) t.mock.method(console, method, (...args) => logs.push(args.join(' ')));
  return logs;
}

function tracker(db, options = {}) {
  return createDeliveryTracker(
    { CHAT_DB: db },
    {
      requestId: REQUEST_ID,
      formType: 'booking',
      now: () => INSTANT,
      ...options,
    }
  );
}

test('the real ledger classifies provider acceptance, skips and rejection without retaining provider bodies', async t => {
  const { db, sqlite } = database(t);
  const logs = captureLogs(t);
  const track = tracker(db);
  const cases = [
    [{ ok: true, status: 202 }, 'accepted', 'accepted', 202],
    [{ ok: true, skipped: true, status: 200 }, 'skipped', 'skipped', 200],
    [{ ok: false, skipped: true, reason: 'Disabled' }, 'skipped', 'skipped', 0],
    [{ ok: false, status: 503 }, 'failed', 'provider_failure', 503],
    [false, 'failed', 'provider_failure', 0],
    [null, 'failed', 'provider_failure', 0],
    [{ ok: 'true', status: 99 }, 'failed', 'provider_failure', 0],
  ];
  for (const [value, state, code, status] of cases) {
    const result =
      value && typeof value === 'object'
        ? {
            ...value,
            recipient: 'Private Name <customer@example.com>',
            body: 'Private Street 17',
            token: 'provider-token',
          }
        : value;
    assert.equal(await track('email_client', async () => result), result);
    const row = sqlite.prepare('SELECT * FROM delivery_attempts ORDER BY rowid DESC LIMIT 1').get();
    assert.equal(row.state, state);
    assert.equal(row.result_code, code);
    assert.equal(row.provider_status, status);
    assert.equal(row.request_id, REQUEST_ID);
    assert.equal(row.created_at, INSTANT.toISOString());
    assert.equal(row.updated_at, INSTANT.toISOString());
  }
  const persisted = JSON.stringify(sqlite.prepare('SELECT * FROM delivery_attempts').all());
  assert.doesNotMatch(
    persisted + logs.join('\n'),
    /customer@example|Private Name|Private Street|provider-token|Disabled/
  );
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM delivery_attempts').get().count, cases.length);
});

test('an operation rejection is preserved and logged only as stable technical metadata', async t => {
  const { db, sqlite } = database(t);
  const logs = captureLogs(t);
  const failure = new Error('Private Name customer@example.com / provider-token');
  await assert.rejects(
    tracker(db)('telegram', async () => {
      throw failure;
    }),
    error => error === failure
  );
  const row = sqlite.prepare('SELECT * FROM delivery_attempts').get();
  assert.equal(row.state, 'failed');
  assert.equal(row.result_code, 'network_error');
  assert.equal(row.provider_status, 0);
  assert.doesNotMatch(JSON.stringify(row) + logs.join('\n'), /Private Name|customer@example|provider-token/);
});

test('all rejection reasons, including falsy primitive values, retain their rejection semantics', async t => {
  const { db, sqlite } = database(t);
  captureLogs(t);
  for (const reason of [undefined, null, false, 0, '']) {
    let rejected = false;
    try {
      await tracker(db)('automation', async () => {
        throw reason;
      });
    } catch (error) {
      rejected = true;
      assert.equal(error, reason);
    }
    assert.equal(rejected, true, 'A falsy reason must still reject.');
  }
  assert.equal(
    sqlite
      .prepare(
        "SELECT COUNT(*) AS count FROM delivery_attempts WHERE state = 'failed' AND result_code = 'network_error'"
      )
      .get().count,
    5
  );
});

test('missing, old-schema and failing databases never prevent the operation or alter its result and exception', async t => {
  const broken = database(t, { failInsert: true });
  const legacy = database(t, { migrated: false });
  const logs = captureLogs(t);
  for (const db of [undefined, {}, broken.db, legacy.db]) {
    let executed = 0;
    const original = { ok: true, status: 200, token: 'provider-token' };
    assert.equal(
      await tracker(db)('email_main', async () => {
        executed += 1;
        return original;
      }),
      original
    );
    assert.equal(executed, 1);
    const failure = new Error('Private customer@example.com / provider-token');
    await assert.rejects(
      tracker(db)('email_main', async () => {
        throw failure;
      }),
      error => error === failure
    );
  }
  assert.equal(broken.sqlite.prepare('SELECT COUNT(*) AS count FROM delivery_attempts').get().count, 0);
  assert.ok(logs.some(line => line.includes('delivery_tracking_unavailable')));
  assert.doesNotMatch(logs.join('\n'), /customer@example|provider-token/);
});

test('independent concurrent attempts have unique rows and do not overwrite outcomes on the same request and channel', async t => {
  const { db, sqlite } = database(t);
  captureLogs(t);
  const track = tracker(db);
  const release = [];
  const operations = Array.from({ length: 16 }, (_, index) =>
    track('telegram', () => new Promise(resolve => release.push(() => resolve({ ok: index % 2 === 0, status: 200 }))))
  );
  await waitImmediate();
  assert.equal(release.length, 16);
  const pending = sqlite.prepare("SELECT COUNT(*) AS count FROM delivery_attempts WHERE state = 'pending'").get().count;
  assert.equal(pending, 16);
  for (const complete of release.toReversed()) complete();
  await Promise.all(operations);
  const rows = sqlite.prepare('SELECT * FROM delivery_attempts').all();
  assert.equal(new Set(rows.map(row => row.id)).size, 16);
  assert.equal(rows.filter(row => row.state === 'accepted').length, 8);
  assert.equal(rows.filter(row => row.state === 'failed').length, 8);
  assert.ok(rows.every(row => row.channel === 'telegram' && row.request_id === REQUEST_ID));
});

test('an interrupted final update preserves pending metadata and still returns the provider result', async t => {
  const { db, sqlite } = database(t, { failUpdate: true });
  const logs = captureLogs(t);
  const original = { ok: true, status: 201, body: 'customer@example.com / provider-token' };
  assert.equal(await tracker(db)('booking_register', async () => original), original);
  const row = sqlite.prepare('SELECT * FROM delivery_attempts').get();
  assert.equal(row.state, 'pending');
  assert.equal(row.result_code, 'pending');
  assert.equal(row.provider_status, 0);
  assert.ok(logs.some(line => line.includes('delivery_tracking_unavailable')));
  assert.doesNotMatch(logs.join('\n'), /customer@example|provider-token/);
});

test('thirty-day retention removes only older ledger rows and preserves the boundary, CRM and bookings', async t => {
  const { db, sqlite } = database(t);
  captureLogs(t);
  sqlite.exec(
    "CREATE TABLE chat_messages (body TEXT); INSERT INTO chat_messages VALUES ('Original CRM'); CREATE TABLE bookings (id TEXT); INSERT INTO bookings VALUES ('Original booking');"
  );
  const cutoff = new Date(INSTANT.getTime() - 30 * 86400_000);
  for (const instant of [new Date(cutoff.getTime() - 1), cutoff, new Date(cutoff.getTime() + 1)]) {
    await tracker(db, { now: () => instant })('email_main', async () => ({ ok: true }));
  }
  assert.equal(await pruneDeliveryMetadata({ CHAT_DB: db }, INSTANT), true);
  const remaining = sqlite.prepare('SELECT created_at FROM delivery_attempts ORDER BY created_at').all();
  assert.deepEqual(
    remaining.map(row => row.created_at),
    [cutoff.toISOString(), new Date(cutoff.getTime() + 1).toISOString()]
  );
  assert.equal(sqlite.prepare('SELECT body FROM chat_messages').get().body, 'Original CRM');
  assert.equal(sqlite.prepare('SELECT id FROM bookings').get().id, 'Original booking');
  assert.equal(await pruneDeliveryMetadata({}, INSTANT), false);
});

test('invalid tracking contexts and channels never execute the operation', async t => {
  const { db } = database(t);
  assert.throws(() => tracker(db, { requestId: 'customer@example.com' }), /Invalid delivery context/);
  assert.throws(() => tracker(db, { formType: 'raw private form' }), /Invalid delivery context/);
  let ran = false;
  await assert.rejects(
    tracker(db)('private channel', () => {
      ran = true;
    }),
    /Invalid delivery channel/
  );
  assert.equal(ran, false);
});

test('zero-change final metadata updates remain pending and an empty retention delete succeeds', async t => {
  const { db, sqlite } = database(t);
  const logs = captureLogs(t);
  const noUpdate = {
    prepare(sql) {
      if (/^UPDATE/i.test(sql)) {
        return { bind: () => ({ run: async () => ({ success: true, meta: { changes: 0 } }) }) };
      }
      return db.prepare(sql);
    },
  };
  const result = { ok: true, status: 202 };
  assert.equal(await tracker(noUpdate)('email_main', async () => result), result);
  assert.equal(sqlite.prepare('SELECT state FROM delivery_attempts').get().state, 'pending');
  assert.equal(logs.filter(line => line.includes('delivery_tracking_unavailable')).length, 1);
  assert.equal(await pruneDeliveryMetadata({ CHAT_DB: db }, INSTANT), true);
  assert.equal(logs.filter(line => line.includes('delivery_tracking_unavailable')).length, 1);
});

test('an unsuccessful D1 write result preserves the original operation outcome', async t => {
  const logs = captureLogs(t);
  const db = {
    prepare() {
      return { bind: () => ({ run: async () => ({ success: false, meta: { changes: 1 } }) }) };
    },
  };
  const result = { ok: false, status: 502 };
  assert.equal(await tracker(db)('email_main', async () => result), result);
  assert.equal(logs.filter(line => line.includes('delivery_tracking_unavailable')).length, 1);
});
