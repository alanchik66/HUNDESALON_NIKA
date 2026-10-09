# Protected project and database backups

Full project backups include local secrets and Git history. The default backup command therefore streams gzip-compressed tar directly into an AES-256-GCM envelope instead of creating a plaintext archive. No decrypted archive or key enters the repository.

## Create and verify

Run from the canonical checkout:

```powershell
node tools/create-full-backup.mjs
node tools/verify-protected-backup.mjs C:/PROJEKT/backups/<archive>.tar.gz.nikabk
```

Creation authenticates the completed encrypted file and reads the tar directory before reporting success. For a d1-sql envelope, the verification CLI restores only into in-memory SQLite and reports integrity plus per-table row counts. Verification writes no plaintext file and extracts nothing. A JSON manifest records sizes, entry count, creation time, archive path, exclusions and key identifier; it contains no secret values. Keep the manifest beside its archive.

The archive includes source, assets, Git history, local configuration, functions, tools, locales, documentation and the weather vendor bundle. It excludes node_modules at every depth and the root dist, backups, .wrangler, test-results, .playwright-cli and output directories. Those directories contain dependencies, caches or generated results. Existing older backups are preserved.

Output is outside the project in C:/PROJEKT/backups. Each archive has an exclusive filename; existing files are never replaced. Failed streams, exceeded byte limits, producer errors and authentication failures cannot publish a partial backup. The encrypted input stream limit is 10 GiB; for project archives it counts the compressed tar bytes. The tar producer has a 30-minute deadline. Output files receive permissions for the current Windows user and SYSTEM.

## Key protection and recovery

A fresh random 256-bit key is wrapped with Windows DPAPI CurrentUser. The wrapped key file is stored under %LOCALAPPDATA%/HUNDESALON_NIKA/backup-keys, outside Git, with access restricted to the current user and SYSTEM. The archive header carries only its key identifier, a random nonce, creation time and format metadata. The header and ciphertext are authenticated together.

The archive, its matching protected-key file and the original user's DPAPI profile are required for recovery. Copying the archive and wrapped key to another Windows account or computer does not by itself make the backup recoverable. This protects local data from a reader who only obtains the archive; it does not protect against malware already acting as the same signed-in user.

A separate, tested recovery route for the Windows profile or an independently protected recovery key is still required for disaster recovery. This implementation creates no invented password, exports no unprotected key and claims no independent off-site copy. Verify the destination and recovery capability before relying on removable media. The previously used E:/PROJECT medium was absent during this change.

## Database stream API

The reusable helper is tools/lib/protected-backup.mjs:

- protectBackupStream({ source, outputPath, type: 'd1-sql', completion }) encrypts a Node readable stream; completion lets an exporter reject incomplete output before publication.
- verifyProtectedBackup({ file }) authenticates the entire envelope without retaining plaintext.
- decryptBackupStream({ file, sink }) streams plaintext to a caller-owned sink. Authenticate first. AES-GCM releases chunks before the final tag is checked, so the sink must be an isolated disposable restore target and must be discarded on any failure.
- verifyD1Backup({ file }) from tools/verify-protected-backup.mjs authenticates and restores a SQL export into memory with a 256 MiB input limit, checks integrity and foreign keys, and reports table counts. SQLite disk attachment, extension loading, virtual tables and storage-related pragmas are denied. It requires a Node runtime exposing the SQLite authorizer (verified with Node 24.18).
- windowsBackupKey(keyId) resolves an existing wrapped key; omitting keyId creates a new one. Returned key buffers are erased by encryption/decryption. Injected key providers must return a fresh buffer for each call.

Only tar, d1-sql and git-bundle envelope types are accepted. A separate encrypted Git bundle can cover an exact final commit independently of the earlier filesystem archive. The general verification CLI rejects that type because GCM authentication alone does not prove Git restoration; use an explicit isolated Git restore verifier. Callers must impose their own exporter/download deadlines and validate the source database identity. No source credentials, raw SQL, customer data or key material should enter logs. A database restore test must use a separate temporary database, check integrity and representative records, and never import into production merely to verify a backup.

## Verification

The automated tests cover chunked round-trip, encrypted fake-secret confidentiality, changed authenticated metadata, ciphertext and tag tampering, truncation, wrong keys, output preservation, byte limits, producer/source failures and empty streams. A real tar fixture is encrypted, authenticated and restored into a separate test-owned directory; source and fake-secret contents match while generated directories at both root and nested levels remain excluded. No production secrets are used by these tests.

```powershell
node --test tools/lib/protected-backup.test.mjs
```
