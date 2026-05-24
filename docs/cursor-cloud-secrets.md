# Cursor Cloud Agents — setup and secrets

## Завершить onboarding («Set up your cloud environment»)

Репозиторий уже содержит [`.cursor/environment.json`](../.cursor/environment.json) (`npm install`, порты 5502/8788, терминал `npm run dev`). На GitHub это в `main`.

1. Запустите `npm run cursor:setup-cloud` (проверит `npm install`, подскажет секреты, откроет Dashboard) или [Environments](https://cursor.com/dashboard/cloud-agents#environments) (`npm run cursor:open-cloud-setup`).
2. **Create environment** (или **Set up** в чеклисте) → выберите **GitHub** → репозиторий `alanchik66/HUNDESALON_NIKA`, ветка `main`.
3. Cursor запустит `install` из `environment.json`. Дождитесь **Environment ready** (или предупреждений с кнопкой repair).
4. **Secrets** (тот же dashboard → My Secrets или привязка к environment):
   - обязательно: `OPENROUTER_API_KEY`
   - по желанию: `CLOUDFLARE_API_TOKEN` (purge после deploy)
5. Сохраните **snapshot** виртуальной машины, если мастер предложит — ускорит следующие cloud-агенты.

После этого пункт onboarding в Cursor IDE отметится выполненным.

## Автоматизация (CLI)

| Команда | Назначение |
|---------|------------|
| `npm run cursor:setup-cloud` | Проверка `npm install` + открыть Dashboard |
| `npm run cursor:edge-dashboard` | Edge с профилем логина (CDP :9227) |
| `npm run cursor:setup-cloud:auto` | Environment + секреты из `.dev.vars` |
| `npm run cursor:finish-cloud` | Дождаться run, Base branch `main`, очистка |
| `npm run cursor:cancel-run` | Остановить зависший Running run |
| `npm run cursor:complete-onboarding` | Клик Set up на Overview |
| `npm run cursor:variant-b` | Вариант B: Edge + self-hosted OFF + onboarding 4/4 |
| `npm run cursor:delete-bad-slack` | Удалить ошибочный секрет `SLACK_WEBHOOK_URL=https://...` |

Секреты в Dashboard: `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN` (из `.dev.vars`). `RESEND` — только Cloudflare Pages.

## Secrets

For this repo you only need **one** OpenRouter secret in [Cloud Agents → My Secrets](https://cursor.com/dashboard/cloud-agents).

## Keep (Cursor)

| Secret | Purpose |
|--------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API (required for `/openrouter` and SEO tools) |

Optional — only if you want agents to run `npm run cf:purge-cache`:

| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Zone **Cache Purge** + **Zone Read** for `hundesalon-nika.com` |

Contact form email uses `RESEND_API_KEY` on **Cloudflare Pages** only (not required in Cursor).

## Remove (defaults are in `functions/openrouter.js`)

Delete these if they still appear in the dashboard — they duplicate code defaults and are easy to get out of sync:

- `OPENROUTER_SITE_URL`
- `OPENROUTER_SITE_NAME`
- `OPENROUTER_DEFAULT_MODEL`
- `OPENROUTER_FALLBACK_MODEL`

In the UI: open each secret → use the remove/delete control (wording varies). There is no API for agent secrets from this repo.

## Cloudflare Pages (already trimmed)

Production Pages secrets should be only `OPENROUTER_API_KEY` and `RESEND_API_KEY`. Verify:

```bash
npx wrangler pages secret list --project-name=hundesalon-nika
```

Re-prune if needed: `npm run pages:secrets:prune`

## Local `.dev.vars`

Minimal set (see `.dev.vars.example`):

- `OPENROUTER_API_KEY`
- `CLOUDFLARE_API_TOKEN` (after creating a valid purge token)

Sync key to Pages: `npm run sync:openrouter`
