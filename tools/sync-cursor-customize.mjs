#!/usr/bin/env node
/**
 * Sync lean Customize surface: copy project skills from .agents/skills → .cursor/skills
 * (junctions fail on some Windows volume setups). Idempotent.
 *
 * Also audits Cursor Marketplace / plugin cache against the HUNDESALON lean policy
 * (claude-plugins-official is Claude Code–oriented; do not install stack-mismatched LSPs).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = path.join(root, '.agents', 'skills');
const dstRoot = path.join(root, '.cursor', 'skills');

const LEAN = [
  'graphify',
  'flow-architect',
  'flow-ask',
  'flow-code',
  'flow-debug',
  'flow-orchestrator',
  'ponytail',
  'ponytail-review',
  'ponytail-audit',
  'ponytail-debt',
  'ponytail-gain',
  'ponytail-help',
];

/** cursor-public plugins that match this site's lean Customize/MCP surface */
const MARKETPLACE_ALLOW = new Set([
  'figma',
  'linear',
  'notion-workspace',
  'zapier',
]);

/**
 * claude-plugins-official items visible on the Marketplace tab.
 * Decision is project policy — not every Claude plugin has a Cursor-native install path.
 */
const MARKETPLACE_POLICY = [
  {
    id: 'playwright',
    decision: 'skip-marketplace',
    why: 'Already core via project MCP http://127.0.0.1:8931 (hidden wscript). Marketplace npx @playwright/mcp@latest would duplicate and break isolation.',
  },
  {
    id: 'security-guidance',
    decision: 'project-equivalent',
    why: 'Claude-only Python Stop/commit hooks. Covered by .cursor/hooks/block-secrets.mjs + rule security-site + Cursor security-review subagent.',
  },
  {
    id: 'pr-review-toolkit',
    decision: 'project-equivalent',
    why: 'Duplicates bugbot + security-review + minimal-diff. Use those instead of six extra agents.',
  },
  {
    id: 'skill-creator',
    decision: 'skip',
    why: 'Cursor ships create-skill; project skills live in .agents/skills and sync via this script.',
  },
  {
    id: 'plugin-dev',
    decision: 'skip',
    why: 'Claude Code plugin authoring — not needed for this static site.',
  },
  {
    id: 'serena',
    decision: 'skip',
    why: 'Redundant with Graphify MCP :8932 + graphify skill.',
  },
  {
    id: 'mcp-tunnels',
    decision: 'skip',
    why: 'Anthropic Docker/cloudflared tunnels. Project uses local hidden MCP (run-hidden.vbs), not tunnels.',
  },
  {
    id: 'ralph-loop',
    decision: 'skip',
    why: 'Speculative multi-loop agent. Conflicts with token economy + ponytail.',
  },
  {
    id: 'playground',
    decision: 'skip',
    why: 'Interactive HTML explorers — not part of production site workflow.',
  },
  {
    id: 'session-report',
    decision: 'skip',
    why: 'Reads ~/.claude session transcripts — Claude Code only.',
  },
  {
    id: 'typescript-lsp',
    decision: 'skip',
    why: 'Editor already has JS tooling (ESLint/Prettier). No TS app framework.',
  },
  {
    id: 'pyright-lsp',
    decision: 'skip',
    why: 'No Python app surface (only optional tool scripts).',
  },
  {
    id: 'php-lsp',
    decision: 'skip',
    why: 'Stack is HTML/CSS/JS + Cloudflare Functions, not PHP.',
  },
  {
    id: 'ruby-lsp',
    decision: 'skip',
    why: 'Wrong language for this repo.',
  },
  {
    id: 'rust-analyzer-lsp',
    decision: 'skip',
    why: 'Wrong language for this repo.',
  },
  {
    id: 'swift-lsp',
    decision: 'skip',
    why: 'Wrong language for this repo.',
  },
  {
    id: 'terraform',
    decision: 'skip',
    why: 'Hosting is Cloudflare Pages/Wrangler, not Terraform.',
  },
  {
    id: 'telegram',
    decision: 'skip',
    why: 'Not a project default integration (owner lean MCP list).',
  },
  {
    id: 'datadog',
    decision: 'skip-never-reinstall',
    why: 'Previously erroring/unused — do not reinstall.',
  },
];

function rm(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, force: true });
}

fs.mkdirSync(dstRoot, { recursive: true });

const keepExtra = new Set(['flow-shared-memory-bank.md']);
for (const name of fs.readdirSync(dstRoot)) {
  if (LEAN.includes(name) || keepExtra.has(name)) continue;
  rm(path.join(dstRoot, name));
  console.log(`removed non-lean skill ${name}`);
}

for (const name of LEAN) {
  const src = path.join(srcRoot, name);
  const dst = path.join(dstRoot, name);
  if (!fs.existsSync(src)) {
    console.warn(`skip missing ${name}`);
    continue;
  }
  rm(dst);
  copyDir(src, dst);
  console.log(`synced ${name}`);
}

const shared = 'flow-shared-memory-bank.md';
const sharedSrc = path.join(srcRoot, shared);
if (fs.existsSync(sharedSrc)) {
  fs.copyFileSync(sharedSrc, path.join(dstRoot, shared));
  console.log(`synced ${shared}`);
}

const agentsDir = path.join(root, '.cursor', 'agents');
const commandsDir = path.join(root, '.cursor', 'commands');
const agentCount = fs.existsSync(agentsDir)
  ? fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).length
  : 0;
const commandCount = fs.existsSync(commandsDir)
  ? fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md')).length
  : 0;
console.log(`agents: ${agentCount} | commands: ${commandCount} | skills: ${LEAN.length}`);

// ── Marketplace / plugin cache audit ───────────────────────────────────────
const cachePublic = path.join(os.homedir(), '.cursor', 'plugins', 'cache', 'cursor-public');
const localPlugins = path.join(os.homedir(), '.cursor', 'plugins', 'local');
const cached = fs.existsSync(cachePublic)
  ? fs.readdirSync(cachePublic).filter((n) =>
      fs.statSync(path.join(cachePublic, n)).isDirectory()
    )
  : [];
const local = fs.existsSync(localPlugins)
  ? fs.readdirSync(localPlugins).filter((n) =>
      fs.statSync(path.join(localPlugins, n)).isDirectory()
    )
  : [];

const unexpected = cached.filter((n) => !MARKETPLACE_ALLOW.has(n));
const missingAllow = [...MARKETPLACE_ALLOW].filter((n) => !cached.includes(n) && !local.includes(n));

console.log('\n=== marketplace policy (claude-plugins-official) ===');
for (const row of MARKETPLACE_POLICY) {
  console.log(`${row.decision.padEnd(22)} ${row.id} — ${row.why}`);
}
console.log('\n=== cursor-public cache ===');
console.log(`cached: ${cached.join(', ') || '(none)'}`);
console.log(`local:  ${local.join(', ') || '(none)'}`);
if (unexpected.length) {
  console.warn(`WARN unexpected cache (lean deny): ${unexpected.join(', ')}`);
}
if (missingAllow.length) {
  console.warn(
    `NOTE allowlist not in cache (install via Marketplace Get if needed): ${missingAllow.join(', ')}`
  );
} else {
  console.log('allowlist OK (figma/linear/notion/zapier present in cache or local)');
}