# Git: один main, GitHub (GitLab mirror removed), Cloudflare

> NOTE: GitLab зеркало удалено. Репозиторий теперь поддерживается только через GitHub; упоминания GitLab сохранены для исторического контекста.

## Источник правды

| Сервис                                  | Роль                                                            |
| --------------------------------------- | --------------------------------------------------------------- |
| **GitHub** `alanchik66/HUNDESALON_NIKA` | Единственный remote (`origin`), CI и деплой Cloudflare Pages    |
| **Локально**                            | Всегда работайте в `main` на `D:\HUNDESALON_NIKA`       |

Правило проекта: на GitHub держим только `main`. Временные ветки допустимы только локально на время работы и удаляются после попадания изменений в `main`.

AI agents: follow [`docs/agents-routing.md`](agents-routing.md) §1 (conflict order) and §11 (safety). Default is `main` only. If the active Cloud Agent / user task explicitly requires a feature branch or PR, that mandate wins — still no force-push and no history rewrite.

Cloudflare Pages: проект `hundesalon-nika`, тип **Direct Upload**. Продакшен обновляется через:

- GitHub Actions: `.github/workflows/cloudflare-pages.yml`;
- GitHub Actions CI: `.github/workflows/ci.yml`;
- локально вручную:

```bash
npm run deploy        # wrangler CLI
npm run deploy:full   # deploy + проверки (+ purge если есть токен)
```

## CI secrets

### GitHub Actions

Settings → Secrets and variables → Actions:

Secrets:

| Secret                       | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `CLOUDFLARE_PAGES_API_TOKEN` | Cloudflare token `HUNDESALON_NIKA — Pages Deploy` with `Pages Write` |

Variables:

| Variable                        | Value                              |
| ------------------------------- | ---------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`         | `25e872aeab8cb246c69142ab07cd0fee` |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `hundesalon-nika`                  |

Zone automation stays local in `HUNDESALON_NIKA — Zone Ops`; it is not used for GitHub Pages deploy.

### GitLab CI

Settings → CI/CD → Variables:

| Variable                | Protected | Masked | Purpose                                                     |
| ----------------------- | --------- | ------ | ----------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | yes       | no     | `25e872aeab8cb246c69142ab07cd0fee`                          |
| `CLOUDFLARE_API_TOKEN`  | yes       | yes    | Cloudflare token with **Account → Cloudflare Pages → Edit** |

The GitLab deploy job runs only on `main` and only when both variables exist.

## Ежедневный цикл

```bash
git checkout main
git pull origin main
# … правки …
npm run validate
git add -A && git commit -m "описание"
npm run git:push
```

`npm run git:push`:

1. Пушит `main` на **GitHub** (`origin`).

> NOTE: зеркалирование на GitLab удалено. Если вам нужно вручную выровнять зеркала в другой службе, делайте это отдельно.

(Ранее здесь описывалось выравнивание зеркала на GitLab; инструкция удалена — зеркалирование отменено.)

### Политика веток

В GitHub и GitLab держим только `main`. Не создаем sync/fallback ветки. Если GitLab push не проходит из-за защиты `main`, исправляем права protected branch и повторяем `npm run git:push`.

Если GitHub Actions не стартует из-за billing/account/policy issue, делайте прямой деплой:

```bash
npm run deploy:full    # прямой Cloudflare deploy через Wrangler
```

Cloudflare production можно выкатывать напрямую до восстановления GitHub Actions.

## Remotes (не трогать без нужды)

```
origin  → GitHub (fetch + push)
```

Раньше `origin` мог пушить в оба репозитория; теперь push выполняется только на GitHub.

## Убрать лишние ветки локально

```bash
npm run git:cleanup
```

Удаляет merged локальные служебные ветки, чистит prunable worktree metadata и показывает remote-ветки вне `main`, если они снова появились. В репозиториях GitHub/GitLab должна оставаться только ветка `main`.

## Оранжевое предупреждение в Protected branches

Текст вроде _«Giving merge rights to a protected branch also gives elevated permissions for certain CI/CD features»_ — **это не поломка**, а напоминание GitLab о безопасности.

**Смысл:** если кому-то разрешён **merge** в защищённую ветку, в pipeline merge request он может получить доступ к **protected CI/CD variables** и **protected runners**. Это важно, если в проект пушат посторонние или открыты MR с внешних форков.

**Для HUNDESALON_NIKA** (один maintainer, зеркало с GitHub через `git push`, MR на GitLab не используем):

| Настройка                     | Рекомендация                                           |
| ----------------------------- | ------------------------------------------------------ |
| **Allowed to merge**          | **No one** — merge только не нужен                     |
| **Allowed to push and merge** | **Maintainers** — для `npm run git:push`               |
| **Allowed to force push**     | выкл. (вкл. только если снова нужно выровнять историю) |

Предупреждение можно **игнорировать**, если merge = No one. Если merge = Maintainers — предупреждение уместно; для вас оно лишнее, поэтому merge лучше отключить.

Путь: **Settings → Repository → Protected branches** (или **Branch rules** → `main`).

## Cloudflare после push в GitHub

Текущий проект Pages — **Direct Upload** (Git Provider: No). **Канонический деплой не зависит от GitHub Actions / биллинга GitHub:**

```bash
npm run deploy:full
```

Workflow `Deploy Cloudflare Pages` — только `workflow_dispatch` (опционально, когда Actions разблокированы). Push на `main` сам по себе Pages не деплоит.

Проверка продакшена:

```bash
npm run check:prod
```

Gmail MCP (чтение/удаление писем агентом): `npx @gongrzhe/server-gmail-autoauth-mcp` в `.cursor/mcp.json` / `.vscode/mcp.json`; ключи в `~/.gmail-mcp/`. Очистка failed-run писем: `node tools/gmail-cleanup-actions-failures.mjs`.
