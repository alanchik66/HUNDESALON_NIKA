# 🐕 HUNDESALON NIKA - Профессиональный груминг-салон

> Многоязычный сайт салона груминга для собак и кошек в Лейпциге

[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-configured-blue.svg)](https://code.visualstudio.com/)
[![Languages](https://img.shields.io/badge/languages-4-green.svg)](#-языки)

## 🌟 Особенности

- **4 языковые версии**: 🇷🇺 Русский | 🇩🇪 Немецкий | 🇬🇧 Английский | 🇺🇦 Украинский
- **3D Виджет погоды**: Интерактивная погода Лейпцига
- **Полная валидация**: HTML5, CSS3, ES2021+ стандарты
- **Оптимизация SEO**: Мета-теги, структурированные данные
- **Мобильная версия**: Адаптивная верстка
- **Высокая производительность**: Сжатие, кэширование, CDN-ready

## 📁 Структура проекта

```text
HUNDESALON_NIKA/
├── 🏠 index.html              # Главная страница (переадресация)
├── 📧 functions/sendmail.js   # Cloudflare Pages Function для формы
├── ⚙️ _headers                # HTTP-заголовки Cloudflare Pages
├── 🔀 _redirects              # Редиректы Cloudflare Pages
├── ☁️ wrangler.toml           # Cloudflare Pages-конфигурация
├── 🛟 workers/                # Emergency Cloudflare Worker proxy
│   ├── pages-proxy.js         # Прокси для custom domains
│   └── wrangler.toml          # Worker-конфигурация
│
├── 🌍 Языковые версии/
│   ├── ru/                    # 🇷🇺 Русский
│   ├── de/                    # 🇩🇪 Немецкий
│   ├── en/                    # 🇬🇧 Английский
│   └── uk/                    # 🇺🇦 Украинский
│
├── 🎨 assets/                 # Статические ресурсы
│   ├── css/                   # Стили
│   ├── js/                    # JavaScript
│   ├── images/                # Изображения
│   └── fonts/                 # Шрифты
│
├── 🌤️ 3d-weather-codrops-main/ # Виджет погоды
│
├── ⚙️ .vscode/                # VS Code настройки
│   ├── settings.json          # Конфигурация редактора
│   ├── extensions.json        # Рекомендуемые расширения
│   ├── tasks.json             # Задачи автоматизации
│   └── launch.json            # Конфигурация отладки
│
├── 🔧 tools/                  # Инструменты разработки
└── 📖 docs/                   # Документация
```

## 🚀 Быстрый старт

### 1. Установка расширений VS Code

Откройте проект в VS Code и установите рекомендуемые расширения:

```bash
Ctrl+Shift+P → "Extensions: Show Recommended Extensions"
```

### 2. Запуск локального сервера

```bash
# Локальный просмотр
npm run dev

# Cloudflare Pages локально
npm run dev:cf
```

### 3. Проверка кода

```bash
# Полная проверка
Ctrl+Shift+P → "Tasks: Run Task" → "Полная проверка проекта"

# Или команды по отдельности
npm run lint        # Проверка кода
npm run format      # Форматирование
npm run validate    # Валидация
```

## 🛠️ Разработка

### Команды разработки

```bash
npm start          # Запуск локального сервера
npm run dev        # Режим разработки
npm run lint       # Проверка кода (HTML/CSS/JS)
npm run format     # Автоформатирование
npm run validate   # Валидация всего проекта
npm run build      # Сборка для продакшена
```

### VS Code задачи

**Ctrl+Shift+P** → "Tasks: Run Task":

- `Полная проверка проекта` - комплексная валидация
- `Сборка для продакшена` - готовая версия в `dist/`
- `Валидация HTML всех языков`
- `Валидация CSS`
- `Валидация JavaScript`
- `Форматирование всех файлов`

### Горячие клавиши

- **Ctrl+Shift+P** - Палитра команд
- **F5** - Запуск отладки
- **Ctrl+`** - Терминал
- **Alt+Shift+F** - Форматирование файла
- **Ctrl+Shift+E** - Проводник
- **Ctrl+Shift+X** - Расширения

## 🌙 Moon asset pipeline

Канонический генератор создаёт актуальные WebM, fallback MP4 и metadata из локального master-видео:

```bash
npm run moon:build-alpha
```

Исходник остаётся локальным и не попадает в deploy. Параметры, выходные файлы и требования к `ffmpeg` описаны в [`docs/moon-asset-pipeline.md`](docs/moon-asset-pipeline.md).

## 📦 Деплой на продакшен

### 1. Подготовка к деплою

```bash
# Сборка продакшен-версии
npm run build

# Или через задачу VS Code
Ctrl+Shift+P → "Tasks: Run Task" → "Сборка для продакшена"
```

### 2. Деплой в Cloudflare Pages

Для автоматизации всего процесса (линтинг, коммит, пуш и деплой) используйте единый скрипт:

```bash
./tools/release.ps1
```

Если требуется только ручной деплой уже собранной версии:

```bash
npm run deploy
```

Команда запускает валидацию и деплой через Wrangler согласно `wrangler.toml`.

Если нужен аварийный edge-proxy для custom domains, используйте отдельный Worker:

```bash
npm run deploy:worker
```

Локальный запуск Worker-прокси:

```bash
npm run dev:worker
```

### 3. Настройка домена

- Настройте DNS на хостинг
- Включите SSL-сертификат
- Проверьте все языковые версии

> 📖 Подробная инструкция: [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)

## 🌍 Языки

| Язык       | Код  | Папка  | Статус   |
| ---------- | ---- | ------ | -------- |
| Русский    | `ru` | `/ru/` | ✅ Готов |
| Немецкий   | `de` | `/de/` | ✅ Готов |
| Английский | `en` | `/en/` | ✅ Готов |
| Украинский | `uk` | `/uk/` | ✅ Готов |

## 🎨 Технологии

- **HTML5** - семантическая разметка
- **CSS3** - адаптивная верстка, flexbox, grid
- **JavaScript ES2021** - современный стандарт
- **Cloudflare Pages Functions** - обработка форм (`functions/sendmail.js`)
- **Three.js** - 3D виджет погоды
- **Cloudflare Pages** - хостинг и CDN

## 📋 Линтинг и форматирование

### Конфигурация инструментов

- **HTMLHint** - валидация HTML ([.htmlhintrc](.htmlhintrc))
- **ESLint** - проверка JavaScript ([eslint.config.js](eslint.config.js))
- **Stylelint** - проверка CSS ([.stylelintrc.json](.stylelintrc.json))
- **Prettier** - форматирование ([.prettierrc](.prettierrc))

### Настройки линтинга

```json
{
  "html": "строгая валидация HTML5, accessibility",
  "css": "стандартные правила, 2 пробела",
  "js": "ES2021, browser globals, строгость"
}
```

## 🔧 Конфигурация

### Переменные окружения для новых модулей

Только публичные идентификаторы Analytics, Google Ads и Microsoft Clarity лежат в [`config/env.js`](config/env.js). Серверные настройки и секреты задаются в Cloudflare Pages или в соответствующем Worker и не должны попадать в клиентский JavaScript.

| Переменная                                                                                                     | Где взять                                             | Для чего нужна                                                                               |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GA_MEASUREMENT_ID`                                                                                            | Google Analytics → Admin → Data streams               | аналитика после cookie-согласия                                                              |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`                                           | Google Cloud IAM service account                      | стабильный серверный доступ к Calendar, Sheets, Drive                                        |
| `GOOGLE_SERVICE_ACCOUNT_SUBJECT`                                                                               | Google Workspace Admin                                | опциональная domain-wide delegation для Google API                                           |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN`                           | Google Auth Platform → OAuth client → Desktop app     | основной путь для обычного Google-аккаунта: Calendar, Sheets и Drive через refresh token     |
| `GOOGLE_OAUTH_ACCESS_TOKEN`                                                                                    | Google Cloud OAuth / service gateway                  | временный fallback для ручной проверки Google API                                            |
| `GOOGLE_APPS_SCRIPT_WEBHOOK_URL`                                                                               | Apps Script Web App                                   | резервный gateway для обычного Gmail-аккаунта без Workspace                                  |
| `GOOGLE_GATEWAY_SECRET`                                                                                        | локально сгенерированный секрет                       | защита Google gateway endpoint                                                               |
| `GOOGLE_CALENDAR_ID`                                                                                           | Google Calendar settings                              | создание событий бронирования                                                                |
| `SHEET_ID`                                                                                                     | URL Google Sheets таблицы                             | закрытый административный учёт бронирований, регистраций клиентов/питомцев и подписчиков     |
| `DRIVE_UPLOAD_FOLDER`                                                                                          | URL папки Google Drive                                | загрузка фото питомца                                                                        |
| `SENDPULSE_FROM`, `CLIENT_EMAIL_FROM`                                                                          | SendPulse → Senders                                   | основной отправитель transactional email для клиентов                                        |
| `SERVICE_GATEWAY_API_KEY`                                                                                      | Existing Gemini gateway account                       | единственный разрешённый AI inference path; ключ хранится только как Cloudflare secret       |
| `SALON_EMAIL`, `SUPPORT_EMAIL`, `SUPPORT_REPLY_TO_EMAIL`, `CONTACT_RECIPIENT_EMAIL`, `BOOKING_RECIPIENT_EMAIL` | рабочая почта салона                                  | получатель заявок и адрес, куда клиенты отвечают                                             |
| `ADMIN_NOTIFICATION_EMAILS`                                                                                    | утверждённые адреса администраторов                   | внутренние копии заявок; список через запятую хранится только в secrets/закрытой настройке   |
| `GOOGLE_SHARE_EMAIL`                                                                                           | Google/Workspace аккаунты администраторов             | доступ к созданным Calendar, Sheets и Drive; можно указывать несколько адресов через запятую |
| `SENDPULSE_API_KEY` или `SENDPULSE_CLIENT_ID` + `SENDPULSE_CLIENT_SECRET`                                      | SendPulse → API                                       | единственный transport transactional email                                                   |
| `SENDPULSE_ADDRESSBOOK_ID`                                                                                     | SendPulse → Email → Mailing lists                     | адресная книга для контактов и Automation 360                                                |
| `SENDPULSE_BOOKING_EVENT_NAME`, `SENDPULSE_CONTACT_EVENT_NAME`, `SENDPULSE_NEWSLETTER_EVENT_NAME`              | SendPulse → Automation 360 → Events Manager           | серверные события форм для запуска flows; указываются resource names, не URL                 |
| `SLACK_WEBHOOK_URL`                                                                                            | Slack app webhook                                     | текущий fallback-канал уведомлений                                                           |
| `INFO_FORWARD_DESTINATION`                                                                                     | verified destination, secret Worker `info-auto-reply` | один конечный ящик для пересылки оригиналов при использовании info Worker                    |
| `INFO_AUTOREPLY_SECRET`                                                                                        | одинаковый secret в info Worker и Pages Production    | авторизация автоответа; значение не хранится в исходниках                                    |
| `BOOKING_FORWARD_DESTINATIONS`                                                                                 | secret Worker `booking-email-router`                  | ровно два уникальных verified-получателя через запятую                                       |
| `GOOGLE_SHEETS_WEBHOOK_URL`                                                                                    | ваш backend/service gateway                           | fallback-запись в Google Sheets                                                              |
| `GOOGLE_DRIVE_UPLOAD_WEBHOOK_URL`                                                                              | ваш backend/service gateway                           | fallback-загрузка файлов в Google Drive                                                      |
| `PAYMENT_PROVIDER_KEY`                                                                                         | Stripe/PayPal dashboard                               | TODO для будущей предоплаты                                                                  |

Проверенное состояние входящей почты на 30.08.2026: `info@hundesalon-nika.com` пересылается напрямую в существующий подтверждённый ящик. Worker `info-auto-reply` подготовлен, но не подключён к активному правилу: его деплой сам по себе не включает автоответы. Переключение правила требует отдельного согласования. `INFO_FORWARD_DESTINATION` должен указывать на конечный verified-ящик, а не возвращать письмо в `info@`.

В info Worker сначала пересылается оригинал; сбой или отсутствие секрета автоответа не отклоняет уже пересланное письмо. Автоответ использует Pages → SendPulse, поэтому binding `SEND_EMAIL` этому Worker не нужен. Результаты live-проверок и ограничения зафиксированы в [`knowledge/06_QA.md`](knowledge/06_QA.md).

Регистрации клиента и питомца для выбранной услуги сохраняются в отдельный лист `clients` той же закрытой Google Sheets таблицы. Лист содержит выбранную услугу и ориентировочную цену, данные клиента и питомца, номер жетона, согласия и источник заявки; чтения этого листа с сайта нет. «Первый груминг щенка» является обычной услугой, а не акцией. Скрипт `tools/setup-google-platform.mjs` создаёт лист и его заголовки автоматически при настройке или повторном запуске Google-платформы.

Online Stripe payments are hard-disabled in the deployed code; do not add payment secrets or enable the flag without verifying the booking flow, KV idempotency binding, and a no-charge decision.

Для локальной проверки Cloudflare Functions используйте `.dev.vars` по образцу `.dev.vars.example`, затем запускайте:

```bash
npm run dev:cf
```

Для первичной настройки Google OAuth после скачивания Desktop app JSON из Google Auth Platform задайте локально `GOOGLE_SHARE_EMAIL` утверждёнными Google/Workspace адресами администраторов через запятую:

```bash
npm run google:setup-platform -- --salon-email info@hundesalon-nika.com --share-email "${GOOGLE_SHARE_EMAIL:?Set approved Google/Workspace recipients}"
```

Скрипт создаёт Calendar, Sheet и Drive-папку, предоставляет доступ указанным Google/Workspace аккаунтам, ставит Cloudflare secrets для Production/Preview и не выводит OAuth secrets в консоль.

### VS Code настройки

Полная конфигурация в [`.vscode/settings.json`](.vscode/settings.json):

- ✅ Автоформатирование при сохранении
- ✅ Исправление ошибок при сохранении
- ✅ Многоязычная проверка орфографии
- ✅ Live Server (порт 5502)
- ✅ Интеграция с Git
- ✅ Оптимизация производительности

### Рекомендуемые расширения

25 профессиональных расширений в [`.vscode/extensions.json`](.vscode/extensions.json)

## 🐛 Отладка

### Запуск отладки

1. **F5** - запуск отладки
2. **Ctrl+Shift+D** - панель отладки
3. **F10/F11** - пошаговое выполнение

### Логи и ошибки

```bash
# Проверка консоли браузера
F12 → Console

# Ошибки валидации в VS Code
Ctrl+Shift+M → Problems

# Логи Live Server
Ctrl+` → Terminal
```

## 📊 Производительность

### Оптимизации

- ✅ **Gzip сжатие** - уменьшение размера файлов на 70%
- ✅ **Кэширование браузера** - изображения 1 год, CSS/JS 1 неделя
- ✅ **Минификация** - сжатие CSS/JS (при сборке)
- ✅ **Оптимизация изображений** - проверка размеров
- ✅ **CDN готовность** - статические ресурсы

### Мониторинг

```bash
# Анализ производительности
npm run audit

# Проверка ссылок
npm run test:links

# Размер файлов
npm run analyze:bundle
```

## 🔒 Безопасность

### Заголовки безопасности

- **X-Content-Type-Options**: nosniff
- **X-Frame-Options**: SAMEORIGIN
- **X-XSS-Protection**: включена
- **Content-Security-Policy**: настроен для виджета
- **HTTPS**: принудительное перенаправление

### PHP безопасность

- Отключены опасные функции
- Безопасные сессии
- Валидация входных данных

## 📞 Контакты и поддержка

HUNDESALON NIKA

- 📍 Лейпциг, Германия
- 📧 [contact@hundesalon-nika.com](mailto:contact@hundesalon-nika.com)
- 📱 Онлайн-бронирование доступно на сайте

---

## 📄 Лицензия

© 2024 HUNDESALON NIKA. Все права защищены.

**Статус проекта**: ✅ **ГОТОВ К ПРОДАКШЕНУ**

---

Разработано с ❤️ для любителей домашних животных
