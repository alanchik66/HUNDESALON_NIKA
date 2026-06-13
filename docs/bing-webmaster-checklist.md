# Bing Webmaster Tools — полный чеклист

Сайт: `https://hundesalon-nika.com/` · Аккаунт: **snaiper1984@mail.ru** · [Bing Webmaster](https://www.bing.com/webmasters)

Автоматизация (Edge CDP): `npm run bing:edge` → `npm run bing:complete` → `npm run bing:finish-manual` → `npm run bing:finish-remaining`

## Статус (2026-05-19)

| Шаг | Статус |
|-----|--------|
| Sitemaps + IndexNow + Submit URL | ✅ |
| URL Inspection `/de/` | ✅ «Успешно проиндексировано» |
| Robots.txt tester | ✅ Apex only: «Получить последний» → «Тест» → **Разрешено**. `npm run bing:robots-tester`, `npm run check:live-robots`. www `/robots.txt` → 301 apex (Page Rule `www/*`) |
| Site Scan | ⚠️ Кнопка нажимается, UI всё ещё «Сканирование не проводилось» — один клик вручную в Edge |
| API Access | Опционально: `npm run cf:ensure-api-token` (единый Zone API токен) |
| Microsoft Clarity | ⚠️ Инфо-страница без кнопки в DOM; опционально на [clarity.microsoft.com](https://clarity.microsoft.com) |
| `BING_WEBMASTER_API_KEY` | ❌ нет в `.dev.vars` → `npm run bing:api` пропущен |

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

- **Google Search Console** — `snaiper1984@gmail.com` (отдельно)
- **IndexNow** — apex + www (`npm run seo:indexnow`)
- **Favicon/лого** — на сайте, не загрузка в панели Bing
- **Деплой** — `npm run deploy:full` после изменений HTML/brand

## Отчёт автопрохода

`temp/bing-webmaster-complete-report.json`
