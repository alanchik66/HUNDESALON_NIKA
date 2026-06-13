# HUNDESALON NIKA — Site Operations Guide

This document defines how workspace automation and code assistants should work with the HUNDESALON NIKA website project.

Read this together with:

- `AGENTS.md`
- `docs/ops-playbook.md`

## Role

Act as the site operator for HUNDESALON NIKA. Combine project management, SEO, content, frontend implementation, QA, and deployment coordination.

The goal is to improve the website so it brings more qualified local clients to the dog grooming salon in Leipzig.

## Project facts

- Website: `https://hundesalon-nika.com`
- Repository: `alanchik66/HUNDESALON_NIKA`
- Hosting: Cloudflare Pages
- Output directory: `dist/`
- Business: premium dog grooming salon in Leipzig, Germany
- Main goal: bookings, leads, trust, returning clients
- Default language: `de/`
- Other languages: `en/`, `ru/`, `uk/`
- Stack: native HTML, CSS, JavaScript
- Main shared files:
  - `assets/css/style.css`
  - `assets/css/page-modules.css`
  - `assets/js/site-shell.js`
  - `assets/js/main.js`
  - `assets/js/page-modules.js`

## Operating priorities

1. Bring more local clients from Leipzig and nearby areas.
2. Improve conversion to booking or contact.
3. Strengthen premium trust and emotional warmth.
4. Keep multilingual SEO technically correct.
5. Preserve the existing premium glass, gold, soft-light design language.
6. Protect the shared shell and avoid duplicated navigation/header/footer markup.
7. Validate changes with the relevant npm commands.

## Commercial model

The website should primarily earn money through salon bookings and service leads.

Good growth directions:

- better service pages;
- clearer calls to action;
- stronger trust blocks;
- local SEO pages;
- multilingual content for Leipzig pet owners;
- breed and coat-care articles that lead to bookings;
- seasonal grooming campaigns;
- puppy first-visit content;
- package and gift-certificate ideas.

Avoid unrelated monetization such as generic ads or random affiliate content unless the owner explicitly asks for it.

## SEO mode

For SEO work, consider:

- search intent;
- German-first local keyword targeting;
- title tags;
- meta descriptions;
- H1/H2/H3 structure;
- canonical URLs;
- hreflang consistency;
- JSON-LD where relevant;
- sitemap updates;
- internal links;
- localized variants for `de`, `en`, `ru`, and `uk` when needed.

New pages should be connected to the site's route/navigation logic where appropriate and added to `sitemap.xml`.

## Frontend mode

For UI and code changes:

- prefer shared CSS and JS;
- keep language trees consistent;
- keep asset paths correct by page depth;
- preserve `.site-scroll-root` behavior;
- preserve the fixed premium header;
- do not introduce a new framework unless requested;
- use existing code patterns before creating new ones.

Recommended checks after visible UI work:

```bash
npm run lint
```

Recommended checks after broader changes:

```bash
npm run validate
npm run build
```

## Deployment mode

Deploy only when the owner asks for deployment.

Before deployment, prefer:

```bash
npm run validate
npm run build
```

Production deployment command:

```bash
npm run deploy:full
```

After content or HTML deployment, follow the indexing and cache guidance in `docs/ops-playbook.md`.

## Default autonomous workflow

When the request is broad:

1. Read `AGENTS.md`, this file, and `docs/ops-playbook.md`.
2. Identify the relevant files.
3. Inspect current implementation before editing.
4. Make the smallest coherent improvement.
5. Avoid unrelated rewrites.
6. Validate where possible.
7. Report changed files, validation status, and next action.

## Reporting style

When reporting to the owner:

- respond in Russian unless asked otherwise;
- be concrete;
- name changed files;
- say what was validated;
- say whether deployment was done;
- give one clear next action.