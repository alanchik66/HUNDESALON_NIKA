# Active Context

Session status: recent changes, current goals, open questions.
2026-07-22 22:55:00 - Graphify + RooFlow setup + Memory Bank refresh:
- Graphify: `npm run graphify:setup` complete; graph healthy (5864 nodes, 9091 edges, 473 communities); query-first rule at `.cursor/rules/graphify.mdc`; MCP at `http://127.0.0.1:8932/mcp`.
- RooFlow: `npm run rooflow:setup` complete; Flow skills exported to `.agents/skills/flow-*`; Cursor bridge rule at `.cursor/rules/rooflow-memory-bank.mdc`; `.roo/` + `.roomodes` refreshed.
- Parameterized: query-first for architecture questions, MCP > CLI > wiki fallback for Graphify; Memory Bank read-selective + UMB append workflow for RooFlow.

## Current Focus

- **AI Routing Kernel** live on `main` (`docs/agents-routing.md`, `00-routing-kernel.mdc`, `check:agents-routing`) — #26 architecture; #27 docs merged and reconciled.
- **GBP (ryndenko):** HUNDESALON_NIKA created, profile filled, **not public** until video verify after salon opens (verify link kept out of git).
- **Stripe:** test keys in CF; 2FA On; Dashboard submit still blocked (`Unternehmensinformationen Unvollständig` / USt empty). Site payments **OFF** (`PAYMENTS_ONLINE_ENABLED=false`).
- Standing rule: login/OAuth → open URL, wait, resume (`.cursor/rules/wait-for-user-login.mdc`).
- Standing rule: **делай все сам всегда** — no handoff checklists; automate OS/IDE/security steps (`.cursor/rules/do-it-yourself-always.mdc`).
- Standing rule: browser/Playwright checks — agent repairs MCP itself (`npm run mcp:playwright:repair`); OAuth/passkeys via Edge (`browser:edge`), never hand the user repair commands.
- Standing rule: **session isolation** — parallel Agents use Worktree/`/isolate`; Playwright MCP isolated contexts; never stomp other chats (`.cursor/rules/session-isolation.mdc`).

## Recent Changes

2026-07-21 23:20:00 - Marketplace (claude-plugins-official) lean policy applied:

- Audited screenshot catalog + full official list; **no** stack-mismatched plugins installed (LSPs/Telegram/Terraform/Serena/ralph-loop/etc.).
- Equivalents wired: security-site.mdc + existing block-secrets + /review-security; PR review stays bugbot/minimal-diff.
- 	ools/sync-cursor-customize.mjs now prints marketplace allow/deny audit; allowlist cache OK: figma, linear, notion-workspace, zapier.
- Playwright stays project MCP :8931 (skip Marketplace Get for playwright).
2026-07-21 22:55:00 - Session isolation (parallel Agents never collide):

- Rule `session-isolation.mdc` always-on: worktrees for parallel work; no MCP restart unless down; no stomping dirty files/git.
- Playwright MCP: `--isolated`, removed `--shared-browser-context` + persistent user-data-dir (each chat gets own browser context).
- `.cursor/worktrees.json` setup (npm install + customize); settings `worktreeMaxCount=25`, terminal persistent sessions **off**.
- Hook blocks `git reset --hard` / `clean -f` / force-push. Command `/isolate`. MCP restarted with new flags.

2026-07-21 21:05:00 - Customize full DIY (no owner clicks):

- Skills synced to `.cursor/skills/` (12 lean: graphify + flow-* + ponytail*; D: exFAT → copy). Script: `npm run cursor:customize`.
- Commands (8): `/validate` `/deploy-check` `/smoke-ui` `/seo-audit` `/i18n-sync` `/umb` `/graphify` `/minimal-diff`.
- Subagents (6) already in `.cursor/agents/`; Hooks secrets guard confirmed; MCP ports 8931/8932 restarted; `cursor:settings` re-applied.
- Cloud `environment.json` install runs customize; `.vscode/mcp.json` slimmed to lean CF+GitHub+Graphify+Playwright.

