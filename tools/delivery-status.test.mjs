import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  DELIVERY_STATUS_SQL,
  formatDeliveryStatus,
  parseDeliveryStatusOptions,
  readDeliveryStatus,
  runDeliveryStatus,
} from './delivery-status.mjs';

const DATABASE_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-09T12:00:00.000Z');

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(readFileSync(new URL('../migrations/0009_delivery_tracking.sql', import.meta.url), 'utf8'));
  const calls = [];
  const store = {
    async query(sql, params) {
      calls.push({ sql, params });
      assert.match(sql, /^SELECT\b/);
      return { success: true, results: sqlite.prepare(sql).all(...params) };
    },
  };
  function insert({ state = 'failed', ageMinutes = 60, channel = 'email_main', code, status = 503 } = {}) {
    const id = crypto.randomUUID();
    const timestamp = new Date(NOW.getTime() - ageMinutes * 60_000).toISOString();
    sqlite
      .prepare('INSERT INTO delivery_attempts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        id,
        REQUEST_ID,
        'booking',
        channel,
        state,
        status,
        code || (state === 'failed' ? 'provider_failure' : state),
        timestamp,
        timestamp
      );
    return id;
  }
  return { store, sqlite, calls, insert };
}

test('CLI requires an explicit target UUID and only bounded whole hours, while help needs no credentials', () => {
  assert.deepEqual(parseDeliveryStatusOptions(['--database-id', DATABASE_ID]), {
    databaseId: DATABASE_ID,
    hours: 24,
    json: false,
  });
  assert.deepEqual(parseDeliveryStatusOptions(['--help']), { help: true });
  assert.equal(parseDeliveryStatusOptions(['--database-id', DATABASE_ID, '--hours', '168', '--json']).json, true);
  for (const args of [
    [],
    ['--database-id', 'customer@example.com'],
    ['--database-id', DATABASE_ID, '--hours', '0'],
    ['--database-id', DATABASE_ID, '--hours', '169'],
    ['--database-id', DATABASE_ID, '--hours', '1.5'],
    ['--database-id', DATABASE_ID, '--hours', 'Infinity'],
    ['--database-id', DATABASE_ID, '--hours', '1e2'],
    ['--database-id', DATABASE_ID, '--retry'],
  ])
    assert.throws(() => parseDeliveryStatusOptions(args));
});

