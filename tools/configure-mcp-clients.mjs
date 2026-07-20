import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPlaywrightHttpServer,
  buildPlaywrightStdioServer,
} from './playwright-mcp-shared.mjs';

const PROJECT_PATH =
  process.env.MCP_PROJECT_PATH || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEBSTORM_SSE_URL = process.env.WEBSTORM_SSE_URL || 'http://127.0.0.1:63343/sse';
const NPM_GLOBAL = join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules');
const WEBSTORM_DIR = 'C:\\Program Files\\JetBrains\\WebStorm 2026.1.4';

const paths = {
  filesystem: join(NPM_GLOBAL, '@modelcontextprotocol', 'server-filesystem', 'dist', 'index.js'),
  memory: join(NPM_GLOBAL, '@modelcontextprotocol', 'server-memory', 'dist', 'index.js'),
  sequentialThinking: join(NPM_GLOBAL, '@modelcontextprotocol', 'server-sequential-thinking', 'dist', 'index.js'),
};

const playwrightArgs = [
  '-y',
  '@playwright/mcp@latest',
  '--browser',
  'chrome',
  '--caps',
  'vision,pdf,devtools',
  '--allow-unrestricted-file-access',
  '--grant-permissions',
  'geolocation',
  'clipboard-read',
  'clipboard-write',
  'notifications',
];

function buildPlaywrightServer() {
  return buildPlaywrightStdioServer(PROJECT_PATH) || {
    command: 'npx',
    args: playwrightArgs,
  };
}

const CLOUDFLARE_MCP_URLS = {
  cloudflare: 'https://mcp.cloudflare.com/mcp',
  'cloudflare-docs': 'https://docs.mcp.cloudflare.com/mcp',
  'cloudflare-bindings': 'https://bindings.mcp.cloudflare.com/mcp',
  'cloudflare-builds': 'https://builds.mcp.cloudflare.com/mcp',
  'cloudflare-observability': 'https://observability.mcp.cloudflare.com/mcp',
};

function buildCloudflareUrlServers() {
  return Object.fromEntries(Object.entries(CLOUDFLARE_MCP_URLS).map(([name, url]) => [name, { url }]));
}

function buildCloudflareHttpServers() {
  return Object.fromEntries(
    Object.entries(CLOUDFLARE_MCP_URLS).map(([name, url]) => [name, { type: 'http', url }])
  );
}

