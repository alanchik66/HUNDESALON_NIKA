# Playbook для AI-агентов — HUNDESALON NIKA

Документ для **Cursor Cloud Agents**, Codex, Claude и локальных ассистентов. Читай перед любой задачей по сайту, SEO или деплою.

## Проект в одном абзаце

Статический многоязычный сайт салона в Лейпциге (`de` / `en` / `ru` / `uk`), хостинг **Cloudflare Pages**, shell в `site-shell.js`, продакшен: https://hundesalon-nika.com (`www` → 301 на apex).

## Аккаунты (не путать)

| Сервис | Аккаунт |
|--------|---------|
| Google Search Console | `snaiper1984@gmail.com` |
| Bing Webmaster Tools | `snaiper1984@mail.ru` (Edge CDP `npm run bing:edge`, порт 9224) |

## Маршрутизация задач → команды

## Команда владельца `проф`

Если владелец пишет `проф`, выполнять полный профессиональный цикл: аудит кода, ассетов, локалей, виджета погоды, мусорных файлов и дублей; исправление найденных ошибок без лишних вопросов; `npm run validate`; браузерный smoke desktop/mobile; `npm run build`; live-проверки; полный backup; commit; push в GitHub и GitLab; Cloudflare Pages deploy; cache purge и post-deploy проверки при наличии токенов. Если Cloudflare Dashboard, Resend или другой внешний кабинет требует интерактивной авторизации, зафиксировать это отдельно и продолжить всё, что доступно через локальные CLI/API.

| Задача | Команда |
|--------|---------|
| Правка UI/вёрстки | Правки в `assets/*` + 4 локали; `npm run lint` |
| Проверка ссылок (локально) | `npm run check:links` |
| Живой обход всех URL sitemap | `npm run check:live-crawl` |
| Полная валидация | `npm run validate` |
| Сборка | `npm run build` |
| Деплой | `npm run deploy:full` (только по запросу) |
| IndexNow apex + www | `npm run seo:indexnow` |
| Полная индексация Bing | `npm run bing:index-all` |
| Остаток www в Bing (квота) | `npm run bing:submit-www-rem` |
| Аудит Bing в браузере | `npm run bing:audit` |
| Аудит GSC | `npm run google:gsc:audit` |
| После смены favicon | `npm run seo:post-favicon` |

## Skills (подключать по теме)

| Skill | Когда |
|-------|--------|
| `hundesalon-frontend` | HTML, CSS, JS, header, формы, адаптив |
| `hundesalon-seo-multilingual` | hreflang, canonical, JSON-LD, sitemap |
| `hundesalon-cloudflare` | Pages, `_headers`, purge, Functions |
| `cloudflare-deploy` | Деплой, wrangler |
| `playwright` | Визуальный smoke в браузере |

Пути skills у владельца: `~/.agents/skills/hundesalon-*`.

## Погода — эталон °C

Везде на сайте: **`19°C`** = число + сразу **°** + латинская **C**, **без пробела** (не `19 °C`, не `° С`, не кириллическая «С»). Константа: `HEADER_WEATHER_CELSIUS_SUFFIX`, формат: `formatHeaderWeatherCelsiusText()` в `assets/js/site-shell.js`.

## Файлы — не трогать без причины

- `3d-weather-codrops-main/dist-widget/` — собранный виджет погоды
- `indexnow-key.txt`, `.dev.vars` — секреты, не в git
- Дублировать header/footer в HTML — запрещено (есть `site-shell.js`)

## Чеклист после заметных изменений

1. `npm run validate`
2. При деплое HTML: `npm run deploy:full` → purge + IndexNow
3. При смене иконок/бренда: `npm run brand:assets` → `npm run brand:seo` → deploy → `npm run seo:post-favicon`
4. Smoke: `de/index.html` + одна другая локаль

## Cursor Cloud Agents — bootstrap

```bash
npm install
npm run validate
npm run check:live-crawl   # опционально, нужен сеть
```

Секреты в [Cursor Dashboard → Cloud Agents → Secrets](https://cursor.com/dashboard/cloud-agents): `CLOUDFLARE_API_TOKEN`, `RESEND_API_KEY`, `OPENROUTER_API_KEY`. Локально: `.dev.vars` из `.dev.vars.example`.

## Перспектива (регулярно)

- После каждого деплоя контента: `seo:indexnow` (152 URL: apex + www)
- Раз в квартал: `check:live-crawl`, `google:gsc:audit`, `bing:audit`
- Новые страницы: добавить в `sitemap.xml` + все 4 локали + `LOCALIZED_ROUTES` в `site-shell.js`
- Опционально: `BING_WEBMASTER_API_KEY` в `.dev.vars` → `npm run bing:api`

## Git

Только `main`, пуш: `npm run git:push`. Коммиты — по явной просьбе пользователя.
