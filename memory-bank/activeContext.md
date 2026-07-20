# Active Context

Session status: recent changes, current goals, open questions.
2026-07-18 13:20:00 - Memory Bank initialized.

## Current Focus

- **AI Routing Kernel** live on `main` (`docs/agents-routing.md`, `00-routing-kernel.mdc`, `check:agents-routing`) — #26 architecture; #27 docs merged and reconciled.
- **GBP (ryndenko):** HUNDESALON_NIKA created, profile filled, **not public** until video verify after salon opens. Verify: `https://business.google.com/verify/l/09116836504441086909`
- **Stripe:** test keys in CF; bank ••••1334 + 2FA On; Dashboard submit still blocked (`Unternehmensinformationen Unvollständig` / USt empty). Site payments **OFF** (`PAYMENTS_ONLINE_ENABLED=false`).
- Standing rule: login/OAuth → open URL, wait, resume (`.cursor/rules/wait-for-user-login.mdc`).

## Recent Changes

2026-07-20 03:52:00 - MCP + validate + production deploy check (Cloud Agent):

- `npm run validate` green (lint, links, project, agents-routing, payments).
- Pages production `hundesalon-nika` latest deploy **success** (`11a2cbf9`, commit `54248ce`, aliases apex+www). `pages.dev` HTML OK; apex from agent egress hits CF bot challenge 403.
- Cloud Agent MCP catalog: only `cursor-cloud` (ready) + `Notion` (`needsAuth`). Interactive MCP Authenticate **not available** in Cloud Agent — Notion must be Authenticate’d in Cursor Desktop IDE.
- Project `.cursor/mcp.json` already has Cloudflare suite + Playwright + GitHub (lean template from #30); those HTTP/stdio servers are **not injected** into this Cloud session catalog (Desktop/project MCP). CLI equivalents OK: `gh` authed, Playwright MCP package runnable, Pages API/wrangler with account `25e872aeab8cb246c69142ab07cd0fee`.
- Cursor secret `CLOUDFLARE_API_TOKEN` works for Pages (not Zone list). Root `wrangler.toml` getting explicit `account_id` so Pages CLI does not require `CLOUDFLARE_ACCOUNT_ID` env.

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

## Open Questions/Issues

- USt-IdNr → Impressum (4 locales) + Stripe company when available.
- Stripe **Zustimmen und absenden** when Dashboard Incomplete clears.
- GBP video verify at salon; then Maps URL → `brand-profiles.mjs`.
- Unlock site payments only when salon opens.
