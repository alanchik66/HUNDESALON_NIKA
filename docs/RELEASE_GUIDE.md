# Production release

## Full professional deploy

The requests “полный deploy”, “полный деплой” and “полный профессиональный deploy” authorize this complete sequence for the site repository: inventory of recent work and current GitHub/Cloudflare state, cleanup, code review, confirmed defect fixes, quality gates, explicit staging, commit, push, deployment and production verification. These aliases are a standing instruction across subsequent project sessions and changes, explicitly renewed by the user on 2026-11-08. Sending the [haraldalder-vibemogger profile](https://github.com/haraldalder-vibemogger) for this project is the same standing release command, as requested by the user on 2026-11-04, unless that message explicitly limits the task to reading or another purpose. Preserve unrelated work and credentials. Report concrete blockers instead of publishing a failing revision.

0. Run `npm run release:references`. This discovers the current public repository catalog and default-branch HEADs without installing or executing upstream code. Compare the saved discovery report with `config/release-reference-methods.json`; review new or changed sources and record the pinned SHA, applicable method, existing checks and exclusions before updating the manifest. Do not assume the catalog will always contain seven projects. An incomplete discovery or unreviewed change is not a passing review.
1. Record the current branch, HEAD, remote and dirty files. Fetch origin and review any divergence without force or automatic resets.
2. Run `node tools/audit-repository.mjs`. It reads every tracked and non-ignored untracked file fully and saves hashes, text coverage and identical-file groups under ignored `output/repository-audit/`. Automated byte coverage and manual code review are separate evidence; do not claim that hashing proves semantic correctness.
3. Review all release changes, related callers and tests. Inspect security, locale consistency, booking, payments, migrations and deployment configuration. Refactor only confirmed defects or proven unnecessary duplication.
4. Remove confirmed disposable files and archive unfinished one-off operational experiments outside the published source. Record exact paths and recovery locations. Do not blanket-delete ignored folders, backups, knowledge, dependencies, assets or diagnostic evidence.
5. Complete the quality gate below and record results, omissions and browser evidence. Review pending migrations and external gateway prerequisites before publication.
6. Stage reviewed paths explicitly, inspect the staged diff, commit and push. Use the single deployment authority described below, then verify its exact commit and the served production assets.
7. Save a dated release report with the commit, deployment URL, cleanup manifest, checks, actual review coverage and remaining external actions. Never present a successful build as proof of delivery, account setup or legal compliance.

### Reference methods

The [haraldalder-vibemogger profile](https://github.com/haraldalder-vibemogger) supplies development methods, not runtime website dependencies. Apply them through the site's existing tools:

The dated, commit-pinned review and integration boundaries are in [release-reference-methods.json](../config/release-reference-methods.json). The 2026-11-04 review covers all seven currently public projects. `npm run check:release-references` validates this local manifest during every quality gate; the profile-triggered discovery separately verifies that its catalog and HEADs are still current. A method marked `adapted` records a reviewed integration decision, not a claim that a particular release has passed its checks. Save actual command results and deployment evidence in the dated release report.

| Project                                                                      | Application in this repository                                                                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [vibe-audit](https://github.com/haraldalder-vibemogger/vibe-audit)           | Masked secret scan, dependency audit, manual validation of auth/rate limits and public security headers. Findings require verification.                                                    |
| [web-audit](https://github.com/haraldalder-vibemogger/web-audit)             | SEO, consent, accessibility, required-page and release checks; distinguish code evidence from unverified external or legal requirements.                                                   |
| [claude.md](https://github.com/haraldalder-vibemogger/claude.md)             | Small scoped changes, a reproducible verification loop and independent review of consequential changes.                                                                                    |
| [mcp-diet](https://github.com/haraldalder-vibemogger/mcp-diet)               | Discover only needed tools, batch independent reads and filter large results before returning them to the agent. Use the available native code orchestration.                              |
| [project-memory](https://github.com/haraldalder-vibemogger/project-memory)   | Maintain this release procedure and dated verified reports; reuse existing project knowledge instead of creating competing sources of truth.                                               |
| [bayes-gate](https://github.com/haraldalder-vibemogger/bayes-gate)           | Record competing explanations, evidence and a falsifying check for risky decisions. Do not present uncalibrated scoring as measured confidence or replace existing authorization controls. |
| [market-research](https://github.com/haraldalder-vibemogger/market-research) | Mark facts, estimates and assumptions separately in business/SEO research. Market scraping, advertising and outreach are separate work, not deploy steps.                                  |

Claude-specific hooks and MCP SDK generators are not installed into the website runtime. Review compatibility and permissions before adopting executable third-party tooling. Keep third-party code provenance and licences when copying code. The current integration copies no upstream executable code. In particular, do not adopt upstream suggestions to disable TLS verification or break system package protections. `bayes-gate` claims MIT in its README but had no separate root LICENSE at the reviewed revision; reuse its evidence discipline without copying its engine.

## Quality gate

Run `npm run qa:max` and `git diff --check` before committing. The gate includes the reference manifest, strict dependency audits for both root and Google gateway, lint, unit tests, project checks, production build, asset budgets and browser tests. A failed or missing required result blocks publication; never relabel it PASS or silently skip it.

The local gate requires both Chromium and WebKit. CI runs the complete Chromium gate on Ubuntu; the called Pages workflow additionally requires the same WebKit booking tests and the native-touch RU contacts menu regression on macOS before its deploy job can run. Manual Pages runs require that macOS job as well. The contacts regression checks the exact checked-out source; production artifact checks and physical Safari confirmation remain separate evidence. Keep both engines mandatory: Linux GTK rendering failures are not a reason to remove the WebKit release gate. The platform policy is covered by `tools/production-release-verification.test.mjs`.

If the Chromium download is unavailable, an already installed Chrome can be selected in PowerShell with `$env:PLAYWRIGHT_CHANNEL = 'chrome'`. This changes only the Chromium launcher; it does not replace the required WebKit installation or its tests. Record the browser used and clear the temporary environment variable afterwards.

Review and stage specific files. Never stage `.dev.vars`, credentials, local OAuth state or generated browser artifacts. Keep unfinished operational scripts out of the release.

## Publish

Commit the reviewed changes and push `main` without force. `.github/workflows/ci.yml` validates the pushed revision, checks current security results and calls the Pages deployment workflow on success. This workflow is the normal deployment authority. Deploy the exact artifact that passed the browser gate, with its recorded SHA and asset hashes, instead of rebuilding a different artifact after validation.

Complete both mandatory verification phases:

1. CI verifies the exact immutable Pages deployment against the tested artifact receipt. Its origin comes only from the successful current upload's validated Wrangler NDJSON records: the expected project, production/main, full commit and deployment ID must agree. The four HTML canonical URLs still point to `https://hundesalon-nika.com`, and all receipt digests remain required.
2. Run `node tools/watch-production-release.mjs FULL_COMMIT_SHA` from a network that can reach the main domain. The watcher requires the exact successful CI run and downloads its tested artifact, verifies that artifact locally, then verifies `https://hundesalon-nika.com` against the same receipt. It has no alternate-domain fallback. A failed or missing canonical check means the full release is incomplete even when GitHub CI is green.

GitHub runners returned persistent HTTP 403 from the main domain on 2026-11-04 while the independent canonical verification succeeded. This is a network-specific access result, not proof of the particular WAF rule responsible. Do not disable WAF or alter account permissions to turn the gate green. CI success certifies the deployed Pages artifact; only both phases certify the complete release. A standalone push without the watcher is not a completed full release.

Wrangler's [structured output](https://developers.cloudflare.com/workers/wrangler/system-environment-variables/) is used instead of parsing a human-readable deployment banner. Keep its per-run output outside the published bundle.

If that workflow is unavailable and manual deployment is explicitly authorized, run `node tools/deploy-pages.mjs --branch main --commit-dirty=false` from a clean, committed `main` matching the live GitHub revision. Its guard rejects active CI/Pages workflows, runs the full quality and current-revision security gates, builds and verifies that artifact, then rechecks the revision and workflow state before authentication and upload. The uploaded revision is verified publicly afterwards. Both `npm run deploy` and `deploy:full` use this guarded path; they do not create API tokens or send post-deploy messages. Do not deploy uncommitted Functions or stale build artifacts, or race a manual upload against the CI deployment.

The content receipt covers the homepage JS/CSS references, maintained weather modules, generated weather vendors, their public JS importers and the active Moon MP4; homepage HTML is checked for locale, canonical and asset references. Weather vendors and all their importers use the same release-stamped URLs, while original vendor provenance hashes remain unchanged. Artifact, Pages-host and canonical verification require this coverage and reject missing assets or changed bytes. The Moon bytes must be a real MP4 and match the receipt on both the Pages host and the canonical domain. It is not a hash of every image or HTML byte. The normal CI path additionally protects the complete tested `dist` with its immutable artifact ID and download digest. Record this distinction in release evidence.

Both build-capable checkouts fetch Git LFS media. Production copying rejects unresolved LFS pointers instead of publishing them as media. The 2026-11-04 Moon incident served a 131-byte pointer with `video/mp4` and HTTP 200; response status, MIME and a successful module-only receipt were insufficient. Keep the Moon URL release-stamped so browsers replace previously cached pointer responses.

Production copying excludes `assets/js/local-dev-refresh.js` and removes only its structurally matched localhost bootstrap from the copied site shell before calculating the asset version. Source files and local preview keep this development refresh behavior; localhost testing of `dist` therefore exercises the production artifact independently of a workstation watcher.

## Database changes

Deploy compatible readers before changing the schema. Review unapplied D1 migrations and preserve a Time Travel bookmark before applying an additive migration. Do not approve private learning examples as part of deployment; see [AI chat learning review](CHAT_LEARNING_REVIEW.md).

## Verify

- Require the shared production verifier after deployment and in the release watcher: the expected commit/stamp, all four locales (`de`, `en`, `ru`, `uk`), matching `html lang`, exact canonical URLs and the served local JS/CSS. CI checks the validated immutable Pages origin; the watcher separately checks the main domain against the exact CI artifact receipt. Allow only bounded propagation retries and record failure if the expected version never arrives.
- Open navigation and the booking dialog in a real browser; check desktop and mobile layout.
- Run `node tools/audit-cloudflare-security.mjs --public-only` for public response headers.
- For the separately authorized local account audit, use the existing private `node .secrets/cloudflare/management-read-check.mjs --execute-after-approved-management-create --token-kind=user` runner when its DPAPI credential is available. It verifies the active token and exact account/zone before fixed GET requests; retain the new dated evidence for Insights, Precursor, TLS and DNS. Its default `--prepare` performs no credential read or network request. This is a local capability, not a CI dependency or authorization to create/expand keys. Never export this management key globally, replace CI credentials with it, commit it, or remove `.secrets` during report cleanup. If unavailable, report the exact missing capability rather than reusing historical PASS results.
- Use the local, read-only register audit to confirm Calendar availability without creating bookings or sending notifications.
- Keep deployment evidence separate from proof of actual email delivery.

Account settings, access permissions and live notification tests require separate authorization. Do not change WAF or Bot Fight Mode merely to complete a deployment.

The [Precursor GET contract](https://developers.cloudflare.com/api/resources/precursor/methods/get/) requires `Cloudflare-Version: 1.0`; an unversioned legacy response with `default_mode/enforcement_rules` must not be classified as a broken protection. The 2026-11-15 access follow-up verified Arm, no interstitial and zero additional rules. Keep API access, configuration health and product entitlements separate; a working administrative key does not make Enterprise-only account WAF available on Free or establish a zero future bill.

## Dependency security

`npm run check:security-dependencies` runs strict full `npm audit` checks for the root and Google gateway, including development dependencies. Both this check and the root `check:security-production` are part of `qa:max`; findings are not suppressed or ignored by severity to make a release pass.

The 2026-11-04 dependency remediation pins `glob` 14.0.3 under HTMLHint and `minimatch` 11.0.4 under ESLint through scoped overrides, without changing direct dependency ranges. Parent selectors match those declared ranges so npm can resolve them without `EOVERRIDE`. Re-run both strict audits for each release; a dated result does not replace the gate.

The 2026-11-17 tooling replacement removes the `markdownlint-cli2` / `globby` / `micromatch` / `braces` chain, including the previous temporary braces fork. Markdown lint uses the official `markdownlint` 0.41.1 API and native file enumeration with the existing rules and file scopes in `config/markdownlint-files.json`.

Stylelint 18.0.0 and tinyglobby 0.2.17 use only the limited matching and scanning contract documented in [the local matcher](../tools/lib/native-glob-matcher/README.md). The `picomatch` dependency name resolves to this explicitly named project adapter, which delegates matching to official Minimatch 11.0.4; it contains no copied picomatch parser. Unsupported options or pattern syntax throw instead of silently broadening the contract. This is a maintained compatibility adapter, not an upstream picomatch security release. Do not update its consumers without reviewing their actual calls and extending the ordinary compatibility tests where necessary.

`npm run test:dependency-integrity` checks the installed replacement, the absence of the removed parser chain, ordinary repository glob compatibility, Markdown discovery and real lint failures. Full audits remain unchanged. Record before/after lint file coverage for toolchain changes; a zero-advisory result alone does not prove compatibility or security.

Use fixed, repository-controlled lint globs and never run lint on untrusted repositories with privileged credentials. Recheck official releases before each tooling update. Do not use `npm audit fix --force` or dismiss findings to make a gate pass.
