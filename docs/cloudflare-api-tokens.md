# Cloudflare API tokens — что за что

## Для этого проекта (HUNDESALON NIKA)

| Нужно | Права | Команда |
|-------|--------|---------|
| **Cache Purge** (после деплоя HTML) | Zone Read + Cache Purge, зона `hundesalon-nika.com` | `npm run cf:open-purge-token` → `npm run cf:set-purge-token -- <token>` |
| **Pages deploy** | Wrangler OAuth (`npx wrangler login`) или Dashboard Git integration | `npm run deploy` |
| **OpenRouter / email** | Secrets на Pages, не Cloudflare token | `npm run sync:openrouter` |

Один токен **«HUNDESALON — Cache Purge»** в `.dev.vars` как `CLOUDFLARE_API_TOKEN` — достаточно для `npm run cf:purge-cache` и `deploy:full`.

## Токены в аккаунте (примеры — другие задачи)

| Имя в Dashboard | Обычно для чего | Нужен для NIKA? |
|-----------------|-----------------|-----------------|
| **Cloudflare Agent Token** | Cursor/агенты, артефакты, Data Localization | Нет (не Cache Purge) |
| **NIKA-Zone-Audit-2025** | DNS и настройки зоны | Нет (аудит, не purge) |
| **WordPress** | Плагин WordPress ↔ Cloudflare | Нет (сайт на Pages, не WP) |

Старые `cfat_…` из переписки **отозвать**, если ещё активны — они недействительны или избыточны.

## Global API Key (опционально)

Если добавить в `.dev.vars` (не коммитить):

```
CLOUDFLARE_API_EMAIL=your@email.com
CLOUDFLARE_API_KEY=<Global API Key from My Profile>
```

то `npm run cf:ensure-purge-token` может **создать** отдельный purge-токен автоматически. Global Key хранить только локально.

## Без API-токена purge

Cloudflare Dashboard → **Caching** → **Configuration** → **Purge Everything** (после `npm run deploy`).
