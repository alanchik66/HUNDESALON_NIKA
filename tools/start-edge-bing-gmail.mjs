/**
 * Edge profile for Gmail Microsoft account — remove duplicate Bing property.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const port = process.env.BING_GMAIL_EDGE_PORT || '9225';
const loginUrl =
  'https://login.live.com/oauth20_authorize.srf?client_id=0000000048060c6a&response_type=code&scope=service::bingmaster.ms.com::MBI_SSL&redirect_uri=https%3A%2F%2Fwww.bing.com%2Fwebmasters%2F';

const candidates = [
  path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(existsSync);

if (!candidates.length) {
  console.error('Microsoft Edge not found.');
  process.exit(1);
}

const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-gmail');

console.log('Edge (Gmail profile) port', port, '— close other Edge debug on this port first');
console.log('Sign in as: snaiper1984@gmail.com');
console.log(loginUrl);

spawn(
  candidates[0],
  [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, '--no-first-run', loginUrl],
  { detached: true, stdio: 'ignore' }
).unref();

console.log('\nAfter sign-in: npm run bing:gmail-remove');
console.log('Then: npm run bing:gmail-signout');
console.log('Then: npm run bing:edge && sign in mail.ru && npm run bing:mail-setup');
