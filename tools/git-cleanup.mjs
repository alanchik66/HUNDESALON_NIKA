/**
 * Keep the local repo on a single-branch policy: main only.
 *
 * Removes prunable worktree metadata and local branches that are already merged
 * into main. Unmerged local branches are reported, not force-deleted.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.error?.message || result.stderr?.trim()}`);
  }
  return result.stdout.trim();
}

/** Parse each record separately so a later prunable entry cannot mark an active checkout. */
export function parseWorktrees(output) {
  return String(output || '')
    .split(/\r?\n\r?\n/)
    .map(block => {
      const lines = block.split(/\r?\n/);
      return {
        path: lines.find(line => line.startsWith('worktree '))?.slice('worktree '.length) || '',
        branch: lines.find(line => line.startsWith('branch refs/heads/'))?.slice('branch refs/heads/'.length) || '',
        prunable: lines.some(line => /^prunable(?: |$)/.test(line)),
        locked: lines.some(line => /^locked(?: |$)/.test(line)),
      };
    })
    .filter(worktree => worktree.path);
}

function cleanup() {
  const current = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (current !== 'main') {
    throw new Error(`Switch to main first (current: ${current})`);
  }

  const worktrees = parseWorktrees(git(['worktree', 'list', '--porcelain']));
  const prunable = worktrees.filter(worktree => worktree.prunable && !worktree.locked);
  for (const worktree of prunable) {
    console.log(`Prunable worktree metadata: ${worktree.path}`);
  }
  if (prunable.length) {
    // Prune stale metadata only; cleanup must never force-remove a checkout directory.
    git(['worktree', 'prune']);
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
    const inWorktree = worktrees.some(worktree => worktree.branch === name && (!worktree.prunable || worktree.locked));
    if (inWorktree) {
      console.log(`Skip branch ${name} (active worktree)`);
      continue;
    }
    if (merged.has(name)) {
      console.log(`Deleting merged local branch: ${name}`);
      console.log(git(['branch', '-d', name]));
    } else {
      kept.push(name);
    }
  }

  if (kept.length) {
    console.warn(`Unmerged local branch(es) kept for manual review: ${kept.join(', ')}`);
  }

  for (const remote of ['origin']) {
    git(['fetch', remote, '--prune']);
  }

  const remoteBranches = git(['branch', '-r'])
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(ref => !ref.includes(' -> '))
    .filter(ref => !/^origin\/main$/.test(ref));

  if (remoteBranches.length) {
    console.warn(`Remote branch(es) outside main remain: ${remoteBranches.join(', ')}`);
  }

  console.log('Cleanup finished. Remaining branches:');
  console.log(git(['branch', '-vv']));
}

const isMain = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);
if (isMain) {
  try {
    cleanup();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