test('real SQLite query selects only recent failures/skips and pending strictly older than ten minutes', async t => {
  const { store, sqlite, calls, insert } = fixture(t);
  const failed = insert({ state: 'failed', ageMinutes: 15 });
  const skipped = insert({ state: 'skipped', ageMinutes: 20, status: 0 });
  const pending = insert({ state: 'pending', ageMinutes: 10.001, status: 0 });
  const cutoff = insert({ state: 'failed', ageMinutes: 60 });
  insert({ state: 'accepted', ageMinutes: 15, status: 202 });
  insert({ state: 'pending', ageMinutes: 10, status: 0 });
  insert({ state: 'pending', ageMinutes: 5, status: 0 });
  insert({ state: 'failed', ageMinutes: 61 });
  insert({ state: 'failed', ageMinutes: -1 });
  const before = sqlite.prepare('SELECT * FROM delivery_attempts ORDER BY id').all();
  const report = await readDeliveryStatus(store, { hours: 1, now: NOW });
  assert.deepEqual(new Set(report.attempts.map(row => row.id)), new Set([failed, skipped, pending, cutoff]));
  assert.deepEqual(
    report.attempts.map(row => row.state),
    ['pending', 'failed', 'skipped', 'failed']
  );
  assert.deepEqual(calls[0], {
    sql: DELIVERY_STATUS_SQL,
    params: ['2026-10-09T11:00:00.000Z', NOW.toISOString(), '2026-10-09T11:50:00.000Z'],
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(sqlite.prepare('SELECT * FROM delivery_attempts ORDER BY id').all(), before);
  assert.match(formatDeliveryStatus(report), /email_main\tfailed\t503/);
});

test('the real query is bounded to the latest hundred metadata attempts', async t => {
  const { store, insert } = fixture(t);
  for (let index = 0; index < 120; index += 1) insert({ ageMinutes: index + 1 });
  const report = await readDeliveryStatus(store, { now: NOW });
  assert.equal(report.attempts.length, 100);
  assert.equal(report.limit, 100);
  assert.equal(report.attempts[0].created_at, '2026-10-09T11:59:00.000Z');
  assert.equal(report.attempts.at(-1).created_at, '2026-10-09T10:20:00.000Z');
});

test('unrecognized API fields never reach JSON or terminal output, and malformed metadata is rejected', async t => {
  const { store, insert } = fixture(t);
  insert();
  const report = await readDeliveryStatus(store, { now: NOW });
  const row = report.attempts[0];
  const untrusted = {
    ...row,
    recipient: 'Private Name <customer@example.com>',
    body: 'Private Street 17',
    token: 'provider-token',
  };
  const safe = await readDeliveryStatus({ query: async () => ({ success: true, results: [untrusted] }) }, { now: NOW });
  assert.deepEqual(safe.attempts, [row]);
  assert.doesNotMatch(
    JSON.stringify(safe) + formatDeliveryStatus(safe),
    /customer@example|Private Name|Private Street|provider-token/
  );
  for (const changed of [
    { ...row, request_id: 'customer@example.com' },
    { ...row, channel: 'Private Name' },
    { ...row, state: 'accepted' },
    { ...row, provider_status: 'provider-token' },
    { ...row, created_at: 'Private Street 17' },
  ]) {
    await assert.rejects(
      readDeliveryStatus({ query: async () => ({ success: true, results: [changed] }) }, { now: NOW }),
      /Invalid delivery metadata/
    );
  }
  await assert.rejects(
    readDeliveryStatus({ query: async () => ({ success: false, results: [] }) }, { now: NOW }),
    /Invalid delivery metadata/
  );
  await assert.rejects(
    readDeliveryStatus({ query: async () => ({ success: true, results: Array(101).fill(row) }) }, { now: NOW }),
    /Invalid delivery metadata/
  );
});

test('CLI reuses explicit D1 admin access for exactly one read and never retries or sends notifications', async t => {
  const { store, calls, insert } = fixture(t);
  insert({ channel: 'telegram' });
  const output = [];
  const errors = [];
  const targets = [];
  const exitCode = await runDeliveryStatus(['--database-id', DATABASE_ID, '--hours', '3', '--json'], {
    createStore: options => {
      targets.push(options);
      return store;
    },
    output: value => output.push(value),
    reportError: value => errors.push(value),
    now: NOW,
  });
  assert.equal(exitCode, 0);
  assert.deepEqual(targets, [{ databaseId: DATABASE_ID }]);
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(output[0]).attempts[0].channel, 'telegram');
  assert.deepEqual(errors, []);
});

test('empty results make no health guarantee and backend failures reveal no SQL, PII or token', async t => {
  const { store } = fixture(t);
  const report = await readDeliveryStatus(store, { now: NOW });
  assert.match(formatDeliveryStatus(report), /Это не проверка доступности всех провайдеров/);
  const output = [];
  const errors = [];
  let queries = 0;
  const status = await runDeliveryStatus(['--database-id', DATABASE_ID], {
    createStore: () => ({
      query: async () => {
        queries += 1;
        throw new Error('SELECT secret; customer@example.com provider-token');
      },
    }),
    output: value => output.push(value),
    reportError: value => errors.push(value),
    now: NOW,
  });
  assert.equal(status, 1);
  assert.equal(queries, 1);
  assert.deepEqual(output, []);
  assert.equal(errors.length, 1);
  assert.doesNotMatch(errors.join('\n'), /SELECT|customer@example|provider-token/);
  assert.equal(
    await runDeliveryStatus(['--help'], {
      createStore: () => {
        throw new Error('Help must not authenticate');
      },
      output: value => output.push(value),
    }),
    0
  );
});

test('status reader rejects invalid windows or clocks before querying', async () => {
  let queries = 0;
  const store = {
    query: async () => {
      queries += 1;
      return { success: true, results: [] };
    },
  };
  for (const options of [{ hours: 0 }, { hours: 169 }, { hours: 2.5 }, { now: new Date(NaN) }]) {
    await assert.rejects(readDeliveryStatus(store, options), /Invalid delivery status options/);
  }
  assert.equal(queries, 0);
});
