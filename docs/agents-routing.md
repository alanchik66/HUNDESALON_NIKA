# AI Routing Kernel — HUNDESALON NIKA

**Document type:** Canonical routing capability (single source of truth)  
**Consumers:** Cursor Agent, Claude Code, OpenAI Codex, Gemini CLI, GitHub Copilot Agents, Roo Flow, and compatible coding agents  
**Not a standalone checklist:** every workflow below *is* routing. Entry points must execute this kernel; they must not invent a parallel routing dialect.

---

## 0. How this document is used

| Role | File | Duty |
|------|------|------|
| Kernel (this file) | `docs/agents-routing.md` | Detection, startup, decision pipeline, safety, conflict order, performance |
| Domain contract | `docs/agents-master.md` | SEO, UX, legal, content, QA policies — after routing succeeds |
| Ops map | `docs/agents-playbook.md` | Task → commands / accounts / skills |
| Host profiles | `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md` | Thin adapters that bootstrap the kernel |
| Cursor always-on | `.cursor/rules/00-routing-kernel.mdc` | Forces kernel before edits |
| Task/skill map | `.cursor/rules/40-agent-routing.mdc` | SEO accounts + skill routing (after kernel) |

**Rule:** If a host profile and this kernel disagree on *how to start a task*, this kernel wins unless the user gave an explicit contrary instruction.

---

## 1. Conflict resolution (instruction priority)

When rules collide, apply **exactly this order** — never invent a new hierarchy:

1. **Explicit user instruction** for this turn (including Cloud Agent / PR task overrides)
2. **Project AI rules** (`.cursor/rules/*`, host profile for the current tool)
3. **`AGENTS.md`** (Codex / Cursor project profile)
4. **`CLAUDE.md`** (Claude Code profile)
5. **Repository standards** (`docs/agents-playbook.md`, `docs/git-workflow.md`, `CONTRIBUTING` if present)
6. **Architecture** (`docs/agents-master.md`, `memory-bank/systemPatterns.md`, `graphify-out/`)
7. **Framework / platform conventions** (Cloudflare Pages, static HTML/CSS/JS)
8. **Language conventions** (`de` / `en` / `ru` / `uk` grammar rules)
9. **AI product defaults**

Business/legal priority for *product* decisions (booking, AGB, prices) remains in `docs/agents-master.md` §139. That hierarchy answers *what is safe to change*; **this** hierarchy answers *which instruction wins*.

---

## 2. Decision pipeline (every request)

Every request — code, docs, SEO, deploy, review — passes through:

```
Routing
  → Repository Validation
  → Environment Validation
  → Dependency Validation
  → Architecture Validation
  → Security Validation
  → Implementation
  → Verification
  → Completion
```

Skip a stage only when it is **provably N/A** (e.g. pure docs typo → Dependency Validation = “no runtime deps touched”). Log the skip mentally; never skip silently on ambiguous tasks.

---

## 3. Startup workflow (mandatory, every task)

Execute in order. Do not begin implementation until the chain completes:

```
Determine Repository
  → Determine Workspace
  → Determine Environment
  → Determine Technology
  → Determine Framework
  → Determine Module / package boundary
  → Load AI Instructions
  → Load Documentation
  → Analyze Dependencies
  → Analyze Risks
  → Plan Changes
  → Validate Plan
  → Begin Implementation
```

**Never guess** repository, environment, framework, or module. If evidence is insufficient after the detection stacks below, stop and ask for clarification.

---

## 4. Repository detection

Resolve **one** repository identity using this priority. Stop at the first conclusive match:

1. Explicit repository path from the user
2. Explicit project name from the user
3. Current Cursor / IDE workspace root
4. Current Git repository (`git rev-parse --show-toplevel`)
5. Git remote (`origin` → expected `alanchik66/HUNDESALON_NIKA`)
6. `.git` metadata
7. `package.json` (`name`: `hundesalon-nika-website`)
8. `pnpm-workspace.yaml` (if present)
9. `yarn.lock` / `package-lock.json`
10. `pyproject.toml` / `Cargo.toml` / `go.mod` / `composer.json` / `build.gradle` / `pom.xml` / `*.sln`
11. Workspace configuration (`.cursor/environment.json`, VS Code multi-root)
12. `README.md` identity markers
13. User clarification (last resort)

