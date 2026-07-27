# HUNDESALON NIKA — Copilot instructions #

## Project ##

- This is a multilingual static website for HUNDESALON NIKA.
- Supported locales are `de`, `en`, `ru`, and `uk`.
- Runtime integrations target Cloudflare Pages/Workers.
- Preserve existing behavior and keep diffs small.

## Before editing ##

- Read the relevant source and nearby configuration first.
- For cross-module work, run `npm run graphify:check` and use Graphify when the index is stale.
- State the intended files and user-visible effect before making a multi-file change.

## Safety ##

- Never read, print, commit, or modify secrets in `.env*`, `.dev.vars*`, `.secrets/`, tokens, or private keys.
- Never deploy, push, commit, rotate credentials, or change production settings unless the user explicitly asks.
- Do not modify generated output, dependencies, vendored directories, or large media.
- Treat payment, email, OAuth, and Cloudflare code as security-sensitive and preserve validation/error handling.

## Implementation ##

- Reuse existing helpers and conventions.
- Keep localized content semantically aligned across all four locales.
- Use the existing formatter and lint scripts; run the narrowest relevant check after edits.
- After JavaScript or tooling changes, run `npm run graphify:update` if that script exists; otherwise run `npm run graphify`.

## Handoff ##

- Summarize changed files, checks run, and any remaining manual step.
- Ask before any irreversible or externally visible action.
