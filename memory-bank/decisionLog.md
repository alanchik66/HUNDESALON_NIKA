# Decision Log

## 2026-08-28 - Separate Roo Code and VS Code Flow Layers

### Decision

Use `.roomodes` and `.roo/system-prompt-flow-*` as the upstream Roo Code layer. Use `.agents/skills/flow-*` as the VS Code/Copilot adaptation layer.

### Rationale

The upstream prompts contain Roo Code-specific XML tool contracts, while the adapted skills use native VS Code tools. Keeping the layers separate prevents contradictory tool instructions.

### Constraints

- Do not overwrite `.roo/rules/` or `.roo/commands/` during RooFlow updates.
- Pin and verify the upstream commit before synchronizing RooFlow files.
- Never inject secrets or raw credentials into system prompts or Memory Bank files.
