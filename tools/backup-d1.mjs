import path from 'node:path';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { ACCOUNT_ID, cloudflareApi, loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';
import { protectBackupStream, verifyProtectedBackup } from './lib/protected-backup.mjs';

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

/** Download the short-lived SQL export directly into authenticated encryption. */
export async function backupD1({
  databaseId,
  outputPath,
  api,
  fetchFile = fetch,
  keyProvider,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (!UUID.test(databaseId || '') || !path.isAbsolute(outputPath || ''))
    throw new Error('Explicit database UUID and absolute output path required.');
  const repository = await fs.realpath(path.resolve(import.meta.dirname, '..'));
  await fs.mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
  const parent = await fs.realpath(path.dirname(outputPath));
  const destination = path.join(parent, path.basename(outputPath));
  const relative = path.relative(repository, destination);
  if (!relative || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) {
    throw new Error('Protected backups must remain outside the repository.');
  }
  let bookmark;
  let signedUrl;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await api(`/d1/database/${databaseId}/export`, {
      method: 'POST',
      body: JSON.stringify({ output_format: 'polling', ...(bookmark ? { current_bookmark: bookmark } : {}) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (result?.status === 'error') throw new Error('D1 export failed.');
    if (result?.status === 'complete') {
      signedUrl = result.result?.signed_url;
      break;
    }
    if (typeof result?.at_bookmark !== 'string' || !result.at_bookmark) throw new Error('Invalid D1 export response.');
    bookmark = result.at_bookmark;
    await pause(2000);
  }
  let url;
  try {
    url = new URL(signedUrl);
  } catch {
    throw new Error('D1 export did not complete.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Unsafe D1 export URL.');
  // Export URLs are bearer capabilities: never log them or attach account auth headers.
  const response = await fetchFile(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw new Error('D1 export download failed.');
  const result = await protectBackupStream({
    source: Readable.fromWeb(response.body),
    outputPath: destination,
    type: 'd1-sql',
    keyProvider,
  });
  const verified = await verifyProtectedBackup({ file: result.file, keyProvider });
  return { ...verified, databaseId, integrityVerified: true };
}

async function main() {
  const { values } = parseArgs({ options: { 'database-id': { type: 'string' }, output: { type: 'string' } } });
  const auth = await refreshWranglerOAuth(loadWranglerOAuth());
  const api = (pathname, init) => cloudflareApi(auth, `/accounts/${ACCOUNT_ID}${pathname}`, init);
  const result = await backupD1({ databaseId: values['database-id'], outputPath: values.output, api });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => {
    console.error('D1 protected backup failed; no successful backup is claimed.');
    process.exitCode = 1;
  });
}
