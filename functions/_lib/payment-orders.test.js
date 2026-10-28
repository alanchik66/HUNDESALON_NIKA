import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  attachCheckoutSession,
  claimPaymentJob,
  completePaymentFulfillment,
  completePaymentJob,
  createPaymentOrder,
  ensurePaymentJobs,
  getOrderBySession,
  getPaymentOrder,
  listPaymentJobs,
  markPaymentBookingConfirmed,
  releasePaymentFulfillment,
  releasePaymentJob,
  reservePaymentFulfillment,
} from './payment-orders.js';

const ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const NOW = Date.parse('2026-10-28T12:00:00Z');
const SESSION = 'cs_test_sessionA';
const MIGRATION = readFileSync(new URL('../../migrations/0011_payment_orders.sql', import.meta.url), 'utf8');

function database(t, { migrated = true, failBatchAt = -1 } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys = ON;');
  if (migrated) sqlite.exec(MIGRATION);
  function execute(statement) {
    const result = sqlite.prepare(statement.sql).run(...statement.values);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            sql,
            values,
            async run() {
              return execute(this);
            },
            async first() {
              return sqlite.prepare(sql).get(...values) || null;
            },
            async all() {
              return { results: sqlite.prepare(sql).all(...values) };
            },
          };
        },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map((statement, index) => {
          if (index === failBatchAt) throw new Error('Private customer@example.com token=secret');
          return execute(statement);
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sqlite, env: { CHAT_DB: db } };
}

function orderOptions(overrides = {}) {
  return {
    id: ID,
    tokenHash: 'a'.repeat(64),
    booking: {
      name: 'Test Client',
      email: 'client@example.test',
      date: '2026-11-05',
      time: '12:00',
      service: 'Grooming',
    },
    amount: 2000,
    currency: 'eur',
    mode: 'test',
    createdAt: NOW,
    expiresAt: NOW + 3600_000,
    ...overrides,
  };
}

async function attachedOrder(env, overrides = {}) {
  const options = orderOptions(overrides);
  assert.equal((await createPaymentOrder(env, options)).ok, true);
  assert.equal(
    (
      await attachCheckoutSession(env, options.id, {
        sessionId: overrides.sessionId || SESSION,
        url: 'https://checkout.stripe.com/c/pay/test-session',
      })
    ).ok,
    true
  );
}

function paymentOptions(overrides = {}) {
  return {
    orderId: ID,
    sessionId: SESSION,
    eventId: 'evt_test_one',
    amount: 2000,
    currency: 'eur',
    mode: 'test',
    now: NOW + 1000,
    ...overrides,
  };
}

test('migration is repeatable and preserves unrelated CRM data', t => {
  const { sqlite } = database(t);
  sqlite.exec("CREATE TABLE existing_crm (value TEXT); INSERT INTO existing_crm VALUES ('preserved');");
  sqlite.exec(MIGRATION);
  assert.equal(sqlite.prepare('SELECT value FROM existing_crm').get().value, 'preserved');
});

test('persists canonical booking and only a token hash, with one immutable Session binding', async t => {
  const { env, sqlite } = database(t);
  await attachedOrder(env);
  const row = await getPaymentOrder(env, ID);
  assert.deepEqual(row.booking, orderOptions().booking);
  assert.equal(row.tokenHash, 'a'.repeat(64));
  assert.equal(row.paymentStatus, 'pending');
  assert.equal(row.bookingStatus, 'requested');
  assert.equal((await getOrderBySession(env, SESSION)).id, ID);
  assert.equal((await createPaymentOrder(env, orderOptions())).reason, 'order_already_exists');
  assert.equal(
    (await attachCheckoutSession(env, ID, { sessionId: 'cs_test_other', url: 'https://checkout.stripe.com/c/pay/new' }))
      .ok,
    false
  );
  assert.equal((await getPaymentOrder(env, ID)).sessionId, SESSION);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM payment_orders').get().count, 1);
});

test('a Checkout Session cannot be consumed by two orders', async t => {
  const { env } = database(t);
  t.mock.method(console, 'error', () => {});
  await attachedOrder(env);
  assert.equal((await createPaymentOrder(env, orderOptions({ id: OTHER_ID }))).ok, true);
  assert.equal(
    (
      await attachCheckoutSession(env, OTHER_ID, {
        sessionId: SESSION,
        url: 'https://checkout.stripe.com/c/pay/duplicate',
      })
    ).ok,
    false
  );
  assert.equal((await getOrderBySession(env, SESSION)).id, ID);
  assert.equal((await getPaymentOrder(env, OTHER_ID)).sessionId, '');
});

