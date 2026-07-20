# HUNDESALON NIKA — Gemini CLI Project Instructions

Bootstrap every task with the **AI Routing Kernel**: [`docs/agents-routing.md`](docs/agents-routing.md).

Then load:

1. [`AGENTS.md`](AGENTS.md) — project profile  
2. [`docs/agents-playbook.md`](docs/agents-playbook.md) — commands / accounts / skills  
3. [`docs/agents-master.md`](docs/agents-master.md) — domain policies (SEO, UX, legal, QA)  
4. [`CLAUDE.md`](CLAUDE.md) — Claude-oriented summary (same project rules)

## Project bind (after kernel confirms this repo)

- Static multilingual site (`de` / `en` / `ru` / `uk`), Cloudflare Pages, shared shell in `assets/js/site-shell.js`
- Prefer minimal root-cause diffs (Ponytail); use Graphify before broad codebase tours
- Validate with `npm run lint`, `npm run check:links`, `npm run validate` as applicable
- Deploy only on explicit request (`npm run deploy:full`)

Do not invent a separate Gemini-only routing system — reuse the kernel.
