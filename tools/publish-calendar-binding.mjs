import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { ACCOUNT_ID, loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';
import { getGoogleOAuthAccessToken } from '../functions/_lib/platform-integrations.js';

if (!process.argv.includes('--apply')) throw new Error('Explicit --apply required');
const config = parseEnv(readFileSync('.dev.vars', 'utf8'));
if (!config.GOOGLE_CALENDAR_ID?.endsWith('@group.calendar.google.com')) {
  throw new Error('A dedicated secondary calendar is required');
}
const token = await getGoogleOAuthAccessToken(config);
const headers = { Authorization: `Bearer ${token}` };
const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers });
const identity = await profile.json();
if (!profile.ok || identity.email !== 'ryndenko1982@gmail.com' || !identity.verified_email) {
  throw new Error('Unexpected Google account');
}
const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.GOOGLE_CALENDAR_ID)}`;
const calendarResponse = await fetch(calendarUrl, { headers });
const calendar = await calendarResponse.json();
if (!calendarResponse.ok || calendar.summary !== 'HUNDESALON NIKA — Termine' || calendar.timeZone !== 'Europe/Berlin') {
  throw new Error('Calendar identity or timezone mismatch');
}
const aclResponse = await fetch(`${calendarUrl}/acl`, { headers });
const acl = await aclResponse.json();
const allowedUsers = new Set([config.GOOGLE_CALENDAR_ID, 'ryndenko1982@gmail.com', 'snaiper1984@gmail.com']);
if (!aclResponse.ok || !Array.isArray(acl.items) || acl.nextPageToken ||
    acl.items.some((rule) => rule.role !== 'none' && (rule.scope.type !== 'user' || !allowedUsers.has(rule.scope.value))) ||
    ['ryndenko1982@gmail.com', 'snaiper1984@gmail.com'].some((email) =>
      !acl.items.some((rule) => rule.scope.type === 'user' && rule.scope.value === email && rule.role === 'owner'))) {
  throw new Error('Private calendar with equal manager access is required');
}
await refreshWranglerOAuth(loadWranglerOAuth());
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };
delete env.CLOUDFLARE_API_TOKEN;
const result = spawnSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'pages', 'secret', 'put',
  'GOOGLE_CALENDAR_ID', '--project-name', 'hundesalon-nika',
], { input: config.GOOGLE_CALENDAR_ID, encoding: 'utf8', env });
if (result.status !== 0) throw new Error('Calendar binding update failed; CLI output withheld');
console.log('Updated GOOGLE_CALENDAR_ID after verifying privacy, both managers, and Europe/Berlin. Redeployment required.');
