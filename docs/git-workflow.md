# Git: один main, GitHub + GitLab, Cloudflare

## Источник правды

| Сервис | Роль |
|--------|------|
| **GitHub** `alanchik66/HUNDESALON_NIKA` | Основной remote (`origin`), деплой Cloudflare Pages |
| **GitLab** `hundesalon-nika/hundesalon-nika` | Зеркало + CI (`.gitlab-ci.yml`), ветка `main` **защищена** |
| **Локально** | Всегда работайте в `main` на `C:\laragon\www\HUNDESALON_NIKA` |

Cloudflare Pages: проект `hundesalon-nika`, деплой с GitHub **или** вручную:

```bash
npm run deploy        # wrangler CLI
npm run deploy:full   # deploy + проверки (+ purge если есть токен)
```

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

### Запасной путь (если force push недоступен)

```bash
npm run sync:gitlab:push   # main → sync/gitlab-main
# MR в GitLab UI или npm run sync:gitlab:mr (нужен GITLAB_TOKEN с scope api)
```

## Remotes (не трогать без нужды)

```
origin  → GitHub (fetch + push)
github  → GitHub (alias)
gitlab  → GitLab (только для sync/MR)
```

Раньше `origin` пушил в оба репозитория сразу — из‑за этого появлялась ошибка non-fast-forward на GitLab. Сейчас push только на GitHub; GitLab — через `git:push`.

## Убрать лишние ветки локально

```bash
npm run git:cleanup
```

Удаляет `sync/gitlab-main`, `reconcile` и «prunable» worktree. Ветка `agents/css-js-minification-explained` остаётся, пока открыт worktree в `.worktrees/`.

## Cloudflare после push в GitHub

Если в Dashboard включён **Git integration**, деплой идёт автоматически с `main`. Иначе:

```bash
npm run deploy:full
```

Проверка продакшена:

```bash
npm run check:prod
```
