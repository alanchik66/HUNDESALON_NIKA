# 🐕 HUNDESALON NIKA - Профессиональный груминг-салон

> Многоязычный сайт салона груминга для собак и кошек в Лейпциге

[![License](https://img.shields.io/badge/license-UNLICENSED-red.svg)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-configured-blue.svg)](https://code.visualstudio.com/)
[![Languages](https://img.shields.io/badge/languages-4-green.svg)](#языки)

## 🌟 Особенности

- **4 языковые версии**: 🇷🇺 Русский | 🇩🇪 Немецкий | 🇬🇧 Английский | 🇺🇦 Украинский
- **3D Виджет погоды**: Интерактивная погода Лейпцига
- **Полная валидация**: HTML5, CSS3, ES2021+ стандарты
- **Оптимизация SEO**: Мета-теги, структурированные данные
- **Мобильная версия**: Адаптивная верстка
- **Высокая производительность**: Сжатие, кэширование, CDN-ready

## 📁 Структура проекта

```
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

## 🤖 AI agents

Routing kernel (startup, detection, decision pipeline): [`docs/agents-routing.md`](docs/agents-routing.md). Profile: [`AGENTS.md`](AGENTS.md). Playbook: [`docs/agents-playbook.md`](docs/agents-playbook.md). Quality contract: [`docs/agents-master.md`](docs/agents-master.md). Also: `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`.

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

- **Ctrl+Shift+P** → "Tasks: Run Task":
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

Папка ассетов: `3d-weather-codrops-main/dist-widget/assets/Moon`.

Исходники:

- `mission_2160p1.mp4`
- `mission_1080p30.mp4`

Ручной шаг в After Effects:

1. Импортировать оба MP4 через **Файл → Импорт → Файл…**.
2. Для каждого видео создать композицию из видеоряда.
3. Удалить фон через **Keylight (1.2)**, **Luma Key** или **Roto Brush**, затем проверить шахматку прозрачности.
4. Экспортировать QuickTime MOV с альфой:
   - Codec: `Apple ProRes 4444` или `Animation`
   - Channels: `RGB + Alpha`
   - Depth: `Millions of Colors+`
   - Color: `Straight (Unmatted)`
5. Сохранить в папку Moon:
   - `mission_2160p1_alpha.mov`
   - `mission_1080p30_alpha.mov`

Автоматическая конвертация:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\convert_to_webm.ps1
```

Или через VS Code: **Tasks: Run Task** → `Moon: Convert MOV -> WebM+MP4`.

Проверка:

```bash
powershell -ExecutionPolicy Bypass -File .\scripts\verify_outputs.ps1
```

Или через VS Code: **Tasks: Run Task** → `Moon: Verify Alpha Outputs`.

Ожидаемые выходы:

- `mission_2160p1_alpha.mov`
- `mission_2160p1_alpha_2160.webm`
- `mission_2160p1_alpha_fallback_1080.mp4`
- `mission_1080p30_alpha.mov`
- `mission_1080p30_alpha_1080.webm`
- `mission_1080p30_alpha_fallback_1080.mp4`

Для WebM нужен `ffmpeg` с `--enable-libvpx`.

Полный регламент после мержа, чеклист ревью и требования к PR: [`docs/moon-asset-pipeline.md`](docs/moon-asset-pipeline.md).

## 📦 Деплой на продакшен

### 1. Подготовка к деплою

```bash
# Сборка продакшен-версии
npm run build

# Или через задачу VS Code
Ctrl+Shift+P → "Tasks: Run Task" → "Сборка для продакшена"
```

### 2. Деплой в Cloudflare Pages

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

| Язык | Код | Папка | Статус |
|------|-----|-------|--------|
| Русский | `ru` | `/ru/` | ✅ Готов |
| Немецкий | `de` | `/de/` | ✅ Готов |
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

### Конфигурация инструментов:

- **HTMLHint** - валидация HTML ([.htmlhintrc](.htmlhintrc))
- **ESLint** - проверка JavaScript ([eslint.config.js](eslint.config.js))
- **Stylelint** - проверка CSS ([.stylelintrc.json](.stylelintrc.json))
- **Prettier** - форматирование ([.prettierrc](.prettierrc))

### Настройки линтинга:

```json
{
  "html": "строгая валидация HTML5, accessibility",
  "css": "стандартные правила, 2 пробела",
  "js": "ES2021, browser globals, строгость"
}
```

## 🔧 Конфигурация

### Переменные окружения для новых модулей

Публичные placeholder-значения лежат в [`config/env.js`](config/env.js). Для реального деплоя секреты и рабочие ID задаются только в Cloudflare Pages → Settings → Environment variables.

| Переменная | Где взять | Для чего нужна |
|------------|-----------|----------------|
| `GA_MEASUREMENT_ID` | Google Analytics → Admin → Data streams | аналитика после cookie-согласия |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Cloud IAM service account | стабильный серверный доступ к Calendar, Sheets, Drive |
| `GOOGLE_SERVICE_ACCOUNT_SUBJECT` | Google Workspace Admin | опционально для Gmail domain-wide delegation |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` | Google Auth Platform → OAuth client → Desktop app | основной путь для обычного Gmail-аккаунта: Calendar, Sheets, Drive и Gmail через refresh token |
| `GOOGLE_OAUTH_ACCESS_TOKEN` | Google Cloud OAuth / service gateway | временный fallback для ручной проверки Google API |
| `GOOGLE_APPS_SCRIPT_WEBHOOK_URL` | Apps Script Web App | резервный gateway для обычного Gmail-аккаунта без Workspace |
| `GOOGLE_GATEWAY_SECRET` | локально сгенерированный секрет | защита Google gateway endpoint |
| `GOOGLE_CALENDAR_ID` | Google Calendar settings | создание событий бронирования |
| `SHEET_ID` | URL Google Sheets таблицы | лог бронирований и подписчиков |
| `DRIVE_UPLOAD_FOLDER` | URL папки Google Drive | загрузка фото питомца |
| `GMAIL_SENDER` | Gmail/Workspace alias | опционально; указывайте только рабочий alias, иначе Gmail не отправляет клиентам письма |
| `RESEND_FROM`, `CLIENT_EMAIL_FROM` | Resend verified domain | основной отправитель transactional email для клиентов |
| `SALON_EMAIL`, `SUPPORT_EMAIL`, `SUPPORT_REPLY_TO_EMAIL`, `CONTACT_RECIPIENT_EMAIL`, `BOOKING_RECIPIENT_EMAIL` | рабочая почта салона | получатель заявок и адрес, куда клиенты отвечают |
| `ADMIN_NOTIFICATION_EMAILS` | Gmail администраторов | внутренние копии заявок: `snaiper1984@gmail.com,ryndenko1982@gmail.com` |
| `GOOGLE_SHARE_EMAIL` | Google/Workspace аккаунты администраторов | доступ к созданным Calendar, Sheets и Drive; можно указывать несколько адресов через запятую |
| `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET` | Microsoft Entra App Registration | постоянный серверный вход в Microsoft Graph |
| `MS_GRAPH_ACCESS_TOKEN` | Microsoft Entra / Graph OAuth | временный fallback для Outlook Email и Teams через Graph |
| `OUTLOOK_SENDER` | Microsoft 365 mailbox | опциональный отправитель для Graph `/users/{sender}/sendMail`; нужен лицензированный mailbox |
| `TEAM_ID`, `TEAM_CHANNEL_ID` | Microsoft Teams / Graph | уведомления команды |
| `TEAMS_WEBHOOK_URL` | Teams Incoming Webhook | быстрый канал уведомлений; нужен существующий Teams channel |
| `RESEND_API_KEY` | Resend dashboard | резервная отправка писем с сайта |
| `SLACK_WEBHOOK_URL` | Slack app webhook | текущий fallback-канал уведомлений |
| `GOOGLE_SHEETS_WEBHOOK_URL` | ваш backend/service gateway | fallback-запись в Google Sheets |
| `GOOGLE_DRIVE_UPLOAD_WEBHOOK_URL` | ваш backend/service gateway | fallback-загрузка файлов в Google Drive |
| `PAYMENT_PROVIDER_KEY` | Stripe/PayPal dashboard | TODO для будущей предоплаты |

Для локальной проверки Cloudflare Functions используйте `.dev.vars` по образцу `.dev.vars.example`, затем запускайте:

```bash
npm run dev:cf
```

Для первичной настройки Google OAuth после скачивания Desktop app JSON из Google Auth Platform:

```bash
npm run google:setup-platform -- --salon-email info@hundesalon-nika.com --share-email snaiper1984@gmail.com,ryndenko1982@gmail.com
```

Скрипт создаёт Calendar, Sheet и Drive-папку, шарит их на оба админ-адреса, ставит Cloudflare secrets для Production/Preview и не выводит OAuth secrets в консоль.

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

**HUNDESALON NIKA**
- 📍 Лейпциг, Германия
- 📧 [contact@hundesalon-nika.com](mailto:contact@hundesalon-nika.com)
- 📱 Онлайн-бронирование доступно на сайте

---

## 📄 Лицензия

© 2024 HUNDESALON NIKA. Все права защищены.

**Статус проекта**: ✅ **ГОТОВ К ПРОДАКШЕНУ**

---

*Разработано с ❤️ для любителей домашних животных*
