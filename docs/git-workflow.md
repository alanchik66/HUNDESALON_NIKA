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

1. Пушит `main` на **GitHub**
2. Пушит тот же коммит на GitLab ветку `sync/gitlab-main`
3. Если задан `GITLAB_TOKEN` — создаёт/мержит MR в `main`
4. Иначе — ссылка на MR в браузере (нужно нажать **Merge** один раз)

## GitLab token (один раз)

Создайте [Personal Access Token](https://gitlab.com/-/user_settings/personal_access_tokens) с scope **`api`**.

PowerShell (сессия):

```powershell
$env:GITLAB_TOKEN = "glpat-..."
npm run sync:gitlab:mr
```

Или сохраните в пользовательских переменных Windows.

Без токена: откройте [открытые MR](https://gitlab.com/hundesalon-nika/hundesalon-nika/-/merge_requests) и смержите `sync/gitlab-main` → `main`.

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
