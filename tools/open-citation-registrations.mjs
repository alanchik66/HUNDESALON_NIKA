/**
 * Open directory registration + Google Business in Edge for citation setup.
 * npm run backlinks:open-registrations
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { BRAND_PROFILES, NAP } from '../config/brand-profiles.mjs';
import { LOCAL_DIRECTORIES } from '../config/local-directories.mjs';

const port = process.env.BING_MAIL_EDGE_PORT || '9224';
const candidates = [
  path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(existsSync);

if (!candidates.length) {
  console.error('Microsoft Edge not found.');
  process.exit(1);
}

const urls = [
  BRAND_PROFILES.googleMaps,
  'https://business.google.com/',
  ...LOCAL_DIRECTORIES.map(d => d.registerUrl),
];

const start = urls[0];
const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');

console.log('Opening citation registration URLs in Edge (port', port, ')');
console.log('NAP:', NAP.name, '·', NAP.street, '·', NAP.url);
for (const url of urls) console.log(' -', url);

spawn(
  candidates[0],
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    start,
    ...urls.slice(1),
  ],
  { detached: true, stdio: 'ignore' }
).unref();

console.log('\nIn Google Business Profile: set website to', NAP.url);
console.log('In each directory: use same NAP + link to', NAP.url);
