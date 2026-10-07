# Production release

## Quality gate

Run `npm run qa:max` and `git diff --check` before committing. The gate includes lint, unit tests, project checks, production build, asset budgets and browser tests.

Review and stage specific files. Never stage `.dev.vars`, credentials, local OAuth state or generated browser artifacts. Keep unfinished operational scripts out of the release.

## Publish

Commit the reviewed changes and push `main` without force. Cloudflare Pages builds the GitHub revision automatically. Confirm that the successful production deployment references the exact pushed commit.

For an explicitly authorized manual deployment, rebuild with `npm run build:production` after committing, then run `node tools/deploy-pages.mjs --branch main --commit-dirty=false`. Do not deploy uncommitted Functions or stale build artifacts.

## Verify

- Check the production asset version and all four locales: `de`, `en`, `ru`, `uk`.
- Open navigation and the booking dialog in a real browser; check desktop and mobile layout.
- Run `node tools/audit-cloudflare-security.mjs --public-only` for public response headers.
- Use the local, read-only register audit to confirm Calendar availability without creating bookings or sending notifications.
- Keep deployment evidence separate from proof of actual email delivery.

Account settings, access permissions and live notification tests require separate authorization. Do not change WAF or Bot Fight Mode merely to complete a deployment.
