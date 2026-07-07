/**
 * Full backlink / citation pipeline.
 * npm run backlinks:complete
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args = []) {
  console.log(`\n▶ ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) console.warn(`  (exit ${r.status})`);
  return r.status ?? 1;
}

const steps = [
  () => run('npm', ['run', 'brand:profiles']),
  () => run('node', ['tools/add-partner-backlink-blocks.mjs']),
  () => run('node', ['tools/enhance-review-cta.mjs']),
  () => run('node', ['tools/local-citations-automate.mjs']),
];

for (const step of steps) step();

console.log('\nNext: npm run validate && npm run deploy:full');
console.log('Then: npm run bing:finish-all (Site Scan after meta descriptions)');
