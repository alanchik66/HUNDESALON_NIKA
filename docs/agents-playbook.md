# Playbook для AI-агентов — HUNDESALON NIKA

Документ для **Cursor Cloud Agents**, Codex, Claude, Gemini CLI и локальных ассистентов.

**Сначала — Routing Kernel:** [`docs/agents-routing.md`](agents-routing.md) (detection, startup, decision pipeline, safety).  
**Доменный контракт:** [`docs/agents-master.md`](agents-master.md).  
**Профили хостов:** [`AGENTS.md`](../AGENTS.md) · [`CLAUDE.md`](../CLAUDE.md) · [`GEMINI.md`](../GEMINI.md) · [`.github/copilot-instructions.md`](../.github/copilot-instructions.md).

Этот playbook — операционная карта **после** успешного routing: команды, аккаунты, skills. Он не заменяет kernel и не дублирует detection.

## Bootstrap каждой задачи

```
Routing Kernel (§§2–9)
  → подтвердить HUNDESALON_NIKA
  → определить module/zone
  → выбрать строку из таблиц ниже
  → выполнить decision pipeline до Implementation
```

## Проект в одном абзаце

Статический многоязычный сайт салона в Лейпциге (`de` / `en` / `ru` / `uk`), хостинг **Cloudflare Pages**, shell в `site-shell.js`, продакшен: https://hundesalon-nika.com (`www` → 301 на apex).

## Аккаунты (не путать)

| Сервис | Аккаунт |
|--------|---------|
| Google Search Console | `ryndenko1982@gmail.com` (sole Verified Owner) |
| Bing Webmaster Tools | `snaiper1984@mail.ru` (Edge CDP `npm run bing:edge`, порт 9224) |

## Маршрутизация задач → команды

| Задача / workflow | Команда / действие |
|-------------------|--------------------|
| Code generation / UI | Правки в `assets/*` + 4 локали; `npm run lint` |
| Bug fix | Root cause в общем хелпере; затем lint / reproduce |
| Refactor | Только затронутая zone; без смены поведения без запроса |
| Security | Secrets/Functions boundaries; без коммита `.dev.vars` |
| Testing | `npm run validate` / Playwright по зоне |
| Review | Findings; ponytail-review при запросе упрощения |
| Deployment | Только по запросу: `npm run deploy:full` |
| Performance | Измерить до/после; не трогать weather dist без нужды |
| SEO / IndexNow | `npm run seo:indexnow` |
| Проверка ссылок (локально) | `npm run check:links` |
| Живой обход sitemap | `npm run check:live-crawl` |
| Полная валидация | `npm run validate` |
| AI routing integrity | `npm run check:agents-routing` |
| Сборка | `npm run build` |
| Полная индексация Bing | `npm run bing:index-all` |
| Аудит GSC | `npm run google:gsc:audit` |
| После смены favicon | `npm run seo:post-favicon` |

## Skills (подключать по теме, после module detection)

| Skill | Когда |
|-------|--------|
| `hundesalon-frontend` | HTML, CSS, JS, header, формы, адаптив |
| `hundesalon-seo-multilingual` | hreflang, canonical, JSON-LD, sitemap |
| `hundesalon-cloudflare` | Pages, `_headers`, purge, Functions |
| `cloudflare-deploy` | Деплой, wrangler |
| `playwright` | Визуальный smoke в браузере |
| `graphify` (проект) | Архитектура, связи файлов, `query` / `path` / `explain` по `graphify-out/` |
| `ponytail*` | Минимальный безопасный diff; review/audit over-engineering |
| RooFlow Memory Bank | Сессионный контекст в `memory-bank/` (UMB); Flow-* только в Roo Code |

Пути skills у владельца: `~/.agents/skills/hundesalon-*`. Graphify: `.agents/skills/graphify/`. Ponytail: `.agents/skills/ponytail*`.

### Graphify (операционка)

- Полная пересборка кода: `npm run graphify` (AST, без API).
- После правок JS/tools: `npm run graphify:update`.
- Запросы: `graphify query "…"`, `graphify explain "…"`, `graphify path "A" "B"`.
- Карта: `graphify-out/graph.html` (локально: `npm run graphify`). В git только `GRAPH_REPORT.md`.
- Отчёт: `graphify-out/GRAPH_REPORT.md`.
- Игнор шума: `.graphifyignore` (vendor, weather dist, медиа); тяжёлые `graph.json`/`graph.html` не коммитим.
- Post-commit/checkout hooks + merge driver для `graph.json` уже установлены локально.
- Новый клон: `npm run graphify:setup` (регистрирует Cursor rule + hooks + merge driver `merge.graphify` из `.gitattributes`).

### Ponytail (операционка)

- Always-on: `.cursor/rules/ponytail.mdc` (лестница YAGNI перед кодом).
- Skills: `/ponytail`, `/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`.
- Не режет: валидацию на trust boundary, security, a11y, явные требования бренда/проекта.

