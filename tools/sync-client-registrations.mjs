import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { ACCOUNT_ID, cloudflareApi, loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';
import { getGoogleOAuthAccessToken, appendGoogleSheetRow } from '../functions/_lib/platform-integrations.js';

// Read-only by default. Recovery uses the request ID in column B to avoid duplicate rows.
const env = parseEnv(readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8'));
const auth = await refreshWranglerOAuth(loadWranglerOAuth());
const databaseId = 'b95aa18e-fca6-408b-91f9-8e262b6acf41';
const query = async (sql, params = []) => {
  const result = await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/d1/database/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  });
  if (!result[0]?.success) throw new Error('Registration store query failed');
  return result[0].results;
};
const rows = await query(
  'SELECT request_id, values_json FROM client_registrations WHERE sheet_synced_at IS NULL ORDER BY created_at LIMIT 25'
);
console.log(JSON.stringify({ pendingBatch: rows.length, applying: process.argv.includes('--apply') }));
if (process.argv.includes('--apply') && rows.length) {
  const token = await getGoogleOAuthAccessToken(env);
  if (!token || !env.SHEET_ID)
    throw new Error('Google authorization must be restored before replay; stored registrations remain safe.');
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.SHEET_ID)}/values/clients!B:B`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!response.ok) throw new Error(`Google mirror read failed: HTTP ${response.status}`);
  const sheet = await response.json();
  const existing = new Set((sheet.values || []).map(row => row[0]));
  for (const row of rows) {
    if (!existing.has(row.request_id)) {
      const result = await appendGoogleSheetRow(env, {
        spreadsheetId: env.SHEET_ID,
        sheetName: 'clients',
        values: JSON.parse(row.values_json),
      });
      if (!result.ok) throw new Error('Google mirror write failed; replay stopped without dropping stored records.');
      existing.add(row.request_id);
    }
    await query(
      'UPDATE client_registrations SET sheet_synced_at = ?, sync_attempts = sync_attempts + 1, last_attempt_at = ? WHERE request_id = ?',
      [new Date().toISOString(), new Date().toISOString(), row.request_id]
    );
  }
  console.log(JSON.stringify({ synced: rows.length }));
}
