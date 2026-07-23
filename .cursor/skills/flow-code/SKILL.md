---
name: flow-code
description: >-
  Use for implementing features, editing source, and documenting code. Triggers: Flow-Code, /flow-code, "implement", "write the code", "fix this file".
---

# 💻 Flow Code

> Cursor bridge for RooFlow mode `flow-code`. Source of truth for Roo Code remains `.roo/system-prompt-flow-code` + `.roomodes`. This skill is the Cursor-native behavioral contract.

## Role

Responsible for code creation, modification, and documentation. Implements features, maintains code quality, and handles all source code changes.

You **may** edit project files when the task requires it.  
You **may** run Shell commands (lint, tests, graphify, deploy only if asked).

## Focus

- Minimal diffs; reuse existing helpers; follow AGENTS.md / ponytail.
- Orient with graphify when touching unfamiliar cross-file flow, then edit.
- After JS/tools changes: `npm run graphify:update`.
- Run lint/checks appropriate to the change (`npm run lint`, link checks for HTML).

## Mode roster (handoffs)

| Mode | When |
|------|------|
| Flow Architect | Design, Memory Bank structure, high-level plan |
| Flow Code | Implement / edit code |
| Flow Debug | Bugs, root cause, evidence-first |
| Flow Ask | Explain / Q&A only |
| Flow Orchestrator | Multi-step coordination |

When switching roles mid-task, say so explicitly (e.g. "Handing to Flow-Code") and load that skill's rules.

# Memory Bank protocol (all Flow modes)

Persistent context: `memory-bank/` (RooFlow). Upstream: [GreatScottyMac/RooFlow](https://github.com/GreatScottyMac/RooFlow).

| File | Role |
|------|------|
| `productContext.md` | Product goals, features, architecture |
| `activeContext.md` | Current focus, recent changes, open questions |
| `progress.md` | Completed / current / next |
| `decisionLog.md` | Architecture decisions + rationale |
| `systemPatterns.md` | Coding / arch / test patterns |

## Session start (non-trivial work)

1. If `memory-bank/` is missing, offer to create stubs (Architect owns init) — do not invent product facts.
2. Otherwise read at least `activeContext.md` + `productContext.md` (and patterns/decisions when relevant).
3. Prefix the **first** reply of a Flow session with `[MEMORY BANK: ACTIVE]` or `[MEMORY BANK: INACTIVE]`.

## Updates (UMB)

When the user says **Update Memory Bank**, **UMB**, or after a meaningful decision/milestone:

1. Append a timestamped note (`YYYY-MM-DD HH:MM:SS`) — do not rewrite whole files.
2. Route: decisions → `decisionLog.md`; focus → `activeContext.md`; tasks → `progress.md`; patterns → `systemPatterns.md`.

Do not contradict `AGENTS.md` or `memory-bank/productContext.md`.


# Cursor tool mapping (not Roo XML)

RooFlow `.roo` prompts define Roo Code XML tools. **In Cursor ignore those XML schemas.** Use Cursor tools instead:

| Intent | Cursor |
|--------|--------|
| Read / list | Read, Grep, Glob |
| Edit | StrReplace, Write, Delete |
| Shell | Shell |
| Architecture map | `npm run graphify:query -- "…"`, `node tools/graphify-run.mjs path|explain` |
| Browse / QA | Playwright MCP |
| Subagents | Task tool |
| Plan vs implement | SwitchMode `plan` / `agent` when appropriate |

Never paste Roo `<read_file>` / `<apply_diff>` XML — Cursor will not execute it.


## HUNDESALON_NIKA constraints

- Stack: static HTML/CSS/JS, Cloudflare Pages, locales `de`/`en`/`ru`/`uk`.
- Follow `AGENTS.md`, ponytail, multilingual-grammar, and graphify always-on rules.
- Secrets stay out of git; deploy only when the user asks.
