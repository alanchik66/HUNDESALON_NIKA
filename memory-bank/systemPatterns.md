# System Patterns

Recurring patterns for HUNDESALON NIKA.
2026-07-18 13:20:00 - Initialized.

## Coding Patterns

- Edit shared shell once (`site-shell.js` / `main.js` / shared CSS); keep `de/en/ru/uk` consistent.
- Asset paths: `../assets/` on language-root pages, `../../assets/` under `blog/`.
- Interactive elements: `<button>` or `<a>` only; respect `prefers-reduced-motion`.
- No `console.log` in production paths; breakpoint mobile = `900px`.

## Architectural Patterns

- Header/nav from `standardizePageHeader()` — do not duplicate markup in HTML.
- Deploy: Cloudflare Pages only (`npm run deploy` / `deploy:full`); no Netlify.
- Secrets only in Dashboard / `.dev.vars` — never commit.

## Testing Patterns

- `npm run lint` / `npm run validate` before deploy.
- Visible UI: smoke on `de/index.html` + one other locale (Playwright when needed).
- Architecture questions: prefer `graphify query|path|explain` before broad tours.
