# Карта сайта HUNDESALON NIKA

Продакшен: https://hundesalon-nika.com · Лейпциг · 4 языка · статический HTML + Cloudflare Pages.

## Структура

```text
/                    → редирект на /de/ (через index + _redirects)
/de/  en/  ru/  uk/  → по 19 страниц на локаль = 76 URL в sitemap
/de/blog/*.html      → 4 статьи × 4 языка
assets/              → CSS, JS, изображения, favicon
functions/           → sendmail, message-draft, seo-generate (Workers)
```

## Страницы (одинаковые slug во всех локалях)

| Slug                               | Назначение    |
| ---------------------------------- | ------------- |
| `/` (index)                        | Главная       |
| `o-nas.html`                       | О нас         |
| `nashi-uslugi.html`                | Услуги        |
| `prays-list.html`                  | Прайс         |
| `galereya.html`                    | Галерея       |
| `do-i-posle.html`                  | До/после      |
| `kontakty.html`                    | Контакты      |
| `onlayn-bronirovanie.html`         | Онлайн-запись |
| `blog.html`                        | Блог          |
| `blog/kak-podgotovit-sobaku.html`  | Статья        |
| `blog/plokhaya-strizhka.html`      | Статья        |
| `blog/strizhka-koshek.html`        | Статья        |
| `blog/zashchita-ot-parazitov.html` | Статья        |
| `reyting.html`                     | Отзывы        |
| `social.html`                      | Соцсети       |
| `partnerstvo.html`                 | Партнёрство   |
| `vvedenie.html`                    | Введение      |
| `impressum.html`                   | Impressum     |
| `datenschutz.html`                 | Datenschutz   |

Маршруты в навигации: `LOCALIZED_ROUTES` в `assets/js/site-shell.js`.

## Общий shell (не дублировать в HTML)

| Файл                             | Роль                                 |
| -------------------------------- | ------------------------------------ |
| `site-shell.js`                  | Header, nav, footer, i18n, погода    |
| `main.js`                        | Preloader, тема, scroll-root, burger |
| `page-modules.js`                | Формы, бронирование, smooth scroll   |
| `style.css` + `page-modules.css` | Стили                                |

Пути: `../assets/` из `{de,en,ru,uk}/`, `../../assets/` из `blog/`.

## SEO / индексация

- **Canonical**: без `www` (`https://hundesalon-nika.com/...`)
- **www**: 301 → apex
- **hreflang**: de, en, ru, uk, x-default на каждой странице
- **Bing**: `msvalidate.01` + `BingSiteAuth.xml`
- **IndexNow**: `indexnow-key.txt`, sitemap + logo assets (apex + www)
- **Logo для Bing**: `/favicon.ico`, JSON-LD `search-logo-clear-512.png` — Bing **не** позволяет загрузить лого в панели (глобус в шапке — стандарт Bing); иконка в выдаче берётся с сайта
- **Bing Performance**: раздел Bing Webmaster для видимости сайта; `npm run bing:ai-performance`
- **Sitemap**: `sitemap.xml` (76 URL)

## Проверки (регулярно)

```bash
npm run check:links        # локальные ссылки в HTML
npm run check:live-crawl   # все 76 URL на проде
npm run check:live-html    # favicon, canonical на главных
npm run validate           # lint + links + project
```

Отчёт краула: `temp/site-crawl-report.json`.

## Аккаунты поиска

| Сервис                | Доступ                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------- |
| Google Search Console | Утверждённая учётная запись администратора; адрес хранится в закрытом реестре доступов |
| Bing Webmaster        | Утверждённая учётная запись администратора; адрес хранится в закрытом реестре доступов |

Подробнее о проверке интеграций: [`docs/staging-and-e2e.md`](staging-and-e2e.md).
