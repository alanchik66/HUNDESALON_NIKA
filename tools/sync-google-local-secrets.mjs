import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const secretsDir = join(root, '.secrets');
const adcPath = join(homedir(), 'AppData', 'Roaming', 'gcloud', 'application_default_credentials.json');
const devVarsPath = join(root, '.dev.vars');
const defaultCalendarId =
  'ddf6fc992a66cc1808cdb0b6d99594cb20b548e692b1b6778614e3fdb26b5589@group.calendar.google.com';

function upsertDevVar(key, value) {
  const lines = existsSync(devVarsPath) ? readFileSync(devVarsPath, 'utf8').split(/\r?\n/) : [];
  const prefix = `${key}=`;
  let found = false;
  const next = lines.map((line) => {
    if (!line.startsWith(prefix)) return line;
    found = true;
    return `${prefix}${value}`;
  });
  if (!found) next.push(`${prefix}${value}`);
  writeFileSync(devVarsPath, `${next.filter((line, index, all) => line.length || index < all.length - 1).join('\n')}\n`, 'utf8');
}

function main() {
  if (!existsSync(adcPath)) {
    throw new Error('gcloud ADC not found. Run: gcloud auth application-default login');
  }

  const adc = JSON.parse(readFileSync(adcPath, 'utf8'));
  if (!adc.client_id || !adc.client_secret || !adc.refresh_token) {
    throw new Error('ADC is missing client_id/client_secret/refresh_token');
  }

  mkdirSync(secretsDir, { recursive: true });
  writeFileSync(
    join(secretsDir, 'google-oauth-token.json'),
    JSON.stringify(
      {
        client_id: adc.client_id,
        refresh_token: adc.refresh_token,
        type: adc.type || 'authorized_user',
        quota_project_id: adc.quota_project_id || 'hundesalon-nika-shell-2026',
        updated_at: new Date().toISOString(),
        source: 'gcloud-adc',
      },
      null,
      2
    ),
    'utf8'
  );

  writeFileSync(
    join(secretsDir, 'google-oauth-desktop-client.json'),
    JSON.stringify(
      {
        installed: {
          client_id: adc.client_id,
          client_secret: adc.client_secret,
          redirect_uris: ['http://localhost'],
        },
      },
      null,
      2
    ),
    'utf8'
  );

  upsertDevVar('GOOGLE_OAUTH_CLIENT_ID', adc.client_id);
  upsertDevVar('GOOGLE_OAUTH_CLIENT_SECRET', adc.client_secret);
  upsertDevVar('GOOGLE_OAUTH_REFRESH_TOKEN', adc.refresh_token);
  upsertDevVar('GOOGLE_CALENDAR_ID', defaultCalendarId);

  console.log(
    JSON.stringify(
      {
        ok: true,
        secretsDir: '.secrets',
        devVars: '.dev.vars',
        calendarId: defaultCalendarId,
        note: 'Production Google secrets remain in Cloudflare Pages; local ADC synced for dev.',
      },
      null,
      2
    )
  );
}

main();
