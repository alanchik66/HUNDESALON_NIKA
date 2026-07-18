/**
 * Delete GitHub Actions "Run failed" notification emails via Gmail MCP credentials.
 * Requires ~/.gmail-mcp/gcp-oauth.keys.json + credentials.json (npx @gongrzhe/server-gmail-autoauth-mcp auth).
 *
 * node tools/gmail-cleanup-actions-failures.mjs
 */
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const gmailMcpRoot = join(
  process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'),
  'npm',
  'node_modules',
  '@gongrzhe',
  'server-gmail-autoauth-mcp'
);
const { google } = require(join(gmailMcpRoot, 'node_modules', 'googleapis'));

const mcpDir = join(homedir(), '.gmail-mcp');
const keysPath = join(mcpDir, 'gcp-oauth.keys.json');
const credsPath = join(mcpDir, 'credentials.json');

if (!existsSync(keysPath) || !existsSync(credsPath)) {
  console.error('Missing Gmail MCP auth. Run: npx @gongrzhe/server-gmail-autoauth-mcp auth');
  process.exit(1);
}

const keys = JSON.parse(readFileSync(keysPath, 'utf8'));
const creds = JSON.parse(readFileSync(credsPath, 'utf8'));
const client = keys.installed || keys.web;
const oauth2 = new google.auth.OAuth2(
  client.client_id,
  client.client_secret,
  client.redirect_uris?.[0] || 'http://localhost:3000/oauth2callback'
);
oauth2.setCredentials(creds);
const gmail = google.gmail({ version: 'v1', auth: oauth2 });

const query =
  'from:(notifications@github.com) subject:"Run failed" newer_than:7d (subject:Cloudflare OR subject:"CI -" OR subject:Security OR subject:OSV OR "alanchik66/HUNDESALON_NIKA")';

const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100 });
const messages = list.data.messages || [];
console.log(`Found ${messages.length} failure notification(s).`);

for (const message of messages) {
  const full = await gmail.users.messages.get({
    userId: 'me',
    id: message.id,
    format: 'metadata',
    metadataHeaders: ['Subject', 'Date'],
  });
  const headers = full.data.payload?.headers || [];
  const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
  const date = headers.find((h) => h.name === 'Date')?.value || '';
  console.log(`TRASH ${subject} | ${date}`);
  // gmail.modify allows trash; permanent delete needs https://mail.google.com/
  await gmail.users.messages.trash({ userId: 'me', id: message.id });
}

console.log(`Trashed ${messages.length}.`);
