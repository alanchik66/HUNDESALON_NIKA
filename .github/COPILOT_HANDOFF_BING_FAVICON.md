# Handoff: Bing Webmaster Tools — HUNDESALON NIKA

## Accounts

| Service | Account |
|---------|---------|
| Google Search Console | `snaiper1984@gmail.com` |
| Bing Webmaster Tools | `snaiper1984@mail.ru` |

## Done (automated)

- Site **verified** on Bing (meta tag `msvalidate.01` on all pages)
- **Sitemap**: `https://hundesalon-nika.com/sitemap.xml` in Bing
- **IndexNow**: 76 URLs via CLI; Bing dashboard shows **763+** submissions (Self + Cloudflare)
- **Submit URLs**: 50 priority URLs via Bing Webmaster
- **Search stats** visible (clicks/impressions)
- Favicons on production (`?v=20260519-tight-fit`)

## One command for full setup

```bash
npm run bing:edge    # sign in as snaiper1984@mail.ru in that Edge window only
npm run bing:setup   # sitemap, users, submit, inspect, IndexNow
```

## Optional manual polish

1. **Settings → API Access** → key in `.dev.vars` as `BING_WEBMASTER_API_KEY` → `npm run bing:api`
2. **URL Inspection** → `https://hundesalon-nika.com/de/` → Request indexing (if automate missed the button)
3. Remove stray property `https://hundesalon-nika.com/sitemap.xml` if it still appears in site list (wrong URL added as site)
4. **User management** — only `@mail.ru` should have access; remove `@gmail.com` if listed as user (not GSC import banner text)

## Verify

```bash
npm run bing:audit
npm run seo:indexnow
curl -sI https://hundesalon-nika.com/favicon.ico
```

Favicon in Bing SERP: often **2–4 weeks** after crawl.