test('invalid order inputs and untrusted redirect hosts fail closed', async t => {
  const { env } = database(t);
  for (const invalid of [
    { id: 'attacker' },
    { tokenHash: 'raw-token' },
    { mode: 'sandbox' },
    { amount: 20.5 },
    { amount: 0 },
    { currency: 'EUR' },
    { expiresAt: NOW - 1 },
  ]) {
    assert.equal((await createPaymentOrder(env, orderOptions(invalid))).reason, 'invalid_order');
  }
  assert.equal((await createPaymentOrder(env, orderOptions())).ok, true);
  for (const url of [
    'http://checkout.stripe.com/c/pay/x',
    'https://user:password@checkout.stripe.com/c/pay/x',
    'https://checkout.stripe.com:444/c/pay/x',
    'https://checkout.stripe.com.evil.test/x',
    'https://evil.test/x',
  ]) {
    assert.equal(
      (await attachCheckoutSession(env, ID, { sessionId: SESSION, url })).reason,
      'invalid_checkout_session'
    );
  }
  assert.equal((await getPaymentOrder(env, ID)).sessionId, '');
});

test('wrong amount, mode, currency or Session never changes paid state', async t => {
  const { env } = database(t);
  await attachedOrder(env);
  for (const invalid of [{ amount: 100 }, { currency: 'usd' }, { mode: 'live' }, { sessionId: 'cs_test_wrong' }]) {
    assert.equal((await reservePaymentFulfillment(env, paymentOptions(invalid))).reason, 'payment_mismatch');
    assert.equal((await getPaymentOrder(env, ID)).paymentStatus, 'pending');
  }
});

test('simultaneous distinct event IDs for one Session have exactly one fulfillment winner', async t => {
  const { env, sqlite } = database(t);
  await attachedOrder(env);
  const contenders = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      reservePaymentFulfillment(env, paymentOptions({ eventId: `evt_${index}` }))
    )
  );
  const winners = contenders.filter(result => result.ok && result.claimToken);
  assert.equal(winners.length, 1);
  assert.equal(contenders.filter(result => result.busy).length, 11);
  const winner = winners[0];
  assert.equal(
    (await completePaymentFulfillment(env, { orderId: ID, claimToken: winner.claimToken, now: NOW + 2000 })).ok,
    true
  );
  const replay = await reservePaymentFulfillment(
    env,
    paymentOptions({ eventId: 'evt_distinct_replay', now: NOW + 3000 })
  );
  assert.equal(replay.ok, true);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.order.fulfillmentStatus, 'completed');
  assert.equal(sqlite.prepare('SELECT fulfillment_attempts AS attempts FROM payment_orders').get().attempts, 1);
});

test('an expired worker lease is recoverable and cannot release or complete its replacement', async t => {
  const { env } = database(t);
  await attachedOrder(env);
  const first = await reservePaymentFulfillment(env, paymentOptions({ leaseSeconds: 15 }));
  const second = await reservePaymentFulfillment(env, paymentOptions({ now: NOW + 17_000 }));
  assert.equal(second.ok, true);
  assert.notEqual(first.claimToken, second.claimToken);
  assert.equal(
    (await completePaymentFulfillment(env, { orderId: ID, claimToken: first.claimToken, now: NOW + 18_000 })).ok,
    false
  );
  assert.equal((await releasePaymentFulfillment(env, { orderId: ID, claimToken: first.claimToken })).ok, false);
  assert.equal(
    (await completePaymentFulfillment(env, { orderId: ID, claimToken: second.claimToken, now: NOW + 18_000 })).ok,
    true
  );
});

test('failed fulfillment can retry the same durable order without losing its paid status', async t => {
  const { env } = database(t);
  await attachedOrder(env);
  const first = await reservePaymentFulfillment(env, paymentOptions());
  assert.equal((await releasePaymentFulfillment(env, { orderId: ID, claimToken: first.claimToken })).ok, true);
  const second = await reservePaymentFulfillment(env, paymentOptions({ now: NOW + 3000 }));
  assert.equal(second.ok, true);
  assert.equal(second.order.paymentStatus, 'paid');
  assert.equal(second.order.fulfillmentAttempts, 2);
});

test('a batch failure rolls back paid state and does not leak private SQL errors', async t => {
  const { env } = database(t, { failBatchAt: 1 });
  const errors = [];
  t.mock.method(console, 'error', value => errors.push(value));
  await attachedOrder(env);
  assert.equal((await reservePaymentFulfillment(env, paymentOptions())).reason, 'payment_store_unavailable');
  const row = await getPaymentOrder(env, ID);
  assert.equal(row.paymentStatus, 'pending');
  assert.equal(row.fulfillmentStatus, 'pending');
  assert.doesNotMatch(errors.join('\n'), /customer@example|secret|Private/);
});

