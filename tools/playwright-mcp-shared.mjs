import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const PLAYWRIGHT_MCP_PORT = 8931;
export const PLAYWRIGHT_MCP_URL = `http://localhost:${PLAYWRIGHT_MCP_PORT}/mcp`;

/** System Chrome is stable for agent smoke; use `npm run browser:edge` for OAuth/passkeys. */
export const PLAYWRIGHT_MCP_BROWSER = 'chrome';

export function getProjectRoot() {
  return process.env.MCP_PROJECT_PATH || process.cwd();
}

export function getPlaywrightMcpCli(projectRoot = getProjectRoot()) {
  return join(projectRoot, 'node_modules', '@playwright', 'mcp', 'cli.js');
}

export function getPlaywrightUserDataDir() {
  const dir = join(homedir(), '.cursor', 'browser-profiles', 'playwright-mcp-chrome');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getPlaywrightOutputDir(projectRoot = getProjectRoot()) {
  const dir = join(projectRoot, '.playwright-mcp');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getPlaywrightExtensionDir() {
  return join(homedir(), '.cursor', 'browser-profiles', 'playwright-extension-unpacked');
}

/** Write MCP config (extension load + shared options). Returns config path. */
export function ensurePlaywrightMcpConfig() {
  const profiles = join(homedir(), '.cursor', 'browser-profiles');
  mkdirSync(profiles, { recursive: true });
  const configPath = join(profiles, 'playwright-mcp.config.json');
  const extDir = getPlaywrightExtensionDir();
  const launchArgs = [];
  if (existsSync(join(extDir, 'manifest.json'))) {
    // Enable manual tab connect via Playwright Extension inside headed Chrome.
    launchArgs.push(`--disable-extensions-except=${extDir}`);
    launchArgs.push(`--load-extension=${extDir}`);
  }
  const config = {
    browser: {
      launchOptions: {
        args: launchArgs,
      },
    },
  };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return configPath;
}

/**
 * Calibrated CLI args for Cursor HTTP Playwright MCP.
 * Shared context keeps navigate/snapshot/click consistent across MCP clients.
 * Headed Chrome stays visible so you can click manually while the agent drives.
 */
export function buildPlaywrightMcpArgs(projectRoot = getProjectRoot()) {
  const configPath = ensurePlaywrightMcpConfig();
  return [
    getPlaywrightMcpCli(projectRoot),
    '--config',
    configPath,
    '--port',
    String(PLAYWRIGHT_MCP_PORT),
    '--host',
    '127.0.0.1',
    '--browser',
    PLAYWRIGHT_MCP_BROWSER,
    '--shared-browser-context',
    // Keep default FS/`file://` guardrails (no --allow-unrestricted-file-access).
    '--caps',
    'vision,pdf',
    '--viewport-size',
    '1440x900',
    '--timeout-action',
    '10000',
    '--timeout-navigation',
    '60000',
    '--console-level',
    'warning',
    '--image-responses',
    'allow',
    '--user-data-dir',
    getPlaywrightUserDataDir(),
    '--output-dir',
    getPlaywrightOutputDir(projectRoot),
  ];
}

export function buildPlaywrightHttpServer() {
  return { url: PLAYWRIGHT_MCP_URL };
}

export function buildPlaywrightStdioServer(projectRoot = getProjectRoot()) {
  const cli = getPlaywrightMcpCli(projectRoot);
  if (!existsSync(cli)) {
    return null;
  }

  // Fallback for clients without HTTP; prefer HTTP + mcp:playwright:serve.
  return {
    command: process.execPath,
    args: buildPlaywrightMcpArgs(projectRoot).slice(1).filter((arg, i, arr) => {
      // drop --port/--host for stdio
      if (arg === '--port' || arg === '--host') return false;
      if (arr[i - 1] === '--port' || arr[i - 1] === '--host') return false;
      return true;
    }),
  };
}

export async function isPlaywrightMcpRunning(port = PLAYWRIGHT_MCP_PORT) {
  const hosts = ['127.0.0.1', 'localhost'];
  for (const host of hosts) {
    try {
      const response = await fetch(`http://${host}:${port}/mcp`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      // MCP HTTP returns 400/405/406 without a proper Accept/session — still means up.
      if (response.status === 400 || response.status === 405 || response.status === 406 || response.ok) {
        return true;
      }
    } catch {
      // try next host
    }
  }
  return false;
}
