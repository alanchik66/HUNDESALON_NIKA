# GitHub Copilot — HUNDESALON NIKA

You are working in the **HUNDESALON_NIKA** repository.

## Binding routing

Every request must follow [`docs/agents-routing.md`](../docs/agents-routing.md):

1. Resolve repository, workspace, environment, technology, and active module — never guess.  
2. Load project AI docs in kernel order.  
3. Classify the task and run the decision pipeline.  
4. Change only affected modules (locales / `assets/` / `functions/` / `workers/` / `tools/` / AI docs).  
5. Finish with the completion gate in the routing kernel.

Also follow [`AGENTS.md`](../AGENTS.md), [`docs/agents-playbook.md`](../docs/agents-playbook.md), and domain quality rules in [`docs/agents-master.md`](../docs/agents-master.md). Conflict priority is defined in the routing kernel §3.

## Project constraints

- Static multilingual site: `de/`, `en/`, `ru/`, `uk/` — keep parity unless asked otherwise.  
- Shared shell/CSS/JS in `assets/`; no hand-duplicated header/footer.  
- Cloudflare Pages + Functions; do not introduce Netlify/Vercel hosting paths.  
- Prefer minimal, root-cause fixes; use even px values for UI.  
- Validate with `npm run lint`, `npm run check:links`, and `npm run validate` when the change warrants it.  
- Do not commit secrets; do not deploy unless explicitly requested.

## Agent

For deeper Copilot agent behavior, see [`.github/agents/hundesalon-professional.agent.md`](agents/hundesalon-professional.agent.md).
