#!/usr/bin/env node
/**
 * Professional graphify runner for this repo.
 * Fixes Windows quirks: absolute .graphify_root, .graphify_python, PYTHONHASHSEED.
 *
 * Usage:
 *   node tools/graphify-run.mjs setup
 *   node tools/graphify-run.mjs rebuild   # full code-only rebuild + cluster + html
 *   node tools/graphify-run.mjs update    # incremental AST update (default after JS edits)
 *   node tools/graphify-run.mjs report    # re-cluster + GRAPH_REPORT.md + graph.html
 *   node tools/graphify-run.mjs wiki      # agent-crawlable wiki under graphify-out/wiki/
 *   node tools/graphify-run.mjs mcp-config  # write graphify MCP into .cursor/mcp.json
 *   node tools/graphify-run.mjs query "…"
 *   node tools/graphify-run.mjs path "A" "B"
 *   node tools/graphify-run.mjs explain "X"
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'graphify-out');
const cmd = process.argv[2] || 'update';
const rest = process.argv.slice(3);

function resolvePython() {
  try {
    const out = execSync(
      'uv tool run --from graphifyy python -c "import sys,graphify; print(sys.executable)"',
      { encoding: 'utf8', cwd: root, shell: true }
    ).trim();
    if (out && existsSync(out)) return out;
  } catch {
    // fall through
  }
  for (const candidate of [
    join(homedir(), 'AppData', 'Roaming', 'uv', 'tools', 'graphifyy', 'Scripts', 'python.exe'),
    'python',
    'python3',
  ]) {
    try {
      execSync(`"${candidate}" -c "import graphify"`, { stdio: 'ignore', shell: true });
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error('graphifyy Python not found. Install: uv tool install graphifyy');
}

function ensureMeta() {
  mkdirSync(outDir, { recursive: true });
  // Official skill expects absolute scan root — CLI often writes "." on Windows.
  writeFileSync(join(outDir, '.graphify_root'), root, 'utf8');
  const py = resolvePython();
  writeFileSync(join(outDir, '.graphify_python'), py, 'utf8');
  return py;
}

function runGraphify(args) {
  ensureMeta();
  const env = {
    ...process.env,
    PYTHONHASHSEED: '0',
    MCP_PROJECT_PATH: root,
  };
  if (process.platform === 'win32' && !process.env.GRAPHIFY_MAX_WORKERS) {
    env.GRAPHIFY_MAX_WORKERS = '1';
  }

  const cmdline = ['graphify', ...args].map(a => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
  console.log(cmdline);
  execSync(cmdline, { cwd: root, stdio: 'inherit', env });
  // Re-assert absolute root after CLI may overwrite with "."
  writeFileSync(join(outDir, '.graphify_root'), root, 'utf8');
}

const GRAPHIFY_RULE = `---
description: graphify knowledge graph — query-first (token-cheap orientation)
alwaysApply: true
---

# Graphify

Map: \`graphify-out/\` (wrappers: \`tools/graphify-run.mjs\`).

**Before broad exploration:** MCP \`graphify\` → else \`npm run graphify:query -- "…"\` / \`node tools/graphify-run.mjs path|explain\` → else \`graphify-out/wiki/index.md\`.

Never paste full \`graph.json\`. After JS/tools edits: \`npm run graphify:update\`. Setup: \`npm run graphify:setup\`. MCP HTTP: \`npm run mcp:graphify\` (\`http://127.0.0.1:8932/mcp\`).
`;

function writeGraphifyRule() {
  const rulePath = join(root, '.cursor', 'rules', 'graphify.mdc');
  mkdirSync(dirname(rulePath), { recursive: true });
  writeFileSync(rulePath, GRAPHIFY_RULE, 'utf8');
  return rulePath;
}

function mcpConfig() {
  ensureMeta();
  const mcpPath = join(root, '.cursor', 'mcp.json');
  let cfg = { mcpServers: {} };
  if (existsSync(mcpPath)) {
    try {
      cfg = JSON.parse(readFileSync(mcpPath, 'utf8'));
    } catch {
      cfg = { mcpServers: {} };
    }
  }
  if (!cfg.mcpServers || typeof cfg.mcpServers !== 'object') cfg.mcpServers = {};
  // HTTP MCP (token-cheap queries; same pattern as Playwright on 8931)
  cfg.mcpServers.graphify = {
    url: 'http://127.0.0.1:8932/mcp',
  };
  mkdirSync(dirname(mcpPath), { recursive: true });
  writeFileSync(mcpPath, `${JSON.stringify(cfg, null, 2)}\n`, 'utf8');
  console.log(`Wrote graphify MCP → ${mcpPath}`);
  console.log('  url: http://127.0.0.1:8932/mcp  (start: npm run mcp:graphify)');
}

function wiki() {
  ensureMeta();
  // cluster-only refreshes analysis sidecars needed by wiki export
  runGraphify(['cluster-only', '.', '--no-label']);
  runGraphify(['export', 'wiki']);
}

function setup() {
  ensureMeta();
  try {
    execSync('uv tool install --upgrade "graphifyy[mcp]"', {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
  } catch {
    console.warn('Could not upgrade graphifyy[mcp] via uv — MCP may need: pip install "graphifyy[mcp]"');
  }
  console.log('Installing Cursor project skill + post-commit hook…');
  runGraphify(['cursor', 'install', '--project']);
  runGraphify(['hook', 'install']);
  // Official `cursor install` overwrites .cursor/rules/graphify.mdc — restore project rule.
  const rulePath = writeGraphifyRule();
  console.log(`Restored project rule: ${rulePath}`);
  mcpConfig();
  console.log('Graphify setup complete.');
  console.log(`  root: ${root}`);
  console.log(`  python: ${resolvePython()}`);
}

function rebuild() {
  // Official headless code-only path (no LLM): extract then cluster/viz.
  runGraphify(['extract', '.', '--code-only', '--force']);
  runGraphify(['cluster-only', '.', '--no-label']);
}

function update() {
  runGraphify(['update', '.', '--force']);
}

function report() {
  runGraphify(['cluster-only', '.', '--no-label']);
}

switch (cmd) {
  case 'setup':
    setup();
    break;
  case 'rebuild':
  case 'extract':
    rebuild();
    break;
  case 'update':
    update();
    break;
  case 'report':
  case 'cluster':
    report();
    break;
  case 'wiki':
    wiki();
    break;
  case 'mcp-config':
    mcpConfig();
    break;
  case 'query':
  case 'path':
  case 'explain':
  case 'diagnose':
  case 'affected':
    runGraphify([cmd, ...rest]);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error('Use: setup | rebuild | update | report | wiki | mcp-config | query | path | explain');
    process.exit(1);
}
