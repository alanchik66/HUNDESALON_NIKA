# HUNDESALON_NIKA service audit - 2026-06-26

## Executive status

Production content is built and available on Cloudflare Pages at:

- `https://hundesalon-nika.pages.dev/`
- `https://hundesalon-nika.pages.dev/de/`
- `https://hundesalon-nika.pages.dev/sitemap.xml`
- `https://hundesalon-nika.pages.dev/robots.txt`

The public domain is not serving the Pages project correctly yet:

- `https://hundesalon-nika.com/` returns Cloudflare 404.
- `https://hundesalon-nika.com/de/` returns Cloudflare 404.
- The active blocker is DNS, not the static site build.

## Critical Cloudflare action

Cloudflare Pages has the custom domains configured, but both are pending because DNS does not point to the Pages project:

- `hundesalon-nika.com`: pending, `CNAME record not set`
- `www.hundesalon-nika.com`: pending, `CNAME record not set`

Public DNS currently resolves both hostnames to `103.169.142.0`. That record blocks Pages activation and also blocks Worker Custom Domains.

Required DNS target:

- Delete current `A` / conflicting records for `hundesalon-nika.com` and `www.hundesalon-nika.com`.
- Add `CNAME` `@` -> `hundesalon-nika.pages.dev`, proxied ON.
- Add `CNAME` `www` -> `hundesalon-nika.pages.dev`, proxied ON.

Current token state:

- Existing Cloudflare token works for zone read, cache purge, rules and page rules.
- Existing Cloudflare token does not have DNS Read/Edit permission.
- Wrangler OAuth is logged in, but also cannot edit DNS for this zone from the current environment.

Needed permission to finish:

- Cloudflare API token with `Zone -> DNS -> Read` and `Zone -> DNS -> Edit` for zone `hundesalon-nika.com`.

## Cloudflare Pages

Pages project:

- Account: `HUNDESALON_NIKA`
- Account ID: `25e872aeab8cb246c69142ab07cd0fee`
- Project: `hundesalon-nika`
- Pages origin: `hundesalon-nika.pages.dev`
- Latest verified production deployment: `d6afd50e`

Pages origin health:

- `/` OK
- `/de/` OK
- `/sitemap.xml` OK
- `/robots.txt` OK

## Cloudflare Worker fallback

An emergency Worker proxy was prepared and deployed:

- `workers/pages-proxy.js`
- `workers/wrangler.toml`
- Worker name: `hundesalon-nika`
- Worker version observed after deploy: `bb25fa64-ad07-49de-a548-af5f264375de`

The Worker routes exist for:

- `hundesalon-nika.com/*`
- `www.hundesalon-nika.com/*`

The routes do not currently fix production because the existing DNS state is still taking precedence. Worker Custom Domain deployment was rejected by Cloudflare with conflict `100117`: the hostnames already have externally managed DNS records. DNS must be corrected first.

After DNS is fixed and Pages custom domains are active, this Worker fallback can be removed or kept only as an intentional edge proxy.

## Google OAuth and Google Cloud

Google OAuth error from the provided URL:

- Error: `OAuth 2 parameters can only have a single value: access_type`
- Cause: the browser/OAuth URL contained `access_type` more than once.
- Local project generator is correct: it uses a single `access_type=offline`.

Correct OAuth URL rule:

- exactly one `access_type=offline`
- exactly one `prompt=consent`

Google Cloud project:

- Active account: `snaiper1984@gmail.com`
- Active project after cleanup: `hundesalon-nika-shell-2026`
- Display name: `HUNDESALON-NIKA Google-Shell`
- Region: `europe-west3`

Important naming constraint:

- Google Cloud rejected `HUNDESALON_NIKA Google-Shell` as a project display name because `_` is not accepted by the Project API.
- Google Cloud also rejected `google` inside the technical Project ID, so the clean project ID is `hundesalon-nika-shell-2026`.
- Brand spelling `HUNDESALON_NIKA Google-Shell` remains the canonical human-facing label in docs and local workflow.

Project cleanup:

