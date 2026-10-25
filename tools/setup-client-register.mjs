import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { getGoogleOAuthAccessToken } from '../functions/_lib/platform-integrations.js';

// Explicitly authorized local provisioning; never log tokens or client records.
const envPath = new URL('../.dev.vars', import.meta.url);
const env = parseEnv(await readFile(envPath, 'utf8'));
const token = await getGoogleOAuthAccessToken(env);
if (!token) throw new Error('Google authorization unavailable');
async function api(url, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Google HTTP ${response.status}: ${result.error?.status || 'request failed'}`);
  return result;
}
const profile = await api('https://www.googleapis.com/oauth2/v2/userinfo');
if (profile.email !== 'ryndenko1982@gmail.com' || !profile.verified_email) throw new Error('Wrong Google owner; no changes made');
const title = 'HUNDESALON NIKA — Clients & Bookings';
const schemas = {
  clients: ['submitted_at','request_id','language','form_type','service','service_price','service_category','promotion','reserved_1','reserved_2','client_name','email','phone','pet_name','pet_species','pet_breed','pet_age','pet_sex','pet_tag_number','notes','privacy_consent','terms_consent','source','origin','endpoint'],
  bookings: ['submitted_at','language','form_type','client_name','email','phone','service','date','time','file_url','payment_status','notes','client_registration_id','pet_name','pet_species','pet_breed','pet_age','pet_sex','pet_tag_number','service_price','service_category','booking_status','client_type','coat_condition','behaviour','duration_minutes','buffer_minutes','block_minutes','request_id','confirmation_status','reserved_1','reserved_2','start_datetime','end_datetime'],
};
let id = env.SHEET_ID;
if (!id) {
  const query = new URL('https://www.googleapis.com/drive/v3/files');
  query.searchParams.set('q', `trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and name = '${title}'`);
  query.searchParams.set('fields', 'files(id,name)');
  const existing = await api(query);
  if (existing.files.length > 1) throw new Error('Multiple registers found; refusing ambiguous target');
  id = existing.files[0]?.id;
  if (!id) {
    if (!process.argv.includes('--create')) throw new Error('Creation requires --create');
    const created = await api('https://sheets.googleapis.com/v4/spreadsheets', 'POST', {
      properties: { title, locale: 'de_DE', timeZone: 'Europe/Berlin' },
      sheets: Object.entries(schemas).map(([name, headers], index) => ({
        properties: { sheetId: index, title: name, gridProperties: { rowCount: 1000, columnCount: 52, frozenRowCount: 1 } },
        data: [{ startRow: 0, startColumn: 0, rowData: [{ values: headers.map(value => ({ userEnteredValue: { stringValue: value }, userEnteredFormat: { backgroundColor: { red: .93, green: .93, blue: .93 }, textFormat: { bold: true }, wrapStrategy: 'WRAP' } })) }], columnMetadata: headers.map(() => ({ pixelSize: 170 })), rowMetadata: [{ pixelSize: 46 }] }],
        basicFilter: { range: { sheetId: index, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: headers.length } },
      })),
    });
    id = created.spreadsheetId;
  }
  // Retain a successful create even if subsequent permission checks fail.
  let current = await readFile(envPath, 'utf8');
  const line = `SHEET_ID=${JSON.stringify(id)}`;
  current = /^SHEET_ID=.*$/m.test(current) ? current.replace(/^SHEET_ID=.*$/m, () => line) : `${current.trimEnd()}\n${line}\n`;
  await writeFile(envPath, current, { mode: 0o600 });
}
const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`;
let permissions = await api(`${base}/permissions?fields=permissions(id,type,role,emailAddress)`);
if (permissions.permissions.some(p => ['anyone','domain','group'].includes(p.type))) throw new Error('Register has unexpected sharing; no permissions changed');
if (!permissions.permissions.some(p => p.emailAddress === 'ryndenko1982@gmail.com' && p.role === 'owner')) throw new Error('Unexpected owner');
if (!permissions.permissions.some(p => p.emailAddress === 'snaiper1984@gmail.com' && ['writer','owner'].includes(p.role))) {
  if (!process.argv.includes('--share-approved')) throw new Error('Sharing requires explicit approval');
  await api(`${base}/permissions?sendNotificationEmail=false`, 'POST', { type: 'user', role: 'writer', emailAddress: 'snaiper1984@gmail.com' });
}
permissions = await api(`${base}/permissions?fields=permissions(type,role,emailAddress)`);
const metadata = await api(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=spreadsheetUrl,sheets.properties`);
console.log(JSON.stringify({ url: metadata.spreadsheetUrl, sheets: metadata.sheets.map(s=>s.properties.title), permissions: permissions.permissions }, null, 2));
