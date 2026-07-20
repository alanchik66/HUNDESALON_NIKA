#!/usr/bin/env node
/**
 * Calibrate Cursor for minimum agent token spend across ALL agents/subagents.
 * - Slim always-on rules (already in repo) + user-level token-economy rule
 * - Graphify HTTP MCP (cheap orientation)
 * - .cursorignore for heavy artifacts
 * - Measure alwaysApply budget
 *
 * Usage: npm run tokens:calibrate
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  GRAPHIFY_MCP_PORT,
  GRAPHIFY_MCP_URL,
  isGraphifyMcpRunning,
} from './graphify-mcp-shared.mjs';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return structuredClone(fallback);
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(filePath, data) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureMeta() {
  spawnSync('node', [join(root, 'tools', 'graphify-run.mjs'), 'mcp-config'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });
}

function writeUserTokenRule() {
  const dir = join(homedir(), '.cursor', 'rules');
  mkdirSync(dir, { recursive: true });
  const path = join(dir, '00-token-economy.mdc');
  writeFileSync(
    path,
    `---
description: Global token economy for every Cursor agent (all projects)
alwaysApply: true
---

# Token economy (global)

Minimize tokens for every agent and subagent:

1. Prefer project knowledge graph / wiki / targeted search over dumping whole files.
2. Read thin (line ranges). No hello-world tours. Short replies.
3. Subagent prompts must inherit: cheap orientation first, no unrelated file dumps.
4. If the project has \`graphify-out/\` or MCP \`graphify\`, query that before broad Grep.
5. Load large skills/rules only when triggered — do not paste them into answers.
`,
    'utf8'
  );
  return path;
}

function mergeMcpHttp(targetPath) {
  const cfg = readJson(targetPath, { mcpServers: {} });
  if (!cfg.mcpServers) cfg.mcpServers = {};
  // Prefer HTTP (stable, shared) over stdio for graphify
  cfg.mcpServers.graphify = { url: GRAPHIFY_MCP_URL };
  writeJson(targetPath, cfg);
  return targetPath;
}

function ensureCursorignore() {
  const path = join(root, '.cursorignore');
  const extra = [
    'graphify-out/cache/',
    'graphify-out/graph.html',
    'graphify-out/graph.json',
    'graphify-out/obsidian/',
    'graphify-out/**/*.bak',
    '**/node_modules/',
    'dist/',
    '.wrangler/',
    'assets/images/',
    'assets/video/',
    'assets/fonts/',
    '**/*.mp4',
    '**/*.psd',
    '**/*.zip',
  ];
  let body = existsSync(path) ? readFileSync(path, 'utf8') : '';
  let changed = false;
  for (const line of extra) {
    if (!body.includes(line)) {
      body += (body.endsWith('\n') || body.length === 0 ? '' : '\n') + line + '\n';
      changed = true;
    }
  }
  if (changed) writeFileSync(path, body, 'utf8');
  return path;
}

async function ensureGraphifyHttp() {
  ensureMeta();
  if (await isGraphifyMcpRunning()) {
    console.log(`Graphify MCP up: ${GRAPHIFY_MCP_URL}`);
    return;
  }
  const serve = join(root, 'tools', 'graphify-mcp-serve.mjs');
  const child = spawn(process.execPath, [serve], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    if (await isGraphifyMcpRunning()) {
      console.log(`Graphify MCP started: ${GRAPHIFY_MCP_URL}`);
      return;
    }
  }
  console.warn('Graphify MCP did not become ready in time — check python -m graphify.serve');
}

function installAutostart() {
  if (process.platform !== 'win32') return null;
  const startup = join(
    process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'),
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    'Startup'
  );
  mkdirSync(startup, { recursive: true });
  const cmdPath = join(startup, 'HundesalonGraphifyMcp.cmd');
  const body = `@echo off\r\nstart "" /MIN "${process.execPath}" "${join(root, 'tools', 'graphify-mcp-serve.mjs')}"\r\n`;
  writeFileSync(cmdPath, body, 'utf8');
  return cmdPath;
}

function measureRules() {
  const dir = join(root, '.cursor', 'rules');
  const rows = [];
  let alwaysChars = 0;
  for (const name of readdirSync(dir).filter(n => n.endsWith('.mdc'))) {
    const text = readFileSync(join(dir, name), 'utf8');
    const always = /alwaysApply:\s*true/.test(text);
    const chars = text.length;
    const tok = Math.ceil(chars / 4);
    if (always) alwaysChars += chars;
    rows.push({ name, always, chars, tok });
  }
  return { rows, alwaysTok: Math.ceil(alwaysChars / 4), alwaysChars };
}

function patchCursorSettings() {
  const filePath = join(homedir(), 'AppData', 'Roaming', 'Cursor', 'User', 'settings.json');
  const data = readJson(filePath, {});
  // Lean defaults — do not enable Max Mode; keep browser as already calibrated
  data['cursor.composer.shouldChime'] = data['cursor.composer.shouldChime'] ?? false;
  writeJson(filePath, data);
  return filePath;
}

const userRule = writeUserTokenRule();
ensureCursorignore();
const projectMcp = mergeMcpHttp(join(root, '.cursor', 'mcp.json'));
const userMcp = mergeMcpHttp(join(homedir(), '.cursor', 'mcp.json'));
await ensureGraphifyHttp();
const task = installAutostart();
patchCursorSettings();

// Keep Flow export + wiki entry available (cheap nav)
spawnSync('node', [join(root, 'tools', 'rooflow', 'export-cursor-flow.mjs')], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

const budget = measureRules();
console.log('\n=== Token economy calibrate ===');
console.log(`User rule: ${userRule}`);
console.log(`Project MCP: ${projectMcp}`);
console.log(`User MCP: ${userMcp}`);
console.log(`Graphify MCP: ${GRAPHIFY_MCP_URL} (port ${GRAPHIFY_MCP_PORT})`);
if (task) console.log(`Autostart: ${task}`);
console.log('\nAlways-on project rules:');
for (const r of budget.rows.filter(x => x.always)) {
  console.log(`  ${r.name}  ~${r.tok} tok`);
}
console.log(`TOTAL alwaysApply ≈ ${budget.alwaysTok} tokens (target < 2000)`);
console.log('\nIf MCP panel lacks graphify: Command Palette → Developer: Reload Window (or MCP restart).');
