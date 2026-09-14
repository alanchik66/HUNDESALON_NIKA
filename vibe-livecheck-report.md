# 🌐 vibe-audit livecheck: домены HUNDESALON_NIKA

## Итог

Проверено 2 домена — 🔴 0 / 🟡 0 / 🔵 по 1 информационному замечанию.

_Только внешние GET-запросы. Это не пентест — внутреннюю логику так не проверить._

## https://hundesalon-nika.com

### 🔵 Основной домен: заголовок server раскрывает стек cloudflare

- URL: https://hundesalon-nika.com
- Как чинить: Скрой версию сервера/фреймворка — она подсказывает известные уязвимости.

## https://www.hundesalon-nika.com

- Результат: `301 Moved Permanently` → `https://hundesalon-nika.com/`.
- Защитные заголовки присутствуют, включая HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` и `Permissions-Policy`.

### 🔵 Домен www: заголовок server раскрывает стек cloudflare

- URL: https://www.hundesalon-nika.com
- Как чинить: заголовок формируется Cloudflare; он раскрывает только используемый edge-провайдер, без версии программного обеспечения.
