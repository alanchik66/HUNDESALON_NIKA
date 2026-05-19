# Cloudflare caching for hundesalon-nika.com

## Problem

A **Cache Rule** named **「Cache HTML pages for 4 hours, browser 30 min」** can override `_headers` and keep stale HTML at the edge after a Pages deploy. Symptoms:

- `npm run google:gsc:audit` fails (missing favicon, wrong canonical)
- `tools/check-live-html.mjs` shows `favicon=false` on production while `*.pages.dev` is correct

`_headers` already sets HTML to `Cache-Control: public, max-age=0, must-revalidate`, but Cache Rules take precedence for edge TTL.

## Recommended Cache Rules (Dashboard)

| Rule | Action |
|------|--------|
| Cache static assets (CSS, JS, images, fonts) for 30 days | **Keep** — matches versioned assets |
| HTML — bypass cache (rename in Dashboard) | **Configured (2026-05-19):** Edge **Bypass cache** + Browser **Bypass cache** (matches `*.html` and `/`) |

Path: **Caching → Cache Rules** → rule #2. Rename from the old “4 hours” label so future edits are obvious.

## API token for automated purge

Wrangler OAuth (`npx wrangler login`) can deploy Pages but often **cannot** purge zone cache.

1. [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**
2. Use **Custom token** with:
   - **Zone** → **Cache Purge**, **Zone** → **Zone** (Read)
   - **Account** → **Cloudflare Pages** → **Edit** (if you deploy via `CLOUDFLARE_API_TOKEN` instead of Wrangler OAuth)
3. Zone resources: **Include** → **Specific zone** → `hundesalon-nika.com`
4. Copy the token once; set `CLOUDFLARE_API_TOKEN` in `.dev.vars` (local, see `.dev.vars.example`) or Cursor Cloud secrets — never commit it.

Test: `npm run cf:purge-cache` (or first `npm run cf:ensure-purge-token` if `.dev.vars` has no token yet — requires creating the token once in Dashboard; Wrangler OAuth cannot create API tokens).

## After every production deploy

```bash
npm run deploy:full
```

This runs:

1. `npm run deploy` — build + Cloudflare Pages upload
2. `npm run cf:purge-cache` — purge zone cache (`CLOUDFLARE_API_TOKEN` with **Cache Purge**, or **Caching → Configuration → Purge Everything** in Dashboard). Wrangler OAuth alone often lacks purge permission; `deploy:full` continues if purge fails.
3. `npm run check:live-html` — quick favicon/canonical check
4. `npm run google:gsc:audit` — full GSC readiness check

Manual purge: **Caching → Configuration → Purge Everything**.

## Verify production HTML

```bash
npm run check:live-html
npm run google:gsc:audit
```

Expect `favicon=true` and correct `canonical=` URLs on `https://hundesalon-nika.com/`.