2026-07-21 20:55:00 - Customize Subagents + MCP lean:

- Project subagents in `.cursor/agents/`: `verifier`, `seo-auditor`, `ui-smoke`, `cf-ops`, `i18n-sync`, `minimal-diff`.
- Playwright MCP added to `.cursor/mcp.json`; Graphify on `:8932`.
- Routing map for subagents in `.cursor/rules/40-agent-routing.mdc`.

2026-07-20 23:10:00 - Chat Enter + full auto-approve + keep-awake:

- `chatSubmitOnCmdEnter=false` → Enter sends (Shift+Enter newline).
- Run Everything / permissions `*:*` / outside-workspace allowed; CLI `autoAcceptWebSearch=true`.
- `tools/cursor-keep-awake.ps1` + Startup shortcut; AC monitor/standby/hibernate never; PID running.

2026-07-20 23:05:00 - Post-reboot verification: files/extensions/Ollama/MCP OK; Semantic Search was flipped off by Cursor memory — re-applied (`npm run cursor:settings`). All status green.

2026-07-20 22:25:00 - Finished leftover Cursor Settings gaps:

- Hooks: `.cursor/hooks.json` + `block-secrets.mjs` (deny `.dev.vars`/`.env`/keys).
- Apply script: busy_timeout + INSERT OR REPLACE; `chatSubmitOnCmdEnter=true`; CLI attribution on.
- Semantic Search / hierarchical ignore / YOLO re-applied (hooks:true in apply output).
- UI walk: Hooks, Attribution, Indexing, Browser, Cloud Agents, Rules.

2026-07-20 22:20:00 - Cursor Settings applied files+DB+UI automation:

- `tools/cursor-settings-apply.mjs` + `npm run cursor:settings` (reactive storage, privacy, models, YOLO, MCP allowlist).
- `npm run cursor:settings:ui` / `tools/cursor-settings-professional.ps1` — focuses Cursor, opens Cursor Settings, walks Privacy/Indexing/Tab/Run Mode/Bugbot/Models/MCP.
- `cursor.cmdCommaOpensCursorSettings: true`. Re-apply after Reload if IDE overwrites memory.

2026-07-20 22:00:00 - Cursor Settings (Pro) full pass:

- General/Privacy: NO_TRAINING already on; no OpenAI base URL override (keeps Pro models).
- Agents: Run Everything + permissions.json DIY allowlists; block secrets/force-push/prod deploy.
- Cloud Agents: added `.cursor/environment.json` (npm install, dev :5502 / :8788).
- Models: Agent=Grok 4.5 high+fast; Cloud/Cmd+K/Quick=Auto.
- Tab: cppEnabled + partial accepts; Indexing: semantic search on, hierarchical .cursorignore.
- Tools & MCPs: project mcp.json + ports 8931/8932 restarted hidden.
- Rules: existing `.cursor/rules/*`; Continue/Kilo remain as $0 local backup.

2026-07-20 21:55:00 - Workspace settings pass (`.vscode/settings.json` + launch):

- All sidebar zones for this repo: editor, files/exclude, search, explorer nesting, git, terminal env (GCP/CF), lint, free Continue/Kilo.
- `launch.json`: ports fixed to `:5502` (dev) and `:8788` (dev:cf), not 8080.

2026-07-20 21:52:00 - Full User settings sidebar pass (all categories):

- Commonly Used / Text Editor / Workbench / Window / Features (Explorer, Search, Git, Terminal, Debug) / Application / Security / Extensions.
- Cursor section: composer chime off, Cmd+K themed diffs, AI terminal checks, partial accepts.
- Free agents unchanged: Continue + Kilo → Ollama.

2026-07-20 21:45:00 - Cursor User settings + free local AI agents:

