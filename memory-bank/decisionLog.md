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
