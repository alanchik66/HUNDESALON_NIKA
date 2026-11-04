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

## 2026-11-04 07:25:53 - GitHub profile release command

- The user established `https://github.com/haraldalder-vibemogger` as a standing full release command for this project, unless the message explicitly limits the task to reading or another purpose.
- Keep `docs/RELEASE_GUIDE.md` as the procedure and `config/release-reference-methods.json` as the pinned method catalog. Discover the current public repositories and HEADs on every profile-triggered run; do not hard-code a permanent repository count.
- Adapt compatible methods through the existing stack, preserve explicit staging and required gates, deploy the exact tested artifact, and verify the publicly served commit and four locales.
- This rule does not authorize account permission changes, credential creation, messages to others, paid APIs, or bypassing failed checks. Preserve the user's separate dependency-change rule.
