# HUNDESALON NIKA project rules

- Treat this as a multilingual static website with Cloudflare/Workers integrations.
- Preserve the existing project conventions and make the smallest safe change.
- Before changing several files, state the plan and list the affected files.
- Never expose or commit secrets from `.env*`, `.dev.vars*`, `.secrets/`, tokens, or keys.
- Keep generated output, dependencies, vendored repositories, and large media out of the working context.
- After edits, run the narrowest relevant formatter, linter, test, or project check and report what was verified.
- Do not deploy, push, commit, rotate credentials, or change production settings unless explicitly requested.

## Graphify workflow

- Use Graphify when a task spans multiple modules, affects shared behavior, or requires architecture/dependency navigation.
- Before such changes, use `npm run graphify:check`; if stale, run `npm run graphify`.
- Use `graphify query`, `graphify path`, `graphify affected`, or `graphify explain` to answer repository-structure questions before broad file scanning.
- After structural changes, run `npm run graphify` again when the graph is useful for follow-up work.
- Do not treat Graphify output as source of truth when it conflicts with the current files; verify important conclusions in source.
