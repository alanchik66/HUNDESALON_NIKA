# Production release

## Full professional deploy

The request “полный профессиональный deploy” authorizes this complete sequence for the site repository: inventory, cleanup, code review, quality gates, explicit staging, commit, push, deployment and production verification. Preserve unrelated work and credentials. Report concrete blockers instead of publishing a failing revision.

1. Record the current branch, HEAD, remote and dirty files. Fetch origin and review any divergence without force or automatic resets.
2. Run `node tools/audit-repository.mjs`. It reads every tracked and non-ignored untracked file fully and saves hashes, text coverage and identical-file groups under ignored `output/repository-audit/`. Automated byte coverage and manual code review are separate evidence; do not claim that hashing proves semantic correctness.
3. Review all release changes, related callers and tests. Inspect security, locale consistency, booking, payments, migrations and deployment configuration. Refactor only confirmed defects or proven unnecessary duplication.
4. Remove confirmed disposable files and archive unfinished one-off operational experiments outside the published source. Record exact paths and recovery locations. Do not blanket-delete ignored folders, backups, knowledge, dependencies, assets or diagnostic evidence.
5. Complete the quality gate below and record results, omissions and browser evidence. Review pending migrations and external gateway prerequisites before publication.
6. Stage reviewed paths explicitly, inspect the staged diff, commit and push. Use the single deployment authority described below, then verify its exact commit and the served production assets.
7. Save a dated release report with the commit, deployment URL, cleanup manifest, checks, actual review coverage and remaining external actions. Never present a successful build as proof of delivery, account setup or legal compliance.

### Reference methods

The [haraldalder-vibemogger profile](https://github.com/haraldalder-vibemogger) supplies development methods, not runtime website dependencies. Apply them through the site's existing tools:

| Project                                                                      | Application in this repository                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [vibe-audit](https://github.com/haraldalder-vibemogger/vibe-audit)           | Masked secret scan, dependency audit, manual validation of auth/rate limits and public security headers. Findings require verification.                                                    |
| [web-audit](https://github.com/haraldalder-vibemogger/web-audit)             | SEO, consent, accessibility, required-page and release checks; distinguish code evidence from unverified external or legal requirements.                                                   |
| [claude.md](https://github.com/haraldalder-vibemogger/claude.md)             | Small scoped changes, a reproducible verification loop and independent review of consequential changes.                                                                                    |
| [mcp-diet](https://github.com/haraldalder-vibemogger/mcp-diet)               | Discover only needed tools, batch independent reads and filter large results before returning them to the agent. Use the available native code orchestration.                              |
| [project-memory](https://github.com/haraldalder-vibemogger/project-memory)   | Maintain this release procedure and dated verified reports; reuse existing project knowledge instead of creating competing sources of truth.                                               |
| [bayes-gate](https://github.com/haraldalder-vibemogger/bayes-gate)           | Record competing explanations, evidence and a falsifying check for risky decisions. Do not present uncalibrated scoring as measured confidence or replace existing authorization controls. |
| [market-research](https://github.com/haraldalder-vibemogger/market-research) | Mark facts, estimates and assumptions separately in business/SEO research. Market scraping, advertising and outreach are separate work, not deploy steps.                                  |

Claude-specific hooks and MCP SDK generators are not installed into the website runtime. Review compatibility and permissions before adopting executable third-party tooling. Keep third-party code provenance and licences when copying code.

## Quality gate

Run `npm run qa:max` and `git diff --check` before committing. The gate includes lint, unit tests, project checks, production build, asset budgets and browser tests.

If the Playwright browser download is unavailable, use an already installed browser: in PowerShell, set `$env:PLAYWRIGHT_CHANNEL = 'chrome'` before running the gate. The default remains Playwright's bundled Chromium. Record which browser was used and clear the temporary environment variable afterwards.

Review and stage specific files. Never stage `.dev.vars`, credentials, local OAuth state or generated browser artifacts. Keep unfinished operational scripts out of the release.

## Publish

Commit the reviewed changes and push `main` without force. `.github/workflows/ci.yml` validates the pushed revision, checks current security results and calls the Pages deployment workflow on success. This workflow is the normal deployment authority. Monitor its checks and confirm that the successful production deployment references the exact pushed commit.

If that workflow is unavailable and manual deployment is explicitly authorized, first ensure that no automated deployment is running. Rebuild with `npm run build:production` after committing, then run `node tools/deploy-pages.mjs --branch main --commit-dirty=false`. Do not deploy uncommitted Functions or stale build artifacts, or race a manual upload against the CI deployment.

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