**This repo’s positive ID (when confirmed):**

- Remote: GitHub `alanchik66/HUNDESALON_NIKA`
- Package: `hundesalon-nika-website`
- Host: Cloudflare Pages project `hundesalon-nika`
- Site: `https://hundesalon-nika.com`

If the open folder is a different git root or remote, **do not modify it**. Say so and stop.

---

## 5. Workspace detection

Always determine and keep distinct:

| Signal | How |
|--------|-----|
| Current workspace | IDE workspace / opened folder |
| Repository root | `git rev-parse --show-toplevel` or conclusive markers from §4 |
| Working directory | process `cwd` |
| Active module | nearest package / boundary under the monorepo layout (§8) |
| Opened folder | user-selected folder (may be a subfolder of the repo) |

Never assume `cwd` == repository root == active module.

---

## 6. Environment detection

Classify the *execution* environment from evidence (files + env vars). Multiple labels may apply (e.g. Local + Docker):

| Label | Evidence |
|-------|----------|
| Development | `npm run dev`, `.dev.vars`, local ports `5502` / `8788` |
| Preview | Cloudflare preview / `wrangler pages dev` |
| Production | live apex, `deploy` / `deploy:full`, production secrets only in Dashboard |
| Testing | `CI=true`, Playwright, `npm run validate` |
| Sandbox | Cursor Cloud / ephemeral agent VM |
| Local | developer machine, Laragon path in docs |
| Docker | `Dockerfile`, running container |
| Docker Compose | `docker-compose*.yml` |
| Kubernetes | manifests / `kubectl` context (rare here) |
| Vercel / Netlify | **not** this project’s host — do not deploy there unless strategy changes |
| GitHub Actions | `.github/workflows/*`, `GITHUB_ACTIONS` |
| GitLab CI | absent (removed) |
| Azure / AWS / GCP | only when tools/docs explicitly target them |
| Cloudflare | `wrangler.toml`, Pages Functions, `CLOUDFLARE_API_TOKEN` |

Inspect: `.env*`, `.dev.vars`, `.dev.vars.example`, CI variables, `wrangler.toml`, `package.json` scripts. **Never commit secrets.** Never treat production as a playground.

---

## 7. Technology & framework detection

Detect from the tree — do not assume a SPA framework:

| Layer | This repository (when ID matches §4) |
|-------|--------------------------------------|
| Languages | HTML, CSS, JS (ES modules), optional Python/PowerShell in `tools/` |
| Frontend | Static multilingual pages `de/` `en/` `ru/` `uk/`; shared `assets/` |
| Backend | Cloudflare Pages Functions (`functions/`), optional `workers/` |
| Hosting | Cloudflare Pages (`wrangler.toml`), output `dist/` |
| Build | `npm run build` → static bundle |
| Package manager | npm (`package-lock.json`) |
| Testing | `npm run lint`, `check:links`, `validate`, Playwright |
| Knowledge graph | Graphify (`graphify-out/`, `npm run graphify`) |
| AI session memory | RooFlow Memory Bank (`memory-bank/`) |

If markers contradict (e.g. `next.config.js` appears), re-run detection — **never** apply Next.js/React assumptions to this static site.

---

## 8. Monorepo / multi-package boundaries

Treat these as **separate blast-radius zones**. Change only zones required by the task:

| Zone | Path | Notes |
|------|------|-------|
| Site pages | `de/` `en/` `ru/` `uk/` | Keep locale parity unless task is locale-scoped |
| Shared UI | `assets/css/` `assets/js/` | Prefer editing once vs four HTML copies |
| Edge functions | `functions/` | Forms, mail, AI proxy |
| Emergency worker | `workers/` | Separate wrangler project |
| Weather widget | `3d-weather-codrops-main/` | Prebuilt `dist-widget/` — do not casual-rebuild |
| Integrations | `integrations/` | e.g. Google gateway Docker |
| Tools | `tools/` | Node CLIs for SEO/deploy/QA |
| Docs / AI system | `docs/` `.cursor/` `AGENTS.md` `CLAUDE.md` `GEMINI.md` | This routing surface |
| Agent skills | `.agents/skills/` | Graphify, Ponytail, … |

