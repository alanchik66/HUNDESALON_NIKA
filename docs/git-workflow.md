# Git: один main, GitHub + GitLab, Cloudflare

## Источник правды

| Сервис                                       | Роль                                                                |
| -------------------------------------------- | ------------------------------------------------------------------- |
| **GitHub** `alanchik66/HUNDESALON_NIKA`      | Основной remote (`origin`), основной CI-деплой Cloudflare Pages     |
| **GitLab** `hundesalon-nika/hundesalon-nika` | Зеркало + fallback CI (`.gitlab-ci.yml`), ветка `main` **защищена** |
| **Локально**                                 | Всегда работайте в `main` на `C:\PROJEKT\HUNDESALON_NIKA`           |

Cloudflare Pages: проект `hundesalon-nika`, тип **Direct Upload**. Продакшен обновляется через:

- GitHub Actions: `.github/workflows/cloudflare-pages.yml`;
- GitLab CI fallback: `.gitlab-ci.yml`;
- локально вручную:

```bash
npm run deploy        # wrangler CLI
npm run deploy:full   # deploy + проверки (+ purge если есть токен)
```

## CI secrets

### GitHub Actions

Settings → Secrets and variables → Actions:

| Secret                       | Purpose                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`      | `25e872aeab8cb246c69142ab07cd0fee`                                              |
| `CLOUDFLARE_PAGES_API_TOKEN` | Cloudflare token with **Account → Cloudflare Pages → Edit**                     |
| `CLOUDFLARE_ZONE_API_TOKEN`  | Optional purge token with **Zone Read + Cache Purge** for `hundesalon-nika.com` |

`CLOUDFLARE_ZONE_API_TOKEN` is enough only for purge/rules. It cannot deploy Pages by itself.

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

1. Пушит `main` на **GitHub** (`origin`)
2. Зеркалит `main` на **GitLab** (`git push gitlab main --force-with-lease`)

Для зеркала на GitLab ветка `main` должна позволять push/force push (Maintainers) или быть временно без защиты.

### Первичное выравнивание GitLab (один раз)

Settings → Repository → Protected branches → **Unprotect** `main` (или Allow force push), затем:

```bash
git push gitlab main --force-with-lease
```

Снова включите защиту `main` (рекомендуется). Дальше достаточно `npm run git:push`.

### Политика веток

В GitHub и GitLab держим только `main`. Не создаем sync/fallback ветки. Если GitLab push не проходит из-за защиты `main`, исправляем права protected branch и повторяем `npm run git:push`.

## Remotes (не трогать без нужды)

```
origin  → GitHub (fetch + push)
github  → GitHub (alias)
gitlab  → GitLab (зеркало main)
```

Раньше `origin` пушил в оба репозитория сразу — из‑за этого появлялась ошибка non-fast-forward на GitLab. Сейчас push только на GitHub; GitLab — через `git:push`.

## Убрать лишние ветки локально

```bash
npm run git:cleanup
```

Удаляет старые локальные служебные ветки и prunable worktree. В репозиториях GitHub/GitLab должна оставаться только ветка `main`.

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

Текущий проект Pages — **Direct Upload**, поэтому автоматический деплой идёт через GitHub Actions, когда задан `CLOUDFLARE_PAGES_API_TOKEN`. Если секрет ещё не задан:

```bash
npm run deploy:full
```

Проверка продакшена:

```bash
npm run check:prod
```
