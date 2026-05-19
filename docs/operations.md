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

## Secrets

| Where | Variables |
|-------|-----------|
| `.dev.vars` (local, gitignored) | `OPENROUTER_API_KEY`, optional `CLOUDFLARE_API_TOKEN` |
| Cloudflare Pages | `OPENROUTER_API_KEY`, `RESEND_API_KEY` |
| Cursor Cloud Agents | `OPENROUTER_API_KEY` only |

## Docs

- Git: `docs/git-workflow.md`
- Cache: `docs/cloudflare-caching.md`
- OpenRouter: `docs/openrouter-quickstart-setup.md`
- Agents: `AGENTS.md`
