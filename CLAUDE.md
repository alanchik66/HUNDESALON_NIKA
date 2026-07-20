# CLAUDE.md

Проектные инструкции для Claude Code и совместимых агентов на HUNDESALON NIKA.

## Routing (обязательно)

Перед любой правкой выполни [`docs/agents-routing.md`](docs/agents-routing.md):

1. Repository → Workspace → Environment → Technology → Module  
2. Load AI docs (порядок в kernel §0 / §9)  
3. Task class + decision pipeline (kernel §8 / §2)  
4. Implement только в affected modules  
5. Completion gate (kernel §12)

Профиль: [`AGENTS.md`](AGENTS.md) · Playbook: [`docs/agents-playbook.md`](docs/agents-playbook.md) · Quality contract: [`docs/agents-master.md`](docs/agents-master.md)

Conflict priority: user → session/platform mandate → routing kernel → project rules → AGENTS → this file → master → conventions.

## Проект

HUNDESALON NIKA — многоязычный сайт груминг-салона в Лейпциге. Цель: быстрый, SEO-ориентированный, конверсионный сайт на `de`, `en`, `ru`, `uk`. Стек: native HTML/CSS/JS, Cloudflare Pages (+ `functions/`), без app-framework.

## Ключевые принципы

- Профессиональный подрядчик: точечные правки, без лишнего.
- Единый стиль и структура между локалями.
- Не ломать SEO, a11y, mobile, Cloudflare.
- UI: только чётные значения в px.
- Коммерческий фокус: запись, контакты, доверие, Leipzig.

## Архитектура (модули)

| Module | Path |
|--------|------|
| Locales | `de/`, `en/`, `ru/`, `uk/` |
| Shared UI | `assets/` |
| Edge | `functions/`, `workers/` |
| Tooling | `tools/`, `scripts/` |
| AI system | `docs/agents-*.md`, `.cursor/rules/`, `AGENTS.md` |

Не править несвязанные modules. Не дублировать header/footer — есть `site-shell.js`.

## Workflow

1. Routing kernel startup.  
2. Найти нужные файлы (prefer graphify / scoped search).  
3. Минимальное изменение (ponytail).  
4. Проверка: `npm run lint` / `validate` / `check:links` по классу задачи.  
5. Completion checklist kernel §12.

## Команды

- `npm run lint` · `npm run check:links` · `npm run validate` · `npm run qa:max` · `npm run build`
- Deploy только по явному запросу: `npm run deploy:full`

## Ограничения

- Не угадывать репозиторий, framework или environment.
- Не трогать secrets / `.dev.vars`.
- Не делать массовые рефакторинги без необходимости.
- GSC: `ryndenko1982@gmail.com` · Bing: `snaiper1984@mail.ru`.
