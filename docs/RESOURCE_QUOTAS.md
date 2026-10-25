# Shared daily resource quotas

All OpenAI routes, GIF searches and file/transcript upload routes reserve quota in
`CHAT_DB` before external work. This is a shared limit for this site's deployment
and database, across Cloudflare locations. It does not include unrelated resources
or calls made outside this application.

## Defaults

A day is 00:00–24:00 UTC. Count limits apply to attempted operations, including
provider errors and repeated admissions; they are deliberately not refunded.

| Resource                               | Entire site/day | Trusted client IP/day | Session/day | Entire site bytes/day | Client/session bytes/day |
| -------------------------------------- | --------------: | --------------------: | ----------: | --------------------: | -----------------------: |
| AI calls (`ai`)                        |             200 |                    30 |          20 |                     — |                        — |
| File admissions (`uploads`)            |             100 |                    10 |          10 |                 1 GiB |                  300 MiB |
| Proxied chunks (`upload_transfer`)     |           2,000 |                   200 |         100 |                 1 GiB |                  300 MiB |
| Completion/transcript work (`storage`) |           1,000 |                   150 |         100 |                64 MiB |                    8 MiB |
| GIF searches (`gifs`)                  |           1,000 |                   100 |         100 |                     — |                        — |

AI chat, authenticated message drafts and SEO generation share the same AI count.
Existing per-request input, output-token and single-provider limits remain in
force. These are call and byte ceilings, not a guaranteed monetary spending cap:
provider prices, stored-file retention and other Cloudflare products are separate.

File admission reserves the full declared size before Microsoft token/folder work.
Booking photos also reserve their verified size. Chunk transfers have an additional
byte quota, so retries/replays cannot proxy unlimited bytes. A chunk stream is
bounded independently of its claimed Content-Length. The browser receives an opaque
AES-GCM ticket instead of the Microsoft bearer URL. The ticket binds the real URL,
authenticated session, declared file size and one-hour expiry; each chunk's total
must match that size. Direct storage URL submission is rejected. The existing
browser header transport accepts this opaque value without a UI change. An upload
already started with the old raw-URL contract at deployment must be restarted.
Previously disclosed Microsoft capabilities can remain valid at Microsoft until
their upstream expiry; the application does not issue or accept new raw URLs. A completed file or existing
deduplicated admission can still consume an attempt; the counter protects work
rather than claiming exact unique-file accounting.

Completed-file notifications remain deduplicated by the existing content receipt.
Transcript quota charges the serialized request size. It does not store message
content in the quota ledger.

## Configuration

No new binding or dependency is needed. Apply
`migrations/0008_resource_usage_quotas.sql` to each isolated CHAT_DB before publishing
the guarded routes. The additive tables are ignored by older application code.

Optional server environment settings follow this pattern:

- `RESOURCE_QUOTA_AI_ACCOUNT`, `RESOURCE_QUOTA_AI_CLIENT`,
  `RESOURCE_QUOTA_AI_SESSION`.
- Replace `AI` with `UPLOADS`, `UPLOAD_TRANSFER`, `STORAGE` or `GIFS` for the
  corresponding resource.
- Byte caps for uploads, transfer and storage append `_BYTES`, for example
  `RESOURCE_QUOTA_UPLOADS_ACCOUNT_BYTES`.

Omitted settings use the defaults. Configured caps must be positive whole numbers;
zero, negative, fractional, nonnumeric or excessive values deny work. Count caps
cannot exceed 100,000 and byte caps cannot exceed 10 GiB. There is no disabling flag,
client-provided cap, unlimited mode or administrative HTTP bypass.

The effective quotas of preview and production are separate only when their
CHAT_DB bindings are separate. Never point a preview deployment at production D1.

## Atomic accounting and failure behavior

One ledger INSERT executes the quota-checking SQLite trigger. It tests account,
client and session counts/bytes, then increments all three scopes in the same write
transaction. If any scope is exhausted, RAISE(ABORT) rolls the entire statement back.
No read-then-write race, per-location cache or application-local mutable counter is
used for the daily budget. Existing short-window edge rate limits remain a separate,
approximate layer.

Only Cloudflare's CF-Connecting-IP is used for the client key. X-Forwarded-For and
claimed customer IDs cannot create new client buckets. Missing IPs share one
conservative bucket; routes without an authenticated session use a client-derived
session bucket. Rotating browser sessions therefore cannot evade the client or
site-wide cap.

The ledger contains resource names, UTC dates, numeric reservations and SHA-256
scope hashes. These hashes are pseudonymous technical metadata, not a claim of
irreversible anonymization. Names, email, phone, messages, upload URLs and tokens
are never saved in these tables or error logs. Successful reservations prune quota
metadata older than the current and previous six UTC dates, using indexed deletes;
CRM records and stored files are untouched. Idle databases can retain older quota
metadata until the next successful reservation.

A missing migration, unavailable D1 or malformed cap fails closed for external
resource work. Chat replies with its existing localized staff handoff and a stable
limit/unavailable reason. Upload/GIF/authenticated generation routes return a safe
localized message with 429 for exhaustion or 503 for unavailable accounting, plus
Retry-After and no-store. Human-mode chat, ordinary booking without a photo and
public fixed-template message drafts do not depend on quota storage.

## Verification

The focused suite executes the production migration in real SQLite. It verifies
all-or-nothing scope charging, byte admission/transfer caps, client/session rotation,
missing-schema behavior, UTC rollover, retention and localized responses. Eight
independent concurrent connections issue 400 reservations against a 37-call cap:
exactly 37 succeed and 363 are denied, with no partial charges.

Route tests assert that denied work makes no OpenAI/GIPHY/OneDrive call, shared AI
budgets span draft/SEO, human chat and public templates survive old schema, and
replayed or oversized chunks never exceed authorized transfer bytes.
