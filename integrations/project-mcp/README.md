# HUNDESALON_NIKA Project MCP

A local, read-only MCP for inspecting project source. Replaces the unavailable
branch-based bootstrap without restoring its unrestricted filesystem or shell access.
Uses the official MCP TypeScript SDK maintenance line, pinned by version and lockfile.

## Capabilities and limits

- `project_info`: read-only capability summary; no environment or credential output.
- `list_files`: one directory, at most 200 allowed entries (1,000 inspected).
- `read_text`: one UTF-8 source file, at most 256 KiB.
- Paths must be relative to the explicit project root and use `/` separators.
- Denies traversal, hidden credential paths, sensitive filenames, generated directories,
  Windows device/ADS paths, symbolic links, junctions, hard links and binary content.
- No shell, arbitrary writes, network tools, deployment or secret-management tools.
  Use existing native Devin tools for authorized edits, builds and image processing.
- This is not a DLP system: permitted source files must not contain credentials or PII.
- Root confinement assumes the checkout is not concurrently replaced by a hostile local
  process. Filesystem permissions remain the final boundary against same-user tampering.
- Protocol output uses stdout; startup failures use generic stderr without credentials.

## Local verification

```sh
npm --prefix integrations/project-mcp ci --ignore-scripts
npm --prefix integrations/project-mcp test
npm --prefix integrations/project-mcp audit --audit-level=moderate
node integrations/project-mcp/server.mjs --root /absolute/path/to/HUNDESALON_NIKA
```

The tests use temporary fixtures only, including real SDK client/server initialization,
tool discovery, a source read and denied access attempts. CI runs on Windows and Ubuntu.
There is no network listener or separate API key.

## Windows durable launch

`launch.ps1 -RepoRoot <checkout> -Commit <full reviewed commit SHA>` reads its four
runtime inputs directly from that Git object into a commit-scoped LocalAppData cache.
It fetches the pinned commit if absent, never switches branches or changes tracked files,
and installs lockfile dependencies with lifecycle scripts disabled. Setup logs stay off
stdout. Later starts reuse the dependency cache.

Use `-PrepareOnly` during Windows environment setup to populate that immutable cache
without starting the server. This is idempotent; an unchanged lockfile does not reinstall.

The launcher uses the project's pinned Node/npm installed by the saved Devin Windows
blueprint. The account MCP command must bootstrap the launcher from the same reviewed
commit, not an ephemeral branch or a VM-only script. Do not add production secrets to
the MCP environment or widen the installation scope.

`bootstrap.ps1` is the auditable account-command payload. The Windows command embeds
this source with an explicit commit using PowerShell's standard UTF-16 `-EncodedCommand`
argument, avoiding cross-shell quoting. It discovers the checkout under `%USERPROFILE%`,
validates its origin, fetches the immutable commit when needed and loads its launcher.
No execution-policy bypass flag is used. Input/output are explicitly UTF-8.

Rollback: restore the previous account command or stop this module. No Cloudflare,
database, payment or production resource migration is involved. Do not merge or deploy
the PR merely to test this local MCP.
