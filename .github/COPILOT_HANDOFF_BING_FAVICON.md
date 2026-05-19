# Handoff: Bing favicon + indexing (for GitHub Copilot Chat)

**Copy this entire file into Copilot Chat** if the user asked to finish Bing Webmaster steps in the browser.

## Done already (Cursor agent / CI)

- Favicons regenerated: air-trim only, version `20260519-tight-fit`
- Production deploy + CDN purge
- `/favicon.ico` and full PNG set live on https://hundesalon-nika.com
- **IndexNow**: 76 URLs submitted (HTTP 200) — Bing notified
- `npm run check:live-html` → `favicon=true`

## Your tasks in browser (Microsoft login required)

1. Open https://www.bing.com/webmasters/ — site `https://hundesalon-nika.com/` must be verified (`BingSiteAuth.xml` on site).
2. **URL Inspection** → enter `https://hundesalon-nika.com/de/` → **Request indexing**.
3. **IndexNow** tab → confirm recent submissions appear.
4. Optional: **Settings → API Access** → generate API key → user adds to `.dev.vars` as `BING_WEBMASTER_API_KEY` → then `npm run bing:api`.

## Local automation (after user signs in to Microsoft in Edge)

```bash
npm run bing:edge      # isolated Edge + CDP port 9224
# sign in to Microsoft in that window
npm run bing:automate  # submit priority URLs + try Request indexing
```

## Do not

- Regenerate favicons with heavy padding (user wants full logo, no empty frame)
- Remove `/favicon.ico` from root or HTML

## Verify

```bash
curl -sI https://hundesalon-nika.com/favicon.ico
npm run check:live-html
```

Favicon in Bing SERP may take **2–4 weeks** after crawl.
