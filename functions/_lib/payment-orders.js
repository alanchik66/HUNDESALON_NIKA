const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_HASH = /^[0-9a-f]{64}$/i;
const SESSION_ID = /^cs_(?:test_|live_)?[A-Za-z0-9_]{1,200}$/;
const JOB_KIND = /^[a-z][a-z0-9_]{0,63}$/;
const DEFAULT_LEASE_SECONDS = 120;

function database(env) {
  if (!env?.CHAT_DB?.prepare || !env.CHAT_DB.batch) throw new Error('Payment database unavailable');
  return env.CHAT_DB;
}

function instant(value = Date.now()) {
  const milliseconds = value instanceof Date ? value.getTime() : typeof value === 'string' ? Date.parse(value) : value;
  if (!Number.isFinite(milliseconds)) throw new Error('Invalid payment clock');
  return { milliseconds, iso: new Date(milliseconds).toISOString() };
}

function leaseUntil(now, seconds = DEFAULT_LEASE_SECONDS) {
  if (!Number.isInteger(seconds) || seconds < 15 || seconds > 600) throw new Error('Invalid payment lease');
  return now + seconds * 1000;
}

function changed(result) {
  return result?.success !== false && Number(result?.meta?.changes) === 1;
}

function orderFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tokenHash: row.token_hash,
    booking: JSON.parse(row.booking_json),
    amount: row.amount,
    currency: row.currency,
    mode: row.mode,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    sessionId: row.checkout_session_id || '',
    url: row.checkout_url || '',
    status: row.payment_status,
    paymentStatus: row.payment_status,
    paidAt: row.paid_at || '',
    eventId: row.last_event_id || '',
    fulfillmentStatus: row.fulfillment_status,
    fulfillmentAttempts: row.fulfillment_attempts,
    fulfilledAt: row.fulfilled_at || '',
    bookingStatus: row.booking_status,
    confirmedAt: row.confirmed_at || '',
    calendarEventId: row.calendar_event_id || '',
  };
}

function unavailable(operation) {
  // Exceptions may contain SQL values, customer data or upstream credentials.
  console.error(JSON.stringify({ event: 'payment_store_unavailable', operation }));
  return { ok: false, reason: 'payment_store_unavailable' };
}

export async function getPaymentOrder(env, id) {
  if (!ORDER_ID.test(id || '')) return null;
  return orderFromRow(await database(env).prepare('SELECT * FROM payment_orders WHERE id = ?').bind(id).first());
}

export async function getOrderBySession(env, sessionId) {
  if (!SESSION_ID.test(sessionId || '')) return null;
  return orderFromRow(
    await database(env).prepare('SELECT * FROM payment_orders WHERE checkout_session_id = ?').bind(sessionId).first()
  );
}

export async function createPaymentOrder(env, options) {
  try {
    const { id, tokenHash, booking, amount, currency = 'eur', mode } = options;
    const created = instant(options.createdAt);
    const expires = instant(options.expiresAt);
    if (
      !ORDER_ID.test(id || '') ||
      !TOKEN_HASH.test(tokenHash || '') ||
      !booking ||
      typeof booking !== 'object' ||
      Array.isArray(booking) ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      !/^[a-z]{3}$/.test(currency) ||
      !['test', 'live'].includes(mode) ||
      expires.milliseconds <= created.milliseconds
    )
      return { ok: false, reason: 'invalid_order' };
    const bookingJson = JSON.stringify(booking);
    if (bookingJson.length > 32 * 1024) return { ok: false, reason: 'invalid_order' };
    const result = await database(env)
      .prepare(
        `INSERT INTO payment_orders (id, token_hash, booking_json, amount, currency, mode, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`
      )
      .bind(id, tokenHash.toLowerCase(), bookingJson, amount, currency, mode, created.iso, expires.iso)
      .run();
    if (!changed(result)) return { ok: false, reason: 'order_already_exists' };
    return { ok: true, order: await getPaymentOrder(env, id) };
  } catch {
    return unavailable('create_order');
  }
}

export async function attachCheckoutSession(env, id, { sessionId, url }) {
  try {
    const parsed = new URL(url);
    if (
      !ORDER_ID.test(id || '') ||
      !SESSION_ID.test(sessionId || '') ||
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      !['checkout.stripe.com', 'buy.stripe.com'].includes(parsed.hostname)
    ) {
      return { ok: false, reason: 'invalid_checkout_session' };
    }
    const result = await database(env)
      .prepare(
        `UPDATE payment_orders SET checkout_session_id = ?, checkout_url = ?
       WHERE id = ? AND payment_status = 'pending'
       AND (checkout_session_id IS NULL OR checkout_session_id = ?)`
      )
      .bind(sessionId, parsed.toString(), id, sessionId)
      .run();
    if (!changed(result)) return { ok: false, reason: 'checkout_session_conflict' };
    return { ok: true, order: await getPaymentOrder(env, id) };
  } catch {
    return unavailable('attach_session');
  }
}

