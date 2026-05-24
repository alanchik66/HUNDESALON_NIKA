# Cursor Cloud — итоговая настройка HUNDESALON NIKA

## Статус (автоматическая проверка)

```bash
npm run cursor:complete
```

Ожидаемый отчёт:

- Cursor session active
- Self-hosted pool OFF
- Environment `alanchik66/HUNDESALON_NIKA` Active
- `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN` в Secrets
- Onboarding 4/4 (пункт cloud environment снят)
- Secrets list clean

## Команды

| Команда | Назначение |
|---------|------------|
| `npm run cursor:complete` | Полная координированная проверка и донастройка |
| `npm run cursor:edge-dashboard` | Edge с сохранённым логином (порт 9227) |
| `npm run cursor:variant-b` | Self-hosted OFF + onboarding |
| `npm run cursor:delete-bad-slack` | Удалить ошибочный секрет `SLACK_WEBHOOK_URL=https://...` |

## Профиль Edge

`%TEMP%\hundesalon-nika-cursor-playwright` — здесь хранится сессия cursor.com после автоматизации.

## Cursor IDE vs Edge

Если в **IDE** всё ещё 3/4, а в Edge 4/4:

1. `npm run cursor:edge-dashboard`
2. Убедитесь, что в Edge открыт тот же аккаунт
3. В IDE: Ctrl+F5 на https://cursor.com/dashboard

## Секреты

| Где | Что |
|-----|-----|
| Cursor Cloud | `OPENROUTER_API_KEY`, `CLOUDFLARE_API_TOKEN` |
| Cloudflare Pages | `OPENROUTER_API_KEY`, `RESEND_API_KEY` |
| Локально | `.dev.vars` (не в git) |

Подробнее: [cursor-cloud-secrets.md](./cursor-cloud-secrets.md).
