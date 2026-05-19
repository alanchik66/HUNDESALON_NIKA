/**
 * Push local main to GitHub (canonical) and sync GitLab protected main via MR branch.
 */
import { spawnSync } from 'node:child_process';

function run(cmd, args, { allowFail = false } = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', shell: true });
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
const mirror = spawnSync('git', ['push', 'gitlab', 'main', '--force-with-lease'], {
  encoding: 'utf8',
  shell: true,
});
const mirrorOut = `${mirror.stdout || ''}${mirror.stderr || ''}`.trim();
if (mirrorOut) console.log(mirrorOut);
if (mirror.status !== 0) {
  console.warn('');
  console.warn('GitLab mirror failed (protected main?). Options:');
  console.warn('  1. Temporarily unprotect main or allow force push in GitLab Settings → Repository');
  console.warn('  2. npm run sync:gitlab:push && merge MR (legacy)');
  console.warn('  See docs/git-workflow.md');
}

console.log('');
console.log('Done. Cloudflare Pages deploys from GitHub main (or: npm run deploy).');
