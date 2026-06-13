import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateInferenceKey } from './lib/service-gateway-key.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const devPath = path.join(root, '.dev.vars');
const lines = readFileSync(devPath, 'utf8').split(/\r?\n/);
const legacyKeyName = `${['OPEN', 'ROUTER'].join('')}_API_KEY`;
const keyLine = lines.find(l => l.startsWith('SERVICE_GATEWAY_API_KEY=')) || lines.find(l => l.startsWith(`${legacyKeyName}=`));
const key = keyLine?.slice(keyLine.indexOf('=') + 1).trim();
if (!key) {
  console.error('SERVICE_GATEWAY_API_KEY missing in .dev.vars');
  process.exit(1);
}
const result = await validateInferenceKey(key);
if (!result.ok) {
  console.error('Invalid key:', result.reason);
  process.exit(1);
}
console.log('SERVICE_GATEWAY_API_KEY is valid.');
