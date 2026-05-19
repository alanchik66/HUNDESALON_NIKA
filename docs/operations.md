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

If OpenRouter returns 401 after deploy: `npm run sync:openrouter`, wait ~10s, `npm run check:openrouter`.

## Commands

| Script | Purpose |
|--------|---------|
| `npm run check:all` | Full health (local + prod + git remotes) |
| `npm run check:prod` | Live HTML, GSC audit, OpenRouter |
| `npm run git:push` | Push `main` to GitHub and GitLab |
| `npm run deploy:full` | Build, deploy Pages, optional purge, prod checks |
| `npm run sync:openrouter` | Copy key from `.dev.vars` → Pages secret |

## Cloudflare tokens

Which Dashboard tokens are for what: `docs/cloudflare-api-tokens.md`.

## Cloudflare cache purge

Use a **zone API token** (not a revoked/old token). Create via template:

```bash
npm run cf:open-purge-token
# Copy token once, then:
npm run cf:set-purge-token -- <paste-token>
npm run cf:purge-cache
```

`cf:set-purge-token` verifies the token before writing `.dev.vars`. Invalid tokens are rejected.

Permissions: **Zone → Read**, **Zone → Cache Purge**, resource `hundesalon-nika.com`.

Without token: Dashboard → **Caching → Purge Everything** after HTML deploys.

Optional: same token in Cursor Cloud Agents as `CLOUDFLARE_API_TOKEN` for automated purge in agents.

## Email (contact forms, info@, CSAM)

| Service | Status | Notes |
|---------|--------|--------|
| **Resend** (forms → `info@`) | OK | Pages has `RESEND_API_KEY`; test: `POST https://hundesalon-nika.com/sendmail` → `success: true` |
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
| `.dev.vars` (local, gitignored) | `OPENROUTER_API_KEY`, optional `CLOUDFLARE_API_TOKEN` |
| Cloudflare Pages | `OPENROUTER_API_KEY`, `RESEND_API_KEY` |
| Cursor Cloud Agents | `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN` (purge) |

## Docs

- Git: `docs/git-workflow.md`
- Cache: `docs/cloudflare-caching.md`
- OpenRouter: `docs/openrouter-quickstart-setup.md`
- Agents: `AGENTS.md`
