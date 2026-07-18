#!/usr/bin/env node
/**
 * Process RooFlow .roo system-prompt templates (placeholders + optional MCP inject).
 * Requires: uv (ships with graphify install) + pyyaml via `uv run --with pyyaml`.
 */
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'tools', 'rooflow', 'generate_mcp_yaml.py');
const workspace = root;
const home = os.homedir();
const shell = process.platform === 'win32' ? 'powershell' : 'bash';
const osLabel = `${os.type()} ${os.release()}`;

const args = [
  'run',
  '--with',
  'pyyaml',
  'python',
  script,
  '--os',
  osLabel,
  '--shell',
  shell,
  '--home',
  home,
  '--workspace',
  workspace,
];

const result = spawnSync('uv', args, { cwd: root, stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
