import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest as checkout } from './payment.js';
import { onRequest as webhook } from './payment-webhook.js';
import { onRequest as orderStatus } from './payment-status.js';
import { onRequest as sendmail } from './sendmail.js';
import { onRequest as confirmBooking } from './api/booking-confirm.js';
import { buildBookingConfirmationUrl } from './_lib/booking-confirmation.js';
import { getPaymentOrder } from './_lib/payment-orders.js';
import { createPaymentStatusToken } from './_lib/payment-config.js';
import { onRequest as middleware } from './_middleware.js';

const ORIGIN = 'https://hundesalon-nika.com';
const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function fixture(t, options = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const name of ['0009_delivery_tracking.sql', '0011_payment_orders.sql']) {
    sqlite.exec(readFileSync(new URL('../migrations/' + name, import.meta.url), 'utf8'));
  }
  t.after(() => sqlite.close());
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
        const result = statements.map(execute);
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const env = {
    CHAT_DB: db,
    STRIPE_MODE: 'test',
    PAYMENTS_ENVIRONMENT: 'test',
    PAYMENTS_ONLINE_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_fixture',
    STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
    STRIPE_DEPOSIT_AMOUNT_CENTS: '2000',
    SITE_ORIGIN: ORIGIN,
    SITE_NOTIFICATIONS_ENABLED: 'false',
    GOOGLE_CALENDAR_ID: 'test-calendar',
    GOOGLE_APPS_SCRIPT_WEBHOOK_URL: 'https://gateway.test/exec',
    GOOGLE_GATEWAY_SECRET: 'fixture-gateway-secret',
    SHEET_ID: 'fixture-sheet',
    SENDPULSE_API_KEY: 'fixture-email-key',
    BOOKING_RECIPIENT_EMAIL: 'salon@example.test',
    BOOKING_CONFIRM_SECRET: 'fixture-confirmation-signing-secret-32',
  };
  const calls = { stripe: [], sheets: [], email: [], confirmations: [], captcha: 0 };
  const confirmed = new Set();
  let clientFailures = options.clientFailures || 0;
  let stripeFailures = options.stripeFailures || 0;
  let confirmationFailures = options.confirmationFailures || 0;
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const target = String(url);
    if (target === 'https://api.stripe.com/v1/checkout/sessions') {
      calls.stripe.push({
        params: Object.fromEntries(new URLSearchParams(init.body)),
        key: init.headers['Idempotency-Key'],
        version: init.headers['Stripe-Version'],
      });
      if (stripeFailures-- > 0) throw new Error('Simulated Stripe network failure');
      return Response.json({
        id: 'cs_test_fixture',
        url: 'https://checkout.stripe.com/c/pay/fixture',
        livemode: false,
        amount_total: 2000,
        currency: 'eur',
      });
    }
    if (target === 'https://gateway.test/exec') {
      const body = JSON.parse(init.body);
      if (body.action === 'calendar_freebusy')
        return Response.json({
          success: true,
          busyIntervals: options.busy ? [{ start: body.timeMin, end: body.timeMax }] : [],
        });
      if (body.action === 'sheets') {
        calls.sheets.push(body);
        return Response.json({ success: true });
      }
      if (body.action === 'booking_confirm') {
        calls.confirmations.push(body);
        const deduplicated = confirmed.has(body.requestId);
        confirmed.add(body.requestId);
        return Response.json({
          success: true,
          deduplicated,
          eventId: 'booking' + body.requestId.replaceAll('-', ''),
          confirmedAt: new Date().toISOString(),
          booking: { name: 'Fixture Client', service: 'Grooming', date: futureDate(), time: '12:00' },
        });
      }
    }
    if (target === 'https://api.sendpulse.com/smtp/emails') {
      const body = JSON.parse(init.body);
      const client = body.email.to[0].email === 'client@example.test';
      if (body.email.subject.includes('appointment is confirmed') && confirmationFailures-- > 0)
        return Response.json({ result: false }, { status: 400 });
      if (client && clientFailures-- > 0) return Response.json({ result: false }, { status: 400 });
      calls.email.push(body.email);
      return Response.json({ result: true });
    }
    if (target === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
      calls.captcha += 1;
      return Response.json({ success: true });
    }
    throw new Error('Unexpected fixture network request: ' + target);
  });
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', () => {});
  globalThis.caches = { default: { match: async () => null, put: async () => {} } };
  return { env, calls, sqlite };
}

