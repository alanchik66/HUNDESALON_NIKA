---
type: resource
project: HUNDESALON_NIKA
verified: 2026-11-08
updated: 2026-11-15
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

## CSP статических страниц и Functions — 2026-11-14

- `_headers` применяется к статическим ответам Pages, но не к ответам Pages Functions. Поэтому HTML-политика продублирована в `functions/_middleware.js`, а `functions/_middleware.test.js` проверяет равенство заголовков и точный список разрешённых iframe. Первичный источник: [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/), проверено 2026-11-14.
- Для существующих плееров `assets/js/social-page.js` используются точные origins `https://www.instagram.com`, `https://www.facebook.com`, `https://www.tiktok.com`. Они добавлены в `frame-src` вместе с уже разрешёнными Turnstile, Spotify и Apple. Это решение проекта, а не разрешение произвольного внешнего контента. `script-src`, `connect-src`, `media-src`, `frame-ancestors` не расширяются. Назначение директивы: [W3C CSP frame-src](https://www.w3.org/TR/CSP3/#directive-frame-src).
- В опубликованной версии во время аудита плееры блокировались родительской CSP, хотя кнопки карусели меняли ссылку и счётчик. Обычный локальный `startStaticTestServer()` не применяет `_headers`, поэтому его успешный тест сам по себе не доказывает корректность CSP.
- Для проверки политики заголовок из актуального `_headers` добавляется к локальному HTTP-ответу HTML до разбора документа; байты HTML не меняются. Отдельно проверяются запросы разрешённых плееров и блокировка неразрешённого контрольного origin. Это воспроизведение политики Pages в тестовой среде, а не подтверждение опубликованного деплоя. Доступность отдельного ролика, требования входа и ограничения провайдера остаются отдельными внешними условиями.
- Первичные документы плееров: [TikTok Embed Player](https://developers.tiktok.com/docs/en/embed-player), [Meta Embedded Video Player](https://developers.facebook.com/docs/plugins/embedded-video-player/), [Instagram oEmbed](https://developers.facebook.com/documentation/instagram-platform/oembed). Проверено 2026-11-14; используемый проектом iframe и рекомендуемый провайдером способ встраивания следует различать.

Связанная справка: [[03_Resources/Browser_Interaction_and_Overlay_QA]]. Свидетельства текущего запуска: `output/navigation-qa-2026-11-13/`.

## Дополнение релиза — 2026-11-15

- Разрешённые social origins остаются точными, но `social-page.js` теперь назначает внешний `iframe.src` только после явной активации выбранного сервиса. CSP разрешает контент, а не заменяет пользовательский выбор. Неактивные карточки, листание и необходимые cookies не включают плееры.
- Свежий read-only аудит baseline `50352d5c8fc0525de1482073950bd7b5d8ea5b6a` подтвердил zone Free Website, Custom WAF/rate-limit/Bot Fight и `two_factor_authentication_enabled=true` текущего API пользователя. Это не проверка account-wide enforcement или billing caps. Managed entrypoint 404 по-прежнему не доказывает отсутствия всех защит.
- GitHub open Code Scanning/Dependabot/Secret Scanning alerts пусты для baseline; все 12 D1 миграций применены, read-only availability возвращает `configured=true`. Эти сведения не заменяют current-commit CI, receipt и canonical watcher нового релиза. Свидетельства: `output/release-2026-11-15/infra/infra-report.md`.
