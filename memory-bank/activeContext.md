# Active Context

Session status: recent changes, current goals, open questions.
2026-07-18 13:20:00 - Memory Bank initialized.

## Current Focus

- Local citations follow-up mostly done (Maps live, GS confirmed, GBP created pending verify, 11880 submitted).
- **GBP still unverified** — only **video** offered; wait poll finished with **no upload** (still waiting). Verify URL: `https://business.google.com/verify/l/07906466805416970763` (`snaiper1984@gmail.com`). User must record at salon + upload.
- Standing rule: when login/OAuth needed — open URLs, wait for user login, then continue automatically (see `.cursor/rules/wait-for-user-login.mdc`).

## Recent Changes

2026-07-18 22:15:00 - GBP video verify wait (wait-for-user-login):

- Opened/kept verify URL in Edge + Playwright as `snaiper1984@gmail.com`: `https://business.google.com/verify/l/07906466805416970763`.
- Advanced wizard past duplicate list («Ничего не подходит») → only method **Отправить видео компании**; tips / «Начать запись» ready.
- Polled ~45–60+ min wall time: **no video submitted**, status still needs confirmation (wizard ~20–27%, not pending review). Profile still not public (“Ваша компания не видна пользователям”).
- Leipzig Branchenbuch email skipped (no RESEND_API_KEY).
- **Next (user):** at salon, one continuous clip — street → permanent HUNDESALON NIKA sign → interior; use «Начать запись» / upload in open Edge tab (Google disallows pre-recorded). After pending review → recheck website `https://hundesalon-nika.com/de/` then go public when Google approves.

2026-07-18 21:05:00 - GBP follow-up (post citations deploy):

- Opened GBP as `snaiper1984@gmail.com`; status still **Требуется подтверждение / 0% verified**. Duplicate-business list → none match; only **video** verification (no postcard/SMS). Edge left on verify flow “Начать запись”.
- Profile filled without verify: **Tierfriseur**; phone `0151 72450988`; website `/de/`; DE description saved; **Öffnungszeiten Mo–So 09:00–21:00** saved.
- Leipzig Branchenbuch email **not sent** — `RESEND_API_KEY` absent from `.dev.vars` / env; draft still `temp/leipzig-branchenbuch-email.txt` (To intended: `wirtschaft@leipzig.de`).
- User must: shoot continuous verification video at Walter-Markov-Ring 1 (street + sign + interior access), upload in open verify tab; optionally send Branchenbuch email once Resend key available.

2026-07-18 20:50:00 - Local citations / Maps NAP fix:

- **Teplice Maps bug fixed:** `config/brand-profiles.mjs` + ~20 locale pages + `llms.txt` pointed at wrong CZ PetGrooming place; now Leipzig NAP search URL. Commit `c1e3795`. Deployed + CDN purge + IndexNow; live `/de/` and `/de/kontakty` verified Leipzig (no Teplice).
- **Gelbe Seiten:** confirmation email found in `snaiper1984@gmail.com` (forwarded from `info@`); confirm link opened — status: already confirmed, entry in review (“wird bereits bearbeitet”).
- **GBP:** created under `snaiper1984@gmail.com` — HUNDESALON NIKA, Tierfriseur, Walter-Markov-Ring 1, 04288 Leipzig, phone +49 151 72450988, website `https://hundesalon-nika.com/de/`. Verify later chosen (video was only immediate option). Profile setup ~100%; **public visibility blocked until user verifies** (video or later postcard/phone if offered). Location verify URL path id `07906466805416970763`.
- **11880:** submitted successfully (Branche `Hundefriseur`, step Bestätigung — “Vielen Dank für Ihren Eintrag”).
- **Leipzig Branchenbuch email:** draft remains `temp/leipzig-branchenbuch-email.txt`; not sent (no Resend key locally; draft has no explicit recipient).
- Still for user: GBP verification (video/other), optional hours/photos/description polish in Business Profile, optional send Leipzig city directory email.

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

2026-07-19 02:35:55 - Google Ads wrap-up (ryndenko, non-media, PAUSED):

- Account ryndenko1982@gmail.com · CID 530-092-3191 · Chrome CDP — campaign draft stays PAUSED / not launched.
- Fixed Final URL back to https://hundesalon-nika.com/ (had been corrupted mid-session).
- Scrubbed EN long headlines containing «grooming»; short HL DE-first; logos (2) / images (20) left as-is; videos (0) postponed.
- Status file: temp/ads-ryndenko-prep-status.md. Draft promos on disk under assets/video/ads/ for tomorrow media.
- €400 promo: documented only, not claimed. snaiper1984: deferred (needs account switch login).
