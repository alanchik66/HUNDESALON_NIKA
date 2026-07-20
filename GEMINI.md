# GEMINI.md

Instructions for Gemini CLI and compatible coding agents working in **HUNDESALON NIKA**.

## Mandatory routing

Before any file change, execute [`docs/agents-routing.md`](docs/agents-routing.md):

1. Detect repository / workspace / environment / technology / active module (never guess).  
2. Load AI docs in kernel order (§0 / §9).  
3. Classify the task (§8) and run the decision pipeline (§2).  
4. Edit only affected modules.  
5. Complete with kernel §12.

Also read: [`AGENTS.md`](AGENTS.md), [`docs/agents-playbook.md`](docs/agents-playbook.md), domain standards in [`docs/agents-master.md`](docs/agents-master.md).

## Project facts

- Multilingual static site (`de` default, `en`, `ru`, `uk`) for a Leipzig grooming salon.  
- Native HTML/CSS/JS; Cloudflare Pages + `functions/`; npm; no React/Next app framework.  
- Shared UI: `assets/`; do not duplicate header/footer (use `site-shell.js`).  
- Hosting is Cloudflare only — not Netlify/Vercel.

## Default workflow

Route → inspect (prefer graphify) → minimal change → validate (`npm run lint` / `validate` / `check:links` as applicable) → report.

Deploy only on explicit request (`npm run deploy:full`). Secrets stay in Dashboard / `.dev.vars`, never in git.

## Accounts

- GSC: `ryndenko1982@gmail.com`  
- Bing: `snaiper1984@mail.ru`
