#!/usr/bin/env node
/**
 * Serve graphify knowledge graph over MCP Streamable HTTP (cheap agent queries).
 * Port 8932 — parallel to Playwright MCP on 8931.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  GRAPHIFY_MCP_PORT,
  GRAPHIFY_MCP_URL,
  getGraphJsonPath,
  getProjectRoot,
  isGraphifyMcpRunning,
  resolveGraphifyPython,
} from './graphify-mcp-shared.mjs';

const root = getProjectRoot();
const graphJson = getGraphJsonPath();

if (!existsSync(graphJson)) {
  console.error('Missing graphify-out/graph.json — run: npm run graphify');
  process.exit(1);
}

if (await isGraphifyMcpRunning()) {
  console.log(`Graphify MCP already listening on ${GRAPHIFY_MCP_URL}`);
  process.exit(0);
}

const py = resolveGraphifyPython();
const child = spawn(
  py,
  [
    '-m',
    'graphify.serve',
    graphJson,
    '--transport',
    'http',
    '--host',
    '127.0.0.1',
    '--port',
    String(GRAPHIFY_MCP_PORT),
    '--path',
    '/mcp',
  ],
  {
    cwd: root,
    stdio: process.stdout.isTTY ? 'inherit' : 'ignore',
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONHASHSEED: '0',
      MCP_PROJECT_PATH: root,
      GRAPHIFY_MAX_WORKERS: process.platform === 'win32' ? '1' : '4',
    },
  }
);

child.on('exit', code => process.exit(code ?? 1));
