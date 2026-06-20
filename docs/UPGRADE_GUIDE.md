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
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REFRESH_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_SERVICE_ACCOUNT_SUBJECT`
- `GOOGLE_CALENDAR_ID`
- `SHEET_ID`
- `DRIVE_UPLOAD_FOLDER`
- `GMAIL_SENDER`
- `RESEND_FROM`
- `CLIENT_EMAIL_FROM`
- `SALON_EMAIL`
- `SUPPORT_EMAIL`
- `SUPPORT_REPLY_TO_EMAIL`
- `CONTACT_RECIPIENT_EMAIL`
- `BOOKING_RECIPIENT_EMAIL`
- `ADMIN_NOTIFICATION_EMAILS`
- `GOOGLE_SHARE_EMAIL`
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
3. Если Google Cloud включает `iam.disableServiceAccountKeyCreation`, не отключайте защиту ради сайта. Основной путь для обычного `@gmail.com` — OAuth Desktop client и refresh token:
   - Google Auth Platform → Clients → Create client → Desktop app.
   - Авторизуйте scopes `calendar`, `drive.file`, `spreadsheets`, `gmail.send`.
   - Сохраните `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` только как Cloudflare secrets.
   - Автоматический путь в репозитории: скачайте Desktop app JSON и запустите `npm run google:setup-platform -- --salon-email info@hundesalon-nika.com --share-email snaiper1984@gmail.com,ryndenko1982@gmail.com`.
4. Для Google Workspace или проектов без запрета ключей можно использовать service account: сохраните `GOOGLE_SERVICE_ACCOUNT_EMAIL` и `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` в Cloudflare secrets.
5. Apps Script gateway из `integrations/google-apps-script-gateway/` оставлен как резервный вариант. Он выполняется от имени владельца Google-аккаунта, создаёт Calendar/Sheets/Drive и принимает защищённые webhook-запросы от Cloudflare.
6. Gmail API через service account работает только в Google Workspace с domain-wide delegation. Для обычного `@gmail.com` используйте Resend как основной канал email; Gmail OAuth нужен для Calendar/Sheets/Drive и не должен быть видимым отправителем для клиента.

## Google Apps Script gateway

1. Включите Apps Script API в пользовательских настройках: `https://script.google.com/home/usersettings`.
2. В каталоге `integrations/google-apps-script-gateway/` создайте Apps Script project через `clasp create`, загрузите код через `clasp push`.
3. Установите script property `GATEWAY_SECRET`.
4. Разверните как Web App: execute as owner, access anyone with link.
5. Добавьте в Cloudflare Pages secrets:
   - `GOOGLE_APPS_SCRIPT_WEBHOOK_URL`
   - `GOOGLE_GATEWAY_SECRET`
   - `GOOGLE_CALENDAR_ID`
   - `SHEET_ID`
   - `DRIVE_UPLOAD_FOLDER`

## Рабочая почта и доступы

- `CONTACT_RECIPIENT_EMAIL` и `BOOKING_RECIPIENT_EMAIL` — куда приходят заявки с сайта. По умолчанию используется `info@hundesalon-nika.com`.
- `SUPPORT_EMAIL` и `SUPPORT_REPLY_TO_EMAIL` — рабочий адрес, куда должны попадать ответы клиентов. Для текущей схемы: `info@hundesalon-nika.com`.
- `ADMIN_NOTIFICATION_EMAILS` — внутренние копии заявок для администраторов: `snaiper1984@gmail.com,ryndenko1982@gmail.com`.
- `GOOGLE_SHARE_EMAIL` — кому выдать доступ к Google Calendar/Sheets/Drive. Можно указать несколько Google-аккаунтов через запятую.
- `GMAIL_SENDER` должен быть только рабочим Gmail/Workspace alias. Если он пустой, код не отправляет клиентские письма через Gmail, чтобы клиент не видел личный Gmail владельца OAuth.

## Microsoft Teams и Outlook

1. Создайте app registration в Microsoft Entra.
2. Выдайте Microsoft Graph application permission `Mail.Send` и подтвердите admin consent.
3. Создайте client secret и сохраните `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`.
4. Укажите `OUTLOOK_SENDER` только если в tenant есть лицензированный Microsoft 365 mailbox. Без mailbox Cloudflare Function пропускает Outlook и не ломает заявку.
5. Для Teams используйте `TEAMS_WEBHOOK_URL` как основной и самый стабильный канал уведомлений. Нужен существующий Teams channel с включённым incoming webhook.
6. `MS_GRAPH_ACCESS_TOKEN`, `TEAM_ID`, `TEAM_CHANNEL_ID` оставлены как fallback для ручной/делегированной Graph-настройки.

## Текущий продакшен-канал email

Resend — основной рабочий канал для заявок, подтверждений бронирования и welcome-писем. Клиентские письма уходят с `CLIENT_EMAIL_FROM`, а ответы клиентов направляются на `SUPPORT_REPLY_TO_EMAIL`. Gmail API оставлен опционально и не используется для клиентских писем без явно настроенного рабочего `GMAIL_SENDER`.

## Галерея до/после

TikTok JPEG перенесены в `assets/images/before-after/` и подключены в `assets/js/before-after.js`. Подробная инструкция по обновлению карточек и изображений лежит в `docs/before-after-guide.md`.

## Платежи

`functions/payment.js` пока возвращает статус `TODO`. Для продакшена подключите Stripe или PayPal только на сервере, ключи храните в Cloudflare env vars, а клиенту возвращайте только payment session/client token.

## Рассылка

`functions/subscribe.js` пишет подписчиков в лист `subscribers`, отправляет welcome-письмо через Resend и уведомляет админ-адреса. Регулярная рассылка оставлена как TODO: нужен отдельный cron-сервис или Cloudflare Scheduled Worker.

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
