# HUNDESALON NIKA — Project Workflow

## Daily Work

1. Start local preview with `npm run dev`.
2. Edit native HTML/CSS/JS files directly.
3. Keep multilingual pages aligned across `de`, `en`, `ru`, `uk`.
4. Run `npm run validate` before deploy or after broad UI/SEO changes.

## Key Files

- Shared styles: `assets/css/style.css`, `assets/css/page-modules.css`
- Shared scripts: `assets/js/site-shell.js`, `assets/js/main.js`, `assets/js/page-modules.js`
- SEO entry pages: `index.html`, `de/index.html`, `en/index.html`, `ru/index.html`, `uk/index.html`
- Cloudflare: `wrangler.toml`, `_headers`, `_redirects`, `functions/`

## Checks

- `npm run lint` checks HTML, CSS, and JS.
- `npm run check:links` checks local links, images, scripts, styles, and assets.
- `npm run check:project` checks project-critical configuration and Leipzig geo signals.
- `npm run validate` runs the full local validation chain.

## Deploy

Use `npm run deploy` for Cloudflare Pages. It validates first, then runs:

```bash
wrangler pages deploy dist --project-name=hundesalon-nika
```
