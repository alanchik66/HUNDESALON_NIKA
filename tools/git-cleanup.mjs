/**
 * Keep the local repo on a single-branch policy: main only.
 *
 * Removes prunable worktree metadata and local branches that are already merged
 * into main. Unmerged local branches are reported, not force-deleted.
 */
import { spawnSync } from 'node:child_process';

function git(args) {
  return spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();
}

const worktrees = git(['worktree', 'list', '--porcelain']);
const prunable = [];
for (const line of worktrees.split(/\r?\n/)) {
  if (line.startsWith('worktree ')) {
    const path = line.slice('worktree '.length);
    const block = worktrees.slice(worktrees.indexOf(line));
    if (block.includes('prunable')) prunable.push(path);
  }
}

for (const path of prunable) {
  console.log(`Removing prunable worktree: ${path}`);
  spawnSync('git', ['worktree', 'remove', path, '--force'], { stdio: 'inherit' });
}

const current = git(['rev-parse', '--abbrev-ref', 'HEAD']);
if (current !== 'main') {
  console.error(`Switch to main first (current: ${current})`);
  process.exit(1);
}

const branches = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
  .split(/\r?\n/)
  .map(branch => branch.trim())
  .filter(Boolean)
  .filter(branch => branch !== 'main');

const merged = new Set(
  git(['branch', '--merged', 'main'])
    .split(/\r?\n/)
    .map(line => line.replace(/^[*+]\s*/, '').trim())
    .filter(Boolean)
);

const kept = [];
for (const name of branches) {
  const inWorktree = spawnSync('git', ['worktree', 'list'], { encoding: 'utf8' }).stdout.includes(`[${name}]`);
  if (inWorktree) {
    console.log(`Skip branch ${name} (active worktree)`);
    continue;
  }
  if (merged.has(name)) {
    console.log(`Deleting merged local branch: ${name}`);
    spawnSync('git', ['branch', '-d', name], { stdio: 'inherit' });
  } else {
    kept.push(name);
  }
}

if (kept.length) {
  console.warn(`Unmerged local branch(es) kept for manual review: ${kept.join(', ')}`);
}

for (const remote of ['origin', 'github', 'gitlab']) {
  spawnSync('git', ['fetch', remote, '--prune'], { stdio: 'inherit' });
}

const remoteBranches = git(['branch', '-r'])
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .filter(ref => !ref.includes(' -> '))
  .filter(ref => !/^origin\/main$|^github\/main$|^gitlab\/main$/.test(ref));

if (remoteBranches.length) {
  console.warn(`Remote branch(es) outside main remain: ${remoteBranches.join(', ')}`);
}

console.log('Cleanup finished. Remaining branches:');
console.log(git(['branch', '-vv']));
