# Product Context

High-level overview of HUNDESALON NIKA. Updated as the product evolves.
2026-07-18 13:20:00 - Initialized from project profile (RooFlow Memory Bank / Cursor).

## Project Goal

- Premium multilingual grooming salon website for Leipzig, Germany.
- Production: https://hundesalon-nika.com (Cloudflare Pages).
- Locales: `de/` (default), `en/`, `ru/`, `uk/`.

## Key Features

- Native HTML/CSS/JS (no app framework).
- Shared shell: header/nav/i18n/weather via `assets/js/site-shell.js`.
- Scroll root `.site-scroll-root` via `assets/js/main.js`.
- Booking/forms via `assets/js/page-modules.js`.
- Brand: glass, gold (#C9A84C family), soft light — no black outlines.
- SEO: hreflang, canonical, Leipzig JSON-LD, IndexNow, Bing/GSC tooling.

## Overall Architecture

- Static site → Cloudflare Pages `dist/` + Pages Functions (`functions/`).
- Shared CSS: `assets/css/style.css`, `assets/css/page-modules.css`.
- Weather widget vendor: `3d-weather-codrops-main/dist-widget/` (do not touch without reason).
- Agent tooling: Graphify (`graphify-out/`), Ponytail (minimal diffs), this Memory Bank.
