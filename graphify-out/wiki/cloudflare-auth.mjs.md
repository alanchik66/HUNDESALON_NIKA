# cloudflare-auth.mjs

> 21 nodes · cohesion 0.16

## Key Concepts

- **cloudflare-auth.mjs** (40 connections) — `tools/lib/cloudflare-auth.mjs`
- **loadDevVars()** (20 connections) — `tools/lib/cloudflare-auth.mjs`
- **purge-cloudflare-cache.mjs** (9 connections) — `tools/purge-cloudflare-cache.mjs`
- **removeDevVar()** (5 connections) — `tools/lib/cloudflare-auth.mjs`
- **main()** (5 connections) — `tools/purge-cloudflare-cache.mjs`
- **purgeEverything()** (5 connections) — `tools/purge-cloudflare-cache.mjs`
- **slack-test-webhook.mjs** (5 connections) — `tools/slack-test-webhook.mjs`
- **getWranglerConfigPath()** (4 connections) — `tools/lib/cloudflare-auth.mjs`
- **persistWranglerOAuth()** (4 connections) — `tools/lib/cloudflare-auth.mjs`
- **resolvePurgeAuth()** (4 connections) — `tools/lib/cloudflare-auth.mjs`
- **runEnsurePurgeToken()** (3 connections) — `tools/purge-cloudflare-cache.mjs`
- **clearLegacyPagesTokenAlias()** (2 connections) — `tools/lib/cf-api-token.mjs`
- **upsertTomlQuotedField()** (2 connections) — `tools/lib/cloudflare-auth.mjs`
- **wranglerConfigCandidates()** (2 connections) — `tools/lib/cloudflare-auth.mjs`
- **open-cf-www-robots-redirect.mjs** (2 connections) — `tools/open-cf-www-robots-redirect.mjs`
- **open-cf-cache-configuration.mjs** (1 connections) — `tools/open-cf-cache-configuration.mjs`
- **open-cf-csam-setup.mjs** (1 connections) — `tools/open-cf-csam-setup.mjs`
- **open-cf-waf-rate-limits.mjs** (1 connections) — `tools/open-cf-waf-rate-limits.mjs`
- **now** (1 connections) — `tools/slack-test-webhook.mjs`
- **payload** (1 connections) — `tools/slack-test-webhook.mjs`
- **webhook** (1 connections) — `tools/slack-test-webhook.mjs`

## Relationships

- [configure-cloudflare-cache-features.mjs](configure-cloudflare-cache-features.mjs.md) (13 shared connections)
- [cf-api-token.mjs](cf-api-token.mjs.md) (10 shared connections)
- [bing-finish-remaining.mjs](bing-finish-remaining.mjs.md) (7 shared connections)
- [cf-pages-token.mjs](cf-pages-token.mjs.md) (7 shared connections)
- [cloudflareApi](cloudflareApi.md) (5 shared connections)
- [configure-cloudflare-waf-rate-limits.mjs](configure-cloudflare-waf-rate-limits.mjs.md) (2 shared connections)
- [browser-cdp.mjs](browser-cdp.mjs.md) (1 shared connections)
- [bing-sitescan.mjs](bing-sitescan.mjs.md) (1 shared connections)
- [cleanup-cf-dashboard-tokens.mjs](cleanup-cf-dashboard-tokens.mjs.md) (1 shared connections)
- [complete-manual-checklist.mjs](complete-manual-checklist.mjs.md) (1 shared connections)
- [deploy-pages.mjs](deploy-pages.mjs.md) (1 shared connections)
- [open-cf-unified-token.mjs](open-cf-unified-token.mjs.md) (1 shared connections)

## Source Files

- `tools/lib/cf-api-token.mjs`
- `tools/lib/cloudflare-auth.mjs`
- `tools/open-cf-cache-configuration.mjs`
- `tools/open-cf-csam-setup.mjs`
- `tools/open-cf-waf-rate-limits.mjs`
- `tools/open-cf-www-robots-redirect.mjs`
- `tools/purge-cloudflare-cache.mjs`
- `tools/slack-test-webhook.mjs`

## Audit Trail

- EXTRACTED: 118 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*