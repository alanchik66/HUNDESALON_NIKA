# SendPulse: архитектура HUNDESALON NIKA

## Что подключено

- `/sendmail` принимает booking/contact формы, валидирует origin и rate limit и отправляет email через SendPulse SMTP API.
- `/subscribe` принимает newsletter с обязательным согласием и отправляет welcome-письмо через тот же модуль.
- При наличии `SENDPULSE_ADDRESSBOOK_ID` обработчики добавляют или обновляют контакт в единой mailing list.
- После успешной основной отправки сервер передаёт нормализованные события booking/contact/newsletter в Automation 360 по resource name и с Bearer-авторизацией. URL события не принимается из браузера, поэтому пользователь не может подменить endpoint.
- `_lib/platform-integrations.js` кэширует OAuth-токен, поддерживает static API key, логирует только технический статус и повторяет временные ошибки до трёх раз.
- Google Calendar/Sheets, Slack/Teams остаются переходными резервными интеграциями. Их отключают только после подтверждённого запуска соответствующих Automation 360 actions.

SendPulse является единственным email-транспортом. Старый email-провайдер и его runtime-переменные запрещены проверкой `check:email-provider`.

## Конфигурация Cloudflare Pages

Production secrets:

- `SENDPULSE_API_KEY` или `SENDPULSE_CLIENT_ID` + `SENDPULSE_CLIENT_SECRET`;
- `SENDPULSE_FROM` — активированный sender на `hundesalon-nika.com`;
- `SENDPULSE_ADDRESSBOOK_ID` — ID единой mailing list;
- `SENDPULSE_BOOKING_EVENT_NAME`;
- `SENDPULSE_CONTACT_EVENT_NAME`;
- `SENDPULSE_NEWSLETTER_EVENT_NAME`.

Последние три значения — resource names из Automation 360 → Events Manager, например `website_booking`. Это не полные URL и не клиентские поля. Код отправляет события на официальный endpoint `https://events.sendpulse.com/events/name/{name}` с уже существующим серверным токеном.

## Mailing list и переменные

Единая mailing list: `HUNDESALON NIKA — Website Contacts`.

Основные переменные:

- `name`, `phone`, `language`;
- `service_type`, `lead_source`, `form_type`;
- `inquiry_type`, `appointment_date`, `appointment_time`;
- `payment_status`, `privacy_consent`, `agb_consent`, `marketing_consent`;
- `source_url`, `page_path`, `site_origin`, `submitted_at`, `request_id`.

Значения языка сайта: `de`, `en`, `ru`, `uk`. В интерфейсе CRM украинский сегмент можно назвать `UA`, но техническое значение должно остаться `uk`, чтобы совпадать с сайтом.

## Events Manager

Создать три Custom events со Standard data structure:

1. `website_booking` — email/phone, данные услуги, дата и время записи, согласия, источник.
2. `website_contact` — email/phone, направление обращения, сообщение, язык и источник.
3. `website_newsletter` — email, язык, источник и marketing consent.

`email` или `phone` должны быть top-level String variables. Остальные строковые переменные ограничиваются 255 символами на сервере. После создания событий их resource names записываются в Cloudflare secrets выше.

## Automation 360 и CRM

Этот раздел описывает необязательную бизнес-автоматизацию. Она не является зависимостью бесплатного GPT-чата и включается только для уже доступных в аккаунте функций после отдельной live-проверки.

CRM pipeline: `Новая заявка` → `Подтверждение` → `В работе` → `Завершено`; отдельная потерянная причина — `Отменено / не состоялось`.

Теги услуг: `Komplettpflege`, `Стрижка`, `Купание`, `Тримминг`. Языковые теги/сегменты: `DE`, `EN`, `RU`, `UA` с техническими значениями `de/en/ru/uk`.

Flows:

1. booking → upsert contact → языковая ветка → подтверждение клиенту → CRM deal → уведомление менеджеру → Telegram;
2. contact → языковая ветка → подтверждение клиенту → CRM task/deal → уведомление менеджеру;
3. newsletter → welcome по языку → тег/сегмент;
4. CRM stage `Подтверждение` + дата визита → напоминание;
5. CRM stage `Завершено` → рекомендации после визита и просьба об отзыве.

Telegram-клиенту можно отправлять только при связанном Telegram-контакте. Для менеджера используется Action `Notify me via Telegram`. Google Sheets в бесплатной архитектуре не подключается и не дублирует CRM.

## Telegram-уведомления сайта

