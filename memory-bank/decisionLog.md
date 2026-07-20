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

2026-07-20 03:10:00 — Routing conflict resolution (#26 vs #27)

## Decision

Keep **#26 architecture** as canonical: `docs/agents-routing.md` + always-on `.cursor/rules/00-routing-kernel.mdc` + thin `.cursor/rules/40-agent-routing.mdc` + `npm run check:agents-routing`. Retain from #27 only the useful docs (git-workflow Cloud-Agent mandate note, CONTRIBUTING / PROJECT_WORKFLOW / llms pointers) after correcting section refs to kernel §1 / §11.

## Rationale

- Integrity checker and split Cursor rules already shipped on `main` via #26.
- Parallel combined-`40` dialect would have duplicated routing and broken `check:agents-routing` expectations.
- Explicit Git default-vs-mandate text belongs in kernel §11 + `docs/git-workflow.md`, not a second conflict hierarchy.

---

2026-07-20 03:55:00 — Cloud Agent MCP: CLI fallbacks, Desktop OAuth only

## Decision

Keep lean MCP in `.cursor/mcp.json` (Cloudflare suite + Playwright + GitHub) and Notion/Figma/Linear plugins. Do **not** expect interactive MCP Authenticate inside Cloud Agents or iPhone-only sessions. Document CLI fallbacks (`wrangler`/`gh`/Playwright) in playbook; put Pages `account_id` in root `wrangler.toml` so `CLOUDFLARE_ACCOUNT_ID` secret is optional.

## Rationale

- Hosted Notion/Cloudflare MCP need browser OAuth with `cursor://` callback — Cloud Agent reports Authenticate unavailable; iPhone cannot complete it for the agent.
- Leaving Notion `needsAuth` is acceptable vs uninstalling (lean set keeps Notion); Zone/Pages work continues via API token + wrangler.


---

2026-07-20 17:29:40 — Owner: agent must DIY without asking

## Decision

Never pause for confirmation or "reply when done". Execute via API/CLI/filesystem/browser; on login gates open URL, wait/poll, resume (`wait-for-user-login.mdc` + `do-it-yourself-settings.mdc`).

## Rationale

Owner works from phone / intermittent Cursor; asking blocks progress.
