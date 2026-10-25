# Bing Webmaster Tools — полный чеклист

Сайт: `https://hundesalon-nika.com/` · проверенный владелец · [Bing Webmaster](https://www.bing.com/webmasters)

Автоматизация (Edge CDP): `npm run bing:edge` → `npm run bing:complete` → `npm run bing:finish-manual` → `npm run bing:finish-remaining`  
Одной командой (Site Scan + Clarity + robots): `npm run bing:finish-all`

## Статус (2026-09-01)

| Шаг | Статус |
| --- | --- |
| Sitemaps + IndexNow + Submit URL | ✅ |
| URL Inspection `/de/` | ✅ «Успешно проиндексировано» |
| Robots.txt tester | ✅ Apex only: «Получить последний» → «Тест» → **Разрешено**. `npm run bing:robots-tester`, `npm run check:live-robots`. www `/robots.txt` → 301 apex (Page Rule `www/*`) |
| Site Scan | ✅ Запущен через `npm run bing:finish-all` (Start Scan + имя скана) |
| API Access | ✅ Новый account-bound ключ создан через актуальную панель `Settings → API access`; live batch принят с HTTP 200 |
| Microsoft Clarity | ✅ Сайт добавлен в Clarity; project ID: `efbb2b19-7440-48bf-bc3a-166725c69d1b`; скрипт загружается через consent-gate в `analytics.js` |
| `BING_WEBMASTER_API_KEY` | ✅ сохранён только в gitignored `.dev.vars`; настройка: `npm run bing:api:setup -- --generate`, проверка: `npm run bing:api` |

Отчёты: `temp/bing-finish-manual-report.json`, `temp/bing-finish-remaining-report.json`, `temp/bing-finish-last-report.json`

| Раздел | URL | Действие |
| --- | --- | --- |
| Домашняя | `/home` | Проверка верификации, статистика |
| Search Performance | `/searchperf` | Мониторинг кликов/показов |
| Search visibility | `/aiperformance` | Цитирования и упоминания в поиске Bing |
| URL Inspection | `/urlinspection` | Проверка + запрос индексации ключевых URL |
| Site Explorer | `/siteexplorer` | Структура сайта, индекс |
| Sitemaps | `/sitemaps` | `sitemap.xml` + `sitemap-brand.xml` |
| IndexNow | `/indexnow` | Подтверждение отправок (CLI: `seo:indexnow`) |
| Backlinks | `/backlinks` | Обратные ссылки |
| Keyword Research | `/keywordresearch` | Исследование запросов (Leipzig grooming) |
| Recommendations | `/seoreports` | SEO-рекомендации Bing |
| Site Scan | `/sitescan` | Технический аудит (запуск скана) |
| Submit URL | `/submiturl` | До 100 URL/день |
| Robots.txt Tester | `/robotstxttester` | Проверка `/robots.txt` |
| User management | `/usermgmt` | Только mail.ru, без gmail |
| Microsoft Clarity | `/clarity` | Опционально аналитика |
| Settings | кнопка в шапке | `API access → API Key`; прямые маршруты `/settings/*` больше не используются |

## URL Submission API

- API отправляет только канонические HTML-страницы `hundesalon-nika.com`: `www`-редиректы и статические файлы исключаются.
- Суточный лимит — 100 URL. Прогресс очереди хранится без секрета в gitignored `.bing-url-api-state.json`.
- Повторный post-deploy-вызов не расходует квоту на уже принятый список.
- Генерация credential возможна только с явным флагом: `npm run bing:api:setup -- --generate`.
- Диагностика сохраняет только SHA-256 fingerprint ключа, но не сам ключ и не его фрагменты.

## Вне Bing (но обязательно)

- **Google Search Console** — `ryndenko1982@gmail.com` (sole Owner; отдельно от Bing)
- **IndexNow** — apex + www (`npm run seo:indexnow`)
- **Favicon/лого** — на сайте, не загрузка в панели Bing
- **Деплой** — `npm run deploy:full` после изменений HTML/brand

## Отчёт автопрохода

`temp/bing-webmaster-complete-report.json`
