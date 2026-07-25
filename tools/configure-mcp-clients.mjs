import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_PATH = process.env.MCP_PROJECT_PATH || resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NPM_GLOBAL = join(homedir(), 'AppData', 'Roaming', 'npm', 'node_modules');

const paths = {
  filesystem: join(NPM_GLOBAL, '@modelcontextprotocol', 'server-filesystem', 'dist', 'index.js'),
};

const CLOUDFLARE_MCP_URLS = {
  cloudflare: 'https://mcp.cloudflare.com/mcp',
  'cloudflare-docs': 'https://docs.mcp.cloudflare.com/mcp',
};

function buildCloudflareUrlServers() {
  return Object.fromEntries(Object.entries(CLOUDFLARE_MCP_URLS).map(([name, url]) => [name, { url }]));
}

function buildCloudflareHttpServers() {
  return Object.fromEntries(Object.entries(CLOUDFLARE_MCP_URLS).map(([name, url]) => [name, { type: 'http', url }]));
}

function buildCloudflareWindsurfServers() {
  return Object.fromEntries(Object.entries(CLOUDFLARE_MCP_URLS).map(([name, url]) => [name, { serverUrl: url }]));
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

function buildCommonStdioServers() {
  return {
    'filesystem-hundesalon': {
      command: 'node',
      args: [paths.filesystem, PROJECT_PATH],
    },
    ...buildCloudflareUrlServers(),
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
  const github = buildGithubServer(false);
  if (github) data.mcpServers.github = github;
  writeJson(filePath, data);
  return filePath;
}

function configureCursorProject() {
  const filePath = join(PROJECT_PATH, '.cursor', 'mcp.json');
  const data = readJson(filePath, { mcpServers: {} });
  // Keep existing project config or add minimal servers
  data.mcpServers = {
    ...(data.mcpServers || {}),
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
    ...buildCloudflareHttpServers(),
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
  const existing = readJson(filePath, { inputs: [], servers: {} });
  const servers = {
    'filesystem-hundesalon': {
      command: 'node',
      args: [paths.filesystem, PROJECT_PATH],
    },
    ...buildCloudflareHttpServers(),
  };
  existing.servers = {
    ...(existing.servers || {}),
    ...servers,
  };
  writeJson(filePath, existing);
  return filePath;
}

function configureClaude() {
  const filePath = join(homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  const existing = readJson(filePath, { mcpServers: {} });
  const servers = {
    ...buildCommonStdioServers(),
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
    ...Object.fromEntries(
      Object.entries(buildCloudflareWindsurfServers()).map(([name, cfg]) => [name, { ...cfg, disabled: false }])
    ),
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
    ...Object.fromEntries(
      Object.entries(CLOUDFLARE_MCP_URLS).map(([name, url]) => [name, { serverUrl: url, transport: 'http' }])
    ),
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
    ...Object.entries(CLOUDFLARE_MCP_URLS).flatMap(([name, url]) => [
      `[mcp_servers.${name}]`,
      `url = "${url}"`,
      'enabled = true',
      '',
    ]),
  ].join('\n');

  let content = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
  const sections = ['filesystem-hundesalon', ...Object.keys(CLOUDFLARE_MCP_URLS)];

  for (const section of sections) {
    const pattern = new RegExp(`\\[mcp_servers\\.${section.replace(/-/g, '\\-')}\\][\\s\\S]*?(?=\\n\\[|$)`, 'm');
    content = content.replace(pattern, '');
  }

  ensureDir(filePath);
  writeFileSync(filePath, `${content.trimEnd()}\n${block}\n`, 'utf8');
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
];

console.log('HUNDESALON MCP profile applied:\n');
for (const [name, path] of results) {
  console.log(`  OK  ${name}`);
  console.log(`      ${path}`);
}

const githubConfigured = Boolean(process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN);
console.log('\nServers: filesystem-hundesalon, cloudflare, cloudflare-docs');
console.log(
  `GitHub MCP: ${githubConfigured ? 'enabled (token found in environment)' : 'skipped (set GITHUB_PERSONAL_ACCESS_TOKEN to enable)'}`
);
console.log('\nRestart VS Code, Cursor, Devin, Claude, Windsurf and Codex to apply changes.');
