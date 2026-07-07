/**
 * Push local main to GitHub, then verify parity.
 *
 * Branch policy: keep only main. GitLab mirror removed.
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args, { allowFail = false } = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  const out = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (result.status !== 0 && !allowFail) {
    throw new Error(`${cmd} ${args.join(' ')} failed:\n${out}`);
  }
  if (out) console.log(out);
  return result.status;
}

const current = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
if (current !== 'main') {
  console.error(`Switch to main first (current: ${current})`);
  process.exit(1);
}

console.log('→ GitHub (origin/main)');
run('git', ['push', 'origin', 'main']);

console.log('');
console.log('→ Verify remote parity');
run('git', ['fetch', 'origin']);
const local = spawnSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).stdout.trim();
const remoteSha = spawnSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).stdout.trim();
if (remoteSha !== local) {
  console.error(`origin/main mismatch: ${remoteSha.slice(0, 7)} != ${local.slice(0, 7)}`);
  process.exit(1);
}
console.log(`origin/main: ${remoteSha.slice(0, 7)} OK`);
console.log('\nDone. GitHub main is up-to-date. Deploy with: npm run deploy:full');