function futureDate() {
  const date = new Date(Date.now() + 2 * 86400_000);
  // Use a weekday fixture regardless of the calendar day on which CI runs.
  date.setUTCDate(date.getUTCDate() + ((2 - date.getUTCDay() + 7) % 7));
  return date.toISOString().slice(0, 10);
}

function booking(overrides = {}) {
  return {
    request_id: ORDER_ID,
    statusToken: createPaymentStatusToken(),
    form_type: 'booking',
    lang: 'en',
    name: 'Fixture Client',
    email: 'client@example.test',
    phone: '+49123456789',
    service: 'Grooming',
    date: futureDate(),
    time: '12:00',
    pet_name: 'Nika',
    pet_species: 'dog',
    pet_breed: 'Poodle',
    privacy_consent: 'on',
    agb_consent: 'on',
    payment_choice: 'online',
    client_registration_id: 'fixture-existing-client',
    ...overrides,
  };
}

async function postCheckout(env, body) {
  const context = {
    env,
    request: new Request(ORIGIN + '/payment', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  };
  return middleware({ ...context, next: () => checkout(context) });
}

async function status(env, orderId, token) {
  const context = { env, request: new Request(ORIGIN + '/payment-status?order=' + orderId + '&token=' + token) };
  return middleware({ ...context, next: () => orderStatus(context) });
}

async function eventRequest(env, type, orderId, overrides = {}) {
  const event = {
    id: 'evt_' + crypto.randomUUID().replaceAll('-', ''),
    livemode: false,
    type,
    data: {
      object: {
        id: 'cs_test_fixture',
        object: 'checkout.session',
        mode: 'payment',
        livemode: false,
        payment_status: 'paid',
        amount_total: 2000,
        currency: 'eur',
        metadata: { order_id: orderId, payment_kind: 'booking_deposit' },
        ...overrides,
      },
    },
  };
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + '.' + body));
  const signature = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return webhook({
    env,
    request: new Request(ORIGIN + '/payment-webhook', {
      method: 'POST',
      headers: { 'Stripe-Signature': 't=' + timestamp + ',v1=' + signature },
      body,
    }),
  });
}

test('default production rejects test keys, and configuration GET has no network side effects', async t => {
  const { env, calls } = fixture(t);
  const response = await checkout({
    env: { ...env, STRIPE_MODE: 'live', PAYMENTS_ENVIRONMENT: '' },
    request: new Request(ORIGIN + '/payment'),
  });
  assert.equal((await response.json()).onlineEnabled, false);
  assert.equal(calls.stripe.length, 0);
  const incompleteTestMode = await checkout({
    env: { ...env, STRIPE_MODE: 'test', PAYMENTS_ENVIRONMENT: '', STRIPE_SECRET_KEY: 'sk_live_fixture' },
    request: new Request(ORIGIN + '/payment'),
  });
  assert.equal((await incompleteTestMode.json()).onlineEnabled, false);
  assert.equal((await checkout({ env, request: new Request(ORIGIN + '/payment') })).status, 200);
  assert.equal(calls.stripe.length, 0);
});

test('durable Checkout validates consents and busy slots before contacting Stripe', async t => {
  const { env, calls } = fixture(t, { busy: true });
  assert.equal((await postCheckout(env, booking({ privacy_consent: '' }))).status, 400);
  assert.equal((await postCheckout(env, booking({ time: '18:30' }))).status, 400);
  assert.equal((await postCheckout(env, booking())).status, 409);
  assert.equal(calls.stripe.length, 0);
});

test('configured Turnstile is required before a new Checkout order', async t => {
  const { env, calls } = fixture(t);
  env.TURNSTILE_SECRET_KEY = 'fixture-turnstile-secret';
  assert.equal((await postCheckout(env, booking())).status, 400);
  assert.equal(calls.stripe.length, 0);
  assert.equal((await postCheckout(env, booking({ 'cf-turnstile-response': 'fixture-token' }))).status, 200);
  assert.equal(calls.captcha, 1);
});

test('Checkout retries require the order token and immutable data; reload can resume without PII', async t => {
  const { env, calls } = fixture(t, { stripeFailures: 1 });
  const fields = booking();
  assert.equal((await postCheckout(env, fields)).status, 503);
  const before = await (await status(env, fields.request_id, fields.statusToken)).json();
  assert.equal(before.retryable, true);
  const denied = await postCheckout(env, {
    request_id: fields.request_id,
    statusToken: createPaymentStatusToken(),
    resume: true,
  });
  assert.equal(denied.status, 409);
  const resumed = await postCheckout(env, {
    request_id: fields.request_id,
    statusToken: fields.statusToken,
    resume: true,
  });
  assert.equal(resumed.status, 200);
  assert.equal((await resumed.json()).orderId, fields.request_id);
  assert.equal(calls.stripe.length, 2);
  assert.equal(calls.stripe[0].key, calls.stripe[1].key);
  assert.deepEqual(calls.stripe[0].params, calls.stripe[1].params);
  assert.equal((await postCheckout(env, { ...fields, service: 'Different service' })).status, 409);
  assert.equal(calls.stripe.length, 2);
});

