# HUNDESALON_NIKA service audit - 2026-07-05

## Executive status

The previous external blockers are closed.

- Public domain is active through Cloudflare.
- Google legacy project `hundesalon-nika-job` is now `DELETE_REQUESTED`.
- Current Google Cloud project is `hundesalon-nika-shell-2026`.
- Cloudflare Zone Ops token has the required DNS and cache permissions.

## Production domain

Verified on 2026-07-05:

- `https://hundesalon-nika.pages.dev/de/`: 200
- `https://hundesalon-nika.com/de/`: 200
- `https://www.hundesalon-nika.com/de/`: 301 to `https://hundesalon-nika.com/de/`

Public DNS now resolves through Cloudflare anycast instead of the previous external `103.169.142.0` record.

Observed nameservers:

- `darwin.ns.cloudflare.com`
- `deborah.ns.cloudflare.com`

## Cloudflare

Pages project:

- Account ID: `25e872aeab8cb246c69142ab07cd0fee`
- Project: `hundesalon-nika`
- Latest observed production deployment: direct Wrangler deployment from `main`
- Deployment source: `main`

Zone token check:

- Zone Read: OK
- DNS Records Edit: OK
- Cache Purge: OK
- Zone Rules Edit: OK
- Page Rules Write: OK

Production checks:

- `npm run check:live-html`: passed for `/`, `/de/`, `/ru/`
- `npm run check:message-draft`: passed on production domain
- `npm run resend:check-live`: passed on production domain
- `npm run check:live-crawl`: passed, 96 sitemap URLs OK
- `npm run google:gsc:audit`: passed, 96 sitemap URLs ready
- `npm run deploy`: passed; production was deployed directly through Wrangler because GitHub Actions jobs were blocked before runner startup by GitHub account billing lock.

## Google Cloud

Active local configuration:

- gcloud config: `hundesalon-nika-google-shell`
- project: `hundesalon-nika-shell-2026`
- region: `europe-west3`

Legacy project:

- `hundesalon-nika-job`: `DELETE_REQUESTED`

Current gateway:

- Cloud Run service: `hundesalon-google-gateway`
- project: `hundesalon-nika-shell-2026`
- region: `europe-west3`
- URL: `https://hundesalon-google-gateway-l6jb5rxhsa-ey.a.run.app`

Data path:

- form/log records: Firestore in `hundesalon-nika-shell-2026`
- uploads: Cloud Storage bucket `hundesalon-nika-shell-uploads`
- calendar: `ddf6fc992a66cc1808cdb0b6d99594cb20b548e692b1b6778614e3fdb26b5589@group.calendar.google.com`

## Local IDE and agent hygiene

Canonical project path:

- `C:\PROJEKT\HUNDESALON_NIKA`

Local AI/MCP artifacts were moved out of the website repo to:

- `C:\Users\snaip\HUNDESALON_NIKA-agent-config-backup-20260705-122319`

Ignored from Git going forward:

- `AGENTS.md`
- `.agents/`
- `.cursorrules`
- `.devin/`
- `.devinignore`
- `.kilo/`
- `.windsurfrules`
- `.github/copilot-instructions.md`
- `brain/`
- `mcps/`
- `docs/KILO_*.md`

Follow-up hardening on 2026-07-05:

- Removed the physical `.kilo/` directory and Kilo setup notes from the website workspace; files were moved to the same external backup folder.
- Updated VS Code workspace settings to use the existing external Kilo config at `C:\Users\snaip\.config\kilo\kilo.jsonc`.
- Cleaned the Qodana GitHub Actions workflow candidate: only `main`, safer permissions, stable checkout, no missing baseline reference.
- Kept `tools/lib/browser-cdp.mjs` as a real project utility because current Bing Webmaster scripts import it.

## Validation

Local validation on 2026-07-05:

- `npm run validate`: passed
- `npm run build`: passed
- `npm run check:all`: passed
- `npm run deploy`: passed
- `git diff --check`: passed
- Qodana workflow formatting check: passed
- Bing Webmaster CDP tool syntax checks: passed
- `npm audit --audit-level=moderate`: passed, 0 vulnerabilities
- `npm run cf:ensure-api-token`: passed
- `npm run check:live-html`: passed
- `npm run check:message-draft`: passed
- `npm run resend:check-live`: passed
- `npm run check:live-crawl`: passed, 96 sitemap URLs OK
- `npm run google:gsc:audit`: passed, 96 sitemap URLs ready

Notes:

- `stylelint` completed successfully, with non-fatal `csstree-match` iteration break messages.
- Root URL now redirects to `/de/`, and language canonicals pass live checks.
- Local `main` and `origin/main` are aligned after the final push. (GitLab mirror removed.)
- GitHub Actions workflows are valid but cannot run while the GitHub account is locked for billing. This is external to the repository; production deploy was completed through Wrangler.
