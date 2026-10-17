# devin-telegram

Локальный защищённый шлюз: Telegram → облачная сессия Devin через официальный REST API v1 (`https://api.devin.ai`).

Схема: `Telegram → bot.mjs (long polling) → Devin API v1 → ответ сессии → Telegram`.

## Безопасность

- Команды выполняет только владелец — `TELEGRAM_OWNER_ID` (allowlist по Telegram user ID).
- Токены живут в `.devin/telegram-bot.env`, который в `.gitignore`. В Git не попадают.
- `/cancel` останавливает сессию Devin и требует явного `/cancel confirm`.
- Любые разрушительные действия внутри сессии (push, deploy, удаление) по-прежнему подтверждаются в самой сессии Devin.

## Настройка

1. В Telegram откройте `@BotFather` → `/newbot` → получите токен.
2. В Devin откройте **Settings → Devin API → API keys (legacy) → Personal API key → View key** и скопируйте ключ `apk_user_...`. Важно: API v1 принимает только персональный ключ — токены сервисных пользователей (вкладка Service users) отклоняются с `403 Unauthorized`.
3. Скопируйте конфиг:

   ```powershell
   Copy-Item integrations\devin-telegram\.env.example .devin\telegram-bot.env
   ```

4. Заполните `.devin/telegram-bot.env`:

   | Переменная | Значение |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | токен от BotFather |
   | `TELEGRAM_OWNER_ID` | ваш числовой Telegram user ID (можно оставить пустым — см. ниже) |
   | `DEVIN_API_KEY` | персональный ключ `apk_user_...` (см. шаг 2) |
   | `DEVIN_SESSION_ID` | опционально: `devin-...` для привязки существующей сессии |

5. Узнать `TELEGRAM_OWNER_ID`: оставьте поле пустым, запустите бота, отправьте ему `/whoami` — он вернёт ваш ID. Впишите его и перезапустите.

## Запуск

```powershell
node --env-file=.devin/telegram-bot.env integrations/devin-telegram/bot.mjs
```

или из папки интеграции:

```powershell
cd integrations\devin-telegram
npm start
```

## Команды бота

- `/status` — состояние шлюза и привязанной сессии.
- `/new` — следующий запрос создаст новую облачную сессию.
- `/bind devin-...` или `/bind https://app.devin.ai/sessions/devin-...` — привязать существующую сессию.
- `/cancel` → `/cancel confirm` — остановить привязанную сессию.
- `/whoami` — показать Telegram user ID.
- Любой другой текст отправляется в привязанную сессию Devin; ответы пересылаются обратно (длинные — частями).

Привязка сессии сохраняется в `.devin/telegram-bot.state.json` и переживает перезапуск бота.

## Проверки

```powershell
node --check integrations/devin-telegram/bot.mjs
node --test integrations/devin-telegram/bot.test.mjs
```
