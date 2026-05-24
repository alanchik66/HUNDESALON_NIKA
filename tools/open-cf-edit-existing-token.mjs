/**
 * Open existing NIKA-Purge-Cache token edit page in default Edge (normal profile, not CDP).
 * npm run cf:open-edit-token
 */
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { EXISTING_PURGE_TOKEN_ID } from './lib/cf-api-token.mjs';

const TOKEN_ID = EXISTING_PURGE_TOKEN_ID;
const url = `https://dash.cloudflare.com/profile/api-tokens/${TOKEN_ID}/edit`;

const edgeCandidates = [
  path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(existsSync);

console.log('Add permission: Zone → Zone Rules → Edit');
console.log('Then save → npm run cf:ensure-api-token\n');
console.log(url);

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
