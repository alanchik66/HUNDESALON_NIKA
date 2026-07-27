# SendPulse: архитектура HUNDESALON NIKA

## Что подключено

- `/sendmail` принимает booking/contact формы, валидирует origin и rate limit, отправляет email через SendPulse SMTP API и при наличии `SENDPULSE_ADDRESSBOOK_ID` добавляет контакт.
- `/subscribe` принимает newsletter с обязательным согласием, отправляет welcome-письмо через тот же модуль и сохраняет язык и источник.
- `_lib/platform-integrations.js` кэширует OAuth-токен, поддерживает static API key, логирует результат доставки и повторяет временные ошибки.
- Google Calendar/Sheets, Slack/Teams и Stripe остаются отдельными операционными интеграциями; SendPulse является единственным email-транспортом.

## Конфигурация

Задайте `SENDPULSE_API_KEY` или пару `SENDPULSE_CLIENT_ID`/`SENDPULSE_CLIENT_SECRET`, а также подтверждённый `SENDPULSE_FROM`. Для контактов задайте `SENDPULSE_ADDRESSBOOK_ID`. Секреты хранятся только в Cloudflare Pages secrets; пример есть в [`.dev.vars.example`](../.dev.vars.example).

Создайте переменные mailing list: `name`, `phone`, `language`, `service_type`, `lead_source`, `form_type`. Язык сайта: `de`, `en`, `ru`, `uk`.

## Automation 360 и CRM

Настройте flows: booking → подтверждение → уведомление менеджеру → CRM deal; newsletter → welcome → сегмент языка; `visit_status=completed` → письмо после визита → отзыв; `appointment_at` за 24 часа → напоминание.

CRM pipeline: `Новая заявка` → `Подтверждение` → `В работе` → `Завершено`. Теги: `Grooming`, `Стрижка`, `Купание`, `Тримминг`; сегменты: `de`, `en`, `ru`, `uk`.

Telegram и Google Sheets подключаются в Automation 360 через webhook/API request после создания URL и секретов в соответствующих сервисах. Код не содержит выдуманных внешних токенов.

## Production checklist

1. Подтвердить sender и DKIM/SPF в SendPulse.
2. Заполнить Pages secrets и выполнить contact, booking и newsletter тесты на всех языках.
3. Проверить историю SMTP, контакт и переменные в SendPulse.
4. После этого включить Automation 360 flows и CRM actions.

## Защита от возврата старого транспорта

`npm run check:email-provider` проверяет исходники, конфигурацию и документацию на случайное возвращение прежнего email-провайдера или его переменных. Проверка включена в `npm run validate` и должна проходить до каждого деплоя.
