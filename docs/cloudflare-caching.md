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
| Cache HTML pages for 4 hours | **Configured (2026-05-19):** Edge **Bypass cache** + Browser **Bypass cache** (rule still matches `*.html` and `/`) |

Path: **Caching → Cache Rules** → edit rule #2 → disable or change cache action.

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
