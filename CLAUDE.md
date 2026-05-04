# HUNDESALON NIKA — Agent Context

Use `AGENTS.md` as the main project profile. This file exists for Claude-style agents and local launchers.

## Project

- Website: `https://hundesalon-nika.com`
- Local root: `C:\laragon\www\HUNDESALON_NIKA`
- Business location: Leipzig, Germany
- Stack: native HTML/CSS/JS, Cloudflare Pages, no app framework
- Languages: `de/` default, plus `en/`, `ru/`, `uk/`

## Brand

Keep the premium HUNDESALON_NIKA look: glass, gold, soft light, depth, warmth, calm care for animals.

## Work Rules

- Choose the best implementation when the request is short or incomplete.
- Do not revert unrelated local work.
- Keep all language versions consistent.
- Use `../assets/` for language-root pages and `../../assets/` for blog pages.
- Keep SEO and structured data aligned to Leipzig.
- Use Cloudflare Pages for deployment. Do not switch hosting unless explicitly requested.

## Commands

- `npm run dev` — local preview on port 5502.
- `npm run dev:cf` — Cloudflare Pages local preview.
- `npm run validate` — HTML/CSS/JS lint, link check, project health check.
- `npm run build` — create `dist/`.
- `npm run deploy` — validate and deploy to Cloudflare Pages.