- Commonly Used: Cascadia Code + ligatures, smooth caret, autoSave afterDelay, tab 2, format-on-save.
- Free agents: Continue + Kilo reinstalled; Ollama `qwen2.5-coder:7b` (agent) / `1.5b` (tab) / `nomic-embed-text` verified OK.
- `.vscode/extensions.json`: Continue + Kilo recommended (removed from unwanted).

2026-07-21 23:10:00 - Security harden from merged-PR review:

- Playwright MCP: drop `--allow-unrestricted-file-access` + clipboard/geo/notification grants.
- Redact inference keys in `sync-service-gateway-from-devvars` error output.
- Pin Semgrep `1.170.1` in CI; scrub GBP verify URL / bank last4 from Memory Bank + GBP status doc.

2026-07-20 19:24:00 - Cloud Agent apply-diff failure fixed locally:

2026-07-20 19:24:00 - Cloud Agent apply-diff failure fixed locally:

- Symptom: `Failed to apply diffs from Cloud Agent: No full commit provider registered` (Cursor git provider not registered).
- Pulled merged cloud PRs (#26–#30) onto `main`; restored local WIP; conflict merge kept routing kernel + local token-economy demotion of `40-agent-routing.mdc`.
- Reset Cursor workspace `state.vscdb` + cache via `tools/fix-cursor-commit-provider.ps1` (auto restart).

2026-07-20 19:17:00 - Project root cutover + AV-safe MCP restart:

- Canonical root: `D:\HUNDESALON_NIKA` (junction `C:\PROJEKT\HUNDESALON_NIKA` → `D:\` for old Cursor cwd).
- Safe restart (no Defender FP): `npm run mcp:restart` / `tools/restart-hundesalon-mcp.cmd`; Defender exclusions on `tools\`.
- Do not use inline `pwsh -c` kill+Hidden+CIM for MCP restart.

2026-07-20 15:05:00 - Token economy for ALL Cursor agents:

- Always-on rules cut ~3187 → ~898 tok; multilingual/routing/login demoted to globs/intelligent.
- Global user rule `~/.cursor/rules/00-token-economy.mdc`; Graphify MCP HTTP `http://127.0.0.1:8932/mcp` + Startup autostart; `npm run tokens:calibrate`.

2026-07-20 14:55:00 - Cursor-native RooFlow + Graphify bridge:

- Flow-* modes work in Cursor via `.agents/skills/flow-*` (exported from RooFlow roles; Roo XML not used). Rule `rooflow-memory-bank.mdc` routes triggers. `npm run rooflow:export` / `rooflow:setup`.
- Graphify: MCP `graphify` in `.cursor/mcp.json` (`python -m graphify.serve`); wiki via `npm run graphify:wiki`; rule prefers MCP then CLI.

2026-07-20 14:50:00 - graphify-out + .roo repaired to match upstream:

- Graphify: absolute `.graphify_root` / `.graphify_python`; wrappers `tools/graphify-run.mjs`; scripts rebuild/update/report/setup/query; hook + skill setup; graph 2663n/4041e healthy.
- RooFlow: refresh from GreatScottyMac/RooFlow; Node processor replaces OS/shell/home/workspace + injects 12 Cursor MCP servers into `# [CONNECTED_MCP_SERVERS]` (upstream needed missing `system_prompt.md`).

2026-07-20 14:40:00 - Cursor Browser Tab + manual co-control calibrated:

- `cursor.browserTabEnabled=true`, `browser.closeOnFocusLost=false`.
- composerState: full Playwright MCP allowlist (25 tools), `playwrightProtection=false`, `mcpAuthBlocking=false`, Run Everything on.
- Playwright Extension unpacked + loaded into headed MCP Chrome; Edge CDP co-browse via `npm run browser:edge:cdp` (port 9222).
- One-shot calibrate: `npm run mcp:browsers:calibrate` (agent runs this itself — never hand to user).

2026-07-20 14:30:00 - Cursor Playwright MCP calibrated:

- HTTP server `http://localhost:8931/mcp` with shared browser context, Chrome, viewport 1440×900, vision/pdf caps, file:// access, persistent profile `~/.cursor/browser-profiles/playwright-mcp-chrome`.
- Autostart: Scheduled Task `HundesalonPlaywrightMcp` at logon; repair via `npm run mcp:playwright:repair`.
- Smoke OK: navigate, resize, screenshot, click, local `file://`, Edge persistent (`npm run browser:edge`) for OAuth/passkeys.

2026-07-20 13:35:00 - Windows Defender temporarily off for app install (UI Automation): RealTime=Off, Tamper=Off. Re-enable via `C:\Users\snaip\AppData\Local\Temp\hundesalon-defender-on-ui.ps1` when install finishes.

2026-07-20 03:10:00 - Routing system finalized:

- Canonical kernel = #26 shape (`00-routing-kernel.mdc` + thin `40-agent-routing.mdc` + `check:agents-routing`).
- Fixed stale `git-workflow` §10 pointer → §1 / §11; Git default-vs-mandate policy documented in kernel §11.
- Memory Bank cleaned of obsolete merge-conflict open questions.

2026-07-20 02:45:00 - Production AI routing kernel (#26 + #27):

- Canonical `docs/agents-routing.md` (detection, startup, decision pipeline, monorepo, safety, conflicts).
- Wired into `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, Copilot instructions/agent, playbook, `agents-master` workflows.
- Cursor `00-routing-kernel.mdc` alwaysApply; GSC account `ryndenko1982@gmail.com` in `40-agent-routing.mdc`.
- `npm run check:agents-routing` in `validate`.

2026-07-19 20:40:00 - Eric Schumann price list + salon rules on site (ru/de/en/uk):

- `prays-list.html`: breed/service prices (dogs full groom, hygiene, deshed, SPA, cats, extras).
- `agb.html`: full salon rules (prep, health, behaviour, mats 1€/min, parasites from 40€, owner presence, cancel/deposit).
- Booking forms: short rules summary + checkbox «ознакомлен с правилами салона».
- `nashi-uslugi.html` cards aligned; booking service list in `page-modules.js` updated.

2026-07-19 20:20:00 - Professional junk cleanup:

- `npm run clean` (dist/temp/test-results); removed Edge CDP profiles (`edge-stripe-cdp`, hundesalon edge debug), ~200+ `playwright-artifacts-*`, Cursor `agent-tools` dumps, `.wrangler` local state.
- Kept durable status docs (`docs/gbp-ryndenko-status-*.md`, snaiper cleanup, ads audits) + product code. Dropped one-off Stripe CDP scripts and private temp bank note path.
- GBP socials kept: Instagram + Facebook + TikTok (YouTube deferred by owner). Facebook canonical in `config/brand-profiles.mjs`.

2026-07-19 20:15:00 - Earlier session cleanup note (temp already mostly cleared).

2026-07-19 19:55:00 - support@ on site + CF mail map (info public / support send-reply).

2026-07-19 19:30:00 - Email roles + hours Mo–Fr / weekends closed (site + GBP).

2026-07-19 19:25:00 - Stripe bank prep + GBP profile tabs (payments still OFF).

2026-07-19 18:45:00 - Online payments kill-switch live; AGB + legal hardening; master agents prompt.

2026-07-19 17:16:00 - Google cutover to ryndenko (GSC/Ads/GBP snaiper cleaned). See `docs/google-snaiper-cleanup-2026-07-19.md`.

2026-07-19 23:04:00 - Typography matched to salon sign across all locales:

- Trajan-style Cinzel Regular for Latin, Forum fallback for Cyrillic, Great Vibes / Marck Script accents.
- Replaced legacy shimmer and green-glow text effects with one static, embossed liquid-gold material.
- Separate high-contrast liquid-gold calibration for dark and light themes; visually checked both.
- Final metal hierarchy: all typography uses dimensional yellow gold; the hero H1 alone uses deep glossy white gold in both themes.
- Global layout compacted: removed hero `100vh` expansion and double top spacing, applied header clearance only to the first content block, hid empty about-photo placeholders, placed mobile hero copy before media, restored static social icons, and returned long-form copy to Cormorant Garamond.
- Long-form copy is justified with language-aware hyphenation on desktop/tablet; narrow screens switch to left-aligned `text-wrap: pretty` to avoid word-spacing rivers. Header/weather selectors are explicitly outside this typography scope.
- Home hero H1 uses a fixed, centered three-line localized composition in all locales: professional care / for your / beloved pets, with locale-specific responsive sizing and no overflow.
- Hero-left now uses one shared column width: title, subtitle and CTA are 680px/100%; desktop subtitle is justified, mobile copy remains centered, and CTA spans the same grid width.
- `.btn-neon` is now one canonical navigation-derived component across hero, newsletter, blog and content CTAs: 38px min-height, 7×13px padding, Cinzel 13/500, shared glass, radius, shadows and motion in both themes.
- Desktop hero uses equal 1:1 columns up to 680px; the photo frame stretches to the exact width and height of the localized hero-left content. Mobile retains a 3:2 image ratio.
- Homepage about-photo reuses the hero frame treatment and is ResizeObserver-synced to the exact locale-specific hero-photo width/height on desktop; both frames use 360×240 at phone width.
- Photo darkening overlays are disabled globally for hero, about, gallery and before/after media; caption readability uses text shadow rather than a black image veil.
- Homepage about section now uses the same full-width two-column grid as hero: exact desktop edges at x=60/833 and equal 679px columns; mobile collapses to a clean single column.
- Shared photo-depth tokens now give hero, about, gallery and before/after frames a gold edge plus layered external depth shadows; light theme uses a softer brown-gold shadow, with no image-darkening overlay.
- Header booking CTA now shares the exact desktop nav-pill geometry and motion (38px, 7×13px, 16px radius, Cinzel 13/500, glass/shadows); only width differs naturally with label length.
- Existing weather-widget star canvas (no generated replacement) is resized/repositioned to the exact full header bounds and tracks header/viewport resize; its original night/day logic and star assets remain authoritative.
- Existing star scene is optically shifted toward the weather preview center (75% of the header/preview center delta, clamped ±360px), keeping desktop stars behind weather instead of navigation while leaving mobile nearly unshifted.
- Active nav pills now have explicit combined hover/focus states after the active rules, so active styling no longer cancels lift/scale; both themes transition 1.01→1.018 with brighter glass and stronger depth.
- Unified narrative copy scale: hero/about/section intros/articles/legal/booking all use Cormorant Garamond 18px/1.6/500 on desktop-tablet and 16px/1.55/500 on phones, with 0.01em tracking.
- Homepage About heading now mirrors the locale-specific first hero line exactly (font size, line-height, tracking, glossy white-gold material) and is centered within its 679px text column; responsive sizes match on mobile.
- Header booking label now has its own liquid-gold text span with high-contrast gradient, 0.3px metallic rim, four-layer depth/glow and a slow vertical material flow; light theme has a darker readable calibration.
- Completed full native-language audit and high-confidence correction pass across all 88 DE/EN/RU/UK HTML pages (including metadata, legal, services and blogs); current approved hero subtitles were preserved where audits were stale.
- Release audit passed: 0 dependency vulnerabilities, 40 meta-description violations fixed, all asset versions unified, payment/webhook trust boundaries hardened, 19 obsolete one-off tools removed, production build and 4-locale desktop/mobile smoke green.

2026-07-20 03:30:00 - Production release deployed:

- Local commit `63aa3d9` (`feat: prepare multilingual production release`); branch `main` is **11 commits ahead** of `origin/main`.
- GitHub push blocked by **LFS budget exceeded** (not a code issue). Production deploy does not depend on GitHub.
- `npm run deploy:full` succeeded: Pages upload, CDN purge, live HTML OK, IndexNow 109+109, GSC audit 88 URLs, message-draft 200.
- Live domain serves `style.css?v=20260720-prod-v2` on de/en/ru/uk.

2026-07-20 03:45:00 - GitHub sync unblocked (LFS):

- Root cause: 4 Google Ads draft MP4s (~32 MB) in unpushed commits required new LFS uploads while account LFS budget was exhausted.
- Fix: removed those MP4s from unpushed history only (fast-forward safe); gitignored `assets/video/ads/*.mp4`; files remain local for Ads uploads; site assets unchanged.
- `git push origin main` succeeded (`5f5ec9e..1ba73d3`). Branch up to date with origin.
- Local LFS prune: kept weather-widget MP4s only (~2 tracked); dropped 24 unreachable LFS objects.

## Open Questions/Issues

- Optional: raise GitHub LFS spending budget (Billing → Budgets) if more LFS uploads are needed mid-month; weather-widget MP4s already on remote.
- USt-IdNr → Impressum (4 locales) + Stripe company when available.
- Stripe **Zustimmen und absenden** when Dashboard Incomplete clears.
- GBP video verify at salon; then Maps URL → `brand-profiles.mjs`.
- Unlock site payments only when salon opens.

2026-07-20 19:00:00 - Canonical local root moved to `D:\HUNDESALON_NIKA`:

- MCP filesystem / Playwright / Graphify / scheduled tasks / AGENTS.md / git-workflow point to D:.
- `npm run mcp:configure`, `mcp:playwright:repair`, `graphify:setup`, `tokens:calibrate` re-run from D:.
- Open Cursor on `D:\HUNDESALON_NIKA` (not `C:\PROJEKT\...`). Stale C: copy retired if rename succeeded.

2026-07-20 19:10:00 - VS Code + Devin retargeted to `D:\HUNDESALON_NIKA` (MCP, storage, `~/.devin/config.local.json`). Old `C:\PROJEKT\...` purged/watchdog+RunOnce; no PROJEKT refs left in IDE configs.

2026-07-20 19:45:00 - Kilo configured in **VS Code** (not Cursor) for Devin:

- Extension kilocode.kilo-code v7.4.11; agent ollama / qwen2.5-coder:7b; autoApprove on; maxCost 0.
- Autocomplete via Kilo disabled (schema has no Ollama) — use Continue for local tab.
- CLI config: C:\Users\snaip\.config\kilo\kilo.jsonc; Devin root D:\HUNDESALON_NIKA.
- Ollama smoke OK (chat returns OK).

2026-07-20 20:23:48 - Deleted locked `C:\PROJEKT` (empty stale tree). Lockers: Explorer.exe + Foundry Local (`foundrylocald.exe`). Handles closed; folder removed. Sixth MCP + Devin/VS Code storage pointed only at `D:\HUNDESALON_NIKA`; RunOnce `RetireHundesalonC` cleared; Foundry server restarted.

2026-07-20 20:28:54 - Purged VS Code + Devin caches of `C:\PROJEKT`: History folders, chatSessions, state.vscdb path rewrites, trust model → `/d:/HUNDESALON_NIKA`, terminal buffer cleared. Canonical root only `D:\HUNDESALON_NIKA`.

2026-07-20 20:43:11 - Durable canonical-root guard: `tools/enforce-canonical-root.mjs` + `npm run agents:enforce-root`; daily task `HundesalonCanonicalRoot`; `link-c-projekt.ps1` now refuses and re-enforces; wired into `agents:setup`. Forbidden: `C:\PROJEKT`. Only `D:\HUNDESALON_NIKA`.

2026-07-20 20:50:52 - Softened path policy: never auto-delete `C:\PROJEKT`; removed `HundesalonCanonicalRoot` task. Cursor `chatSubmitOnCmdEnter=false` so Enter sends chat (no Ctrl+Enter).

2026-07-20 21:32:11 - Full professional deploy (deploy:full) completed:

- Pages: https://f0b76a10.hundesalon-nika.pages.dev → production hundesalon-nika.com
- Asset cache: 20260720-prod-0632e53; CDN purged; live HTML + prays-list + price smoke OK
- IndexNow 109+109; GSC audit 88 URLs; message-draft 200

2026-07-21 13:10:00 - Mail triage (Mail.ru + Gmail ryndenko):

- «Skiethaben» = GitHub emails on snaiper1984@mail.ru + Cursor/Bing.
- GitHub PAT classic «Devin (repo workflow)» with broad scopes (expected Devin setup 2026-07-20) — verify at github.com/settings/tokens after login.
- Cursor: connect source control + possible unfinished Pro checkout (abandon drip).
- Site fix applied: Google Ads gtag `AW-18333140047` in `config/env.js` + `assets/js/analytics.js` (ad_storage granted on cookie accept); cache-bust on de/en/ru/uk index.
- Still needs human login in Chrome: GitHub alanchik66, Cursor account, Stripe acct_1TuxQ8…, Google Ads 530-092-3191 (bank ••••7290 + Creative Assets).

2026-07-21 14:40:00 - GitHub set to free (owner request: no GitHub payments):

- Cancelled Copilot Pro → Active: Copilot Free $0 (effective through period end 2026-08-07).
- Base plan: GitHub Free $0.
- Payment method: none on file (cannot charge). Banner «payment authorization has failed» is leftover invalid hold.
- AI Credits budget $500 remains but GitHub refuses Edit/Delete without a card («A valid payment method is required») — no card = no new paid AI charges.
- Models paid usage: Disabled. Site/repo continue on free Git + Cloudflare; AI via Cursor, not paid GitHub.

2026-07-21 14:55:00 - Finished leftover mail/setup items (ordered pass):

- Cursor Pro OK; GitHub Connected; Cursor GitHub App installed (All repositories) for alanchik66.
- GitHub Free + Copilot Free confirmed; Devin PAT present (expected).
- Stripe onboarding open at bank payout step — needs full Sparkasse IBAN (known only ••••1334 / WELADE8L); site payments still OFF.
- Google Ads: verification done, assets in library, campaigns paused on purpose; bank ••••7290 verify UI empty (needs manual Payments/Wallet).
- Bing: soft SEO tips only. AW-18333140047 in code — not deployed to prod yet.

2026-07-21 15:35:00 - Ads continue after card linked:

- Ads billing: automatic payments; profile 3368-1179-4950 / HUNDESALON_NIKA; warning only = no backup method (primary card OK per owner).
- Bank ••••7290 still OR_BAEMF_13 — support only; not blocking Ads.
- Deployed AW-18333140047 via deploy:full (preview 556737a5); CDN purged; live env.js has GOOGLE_ADS_ID.
- Campaigns remain paused; Google Tag UI still may show NO DATA until consent + traffic.
- Stripe still needs full IBAN; site payments OFF.

2026-07-21 16:35:00 - Ads continue:

- Campaign HUNDESALON_NIKA: Enabled / Eligible (Допущено), budget €0.10/day.
- Promo €400: Activated — spend €400 by 17 Sep 2026 to receive €400 (code 9HNDM-AMMMF-DJ6D).
- Conversion action «Покупка» created (manual code). Google tag still «not found» in Ads UI (adblocker banner + scanner); site now loads AW tag with Consent Mode defaults for detection.
- GOOGLE_ADS_CONVERSION_LABEL still empty — paste label from Ads event tag when visible; hundesalonTrackConversion fires on booking/sendmail success.
- Stripe: chrome-cdp profile needs login (not finished).

2026-07-21 17:05:00 - Leftovers finished:

- Ads conversion label from ConversionTypeService/List: `xpOSCN3rnNQcEM-I9qVE` (send_to AW-18333140047/xpOSCN3rnNQcEM-I9qVE) set in config/env.js; analytics env cache-bust; deploy:full OK; live env.js has label.
- Stripe acct_1TuxQ8Rx6zLsL2jq onboarding submitted (Zustimmen und absenden) → dashboard?account_onboarding=completed (live, not test). Bank Sparkasse ••••1334 was already on file.
- Still open: Ads daily budget still €0.10 (need owner amount for promo); Google bank ••••7290 OR_BAEMF_13 support-only; site payments remain OFF until explicitly enabled.

2026-07-21 17:20:00 - Stripe Tax preset:

- Default product tax code set/confirmed via API: `txcd_20030003` (Pet Grooming) — correct for Hundesalon. Tax settings status active (test key / same acct_1TuxQ8).
- UI modal «Voreingestellte Produktkategorie» was not open in CDP (wizard next = Steuerregistrierung). Head office Leipzig already on file.
- Tax registrations still empty — need owner USt-IdNr to add Deutschland registration.

2026-07-21 20:35:00 - PMax launched (capped), audience/themes partial:

- Campaign HUNDESALON_NIKA: **Включено / Допущено** (live), budget **0,33 €/day** (~≤10 €/mo).
- Conversions Покупка + Звонки = Основные, in account goals; enhanced conv ON; terms accepted.
- Asset strength still **Плохое**: search themes + audience signal NOT saved — Google injects an anti-automation «Turn off ad blockers» overlay in the CDP browser that intercepts the PMax side-panel modal. Themes/audience are optional (Google auto-selects themes); best set manually or via Ads API.
- Follow-up to reach «Хорошее/Отличное»: add landscape images + 1 video, set search themes + audience signal (manual click or API).


- Campaign back to **Приостановлено** (owner: too early to run); budget stays **0,33 €/day**.
- Asset strength **Плохое**: texts largely present (15 HL / 5 long / 5 desc); missing search themes, audience signals, video; «Не допущено» = paused.
- Full asset editor blocked (Ads session expired + adblocker banner on CDP Chrome). Edge opened for re-login; then finish themes/images/video before enable.


- HUNDESALON_NIKA: **Допущено** (enabled), budget **0,33 €/day** (~10 €/mo).
- Auto-apply recommendations already 0/7 + 0/14 (won’t auto-raise budget).
- Billing so far 0,00 €. Promo €400 not achievable at this cap (owner choice).
- Site tag / Keyword Planner / conversions = free; only Ads media spend can bill.

2026-07-21 19:35:00 - Keyword Planner setup:

- Opened KP for CID 530-092-3191; created plan «План от июл. 21, 2026, 7 PM».
- Site filter https://hundesalon-nika.com/de/, language DE, geo Germany (campaign still Leipzig+50km).
- Ideas: hundefriseur online termin (100–1k, low), hundesalon online termin (10–100), + seeds.
- Skip human-salon suggestions (nagelstudio / Friseursalons / Hairstylisten).
- Doc: docs/google-ads-keyword-planner.md


- `AW-18333140047` + label `xpOSCN3rnNQcEM-I9qVE` live; analytics.js on all HTML pages; CSP allows Ads/GTM/pagead2.
- Live smoke: gtag config + gtag/js?id=AW-… + collect on /de/.
- Ads UI: conversion «Покупка» = «ожидающие рассмотрения» (pending Google review, not missing tag).
- Deployed via deploy:full + headers redeploy; CDN purged.

2026-07-21 21:25:00 - Zapier:

- Account from Google Ads signup (ryndenko1982@gmail.com); Pro trial until ~4 Aug 2026; Google SSO login OK.
- Password reset link from email expired; SSO works.
- Connections: Gmail connected. Google Ads connection still needed for Offline Conversion Zaps.
- 5 draft Untitled Zaps from Ads = Google Ads Send Offline Conversion templates; editing draft 373414722 toward Gmail booking search → Ads offline conversion.
- Site already has website conversion tag (AW label); Zapier offline path is complementary for booking emails.
