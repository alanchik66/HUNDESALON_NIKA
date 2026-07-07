/**
 * Full project health: local validate + build + production checks + git remote parity.
 */
import { spawnSync } from 'node:child_process';

function run(label, cmd, args, { optional = false } = {}) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'inherit' });
  if (result.error) {
    console.error(`${cmd} ${args.join(' ')} failed: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0 && !optional) {
    process.exit(result.status || 1);
  }
  return result.status === 0;
}

function runNpm(label, script) {
  if (process.platform === 'win32') {
    return run(label, process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm run ${script}`]);
  }
  return run(label, 'npm', ['run', script]);
}

runNpm('validate', 'validate');
runNpm('build', 'build:production');
runNpm('production', 'check:prod');

console.log('\n=== git remotes ===');
const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
if (branch !== 'main') {
  console.warn(`Warning: not on main (on ${branch})`);
}
for (const remote of ['origin']) {
  spawnSync('git', ['fetch', remote], { stdio: 'inherit' });
}
for (const ref of ['origin/main']) {
  const sha = spawnSync('git', ['rev-parse', ref], { encoding: 'utf8' }).stdout.trim();
  const local = spawnSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).stdout.trim();
  const ok = sha === local;
  console.log(`${ref}: ${sha.slice(0, 7)} ${ok ? 'OK' : 'MISMATCH vs main'}`);
  if (!ok) process.exitCode = 1;
}

console.log('\nAll checks completed.');