test('outbox jobs are unique, independently retried, and only the lease owner can acknowledge them', async t => {
  const { env } = database(t);
  await attachedOrder(env);
  assert.equal(
    (await ensurePaymentJobs(env, { orderId: ID, kinds: ['booking', 'email_client', 'booking'], now: NOW })).ok,
    true
  );
  assert.equal((await ensurePaymentJobs(env, { orderId: ID, kinds: ['booking', 'email_client'], now: NOW })).ok, true);
  assert.equal((await listPaymentJobs(env, ID)).length, 2);
  const contenders = await Promise.all(
    Array.from({ length: 8 }, () => claimPaymentJob(env, { orderId: ID, kind: 'booking', now: NOW }))
  );
  const winners = contenders.filter(result => result.ok && result.claimToken);
  assert.equal(winners.length, 1);
  assert.equal(
    (await completePaymentJob(env, { orderId: ID, kind: 'booking', claimToken: 'wrong', now: NOW + 1 })).ok,
    false
  );
  assert.equal(
    (await completePaymentJob(env, { orderId: ID, kind: 'booking', claimToken: winners[0].claimToken, now: NOW + 1 }))
      .ok,
    true
  );
  assert.equal((await claimPaymentJob(env, { orderId: ID, kind: 'booking', now: NOW + 2 })).duplicate, true);
  const email = await claimPaymentJob(env, { orderId: ID, kind: 'email_client', now: NOW });
  assert.equal(
    (
      await releasePaymentJob(env, {
        orderId: ID,
        kind: 'email_client',
        claimToken: email.claimToken,
        now: NOW,
        retryDelaySeconds: 60,
      })
    ).ok,
    true
  );
  assert.equal((await claimPaymentJob(env, { orderId: ID, kind: 'email_client', now: NOW + 59_000 })).busy, true);
  assert.equal((await claimPaymentJob(env, { orderId: ID, kind: 'email_client', now: NOW + 60_000 })).ok, true);
  assert.equal((await listPaymentJobs(env, ID)).find(job => job.kind === 'booking').state, 'completed');
});

test('outbox worker crash recovers with an expiring lease while stale completion is rejected', async t => {
  const { env } = database(t);
  await attachedOrder(env);
  await ensurePaymentJobs(env, { orderId: ID, kinds: ['email_client'], now: NOW });
  const first = await claimPaymentJob(env, { orderId: ID, kind: 'email_client', now: NOW, leaseSeconds: 15 });
  const second = await claimPaymentJob(env, { orderId: ID, kind: 'email_client', now: NOW + 16_000 });
  assert.equal(second.ok, true);
  assert.equal(
    (
      await completePaymentJob(env, {
        orderId: ID,
        kind: 'email_client',
        claimToken: first.claimToken,
        now: NOW + 17_000,
      })
    ).ok,
    false
  );
  assert.equal(
    (
      await releasePaymentJob(env, {
        orderId: ID,
        kind: 'email_client',
        claimToken: first.claimToken,
        now: NOW + 17_000,
      })
    ).ok,
    false
  );
  assert.equal(
    (
      await completePaymentJob(env, {
        orderId: ID,
        kind: 'email_client',
        claimToken: second.claimToken,
        now: NOW + 17_000,
      })
    ).ok,
    true
  );
});

test('payment alone never marks the appointment confirmed', async t => {
  const { env } = database(t);
  await attachedOrder(env);
  assert.equal(
    (await markPaymentBookingConfirmed(env, { orderId: ID, eventId: 'calendar_test_event', confirmedAt: NOW })).ok,
    false
  );
  const claim = await reservePaymentFulfillment(env, paymentOptions());
  assert.equal(
    (await completePaymentFulfillment(env, { orderId: ID, claimToken: claim.claimToken, now: NOW + 2000 })).ok,
    true
  );
  assert.equal((await getPaymentOrder(env, ID)).bookingStatus, 'requested');
  assert.equal(
    (await markPaymentBookingConfirmed(env, { orderId: ID, eventId: 'calendar_test_event', confirmedAt: NOW + 3000 }))
      .ok,
    true
  );
  assert.equal((await getPaymentOrder(env, ID)).bookingStatus, 'confirmed');
  assert.equal(
    (await markPaymentBookingConfirmed(env, { orderId: ID, eventId: '', confirmedAt: NOW + 4000 })).ok,
    false
  );
  assert.equal(
    (await markPaymentBookingConfirmed(env, { orderId: ID, eventId: 'different_event', confirmedAt: NOW + 4000 })).ok,
    false
  );
  assert.equal((await getPaymentOrder(env, ID)).calendarEventId, 'calendar_test_event');
});

test('missing storage/schema fails closed before any fulfillment acknowledgement', async t => {
  t.mock.method(console, 'error', () => {});
  assert.equal((await createPaymentOrder({}, orderOptions())).reason, 'payment_store_unavailable');
  const { env } = database(t, { migrated: false });
  assert.equal((await createPaymentOrder(env, orderOptions())).reason, 'payment_store_unavailable');
  assert.equal((await reservePaymentFulfillment(env, paymentOptions())).reason, 'payment_store_unavailable');
});
