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

Use the canonical local token **HUNDESALON_NIKA — Zone Ops**:

- Zone resources: **Include** → **Specific zone** → `hundesalon-nika.com`
- Permissions: Zone Read, DNS Edit, Cache Purge, Page Rules Edit, Zone Rules Edit
- Local secret: `CLOUDFLARE_API_TOKEN` in `.dev.vars` and `.cloudflare-api.token` (both gitignored)

Test:

```bash
npm run cf:ensure-api-token
npm run cf:purge-cache
```

## After every production deploy

```bash
npm run deploy:full
```

This runs:

1. `npm run deploy` — build + Cloudflare Pages upload
2. `npm run cf:purge-cache` — purge zone cache. **Wrangler OAuth cannot purge** (scopes: `zone:read`, `pages:write`, no Cache Purge). Use one of:
   - `CLOUDFLARE_API_TOKEN` in `.dev.vars` (create via `npm run cf:open-api-token` → `npm run cf:set-api-token -- <token>`)
   - Dashboard: **Caching → Configuration → Purge Everything**
3. `npm run check:live-html` — quick favicon/canonical check
4. `npm run google:gsc:audit` — full GSC readiness check

Manual purge: **Caching → Configuration → Purge Everything**.

## Verify production HTML

```bash
npm run check:live-html
npm run google:gsc:audit
```

Expect `favicon=true` and correct `canonical=` URLs on `https://hundesalon-nika.com/`.
