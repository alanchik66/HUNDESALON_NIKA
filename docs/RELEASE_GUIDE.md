# Production release

## Quality gate

Run `npm run qa:max` and `git diff --check` before committing. The gate includes lint, unit tests, project checks, production build, asset budgets and browser tests.

If the Playwright browser download is unavailable, use an already installed browser: in PowerShell, set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` before running the gate. The default remains Playwright's bundled Chromium. Record which browser was used and clear the temporary environment variable afterwards.

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

## Dependency security

`npm run check:security-production` rejects vulnerable production dependencies and is part of `qa:max`. Also run the full `npm audit` before releasing tooling changes; a clean production audit does not imply a clean development tree.

As of 2026-10-07, the updated dependency tree has zero production vulnerabilities. The full audit still reports eight high findings, all propagated from `braces@3.0.3` through the development-only lint toolchain. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no published patched version. This risk remains open, not fixed or dismissed.

Use only fixed, repository-controlled lint globs. Do not pass customer input or external glob patterns to linters. Do not run lint on untrusted repositories with privileged credentials. Recheck the advisory before each tooling release and use an upstream patch when available. Do not use `npm audit fix --force`: the proposed downgrades remove current lint functionality without providing a suitable maintained upgrade.
