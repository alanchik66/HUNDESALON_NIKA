# Operations runbook — HUNDESALON NIKA

## Routine release (local → GitHub → GitLab → production)

```bash
git checkout main
git pull origin main
npm run check:all          # validate, build, prod checks, git parity
git add -A && git commit -m "…"
npm run git:push           # origin + gitlab
npm run deploy:full        # Cloudflare Pages + post-deploy checks
```

If the message draft endpoint returns 401 after deploy: `npm run sync:service-key`, wait ~10s, `npm run check:message-draft`.

## Commands

| Script | Purpose |
|--------|---------|
| `npm run check:all` | Full health (local + prod + git remotes) |
| `npm run check:live-crawl` | Live HEAD/GET for all 76 sitemap URLs |
| `docs/operations.md` | Project operations, SEO/search accounts, deploy notes |
| `npm run bing:complete` | All 16 Bing WMT sections — see `docs/bing-webmaster-checklist.md` |
| `npm run bing:finish-all` | Edge CDP + Site Scan + robots + Clarity (one command) |
| `npm run check:prod` | Live HTML, GSC audit, message draft endpoint |
| `npm run git:push` | Push `main` to GitHub and GitLab |
| `npm run deploy:full` | Build, deploy Pages, optional purge, IndexNow, prod checks |
| `npm run seo:indexnow` | IndexNow: all sitemap URLs on **apex + www** hosts |
| `npm run bing:index-all` | IndexNow + Bing Submit (100/day) + URL inspection + www property |
| `npm run seo:post-favicon` | IndexNow + purge + live favicon checks after icon update |
| `npm run bing:open` | Open Bing Webmaster (inspection, IndexNow) in browser |
| `npm run bing:edge` | Edge with CDP for `bing:automate` (sign in once) |
| `npm run bing:setup` | Full Bing Webmaster setup (sitemap, users, submit, inspect, IndexNow) |
| `npm run bing:automate` | Submit URLs + request indexing via Edge CDP |
| `npm run bing:api` | Bing URL API — опционально; IndexNow уже уведомляет Bing (ключ в `.dev.vars`) |
| `npm run sync:service-key` | Copy service key from `.dev.vars` -> Pages secret |
| `npm run agents:setup` | GCP impersonation + Cloudflare env + MCP + WIF for all local AI agents |
| `npm run google:setup-agents` | GCP only: gcloud profile + ADC impersonation |
| `npm run google:setup-wif` | Workload Identity Federation for GitHub Actions / remote CI |
| `npm run agents:reload-ides` | Reload Cursor/VS Code windows after env changes |

## AI agents (GCP + Cloudflare)

Project: `hundesalon-nika-shell-2026` · Region: `europe-west3` · SA: `ai-agents-admin@…`

```bash
npm run agents:setup
```

- **Local** (Cursor, VS Code, WebStorm, Grok): gcloud impersonation — no SA JSON keys (org policy blocks them).
- **Remote** (Devin, CI): Cloud Shell script `tools/cloud-shell-gcp-bootstrap.sh` or WIF pool `ai-agents-pool` (GitHub OIDC).
- **Cloudflare**: `CLOUDFLARE_API_TOKEN` from `.dev.vars` → user env + IDE terminals.
- After setup: restart terminals or `npm run agents:reload-ides`.

## Bing favicon / indexing

**Accounts (do not mix):**

| Service | Account |
|---------|---------|
| Google Search Console | `snaiper1984@gmail.com` — keep as-is |
| Bing Webmaster Tools | `snaiper1984@mail.ru` — sign in via `npm run bing:edge` (isolated Edge profile, port 9224) |

