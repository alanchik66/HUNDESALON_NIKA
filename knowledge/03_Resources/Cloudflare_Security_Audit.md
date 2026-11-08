---
type: resource
project: HUNDESALON_NIKA
verified: 2026-11-08
---

# Cloudflare security audit

Связи: [[01_Projects/HUNDESALON_NIKA]], [[02_Areas/Operations]].

## Проверенные технические границы

- Account-level WAF требует Enterprise. Отсутствие права или тарифа нельзя
  исправить расширением токена до admin. Проверять доступные zone-level настройки
  отдельно; для подтверждённого Free/Pro/Business account-level проверки неприменимы.
  Источник: [Cloudflare account-level WAF](https://developers.cloudflare.com/waf/account/),
  проверено 2026-11-08.
- Для zone-level read-only аудита проект использует отдельный токен с Zone Read,
  Zone WAF Read и Bot Management Read. Его значение остаётся в локальном `.dev.vars`.
  Источник: [Cloudflare API token permissions](https://developers.cloudflare.com/fundamentals/api/reference/permissions/).
- Ротация токена сохраняет его права, выдаёт новый секрет и инвалидирует старое
  значение. Новый секрет нужно обновить во всех использующих его хранилищах.
  Источник: [Cloudflare roll tokens](https://developers.cloudflare.com/fundamentals/api/how-to/roll-token/),
  проверено 2026-11-08.

## Наблюдения проекта

2026-11-08 локальный read-only аудит подтвердил Free Website, доступ к zone-level
Custom WAF и rate limiting и включённый Bot Fight Mode. Managed WAF phase entrypoint
не возвращён. Это не доказывает отсутствие всех управляемых защит Cloudflare.
Account 2FA и billing controls этим API-аудитом не проверяются.

Проверки сайта и правил выполняют GET. Резервное обновление уже настроенного
Wrangler OAuth выполняет POST и сохраняет credentials в локальном Wrangler config.
Нельзя описывать весь command как не имеющий побочных эффектов.

Код: `tools/audit-cloudflare-security.mjs`, `tools/lib/cloudflare-auth.mjs`.
Регрессии: `tools/audit-cloudflare-security.test.mjs`.
Процедура релиза: `docs/RELEASE_GUIDE.md`.
