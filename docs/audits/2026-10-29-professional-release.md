# Repository audit and release preparation — 2026-10-29

## Scope and evidence

The site repository is `alanchik66/HUNDESALON_NIKA`. Unrelated local work, credentials, backups and operational evidence stay outside the published source. The baseline production revision was `0c22a4053b8ef6cffac79af5daead2715dfa03e9`.

The complete automated byte inventory, after cleanup and before this report was added, covered 1520 files, 134508135 bytes and 794 UTF-8 files containing 321886 lines. Every candidate was read fully; none was unreadable. `tools/audit-repository.mjs` records a SHA-256 for each file and a combined tree fingerprint under ignored `output/repository-audit/`.

This inventory is automated coverage, not a claim that every line received manual semantic review. Manual review covered the complete release diff, critical booking/payment/email paths, related callers and tests, frontend changes, weather build provenance and release orchestration. Detailed file-level boundaries are recorded in the local backend, frontend and cleanup reports under `output/release-audit-2026-10-29/`.

## Cleanup and fixes

- Removed the literal Windows `nul` file: 185 bytes of failed command output. Its verified backup is `.local-backups/release-cleanup-2026-10-29/nul.txt`.
- Archived 20 one-off operational scripts, 28281 bytes, under ignored `work/ops-archive/2026-10-29/`. Original paths and verified backup/archive hashes are in its recovery manifest. These experiments can mutate live configuration, send messages or deploy dated test revisions; they are not production source.
- Retained and formatted seven reusable image, email-preview, DNS, header and layout tools. Preview/layout tools are not evidence of actual mailbox delivery or complete booking flows.
- Removed the temporary production Telegram-to-preview forwarding bridge. Normal staff booking confirmation remains; retired preview callbacks cannot forward to a test deployment, write Calendar/D1 or confirm a booking.
- Corrected a scroll-control regression test to match the standalone base CSS selector. Existing assertions remain intact.
- Rebuilt the checked-in assistant knowledge and retrieval index from 74 canonical sources. The index contains 256 chunks.
- Corrected the release guide and PowerShell entry point to wait for the CI deployment instead of racing a second manual upload. The watcher checks the complete CI commit, successful deployment job and public asset stamp. Different Git SHA abbreviation lengths are supported.

Three groups of identical files were found. They are intentional public image aliases and retained third-party licence notices; they were not deleted. The weather bundle and its source map were reproduced from the maintained source with the locked build tool and retained as required build artifacts.

## Verification before commit

- `npm run qa:max`: PASS, including all lint stages, security checks, production build, budgets, visual browser checks and accessibility smoke tests.
- Main unit suite: 626/626 PASS. Assistant knowledge suite: 20/20 PASS.
- Root and Google gateway dependency audits: zero reported vulnerabilities.
- Backend confirmation cleanup: 58/58 relevant tests PASS; additional AI authorization/quota and booking-signature review: 61/61 PASS.
- Frontend review: 28/28 focused tests PASS; weather recovery checks and reproducible bundle/map comparison PASS.
- New release tools: ESLint PASS and independent review. The watcher was exercised against the existing successful production workflow, including a process-scoped `core.abbrev=12` regression check, without changing Git configuration.
- Email rendering with the built local images: 8/8 locale/viewport combinations PASS, all eight images loaded, no horizontal overflow and no wrong-locale links. `--live-images` separately verifies deployed image responses after publication.
- PowerShell parser execution was unavailable because the command tool denied `pwsh`; no policy bypass was attempted. The small PowerShell wiring changes were reviewed, and deployment monitoring is implemented and exercised in the Node tool.
- `git diff --check`: PASS.

The masked Git-scope security scan produced 22 heuristic signals. Manual triage found no confirmed source vulnerability: the apparent private key was a PEM-header parsing pattern; other signals concerned test fixtures, browser evaluation helpers, bounded AI calls or separately enforced authorization/rate limits. Cloud-account state is not certified by a code scan.

Read-only production inspection confirmed that migration 0012 and its confirmation-delivery lease columns were already applied. Production uses direct Google OAuth; a separate Apps Script deployment is not required for this revision. No live booking, payment, email or Telegram notification was created by these checks.

## Repeatable procedure

The command “полный профессиональный deploy” follows [the canonical release guide](../RELEASE_GUIDE.md). Its reference-method table accounts for all seven projects at the supplied GitHub profile using compatible native tools and existing project knowledge. It does not treat agent-specific hooks or market-research scrapers as website runtime dependencies.

The release commit is the commit containing this report. CI and post-deployment evidence must be checked for that exact commit; this preparation report alone does not claim that publication has completed.
