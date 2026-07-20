#!/usr/bin/env node
/**
 * Install / refresh RooFlow (.roo + .roomodes) from upstream, then process prompts.
 * Memory Bank stubs under memory-bank/ are created if missing (never overwritten).
 * Usage: npm run rooflow:setup
 *
 * Upstream: https://github.com/GreatScottyMac/RooFlow
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
    'productContext.md':
      '# Product Context\n\nGoals, features, and architecture for HUNDESALON_NIKA.\n\nSee also `AGENTS.md` and `docs/agents-master.md`.\n',
    'activeContext.md': '# Active Context\n\nSession status: recent changes, current goals, open questions.\n',
    'progress.md': '# Progress\n\n## Completed\n\n## Current\n\n## Next\n',
    'decisionLog.md': '# Decision Log\n\nArchitecture decisions and rationale.\n',
    'systemPatterns.md': '# System Patterns\n\nCoding, architecture, and test patterns for this repo.\n',
  };
  for (const [name, body] of Object.entries(stubs)) {
    const fp = path.join(dir, name);
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, body, 'utf8');
  }
}

function copyUtf8(src, dest) {
  const buf = fs.readFileSync(src);
  // Strip UTF-8 BOM if present; write clean UTF-8 for Roo Code / VS Code.
  const text = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? buf.slice(3).toString('utf8') : buf.toString('utf8');
  fs.writeFileSync(dest, text, 'utf8');
}

try {
  console.log('Cloning GreatScottyMac/RooFlow…');
  execSync(`git clone --depth 1 https://github.com/GreatScottyMac/RooFlow.git "${tmp}"`, {
    stdio: 'inherit',
  });
  const cfg = path.join(tmp, 'config');
  fs.cpSync(path.join(cfg, '.roo'), path.join(root, '.roo'), { recursive: true, force: true });
  copyUtf8(path.join(cfg, '.roomodes'), path.join(root, '.roomodes'));
  fs.mkdirSync(path.join(root, 'tools', 'rooflow'), { recursive: true });
  fs.copyFileSync(
    path.join(cfg, 'generate_mcp_yaml.py'),
    path.join(root, 'tools', 'rooflow', 'generate_mcp_yaml.py')
  );
  // Keep Windows helper if upstream ships it
  const winHelper = path.join(cfg, 'install_rooflow.cmd');
  if (fs.existsSync(winHelper)) {
    fs.copyFileSync(winHelper, path.join(root, 'tools', 'rooflow', 'install_rooflow.cmd'));
  }

  ensureMemoryBank();

  console.log('Processing prompt placeholders + Cursor MCP inject…');
  const r = spawnSync('node', [path.join(root, 'tools', 'rooflow', 'process-prompts.mjs')], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if ((r.status ?? 1) !== 0) throw new Error('rooflow:process failed');

  // Belt-and-suspenders: ensure absolute workspace path in prompts
  for (const name of fs.readdirSync(path.join(root, '.roo'))) {
    if (!name.startsWith('system-prompt-flow-')) continue;
    const fp = path.join(root, '.roo', name);
    let text = fs.readFileSync(fp, 'utf8');
    const next = text
      .replaceAll('`WORKSPACE_PLACEHOLDER`', `\`${root}\``)
      .replaceAll('[WORKSPACE_PLACEHOLDER]', root)
      .replaceAll('WORKSPACE_PLACEHOLDER', root);
    if (next !== text) fs.writeFileSync(fp, next, 'utf8');
  }

  // Verify critical markers
  const sample = fs.readFileSync(path.join(root, '.roo', 'system-prompt-flow-code'), 'utf8');
  if (sample.includes('# [CONNECTED_MCP_SERVERS]')) {
    throw new Error('CONNECTED_MCP_SERVERS placeholder still present after inject');
  }
  if (!sample.includes('# MCP Server list injected by script')) {
    throw new Error('MCP inject block missing after process');
  }
  const modes = fs.readFileSync(path.join(root, '.roomodes'), 'utf8');
  if (!/🌊Flow Code💻/.test(modes)) {
    console.warn('Warning: .roomodes emoji names may not have copied as UTF-8');
  }

  console.log('Exporting Cursor Flow skills (Architect/Code/Debug/Ask/Orchestrator)…');
  const ex = spawnSync('node', [path.join(root, 'tools', 'rooflow', 'export-cursor-flow.mjs')], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
  if ((ex.status ?? 1) !== 0) throw new Error('rooflow:export failed');

  console.log('RooFlow setup complete.');
  console.log('  .roo/ + .roomodes refreshed from upstream (Roo Code)');
  console.log('  memory-bank/ stubs ensured (existing files kept)');
  console.log('  Cursor: Flow-* skills in .agents/skills/flow-* + rule rooflow-memory-bank.mdc');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
