# Decision Log

Architectural and implementation decisions.
2026-07-18 13:20:00 - Initialized.

## Decision

Install RooFlow file-based Memory Bank for Cursor (and full `.roo` Flow modes for Roo Code), alongside Graphify and Ponytail — not Context Portal MCP (extra service not required for this static site).

## Rationale

- Cursor is the primary agent host; Memory Bank files give persistent context without Roo Code.
- Flow YAML prompts still ship so Roo Code users get native modes.
- Graphify covers code structure queries; Ponytail covers minimal diffs; Memory Bank covers session/product continuity.

## Implementation Details

- `.roo/system-prompt-flow-*` processed with workspace paths via `tools/rooflow/generate_mcp_yaml.py`.
- Cursor rule: `.cursor/rules/rooflow-memory-bank.mdc`.
- Seed files under `memory-bank/`.

---

2026-07-20 02:45:00 - **AI Routing Kernel as shared capability** (landed on main via #26)

## Decision

Make routing a single reusable kernel (`docs/agents-routing.md`) integrated into every host workflow, instead of an isolated “Routing Rules” appendix duplicated per tool.

## Rationale

- Prior state: task→command map only; no deterministic repo/workspace/env/module detection; GSC account conflict; missing Copilot/Gemini adapters; `agents-master` workflows started at Understand without routing.
- One kernel + thin host adapters avoids dialect drift across Cursor / Claude / Codex / Gemini / Copilot.
- Integrity enforced by `npm run check:agents-routing` inside `validate`.

## Implementation Details

- Kernel: `docs/agents-routing.md`
- Cursor: `.cursor/rules/00-routing-kernel.mdc` (alwaysApply); `40-agent-routing.mdc` = task/skill map after kernel
- Hosts: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, Copilot agent profile
- Domain contract `docs/agents-master.md` §§4–7, 81, 88–92, 139, 143, 150 bound to kernel
- GSC owner corrected to `ryndenko1982@gmail.com` in Cursor task routing

---

2026-07-20 02:40:00 — Parallel kernel draft (PR #27, not yet reconciled with #26)

## Decision

Alternate SSOT draft: combine kernel always-on into `40-agent-routing.mdc` (no separate `00-` rule); elevate platform/session mandate explicitly in conflict order; document Cloud Agent branch/PR override vs default `main`-only.

## Note

Same goal as #26; architecture differs. Merge conflicts in kernel + host adapters are **complicated** (conflicting intents) and need an explicit choose/merge decision — do not auto-resolve by picking one side blindly.
