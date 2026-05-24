# Brand images — HUNDESALON NIKA

## Source

| File | Role |
|------|------|
| `logo.png` | **Master** — header on site, source for all generated icons |
| `favicon/` | All favicon sizes + `favicon.ico` (generated) |

## Generated (do not edit by hand)

Run from repo root:

```bash
npm run brand:assets    # from logo.png → favicon/*, search-logo-*, social-preview
npm run brand:seo       # HTML head + JSON-LD on all pages
npm run brand:sitemap   # sitemap-brand.xml for search engines
```

| File | Use |
|------|-----|
| `search-logo-clear-512.png` | JSON-LD `Organization.logo`, Bing/Google rich results |
| `search-logo-512.png` | Alternate search branding |
| `favicon-search-512.png` | Large PNG favicon in `<head>` |
| `social-preview-1200x630.png` | Open Graph / Twitter |
| Root `favicon.ico` | Bing SERP favicon (copy of generated ICO) |

## Bing / SEO

- Bing **does not** accept logo upload in Webmaster UI; it crawls `/favicon.ico` and schema logo URL.
- Submit: `npm run seo:indexnow`, `npm run bing:ai-performance`
- Sitemap: `sitemap-brand.xml` (listed in `robots.txt`)

## Gallery / content

`gallery*.jpg`, `hero-dog.jpg` — page content, not search icons.

`icon-pak/` — UI icon pack for site features, not brand logo.
