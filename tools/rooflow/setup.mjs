#!/usr/bin/env node
/**
 * Fresh RooFlow install from upstream (file Memory Bank variant).
 * Copies config/.roo + .roomodes, then processes placeholders.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rooflow-'));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  if ((r.status ?? 1) !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

try {
  console.log('Cloning GreatScottyMac/RooFlow…');
  run('git', ['clone', '--depth', '1', 'https://github.com/GreatScottyMac/RooFlow.git', tmp]);

  const cfg = path.join(tmp, 'config');
  fs.cpSync(path.join(cfg, '.roo'), path.join(root, '.roo'), { recursive: true, force: true });
  fs.copyFileSync(path.join(cfg, '.roomodes'), path.join(root, '.roomodes'));
  fs.copyFileSync(path.join(cfg, 'generate_mcp_yaml.py'), path.join(root, 'tools', 'rooflow', 'generate_mcp_yaml.py'));
  fs.copyFileSync(path.join(cfg, 'install_rooflow.cmd'), path.join(root, 'tools', 'rooflow', 'install_rooflow.cmd'));

  console.log('Processing prompt placeholders…');
  run('node', [path.join(root, 'tools', 'rooflow', 'process-prompts.mjs')], { cwd: root });

  // Fix rare unbracketed leftover in upstream templates
  const ws = root;
  for (const name of fs.readdirSync(path.join(root, '.roo'))) {
    if (!name.startsWith('system-prompt-flow-')) continue;
    const fp = path.join(root, '.roo', name);
    let text = fs.readFileSync(fp, 'utf8');
    const next = text.replaceAll('`WORKSPACE_PLACEHOLDER`', `\`${ws}\``).replaceAll('WORKSPACE_PLACEHOLDER', ws);
    if (next !== text) fs.writeFileSync(fp, next, 'utf8');
  }

  if (!fs.existsSync(path.join(root, 'memory-bank'))) {
    console.log('Note: create memory-bank/ via Cursor (UMB) or keep existing seed files.');
  }

  console.log('RooFlow setup complete: .roo/ + .roomodes ready.');
  console.log('Cursor uses memory-bank/ via .cursor/rules/rooflow-memory-bank.mdc');
  console.log('Flow-* modes need the Roo Code VS Code extension.');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
