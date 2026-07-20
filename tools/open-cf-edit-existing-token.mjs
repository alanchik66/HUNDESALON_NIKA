/**
 * Open existing automation token edit page (account-scoped — no account picker).
 * npm run cf:open-edit-token
 */
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { ACCOUNT_ID } from './lib/cloudflare-auth.mjs';
import { TOKEN_NAME, ZONE_OPS_TOKEN_ID } from './lib/cf-api-token.mjs';

const TOKEN_ID = ZONE_OPS_TOKEN_ID;
const url = `https://dash.cloudflare.com/${ACCOUNT_ID}/api-tokens/${TOKEN_ID}/edit`;
const profileFallback = `https://dash.cloudflare.com/profile/api-tokens/${TOKEN_ID}/edit`;

const edgeCandidates = [
  path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(existsSync);

console.log(`Edit token → rename to: ${TOKEN_NAME}`);
console.log('Add if missing: Account → Cloudflare Pages → Edit');
console.log('Keep zone: Read, DNS Edit, Cache Purge, Page Rules');
console.log('Then: npm run cf:set-api-token -- <token>\n');
console.log('Profile fallback if account URL fails:');
console.log(profileFallback);
console.log('');

if (edgeCandidates[0]) {
  exec(`"${edgeCandidates[0]}" "${url}"`, () => {});
} else {
  const start =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(start);
}