Сайт поддерживает уведомления менеджеру через Telegram Bot API. В Cloudflare Pages Production добавляются секреты `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` и переменная `SITE_NOTIFICATIONS_ENABLED=true`. Бота нужно добавить администратором в рабочий канал с правом публикации сообщений; `TELEGRAM_CHAT_ID` канала обычно имеет формат `-100...`. Токен не хранится в репозитории, логах или клиентском коде.

## Виджеты сайта

В production bundle автоматически подключаются:

- Live chat SendPulse:
  `<script src="https://cdn.pulse.is/livechat/loader.js" data-live-chat-id="6a89e797b7f95e2b6c0cf199" async></script>`
- Pop-up SendPulse:
  `<script src="https://static.sppopups.com/assets/loader.js" data-chats-widget-id="49f098e8-81bf-4efa-9842-8f2012257c7b" async></script>`
- Дополнительный runtime попапов:
  `<script src="https://static.sppopups.com/bundle.js.gz" async></script>`

## Live chat routing and AI

- На сайте live chat подключается на всех публичных страницах через `assets/js/sendpulse-integrations.js`.
- До загрузки виджета сайт передаёт в `window.oSpP` контекст страницы: `language`, `page_path`, `site_origin`, `source_url`.
- После загрузки виджета сайт дополнительно передаёт SendPulse язык страницы через `spLiveChatLoaded` и `window.sp.liveChat.config(...)`.
- Поддерживаемые языки UI виджета: `en`, `ru`, `uk`. Для немецких страниц виджет намеренно остаётся на `en`, потому что в SendPulse live chat нет `de` в списке системных языков.
- С 30 августа 2026 года текущий тариф SendPulse — `Бесплатный тариф`: до 500 контактов, 10 000 сообщений в месяц, 3 ботов, 10 триггеров и ограниченный API. Штатные AI Agent, File Search, MCP, Google Sheets и полные webhooks не являются частью бесплатного уровня и не используются как критическая зависимость.
- GPT-ответы реализованы самим сайтом: `assets/js/ai-chat.js` обращается только к same-origin `POST /api/ai-chat`, а `functions/api/ai-chat.js` вызывает OpenAI Responses API на сервере. Ключ никогда не передаётся браузеру.
- Бесплатный SendPulse live chat используется для личной консультации и передачи диалога человеку. При прямом запросе оператора endpoint не вызывает модель и сразу возвращает локализованный handoff.
- Если OpenAI временно недоступен или секрет не настроен, чат не придумывает ответ: он показывает безопасное локализованное сообщение и кнопку личной консультации.

### Брендированный интерфейс Live Chat

- SendPulse dashboard штатно настраивает только положение, цветовую схему и текст заголовка. Меню поддержки SendPulse с полноэкранным режимом и экспортом истории не входит в публичный API клиентского Live Chat.
- `assets/js/ai-chat.js` и `assets/css/ai-chat.css` создают основной доступный интерфейс AI: логотип, центрированный бренд `HUNDESALON_NIKA`, локализованное меню, emoji, voice-to-text, экспорт истории, новый разговор, полноэкранный режим и явную кнопку личной консультации.
- `assets/js/sendpulse-integrations.js` сохраняет брендированный слой нативного human live chat внутри Shadow DOM: логотип, заголовок, меню быстрых действий и логотип у сообщений бота или оператора. Его launcher скрывается только после успешной инициализации собственного AI-интерфейса; при ошибке AI-файла нативная кнопка остаётся резервом.
- Быстрые действия выполняют реальные локальные операции: сворачивают штатной кнопкой SendPulse, переключают полноэкранный режим, сохраняют видимую историю в UTF-8 TXT и после явного подтверждения начинают новый разговор сбросом идентификатора посетителя. История предыдущего разговора в SendPulse не удаляется.
- Штатная загрузка файлов SendPulse остаётся основным транспортом вложений. Надстройка добавляет emoji и браузерный voice-to-text, который только вставляет распознанный текст в поле сообщения и ничего не отправляет автоматически.
- Нативная отправка голосовых файлов посетителем, аватар оператора и меню поддержки не документированы SendPulse для клиентского Live Chat. Их нельзя обозначать как штатные возможности или имитировать неработающими кнопками.
- Интеграция отслеживает повторный рендер Svelte-компонентов SendPulse и восстанавливает брендированные элементы без вмешательства в WebSocket, API сообщений или обработчик загрузки файлов.

### Автоматическое обновление базы знаний

