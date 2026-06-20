# HUNDESALON NIKA Full-Stack Upgrade Guide

## Что добавлено

- Cookie-consent на DE/RU/EN/UK с сохранением выбора в `localStorage`.
- Google Analytics через `config/env.js`, запуск только после согласия.
- Расширенная booking-форма: дата, время, список услуг, JPG/PNG до 5 MB, GDPR, предоплата, резюме перед отправкой.
- Cloudflare Functions: `/sendmail`, `/upload`, `/payment`, `/subscribe`, `/blog`.
- Google/Outlook/Teams/Drive/Sheets/Calendar hooks через env-переменные.
- Отзывы из `data/testimonials.json` и локальные фото в `assets/images/testimonials/`.
- Документы из `data/documents.json`.
- Локальные SEO-страницы и новая статья про экспресс-линьку.
- PWA service worker `sw.js` и регистрация через `assets/js/pwa.js`.

## Обязательные переменные

Настройте в Cloudflare Pages → Settings → Environment variables:

- `GA_MEASUREMENT_ID`
- `GOOGLE_OAUTH_ACCESS_TOKEN`
- `GOOGLE_CALENDAR_ID`
- `SHEET_ID`
- `DRIVE_UPLOAD_FOLDER`
- `GMAIL_SENDER`
- `MS_TENANT_ID`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`
- `MS_GRAPH_ACCESS_TOKEN`
- `OUTLOOK_SENDER`
- `TEAM_ID`
- `TEAM_CHANNEL_ID`
- `TEAMS_WEBHOOK_URL`
- `RESEND_API_KEY`
- `SLACK_WEBHOOK_URL`
- `GOOGLE_SHEETS_WEBHOOK_URL`
- `GOOGLE_DRIVE_UPLOAD_WEBHOOK_URL`
- `PAYMENT_PROVIDER_KEY`

Локальный пример лежит в `.dev.vars.example`. Реальные значения нельзя сгенерировать из репозитория: владелец аккаунтов должен войти в Google Cloud, Microsoft Entra/Teams, Resend и Cloudflare, создать ключи/токены и вставить их как Cloudflare Pages secrets. Файл `.dev.vars` остаётся только локальным и не коммитится.

## Быстрая настройка в Cloudflare

1. Откройте Cloudflare Dashboard → Pages → `hundesalon-nika` → Settings → Environment variables.
2. Добавьте переменные из списка выше для Production и Preview.
3. Для секретов используйте тип Secret/Encrypted, если интерфейс Cloudflare предлагает выбор.
4. После сохранения запустите новый deploy, чтобы Functions получили свежие значения.

## Google

1. Создайте проект в Google Cloud.
2. Включите Gmail API, Calendar API, Sheets API и Drive API.
3. Настройте OAuth consent screen.
4. Создайте OAuth credentials или service gateway.
5. Скопируйте access token/refresh-token flow в backend-сервис и отдавайте Cloudflare только рабочий серверный токен.

## Microsoft Teams и Outlook

1. Создайте app registration в Microsoft Entra.
2. Выдайте Microsoft Graph application permission `Mail.Send` и подтвердите admin consent.
3. Создайте client secret и сохраните `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `OUTLOOK_SENDER`.
4. Для Teams используйте `TEAMS_WEBHOOK_URL` как основной и самый стабильный канал уведомлений.
5. `MS_GRAPH_ACCESS_TOKEN`, `TEAM_ID`, `TEAM_CHANNEL_ID` оставлены как fallback для ручной/делегированной Graph-настройки.

## Галерея до/после

TikTok JPEG перенесены в `assets/images/before-after/` и подключены в `assets/js/before-after.js`. Подробная инструкция по обновлению карточек и изображений лежит в `docs/before-after-guide.md`.

## Платежи

`functions/payment.js` пока возвращает статус `TODO`. Для продакшена подключите Stripe или PayPal только на сервере, ключи храните в Cloudflare env vars, а клиенту возвращайте только payment session/client token.

## Рассылка

`functions/subscribe.js` пишет подписчиков в лист `subscribers` и отправляет welcome-письмо при наличии Gmail API. Регулярная рассылка оставлена как TODO: нужен отдельный cron-сервис или Cloudflare Scheduled Worker.

## Проверки перед деплоем

```bash
npm run lint
npm run validate
npm run build
```

Для проверки функций локально:

```bash
npm run dev:cf
```

Проверить вручную:

- cookie banner на всех языках;
- booking-форму с будущей датой и файлом JPG/PNG;
- подписку на новостную рассылку;
- страницы `documents.html`;
- SEO-страницы `hundefriseur-leipzig.html`, `hundesalon-leipzig.html`, `dog-grooming-leipzig.html`;
- PWA installability и offline fallback.