test('payment to webhook to staff confirmation works once without a browser return', async t => {
  const { env, calls, sqlite } = fixture(t);
  const fields = booking({ amount: 1, amountCents: 1 });
  const created = await postCheckout(env, fields);
  assert.equal(created.status, 200);
  const result = await created.json();
  assert.equal(result.statusToken, fields.statusToken);
  assert.equal(calls.stripe[0].params['metadata[order_id]'], fields.request_id);
  assert.equal(calls.stripe[0].version, '2026-06-24.dahlia');
  assert.equal(calls.stripe[0].params['payment_method_types[0]'], 'card');
  assert.equal(calls.stripe[0].params['payment_method_types[1]'], 'link');
  assert.equal(
    calls.stripe[0].params['line_items[0][price_data][product_data][name]'],
    'Booking deposit HUNDESALON_NIKA'
  );
  assert.equal(Object.hasOwn(calls.stripe[0].params, 'metadata[email]'), false);
  assert.equal((await status(env, fields.request_id, createPaymentStatusToken())).status, 403);
  assert.equal(
    (await eventRequest(env, 'checkout.session.completed', fields.request_id, { amount_total: 100 })).status,
    400
  );
  assert.equal((await getPaymentOrder(env, fields.request_id)).paymentStatus, 'pending');
  assert.equal(
    (await eventRequest(env, 'checkout.session.completed', fields.request_id, { livemode: true })).status,
    400
  );
  assert.equal(
    (await eventRequest(env, 'checkout.session.completed', fields.request_id, { payment_status: 'unpaid' })).status,
    200
  );
  assert.equal(calls.sheets.length, 0);
  // Two different success events for one Session can arrive at the same time.
  const concurrent = await Promise.all([
    eventRequest(env, 'checkout.session.completed', fields.request_id),
    eventRequest(env, 'checkout.session.async_payment_succeeded', fields.request_id),
  ]);
  assert.equal(
    concurrent.some(response => response.status === 200),
    true
  );
  assert.equal(
    concurrent.every(response => [200, 503].includes(response.status)),
    true
  );
  assert.equal((await eventRequest(env, 'checkout.session.async_payment_succeeded', fields.request_id)).status, 200);
  assert.equal(calls.sheets.filter(call => call.sheetName === 'bookings').length, 1);
  assert.equal(calls.email.filter(email => email.to[0].email === 'salon@example.test').length, 1);
  assert.equal(calls.email.filter(email => email.to[0].email === 'client@example.test').length, 1);
  const clientReceipt = calls.email.find(email => email.to[0].email === 'client@example.test');
  assert.match(
    clientReceipt.text,
    /Deposit received: 20\.00 EUR\. Your booking is awaiting confirmation from the salon\./
  );
  assert.doesNotMatch(
    clientReceipt.text,
    /paid_online:|cs_test_fixture|Internal reserve|Safely blocked until|Confirmation mode/
  );
  const staffReceipt = calls.email.find(email => email.to[0].email === 'salon@example.test');
  assert.match(staffReceipt.text, /paid_online:cs_test_fixture/);
  assert.match(staffReceipt.text, /Internal reserve/);
  assert.equal(calls.stripe[0].params['line_items[0][price_data][unit_amount]'], '2000');
  const paid = await (await status(env, fields.request_id, fields.statusToken)).json();
  assert.equal(paid.paymentStatus, 'paid');
  assert.equal(paid.bookingStatus, 'requested');
  assert.equal(Object.hasOwn(paid, 'checkoutUrl'), false);
  assert.equal(JSON.stringify(paid).includes('client@example.test'), false);
  const replayForm = await sendmail({
    env,
    request: new Request(ORIGIN + '/sendmail', {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, stripe_session_id: 'cs_test_fixture' }),
    }),
  });
  assert.equal(replayForm.status, 400);
  assert.equal(calls.sheets.filter(call => call.sheetName === 'bookings').length, 1);
  const confirmation = new URL(await buildBookingConfirmationUrl(env, ORIGIN, fields.request_id));
  const confirm = () =>
    confirmBooking({
      env,
      request: new Request(ORIGIN + '/api/booking-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: confirmation.searchParams.toString(),
      }),
    });
  assert.equal((await confirm()).status, 200);
  assert.equal((await confirm()).status, 200);
  const confirmed = await (await status(env, fields.request_id, fields.statusToken)).json();
  assert.equal(confirmed.bookingStatus, 'confirmed');
  assert.equal(calls.email.filter(email => email.subject.includes('appointment is confirmed')).length, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM payment_orders').get().count, 1);
});

