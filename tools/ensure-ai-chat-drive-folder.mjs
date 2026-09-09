import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientDocument = JSON.parse(
  await readFile(path.join(root, '.secrets', 'google-oauth-desktop-client.json'), 'utf8')
);
const token = JSON.parse(await readFile(path.join(root, '.secrets', 'google-oauth-token.json'), 'utf8'));
const client = clientDocument.installed ?? clientDocument.web;
const devVarsPath = path.join(root, '.dev.vars');
const wranglerPath = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: client.client_id,
    client_secret: client.client_secret,
    refresh_token: token.refresh_token,
    grant_type: 'refresh_token',
  }),
});
const tokenBody = await tokenResponse.json().catch(() => ({}));
if (!tokenResponse.ok || typeof tokenBody.access_token !== 'string') {
  throw new Error(`Google token refresh failed (HTTP ${tokenResponse.status}).`);
}

const authorization = { Authorization: `Bearer ${tokenBody.access_token}` };
const markerKey = 'hundesalonNikaPurpose';
const markerValue = 'aiChatUploads';
const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and appProperties has { key='${markerKey}' and value='${markerValue}' }`;
const listUrl = new URL('https://www.googleapis.com/drive/v3/files');
listUrl.search = new URLSearchParams({ q: query, fields: 'files(id,name)', pageSize: '10' });
const listResponse = await fetch(listUrl, { headers: authorization });
const listBody = await listResponse.json().catch(() => ({}));
if (!listResponse.ok) throw new Error(`Google Drive folder lookup failed (HTTP ${listResponse.status}).`);

let folderId = listBody.files?.[0]?.id;
let created = false;
if (!folderId) {
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
    method: 'POST',
    headers: { ...authorization, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      name: 'HUNDESALON_NIKA AI Chat Uploads',
      mimeType: 'application/vnd.google-apps.folder',
      appProperties: { [markerKey]: markerValue },
    }),
  });
  const createBody = await createResponse.json().catch(() => ({}));
  if (!createResponse.ok || typeof createBody.id !== 'string') {
    throw new Error(`Google Drive folder creation failed (HTTP ${createResponse.status}).`);
  }
  folderId = createBody.id;
  created = true;
}

function upsert(source, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(source) ? source.replace(pattern, line) : `${source.replace(/\s*$/, '')}\n${line}\n`;
}

const devVars = upsert(await readFile(devVarsPath, 'utf8').catch(() => ''), 'DRIVE_UPLOAD_FOLDER', folderId);
await writeFile(devVarsPath, devVars, { encoding: 'utf8', mode: 0o600 });

const wrangler = spawnSync(
  process.execPath,
  [wranglerPath, 'pages', 'secret', 'put', 'DRIVE_UPLOAD_FOLDER', '--project-name', 'hundesalon-nika'],
  { cwd: root, input: `${folderId}\n`, encoding: 'utf8' }
);
if (wrangler.status !== 0) {
  throw new Error(`Cloudflare rejected DRIVE_UPLOAD_FOLDER: ${wrangler.stderr || wrangler.stdout}`);
}

console.log(`Google Drive upload folder ${created ? 'created' : 'reused'}; local and Cloudflare settings updated.`);
