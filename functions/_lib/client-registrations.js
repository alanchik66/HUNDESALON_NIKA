import { appendGoogleSheetRow, getEnvValue } from './platform-integrations.js';

/** Only acknowledge a registration after a durable write, never after a notification. */
export async function storeClientRegistration(env, { requestId, values }) {
  if (!env.CHAT_DB?.prepare) return { ok: false };
  try {
    const result = await env.CHAT_DB.prepare(
      'INSERT INTO client_registrations (request_id, created_at, values_json) VALUES (?, ?, ?)'
    )
      .bind(requestId, new Date().toISOString(), JSON.stringify(values))
      .run();
    return { ok: result?.success === true && result?.meta?.changes === 1 };
  } catch {
    console.error(JSON.stringify({ event: 'client_registration_store_failed', request_id: requestId }));
    return { ok: false };
  }
}

/** Retain failed mirrors for recovery; never log the customer's stored values. */
export async function syncClientRegistration(env, { requestId, values }) {
  let result;
  try {
    result = await appendGoogleSheetRow(env, {
      spreadsheetId: getEnvValue(env, 'SHEET_ID'),
      sheetName: 'clients',
      values,
    });
  } catch {
    result = { ok: false };
  }
  const syncedAt = result?.ok === true ? new Date().toISOString() : null;
  try {
    await env.CHAT_DB.prepare(
      `UPDATE client_registrations SET sheet_synced_at = ?, sync_attempts = sync_attempts + 1,
       last_attempt_at = ? WHERE request_id = ?`
    )
      .bind(syncedAt, new Date().toISOString(), requestId)
      .run();
  } catch {
    console.error(JSON.stringify({ event: 'client_registration_sync_tracking_failed', request_id: requestId }));
  }
  if (!syncedAt) console.warn(JSON.stringify({ event: 'client_registration_mirror_pending', request_id: requestId }));
  return result;
}
