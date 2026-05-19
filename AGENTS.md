# HUNDESALON NIKA — Codex Project Profile

## Project

- Website: `https://hundesalon-nika.com`
- Local root: `C:\laragon\www\HUNDESALON_NIKA`
- Stack: native HTML/CSS/JS, Cloudflare Pages, no app framework.
- Languages: `de/` default, plus `en/`, `ru/`, `uk/`.
- Main shared files: `assets/css/style.css`, `assets/css/page-modules.css`, `assets/js/site-shell.js`, `assets/js/main.js`, `assets/js/page-modules.js`.
- The site uses `.site-scroll-root` as the fixed scroll container and a fixed premium header.

## Brand

- Always keep the HUNDESALON_NIKA premium look: glass, gold, soft light, depth, warmth, care for animals.
- Avoid black outlines, harsh shadows, loud effects, and generic template visuals.
- Keep text clean, emotional, refined, and useful.
- Do not use the banned wording from the owner instructions.

## Work Rules

- If the request is incomplete, choose the best implementation and complete it.
- Protect user work: never revert unrelated local changes.
- Before broad HTML changes, check one representative page per language and the shared shell files.
- Keep multilingual structure consistent across `de`, `en`, `ru`, `uk`.
- For pages under `blog/`, asset paths usually need `../../assets/`; for language-root pages, `../assets/`.
- Main business location is Leipzig, Germany. Keep SEO, JSON-LD, maps, weather fallback, sitemap, and content aligned to Leipzig.
- Do not duplicate header/footer/nav markup by hand unless a page explicitly needs a special static fallback; shared shell logic lives in `assets/js/site-shell.js`.
- After UI/CSS/JS changes, run at least:
  - `npm run lint`
  - browser smoke checks with Playwright or a local server when layout visibility is affected.

## Commands

- Install dependencies: `npm install`
- Local preview: `npm run dev` or `npm run preview`
- Cloudflare local preview: `npm run dev:cf`
- Full validation: `npm run validate`
- Link check: `npm run check:links`
- Project health check: `npm run check:project`
- Production bundle: `npm run build`
- Cloudflare deploy: `npm run deploy`

## Plugin And Skill Routing

- Use GitHub plugin for repository, issue, PR, branch, review, and CI tasks.
- Use Figma plugin and Figma skills only when a Figma design/file/component is involved.
- Use `cloudflare-deploy` for Cloudflare Pages deployment, preview, and production publishing tasks.
- Use `playwright` or `playwright-interactive` for real browser checks, screenshots, mobile/desktop layout QA, and visual regressions.
- Use `screenshot` only when an OS-level screenshot is explicitly needed.
- Use `security-best-practices` only for explicit security review or secure-by-default work.
- Do not use Netlify for this project unless the hosting strategy changes; this site is Cloudflare Pages.
- Gmail, Google Calendar, and Slack are not project-default tools; use them only when the user explicitly asks for mailbox, scheduling, or Slack work.

## Deployment

- Cloudflare config: `wrangler.toml`.
- Production deploy command in `package.json`: `npm run deploy`.
- Before deploy, prefer validating with `npm run lint` and a quick local browser smoke test.

## Cursor Cloud specific instructions

Cloud agents run on Ubuntu. Configuration lives in `.cursor/environment.json`.

### Bootstrap (every agent start)

1. `npm install` runs automatically from `environment.json`.
2. Dev preview: terminal `dev` or `npm run dev` → http://localhost:5502 (root redirects to `/de/`).
3. Cloudflare Pages + Functions locally: `npm run dev:cf` → port 8788 (builds `dist/` first).

### Validation before PR or deploy

```bash
npm run lint
npm run check:links
npm run check:project
npm run build
```

Full gate: `npm run validate` (lint + link check + project health).

### Deploy (only when explicitly requested)

```bash
npm run deploy:full
```

Or step by step: `npm run deploy`, then `npm run cf:purge-cache`, then `npm run check:live-html`.

Requires `CLOUDFLARE_API_TOKEN` in Cursor Cloud secrets (Dashboard → Cloud Agents → Secrets). Do not commit tokens. After HTML deploy, purge CDN cache so `_headers` cache rules apply immediately.

### Secrets (Cursor Dashboard, not in git)

Add in [Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents) for this environment:

| Variable | Purpose |
|----------|---------|
| `CLOUDFLARE_API_TOKEN` | `wrangler pages deploy` from cloud agents |
| `RESEND_API_KEY` | Production email via `functions/sendmail.js` |
| `OPENROUTER_API_KEY` | Optional: SEO/AI functions (`openrouter.js`, `seo-generate.js`) |

Local-only dev vars (optional): copy `.dev.vars.example` to `.dev.vars` for `npm run dev:cf` — never commit `.dev.vars`.

### Repo and hosting

- GitHub: `https://github.com/alanchik66/HUNDESALON_NIKA`
- Production: Cloudflare Pages project `hundesalon-nika`, output `dist/`
- Default locale: `de/`; also `en/`, `ru/`, `uk/`
- Weather widget assets are prebuilt under `3d-weather-codrops-main/dist-widget/` (no separate widget `npm install` in CI)

### UI change checklist

- Edit shared shell/CSS/JS once; keep all four language trees consistent.
- Asset paths: `../assets/` on language-root pages, `../../assets/` under `blog/`.
- After visible UI changes: `npm run lint` and browser smoke on `de/index.html` plus one other locale.
