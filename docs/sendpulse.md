# SendPulse: архитектура HUNDESALON NIKA #

## Что подключено #

- `/sendmail` принимает booking/contact формы, валидирует origin и rate limit и отправляет email через SendPulse SMTP API.
- `/subscribe` принимает newsletter с обязательным согласием и отправляет welcome-письмо через тот же модуль.
- При наличии `SENDPULSE_ADDRESSBOOK_ID` обработчики добавляют или обновляют контакт в единой mailing list.
- После успешной основной отправки сервер передаёт нормализованные события booking/contact/newsletter в Automation 360 по resource name и с Bearer-авторизацией. URL события не принимается из браузера, поэтому пользователь не может подменить endpoint.
- `_lib/platform-integrations.js` кэширует OAuth-токен, поддерживает static API key, логирует только технический статус и повторяет временные ошибки до трёх раз.
- Google Calendar/Sheets, Slack/Teams остаются переходными резервными интеграциями. Их отключают только после подтверждённого запуска соответствующих Automation 360 actions.

SendPulse является единственным email-транспортом. Старый email-провайдер и его runtime-переменные запрещены проверкой `check:email-provider`.

## Конфигурация Cloudflare Pages #

Production secrets:

- `SENDPULSE_API_KEY` или `SENDPULSE_CLIENT_ID` + `SENDPULSE_CLIENT_SECRET`;
- `SENDPULSE_FROM` — активированный sender на `hundesalon-nika.com`;
- `SENDPULSE_ADDRESSBOOK_ID` — ID единой mailing list;
- `SENDPULSE_BOOKING_EVENT_NAME`;
- `SENDPULSE_CONTACT_EVENT_NAME`;
- `SENDPULSE_NEWSLETTER_EVENT_NAME`.

Последние три значения — resource names из Automation 360 → Events Manager, например `website_booking`. Это не полные URL и не клиентские поля. Код отправляет события на официальный endpoint `https://events.sendpulse.com/events/name/{name}` с уже существующим серверным токеном.

## Mailing list и переменные #

Единая mailing list: `HUNDESALON NIKA — Website Contacts`.

Основные переменные:

- `name`, `phone`, `language`;
- `service_type`, `lead_source`, `form_type`;
- `inquiry_type`, `appointment_date`, `appointment_time`;
- `payment_status`, `privacy_consent`, `agb_consent`, `marketing_consent`;
- `source_url`, `page_path`, `site_origin`, `submitted_at`, `request_id`.

Значения языка сайта: `de`, `en`, `ru`, `uk`. В интерфейсе CRM украинский сегмент можно назвать `UA`, но техническое значение должно остаться `uk`, чтобы совпадать с сайтом.

## Events Manager #

Создать три Custom events со Standard data structure:

1. `website_booking` — email/phone, данные услуги, дата и время записи, согласия, источник.
2. `website_contact` — email/phone, направление обращения, сообщение, язык и источник.
3. `website_newsletter` — email, язык, источник и marketing consent.

`email` или `phone` должны быть top-level String variables. Остальные строковые переменные ограничиваются 255 символами на сервере. После создания событий их resource names записываются в Cloudflare secrets выше.

## Automation 360 и CRM #

CRM pipeline: `Новая заявка` → `Подтверждение` → `В работе` → `Завершено`; отдельная потерянная причина — `Отменено / не состоялось`.

Теги услуг: `Grooming`, `Стрижка`, `Купание`, `Тримминг`. Языковые теги/сегменты: `DE`, `EN`, `RU`, `UA` с техническими значениями `de/en/ru/uk`.

Flows:

1. booking → upsert contact → языковая ветка → подтверждение клиенту → CRM deal → уведомление менеджеру → Telegram → Google Sheets;
2. contact → языковая ветка → подтверждение клиенту → CRM task/deal → уведомление менеджеру → Google Sheets;
3. newsletter → welcome по языку → тег/сегмент;
4. CRM stage `Подтверждение` + дата визита → напоминание;
5. CRM stage `Завершено` → рекомендации после визита и просьба об отзыве.

Telegram-клиенту можно отправлять только при связанном Telegram-контакте. Для менеджера используется Action `Notify me via Telegram`. Google Sheets подключается официальным приложением SendPulse и action `Add Google Sheets data`.

## Telegram-уведомления сайта

Сайт поддерживает уведомления менеджеру через Telegram Bot API. В Cloudflare Pages Production добавляются секреты `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` и переменная `SITE_NOTIFICATIONS_ENABLED=true`. Бота нужно добавить администратором в рабочий канал с правом публикации сообщений; `TELEGRAM_CHAT_ID` канала обычно имеет формат `-100...`. Токен не хранится в репозитории, логах или клиентском коде.

## DNS и доставляемость #

- SPF должен содержать единственную запись и включать `include:mxsspf.sendpulse.com`.
- DKIM берётся только из SendPulse → Email → Service settings → Domain settings и публикуется в Cloudflare как TXT `sign._domainkey`.
- DMARC сохраняется строгим и не ослабляется ради теста.
- Sender domain обязан совпадать с доменом адреса From.

## Production checklist #

1. Активировать sender и добиться зелёного статуса SPF/DKIM в SendPulse.
2. Создать mailing list, переменные и три события; записать ID/resource names в Pages secrets.
3. Выполнить contact, booking и newsletter тесты на `de/en/ru/uk`.
4. Проверить SMTP history, Events Manager log, mailing-list contact, CRM deal, Telegram и строку Google Sheets.
5. Включить flows только после тестового прогона, затем отключить дублирующие переходные уведомления.
6. Проверить bounce/spam/unsubscribe и повторить DNS-проверку через внешний resolver.

## Защита от регрессий #

- `npm run check:sendpulse-automation` проверяет безопасную отправку событий и нормализацию payload.
- `npm run check:email-provider` запрещает возвращение прежнего email-транспорта и его переменных.
- Обе проверки входят в `npm run validate` и должны проходить перед каждым деплоем.
