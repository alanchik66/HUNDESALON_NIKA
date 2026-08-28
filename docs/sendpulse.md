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
- Для GPT-подобного поведения вся логика ответа должна быть собрана в SendPulse dashboard и в отдельном knowledge pack, например `knowledge/03_Resources/SendPulse_AI_Agent_Knowledge.md`:
  - `Welcome message` как старт;
  - `Filter` по `Current page URL` и `Language` для `de/en/ru/uk`;
  - `AI Agent` или `OpenAI (ChatGPT)` для свободных ответов;
  - включённый `File search` / knowledge files с фактическими данными сайта;
  - `Action`/handoff на человека для сложных случаев;
  - тест на всех четырёх языках и на desktop/mobile.
- Сам сайт уже передаёт в SendPulse текущую страницу и язык через браузерные данные, поэтому в flow builder нужно опираться на `Current page URL`, `Language` и данные контакта, а не дублировать их вручную.

### Автоматическое обновление File Search

- `npm run knowledge:build` детерминированно обновляет knowledge pack из канонического каталога цен, публичных правил `agb.html` и ключевых страниц `de/en/ru/uk`.
- Production build запускает генератор автоматически. `npm run knowledge:check` проверяет, что файл не устарел.
- После успешной загрузки сайта команда `npm run deploy` запускает `knowledge:sync:optional`. Если `OPENAI_API_KEY` не настроен локально, синхронизация безопасно пропускается без раскрытия секрета.
- `npm run knowledge:sync` загружает новую версию в OpenAI vector store, ждёт статуса `completed` и только затем отвязывает предыдущие версии, созданные этим же скриптом. Сторонние файлы и исходные OpenAI Files не удаляются.
- Локальные переменные: `OPENAI_API_KEY`, опциональный `SENDPULSE_AI_VECTOR_STORE_ID` и точное имя `SENDPULSE_AI_VECTOR_STORE_NAME=HUNDESAL_NIKA Website Knowledge`. Для первой миграции конкретные старые ручные версии можно явно перечислить в `SENDPULSE_AI_LEGACY_FILE_IDS`; никакие другие немаркированные файлы скрипт не отвязывает. Секреты не добавляются в git.
- Индексация использует блоки по 400 токенов с перекрытием 80 токенов. В AI Agent следует держать короткую системную инструкцию, ограниченный контекст последних сообщений и отключённые web search/MCP, пока для них нет отдельного проверенного сценария.

### Фактическая конфигурация AI Agent

- Модель: `GPT-5.6 Luna`; reasoning: `Low`. Модель выбрана после сравнительного File Search-теста как более надёжная для ответов на `de/en/ru/uk` и более экономичная, чем прежняя `GPT-4.1 Mini`.
- Контекст диалога: последние `8` сообщений. Инструкция ограничивает обычный ответ `80` словами и одним уточняющим вопросом; для `GPT-5.6 Luna` SendPulse не показывает отдельные поля максимального ответа и temperature в активной форме.
- Для немецких ответов инструкция и регрессионный тест запрещают англоязычные `Grooming/Groomer`; используются `Hundepflege`, `Fellpflege`, `Komplettpflege`, `Hundefriseur` или `Pflegefachkraft` по контексту.
- File Search включён и использует хранилище `HUNDESAL_NIKA Website Knowledge`.
- Лимит генераций: `20` запросов на один контакт за `24` часа.
- Раскрытие использования ИИ включено один раз в начале нового диалога на `de/en/ru/uk`.
- Web search выключен: актуальные услуги, цены и правила берутся только из контролируемой базы знаний сайта.
- MCP выключен: подключать только для конкретного проверенного действия. Описания MCP-инструментов добавляются к запросам модели и увеличивают расход токенов.
- Google Sheets не используется как дублирующая клиентская база: заявки поступают в штатную SendPulse CRM через Automation 360.
- Webhooks чат-бота остаются выключенными, пока нет отдельного аутентифицированного обработчика с проверенным контрактом и мониторингом.
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
4. Проверить SMTP history, Events Manager log, mailing-list contact, CRM deal, Telegram и строку Google Sheets.
5. Включить flows только после тестового прогона, затем отключить дублирующие переходные уведомления.
6. Проверить bounce/spam/unsubscribe и повторить DNS-проверку через внешний resolver.

## Защита от регрессий

- `npm run check:sendpulse-automation` проверяет безопасную отправку событий и нормализацию payload.
- `npm run check:sendpulse-ai-knowledge` проверяет генерацию базы знаний и безопасный порядок ротации File Search.
- `npm run check:email-provider` запрещает возвращение прежнего email-транспорта и его переменных.
- Обе проверки входят в `npm run validate` и должны проходить перед каждым деплоем.
