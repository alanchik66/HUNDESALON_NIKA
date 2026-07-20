# Cloudflare API token — HUNDESALON NIKA

## Один токен — не «глобальный ключ»

В Dashboard много записей — это нормально путает. Разделить нужно так:

| Что видите в Dashboard | Нужно ли проекту | Действие |
| --- | --- | --- |
| **Global API Key / Origin CA Key** | Нет | Legacy, не использовать (оранжевое предупреждение до 2026 — скрыть нельзя) |
| **Cloudflare Agent (conversation)** | Нет | Мусор после сессий Ask AI — удалять |
| Старые `NIKA-Purge`, `WordPress`, … | Нет | Удалить |
| **`HUNDESALON_NIKA — Automation`** | **Да — один на всё** | Единственный рабочий automation token |
| Wrangler OAuth (не в списке API Tokens) | Fallback | Локально, если API token не настроен |

**Не делать:** один «глобальный» Global API Key — он deprecated, слишком широкий и небезопасный.

**Делать:** один **scoped User API Token** с минимальными правами на зону + Pages.

## Canonical token: `HUNDESALON_NIKA — Automation`

| Поле | Значение |
| --- | --- |
| **Имя** | `HUNDESALON_NIKA — Automation` |
| **Account** | `HUNDESALON_NIKA` (`25e872aeab8cb246c69142ab07cd0fee`) |
| **Zone** | `hundesalon-nika.com` |
| **Локально** | `CLOUDFLARE_API_TOKEN` в `.dev.vars` + `.cloudflare-api.token` |
| **GitHub CI** | тот же секрет (можно `CLOUDFLARE_API_TOKEN` или legacy `CLOUDFLARE_PAGES_API_TOKEN`) |

### Права (в одном токене)

**Account**

- Cloudflare Pages → Edit

**Zone** (`hundesalon-nika.com`)

- Zone → Read
- DNS → Edit
- Cache Purge → Purge
- Page Rules → Edit
- Zone Rules → Edit
- WAF → Edit (только если автоматизируем WAF)

### Команды

```bash
npm run cf:cleanup-dashboard-tokens   # авто: Edge CDP → создать/проверить + убрать мусор
npm run cf:open-unified-token         # мастер (account-scoped template, без выбора аккаунта)
npm run cf:open-edit-token            # расширить существующий Zone Ops → добавить Pages
npm run cf:set-api-token -- <token>   # сохранить + проверить zone + Pages
npm run cf:ensure-api-token           # аудит: unified OK?
npm run cf:consolidate-tokens         # слить два локальных токена в один
npm run deploy:full
```

### Если Dashboard застрял на выборе аккаунта

Старый шаблон подставлял `accountId=<uuid>` — Cloudflare открывал picker и форма не редактировалась.

**Исправлено в репо:**

- `cf:open-unified-token` → `https://dash.cloudflare.com/<account-id>/api-tokens?...` (без `:account` picker)
- fallback: profile URL с `accountId=*` (официальный формат)
- `cf:open-edit-token` → account-scoped edit URL
- `cf:cleanup-dashboard-tokens` → CDP проходит account picker и UI-bug «пустые permissions»

## Миграция с двух токенов

Раньше было два: `Zone Ops` + `Pages Deploy`. Теперь достаточно одного.

**Вариант A (быстрее):** отредактировать существующий Zone Ops token

```bash
npm run cf:open-edit-token
```

В Dashboard: **Add permission** → Account → Cloudflare Pages → Edit → Save.  
Переименовать токен в `HUNDESALON_NIKA — Automation`.  
`npm run cf:set-api-token -- <token>` (тот же или новый после rotate).

**Вариант B:** создать новый unified token, удалить старые два + Agent tokens.

```bash
npm run cf:open-unified-token
npm run cf:set-api-token -- <token>
```

В Dashboard удалить: старый Zone Ops, Pages Deploy, все `Cloudflare Agent (conversation)`.

## Что покрывает один токен

| Задача | Команда |
| --- | --- |
| Pages deploy | `npm run deploy` |
| CDN purge | `npm run cf:purge-cache` |
| DNS / redirects | zone scripts |
| WAF rate limits | `npm run cf:configure-waf-rate-limits` |
| Post-deploy checks | `npm run deploy:full` |

Wrangler OAuth остаётся только как **fallback**, если API token не настроен. Для стабильности — один API token.

## Origin CA Key (Deprecated)

Оранжевый блок **Origin CA Key (Deprecated)** в API Keys — не ошибка проекта. Миграция на User API Tokens уже выполнена. Убрать блок из UI нельзя.

## Люди vs automation

- Люди: `snaiper1984@gmail.com`, `ryndenko1982@gmail.com` — Member + 2FA, без API tokens.
- Automation: один `HUNDESALON_NIKA — Automation`.
- `Public OAuth App access` выключен на аккаунте.

## Legacy aliases (совместимость)

| Переменная | Статус |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | основная |
| `CLOUDFLARE_PAGES_API_TOKEN` | alias; при unified set-api-token пишет туда же |
| `cf:open-pages-token`, `cf:set-pages-token` | aliases; используй `cf:open-unified-token` |