- `gen-lang-client-0297876161` was moved to `DELETE_REQUESTED`.
- old `hundesalon-nika` was already in `DELETE_REQUESTED`.
- legacy job project was removed after cleanup; no active website tooling should point to it.
- current active Google Cloud project for the website and IDE tooling is only `hundesalon-nika-shell-2026`.
- local active gcloud configuration: `hundesalon-nika-google-shell`
- VS Code Cloud Code project: `hundesalon-nika-shell-2026`

Permissions:

- `snaiper1984@gmail.com` has `roles/resourcemanager.folderAdmin` on organization `341474755356`.
- `snaiper1984@gmail.com` has `roles/owner` on `hundesalon-nika-shell-2026`.

Terraform:

- `terraform validate`: success
- Terraform state in `C:\Users\snaip\nika-infra` is empty after destroy.
- Plain DB password was removed from `C:\Users\snaip\nika-infra\main.tf`.
- `gateway-shared-secret` metadata and IAM are now managed by Terraform without storing the secret value in code.

Cloud Run:

- new `hundesalon-google-gateway` in `hundesalon-nika-shell-2026`: Ready, `/health` returns success.
- new gateway URL: `https://hundesalon-google-gateway-l6jb5rxhsa-ey.a.run.app`
- old gateway from the legacy job project was deleted.

Google data path:

- Sheets-style logs are written to Firestore in `hundesalon-nika-shell-2026`.
- Uploads are written to Cloud Storage bucket `hundesalon-nika-shell-uploads`.
- Drive creation was intentionally bypassed because service-account Drive ownership can fail with `storageQuotaExceeded`.
- Platform calendar is on the new gateway setup: `ddf6fc992a66cc1808cdb0b6d99594cb20b548e692b1b6778614e3fdb26b5589@group.calendar.google.com`.

## Resend and service endpoints

Pages production environment contains the required Resend and service gateway variables.

Production webhook variables were moved to the new Google gateway:

- `GOOGLE_SHEETS_WEBHOOK_URL` -> new gateway `/sheets`
- `GOOGLE_CALENDAR_WEBHOOK_URL` -> new gateway `/calendar`
- `GOOGLE_DRIVE_UPLOAD_WEBHOOK_URL` -> new gateway `/drive`
- `GOOGLE_APPS_SCRIPT_WEBHOOK_URL` was cleared so Apps Script does not override the new gateway path.

Verified against Pages origin:

- `/sendmail`: returned 200 with the live check.
- `/message-draft`: returned 200 with the live check.

Because the public domain is still DNS-broken, production-domain email/contact checks must be repeated after DNS activation.

## Repository and local checks

Repository:

- Branch: `feature/full-stack-upgrade`
- Dependency audit: `npm audit --audit-level=moderate` reported 0 vulnerabilities.
- Local build/validation passed inside `npm run check:all`.

Known working tree changes before this audit were left untouched:

- `.vscode/settings.json`
- `package.json`
- `assets/images/Copilot_20260625_173919.png`

Audit-created files:

- `workers/pages-proxy.js`
- `workers/wrangler.toml`
- `docs/service-audit-2026-06-26.md`

## Local editor and agent setup

Canonical project path:

- `C:\PROJEKT\HUNDESALON_NIKA`

Configured profiles:

- VS Code user settings
- Windsurf user settings
- Devin user settings
- Devin local permissions: `C:\Users\snaip\.devin\config.local.json`

All three editor profiles point to:

- Google Cloud project: `hundesalon-nika-shell-2026`
- region: `europe-west3`
- terminal working directory: `C:\PROJEKT\HUNDESALON_NIKA`

Extension state after cleanup:

- Windsurf: 100 extensions, no missing VS Code extensions, no stale extension directories.
- Devin: 101 extensions, no missing VS Code extensions, no stale extension directories.

No `.devin`, `.windsurf`, `.agents`, `.continue`, `.claude`, `AGENTS.md` or similar AI service files were added to the website repository.

## Post-DNS verification checklist

Run after DNS records are fixed and Cloudflare Pages custom domains become active:

```powershell
npm run cf:purge-cache
npm run check:live-html
npm run check:live-crawl
npm run check:message-draft
npm run resend:check-live
npm run google:gsc:audit
```

Expected result:

- `https://hundesalon-nika.com/` returns 200.
- `https://hundesalon-nika.com/de/` returns 200.
- sitemap URLs return 200.
- canonical, favicon, hreflang and form endpoints pass production checks.
