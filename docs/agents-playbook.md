# Playbook для AI-агентов — HUNDESALON NIKA

Документ для **Cursor Cloud Agents**, Codex, Claude, Gemini CLI и локальных ассистентов.

**Сначала routing:** каждый запрос проходит [`docs/agents-routing.md`](agents-routing.md) (§1 Startup → §2 Decision Pipeline → §8 Task matrix). Этот playbook — **операционный** слой: команды, skills, аккаунты. Он не дублирует detection и не переопределяет conflict priority.

| Слой | Файл |
|------|------|
| Routing kernel (SSOT) | [`agents-routing.md`](agents-routing.md) |
| Профиль проекта | [`../AGENTS.md`](../AGENTS.md) |
| Quality / domain contract | [`agents-master.md`](agents-master.md) |
| Этот playbook | команды · skills · SEO-аккаунты · чеклисты |

## Проект в одном абзаце

Статический многоязычный сайт салона в Лейпциге (`de` / `en` / `ru` / `uk`), хостинг **Cloudflare Pages**, shell в `site-shell.js`, продакшен: https://hundesalon-nika.com (`www` → 301 на apex).

## Startup (кратко)

1. Resolve repo / workspace / env / tech / module → kernel §4–§7.  
2. Load AI docs → kernel §9.  
3. Classify task → kernel §8.  
4. Run the matching command table below.  
5. Complete → kernel §12.

## Аккаунты (не путать)

| Сервис | Аккаунт |
|--------|---------|
| Google Search Console | `ryndenko1982@gmail.com` (sole Verified Owner) |
| Bing Webmaster Tools | `snaiper1984@mail.ru` (Edge CDP `npm run bing:edge`, порт 9224) |

Не маршрутизировать GSC на `snaiper1984@gmail.com` (cutover 2026-07-19).

## Маршрутизация задач → команды

После kernel §8:

| Задача (класс) | Команда |
|----------------|---------|
| Правка UI/вёрстки | Правки в `assets/*` + 4 локали; `npm run lint` |
| Проверка ссылок (локально) | `npm run check:links` |
| Живой обход всех URL sitemap | `npm run check:live-crawl` |
| Полная валидация | `npm run validate` |
| Сборка | `npm run build` |
| Деплой | `npm run deploy:full` (только по запросу; kernel §10) |
| IndexNow apex + www | `npm run seo:indexnow` |
| Полная индексация Bing | `npm run bing:index-all` |
| Остаток www в Bing (квота) | `npm run bing:submit-www-rem` |
| Аудит Bing в браузере | `npm run bing:audit` |
| Аудит GSC | `npm run google:gsc:audit` |
| После смены favicon | `npm run seo:post-favicon` |
| Архитектура / связи | `graphify query\|path\|explain` (не полный обход дерева) |

## Skills (подключать по теме)

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
- Roo Code extension: режимы Flow-* из `.roo/` + `.roomodes` — перед делегированием выполнить routing kernel.
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
- Чужой репозиторий / несвязанный module — запрещено (kernel §7.2 / §10)

## Чеклист после заметных изменений

1. Kernel §12 (routing gate)
2. `npm run validate`
3. При деплое HTML: `npm run deploy:full` → purge + IndexNow
4. При смене иконок/бренда: `npm run brand:assets` → `npm run brand:seo` → deploy → `npm run seo:post-favicon`
5. Smoke: `de/index.html` + одна другая локаль

## Cursor Cloud Agents — bootstrap

```bash
npm install
npm run validate
npm run check:live-crawl   # опционально, нужен сеть
```

Секреты в [Cursor Dashboard → Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents): `CLOUDFLARE_API_TOKEN`, `RESEND_API_KEY`, `OPENROUTER_API_KEY`. Локально: `.dev.vars` из `.dev.vars.example`.

Git: default policy = `main` + commit по запросу пользователя. Если session mandate требует feature branch / PR (Cloud Agent), следуй kernel §3 item 2 и §10 — без force-push и без rewrite history.

## Перспектива (регулярно)

- После каждого деплоя контента: `seo:indexnow` (152 URL: apex + www)
- Раз в квартал: `check:live-crawl`, `google:gsc:audit`, `bing:audit`
- Новые страницы: добавить в `sitemap.xml` + все 4 локали + `LOCALIZED_ROUTES` в `site-shell.js`
- Опционально: `BING_WEBMASTER_API_KEY` в `.dev.vars` → `npm run bing:api`

## Git

Default: только `main`, пуш: `npm run git:push`. Коммиты — по явной просьбе пользователя, если нет platform/session override (kernel §10).
