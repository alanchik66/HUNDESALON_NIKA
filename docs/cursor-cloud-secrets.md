# Cursor Cloud Agents — secrets

For this repo you only need **one** OpenRouter secret in [Cloud Agents → My Secrets](https://cursor.com/dashboard/cloud-agents).

## Keep (Cursor)

| Secret | Purpose |
|--------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API (required for `/openrouter` and SEO tools) |

Optional — only if you want agents to run `npm run cf:purge-cache`:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Zone **Cache Purge** + **Zone Read** for `hundesalon-nika.com` |

Contact form email uses `RESEND_API_KEY` on **Cloudflare Pages** only (not required in Cursor).

## Remove (defaults are in `functions/openrouter.js`)

Delete these if they still appear in the dashboard — they duplicate code defaults and are easy to get out of sync:

- `OPENROUTER_SITE_URL`
- `OPENROUTER_SITE_NAME`
- `OPENROUTER_DEFAULT_MODEL`
- `OPENROUTER_FALLBACK_MODEL`

In the UI: open each secret → use the remove/delete control (wording varies). There is no API for agent secrets from this repo.

## Cloudflare Pages (already trimmed)

Production Pages secrets should be only `OPENROUTER_API_KEY` and `RESEND_API_KEY`. Verify:

```bash
npx wrangler pages secret list --project-name=hundesalon-nika
```

Re-prune if needed: `npm run pages:secrets:prune`

## Local `.dev.vars`

Minimal set (see `.dev.vars.example`):

- `OPENROUTER_API_KEY`
- `CLOUDFLARE_API_TOKEN` (after creating a valid purge token)

Sync key to Pages: `npm run sync:openrouter`