- `npm run knowledge:build` детерминированно обновляет knowledge pack из канонического каталога цен, публичных правил `agb.html` и ключевых страниц `de/en/ru/uk`.
- Тот же скрипт сборки запускает `tools/generate-ai-chat-index.mjs`, который формирует детерминированный модуль `functions/_generated/ai-chat-knowledge.js` из разделов канонического Markdown. `npm run knowledge:check` проверяет и документ, и индекс.
- Endpoint выполняет локальный полнотекстовый поиск по 136 компактным разделам, учитывает текущую локаль и передаёт модели не более 6 релевантных блоков общим объёмом до 10 500 символов. Это исключает повторную отправку всего документа и платные вызовы SendPulse File Search.
- Контекст ограничен последними 8 сообщениями; каждое сообщение и общий request body имеют жёсткие лимиты. OpenAI получает `store: false`, `reasoning: low`, `current_turn` и приватный хешированный `safety_identifier`.
- `npm run deploy` больше не синхронизирует SendPulse/OpenAI vector store автоматически. `npm run knowledge:sync` сохранён только как ручная legacy-команда на случай отдельного решения вернуть SendPulse PRO; она не входит в бесплатный production path.
- `OPENAI_API_KEY` должен храниться только как зашифрованный Cloudflare Pages secret. При его отсутствии endpoint безопасно переводит клиента к человеку. Секреты не добавляются в git, bundle или ответы API.

### Фактическая конфигурация GPT endpoint

- Модель по умолчанию: `gpt-5.6-luna`; Responses API; reasoning `low`; максимальный ответ 500 токенов; ответы не сохраняются через API. Опциональная server-side переменная `OPENAI_CHAT_MODEL` позволяет выполнить контролируемую смену модели без изменения клиента.
- Контекст диалога: последние `8` сообщений. Источником бизнес-фактов остаётся только автоматически собранная база сайта; web search и MCP не подключены.
- Для немецких ответов инструкция и регрессионный тест запрещают англоязычные `Grooming/Groomer`; используются `Hundepflege`, `Fellpflege`, `Komplettpflege`, `Hundefriseur` или `Pflegefachkraft` по контексту.
- Edge rate limit: 12 запросов на IP за 60 секунд; body до 24 КБ; пользовательское сообщение до 1400 символов. Клиент показывает отдельное сообщение для `429` и предлагает личную консультацию.
- UI и ответы локализованы для `de`, `en`, `ru`, `uk`. Тесты проверяют точный retrieval цены Zwergpudel, немецкую терминологию, безопасный fallback и склоняемые запросы передачи специалисту.
- Google Sheets, MCP и чат-бот webhooks не являются частью бесплатного AI path. CRM/Automation 360 могут использоваться отдельно только в пределах реально доступных функций тарифа и не должны блокировать чат.
- Gemini не подключён; резервный непроверенный провайдер не должен незаметно менять ответы или биллинг.

Ручной триггер для попапа:

- класс кнопки/ссылки `sp_popup_69052fa6-c2c5-4ed2-adc1-0dec2f5bd3b9`;
- тестовый hash `#show_sp_popup=69052fa6-c2c5-4ed2-adc1-0dec2f5bd3b9`.

## DNS и доставляемость

- SPF должен содержать единственную запись и включать `include:mxsspf.sendpulse.com`.
- DKIM берётся только из SendPulse → Email → Service settings → Domain settings и публикуется в Cloudflare как TXT `sign._domainkey`.
- DMARC сохраняется строгим и не ослабляется ради теста.
- Sender domain обязан совпадать с доменом адреса From.

## Production checklist

1. Активировать sender и добиться зелёного статуса SPF/DKIM в SendPulse.
2. Создать mailing list, переменные и три события; записать ID/resource names в Pages secrets.
3. Выполнить contact, booking и newsletter тесты на `de/en/ru/uk`.
4. Проверить SMTP history, Events Manager log, mailing-list contact, CRM deal и Telegram. Google Sheets не входит в обязательный бесплатный AI path.
5. Включить flows только после тестового прогона, затем отключить дублирующие переходные уведомления.
6. Проверить bounce/spam/unsubscribe и повторить DNS-проверку через внешний resolver.

## Защита от регрессий

- `npm run check:sendpulse-automation` проверяет безопасную отправку событий и нормализацию payload.
- `npm run check:sendpulse-ai-knowledge` проверяет генерацию канонической базы, локального AI-индекса и безопасный порядок legacy-ротации File Search.
- `npm run check:email-provider` запрещает возвращение прежнего email-транспорта и его переменных.
- Обе проверки входят в `npm run validate` и должны проходить перед каждым деплоем.
