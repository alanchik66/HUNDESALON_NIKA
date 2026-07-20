import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  PLAYWRIGHT_MCP_PORT,
  buildPlaywrightMcpArgs,
  getPlaywrightMcpCli,
  getProjectRoot,
  isPlaywrightMcpRunning,
} from './playwright-mcp-shared.mjs';

const projectRoot = getProjectRoot();
const cli = getPlaywrightMcpCli(projectRoot);

if (!existsSync(cli)) {
  console.error('Missing @playwright/mcp. Run: npm install');
  process.exit(1);
}

if (await isPlaywrightMcpRunning()) {
  console.log(`Playwright MCP already listening on http://127.0.0.1:${PLAYWRIGHT_MCP_PORT}/mcp`);
  process.exit(0);
}

const child = spawn(process.execPath, buildPlaywrightMcpArgs(projectRoot), {
  cwd: projectRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', code => {
  process.exit(code ?? 1);
});
