# GitHub Copilot — HUNDESALON NIKA

You are working in **HUNDESALON_NIKA** (`alanchik66/HUNDESALON_NIKA`).

## Mandatory routing

Before any edit, execute the shared **AI Routing Kernel**: `docs/agents-routing.md`.

Entry order:

1. Repository / workspace / environment / technology / module detection (never guess)
2. Load `AGENTS.md`, this file, `docs/agents-playbook.md`, then relevant parts of `docs/agents-master.md`
3. Decision pipeline: Routing → validations → Implementation → Verification → Completion
4. Change only affected packages/zones (pages, `assets/`, `functions/`, `workers/`, `tools/`, docs)

## Project constraints

- Multilingual static site: keep `de` / `en` / `ru` / `uk` parity unless the task is locale-scoped
- Shared shell: `assets/js/site-shell.js` — do not duplicate header/footer in HTML
- Host: Cloudflare Pages only (not Netlify/Vercel)
- Prefer minimal, root-cause fixes; even px values for UI
- Secrets never in git (`.dev.vars` / Dashboard only)
- Validate with `npm run lint`, `check:links`, `validate` as applicable
- Deploy only when explicitly requested

Custom agent profile: `.github/agents/hundesalon-professional.agent.md`.
