# Active Context

Session status: recent changes, current goals, open questions.
2026-07-18 13:20:00 - Memory Bank initialized.

## Current Focus

- Finish Cloudflare MCP OAuth: wait for user to enable Public OAuth App access (`oauth_app_access_enabled`), then authenticate MCP servers.
- Standing rule: when login/OAuth needed — open URLs, wait for user login, then continue automatically (see `.cursor/rules/wait-for-user-login.mdc`).

## Recent Changes

2026-07-18 19:40:00 - SEO soft-404 + Bing + GSC:

- Root cause soft-404: Pages treated site as SPA (index.html without 404.html) → missing URLs returned homepage 200.
- Added `404.html`, legacy EN-slug 301s in `_redirects`, soft-404 self-check `tools/check-soft-404.mjs`.
- Deployed; missing URLs now 404; legacy slugs 301 to canonical pages; GSC 404 validation started.
- Bing: IndexNow 109+109; Submit URL 100 apex; sitemaps OK (2 maps, 0 errors, 152 URLs); `bing-index-all` Windows spawn fixed (`shell: true`).

## Open Questions/Issues

- Full RooFlow Flow-* modes require the Roo Code VS Code extension; Cursor uses this Memory Bank via `.cursor/rules/rooflow-memory-bank.mdc`.
- Semantic Graphify pass (HTML/docs) needs an LLM API key if desired later.

2026-07-18 18:45:00 - MCP professional setup:
- Enabled Cloudflare `oauth_app_access_enabled` (Public OAuth App access) via Edge CDP on HUNDESALON_NIKA.
- Authenticated Cloudflare MCP: cloudflare, bindings, builds, observability (+ docs already ok).
- Authenticated Notion MCP.
- Playwright MCP set to `--browser msedge`.
- Rule saved: wait-for-user-login (`.cursor/rules/wait-for-user-login.mdc` + memory).

2026-07-18 19:10:00 - Cursor Customize lean config (Alan Sakarjaew / HUNDESALON_NIKA):
- **Plugins uninstalled** via Dashboard API: Datadog (`1411`), Omni Analytics (`2729`), 1Password (`768`). Local `installedIds` + caches cleaned.
- **Plugins kept**: Notion Workspace (`404`), Linear (`512`), Figma (`657`).
- **User MCPs** (`~/.cursor/mcp.json`): filesystem-hundesalon, memory, sequential-thinking, playwright (msedge), github, cloudflare-docs/bindings/builds/observability. No Datadog, no webstorm, no gmail, no broken `mcp.cloudflare.com` Code Mode.
- **Rules**: `wait-for-user-login.mdc` + new alwaysApply `do-it-yourself-settings.mdc` (agent executes Settings/plugin/MCP cleanup; no click-path dumping).
- **Skills/hooks/subagents**: no new fluff; project skills stay under `.agents/skills/` (Cloudflare, graphify, ponytail, etc.).
