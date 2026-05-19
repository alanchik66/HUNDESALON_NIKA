/**
 * Push local main to GitHub (origin) and mirror to GitLab (gitlab).
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
let mirror = spawnSync('git', ['push', 'gitlab', 'main'], { encoding: 'utf8', shell: true });
let mirrorOut = `${mirror.stdout || ''}${mirror.stderr || ''}`.trim();
if (mirrorOut) console.log(mirrorOut);
if (mirror.status !== 0) {
  console.warn('GitLab fast-forward push failed, retrying with --force-with-lease…');
  mirror = spawnSync('git', ['push', 'gitlab', 'main', '--force-with-lease'], {
    encoding: 'utf8',
    shell: true,
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
console.log('Done. Cloudflare Pages deploys from GitHub main (or: npm run deploy).');
