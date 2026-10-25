# Изоляция preview

Production использует D1 `nika-db` (`b95aa18e-fca6-408b-91f9-8e262b6acf41`).
Preview использует отдельную `nika-db-preview` (`6df5c8b1-6f8d-4ff6-851e-d7f149c31009`).
Обе привязки явно указаны в `wrangler.toml`; `preview_database_id` также относится к тестовой базе.

В Cloudflare preview отключены уведомления и онлайн-платежи. Google OAuth,
рабочие Sheet/Calendar/Drive bindings и прежние gateway/email credentials удалены
из preview-конфигурации. Production secrets не менялись. Preview не должен
обращаться к данным клиентов или отправлять настоящие уведомления.

Для применения миграций к тестовой базе:

```powershell
npx wrangler d1 migrations apply nika-db-preview --remote --env preview
```

Проверяйте UUID в выводе команды до выполнения. Не используйте production-базу
для фикстур и конкурентных тестов. Наличие локальной конфигурации не доказывает
привязку опубликованного deployment: её отдельно проверяют через Cloudflare API.

Миграции `0007`–`0009` добавляют профиль сессии, квоты и технический журнал доставки.
Перед production-миграциями нужна проверенная зашифрованная копия D1 и пробное
восстановление в отдельной SQLite. Сначала примените и проверьте миграции в preview.
