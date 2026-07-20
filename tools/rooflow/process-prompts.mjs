#!/usr/bin/env node
/**
 * Process RooFlow .roo prompts:
 * - Replace OS/shell/home/workspace placeholders
 * - Inject CONNECTED_MCP_SERVERS from Cursor mcp.json (project + user)
 *
 * Upstream generate_mcp_yaml.py also does placeholders but needs system_prompt.md
 * for MCP; we handle MCP from Cursor configs and do placeholders in Node so
 * Windows OS strings with spaces never break the Python argv.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rooDir = path.join(root, '.roo');
const home = os.homedir();
const shellName = process.platform === 'win32' ? 'powershell' : 'bash';
const osLabel = `${os.type()} ${os.release()}`;

function readJson(filePath) {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function collectMcpServers() {
  const sources = [
    path.join(root, '.cursor', 'mcp.json'),
    path.join(home, '.cursor', 'mcp.json'),
    path.join(root, '.vscode', 'mcp.json'),
  ];
  const merged = {};
  for (const filePath of sources) {
    const data = readJson(filePath);
    const bucket = data.mcpServers || data.servers || {};
    for (const [name, cfg] of Object.entries(bucket)) {
      if (!merged[name]) merged[name] = { ...cfg, _source: filePath };
    }
  }
  return merged;
}

function describeServer(name, cfg) {
  if (cfg.url) {
    return {
      name,
      command: cfg.url,
      description: `HTTP/SSE MCP server (${path.basename(cfg._source || 'mcp.json')}).`,
    };
  }
  const command = [cfg.command, ...(cfg.args || [])].filter(Boolean).join(' ');
  return {
    name,
    command: command || 'unknown',
    description: `Stdio MCP server (${path.basename(cfg._source || 'mcp.json')}).`,
  };
}

function buildMcpYamlBlock(servers) {
  const list = Object.entries(servers).map(([name, cfg]) => describeServer(name, cfg));
  const lines = ['    servers:'];
  if (!list.length) {
    lines.push('      []');
  } else {
    for (const s of list) {
      lines.push(`    - name: ${JSON.stringify(s.name)}`);
      lines.push(`      command: ${JSON.stringify(s.command)}`);
      lines.push(`      description: ${JSON.stringify(s.description)}`);
      lines.push('      tools: []');
      lines.push('      resources: []');
    }
  }
  return ['# MCP Server list injected by script', ...lines, '# End MCP Server list', ''].join('\n');
}

function replacePlaceholders(text) {
  return text
    .replaceAll('[OS_PLACEHOLDER]', osLabel)
    .replaceAll('[SHELL_PLACEHOLDER]', shellName)
    .replaceAll('[HOME_PLACEHOLDER]', home)
    .replaceAll('[WORKSPACE_PLACEHOLDER]', root)
    .replaceAll('`WORKSPACE_PLACEHOLDER`', `\`${root}\``)
    .replaceAll('WORKSPACE_PLACEHOLDER', root);
}

function processPrompts(mcpBlock) {
  if (!existsSync(rooDir)) {
    console.error('Missing .roo — run npm run rooflow:setup first');
    process.exit(1);
  }

  const start = '# MCP Server list injected by script';
  const end = '# End MCP Server list';
  const placeholderRe = /^[ \t]*#\s*\[CONNECTED_MCP_SERVERS\][ \t]*\r?\n?/m;
  const blockRe = new RegExp(
    `^[ \\t]*${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?^[ \\t]*${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[ \\t]*\\r?\\n?`,
    'm'
  );

  let updated = 0;
  for (const name of readdirSync(rooDir)) {
    if (!name.startsWith('system-prompt-flow-')) continue;
    const filePath = path.join(rooDir, name);
    let text = replacePlaceholders(readFileSync(filePath, 'utf8'));

    if (blockRe.test(text)) {
      text = text.replace(blockRe, `${mcpBlock}\n`);
    } else if (placeholderRe.test(text)) {
      text = text.replace(placeholderRe, `${mcpBlock}\n`);
    } else if (!text.includes(start)) {
      console.warn(`  skip MCP inject for ${name}: no placeholder`);
    }

    writeFileSync(filePath, text, 'utf8');
    updated += 1;
    console.log(`  processed ${name}`);
  }
  return updated;
}

const servers = collectMcpServers();
console.log(`Processing RooFlow prompts (OS=${osLabel}, MCP servers=${Object.keys(servers).length})…`);
const count = processPrompts(buildMcpYamlBlock(servers));
console.log(`Done — ${count} prompt file(s) updated.`);

// Verify
const sample = readFileSync(path.join(rooDir, 'system-prompt-flow-code'), 'utf8');
const problems = [];
if (sample.includes('[OS_PLACEHOLDER]')) problems.push('OS_PLACEHOLDER');
if (sample.includes('[SHELL_PLACEHOLDER]')) problems.push('SHELL_PLACEHOLDER');
if (sample.includes('[HOME_PLACEHOLDER]')) problems.push('HOME_PLACEHOLDER');
if (sample.includes('[WORKSPACE_PLACEHOLDER]') || sample.includes('WORKSPACE_PLACEHOLDER')) {
  problems.push('WORKSPACE_PLACEHOLDER');
}
if (sample.includes('# [CONNECTED_MCP_SERVERS]')) problems.push('CONNECTED_MCP_SERVERS');
if (!sample.includes('# MCP Server list injected by script')) problems.push('missing MCP inject');
if (problems.length) {
  console.error('Verification failed:', problems.join(', '));
  process.exit(1);
}
console.log('Verification OK.');
