import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCOUNT_ID,
  cloudflareApi,
  getCloudflareAuthHeaders,
  loadDevVars,
  loadWranglerOAuth,
  refreshWranglerOAuth,
} from './lib/cloudflare-auth.mjs';

const DATABASE_NAME = 'nika-db';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

loadDevVars();

async function authentication() {
  const headers = getCloudflareAuthHeaders({ allowOAuthToken: true });
  if (headers) return headers;
  const token = await refreshWranglerOAuth(loadWranglerOAuth());
  return { Authorization: `Bearer ${token}` };
}

async function main() {
  const auth = await authentication();
  const databases = await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/d1/database`);
  let database = databases.find(item => item.name === DATABASE_NAME);
  if (!database) {
    database = await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/d1/database`, {
      method: 'POST',
      body: JSON.stringify({ name: DATABASE_NAME }),
    });
  }
  const databaseId = database.uuid || database.id;
  if (!databaseId) throw new Error('Cloudflare did not return a D1 database identifier.');
  const schema = readFileSync(path.join(ROOT, 'migrations', '0001_chat_crm.sql'), 'utf8');
  await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/d1/database/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql: schema }),
  });
  console.log(JSON.stringify({ name: DATABASE_NAME, databaseId, migrated: true }));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