/** Claim one Checkout Session, including concurrently delivered distinct Stripe event IDs. */
export async function reservePaymentFulfillment(env, options) {
  try {
    const { orderId, sessionId, eventId = '', amount, currency, mode } = options;
    const now = instant(options.now);
    const expiry = leaseUntil(now.milliseconds, options.leaseSeconds);
    if (
      !ORDER_ID.test(orderId || '') ||
      !SESSION_ID.test(sessionId || '') ||
      !Number.isSafeInteger(amount) ||
      !['test', 'live'].includes(mode) ||
      !/^[a-z]{3}$/.test(currency || '') ||
      eventId.length > 200
    ) {
      return { ok: false, reason: 'invalid_payment' };
    }
    const claimToken = crypto.randomUUID();
    const db = database(env);
    const results = await db.batch([
      db
        .prepare(
          `UPDATE payment_orders SET payment_status = 'paid', paid_at = COALESCE(paid_at, ?), last_event_id = ?
         WHERE id = ? AND checkout_session_id = ? AND amount = ? AND currency = ? AND mode = ?`
        )
        .bind(now.iso, eventId, orderId, sessionId, amount, currency, mode),
      db
        .prepare(
          `UPDATE payment_orders SET fulfillment_status = 'processing', fulfillment_token = ?,
         fulfillment_lease_until = ?, fulfillment_attempts = fulfillment_attempts + 1
         WHERE id = ? AND checkout_session_id = ? AND amount = ? AND currency = ? AND mode = ?
         AND payment_status = 'paid' AND fulfillment_status != 'completed'
         AND (fulfillment_status != 'processing' OR fulfillment_lease_until <= ?)`
        )
        .bind(claimToken, expiry, orderId, sessionId, amount, currency, mode, now.milliseconds),
    ]);
    const order = await getPaymentOrder(env, orderId);
    if (
      !order ||
      order.sessionId !== sessionId ||
      order.amount !== amount ||
      order.currency !== currency ||
      order.mode !== mode
    ) {
      return { ok: false, reason: 'payment_mismatch' };
    }
    if (order.fulfillmentStatus === 'completed') return { ok: true, duplicate: true, order };
    if (!changed(results[1])) return { ok: false, busy: true, reason: 'fulfillment_busy', order };
    return { ok: true, duplicate: false, busy: false, order, claimToken };
  } catch {
    return unavailable('reserve_fulfillment');
  }
}

export async function completePaymentFulfillment(env, { orderId, claimToken, now = Date.now() }) {
  try {
    const clock = instant(now);
    const result = await database(env)
      .prepare(
        `UPDATE payment_orders SET fulfillment_status = 'completed', fulfillment_token = NULL,
       fulfillment_lease_until = 0, fulfilled_at = ?
       WHERE id = ? AND fulfillment_status = 'processing' AND fulfillment_token = ? AND fulfillment_lease_until > ?`
      )
      .bind(clock.iso, orderId, claimToken, clock.milliseconds)
      .run();
    return { ok: changed(result) };
  } catch {
    return unavailable('complete_fulfillment');
  }
}

export async function releasePaymentFulfillment(env, { orderId, claimToken }) {
  try {
    const result = await database(env)
      .prepare(
        `UPDATE payment_orders SET fulfillment_status = 'pending', fulfillment_token = NULL, fulfillment_lease_until = 0
       WHERE id = ? AND fulfillment_status = 'processing' AND fulfillment_token = ?`
      )
      .bind(orderId, claimToken)
      .run();
    return { ok: changed(result) };
  } catch {
    return unavailable('release_fulfillment');
  }
}