1. After favicon deploy: `npm run seo:post-favicon` (IndexNow + live checks).
2. Full Bing setup (recommended): `npm run bing:edge` → sign in as mail.ru → `npm run bing:setup` (sitemap, users, URL submit, inspections, IndexNow).
3. Or step-by-step: `npm run bing:mail-setup` → `npm run bing:verify` → `npm run bing:automate`.
4. **IndexNow** (`seo:indexnow`) — основной канал для Bing; API key опционален: Bing Webmaster → **Settings → API Access** → `.dev.vars` → `npm run bing:api`.
5. **www**: `seo:indexnow` submits apex + www (152 URLs). `www` → apex via 301; canonical stays `https://hundesalon-nika.com`. Bing Submit quota 100/day — rest: `npm run bing:submit-www-rem` next day.
6. **robots.txt**: Bing — только `https://hundesalon-nika.com/robots.txt`. `npm run cf:www-robots-setup`. **Cloudflare:** один токен `HUNDESALON_NIKA — Zone Ops` → `npm run cf:ensure-api-token` (см. `docs/cloudflare-api-tokens.md`).
6. Favicon in Bing SERP often updates in **2–4 weeks** after crawl.

## Cloudflare tokens

Which Dashboard tokens are for what: `docs/cloudflare-api-tokens.md`.

## Cloudflare cache purge

Use a **zone API token** (not a revoked/old token). Create via template:

```bash
npm run cf:open-api-token
# Copy token once, then:
npm run cf:set-api-token -- <paste-token>
npm run cf:ensure-api-token
npm run cf:purge-cache
```

`cf:set-api-token` verifies the token before writing `.dev.vars`. Invalid tokens are rejected.

Permissions: **Zone → Read**, **Zone → DNS → Edit**, **Zone → Cache Purge**, **Zone → Page Rules → Edit**, **Zone → Zone Rules → Edit**, resource `hundesalon-nika.com`.

Without token: Dashboard → **Caching → Purge Everything** after HTML deploys.

## Email (contact forms, info@, CSAM)

| Service | Status | Notes |
|---------|--------|--------|
| **Resend** (forms → `info@`) | Check | Pages must have `RESEND_API_KEY`; test: `npm run resend:check-live` → `success: true` |
| **Email Routing** (`info@`) | OK | Dashboard → Email → Routing: active, DNS configured; mail to `info@` is forwarded |
| **CSAM notify email** | Pending verify | Use `info@hundesalon-nika.com` (matches site imprint); see below |

**CSAM (one-time, ~2 min):**

```bash
npm run cf:open-csam-setup
```

1. Email field: `info@hundesalon-nika.com` (already set in Dashboard if you followed the assistant).
2. Open the inbox for `info@` (or Gmail if routing forwards there) and click Cloudflare’s verification link.
3. On the CSAM page, click **Submit** / **Absenden** when the button is enabled.

Resend vs Routing: **Resend** sends mail from the site (`noreply@hundesalon-nika.com`). **Email Routing** receives mail at `@hundesalon-nika.com`. Both are independent and already configured for production.

## Secrets

| Where | Variables |
|-------|-----------|
| `.dev.vars` (local, gitignored) | `SERVICE_GATEWAY_API_KEY`, optional `RESEND_API_KEY`, optional `CLOUDFLARE_API_TOKEN` |
| Cloudflare Pages | `SERVICE_GATEWAY_API_KEY`, `RESEND_API_KEY` |
## API security (Pages Functions)

- Shared helpers: `functions/_lib/http-security.js` (Origin check, Cache API rate limits, response headers).
- POST endpoints require a valid `Origin` (localhost allowed for `npm run dev:cf`).
- Edge rate limits (per IP, 60s window): `/sendmail` 12, `/message-draft` 30, `/seo-generate` 8.
- WAF (zone edge): `npm run cf:configure-waf-rate-limits` (needs token with Zone WAF Write) or Dashboard via `npm run cf:open-waf-rate-limits`.

## Docs

- Git: `docs/git-workflow.md`
- Cache: `docs/cloudflare-caching.md`
- Message draft endpoint: `functions/message-draft.js`