test('a failed customer delivery retries only the missing channel and never drops a paid order when Checkout is paused', async t => {
  const { env, calls } = fixture(t, { clientFailures: 1 });
  const fields = booking();
  assert.equal((await postCheckout(env, fields)).status, 200);
  env.PAYMENTS_ONLINE_ENABLED = 'false';
  assert.equal((await eventRequest(env, 'checkout.session.completed', fields.request_id)).status, 503);
  assert.equal((await getPaymentOrder(env, fields.request_id)).paymentStatus, 'paid');
  assert.equal((await eventRequest(env, 'checkout.session.completed', fields.request_id)).status, 200);
  assert.equal(calls.sheets.filter(call => call.sheetName === 'bookings').length, 1);
  assert.equal(calls.email.filter(email => email.to[0].email === 'salon@example.test').length, 1);
  assert.equal(calls.email.filter(email => email.to[0].email === 'client@example.test').length, 1);
});

test('staff can retry a failed confirmation email without a second booking or confirmation message', async t => {
  const { env, calls } = fixture(t, { confirmationFailures: 1 });
  const fields = booking();
  assert.equal((await postCheckout(env, fields)).status, 200);
  assert.equal((await eventRequest(env, 'checkout.session.completed', fields.request_id)).status, 200);
  const confirmation = new URL(await buildBookingConfirmationUrl(env, ORIGIN, fields.request_id));
  const confirm = () =>
    confirmBooking({
      env,
      request: new Request(ORIGIN + '/api/booking-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: confirmation.searchParams.toString(),
      }),
    });
  assert.equal((await confirm()).status, 503);
  assert.equal((await getPaymentOrder(env, fields.request_id)).bookingStatus, 'confirmed');
  assert.equal((await confirm()).status, 200);
  assert.equal((await confirm()).status, 200);
  assert.equal(calls.sheets.filter(call => call.sheetName === 'bookings').length, 1);
  assert.equal(calls.email.filter(email => email.subject.includes('appointment is confirmed')).length, 1);
});

test('missing transactional email credentials keep the paid order retryable rather than claiming fulfillment', async t => {
  const { env, calls } = fixture(t);
  const fields = booking();
  assert.equal((await postCheckout(env, fields)).status, 200);
  delete env.SENDPULSE_API_KEY;
  assert.equal((await eventRequest(env, 'checkout.session.completed', fields.request_id)).status, 503);
  const order = await getPaymentOrder(env, fields.request_id);
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.fulfillmentStatus, 'pending');
  assert.equal(calls.sheets.filter(call => call.sheetName === 'bookings').length, 1);
  assert.equal(calls.email.length, 0);
  env.SENDPULSE_API_KEY = 'fixture-email-key';
  assert.equal((await eventRequest(env, 'checkout.session.async_payment_succeeded', fields.request_id)).status, 200);
  assert.equal(calls.sheets.filter(call => call.sheetName === 'bookings').length, 1);
});

for (const [lang, expected] of [
  ['de', 'Anzahlung erhalten: 20,00 EUR. Ihre Buchungsanfrage wartet auf die Bestätigung durch den Salon.'],
  ['ru', 'Предоплата получена: 20,00 EUR. Запись ожидает подтверждения салоном.'],
  ['uk', 'Передоплату отримано: 20,00 EUR. Запис очікує підтвердження салоном.'],
]) {
  test('paid client email in ' + lang + ' shows the stored deposit without internal scheduling data', async t => {
    const { env, calls } = fixture(t);
    const fields = booking({ lang, amount: 1, amountCents: 1 });
    assert.equal((await postCheckout(env, fields)).status, 200);
    assert.equal((await eventRequest(env, 'checkout.session.completed', fields.request_id)).status, 200);
    const email = calls.email.find(item => item.to[0].email === 'client@example.test');
    assert.ok(email);
    assert.equal(email.text.includes(expected), true);
    assert.doesNotMatch(
      email.text,
      /paid_online:|cs_test_fixture|Interne Reserve|Internal reserve|Внутренний резерв|Внутрішній резерв|Sicher blockiert bis|Safely blocked until|Безопасно занято до|Безпечно зайнято до/
    );
  });
}
