import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorktrees } from './git-cleanup.mjs';

test('a later prunable record does not mark active worktrees for removal', () => {
  const output = [
    'worktree C:/PROJEKT/HUNDESALON_NIKA',
    'HEAD abc123',
    'branch refs/heads/main',
    '',
    'worktree C:/Users/snaip/.codex/worktrees/active',
    'HEAD abc123',
    'branch refs/heads/codex/audit',
    '',
    'worktree C:/Users/snaip/.codex/worktrees/missing',
    'HEAD abc123',
    'detached',
    'prunable gitdir file points to non-existent location',
    '',
  ].join('\n');

  assert.deepEqual(parseWorktrees(output), [
    { path: 'C:/PROJEKT/HUNDESALON_NIKA', branch: 'main', prunable: false, locked: false },
    { path: 'C:/Users/snaip/.codex/worktrees/active', branch: 'codex/audit', prunable: false, locked: false },
    { path: 'C:/Users/snaip/.codex/worktrees/missing', branch: '', prunable: true, locked: false },
  ]);
});

test('locked records and CRLF are preserved without confusing paths with flags', () => {
  const output =
    'worktree C:/work/prunable project\r\nHEAD abc123\r\nbranch refs/heads/feature\r\nlocked maintenance\r\n\r\n';
  assert.deepEqual(parseWorktrees(output), [
    { path: 'C:/work/prunable project', branch: 'feature', prunable: false, locked: true },
  ]);
  assert.deepEqual(parseWorktrees(''), []);
});
