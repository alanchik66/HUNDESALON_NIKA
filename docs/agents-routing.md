# AI Routing Kernel — HUNDESALON NIKA

**Status:** Canonical source of truth for agent routing  
**Consumers:** Cursor Agent, Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot Agents, RooFlow  
**Related:** [`AGENTS.md`](../AGENTS.md) (profile) · [`docs/agents-master.md`](agents-master.md) (quality contract) · [`docs/agents-playbook.md`](agents-playbook.md) (commands & accounts)

This document is not an optional appendix. Every AI workflow **starts**, **decides**, and **finishes** through this kernel. Other instruction files may specialize domain rules; they must not redefine detection, conflict priority, or the decision pipeline.

---

## 0. Document map (load order)

| Priority | File | Role |
|----------|------|------|
| 1 | **This file** (`docs/agents-routing.md`) | Routing, detection, decision pipeline, safety bounds |
| 2 | `AGENTS.md` | Project profile, stack facts, Cloud bootstrap |
| 3 | `docs/agents-master.md` | Domain quality contract (SEO, UX, legal, QA) |
| 4 | `docs/agents-playbook.md` | Task → command / skill / account routing |
| 5 | `.cursor/rules/*.mdc` | Always-on Cursor constraints (must align with this kernel) |
| 6 | `CLAUDE.md` / `GEMINI.md` / `.github/copilot-instructions.md` | Thin entry points → this kernel |
| 7 | `memory-bank/*` | Session continuity (RooFlow / UMB) |
| 8 | `README.md`, `docs/*`, architecture notes | Supporting context after routing |

If two files disagree on routing/detection/git safety, **this kernel wins** except where §3 Conflict Resolution elevates an explicit user or platform mandate.

---

## 1. Startup workflow (mandatory, never skip)

Every task executes this sequence before implementation:

```
Determine Repository
        ↓
Determine Workspace
        ↓
Determine Environment
        ↓
Determine Technology / Framework
        ↓
Determine Active Module / Scope
        ↓
Load AI Instructions (map in §0)
        ↓
Load Relevant Documentation
        ↓
Analyze Dependencies & Blast Radius
        ↓
Analyze Risks
        ↓
Plan Changes
        ↓
Validate Plan (architecture + safety + scope)
        ↓
Begin Implementation
```

**Shortcuts allowed only for evidence-backed micro-edits** (known file, known symbol, no cross-module risk). Even then: confirm repository + module + conflict priority, then edit. Never skip repository validation.

---

## 2. Decision pipeline (every request)

```
Routing (§4–§8)
        ↓
Repository Validation
        ↓
Environment Validation
        ↓
Dependency / Blast-Radius Validation
        ↓
Architecture Validation
        ↓
Security Validation
        ↓
Implementation
        ↓
Verification (project checks)
        ↓
Completion (§12)
```

No stage may be silently skipped. If a stage is N/A, record why internally (one line) and continue.

---

## 3. Conflict resolution (deterministic)

Highest wins:

1. **Explicit user instruction** for this turn  
2. **Active platform / session mandate** (e.g. Cloud Agent PR/branch rules injected into the session)  
3. **This routing kernel**  
4. **Project AI rules** (`.cursor/rules`, playbook accounts/commands)  
5. **`AGENTS.md`**  
6. **`CLAUDE.md` / `GEMINI.md` / Copilot entry**  
7. **`docs/agents-master.md`** domain standards  
8. **Repository standards** (`CONTRIBUTING.md`, `docs/git-workflow.md`)  
9. **Architecture / design docs**  
10. **Framework / language conventions**  
11. **Model defaults**

Never invent a tie-break. If still ambiguous after evidence, ask the user — do not guess repository, environment, or hosting target.

---

## 4. Repository detection (never guess)

Resolve identity in this order; stop at first **high-confidence** match:

1. Explicit repository path from the user  
2. Explicit project name from the user  
3. Current Cursor / IDE workspace root  
4. Current Git repository root (`git rev-parse --show-toplevel`)  
5. Git remote (`origin` → expected: `alanchik66/HUNDESALON_NIKA`)  
6. `.git` metadata  
7. `package.json` (`name`: `hundesalon-nika-website`)  
8. `pnpm-workspace.yaml` / `yarn.lock` / `package-lock.json` (lockfile evidence)  
9. Other manifests only if present (`pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`, `build.gradle`, `pom.xml`, `*.sln`)  
10. Workspace configuration (`.cursor/environment.json`, `wrangler.toml`)  
11. `README.md` / brand markers (`HUNDESALON NIKA`, Leipzig)  
12. **User clarification** — if identity remains uncertain

**Hard stop:** If the resolved repo is not HUNDESALON_NIKA (or the user-named target), do not modify files. Do not cross repositories.

Canonical facts for this project when detection succeeds:

| Signal | Expected |
|--------|----------|
| GitHub | `https://github.com/alanchik66/HUNDESALON_NIKA` |
| Production | `https://hundesalon-nika.com` (Cloudflare Pages `hundesalon-nika`) |
| Local Windows root (owner) | `C:\laragon\www\HUNDESALON_NIKA` |
| Cloud agent root | workspace root containing `AGENTS.md` + `wrangler.toml` |

