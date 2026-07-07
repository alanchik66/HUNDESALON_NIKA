# Cloudflare API token — HUNDESALON NIKA

## Canonical token policy

Для проекта должна быть понятная схема из **двух максимум** рабочих токенов:

| Назначение      | Имя                              | Где используется                                       |
| --------------- | -------------------------------- | ------------------------------------------------------ |
| Zone automation | `HUNDESALON_NIKA — Zone Ops`     | локально: DNS, purge, redirects, WAF, cache settings   |
| Pages CI deploy | `HUNDESALON_NIKA — Pages Deploy` | только GitHub CI (GitLab mirror removed); если деплой идет без Wrangler — настройте локальный deploy |

Не нужно держать отдельные токены под `purge`, `DNS audit`, `redirects`, `WordPress` и разовые Cloudflare Agent conversations. Истекшие `Cloudflare Agent (conversation)` токены можно удалять из Dashboard как мусор. Production-схема проекта — два scoped-токена ниже, без broad user/account tokens.

Текущее состояние Dashboard:

- `HUNDESALON_NIKA — Zone Ops`: zone-only token для `hundesalon-nika.com`.
- `HUNDESALON_NIKA — Pages Deploy`: account-only token с `Pages Write`.
- Старые `NIKA-Purge-Cache`, `NIKA-Zone-Audit-2025`, `WordPress`, `Cloudflare Agent Token` и истекшие conversation tokens удалены.

Cloudflare Dashboard Ask AI/Agent может заново создавать `Cloudflare Agent (conversation)` токены. Они не являются частью production-схемы проекта; после завершения сессии их можно удалять. В рабочей схеме должны оставаться только `HUNDESALON_NIKA — Zone Ops` и `HUNDESALON_NIKA — Pages Deploy`. Для снижения этого шума `Public OAuth App access` выключен на уровне аккаунта.

Желтое предупреждение `Origin CA Key (Deprecated)` в секции **API Keys** не является старым User API Token и не означает, что в проекте остался deprecated token. Это системное предупреждение Cloudflare о deprecated типе ключей для Origin CA. Его нельзя убрать переименованием или обновлением `HUNDESALON_NIKA — Zone Ops` / `HUNDESALON_NIKA — Pages Deploy`; оно остается в UI, пока Cloudflare показывает секцию legacy API Keys. Проект не использует Origin CA Key или Global API Key для автоматизации; все рабочие операции идут через scoped API tokens.

Человеческий доступ держим отдельно от automation tokens:

- `snaiper1984@gmail.com` — основной владелец/администратор.
- `ryndenko1982@gmail.com` — второй доверенный пользователь; добавлен как `Administrator`.

Для людей не создаем API tokens вместо доступа в аккаунт. Правильная схема: отдельный Cloudflare Member invite с выбранной ролью и обязательной 2FA.

Проверено в Dashboard на 2026-07-01:

- `snaiper1984@gmail.com`: `accepted`, `Super Administrator - All Privileges`, 2FA включена.
- `ryndenko1982@gmail.com`: `accepted`, без API-token; при следующем доступе Cloudflare должен потребовать включить 2FA.
- Members → Settings: `Require two-factor authentication (2FA) for all members` включен.
- Members → Settings: `Public OAuth App access` выключен; деплой и automation используют scoped API tokens.

## Zone token: DNS, кеш, redirects, WAF

| Имя       | `HUNDESALON_NIKA — Zone Ops`                                                               |
| --------- | ------------------------------------------------------------------------------------------ |
| **Зона**  | `hundesalon-nika.com`                                                                      |
| **Права** | Zone Read · DNS Records Edit · Cache Purge · Page Rules Edit · Zone Rules Edit · WAF Write |
| **Файл**  | `CLOUDFLARE_API_TOKEN` в `.dev.vars` (копия: `.cloudflare-api.token`, gitignored)          |

```bash
npm run cf:ensure-api-token    # проверка или авто-создание
npm run cf:open-edit-token     # правка старого токена, если нужно расширить права
npm run cf:open-api-token      # мастер нового токена
npm run cf:set-api-token -- <token>
```

**Практичнее всего:** не создавать новый токен под каждую задачу. Держим один scoped zone-token для `hundesalon-nika.com` и расширяем его только нужными zone permissions. Для Agent Ready / DNS-AID нужен `Zone → DNS → Edit`, иначе DNS-записи приходится добавлять вручную через Dashboard.

После деплоя HTML: `npm run cf:purge-cache` или `npm run deploy:full`.

## Дополнить текущий токен (без нового секрета)

Текущий рабочий токен: **HUNDESALON_NIKA — Zone Ops** (`aa00284c…`). Если Cloudflare добавляет новые automation-задачи, не создавай новый token под каждую задачу: расширяй этот scoped zone-token только нужными zone permissions.

```bash
npm run cf:open-edit-token   # открывает страницу редактирования в Edge
```

Минимальный набор прав:

- `Zone → Zone → Read`
- `Zone → DNS → Edit`
- `Zone → Cache Purge → Purge`
- `Zone → Page Rules → Edit`
- `Zone → Zone Rules → Edit`
- `Zone → WAF → Edit` только если автоматизируем WAF/rate limits

После сохранения в Dashboard: `npm run cf:ensure-api-token` (локальный token должен проходить проверку).

## Авто-создание (рекомендуется один раз)

1. [Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**
2. Создать custom token `HUNDESALON_NIKA — Zone Ops` с правами из таблицы выше.
3. `npm run cf:set-api-token -- <token>` — проверит токен и запишет его в `.dev.vars` / `.cloudflare-api.token`.

## Другие задачи (отдельные токены не нужны)

| Задача               | Команда                                                    |
| -------------------- | ---------------------------------------------------------- |
| DNS / DNS-AID        | `HUNDESALON_NIKA — Zone Ops` with `DNS Records Edit`       |
| WAF rate limits      | `npm run cf:configure-waf-rate-limits`                     |
| Crawler Hints / CSAM | `npm run cf:configure-cache-features`                      |
| Pages deploy         | `npx wrangler login` + `npm run deploy` (OAuth auto; Zone Ops token skipped) |
| www robots → apex    | `npm run cf:www-robots-setup` (Page Rule `www/*` уже есть) |

## Pages deploy token: GitHub/GitLab CI

Для CI-деплоя нужен отдельный Cloudflare token:

| Имя                 | `HUNDESALON_NIKA — Pages Deploy`                       |
| ------------------- | ------------------------------------------------------ |
| **Права**           | Account → Cloudflare Pages → Edit                      |
| **Account**         | `HUNDESALON_NIKA` (`25e872aeab8cb246c69142ab07cd0fee`) |
| **GitHub secret**   | `CLOUDFLARE_PAGES_API_TOKEN`                           |
| **GitLab variable** | `CLOUDFLARE_API_TOKEN`                                 |

Текущий zone-token не подходит для Pages deploy. Он правильный для purge/rules, но Cloudflare Pages upload требует account-level permission.
