# Deploy + Ads + GSC status (2026-07-22)

## Google Ads (DONE)

Account `ocid=8415382946` · `ryndenko1982@gmail.com`

| Item | Status |
|------|--------|
| PMax `HUNDESALON_NIKA` | **Enabled** · learning · **0,33 €/day** (≤10 €/мес) |
| Geo | Leipzig + Sachsen |
| Auto-apply recommendations | OFF |
| Primary conversion | **Отправка формы для потенциальных клиентов** |
| Purchase | Secondary / observation |
| Phone from ads | Present |
| Tag IDs (new) | `AW-16333140047` / `qNqJCkzYu8QcEM-I9qvE` |
| Site code | Merged to `main` via PR #41 — **not live until deploy** |

Live site still has older wiring (`AW-18333140047` / purchase label) until Cloudflare deploy succeeds.

## Deploy (BLOCKED)

- Local `CLOUDFLARE_API_TOKEN` (Cursor secret) → **Invalid API Token**
- GitHub Actions Pages deploys historically failing (same class of credential issue)
- Creating a new Automation token requires Cloudflare login → **Google 2FA on phone** (Galaxy Z Fold7)

**Human:** approve the Google prompt on the phone, then tell the agent «продолжай» — agent will create token + `npm run deploy:full`.

## Google Search Console (PARTIAL)

| Item | Status |
|------|--------|
| Property | URL-prefix `https://hundesalon-nika.com/` (owner ryndenko) |
| sitemap.xml | Submitted · ~85 URLs · OK |
| sitemap-brand.xml | Not on live / 403-challenge or missing until deploy |
| Indexed / not indexed | ~105 / ~88 (incl. sitemap redirects) |
| CWV | Insufficient data |
| HTTPS | OK |
| Domain property `sc-domain:` | Not confirmed |
| Indexing requests for all locales | Incomplete (2FA interrupted later GSC session) |

## Next human action

1. Approve Google 2FA on phone for Cloudflare (and GSC if prompted).
2. Reply «продолжай» so deploy + remaining GSC tabs finish.
