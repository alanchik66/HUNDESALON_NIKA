# System Patterns

## Localization

- Keep page slugs aligned across `de/`, `en/`, `ru/`, and `uk/`.
- Keep localized content semantically equivalent while preserving natural grammar.

## Frontend

- Reuse the shared site shell instead of duplicating navigation or footer markup.
- Validate visual changes in a real browser on desktop and mobile viewports.

## Cloudflare

- Keep request-scoped mutable state out of module globals.
- Preserve validation and error handling in Pages Functions and Workers.
- Separate repository changes from external account, DNS, email, and production configuration.

## Tooling

- Run the narrowest relevant check after each change.
- Use Graphify for cross-module navigation, then verify conclusions against source files.
- Use stdio for local MCP servers unless a supervised persistent HTTP service is required.
- Preserve unrelated working-tree changes and never deploy, push, or commit without an explicit request.
