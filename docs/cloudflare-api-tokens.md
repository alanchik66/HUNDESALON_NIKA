# Cloudflare API token — HUNDESALON NIKA

## Zone token: кеш, redirects, WAF

| Имя       | `HUNDESALON — Zone API`                                                           |
| --------- | --------------------------------------------------------------------------------- |
| **Зона**  | `hundesalon-nika.com`                                                             |
| **Права** | Zone Read · Cache Purge · Page Rules Edit · Zone Rules Edit                       |
| **Файл**  | `CLOUDFLARE_API_TOKEN` в `.dev.vars` (копия: `.cloudflare-api.token`, gitignored) |

```bash
npm run cf:ensure-api-token    # проверка или авто-создание
npm run cf:open-edit-token     # правка NIKA-Purge-Cache (добавить Zone Rules Edit)
npm run cf:open-api-token      # мастер нового токена
npm run cf:set-api-token -- <token>
```

**Практичнее всего:** не создавать новый токен — открыть `cf:open-edit-token`, в списке **NIKA-Purge-Cache** → Edit → добавить **Zone → Zone Rules → Edit** → Update token. Тот же секрет в `.dev.vars` остаётся действовать.

После деплоя HTML: `npm run cf:purge-cache` или `npm run deploy:full`.

## Дополнить текущий токен (без нового секрета)

Токен **NIKA-Purge-Cache** (`bc69976…`) уже имеет Purge и Page Rules — добавьте только **Zone → Zone Rules → Edit**:

```bash
npm run cf:open-edit-token   # открывает страницу редактирования в Edge
```

После сохранения в Dashboard: `npm run cf:ensure-api-token` (все четыре ✓).

Авто через API (без Dashboard): `.cloudflare-global.json` + `npm run cf:ensure-api-token` — скрипт вызовет `PUT /user/tokens/{id}` и добавит Zone Rules Edit.

## Авто-создание (рекомендуется один раз)

1. [Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Global API Key** → View
2. Скопировать `.cloudflare-global.json.example` → `.cloudflare-global.json` (не коммитить)
3. `npm run cf:ensure-api-token` — создаст полный токен и запишет в `.dev.vars`

## Другие задачи (отдельные токены не нужны для robots/purge)

| Задача               | Команда                                                    |
| -------------------- | ---------------------------------------------------------- |
| WAF rate limits      | `npm run cf:configure-waf-rate-limits`                     |
| Crawler Hints / CSAM | `npm run cf:configure-cache-features`                      |
| Pages deploy         | `npx wrangler login` + `npm run deploy`                    |
| www robots → apex    | `npm run cf:www-robots-setup` (Page Rule `www/*` уже есть) |

## Устаревшие команды

`cf:ensure-purge-token`, `cf:set-purge-token`, `cf:ensure-zone-rules-token` — алиасы на `cf:ensure-api-token` / `cf:set-api-token`.

## Pages deploy token: GitHub/GitLab CI

Для CI-деплоя нужен отдельный Cloudflare token:

| Имя                 | `HUNDESALON — Pages Deploy`                            |
| ------------------- | ------------------------------------------------------ |
| **Права**           | Account → Cloudflare Pages → Edit                      |
| **Account**         | `HUNDESALON_NIKA` (`25e872aeab8cb246c69142ab07cd0fee`) |
| **GitHub secret**   | `CLOUDFLARE_PAGES_API_TOKEN`                           |
| **GitLab variable** | `CLOUDFLARE_API_TOKEN`                                 |

Текущий zone-token не подходит для Pages deploy. Он правильный для purge/rules, но Cloudflare Pages upload требует account-level permission.
