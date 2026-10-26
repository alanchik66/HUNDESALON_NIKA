# Development tools

The website, Makler/n8n and Devin Telegram remain separate projects. Only site code,
site integrations and the site's development configuration belong in this repository.

## Verified upstreams (2026-10-26)

| Tool                                                                                                 | Verified version or revision               | Integration                                                                                                                                |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [Lean-ctx](https://github.com/yvgude/lean-ctx/releases/tag/v3.11.4)                                  | 3.11.4, updated from 3.9.20                | Installed locally; existing shell restrictions and project configuration retained. Restart an existing MCP session to load the new binary. |
| [Graphify](https://pypi.org/project/graphifyy/)                                                      | graphifyy 0.9.95, updated from 0.9.53      | Installed with `uv tool`; use the npm graph commands below.                                                                                |
| [RooFlow](https://github.com/GreatScottyMac/RooFlow/commit/60a801f61e43417a5067d7007e62909d61f3ba17) | `60a801f61e43417a5067d7007e62909d61f3ba17` | Current upstream templates already present. Preserve the local workspace, Windows/PowerShell defaults and project rules.                   |

RooFlow's upstream `.roomodes` matches the local file after line-ending normalization.
The five mode prompts contain deliberate local environment substitutions. Updating
them must not overwrite `.roo/rules/`, `.roo/commands/` or the VS Code/Copilot adapters.

Graphify's SQL extra (`tree-sitter-sql` 0.3.11) is installed so D1 migrations can
contribute to the graph, alongside JavaScript and the other supported languages.

Graphify output, including `GRAPH_REPORT.md`, is generated local state in
`graphify-out/`. It is ignored by Git. The existing local report was retained when
it was removed from the index; it was not discarded.

```sh
npm run graphify:check
npm run graphify
graphify query "booking registration" --budget 1800
```

Review upstream changes before tool upgrades. Use the official updater for Lean-ctx
and `uv tool upgrade graphifyy` for Graphify. Application dependency versions are
reproducible through `package-lock.json`; do not replace the security overrides with
unreviewed transitive upgrades.

## Audit references

The [haraldalder-vibemogger profile](https://github.com/haraldalder-vibemogger)
was reviewed as requested:

- [vibe-audit](https://github.com/haraldalder-vibemogger/vibe-audit): used as a
  heuristic source-code scanner, with manual review of each finding.
- [web-audit](https://github.com/haraldalder-vibemogger/web-audit): its SEO,
  accessibility, consent, headers and dependency categories informed the review.
  Existing site checks were reused rather than adding a duplicate audit framework.
- [mcp-diet](https://github.com/haraldalder-vibemogger/mcp-diet): its code-based
  orchestration pattern is already supplied by this agent's deferred tools and
  code execution. Its Claude-specific SDK generator was not installed into the site.
- [project-memory](https://github.com/haraldalder-vibemogger/project-memory): its
  Claude hooks were not added alongside the established `knowledge/` vault and
  RooFlow `memory-bank/`. A second automatic memory system would duplicate state.

## Preview and release

`npm start`, `npm run dev`, `npm run dev:5502` and `npm run preview` start a
loopback-only server on port 5502. It serves public site paths and rejects dotfiles,
credentials, source/tool directories and symlinks that escape the public tree.
Malformed URLs return 400; form POSTs return 501 so the existing local Functions
fallback can be used. Use `npm run dev:cf` to test actual Pages Functions.

CI validates pull requests and pushes to `main`, alongside CodeQL/Semgrep analysis.
The scanners retain their existing configuration identities and alert history.
Deployment requires analyses for the exact commit and ref and zero open
code scanning alerts, in addition to dependency audits, validation, build budgets,
browser checks and registration recovery checks. Manually dispatched deployments
repeat the quality gates and require the same current-revision security evidence.
