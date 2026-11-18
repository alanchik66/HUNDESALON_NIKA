---
type: resource
project: HUNDESALON_NIKA
verified: 2026-11-08
updated: 2026-11-18
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

## Дополнительная проверка аккаунта — 2026-11-15

- Отдельные GET Account Details и List Members подтвердили `settings.enforce_twofactor=true`; у обоих accepted администраторов 2FA включена. Это закрывает прежний пробел account-wide enforcement, но не меняет ограниченный scope `tools/audit-cloudflare-security.mjs`, который сам эти запросы не выполняет. Контракт: [Account Details](https://developers.cloudflare.com/api/resources/accounts/methods/get/) и [List Members](https://developers.cloudflare.com/api/resources/accounts/subresources/members/methods/list/). Evidence: `output/cloudflare-audit-2026-11-15/account/account-auth-results.json`.
- Managed entrypoint HTTP404 не означает выключенный Free WAF: каталог и detail Free Managed Ruleset вернули HTTP200, а GraphQL firewallEventsAdaptive показал блокировки с его точным rulesetId и совпадающими ruleId: 4 за сутки, 94 за семь дней, sampleInterval1. Это наблюдавшиеся события в конкретном окне, не гарантия всей эффективности или вручную прочитанный deployment snapshot. Cloudflare документирует [включение Free Managed Ruleset по умолчанию](https://developers.cloudflare.com/waf/get-started/). Каталог определений сам по себе не доказывает применение правил. Evidence: `output/cloudflare-audit-2026-11-15/waf/traffic-followup.json`.
- GraphQL datasets проверяются через settings: disabled `firewallEventsAdaptiveGroups` при доступном `firewallEventsAdaptive` не следует выдавать за общий отказ Analytics Read. Неэкстраполированные строки sampled Bot Fight не равны точному общему числу атак.
- Billing Read и Notifications Read доступны сохранённому локальному DPAPI token: 403 нет; все семь полученных счетов CLOSED с нулевыми amount_to_pay/amount_remaining. Это не утверждение о будущих начислениях. Данные FOCUS с нулевыми cost fields охватили только R2 до 2026-11-15 00:00 UTC. Usage-capable подписки с price0 не гарантируют нулевой usage bill. Evidence: `output/cloudflare-audit-2026-11-15/billing-report.json`.
- `/billing/spend-policies` теперь HTTP200 со списком []; историческая причина 404 не установлена. Старые debt routes с `No route for that URI` не требуют расширения прав и не используются как доказательство баланса. [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/) $10/$50 — уведомления, не задолженность и не hard caps. [Spend management](https://developers.cloudflare.com/billing/manage/spend-management/) — отдельный продуктовый механизм, не универсальный предел счёта.
- Публичная проверка TLS подтвердила цепочку/имя и TLS1.3; DS/DNSKEY через DNS-over-HTTPS вернули AD=true. Это наблюдение работающего транспорта/DNSSEC, не чтение всех административных SSL/DNS настроек. Evidence: `output/cloudflare-audit-2026-11-15/account/public-transport-results.json`.
- Security Insights/Precursor административные API остались HTTP403 с доступными credentials. Точная документированная read permission — [Account Security Center Insights](https://developers.cloudflare.com/fundamentals/api/reference/permissions/); scope чтения Precursor отдельно не подтверждён. Не заменять эти пробелы старым screenshot или отсутствием JS-ошибок и не расширять ключ до admin. Остановка browser policy по неопределённому текущему URL не обходится другим браузерным каналом.
- Аудит не создавал ключей, не менял настройки аккаунта, тарифы или защиту и не отправлял бизнес-заявки/письма. Штатное обновление уже авторизованной Wrangler OAuth-сессии выполнено отдельно от read-only GET/GraphQL запросов. Нулевые будущие расходы и доставка конкретной формы остаются отдельными проверками.

## Закрытие ограничений доступа — 2026-11-15, 19:46 UTC

- Предыдущий раздел описывает состояние до дополнительной авторизации пользователя. В новой проверке панель Cloudflare была доступна; полный скан Security Insights завершился, активных находок для `hundesalon-nika.com` — 0. API аккаунта и зоны отдельно вернули HTTP200/count0 с полным покрытием страниц; автоматические сканы включены. Это результат конкретного сканирования, а не гарантия отсутствия любых уязвимостей.
- Пользователь отдельно подтвердил создание бессрочного `HUNDESALON_NIKA - Management` со всеми доступными Account/Zone правами только аккаунта HUNDESALON_NIKA и его зон. Сохранённые policies проверены после создания: 297 Account и 97 Zone permission entries, без глобального/User scope; API Verify подтвердил active без expires_on. Ключ аудита и ключи CI не менялись. Значение management key хранится только локально через Windows DPAPI CurrentUser с отдельным ACL; не помещать его в Git, `.dev.vars`, команды или отчёты. Постоянный путь хранилища и безопасного доступа фиксируется в итоговом локальном отчёте, а не в клиентской базе знаний.
- Management key включает изменение/удаление ресурсов, биллинг и управление участниками в пределах доступных API; он не заменяет браузерный вход/2FA, не даёт недоступные тарифу функции и не гарантирует поддержку каждого endpoint. Это исключение по конкретному подтверждению пользователя, а не рекомендация расширять обычный read-only аудит. Ресурсные границы: [Create API tokens via API](https://developers.cloudflare.com/fundamentals/api/how-to/create-via-api/), проверено 2026-11-15.
- Ранее закрытые административные GET Security Insights/state, Precursor, security.txt, zone settings, DNSSEC, Universal SSL, certificate packs и DNS records теперь дали HTTP200. Пустая Cloudflare-hosted security.txt configuration не означает отсутствия опубликованного `/.well-known/security.txt`: последний обслуживается сайтом. Дубликат не создавался.
- Для [Precursor GET](https://developers.cloudflare.com/api/resources/precursor/methods/get/) обязателен документированный заголовок `Cloudflare-Version: 1.0`. Без него текущий сервер вернул legacy-поля `default_mode/enforcement_rules`; с ним — ожидаемые `mode/show_interstitial/rules`: `arm`, false, 0. Ошибку распознавания legacy-схемы в проверочном скрипте нельзя выдавать за неработающую защиту или новый отказ доступа.
- TLS подтверждён в панели и API: Full (strict), минимум TLS1.2, TLS1.3, HTTPS redirect и HSTS включены; Universal SSL active покрывает apex/wildcard. Legacy zone setting `waf=off` не заменяет проверку современного Free Managed Ruleset: его реальные блокировки ранее подтверждены отдельно.
- DNS API вернул все 15 записей: 3 CNAME, 3 MX, 9 TXT; SPF policy одна, пользовательских apex NS/DNSKEY нет. DNSSEC active и полный DS совпал с ранее полученным публичным доказательством. Multi-signer включён при Cloudflare Registrar и выключенном Multi-provider; панель предупреждает о несовместимости. До исправления отдельно проверять свежую публичную валидацию, ключи и отсутствие признаков миграции; не выключать DNSSEC и не удалять DS ради устранения этого предупреждения.

Доказательства: `output/cloudflare-access-2026-11-15/security-insights-ui.json`, `precursor-ui.json`, `tls-ui.json`, `dnssec-ui-before.json`, `management-token-created.json`, `management-read-2026-11-15T19-41-49-770Z.json`, `management-precursor-v1-2026-11-15T19-46-06-812Z.json` в той же папке. В первом API-отчёте Precursor отмечен schema error для неверсионированного ответа; отдельная проверка v1 закрывает именно этот пробел, исходное доказательство не переписывалось.

Для последующих внутренних аудитов: каноническое DPAPI-хранилище — `.secrets/cloudflare/management-token.dpapi`, устойчивый приватный GET runner — `.secrets/cloudflare/management-read-check.mjs`, инструкция рядом в `README.md`. Папка исключена из Git и не относится к очищаемым отчётам `output`. Default `--prepare` не читает credential и не вызывает API; явный GET-запуск указан в приватной инструкции. Не экспортировать management key автоматически всем инструментам; штатные ключи CI и read-only сохраняют отдельное назначение. Проверено после переноса: DPAPI local read/format, protected ACL с двумя правилами и без наследуемых разрешений; runtime GET нового устойчивого runner повторно не запускался, его source diff и безопасный `--prepare` проверены.

## Исправление Multi-signer — 2026-11-15, 19:59 UTC

После preflight на двух валидирующих резолверах (DS/NS/DNSKEY, везде AD=true), проверки полного DS/API KSK, отсутствия импортированных NS/DNSKEY и давности DNSSEC с 2026-10-29 (>1.5×86400 секунд DS TTL) выполнен один [PATCH DNSSEC](https://developers.cloudflare.com/api/resources/dns/subresources/dnssec/methods/edit/) только `dnssec_multi_signer:false`. DNSSEC не отключался, DS и NS не редактировались. Панель подтвердила оба Multi-signer/Multi-provider off, DNSSEC success и прежний полный DS. Штатная подсказка о недоступности включения этих режимов при DNSSEC/Registrar — не активная ошибка.

После PATCH optional API-поле `dnssec_multi_signer` стало отсутствовать. Не подменять отсутствие поля явным false: отключение подтверждено свежим UI и успешным PATCH receipt. Отдельный read-only postcheck: 5 GET/6 DoH, DNSSEC active, прежние DS/NS и 15 записей, оба резолвера AD=true; KSK/ZSK совпали с датированным публичным снимком 18:19 UTC, а не с несохранённым exact preflight fingerprint. Не повторять принятую мутацию из-за ошибки строгого парсера. Свидетельства: `output/cloudflare-access-2026-11-15/dnssec-ui-after.json`, `dnssec-single-provider-apply-2026-11-15T19-54-50-399Z.json`, `dnssec-single-provider-verify-2026-11-15T19-59-45-995Z.json`; итог — `audit-followup.md` в той же папке. Источники и наблюдения проверены 2026-11-15, полная история миграционных намерений не реконструировалась.

## Пассивный WAF и Precursor — 2026-11-18

- Два фиксированных reader использовали существующий DPAPI-ключ только в памяти: 5 GET, затем отдельные 3 GET и один неизменяемый GraphQL read query. OAuth refresh, создание ключей, расширение прав, запись конфигурации, fallback и тестовые атаки не выполнялись. Сохранены только очищенные метаданные; IP, URL посетителей, UA, тела запросов и бизнес-данные не собирались.
- Свежие GET подтвердили active/unpaused Free Website, каталог из 10 rulesets с Free Managed Ruleset и одно включённое условное Custom WAF block-правило. Managed entrypoint вернул HTTP404/code10003. Это доступность конкретного представления API, а не доказательство `WAF OFF`; каталог также не заменяет снимок текущего deployment, overrides и skip-правил.
- Отдельный account GET вернул точное определение Free Managed Ruleset с 38 правилами. В 100 полученных событиях за UTC `2026-11-17T07:09:52.841Z` — `2026-11-18T07:09:52.841Z` найдены 16 `block`, одновременно совпавших по `source=firewallManaged`, точному Free `rulesetId` и `ruleId` из свежего определения. Это прямое свидетельство наблюдавшихся блокировок, а не полный снимок всех текущих настроек.
- У всех возвращённых строк `sampleInterval=1`, но достигнут предел 100: результат намеренно `incomplete-event-limit-reached`. Нельзя называть 16 полным числом атак за сутки, экстраполировать выборку или утверждать, что все правила включены. Повтор, пагинация и GUI-проверка ради универсального вывода не выполнялись. Свидетельства: `output/release-2026-11-18/waf-read-2026-11-18T06-55-30-248Z-307d101a-c538-4955-9f9e-088159be184e.json`, `waf-passive-2026-11-18T07-09-52-841Z-d0cea044-5ca0-4b68-ab8f-4c19271f94f7.json` в той же папке; итог — `waf-final-report.md`.
- По [официальной документации Precursor](https://developers.cloudflare.com/cloudflare-challenges/precursor/) (проверено 2026-11-18) клиентская проверка сессии повторяется в фоне; показ interstitial — отдельное поведение. В первом публичном QA собственный широкий запрет всех challenge POST остановил штатный same-origin `/cdn-cgi/challenge-platform/h/b/precursor/…` после HTML200, без наблюдавшегося interstitial. Узкий последующий QA пропустил только запросы этого фонового пути и получил три HTTP200. Это не обход защиты и не снимок sitewide/interstitial настроек; остальные challenge и бизнес-POST оставались запрещены, действительные challenge responses останавливали проверку. Свидетельства: `output/release-2026-11-18/public-click-limitation-analysis.md`, `public-clicks-v2-analysis.md` в той же папке. Отдельные UI-дефекты таким сетевым наблюдением не исключаются.
