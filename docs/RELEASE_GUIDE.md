# Production release

## Quality gate

Run `npm run qa:max` and `git diff --check` before committing. The gate includes lint, unit tests, project checks, production build, asset budgets and browser tests.

If the Playwright browser download is unavailable, use an already installed browser: in PowerShell, set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` before running the gate. The default remains Playwright's bundled Chromium. Record which browser was used and clear the temporary environment variable afterwards.

Review and stage specific files. Never stage `.dev.vars`, credentials, local OAuth state or generated browser artifacts. Keep unfinished operational scripts out of the release.

## Publish

Commit the reviewed changes and push `main` without force. This Pages project uses Direct Upload; a push does not deploy it. The optional GitHub Actions deployment requires `workflow_dispatch`. Confirm that the successful production deployment references the exact pushed commit.

For an explicitly authorized manual deployment, rebuild with `npm run build:production` after committing, then run `node tools/deploy-pages.mjs --branch main --commit-dirty=false`. Do not deploy uncommitted Functions or stale build artifacts.

## Database changes

Deploy compatible readers before changing the schema. Review unapplied D1 migrations and preserve a Time Travel bookmark before applying an additive migration. Do not approve private learning examples as part of deployment; see [AI chat learning review](CHAT_LEARNING_REVIEW.md).

## Verify

- Check the production asset version and all four locales: `de`, `en`, `ru`, `uk`.
- Open navigation and the booking dialog in a real browser; check desktop and mobile layout.
- Run `node tools/audit-cloudflare-security.mjs --public-only` for public response headers.
- Use the local, read-only register audit to confirm Calendar availability without creating bookings or sending notifications.
- Keep deployment evidence separate from proof of actual email delivery.

Account settings, access permissions and live notification tests require separate authorization. Do not change WAF or Bot Fight Mode merely to complete a deployment.

## Dependency security

`npm run check:security-dependencies` runs the full `npm audit`, including development dependencies. Both this check and `check:security-production` are part of `qa:max`; findings are not suppressed.

As of 2026-10-08, full and production audits report zero vulnerabilities. The official `braces` release remains affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The development toolchain temporarily uses the reviewed [Im-Fran/braces security fork](https://github.com/Im-Fran/braces/releases/tag/3.0.4), pinned to commit `11568474fd2d330d4a56a3aba63f8f90030ba15e`, not a mutable branch or tag. Its downloaded archive integrity is recorded in the lockfile. This is not an official upstream release.

The fork limits parser nesting to 100, rejecting deeper input with `SyntaxError` before recursive walkers run. `test:security-braces` checks that all consumers resolve this snapshot, malicious deep patterns are rejected and ordinary lint globs remain compatible. Hand-built ASTs bypass the parser: never feed an untrusted AST to the compile or expand entry points.

Use fixed, repository-controlled lint globs and never run lint on untrusted repositories with privileged credentials. Recheck official releases before each tooling update and remove the temporary override when an equivalent upstream fix is available. Do not use `npm audit fix --force` or dismiss findings to make a gate pass.