### RooFlow (операционка)

- Memory Bank: `memory-bank/{productContext,activeContext,progress,decisionLog,systemPatterns}.md`.
- Cursor: `.cursor/rules/rooflow-memory-bank.mdc` — читать банк в начале нетривиальной работы; **UMB** / Update Memory Bank — записать итог.
- Roo Code extension: режимы Flow-* из `.roo/` + `.roomodes` — перед делегированием выполнить Routing Kernel.
- Обработка плейсхолдеров: `npm run rooflow:process`. Обновление с upstream: `npm run rooflow:setup`.
- Опционально MCP в Flow-промпты: положить `system_prompt.md` в корень и снова `rooflow:process`.

## GitLens 18.0 (релиз 2026-05-27) — что внедрено

Практический ежедневный сценарий: `docs/gitlens-18-daily-checklist.md`

1. Commit Graph используется как основная рабочая поверхность (detials panel справа).
2. Включены Experimental-панели для агентного потока:
	- Agent Kanban (`gitlens.graph.experimental.kanban.enabled`)
	- Visualizations/Treemap (`gitlens.graph.experimental.visualizations.enabled`)
3. Для AI-функций GitLens добавлены безопасные исключения контекста:
	- через `gitlens.ai.exclude.files` в workspace settings
	- через корневой `.aiignore`
4. Interactive Rebase закреплен в режиме открытия `auto` (`gitlens.rebaseEditor.openBehavior`).

### Операционный ритуал для задач с git/review

1. Открыть Commit Graph и сфокусировать рабочую ветку.
2. Перед коммитом запускать AI Review/Compose из Graph Details (если менялось несколько файлов).
3. Для PR-потока проверять Launchpad и Agent Sessions, чтобы не пропускать `Needs Input`.
4. Для параллельных задач использовать worktree-first подход (не смешивать разные задачи в одном дереве).

## Файлы — не трогать без причины

- `3d-weather-codrops-main/dist-widget/` — собранный виджет погоды
- `indexnow-key.txt`, `.dev.vars` — секреты, не в git
- Дублировать header/footer в HTML — запрещено (есть `site-shell.js`)

## Чеклист после заметных изменений

1. `npm run check:agents-routing` (если менялись AI-инструкции)
2. `npm run validate`
3. При деплое HTML: `npm run deploy:full` → purge + IndexNow
4. При смене иконок/бренда: `npm run brand:assets` → `npm run brand:seo` → deploy → `npm run seo:post-favicon`
5. Smoke: `de/index.html` + одна другая локаль

## Cursor Cloud Agents — bootstrap

```bash
# 1) Routing kernel mentally: confirm repo + env + module
npm install
npm run check:agents-routing
npm run validate
npm run check:live-crawl   # опционально, нужен сеть
```

Секреты в [Cursor Dashboard → Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents): `CLOUDFLARE_API_TOKEN`, `RESEND_API_KEY`, `OPENROUTER_API_KEY`. Локально: `.dev.vars` из `.dev.vars.example`. Root `wrangler.toml` уже содержит `account_id` — отдельный `CLOUDFLARE_ACCOUNT_ID` для Pages CLI не обязателен.

### MCP (Cloud vs Desktop)

Lean project template: `.cursor/mcp.json` — Cloudflare (main/docs/bindings/builds/observability), Playwright, GitHub. Plugins: Notion / Figma / Linear (без Datadog).

| Среда | Что реально доступно |
|---|---|
| **Cursor Desktop** | Project MCP + plugins; OAuth **Authenticate** для Notion/Cloudflare/GitHub HTTP |
| **Cloud Agent** | В каталоге обычно только plugin MCP (часто Notion = `needsAuth`) + `cursor-cloud`. Interactive MCP Authenticate **недоступен** (нет `cursor://` OAuth). iPhone / web-only — то же ограничение |

Fallback без MCP OAuth: `CLOUDFLARE_API_TOKEN` + `wrangler` / Pages API, `gh`, локальный Playwright (`npx` / `@playwright/mcp`). Notion MCP — только после Desktop Authenticate; с iPhone OAuth для Cloud Agent не завершить.

## Перспектива (регулярно)

- После каждого деплоя контента: `seo:indexnow` (152 URL: apex + www)
- Раз в квартал: `check:live-crawl`, `google:gsc:audit`, `bing:audit`
- Новые страницы: добавить в `sitemap.xml` + все 4 локали + `LOCALIZED_ROUTES` в `site-shell.js`
- Опционально: `BING_WEBMASTER_API_KEY` в `.dev.vars` → `npm run bing:api`

## Git

Только `main`, пуш: `npm run git:push`, если задача Cloud Agent не требует feature branch/PR. Коммиты — по явной просьбе пользователя (или по требованиям Cloud Agent task).
