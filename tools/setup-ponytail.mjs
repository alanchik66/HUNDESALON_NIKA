#!/usr/bin/env node
/**
 * Refresh Ponytail Cursor rule + Agent skills from upstream (DietrichGebert/ponytail).
 * Usage: npm run ponytail:setup
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ponytail-'));
const skills = [
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];

try {
  execSync(`git clone --depth 1 https://github.com/DietrichGebert/ponytail.git "${tmp}"`, {
    stdio: 'inherit',
  });
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
