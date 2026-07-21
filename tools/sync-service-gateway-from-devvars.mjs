/**
 * Sync SERVICE_GATEWAY_API_KEY (+ OPENROUTER alias) from .dev.vars to Pages.
 * Windows-safe stdin (no PowerShell Get-Content corruption).
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
  lines.find(l => l.startsWith('SERVICE_GATEWAY_API_KEY=')) || lines.find(l => l.startsWith(`${legacyKeyName}=`));
if (!serviceKeyLine) throw new Error('SERVICE_GATEWAY_API_KEY missing in .dev.vars');
const newKey = serviceKeyLine.slice(serviceKeyLine.indexOf('=') + 1).trim();

if (!/^sk-or-v1-[A-Za-z0-9_-]{20,}$/.test(newKey)) {
  throw new Error('SERVICE_GATEWAY_API_KEY format looks invalid');
}

const check = await validateInferenceKey(newKey);
if (!check.ok) {
  throw new Error(`Invalid SERVICE_GATEWAY_API_KEY in .dev.vars: ${check.reason}`);
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function redact(value) {
  return String(value || '')
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, 'sk-or-v1-<redacted>')
    .replace(/re_[A-Za-z0-9_-]+/g, 're_<redacted>');
}

function putSecret(name) {
  const result = spawnSync(
    npxCommand,
    ['wrangler', 'pages', 'secret', 'put', name, '--project-name=hundesalon-nika'],
    {
      cwd: root,
      input: `${newKey}\n`,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      env: { ...process.env, CLOUDFLARE_API_TOKEN: '' },
    }
  );
  if (result.status !== 0) {
    const detail = redact(result.stderr || result.stdout || result.error || result.status);
    throw new Error(`${name} put failed: ${detail}`);
  }
  console.log(`Synced ${name} to Cloudflare Pages`);
}

putSecret('SERVICE_GATEWAY_API_KEY');
putSecret(legacyKeyName);
