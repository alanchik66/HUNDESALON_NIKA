# Repository audit — 2026-10-26

## Scope

The initial inventory covered 1,501 tracked files: the four locale trees, shared
frontend, 71 Functions files, Workers, Google gateway, migrations, build/release
tools and development configuration. Generated output, installed dependencies,
binary media and vendored/minified code were inventoried rather than rewritten.
A bounded copy of 701 tracked text files was used for the heuristic security scan;
local credentials and ignored caches were excluded. Dependencies were audited in
the real root and gateway installations, not in that source snapshot.

## Changes

- Availability uses the salon's `Europe/Berlin` date when calculating its 90-day
  horizon. Winter and summer midnight boundaries are covered by regression tests.
- Production input copying rejects symbolic links and paths outside the repository.
  Ignored files and credential/database artifacts are excluded across every copied
  public directory, including `config/` and `data/`.
- Static preview serves public paths only, rejects private/source files and escaping
  links, and survives malformed URL encoding. Form POST behavior preserves the
  local Functions fallback.
- Removed 33 byte-identical media copies (13,971,645 bytes). Shared hero and
  testimonial image references use the existing canonical brand image. Historical
  public image URLs retain permanent redirects.
- Removed nine generated before/after cards that reused the same two brand images.
  The localized empty state remains until real, approved comparison photos exist.
  Gallery instructions and SEO descriptions in all four locales describe that
  pending state; they do not promise an existing photo collection or slider.
- Project checks validate actual gallery image references instead of requiring
  eighteen placeholder files.
- Generated Graphify reports and indexes remain local. The pre-existing modified
  report was preserved on disk when untracked.
- Removed the obsolete, unreferenced image-migration script, which could recreate
  superseded image layouts and overwrite canonical files.
- Updated the installed Lean-ctx and Graphify tools and compatible npm tooling.
  RooFlow upstream templates were already current; project customizations remain.
- Push-to-main CI now gates production deployment. Registration failure/retry
  behavior in all four locales and both viewport sizes is part of CI.
- Newsletter consent is constructed with text nodes and an allowlisted locale.
  Chat links explicitly validate the HTTPS site origin, and upload IDs use Web
  Crypto even without `randomUUID`.
- Bing submission validates the exact HTTPS origin. Photo metadata decoding
  performs a single entity pass and rejects out-of-range numeric code points.
  Backup decryption explicitly requires the existing 16-byte GCM tag.
- CodeQL/Semgrep analysis and a current-commit, zero-open-alert gate now
  precede automatic and manually dispatched GitHub deployments.

## Heuristic findings reviewed

The scanner returned 16 findings: one critical, twelve warnings and three
informational items. These counts are raw heuristics, not confirmed vulnerabilities.

| Finding                               | Review                                                                                                                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PEM key in `platform-integrations.js` | Matches the parser's PEM header/footer recognition, not a stored private key. Actual credentials are environment bindings.                                                                           |
| Frontend auth without rate limit      | The frontend filename/string heuristic does not identify a server login route. The chat session and resource routes enforce server-side controls.                                                    |
| Eleven LLM-limit warnings             | Includes generated photo/knowledge metadata, policy constants and tests. Actual SEO/draft requests set `max_completion_tokens`; chat and paid routes reserve D1-backed quotas before provider calls. |
| npm audit unavailable in snapshot     | The snapshot intentionally has no dependency installation. Root and gateway audits are run separately in the real repository.                                                                        |
| Firebase rules reminder               | A reference to Firebase/FCM is not evidence of a public database. External IAM/rules are outside what a repository scan can certify.                                                                 |
| Booking-confirm ID access             | The route validates an expiring signed confirmation token before mutation. Existing authorization, tamper, expiry and concurrency tests are retained.                                                |

The review also retained the existing bounded request-body readers, explicit
browser origin checks, upload tickets, shared paid-AI quotas, literal spreadsheet
input handling and durable client-registration storage. Scanner output alone does
not prove security or legal compliance, and it does not certify external accounts.

## Fresh CodeQL and Semgrep review

The previously disabled Security workflow was enabled and run on the updated site.
It produced 32 findings, which were reviewed in source rather than treated as
automatic evidence of 32 exploitable vulnerabilities.

Code changes address unsafe entropy fallback, DOM construction, explicit link
origin validation, URL-origin filtering, regex escaping, single-pass entity
decoding, environment-derived logging and explicit GCM tag policy. Thirteen focused
security tests exercise these boundaries and the release gate.

Twenty context-dependent findings were individually triaged with explanations in
GitHub; their regression coverage or trusted input boundary is recorded here:

| Alerts   | Evidence supporting triage                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 737–744  | Assertions and mocked provider dispatch in test files; they do not authorize production requests. The raw upload URL exclusion assertion intentionally searches an opaque token for leaked text. |
| 735–736  | SHA-256 fingerprints identify API-key cache/rotation and quota state. They are never used for password storage, password verification or authentication.                                         |
| 723–728  | Private build transformations remove managed loader tags from trusted repository HTML. They are not untrusted-HTML sanitizers.                                                                   |
| 717      | The frame policy is the literal `SAMEORIGIN`; a regression test verifies that attacker-supplied input cannot replace it.                                                                         |
| 719      | The loopback-only watcher restricts CORS to exact loopback hostnames. Regression tests reject lookalikes and userinfo tricks.                                                                    |
| 716, 718 | Plain HTTP is restricted to development loopback metadata. Production hostnames exit the refresh script before any request.                                                                      |

## Release evidence

Local release checks passed:

- `npm run validate`, including 542 unit tests, preview security checks, provider
  tests, weather checks and verification of eight vendored Obsidian plugins.
- Seven focused tests for date boundaries, production input restrictions and
  private preview paths; three braces security regression tests.
- Root and Google-gateway dependency audits: zero known vulnerabilities.
- Production build and all size budgets: approximately 89.1 MB total, including
  47.9 MB of images; source-only artifacts absent from the bundle.
- Visual/browser suite and nine representative axe accessibility pages: no
  serious or critical violations in the checked states.
- Eight registration recovery scenarios and eight home/gallery scenarios across
  all four locales on desktop/mobile; no missing static assets or browser errors.
- Official actionlint 1.7.12: both changed workflows passed. The downloaded binary
  archive was checked against the upstream SHA-256 digest before execution.
- Markdown checks for the new documentation: zero issues.
- Wrangler 4.152.0 compiled the Pages Functions bundle successfully.
- Initial GitHub alert lists were empty while the Security workflow was disabled;
  the fresh scan and subsequent triage are documented above. Release gates check
  the current commit rather than relying on that older empty state.

Production publication is verified separately against the final commit and its
deployment; local tests alone are not evidence that a release is live.
