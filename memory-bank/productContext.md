# Product Context

## Product

HUNDESALON NIKA is a multilingual static website for a grooming salon in Leipzig. The production site is `https://hundesalon-nika.com`.

## Supported Locales

- German (`de`)
- English (`en`)
- Russian (`ru`)
- Ukrainian (`uk`)

## Architecture

- Static HTML pages with shared CSS and JavaScript under `assets/`.
- Matching page slugs and semantically aligned content across all four locales.
- Cloudflare Pages/Workers integrations under `functions/` and `workers/`.
- Shared navigation and shell behavior in `assets/js/site-shell.js`.

## Quality Goals

- Preserve accessibility, responsive behavior, SEO metadata, and localized parity.
- Keep changes minimal and consistent with existing project conventions.
- Treat `AGENTS.md` and `.github/copilot-instructions.md` as authoritative working rules.