---

## 5. Workspace detection (never assume)

Always determine and keep consistent:

| Concept | How |
|---------|-----|
| Current workspace | IDE workspace / opened folder |
| Repository root | `git rev-parse --show-toplevel` or workspace root with `AGENTS.md` |
| Working directory | shell `cwd` / tool `working_directory` |
| Active module | path under edit (§7) |
| Opened folder | editor context; may be a subfolder — still resolve to repo root |

Never treat a nested folder (`de/`, `tools/`, `functions/`) as a separate repository.

---

## 6. Environment detection (evidence only)

Classify using files and variables — do not invent:

| Environment | Evidence |
|-------------|----------|
| Local / Development | `npm run dev` / port 5502; no `CI`; optional `.dev.vars` |
| Cloudflare Pages preview | `npm run dev:cf` / port 8788; `dist/` build |
| Production | live apex; `npm run deploy` / Pages production |
| Testing / CI | `CI=true`, GitHub Actions workflows under `.github/workflows/` |
| Sandbox / Cloud Agent | Cursor Cloud Ubuntu; `.cursor/environment.json` |
| Docker / Compose / K8s | only if compose/Dockerfile/k8s manifests exist and are in use |
| Vercel / Netlify | **not used** for this site — do not route deploys there |
| AWS / GCP / Azure | only if task explicitly targets those integrations |
| Cloudflare | `wrangler.toml`, `functions/`, `_headers`, `_redirects`, Pages project |

Env file hints (local only; never commit secrets): `.env`, `.env.local`, `.env.development`, `.env.production`, `.dev.vars` (from `.dev.vars.example`).

---

## 7. Technology & module detection

### 7.1 Stack (this repository — verify, don’t assume alternatives)

Detect from tree + manifests:

| Layer | This project |
|-------|----------------|
| Languages | HTML, CSS, JS (ES modules), Markdown |
| App framework | **None** — native static site |
| Hosting | Cloudflare Pages + Functions (`functions/`), optional `workers/` |
| Package manager | npm (`package-lock.json`) |
| Build | `npm run build` → `dist/` |
| Locales | `de/` (default), `en/`, `ru/`, `uk/` |
| Shared UI | `assets/css/*`, `assets/js/site-shell.js`, `main.js`, `page-modules.js` |
| Config / brand | `config/`, `wrangler.toml`, sitemaps |
| Tooling | `tools/`, `scripts/` |
| Knowledge graph | `graphify-out/` + `npm run graphify*` |
| Session memory | `memory-bank/` |
| Vendor island | `3d-weather-codrops-main/dist-widget/` (prebuilt; do not casual-edit) |

If detection finds a different primary framework, stop and reconcile with the user before rewriting architecture.

### 7.2 Module boundaries (monorepo-style scope)

Not an npm workspaces monorepo. Treat these as **modules** — touch only those affected:

| Module | Path | Notes |
|--------|------|-------|
| Locale surfaces | `de/`, `en/`, `ru/`, `uk/` | Keep parity unless task is locale-specific |
| Shared frontend | `assets/` | Prefer edit once vs four HTML copies |
| Edge functions | `functions/` | Forms, mail, proxies |
| Workers | `workers/` | Emergency / proxy only |
| Tooling | `tools/`, `scripts/` | Node CLIs |
| AI system | `AGENTS.md`, `docs/agents-*.md`, `.cursor/rules/`, `.github/agents/` | Instruction changes |
| CI | `.github/workflows/` | Production safety |
| Docs | `docs/`, `README.md`, `memory-bank/` | Ops / continuity |
| Weather vendor | `3d-weather-codrops-main/` | Out of scope unless explicitly requested |

**Rule:** Only modify affected modules. Never “while here” refactor unrelated packages.

---

## 8. Task routing matrix

Route the request to a **workflow class**, then follow that class’s pipeline (each class still runs §1–§2).

| Class | Triggers | Primary surfaces | Default validation |
|-------|----------|------------------|--------------------|
| **UI / frontend** | layout, CSS, shell, forms UX | `assets/*`, locale HTML | `npm run lint`; smoke `de/` + one locale |
| **Content / i18n** | copy, grammar, pages | `de|en|ru|uk/**` | multilingual grammar rule; `check:links` if links/meta |
| **SEO** | hreflang, canonical, JSON-LD, sitemap | HTML heads, `sitemap*.xml`, tools | `check:project`; IndexNow after deploy |
| **Bug fix** | broken behavior | root-cause module | minimal repro + targeted checks |
| **Refactor** | structure/debt | affected module only | lint + no behavior drift |
| **Security** | secrets, headers, trust boundaries | `functions/`, `_headers`, workflows | security workflows; never commit secrets |
| **Testing / QA** | checks, Playwright | tools + pages | `validate` / `qa:max` as scoped |
| **Review** | PR/diff review | changed paths | correctness + ponytail over-engineering |
| **Deploy** | publish, purge, live | wrangler, CF | **only if explicitly requested**; `deploy:full` |
| **Performance** | CWV, assets, CSS/JS weight | assets, images | measure before/after; no drive-by rewrites |
| **Architecture** | “what connects X” | graphify first | `graphify query\|path\|explain` |
| **AI system** | agent rules, routing | this kernel + entry points | consistency audit (§13) |
| **Git / repo hygiene** | commit, branch, push | git | follow §10 + session mandate |

