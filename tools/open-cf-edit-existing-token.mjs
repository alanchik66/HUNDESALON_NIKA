/**
 * Open existing HUNDESALON_NIKA — Zone Ops token edit page in default Edge.
 * npm run cf:open-edit-token
 */
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { ZONE_OPS_TOKEN_ID } from './lib/cf-api-token.mjs';

const TOKEN_ID = ZONE_OPS_TOKEN_ID;
const url = `https://dash.cloudflare.com/profile/api-tokens/${TOKEN_ID}/edit`;

const edgeCandidates = [
  path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(existsSync);

console.log('Edit token: HUNDESALON_NIKA — Zone Ops');
console.log('Required permissions: Zone Read, DNS Edit, Cache Purge, Page Rules Edit, Zone Rules Edit');
console.log('Then save → npm run cf:ensure-api-token\n');
console.log('Opening Cloudflare token edit page.');

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
