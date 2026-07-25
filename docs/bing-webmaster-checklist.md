# Bing Webmaster Tools — полный чеклист

Сайт: `https://hundesalon-nika.com/` · Аккаунт: **snaiper1984@mail.ru** · [Bing Webmaster](https://www.bing.com/webmasters)

Автоматизация (Edge CDP): `npm run bing:edge` → `npm run bing:complete` → `npm run bing:finish-manual` → `npm run bing:finish-remaining`  
Одной командой (Site Scan + Clarity + robots): `npm run bing:finish-all`

## Статус (2026-07-07)

| Шаг | Статус |
|-----|--------|
| Sitemaps + IndexNow + Submit URL | ✅ |
| URL Inspection `/de/` | ✅ «Успешно проиндексировано» |
| Robots.txt tester | ✅ Apex only: «Получить последний» → «Тест» → **Разрешено**. `npm run bing:robots-tester`, `npm run check:live-robots`. www `/robots.txt` → 301 apex (Page Rule `www/*`) |
| Site Scan | ✅ Запущен через `npm run bing:finish-all` (Start Scan + имя скана) |
| API Access | Опционально: `npm run cf:ensure-api-token` (единый Zone API токен) |
| Microsoft Clarity | ✅ Сайт добавлен в Clarity; project ID: `efbb2b19-7440-48bf-bc3a-166725c69d1b`; скрипт загружается через consent-gate в `analytics.js` |
| `BING_WEBMASTER_API_KEY` | ✅ не требуется — IndexNow уведомляет Bing; ключ API опционален (`npm run bing:api:setup`) |

Отчёты: `temp/bing-finish-manual-report.json`, `temp/bing-finish-remaining-report.json`, `temp/bing-finish-last-report.json`

| Раздел | URL | Действие |
|--------|-----|----------|
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
| Settings | `/settings/user` | API key → `.dev.vars` |

## Вне Bing (но обязательно)

- **Google Search Console** — `ryndenko1982@gmail.com` (sole Owner; отдельно от Bing)
- **IndexNow** — apex + www (`npm run seo:indexnow`)
- **Favicon/лого** — на сайте, не загрузка в панели Bing
- **Деплой** — `npm run deploy:full` после изменений HTML/brand

## Отчёт автопрохода

`temp/bing-webmaster-complete-report.json`
