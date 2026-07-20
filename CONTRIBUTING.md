# Contributing

Thank you for improving HUNDESALON_NIKA.

## Before You Start

- Check open issues and pull requests to avoid duplicate work.
- Keep changes focused and minimal.
- Preserve multilingual consistency across `de/`, `en/`, `ru/`, and `uk/` where applicable.
- AI agents: follow [`docs/agents-routing.md`](docs/agents-routing.md) (startup → decision pipeline → affected modules only) before editing.

## Development Checklist

1. Make targeted changes only (routing kernel module boundaries).
2. Run local checks:
   - `npm run lint`
   - `npm run check:links`
   - `npm run validate`
3. For larger UI/SEO/Cloudflare changes, also run:
   - `npm run qa:max`

## Pull Requests

- Use a clear title and describe root cause and fix.
- Include validation output and risk notes.
- Avoid unrelated refactors in the same PR.

## Commit Messages

Use concise, scoped messages, for example:

- `fix(ui): align mobile hero spacing`
- `fix(seo): correct hreflang for de contacts page`
- `ci(security): tune semgrep scope`
