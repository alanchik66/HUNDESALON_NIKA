import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateInferenceKey } from './lib/openrouter-key.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const devPath = path.join(root, '.dev.vars');
const lines = readFileSync(devPath, 'utf8').split(/\r?\n/);
const key = lines.find(l => l.startsWith('OPENROUTER_API_KEY='))?.slice('OPENROUTER_API_KEY='.length).trim();
if (!key) {
  console.error('OPENROUTER_API_KEY missing in .dev.vars');
  process.exit(1);
}
const result = await validateInferenceKey(key);
if (!result.ok) {
  console.error('Invalid key:', result.reason);
  process.exit(1);
}
console.log('OPENROUTER_API_KEY is valid for inference.');