Also watch for classic monorepo folders if they appear later: `apps/`, `packages/`, `libs/`, `modules/`, `shared/`, `services/`, `examples/`.

**Never** “clean up” an unrelated zone while fixing another.

---

## 9. Documentation loading (before code generation)

Load in this order until enough context exists (prefer targeted reads over whole-repo scans):

1. `AGENTS.md`
2. `CLAUDE.md` / `GEMINI.md` / Copilot instructions (as applicable to the host)
3. Cursor rules (`.cursor/rules/`) — especially `00-routing-kernel.mdc`
4. This kernel (`docs/agents-routing.md`) — already required
5. `docs/agents-playbook.md`
6. `docs/agents-master.md` (domain policies relevant to the task)
7. `README.md` / `docs/site-overview.md` / architecture docs as needed
8. ADR / RFC / design docs if present
9. `memory-bank/activeContext.md` + `productContext.md` for non-trivial work
10. Existing patterns: Graphify (`graphify query|path|explain`) before broad Grep

---

## 10. Workflow router (routing *is* the workflow)

Map the user request to a workflow. Each workflow **starts** with §§2–3 (pipeline + startup), then applies its focus:

| Workflow | Focus after routing | Typical verify |
|----------|---------------------|----------------|
| AI / general | Scope + skill routing (playbook) | Plan validated |
| Code generation | Affected modules only; reuse patterns | lint / targeted checks |
| Refactoring | Blast radius; no behavior change unless asked | lint + smoke |
| Bug fix | Root cause; all callers of shared fn | reproduce + fix verify |
| Security | Trust boundaries, secrets, Functions | no secret leak; validate |
| Testing | Existing npm scripts first | `validate` / Playwright |
| Review | Correctness + ponytail over-engineering | findings only unless asked to fix |
| Deployment | Explicit user request only | `deploy:full` path |
| Performance | CWV, assets, CSS/JS weight | measure before/after when possible |
| SEO / multilingual | hreflang, canonical, 4 locales | `check:links` |
| Git | `docs/git-workflow.md`; no force-push / history rewrite | status clean |

Skill routing after module detection: see `docs/agents-playbook.md` and `.cursor/rules/40-agent-routing.mdc`.

---

## 11. Safety (hard stops)

Never:

- Modify unrelated files or another repository
- Guess the destination repository, framework, or environment
- Delete branches, rewrite Git history, or force-push
- Ignore `AGENTS.md`, architecture, or repository boundaries
- Commit secrets (`.dev.vars`, API tokens)
- Deploy to production without an explicit request
- Run hello-world site tours on Cloud Agents by default

---

## 12. Performance (context loading)

Avoid whole-repository scans when unnecessary. Prefer:

1. Graphify symbol / path / explain
2. Import / dependency edges for the touched file
3. Affected modules (§8)
4. Recent changes (`git log` / diff) for the zone
5. File references from the user or stack traces
6. Architecture docs / Memory Bank

---

## 13. Validation & completion

Before claiming done:

1. Routing stages completed (or explicitly N/A)
2. Only intended zones modified
3. Domain checks for the workflow (`npm run lint`, `check:links`, `validate` as applicable)
4. Locale parity if HTML/content changed
5. No new instruction conflicts introduced (entry points still point at this kernel)

Integrity automation: `npm run check:agents-routing` (see `tools/check-agents-routing.js`).

---

## 14. HUNDESALON NIKA quick bind (after detection)

When §4 confirms this project, bind defaults:

- Stack: native HTML/CSS/JS, Cloudflare Pages, no app framework
- Locales: `de` (default), `en`, `ru`, `uk`
- Shell: `assets/js/site-shell.js` — do not hand-duplicate header/footer
- GSC: `ryndenko1982@gmail.com` · Bing: `snaiper1984@mail.ru`
- Deploy: `npm run deploy` / `deploy:full` only on request
- Minimal diffs: Ponytail always-on; Graphify for architecture questions

---

*End of routing kernel. Domain policies continue in `docs/agents-master.md`. Commands and accounts continue in `docs/agents-playbook.md`.*
