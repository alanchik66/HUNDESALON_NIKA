# Client registration recovery

Apply `migrations/0010_client_registrations.sql` to the production `CHAT_DB` before deploying the handler.

Validated registrations are saved in `client_registrations` before HTTP success. Google Sheets is a mirror; its authorization and notification providers do not gate the client's transition to booking. The response identifies the persisted record via `registration_id`. External follow-ups use `waitUntil`; a failed mirror retains its full record with `sheet_synced_at IS NULL`.

Inspect the backlog without printing customer data:

```sh
node tools/sync-client-registrations.mjs
```

If Google OAuth reports `invalid_grant`, restore the approved Google connection, verify spreadsheet access, and synchronize the matching production credentials. A failed token can also prevent calendar access and final booking storage; D1 registration success alone does not prove those services work.

Replay up to 25 pending registrations after restoring Google:

```sh
node tools/sync-client-registrations.mjs --apply
```

Run one replay process at a time. It reads the request IDs already in column B before appending and stops on provider failure. Re-run until the pending count is zero. It never deletes primary records or prints their contents. For uncertain previous writes, the request ID makes reconciliation possible.

Production verification must check both HTTP success and the matching D1 row. Test records must be clearly labelled; never use real appointments as a smoke test. Keep D1 CRM backups and retention under the existing operational data policy. Do not put this private table or its payloads behind a public read endpoint.
