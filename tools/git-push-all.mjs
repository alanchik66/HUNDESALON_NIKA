/**
 * Push local main to GitHub and GitLab, then verify parity.
 *
 * Branch policy: keep only main on both remotes. If GitHub Actions is blocked
 * by billing or policy, GitLab main and direct Cloudflare deploy remain usable.
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

console.log('→ GitLab (mirror main)');
run('git', ['fetch', 'gitlab']);
let mirror = spawnSync('git', ['push', 'gitlab', 'main'], { encoding: 'utf8' });
let mirrorOut = `${mirror.stdout || ''}${mirror.stderr || ''}`.trim();
if (mirrorOut) console.log(mirrorOut);
if (mirror.status !== 0) {
  console.warn('GitLab fast-forward push failed, retrying with --force-with-lease…');
  mirror = spawnSync('git', ['push', 'gitlab', 'main', '--force-with-lease'], {
    encoding: 'utf8',
  });
  mirrorOut = `${mirror.stdout || ''}${mirror.stderr || ''}`.trim();
  if (mirrorOut) console.log(mirrorOut);
}
if (mirror.status !== 0) {
  console.warn('');
  console.warn('GitLab mirror failed. See docs/git-workflow.md (protected main / force push).');
  process.exit(mirror.status);
}

console.log('');
console.log('→ Verify remote parity');
for (const remote of ['origin', 'gitlab']) {
  run('git', ['fetch', remote]);
}
const local = spawnSync('git', ['rev-parse', 'main'], { encoding: 'utf8' }).stdout.trim();
for (const ref of ['origin/main', 'gitlab/main']) {
  const remoteSha = spawnSync('git', ['rev-parse', ref], { encoding: 'utf8' }).stdout.trim();
  if (remoteSha !== local) {
    console.error(`${ref} mismatch: ${remoteSha.slice(0, 7)} != ${local.slice(0, 7)}`);
    process.exit(1);
  }
  console.log(`${ref}: ${remoteSha.slice(0, 7)} OK`);
}

console.log('');
console.log('Done. GitHub and GitLab main are aligned. Deploy with: npm run deploy:full');