function buildCloudflareWindsurfServers() {
  return Object.fromEntries(
    Object.entries(CLOUDFLARE_MCP_URLS).map(([name, url]) => [name, { serverUrl: url }])
  );
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJson(filePath, fallback = {}) {
  if (!existsSync(filePath)) return structuredClone(fallback);
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(filePath, data) {
  ensureDir(filePath);
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function mergeServers(target, servers) {
  target.mcpServers = target.mcpServers || {};
  Object.assign(target.mcpServers, servers);
  return target;
}

function getWebstormStdio() {
  const javaExe = join(WEBSTORM_DIR, 'jbr', 'bin', 'java.exe');
  const classpath = [
    join(WEBSTORM_DIR, 'plugins', 'mcpserver', 'lib', 'mcpserver-frontend.jar'),
    join(WEBSTORM_DIR, 'lib', 'util-8.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.kotlinx.coroutines.core.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.ktor.client.cio.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.ktor.client.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.ktor.network.tls.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.ktor.io.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.ktor.utils.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.kotlinx.io.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.kotlinx.serialization.core.jar'),
    join(WEBSTORM_DIR, 'lib', 'intellij.libraries.kotlinx.serialization.json.jar'),
  ].join(';');

  return {
    command: javaExe,
    args: ['-classpath', classpath, 'com.intellij.mcpserver.stdio.McpStdioRunnerKt'],
    env: { IJ_MCP_SERVER_PORT: '63343' },
  };
}

function buildCommonStdioServers() {
  return {
    'filesystem-hundesalon': {
      command: 'node',
      args: [paths.filesystem, PROJECT_PATH],
    },
    memory: {
      command: 'node',
      args: [paths.memory],
    },
    'sequential-thinking': {
      command: 'node',
      args: [paths.sequentialThinking],
    },
    playwright: buildPlaywrightServer(),
    ...buildCloudflareUrlServers(),
    webstorm: {
      url: WEBSTORM_SSE_URL,
    },
  };
}

function buildGithubServer(useInput = false) {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN || '';
  if (!token && !useInput) return null;
  const server = {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
  };

  if (useInput) {
    server.env = {
      GITHUB_PERSONAL_ACCESS_TOKEN: '${input:github-token}',
    };
  } else if (token) {
    server.env = {
      GITHUB_PERSONAL_ACCESS_TOKEN: token,
    };
  }

  return server;
}

function removeGithubPromptConfig(existing) {
  if (Array.isArray(existing.inputs)) {
    existing.inputs = existing.inputs.filter(item => item?.id !== 'github-token');
  }
  if (existing.servers?.github) {
    delete existing.servers.github;
  }
}

function configureCursor() {
  const filePath = join(homedir(), '.cursor', 'mcp.json');
  const data = mergeServers(readJson(filePath), buildCommonStdioServers());
  data.mcpServers.playwright = buildPlaywrightHttpServer();
  const github = buildGithubServer(false);
  if (github) data.mcpServers.github = github;
  writeJson(filePath, data);
  return filePath;
}

function configureCursorProject() {
  const filePath = join(PROJECT_PATH, '.cursor', 'mcp.json');
  const data = readJson(filePath, { mcpServers: {} });
  data.mcpServers = {
    ...(data.mcpServers || {}),
    playwright: buildPlaywrightHttpServer(),
  };
  writeJson(filePath, data);
  return filePath;
}

function configureVsCodeUser() {
  const filePath = join(homedir(), 'AppData', 'Roaming', 'Code', 'User', 'mcp.json');
  const existing = readJson(filePath, { inputs: [], servers: {} });
  removeGithubPromptConfig(existing);
  const servers = {
    'filesystem-hundesalon': {
      command: 'node',
      args: [paths.filesystem, PROJECT_PATH],
    },
    memory: {
      command: 'node',
      args: [paths.memory],
    },
    'sequential-thinking': {
      command: 'node',
      args: [paths.sequentialThinking],
    },
    playwright: buildPlaywrightHttpServer(),
    ...buildCloudflareHttpServers(),
    webstorm: {
      type: 'sse',
      url: WEBSTORM_SSE_URL,
    },
  };

  const github = buildGithubServer(false);
  if (github) {
    servers.github = github;
  }

  existing.servers = {
    ...(existing.servers || {}),
    ...servers,
  };

  if (!existing.servers['github/copilot-mcp']) {
    existing.servers['github/copilot-mcp'] = {
      type: 'http',
      url: 'https://api.githubcopilot.com/mcp/',
      gallery: 'https://api.mcp.github.com',
      version: '1.0.0',
      healthCheck: true,
      timeout: 20000,
    };
  }

  writeJson(filePath, existing);
  return filePath;
}

function configureVsCodeWorkspace() {
  const filePath = join(PROJECT_PATH, '.vscode', 'mcp.json');
  const data = {
    inputs: [],
    servers: {
      'filesystem-hundesalon': {
        command: 'node',
        args: [paths.filesystem, PROJECT_PATH],
      },
      memory: {
        command: 'node',
        args: [paths.memory],
      },
      'sequential-thinking': {
        command: 'node',
        args: [paths.sequentialThinking],
      },
      playwright: buildPlaywrightHttpServer(),
      ...buildCloudflareHttpServers(),
      webstorm: {
        type: 'sse',
        url: WEBSTORM_SSE_URL,
      },
    },
  };
  writeJson(filePath, data);
  return filePath;
}

function configureClaude() {
  const filePath = join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  const existing = readJson(filePath, { mcpServers: {} });
  const servers = {
    ...buildCommonStdioServers(),
    webstorm: getWebstormStdio(),
  };
  existing.mcpServers = {
    ...(existing.mcpServers || {}),
    ...servers,
  };
  writeJson(filePath, existing);
  return filePath;
}

function configureWindsurf() {
  const filePath = join(homedir(), '.codeium', 'windsurf', 'mcp_config.json');
  const data = readJson(filePath, { mcpServers: {} });
  for (const key of ['filesystem', 'everything']) {
    delete data.mcpServers?.[key];
  }
  mergeServers(data, {
    'filesystem-hundesalon': {
      command: 'node',
      args: [paths.filesystem, PROJECT_PATH],
      disabled: false,
    },
    memory: {
      command: 'node',
      args: [paths.memory],
      disabled: false,
    },
    'sequential-thinking': {
      command: 'node',
      args: [paths.sequentialThinking],
      disabled: false,
    },
    playwright: {
      ...buildPlaywrightServer(),
      disabled: false,
    },
    ...Object.fromEntries(
      Object.entries(buildCloudflareWindsurfServers()).map(([name, cfg]) => [name, { ...cfg, disabled: false }])
    ),
    webstorm: {
      serverUrl: WEBSTORM_SSE_URL,
      disabled: false,
    },
  });
  writeJson(filePath, data);
  return filePath;
}

function configureDevin(filePath) {
  const existing = readJson(filePath, {
    version: 1,
    mcpServers: {},
    read_config_from: {
      cursor: true,
      windsurf: true,
      claude: true,
      opencode: true,
      vscode: true,
      zed: true,
    },
  });

  const legacyKeys = ['filesystem', 'everything'];
  for (const key of legacyKeys) {
    delete existing.mcpServers?.[key];
  }

  existing.mcpServers = {
    ...(existing.mcpServers || {}),
    'filesystem-hundesalon': {
      command: 'node',
      args: [paths.filesystem, PROJECT_PATH],
      transport: 'stdio',
    },
    memory: {
      command: 'node',
      args: [paths.memory],
      transport: 'stdio',
    },
    'sequential-thinking': {
      command: 'node',
      args: [paths.sequentialThinking],
      transport: 'stdio',
    },
    playwright: buildPlaywrightServer(),
    ...Object.fromEntries(
      Object.entries(CLOUDFLARE_MCP_URLS).map(([name, url]) => [
        name,
        { serverUrl: url, transport: 'http' },
      ])
    ),
    webstorm: {
      serverUrl: WEBSTORM_SSE_URL,
      transport: 'sse',
    },
  };

  const github = buildGithubServer(false);
  if (github) {
    existing.mcpServers.github = { ...github, transport: 'stdio' };
  }

  writeJson(filePath, existing);
  return filePath;
}

function upsertCodexToml(filePath) {
  const block = [
    '',
    '[mcp_servers.filesystem-hundesalon]',
    'args = ["' + paths.filesystem.replace(/\\/g, '/') + '", "' + PROJECT_PATH.replace(/\\/g, '/') + '"]',
    'command = "node"',
    'enabled = true',
    '',
    '[mcp_servers.memory]',
    'args = ["' + paths.memory.replace(/\\/g, '/') + '"]',
    'command = "node"',
    'enabled = true',
    '',
    '[mcp_servers.sequential-thinking]',
    'args = ["' + paths.sequentialThinking.replace(/\\/g, '/') + '"]',
    'command = "node"',
    'enabled = true',
    '',
    '[mcp_servers.playwright]',
    'args = ["-y", "@playwright/mcp@latest", "--caps", "vision,pdf,devtools", "--allow-unrestricted-file-access", "--grant-permissions", "geolocation", "clipboard-read", "clipboard-write", "notifications"]',
    'command = "npx"',
    'enabled = true',
    '',
    ...Object.entries(CLOUDFLARE_MCP_URLS).flatMap(([name, url]) => [
      `[mcp_servers.${name}]`,
      `url = "${url}"`,
      'enabled = true',
      '',
    ]),
    '[mcp_servers.webstorm]',
    'args = ["-y", "mcp-remote", "' + WEBSTORM_SSE_URL + '"]',
    'command = "npx"',
    'enabled = true',
    'type = "stdio"',
  ].join('\n');

  let content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const sections = [
    'filesystem-hundesalon',
    'memory',
    'sequential-thinking',
    'playwright',
    ...Object.keys(CLOUDFLARE_MCP_URLS),
    'webstorm',
  ];

  for (const section of sections) {
    const pattern = new RegExp(`\\[mcp_servers\\.${section.replace(/-/g, '\\-')}\\][\\s\\S]*?(?=\\n\\[|$)`, 'm');
    content = content.replace(pattern, '');
  }

  ensureDir(filePath);
  writeFileSync(filePath, `${content.trimEnd()}\n${block}\n`, 'utf8');
  return filePath;
}

function configureJetBrainsImport() {
  const filePath = join(homedir(), '.jetbrains', 'mcp-import-hundesalon.json');
  const data = {
    mcpServers: {
      'filesystem-hundesalon': {
        command: 'node',
        args: [paths.filesystem, PROJECT_PATH],
      },
      memory: {
        command: 'node',
        args: [paths.memory],
      },
      'sequential-thinking': {
        command: 'node',
        args: [paths.sequentialThinking],
      },
      playwright: {
        command: 'npx',
        args: ['-y', '@playwright/mcp@latest', '--caps', 'vision,pdf,devtools'],
      },
      ...buildCloudflareUrlServers(),
      webstorm: {
        url: WEBSTORM_SSE_URL,
      },
    },
  };
  const github = buildGithubServer(false);
  if (github) data.mcpServers.github = github;
  writeJson(filePath, data);
  return filePath;
}

const results = [
  ['Cursor', configureCursor()],
  ['Cursor (project)', configureCursorProject()],
  ['VSCode (user)', configureVsCodeUser()],
  ['VSCode (workspace)', configureVsCodeWorkspace()],
  ['Claude App', configureClaude()],
  ['Windsurf', configureWindsurf()],
  ['Devin', configureDevin(join(homedir(), 'AppData', 'Roaming', 'Devin', 'config.json'))],
  ['Devin (alt)', configureDevin(join(homedir(), 'AppData', 'Roaming', 'devin', 'config.json'))],
  ['Codex', upsertCodexToml(join(homedir(), '.codex', 'config.toml'))],
  ['Codex (Project)', upsertCodexToml(join(PROJECT_PATH, '.codex', 'config.toml'))],
  ['WebStorm import', configureJetBrainsImport()],
];

console.log('HUNDESALON MCP profile applied:\n');
for (const [name, path] of results) {
  console.log(`  OK  ${name}`);
  console.log(`      ${path}`);
}

const githubConfigured = Boolean(process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN);
console.log(
  '\nServers: filesystem-hundesalon, memory, sequential-thinking, playwright, cloudflare, cloudflare-docs, cloudflare-bindings, cloudflare-builds, cloudflare-observability, webstorm'
);
console.log(
  `GitHub MCP: ${githubConfigured ? 'enabled (token found in environment)' : 'skipped (set GITHUB_PERSONAL_ACCESS_TOKEN to enable)'}`
);
console.log('\nRestart VS Code, Cursor, Devin, Claude, Windsurf and Codex to apply changes.');
