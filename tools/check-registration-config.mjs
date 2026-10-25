import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { getGoogleOAuthAccessToken } from '../functions/_lib/platform-integrations.js';

// Report presence only: never print credentials or private spreadsheet IDs.
const env = parseEnv(readFileSync('.dev.vars', 'utf8'));
for (const key of [
  'SHEET_ID',
  'GOOGLE_APPS_SCRIPT_WEBHOOK_URL',
  'GOOGLE_SHEETS_WEBHOOK_URL',
  'GOOGLE_GATEWAY_SECRET',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'GOOGLE_OAUTH_REFRESH_TOKEN',
]) {
  console.log(`${key}: ${Boolean(env[key])}`);
}

if (process.argv.includes('--probe')) {
  const token = await getGoogleOAuthAccessToken(env);
  console.log(`Google OAuth token refresh: ${token ? 'OK' : 'FAILED'}`);
  if (!token) {
    process.exitCode = 1;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: env.GOOGLE_OAUTH_CLIENT_ID || '',
        client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET || '',
        refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
        grant_type: 'refresh_token',
      }),
    });
    const result = await response.json();
    console.log(
      `OAuth diagnosis: HTTP ${response.status}; code=${String(result.error || 'unknown').replace(/[^a-z_]/g, '')}`
    );
  } else {
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set(
      'q',
      "trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and name contains 'NIKA'"
    );
    url.searchParams.set('fields', 'files(id,name),nextPageToken');
    url.searchParams.set('pageSize', '100');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json();
    console.log(`Spreadsheet metadata access: HTTP ${response.status}`);
    if (response.ok)
      console.log(
        JSON.stringify(
          result.files.map(file => ({ name: file.name, configured: file.id === env.SHEET_ID })),
          null,
          2
        )
      );
    else console.log(`Google error: ${result.error?.status || 'unknown'}`);
  }
}
