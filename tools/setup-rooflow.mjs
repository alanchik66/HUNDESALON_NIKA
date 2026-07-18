#!/usr/bin/env node
/**
 * Install / refresh RooFlow (.roo + .roomodes) and process workspace placeholders.
 * Memory Bank files under memory-bank/ are created if missing (never overwritten).
 * Usage: npm run rooflow:setup
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rooflow-'));

function ensureMemoryBank() {
  const dir = path.join(root, 'memory-bank');
  fs.mkdirSync(dir, { recursive: true });
  const stubs = {
    'productContext.md': '# Product Context\n\n',
    'activeContext.md': '# Active Context\n\n',
    'progress.md': '# Progress\n\n',
    'decisionLog.md': '# Decision Log\n\n',
    'systemPatterns.md': '# System Patterns\n\n',
  };
  for (const [name, body] of Object.entries(stubs)) {
    const fp = path.join(dir, name);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, body, 'utf8');
  }
}

try {
  console.log('Cloning GreatScottyMac/RooFlow…');
  execSync(`git clone --depth 1 https://github.com/GreatScottyMac/RooFlow.git "${tmp}"`, {
    stdio: 'inherit',
  });
  const cfg = path.join(tmp, 'config');
  fs.cpSync(path.join(cfg, '.roo'), path.join(root, '.roo'), { recursive: true, force: true });
  fs.copyFileSync(path.join(cfg, '.roomodes'), path.join(root, '.roomodes'));
  fs.mkdirSync(path.join(root, 'tools', 'rooflow'), { recursive: true });
  fs.copyFileSync(
    path.join(cfg, 'generate_mcp_yaml.py'),
    path.join(root, 'tools', 'rooflow', 'generate_mcp_yaml.py'),
  );
  ensureMemoryBank();
  console.log('Processing prompt placeholders…');
  const r = spawnSync('node', [path.join(root, 'tools', 'rooflow', 'process-prompts.mjs')], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if ((r.status ?? 1) !== 0) throw new Error('rooflow:process failed');
  for (const name of fs.readdirSync(path.join(root, '.roo'))) {
    if (!name.startsWith('system-prompt-flow-')) continue;
    const fp = path.join(root, '.roo', name);
    let text = fs.readFileSync(fp, 'utf8');
    const next = text.replaceAll('`WORKSPACE_PLACEHOLDER`', `\`${root}\``).replaceAll('WORKSPACE_PLACEHOLDER', root);
    if (next !== text) fs.writeFileSync(fp, next, 'utf8');
  }
  console.log('RooFlow setup complete. Cursor uses memory-bank/; Flow-* modes need Roo Code.');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
