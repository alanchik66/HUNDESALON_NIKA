/**
 * Full project health: local validate + build + production checks + git remote parity.
 */
import { spawnSync } from 'node:child_process';

function run(label, cmd, args, { optional = false } = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, args, { encoding: 'utf8', shell: true, stdio: 'inherit' });
  if (result.status !== 0 && !optional) {
    process.exit(result.status || 1);
  }
  return result.status === 0;
}

run('validate', 'npm', ['run', 'validate']);
run('build', 'npm', ['run', 'build:production']);
run('production', 'npm', ['run', 'check:prod']);

console.log('\n=== git remotes ===');
const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
if (branch !== 'main') {
  console.warn(`Warning: not on main (on ${branch})`);
}
spawnSync('git', ['fetch', 'origin'], { shell: true, stdio: 'inherit' });
spawnSync('git', ['fetch', 'gitlab'], { shell: true, stdio: 'inherit' });
for (const ref of ['origin/main', 'gitlab/main']) {
  const sha = spawnSync('git', ['rev-parse', ref], { encoding: 'utf8' }).stdout.trim();
  const local = spawnSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).stdout.trim();
  const ok = sha === local;
  console.log(`${ref}: ${sha.slice(0, 7)} ${ok ? 'OK' : 'MISMATCH vs main'}`);
  if (!ok) process.exitCode = 1;
}

console.log('\nAll checks completed.');
