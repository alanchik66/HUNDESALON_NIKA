#!/usr/bin/env node
/**
 * Sync Ponytail Cursor rule + skills from upstream DietrichGebert/ponytail.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-'));
const skills = ['ponytail', 'ponytail-review', 'ponytail-audit', 'ponytail-debt', 'ponytail-gain', 'ponytail-help'];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if ((r.status ?? 1) !== 0) throw new Error(`Failed: ${cmd}`);
}

try {
  console.log('Cloning DietrichGebert/ponytail…');
  run('git', ['clone', '--depth', '1', 'https://github.com/DietrichGebert/ponytail.git', tmp]);

  fs.mkdirSync(path.join(root, '.cursor', 'rules'), { recursive: true });
  fs.copyFileSync(
    path.join(tmp, '.cursor', 'rules', 'ponytail.mdc'),
    path.join(root, '.cursor', 'rules', 'ponytail.mdc'),
  );

  for (const name of skills) {
    const dest = path.join(root, '.agents', 'skills', name);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(path.join(tmp, 'skills', name), dest, { recursive: true });
  }

  console.log('Ponytail synced: .cursor/rules/ponytail.mdc + .agents/skills/ponytail*');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