### 8.1 Skill / plugin routing

| Need | Route to |
|------|----------|
| HTML/CSS/JS UI | `hundesalon-frontend` (owner skills) + shared assets |
| SEO / hreflang | `hundesalon-seo-multilingual` |
| Cloudflare Pages / purge / Functions | `hundesalon-cloudflare` + `cloudflare-deploy` |
| Architecture links | project `graphify` skill |
| Minimal diff | `ponytail*` + `.cursor/rules/ponytail.mdc` |
| Session context | RooFlow `memory-bank/` (UMB) |
| Browser smoke | Playwright skills |
| GitHub issues/PR/CI | GitHub plugin |
| Figma | only when a Figma file is in scope |

### 8.2 Account routing (do not swap)

| Service | Account |
|---------|---------|
| Google Search Console | `ryndenko1982@gmail.com` (sole Verified Owner) |
| Bing Webmaster Tools | `snaiper1984@mail.ru` (`npm run bing:edge`, then index commands) |
| Cloudflare | project secrets / Dashboard — never commit tokens |

Obsolete: do **not** route GSC to `snaiper1984@gmail.com` (cutover 2026-07-19).

---

## 9. Documentation loading (before code generation)

Load in order, stopping when enough context exists for the task:

1. This routing kernel  
2. `AGENTS.md`  
3. Relevant `.cursor/rules` (always-on already applied in Cursor)  
4. `docs/agents-playbook.md` for command/account tasks  
5. `docs/agents-master.md` sections matching the workflow class  
6. `memory-bank/activeContext.md` + `productContext.md` (non-trivial work)  
7. `README.md` / `docs/operations.md` / `docs/git-workflow.md` / caching docs as needed  
8. Existing patterns in code (prefer graphify over full-tree scan)

---

## 10. Git & safety rails

### Never

- Modify unrelated files or another repository  
- Guess the destination repository, framework, or environment  
- Delete branches, rewrite history, or force-push  
- Ignore this kernel, `AGENTS.md`, or architecture boundaries  
- Commit secrets (`.dev.vars`, API keys, tokens)  
- Deploy to production without explicit user request  
- Use Netlify/Vercel for this site’s hosting path  

### Prefer

- Smallest blast radius; shared shell/CSS/JS once for all locales  
- Symbol / graphify / import references over whole-repo scans  
- Root-cause fixes in shared functions over per-caller patches  

### Git policy (default vs session)

- **Default project policy:** work on `main`; commit/push when the user asks; no unsolicited PRs (`AGENTS.md`, playbook).  
- **Session override:** if the active platform mandate requires feature branches / PRs (e.g. Cursor Cloud Agent instructions), follow §3 item 2 — create `cursor/<name>-…` branches and PRs as mandated, still without force-push or history rewrite.

---

## 11. Performance of agent work

Avoid full-repository scans when unnecessary. Prefer:

1. Graphify (`graphify query|path|explain`)  
2. Symbol / filename search scoped to module  
3. Import / dependency neighbors  
4. Recent changes (`git`)  
5. Architecture docs  

Full audits (agents-master discovery lists) apply to **broad** or **unknown-area** tasks, not every typo fix.

---

## 12. Completion checklist (routing gate)

A task is complete only when:

- [ ] Repository and module were identified (not guessed)  
- [ ] Environment matched the action (local vs CI vs deploy)  
- [ ] Only affected modules changed  
- [ ] Conflict priority was respected  
- [ ] Domain validations for the workflow class ran (`lint` / `check:links` / `validate` as applicable)  
- [ ] Multilingual parity held when content/UI touched  
- [ ] No secrets committed; no unsolicited production deploy  
- [ ] Report states what changed, what was verified, residual risk  

---

## 13. Consistency rule for AI-system edits

When editing agent instructions:

1. Change **this kernel** first for routing/detection/pipeline/safety.  
2. Update entry points to **reference**, not copy, the kernel.  
3. Remove or rewrite conflicting duplicates elsewhere.  
4. Keep playbook as **operational** command/account table — not a second pipeline.  
5. Keep `agents-master.md` as **quality/domain** contract — workflows there must call this kernel, not redefine it.

---

## 14. Workflow hooks (how other docs must integrate)

Every named workflow in the AI system must begin with: **“Execute Routing Kernel §1–§2, then …”**

Applies to: code generation, refactoring, bug fix, security, testing, review, deployment, performance, SEO, content/i18n, architecture, and AI-system maintenance.

Playbook command tables answer *which npm script / skill*.  
Master contract answers *what quality bar*.  
This kernel answers *where you are, what you may touch, and in what order you decide*.
