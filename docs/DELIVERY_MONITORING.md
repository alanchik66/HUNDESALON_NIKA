# Delivery monitoring

The delivery ledger records technical outcomes for booking/contact submissions and
booking confirmation. It provides evidence of attempted work without storing
recipients, customer details, message bodies, provider response bodies or tokens.

## Recorded states

| State      | Meaning                                                                      | Action                                                                  |
| ---------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `pending`  | The attempt began; its final update is not recorded.                         | Check attempts older than ten minutes against the relevant provider.    |
| `accepted` | The provider accepted the operation.                                         | Verify the mailbox or Calendar/Sheets when end-to-end delivery matters. |
| `failed`   | The provider rejected the operation or its call threw.                       | Inspect the technical channel/status and the provider's own status.     |
| `skipped`  | The integration explicitly skipped work, for example notifications disabled. | Check whether the skip is expected for this environment.                |

A successful booking response can coexist with a failed optional notification.
A provider's acceptance is not proof of delivery to the recipient's mailbox.
`pending` can also indicate an interrupted metadata update after successful work.
The ledger therefore does not provide a safe basis for automatic resending.

Rows contain a unique attempt ID, request UUID, form type, known channel, state,
HTTP status, stable result code and timestamps. Attempt IDs distinguish concurrent
calls for the same request and channel. Tracking failures log only a stable event
and technical identifiers. Database unavailability preserves the original
operation's result or exception rather than blocking a validated booking.

## Local status command

Run from the canonical repository with an explicit D1 database UUID:

```powershell
node tools/delivery-status.mjs --database-id <D1 UUID> --hours 24
node tools/delivery-status.mjs --database-id <D1 UUID> --hours 168 --json
node tools/delivery-status.mjs --help
```

Choose the actual database bound to the environment you are inspecting. The
command never infers production or preview and performs one parameterized SELECT.
It uses the existing Wrangler administrator OAuth session and refreshes it when
expired. A scoped API token is used only when readable Wrangler OAuth configuration
is absent. Credentials are not printed or placed in command arguments.

The time window is a whole number from 1 to 168 hours, with a default of 24. Results
contain at most the latest 100 failed/skipped attempts and pending attempts strictly
older than ten minutes within that window. Accepted attempts are excluded from
this attention list. Both text and JSON contain only the documented metadata
fields; unknown backend fields are discarded, malformed metadata is rejected.

Exit code 0 means the read succeeded, including when attention items were found.
Exit code 1 means invalid arguments, unavailable authentication, a failed query
or invalid metadata. An empty list does not prove that integrations are configured
or healthy. The command never retries a notification, edits a row or sends a
message. It does not start a scheduled monitor.

## Failure handling and retention

The sendmail flow tracks main/client/admin email, Telegram, registrations, contact
sync, automation and failure alerts. Email failures can produce an existing
Telegram alert; that alert's own outcome is tracked. If Telegram also fails, the
ledger remains available for an independent administrative check. Alerting depends
on the existing notification configuration and does not bypass disabled preview
notifications.

Apply `migrations/0009_delivery_tracking.sql` to the intended isolated database
before release. Older code ignores the additive table. Metadata older than thirty
days is pruned by the application; only `delivery_attempts` is affected. CRM,
booking rows, Calendar events and stored files are preserved. Idle deployments
may retain older metadata until pruning next runs.

Review the provider before retrying a customer operation. A timeout or missing
final update can follow successful external work; blindly replaying the form can
duplicate a booking or notification. Calendar confirmation keeps its existing
deterministic event ID and idempotency checks.

## Verification

The focused tests execute the actual production migration in real SQLite and
cover provider acceptance/skips/rejection, primitive thrown values, confidential
error suppression, missing-schema fail-open tracking, independent concurrent
attempts, pending final-update failure and thirty-day retention boundaries.
CLI tests execute the real SELECT against SQLite, check attention-window and
100-row limits, exact parameterization, read-only behavior, authentication
injection, confidential-output filtering and failure handling.

These tests do not verify live provider configuration or mailbox delivery. Those
require a separately controlled end-to-end test in the intended environment.
