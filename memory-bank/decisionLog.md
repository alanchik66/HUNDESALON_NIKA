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

2026-07-20 02:40:00 — AI Routing Kernel as SSOT

## Decision

Introduce `docs/agents-routing.md` as the single source of truth for agent startup, repository/workspace/environment/technology detection, decision pipeline, task-class routing, conflict priority, module boundaries, and safety rails. Wire all entry points (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/40-agent-routing.mdc`, playbook, master workflows) to invoke the kernel instead of maintaining isolated/duplicated routing sections.

## Rationale

- Prior state had operational routing only in the playbook + a thin Cursor rule; workflows in `agents-master.md` and entry files each reinvented “inspect then edit” without deterministic detection or conflict resolution.
- GSC account in the Cursor rule conflicted with the post-cutover playbook (`snaiper` vs `ryndenko`).
- `.github/copilot-instructions.md` was referenced but missing.
- Enterprise requirement: routing must be a reusable capability inside every workflow, not an appendix.

## Consequences

- Domain quality stays in `agents-master.md`; commands/accounts stay in the playbook; detection/pipeline/safety live only in the kernel.
- Git default (`main`, no unsolicited PR) remains, with explicit session-mandate override documented in kernel §3/§10.
