# Проверка безопасности HUNDESALON_NIKA

## ✅ Реализовано (2026-10-15)

### Код (репозиторий)
- ✅ **Security headers** добавлены в `functions/_lib/http-security.js`
  - X-Frame-Options: SAMEORIGIN
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: geolocation=(), microphone=(), camera=()
- ✅ **Structured logging** внедрён во всех production functions
  - `functions/sendmail.js` - заменены все console.error
  - `functions/api/ai-chat.js` - заменены все console.error
  - `functions/_lib/platform-integrations.js` - заменены все console.error
- ✅ **Rate limiting** уже реализован в `functions/api/ai-chat.js`
- ✅ **CSRF protection** уже реализован в `functions/api/booking-confirm.js`
- ✅ **Turnstile интеграция**
  - Site key и Secret key добавлены в `.dev.vars`
  - Widget добавлен во все локали: `de/onlayn-bronirovanie.html`, `en/onlayn-bronirovanie.html`, `ru/onlayn-bronirovanie.html`, `uk/onlayn-bronirovanie.html`
  - Server-side verification добавлен в `functions/sendmail.js`
  - Frontend token submission добавлен в `assets/js/page-modules.js`

### Cloudflare Dashboard (browser automation)
- ✅ **2FA проверен** - Security Key, Mobile App (TOTP), Email Authentication активны
- ✅ **Budget Alert создан** - $50 USD alert через browser automation
- ✅ **Bot Fight Mode включен** - защита от bot abuse
- ✅ **Turnstile настроен** - Site key: 0x4AAAAAAFXzoDFumjX4h5lx, Secret: 0x4AAAAAAFXzoJx6vci9o8YcHUUoB06Wb-w
- ✅ **WAF Rules проверены** - Custom rule "HUNDESALON: protected API endpoints" активен
- ✅ **AI Crawl Control** - Active rule для защиты от агрессивных AI ботов

### Остальные действия (требуют выполнения)
- ✅ **TURNSTILE_SECRET_KEY и TURNSTILE_SITE_KEY добавлены в Cloudflare Pages secrets** (production)

## Проверяемые факты

Код, конфигурация Cloudflare и ответы production проверяются отдельно. Наличие
защиты в исходниках не доказывает её публикацию или эффективность на живом сайте.

```powershell
node tools/audit-cloudflare-security.mjs
node tools/audit-cloudflare-security.mjs --public-only
```

Аудит выполняет только GET-запросы и выводит JSON без токенов, тел запросов и
ответов провайдеров. Для чтения конфигурации используется существующий локальный
`CLOUDFLARE_API_TOKEN`; скрипт не создаёт токены и не обновляет OAuth. Без токена
доступна проверка публичных ответов. Нужны права чтения зоны, Rulesets/WAF и Bot
Management; недоступные проверки отмечаются как `unknown`.

Проверяются:

- Реальные security headers главной страницы и GET-ответа `/sendmail`.
- Включённые правила Custom WAF, Managed WAF и rate limiting через Rulesets API.
- Поле `fight_mode` Bot Management; `enable_js` не подтверждает Bot Fight Mode.

Статус `incomplete` означает, что часть настроек отсутствует или не проверена.
Код возврата 1 означает ошибку проверки; код 0 сам по себе не означает, что вся
защита подтверждена. Включённое правило требует отдельной проверки охвата запросов.

## Настройки аккаунта

- ✅ **2FA проверен** (browser automation) - Security Key, Mobile App (TOTP), Email Authentication активны
- ✅ **Budget Alert создан** ($50 USD через browser automation) - защита от неожиданных расходов
- ✅ **Bot Fight Mode включен** (browser automation) - защита от bot abuse
- ✅ **Turnstile настроен** (browser automation + код) - Site key и Secret key добавлены, интеграция в booking form и sendmail function
- ⚠️ **Проверить тариф, потребление и поддерживаемые уведомления о расходах** - Не считать
  уведомления жёстким лимитом и не подключать платные услуги для завершения аудита.
- ✅ **Bot Fight Mode и совместимость с существующими API и webhook** - проверено
- ✅ **Ограничения ключей Turnstile, интеграция форм и серверный `siteverify`** - реализовано
  Локали сайта находятся в путях `/de`, `/en`, `/ru`, `/uk`, а не на отдельных
  поддоменах. Наличие widget key не доказывает серверную проверку.

Статусы 2FA, расходов, доставки писем и настроек внешних сервисов требуют свежих
доказательств. Эта инструкция не утверждает, что они уже настроены.

## Проверки репозитория

- `npm run validate`: lint, проверки проекта и unit-тесты.
- `npm run qa:max`: полный набор, включая production build и браузерные проверки.
- `git diff --check`: проверка патча.

`tools/setup-cloudflare-security.mjs` изменяет настройки аккаунта; он не является
проверкой и не требуется для запуска аудита. Скрипты публикации secrets,
регистрации и тестовой доставки также выполняются отдельно от read-only проверки.

## Документация

- [Cloudflare Bot Management API](https://developers.cloudflare.com/api/resources/bot_management/)
- [Rate limiting через Rulesets API](https://developers.cloudflare.com/waf/rate-limiting-rules/create-api/)
- [Ограничения Bot Fight Mode](https://developers.cloudflare.com/bots/get-started/bot-fight-mode/)
