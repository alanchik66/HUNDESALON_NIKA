const REQUEST_ID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const FORM_TYPES = new Set(['booking', 'contact', 'feedback', 'client_registration']);
const CHANNELS = new Set([
  'booking_register',
  'client_register',
  'email_main',
  'email_client',
  'email_admin',
  'telegram',
  'contact_sync',
  'automation',
  'failure_alert',
  'calendar',
]);

function resultMetadata(result) {
  const state = result?.skipped === true ? 'skipped' : result?.ok === true ? 'accepted' : 'failed';
  const status = Number(result?.status ?? result?.providerStatus);
  return {
    state,
    code: state === 'failed' ? 'provider_failure' : state,
    status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0,
  };
}

/** Observability must never prevent an already validated booking or notification. */
async function writeMetadata(db, sql, params, context) {
  try {
    if (!db || typeof db.prepare !== 'function') throw new Error('Unavailable database');
    const result = await db
      .prepare(sql)
      .bind(...params)
      .run();
    if (result?.success === false || (!/^DELETE\b/.test(sql) && result?.meta?.changes === 0))
      throw new Error('Unsuccessful database write');
    return true;
  } catch {
    // Do not serialize an exception: provider and database errors can contain private data.
    console.error(JSON.stringify({ event: 'delivery_tracking_unavailable', ...context }));
    return false;
  }
}

/** "accepted" means the provider accepted the operation; it does not prove mailbox delivery. */
export function createDeliveryTracker(env, { requestId, formType, now = () => new Date() }) {
  if (!REQUEST_ID.test(requestId || '') || !FORM_TYPES.has(formType)) throw new Error('Invalid delivery context');
  const db = env?.CHAT_DB;
  const context = { request_id: requestId, form_type: formType };
  return async (channel, operation) => {
    if (!CHANNELS.has(channel) || typeof operation !== 'function') throw new Error('Invalid delivery channel');
    const id = crypto.randomUUID();
    const timestamp = now().toISOString();
    const stored = await writeMetadata(
      db,
      `INSERT INTO delivery_attempts (id, request_id, form_type, channel, state, provider_status,
        result_code, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', 0, 'pending', ?, ?)`,
      [id, requestId, formType, channel, timestamp, timestamp],
      { ...context, channel }
    );
    let metadata;
    let result;
    let failure;
    let didThrow = false;
    try {
      result = await operation();
      metadata = resultMetadata(result);
    } catch (error) {
      didThrow = true;
      failure = error;
      metadata = { state: 'failed', code: 'network_error', status: 0 };
    }
    if (stored) {
      await writeMetadata(
        db,
        `UPDATE delivery_attempts SET state = ?, provider_status = ?, result_code = ?, updated_at = ? WHERE id = ?`,
        [metadata.state, metadata.status, metadata.code, now().toISOString(), id],
        { ...context, channel }
      );
    }
    console.info(JSON.stringify({ event: 'delivery_attempt', ...context, channel, ...metadata }));
    if (didThrow) throw failure;
    return result;
  };
}

/** Retention affects this metadata ledger only, never CRM or booking records. */
export async function pruneDeliveryMetadata(env, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86400_000).toISOString();
  return writeMetadata(env?.CHAT_DB, 'DELETE FROM delivery_attempts WHERE created_at < ?', [cutoff], {});
}
