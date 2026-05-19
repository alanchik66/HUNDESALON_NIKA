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

console.log('→ GitLab (sync/gitlab-main → MR into protected main)');
run('git', ['fetch', 'gitlab']);
run('git', ['push', 'gitlab', 'main:sync/gitlab-main', '--force-with-lease']);

if (process.env.GITLAB_TOKEN?.trim() || process.env.GL_TOKEN?.trim()) {
  console.log('→ GitLab MR merge (GITLAB_TOKEN set)');
  const mr = spawnSync('npm', ['run', 'sync:gitlab:mr'], { encoding: 'utf8', shell: true, stdio: 'inherit' });
  if (mr.status !== 0) process.exit(mr.status);
} else {
  console.log('');
  console.log('GitLab: open MR and merge (or set GITLAB_TOKEN with api scope):');
  console.log('  https://gitlab.com/hundesalon-nika/hundesalon-nika/-/merge_requests?state=opened');
  console.log('  Then: git fetch gitlab && git checkout main');
}

console.log('');
console.log('Done. Cloudflare Pages deploys from GitHub main (or: npm run deploy).');
