import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve('.dev.vars');
const distDir = path.resolve('dist');
const keyAssetPath = path.resolve('dist/__dev_openrouter_key.txt');

if (!fs.existsSync(source)) {
  console.log('sync-dev-vars: .dev.vars not found, skip');
  process.exit(0);
}

fs.mkdirSync(distDir, { recursive: true });

const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/);
const keyLine =
  lines.find(line =>
    line
      .replace(/^\uFEFF/, '')
      .trim()
      .startsWith('OPENROUTER_API_KEY=')
  ) || '';
fs.writeFileSync(keyAssetPath, keyLine ? `${keyLine}\n` : '', 'utf8');

console.log('sync-dev-vars: created dist/__dev_openrouter_key.txt');
