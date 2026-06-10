/**
 * Remove stale local branches and optional prunable worktrees (keeps main + current worktree).
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
  spawnSync('git', ['worktree', 'remove', path, '--force'], { stdio: 'inherit', shell: true });
}

const extraWorktrees = [
  'C:/laragon/www/HUNDESALON_NIKA.worktrees/agents-css-js-minification-explained',
];
for (const wtPath of extraWorktrees) {
  const listed = spawnSync('git', ['worktree', 'list'], { encoding: 'utf8' }).stdout;
  if (!listed.includes(wtPath.replace(/\//g, '/'))) continue;
  console.log(`Removing worktree: ${wtPath}`);
  spawnSync('git', ['worktree', 'remove', wtPath, '--force'], { stdio: 'inherit', shell: true });
}

const staleBranches = ['sync/gitlab-main', 'reconcile', 'agents/css-js-minification-explained'];
for (const name of staleBranches) {
  const exists = spawnSync('git', ['show-ref', '--verify', `refs/heads/${name}`], { encoding: 'utf8' });
  if (exists.status !== 0) continue;
  const inWorktree = spawnSync('git', ['worktree', 'list'], { encoding: 'utf8' }).stdout.includes(`[${name}]`);
  if (inWorktree) {
    console.log(`Skip branch ${name} (active worktree)`);
    continue;
  }
  console.log(`Deleting local branch: ${name}`);
  spawnSync('git', ['branch', '-D', name], { stdio: 'inherit', shell: true });
}

console.log('Cleanup finished. Remaining branches:');
console.log(git(['branch', '-vv']));