export async function ensurePaymentJobs(env, { orderId, kinds, now = Date.now() }) {
  try {
    const clock = instant(now);
    if (
      !ORDER_ID.test(orderId || '') ||
      !Array.isArray(kinds) ||
      !kinds.length ||
      kinds.length > 16 ||
      kinds.some(kind => !JOB_KIND.test(kind))
    )
      return { ok: false, reason: 'invalid_jobs' };
    const db = database(env);
    await db.batch(
      [...new Set(kinds)].map(kind =>
        db
          .prepare(
            `INSERT INTO payment_outbox (order_id, kind, created_at) VALUES (?, ?, ?)
       ON CONFLICT(order_id, kind) DO NOTHING`
          )
          .bind(orderId, kind, clock.iso)
      )
    );
    return { ok: true };
  } catch {
    return unavailable('ensure_jobs');
  }
}

export async function listPaymentJobs(env, orderId) {
  const result = await database(env)
    .prepare(
      'SELECT kind, state, attempts, created_at, completed_at FROM payment_outbox WHERE order_id = ? ORDER BY kind'
    )
    .bind(orderId)
    .all();
  return result.results || [];
}

export async function claimPaymentJob(env, { orderId, kind, now = Date.now(), leaseSeconds }) {
  try {
    if (!ORDER_ID.test(orderId || '') || !JOB_KIND.test(kind || '')) return { ok: false, reason: 'invalid_job' };
    const clock = instant(now);
    const expiry = leaseUntil(clock.milliseconds, leaseSeconds);
    const claimToken = crypto.randomUUID();
    const db = database(env);
    const result = await db
      .prepare(
        `UPDATE payment_outbox SET state = 'processing', lease_token = ?, lease_until = ?, attempts = attempts + 1
       WHERE order_id = ? AND kind = ? AND next_attempt_at <= ?
       AND (state = 'pending' OR (state = 'processing' AND lease_until <= ?))`
      )
      .bind(claimToken, expiry, orderId, kind, clock.milliseconds, clock.milliseconds)
      .run();
    if (changed(result)) return { ok: true, duplicate: false, claimToken };
    const row = await db
      .prepare('SELECT state FROM payment_outbox WHERE order_id = ? AND kind = ?')
      .bind(orderId, kind)
      .first();
    if (row?.state === 'completed') return { ok: true, duplicate: true };
    return { ok: false, busy: Boolean(row), reason: row ? 'job_busy' : 'job_not_found' };
  } catch {
    return unavailable('claim_job');
  }
}

export async function completePaymentJob(env, { orderId, kind, claimToken, now = Date.now() }) {
  try {
    const clock = instant(now);
    const result = await database(env)
      .prepare(
        `UPDATE payment_outbox SET state = 'completed', lease_token = NULL, lease_until = 0, completed_at = ?
       WHERE order_id = ? AND kind = ? AND state = 'processing' AND lease_token = ? AND lease_until > ?`
      )
      .bind(clock.iso, orderId, kind, claimToken, clock.milliseconds)
      .run();
    return { ok: changed(result) };
  } catch {
    return unavailable('complete_job');
  }
}

export async function releasePaymentJob(env, { orderId, kind, claimToken, now = Date.now(), retryDelaySeconds = 0 }) {
  try {
    const clock = instant(now);
    if (!Number.isInteger(retryDelaySeconds) || retryDelaySeconds < 0 || retryDelaySeconds > 86400) {
      return { ok: false, reason: 'invalid_retry_delay' };
    }
    const result = await database(env)
      .prepare(
        `UPDATE payment_outbox SET state = 'pending', lease_token = NULL, lease_until = 0, next_attempt_at = ?
       WHERE order_id = ? AND kind = ? AND state = 'processing' AND lease_token = ?`
      )
      .bind(clock.milliseconds + retryDelaySeconds * 1000, orderId, kind, claimToken)
      .run();
    return { ok: changed(result) };
  } catch {
    return unavailable('release_job');
  }
}

export async function markPaymentBookingConfirmed(env, { orderId, eventId = '', confirmedAt = Date.now() }) {
  try {
    const clock = instant(confirmedAt);
    if (!ORDER_ID.test(orderId || '') || typeof eventId !== 'string' || !eventId || eventId.length > 220) {
      return { ok: false, reason: 'invalid_confirmation' };
    }
    const result = await database(env)
      .prepare(
        `UPDATE payment_orders SET booking_status = 'confirmed', confirmed_at = COALESCE(confirmed_at, ?),
       calendar_event_id = COALESCE(calendar_event_id, ?)
       WHERE id = ? AND payment_status = 'paid'
       AND (calendar_event_id IS NULL OR calendar_event_id = ?)`
      )
      .bind(clock.iso, eventId, orderId, eventId)
      .run();
    return { ok: changed(result), order: await getPaymentOrder(env, orderId) };
  } catch {
    return unavailable('confirm_booking');
  }
}
