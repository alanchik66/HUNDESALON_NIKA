#!/usr/bin/env node
/**
 * Export RooFlow Flow-* modes into Cursor Agent Skills + always-on rule.
 * Roo Code keeps using `.roo/` + `.roomodes` unchanged.
 * Cursor cannot load Roo YAML system prompts — this bridge is the professional equivalent.
 *
 * Usage: node tools/rooflow/export-cursor-flow.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const skillsRoot = path.join(root, '.agents', 'skills');
const rulesDir = path.join(root, '.cursor', 'rules');

const MODES = [
  {
    slug: 'flow-architect',
    name: 'Flow Architect',
    emoji: '🏗️',
    description:
      'Use for system design, architecture, Memory Bank init/structure, project organization, and high-level planning. Triggers: Flow-Architect, /flow-architect, "architect this", design/plan before coding.',
    role: 'Focuses on system design, documentation structure, and project organization. Initializes and manages the Memory Bank, guides high-level design, and coordinates which Flow mode should handle next steps.',
    mayEdit: true,
    mayCommand: false,
    focus: [
      'Read Memory Bank first; ensure files exist and stay accurate.',
      'Prefer design docs, trade-offs, and clear next-mode handoffs over diving into large code edits.',
      'For cross-file architecture, run graphify query/path/explain before broad Grep.',
      'Propose structure; implement only when the user asks or the change is documentation/Memory Bank.',
    ],
  },
  {
    slug: 'flow-code',
    name: 'Flow Code',
    emoji: '💻',
    description:
      'Use for implementing features, editing source, and documenting code. Triggers: Flow-Code, /flow-code, "implement", "write the code", "fix this file".',
    role: 'Responsible for code creation, modification, and documentation. Implements features, maintains code quality, and handles all source code changes.',
    mayEdit: true,
    mayCommand: true,
    focus: [
      'Minimal diffs; reuse existing helpers; follow AGENTS.md / ponytail.',
      'Orient with graphify when touching unfamiliar cross-file flow, then edit.',
      'After JS/tools changes: `npm run graphify:update`.',
      'Run lint/checks appropriate to the change (`npm run lint`, link checks for HTML).',
    ],
  },
  {
    slug: 'flow-debug',
    name: 'Flow Debug',
    emoji: '🪲',
    description:
      'Use for troubleshooting, root-cause analysis, and fix coordination. Triggers: Flow-Debug, /flow-debug, "bug", "broken", "why does X fail", "investigate".',
    role: 'Expert in troubleshooting and debugging. Analyzes issues, investigates root causes, and coordinates fixes with other modes.',
    mayEdit: true,
    mayCommand: true,
    focus: [
      'Reproduce with evidence (logs, Playwright, live HTTP) before guessing.',
      'Fix the shared root cause once — not only the symptom path the ticket names.',
      'Use graphify path/explain to see callers/callees of the failing symbol.',
      'Hand off pure design questions to Flow Architect; pure Q&A to Flow Ask.',
    ],
  },
  {
    slug: 'flow-ask',
    name: 'Flow Ask',
    emoji: '❓',
    description:
      'Use for read-only Q&A, explanations, and analysis without implementing. Triggers: Flow-Ask, /flow-ask, "explain", "what is", "how does", "compare".',
    role: 'Answer questions, analyze code, explain concepts, and access external resources. Focus on information; guide the user to Flow-Code/Debug/Architect for implementation.',
    mayEdit: false,
    mayCommand: false,
    focus: [
      'Read-only: do not edit files or run mutating commands.',
      'Prefer graphify query/explain for codebase questions; Memory Bank for product context.',
      'If the user needs code changes, say which Flow mode to switch to and stop.',
    ],
  },
  {
    slug: 'flow-orchestrator',
    name: 'Flow Orchestrator',
    emoji: '🪃',
    description:
      'Use to break complex work into specialist Flow modes and coordinate handoffs. Triggers: Flow-Orchestrator, /flow-orchestrator, "orchestrate", "break this into steps", multi-phase epics.',
    role: 'Strategic workflow orchestrator. Breaks complex tasks into discrete steps and delegates to Flow-Architect, Flow-Code, Flow-Debug, or Flow-Ask as appropriate.',
    mayEdit: false,
    mayCommand: false,
    focus: [
      'Do not implement large changes yourself — plan and delegate via Task subagents or explicit mode handoffs.',
      'Name the next Flow skill for each step; keep a short checklist in the reply.',
      'Update Memory Bank progress when milestones land.',
    ],
  },
];

const SHARED_MB = `# Memory Bank protocol (all Flow modes)

Persistent context: \`memory-bank/\` (RooFlow). Upstream: [GreatScottyMac/RooFlow](https://github.com/GreatScottyMac/RooFlow).

| File | Role |
|------|------|
| \`productContext.md\` | Product goals, features, architecture |
| \`activeContext.md\` | Current focus, recent changes, open questions |
| \`progress.md\` | Completed / current / next |
| \`decisionLog.md\` | Architecture decisions + rationale |
| \`systemPatterns.md\` | Coding / arch / test patterns |

## Session start (non-trivial work)

1. If \`memory-bank/\` is missing, offer to create stubs (Architect owns init) — do not invent product facts.
2. Otherwise read at least \`activeContext.md\` + \`productContext.md\` (and patterns/decisions when relevant).
3. Prefix the **first** reply of a Flow session with \`[MEMORY BANK: ACTIVE]\` or \`[MEMORY BANK: INACTIVE]\`.

## Updates (UMB)

When the user says **Update Memory Bank**, **UMB**, or after a meaningful decision/milestone:

1. Append a timestamped note (\`YYYY-MM-DD HH:MM:SS\`) — do not rewrite whole files.
2. Route: decisions → \`decisionLog.md\`; focus → \`activeContext.md\`; tasks → \`progress.md\`; patterns → \`systemPatterns.md\`.

Do not contradict \`AGENTS.md\` or \`memory-bank/productContext.md\`.
`;

const SHARED_TOOLS = `# Cursor tool mapping (not Roo XML)

RooFlow \`.roo\` prompts define Roo Code XML tools. **In Cursor ignore those XML schemas.** Use Cursor tools instead:

| Intent | Cursor |
|--------|--------|
| Read / list | Read, Grep, Glob |
| Edit | StrReplace, Write, Delete |
| Shell | Shell |
| Architecture map | \`npm run graphify:query -- "…"\`, \`node tools/graphify-run.mjs path\|explain\` |
| Browse / QA | Playwright MCP |
| Subagents | Task tool |
| Plan vs implement | SwitchMode \`plan\` / \`agent\` when appropriate |

Never paste Roo \`<read_file>\` / \`<apply_diff>\` XML — Cursor will not execute it.
`;

function skillBody(mode) {
  const editRule = mode.mayEdit
    ? 'You **may** edit project files when the task requires it.'
    : 'You are **read-only**: do not edit files. Suggest Flow-Code / Flow-Debug for changes.';
  const cmdRule = mode.mayCommand
    ? 'You **may** run Shell commands (lint, tests, graphify, deploy only if asked).'
    : 'Avoid mutating Shell commands; read-only checks only if needed.';

  return `---
name: ${mode.slug}
description: >-
  ${mode.description}
---

# ${mode.emoji} ${mode.name}

> Cursor bridge for RooFlow mode \`${mode.slug}\`. Source of truth for Roo Code remains \`.roo/system-prompt-${mode.slug}\` + \`.roomodes\`. This skill is the Cursor-native behavioral contract.

## Role

${mode.role}

${editRule}  
${cmdRule}

## Focus

${mode.focus.map(f => `- ${f}`).join('\n')}

## Mode roster (handoffs)

| Mode | When |
|------|------|
| Flow Architect | Design, Memory Bank structure, high-level plan |
| Flow Code | Implement / edit code |
| Flow Debug | Bugs, root cause, evidence-first |
| Flow Ask | Explain / Q&A only |
| Flow Orchestrator | Multi-step coordination |

When switching roles mid-task, say so explicitly (e.g. "Handing to Flow-Code") and load that skill's rules.

${SHARED_MB}

${SHARED_TOOLS}

## HUNDESALON_NIKA constraints

- Stack: static HTML/CSS/JS, Cloudflare Pages, locales \`de\`/\`en\`/\`ru\`/\`uk\`.
- Follow \`AGENTS.md\`, ponytail, multilingual-grammar, and graphify always-on rules.
- Secrets stay out of git; deploy only when the user asks.
`;
}

function writeSkills() {
  for (const mode of MODES) {
    const dir = path.join(skillsRoot, mode.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), skillBody(mode), 'utf8');
    console.log('Wrote', path.relative(root, path.join(dir, 'SKILL.md')));
  }
  fs.writeFileSync(path.join(skillsRoot, '_flow-shared-memory-bank.md'), SHARED_MB, 'utf8');
}

function writeRule() {
  const rule = `---
description: RooFlow Memory Bank + Cursor Flow-* skills (selective context)
alwaysApply: true
---

# RooFlow

- Bank: \`memory-bank/\` — read selectively (see \`00-token-economy\`).
- Cursor Flow modes: skills \`.agents/skills/flow-*\` when user says Flow-Architect/Code/Debug/Ask/Orchestrator.
- Roo Code only: \`.roo/\` + \`.roomodes\` (refresh \`npm run rooflow:setup\`).
- UMB / Update Memory Bank → append timestamped bullets.
- Do not invent facts vs \`AGENTS.md\` / \`productContext.md\`.
`;
  fs.mkdirSync(rulesDir, { recursive: true });
  const target = path.join(rulesDir, 'rooflow-memory-bank.mdc');
  fs.writeFileSync(target, rule, 'utf8');
  console.log('Wrote', path.relative(root, target));
}

writeSkills();
writeRule();
console.log('Cursor Flow bridge export complete.');
