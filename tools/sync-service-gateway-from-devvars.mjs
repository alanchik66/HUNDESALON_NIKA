/**
 * Sync SERVICE_GATEWAY_API_KEY from .dev.vars to Cloudflare Pages.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateInferenceKey } from './lib/service-gateway-key.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const devPath = path.join(root, '.dev.vars');
const lines = readFileSync(devPath, 'utf8').split(/\r?\n/);
const legacyKeyName = `${['OPEN', 'ROUTER'].join('')}_API_KEY`;
const serviceKeyLine =
  lines.find(l => l.startsWith('SERVICE_GATEWAY_API_KEY=')) ||
  lines.find(l => l.startsWith(`${legacyKeyName}=`));
if (!serviceKeyLine) throw new Error('SERVICE_GATEWAY_API_KEY missing in .dev.vars');
const newKey = serviceKeyLine.slice(serviceKeyLine.indexOf('=') + 1).trim();

const check = await validateInferenceKey(newKey);
if (!check.ok) {
  throw new Error(`Invalid SERVICE_GATEWAY_API_KEY in .dev.vars: ${check.reason}`);
}

const result = spawnSync(
  'npx',
  ['wrangler', 'pages', 'secret', 'put', 'SERVICE_GATEWAY_API_KEY', '--project-name=hundesalon-nika'],
  { cwd: root, input: `${newKey}\n`, encoding: 'utf8', shell: true }
);
if (result.status !== 0) {
  throw new Error(result.stderr || result.stdout || 'wrangler secret put failed');
}
console.log('Cloudflare Pages SERVICE_GATEWAY_API_KEY synced from .dev.vars');
