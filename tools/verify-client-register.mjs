import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { onRequest } from '../functions/sendmail.js';
import { getGoogleOAuthAccessToken } from '../functions/_lib/platform-integrations.js';

const config = parseEnv(readFileSync('.dev.vars', 'utf8'));
// Node-only adapter for the Workers rate-limit cache; Google requests remain live.
const cacheEntries = new Map();
globalThis.caches = { default: {
  match: async key => cacheEntries.get(String(key))?.clone(),
  put: async (key, value) => { cacheEntries.set(String(key), value.clone()); },
} };
const env = Object.fromEntries(Object.entries(config).filter(([key]) => ['SHEET_ID','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET','GOOGLE_OAUTH_REFRESH_TOKEN'].includes(key)));
env.SITE_NOTIFICATIONS_ENABLED = 'false';
const marker = `QA-NIKA-${Date.now()}`;
const payload = { form_type: 'client_registration', name: marker, email: 'qa@example.invalid', lang: 'ru', service: 'QA TEST — not a booking', pet_name: 'QA test pet', pet_species: 'dog', pet_breed: 'QA test breed', privacy_consent: 'yes', agb_consent: 'yes', message: 'Technical verification only; not a real client. No appointment or notifications.', source: 'local-qa' };
const isolatedHttp = process.argv.includes('--isolated-http');
const publicHttp = process.argv.includes('--public-http');
if (publicHttp) {
  payload.source = 'production-qa';
  payload.message = 'QA-NIKA: technical verification only, not a real client or appointment. Any notification is a system test.';
}
const request = new Request(publicHttp ? 'https://hundesalon-nika.com/sendmail' : `http://127.0.0.1:${isolatedHttp ? 8789 : 8788}/sendmail`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: publicHttp ? 'https://hundesalon-nika.com' : 'http://127.0.0.1:5502' }, body: JSON.stringify(payload) });
const http = process.argv.includes('--http');
if (http && (config.SITE_NOTIFICATIONS_ENABLED === 'true' || ['SENDPULSE_API_KEY','SENDPULSE_CLIENT_ID','AUTOMATION_WEBHOOK_URL'].some(key => config[key]))) {
  throw new Error('HTTP QA blocked: notification configuration requires isolation');
}
const response = http || isolatedHttp || publicHttp ? await fetch(request) : await onRequest({ request, env, waitUntil: promise => promise.catch(()=>{}) });
const result = await response.json();
console.log(JSON.stringify({ handlerStatus: response.status, success: result.success }));
if (!response.ok || !result.success) process.exit(1);
const token = await getGoogleOAuthAccessToken(env);
const read = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/clients!A1:Y20`, { headers: { Authorization: `Bearer ${token}` } });
const data = await read.json();
const saved = data.values?.some(row => row[10] === marker && row[3] === 'client_registration');
console.log(JSON.stringify({ readStatus: read.status, savedRecordVerified: Boolean(saved), marker }));
if (!saved) process.exit(1);
