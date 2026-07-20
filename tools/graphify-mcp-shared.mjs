#!/usr/bin/env node
/** Shared Graphify MCP HTTP constants (safe to import). */
import { createConnection } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GRAPHIFY_MCP_PORT = 8932;
export const GRAPHIFY_MCP_URL = `http://127.0.0.1:${GRAPHIFY_MCP_PORT}/mcp`;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function getProjectRoot() {
  return root;
}

export function resolveGraphifyPython() {
  const pinned = join(root, 'graphify-out', '.graphify_python');
  if (existsSync(pinned)) {
    const p = readFileSync(pinned, 'utf8').trim();
    if (p && existsSync(p)) return p;
  }
  return 'python';
}

export function getGraphJsonPath() {
  return join(root, 'graphify-out', 'graph.json');
}

export function isGraphifyMcpRunning(port = GRAPHIFY_MCP_PORT) {
  return new Promise(resolveOk => {
    const sock = createConnection({ host: '127.0.0.1', port }, () => {
      sock.end();
      resolveOk(true);
    });
    sock.on('error', () => resolveOk(false));
    sock.setTimeout(800, () => {
      sock.destroy();
      resolveOk(false);
    });
  });
}
