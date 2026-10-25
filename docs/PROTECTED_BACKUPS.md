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

The default local recovery route requires the archive, its matching protected-key file and the original user's DPAPI profile. Copying only those two files to another Windows account or computer is insufficient. This protects local data from a reader who only obtains the archive; it does not protect against malware already acting as the same signed-in user.

The portable recovery tool adds a separate route for existing backups. It unwraps only explicitly selected existing key identifiers and encrypts the keys in an authenticated portable keyring. A separately generated random 256-bit recovery code unlocks that keyring without Windows DPAPI. Existing archives and their DPAPI key files remain unchanged. No dependencies, account credentials or new access permissions are required.

## Portable recovery without the original Windows profile

Run export while the original Windows profile can still open its DPAPI keys. Obtain each key identifier from the archive's technical manifest. Use absolute paths outside any Git checkout and different directories for the keyring and recovery code:

```powershell
node tools/portable-backup-recovery.mjs export --key <existing-key-uuid> --key <another-existing-key-uuid> --keyring C:/PROJEKT/backups/portable-recovery.nikakeys --code-file C:/Users/<user>/Documents/NIKA-Recovery-Custody/recovery-code.txt
```

The tool prints file paths and the number of exported keys. It never prints the recovery code or a raw backup key. It refuses existing output files, duplicate or unknown key identifiers, symbolic links and junctions, Git paths, empty paths and code/keyring files in the same directory. Generated code and keyring files have access restricted to the current Windows user and SYSTEM, or mode 0600 on other platforms. The recovery code file has the strict format `NIKA-RECOVERY-1` followed by a separate line of 64 hexadecimal characters; do not pass its contents in command arguments or environment variables.

**The recovery code is a sensitive plaintext secret.** Store an independent copy in a trusted password manager, or on offline media or paper in a secure separate location. Its custody must survive loss of this computer. Keep the encrypted keyring with the encrypted backups in a private off-site location. Do not upload the code alongside the keyring or automatically copy it to Drive. Anyone who obtains the archive, keyring and code together can decrypt the backup. Losing both the original Windows profile and the separate recovery code makes this route unavailable.

A keyring covers only the explicit key identifiers exported into it. New archives normally receive new DPAPI keys. Export a new keyring covering those new identifiers, verify it, and replace the off-site recovery set deliberately; an older keyring does not cover future archives automatically. Use new output filenames because the tool never overwrites files. Retain older valid keyrings and their corresponding recovery codes until their archives are retired.

On another computer, keep the keyring and code in separate private directories. The verification command injects only the portable key provider; it never attempts DPAPI or creates a replacement key when an identifier is absent:

```powershell
node tools/portable-backup-recovery.mjs verify --archive C:/Recovery/project.tar.gz.nikabk --keyring C:/Recovery/portable-recovery.nikakeys --code-file C:/Recovery-Custody/recovery-code.txt
node tools/portable-backup-recovery.mjs verify --archive C:/Recovery/database.sql.nikabk --keyring C:/Recovery/portable-recovery.nikakeys --code-file C:/Recovery-Custody/recovery-code.txt
```

Tar verification authenticates the encrypted bytes and reads the archive directory without extracting files. D1 verification authenticates and restores into in-memory SQLite, checks integrity and foreign keys, and reports only table counts. It never connects to production. Git bundle verification reports `integrityOnly: true` and `restored: false`: authenticated bytes still require an isolated Git restore and `git fsck` before they prove recoverable history.

For actual recovery, decrypt to a new private file outside Git. The command authenticates the entire encrypted archive before creating plaintext, applies private file permissions before writing, and publishes the complete output exclusively after successful decryption. It performs no extraction or production database import:

```powershell
node tools/portable-backup-recovery.mjs decrypt --archive C:/Recovery/project.tar.gz.nikabk --keyring C:/Recovery/portable-recovery.nikakeys --code-file C:/Recovery-Custody/recovery-code.txt --output C:/Private-Restore/project.tar.gz
node tools/portable-backup-recovery.mjs decrypt --archive C:/Recovery/database.sql.nikabk --keyring C:/Recovery/portable-recovery.nikakeys --code-file C:/Recovery-Custody/recovery-code.txt --output C:/Private-Restore/database.sql
node tools/portable-backup-recovery.mjs decrypt --archive C:/Recovery/history.git-bundle.nikabk --keyring C:/Recovery/portable-recovery.nikakeys --code-file C:/Recovery-Custody/recovery-code.txt --output C:/Private-Restore/history.bundle
```

Plaintext files contain private configuration, secrets or customer data. Restore tar only into a separately prepared empty private directory, then compare source and restored files. For a Git bundle, create an empty private bare repository with `git init --bare`, run `git bundle verify`, import the bundle into that repository, check the expected commit and run `git fsck`. Restore SQL into an isolated temporary database and check schema and representative records before any separately authorized production restore. Do not replace the working project or production database as a verification step.

Portable recovery requires the encrypted archive, its matching portable keyring and the separate recovery code. Copying wrapped DPAPI records alone still does not remove dependence on the original Windows profile. A successful local verification proves the cryptographic recovery route; separately verify the actual off-site copies by downloading and comparing their encrypted bytes. The CLI does not upload files or claim off-site availability. The previously used E:/PROJECT medium was absent during the earlier backup work.

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
node --test tools/lib/portable-backup-keyring.test.mjs tools/portable-backup-recovery.test.mjs
```
