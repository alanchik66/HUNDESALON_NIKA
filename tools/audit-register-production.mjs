import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import {
  ACCOUNT_ID,
  cloudflareApi,
  getCloudflareAuthHeaders,
  loadWranglerOAuth,
  refreshWranglerOAuth,
} from './lib/cloudflare-auth.mjs';
import { getGoogleOAuthAccessToken } from '../functions/_lib/platform-integrations.js';

const env = parseEnv(readFileSync('.dev.vars', 'utf8'));
let auth = getCloudflareAuthHeaders({ allowOAuthToken: true });
if (!auth) auth = await refreshWranglerOAuth(loadWranglerOAuth());
try {
  let project;
  try {
    project = await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/pages/projects/hundesalon-nika`);
  } catch {
    auth = await refreshWranglerOAuth(loadWranglerOAuth());
    project = await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/pages/projects/hundesalon-nika`);
  }
  const vars = project.deployment_configs?.production?.env_vars || {};
  const calendarValue = vars.GOOGLE_CALENDAR_ID?.value;
  console.log(
    JSON.stringify({
      calendarValueReturned: typeof calendarValue === 'string' && calendarValue.length > 0,
      calendarIsPrimary: calendarValue === 'primary',
      calendarMatchesAnna: calendarValue === 'ryndenko1982@gmail.com',
      calendarMatchesAlan: calendarValue === 'snaiper1984@gmail.com',
    })
  );
  console.log(
    JSON.stringify({
      integrationVariableNames: Object.keys(vars)
        .filter(key => /GOOGLE|SENDPULSE|TELEGRAM|NOTIFICATION|AUTOMATION/.test(key))
        .sort(),
    })
  );
  console.log(
    JSON.stringify(
      {
        productionBranch: project.production_branch,
        domains: project.domains,
        deployment: project.canonical_deployment?.id,
        variables: Object.fromEntries(
          [
            'SHEET_ID',
            'GOOGLE_OAUTH_CLIENT_ID',
            'GOOGLE_OAUTH_CLIENT_SECRET',
            'GOOGLE_OAUTH_REFRESH_TOKEN',
            'GOOGLE_CALENDAR_ID',
            'SENDPULSE_CLIENT_ID',
            'SENDPULSE_CLIENT_SECRET',
            'TELEGRAM_BOT_TOKEN',
            'TELEGRAM_CHAT_ID',
            'SITE_NOTIFICATIONS_ENABLED',
          ].map(key => [key, { present: Boolean(vars[key]), type: vars[key]?.type }])
        ),
        sheetMatches: vars.SHEET_ID?.type === 'plain_text' ? vars.SHEET_ID.value === env.SHEET_ID : null,
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify({
      liveDeployment: {
        sourceType: project.source?.type || null,
        triggerType: project.canonical_deployment?.deployment_trigger?.type || null,
        id: project.canonical_deployment?.id || null,
        commitHash: project.canonical_deployment?.deployment_trigger?.metadata?.commit_hash || null,
        latestStage: project.canonical_deployment?.latest_stage?.status || null,
      },
    })
  );
} catch (error) {
  console.log(`Production configuration audit: ${error.message}`);
  process.exitCode = 1;
}
const token = await getGoogleOAuthAccessToken(env);
const calendar = env.GOOGLE_CALENDAR_ID || 'primary';
const response = await fetch(
  `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendar)}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const data = await response.json();
console.log(
  JSON.stringify({
    calendarStatus: response.status,
    calendar: data.summary,
    accessRole: data.accessRole,
    timeZone: data.timeZone,
    notificationsEnabledLocally: env.SITE_NOTIFICATIONS_ENABLED === 'true',
  })
);
const date = new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10);
const live = await fetch(`https://hundesalon-nika.com/booking-availability?date=${date}`, {
  signal: AbortSignal.timeout(30000),
});
const liveBody = await live.json().catch(() => ({}));
console.log(
  JSON.stringify({ publicCalendarStatus: live.status, configured: liveBody.configured, success: liveBody.success })
);
