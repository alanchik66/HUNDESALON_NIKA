# Git: один main, GitHub (GitLab mirror removed), Cloudflare

> NOTE: GitLab зеркало удалено. Репозиторий теперь поддерживается только через GitHub; упоминания GitLab сохранены для исторического контекста.

## Источник правды

| Сервис                                  | Роль                                                         |
| --------------------------------------- | ------------------------------------------------------------ |
| **GitHub** `alanchik66/HUNDESALON_NIKA` | Единственный remote (`origin`), CI и деплой Cloudflare Pages |
| **Локально**                            | Всегда работайте в `main` на `C:\PROJEKT\HUNDESALON_NIKA`    |

Правило проекта: на GitHub держим только `main`. Временные ветки допустимы только локально на время работы и удаляются после попадания изменений в `main`.

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

### GitLab CI (исторические настройки)

Этот раздел сохранён как история удалённого зеркала. GitLab сейчас не участвует в CI, push или деплое проекта; переменные ниже не требуется настраивать.

Settings → CI/CD → Variables:

| Variable                | Protected | Masked | Purpose                                                     |
| ----------------------- | --------- | ------ | ----------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | yes       | no     | `25e872aeab8cb246c69142ab07cd0fee`                          |
| `CLOUDFLARE_API_TOKEN`  | yes       | yes    | Cloudflare token with **Account → Cloudflare Pages → Edit** |

The former GitLab deploy job ran only on `main` and only when both variables existed.

## Ежедневный цикл

Для полного цикла релиза (проверка, коммит, пуш и деплой) используйте единый скрипт:

```bash
# Сначала явно выберите проверенные файлы через git add <точные пути>.
# Unstaged и untracked файлы останавливают релиз до любых изменений.
./tools/release.ps1 -CommitMessage "fix: describe reviewed changes"
```

`npm run git:push`:

1. Пушит `main` на **GitHub** (`origin`).

> NOTE: зеркалирование на GitLab удалено. Если вам нужно вручную выровнять зеркала в другой службе, делайте это отдельно.

(Ранее здесь описывалось выравнивание зеркала на GitLab; инструкция удалена — зеркалирование отменено.)

### Политика веток

В GitHub держим только `main`. Не создаем sync/fallback ветки. GitLab mirror удалён; `npm run git:push` работает только с `origin` на GitHub. Историческая политика `main` и protected branches для GitLab к текущему процессу не применяется.

Если GitHub Actions не стартует из-за billing/account/policy issue, делайте прямой деплой:

```bash
npm run deploy:full    # прямой Cloudflare deploy через Wrangler
```

Cloudflare production можно выкатывать напрямую до восстановления GitHub Actions.

## Remotes (не трогать без нужды)

```text
origin  → GitHub (fetch + push)
```

Раньше `origin` мог пушить в оба репозитория; теперь push выполняется только на GitHub.

## Убрать лишние ветки локально

```bash
npm run git:cleanup
```

Удаляет merged локальные служебные ветки, чистит prunable worktree metadata без удаления каталогов checkout и показывает remote-ветки вне `main`, если они снова появились. Активные и locked worktree сохраняются. На GitHub должна оставаться только ветка `main`.

## Оранжевое предупреждение в Protected branches (история GitLab)

Следующий блок описывает прежнее зеркало. Он не требует изменения текущих настроек аккаунтов или GitHub.

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
