# Google Ads — полная настройка аккаунта HUNDESALON NIKA

- **Account:** HUNDESALON NIKA (CID `530-092-3191` / ocid `8415382946`)
- **Login:** ryndenko1982@gmail.com
- **Updated:** 2026-07-19 (audit) · live recheck 2026-07-23 15:30 Europe/Berlin

## Текущее состояние (live recheck 2026-07-23)

| Пункт | Значение |
|--------|----------|
| Аккаунт | **Активно** |
| Идентификация | Профиль `ryndenko1982@gmail.com`, 2FA включена |
| Баннеров блокировки | нет |
| Уведомления | 4 (нужно открыть вручную) |

## Жёсткий лимит бюджета: ≤ 10 €/месяц

| Правило | Значение |
|--------|----------|
| Месячный потолок | **≤ 10,00 €** |
| Дневной бюджет PMax | **0,33 €/день** (≈ 10 € / 30,4) |
<<<<<<< Updated upstream
| Кампании | Только **1** (PMax), статус **Активна** |
| Новые кампании / Search | Не запускать, пока лимит 10 €/мес |
| Автоприменение рекомендаций | **OFF** (0/7 + 0/14) — иначе Google поднимет бюджет |

Google: фактический дневной расход может колебаться, но **месячный потолок ≈ дни × дневной бюджет**. При 0,33 €/день это ~10 €/мес.

### Конфликт с промо €400

- Код `9HNDM-AMMMF-DJ6D` активирован; нужно потратить **400 € до 17 сент. 2026**, чтобы получить ещё 400 €.
- При **10 €/мес** это **невыполнимо** (~40 месяцев). Промо сохранено, но при текущем лимите бонус не заработать.
- Чтобы получить промо — нужно отдельно поднять бюджет (осознанное решение владельца).

## Кампания PMax `HUNDESALON_NIKA`

| Поле | Значение |
|------|----------|
| campaignId | `24051075076` |
| Asset group | `6731829821` (Группа объектов 1) |
<<<<<<< Updated upstream
| Статус | **Активна** (live recheck 2026-07-23). Approval: `Допущено (с ограничениями)` |
| Бюджет | **0,33 €/день** |
| Стратегия | Максимальная ценность конверсий |
| Гео | **Лейпциг + Саксония** (Бавария `91522` удалена 2026-07-19) |
| Языки | Немецкий, английский + ещё 2 |
| Final URL | `https://hundesalon-nika.com/de/` |
| Brand guidelines | **HUNDESALON NIKA**, 4 логотипа, цвета `#c6a15b` / `#9e7a46` |
| Ad quality | **Среднее** — не хватает видео, sitelinks, тем поиска, сигналов аудиторий |
| EN grooming в объектах | **нет** |
| Ещё открыто | **Качество «Плохое»:** тексты OK (15 HL / 5 long / 5 desc); не хватает изображений (landscape) + видео; нет тем поиска и сигналов аудитории. Статус **«Не допущено»** при паузе = норма (объявления не крутятся), не policy. |

## Ручной чек-лист (~15 минут)

### 1. Asset group — видео
`https://ads.google.com/aw/assetgroup/edit?campaignId=24051075076&assetgroupId=6731829821`  
→ `Видео` → `Загрузить с компьютера` → выбрать `assets/video/ads/hundesalon-nika-promo.mp4` → сохранить.

### 2. Asset group — изображения
Там же → `Изображения` → `Изменить` → добавить landscape-фото из `assets/images/ads/work/` → сохранить.

### 3. Asset group — sitelinks
Там же → `Дополнительные ссылки` → заполнить `Дополнительная ссылка 1..6`:

| Заголовок | URL | Описание |
|-----------|-----|----------|
| Termin buchen | /de/#booking | Online-Buchung für Hundesalon in Leipzig |
| Leipzig Tierpflege | /de/ | Hundefriseur und Fellpflege in Leipzig |
| Hundepflege Leipzig | /de/ | Moderne Tierpflege für Hunde und Katzen |
| Fellpflege Nika | /de/ | Ruhige Boutique-Pflege in Leipzig |

→ `Сохранить`.

### 4. Asset group — темы поиска
ВAsset group editor → `Темы поиска` → добавить: `Hundefriseur Leipzig`, `Hundepflege Leipzig`.

### 5. Аудитории
`https://ads.google.com/aw/audiences?ocid=8415382946`  
→ `Изменить сегменты аудитории` → добавить сигналы → `Сохранить`.

### 6. Конверсии
`https://ads.google.com/aw/conversions?src=ads_onebox&ocid=8415382946&__u=7095037238&__c=5110651154&authuser=0&subid=ww-ww-xs-ip_OB_Fix_account`

- `Покупка` → `Изменить цель` → назначить основное действие-конверсию или оставить без оптимизации.
- `Отправка формы`, `Регистрация`, `Телефон` → `Изменить цель` → проверить, что источник `website` и теги присвоены.

### 7. Сохранить и выйти
В asset group editor → `Сохранить`. В конверсиях/аудиториях → `Сохранить`.

## Администратор / настройки аккаунта

| Раздел | Статус |
|--------|--------|
| Название | HUNDESALON NIKA |
| Часовой пояс | GMT+02:00 Central Europe |
| GDPR primary / DPO | HUNDESALON NIKA, info@hundesalon-nika.com, Germany, 01517 2450988, Untere Eichstädtstraße 38, 04299 Leipzig |
| EU representative | Пусто (бизнес в DE) |
| Auto-tagging | ON |
| Call reporting | ON; recording / forwarding OFF |
| Account negatives | 24 broad (см. `docs/ads-account-negatives.md`) |
| Auto-apply recommendations | OFF |
| High-engagement app ads | OFF |
| Conversion-based customer lists | OFF |

## Доступ и безопасность

| Пункт | Значение |
|-------|----------|
| Пользователи | 1 админ: ryndenko1982@gmail.com |
| Управляющие аккаунты | Нет |
| 2FA (требование Ads) | **Включена** — обязательно с **25 июл. 2026** |
| Разрешённые домены | Без ограничений |

## Уведомления (`/aw/emailsubscriptions/users`)

Критичные темы оставлены на «Получать все»: платежи, безопасность, отклонение объявлений, обслуживание кампаний, подтверждение личности, отчёты об эффективности.

Маркетинговые темы в UI часто требуют подтверждения email (`*`) — при возможности отключить вручную после verify email.

## Оплата и промо

| Пункт | Значение |
|-------|----------|
| Payments profile (billing) | `3526-0201-4415-6052` / alias HUNDESALON NIKA |
| Плательщик | Anna Ryndenko |
| Способ оплаты | BE••7290 (автоплатежи). статус `Активно` (live recheck 2026-07-23) |
| Баланс | 0,00 € |
| Промо | `9HNDM-AMMMF-DJ6D` — активировано 19.07.2026; условие до **17.09.2026**; нужно потратить 400 € за 60 дней после получения |
| Смена плательщика | **Не делать** (риск для промо) |

## Policy / identity

| Пункт | Статус |
|-------|--------|
| Публичное имя | HUNDESALON NIKA / Germany |
| Identity profile | `9656-6672-9574` |
| Client verification | **Одобрено** (баннера блокировки нет, аккаунт Активен) |
| EU political ads | Нет |
| Funding disclosure | Anna Ryndenko |
| Уведомления | 4 в UI — требуется проверить вручную в `/aw/overview` |

## Цели / конверсии

<<<<<<< Updated upstream
- Основная цель аккаунта: звонки (потенциальный клиент по телефону).
- В аккаунте настроены: телефон, форма, регистрация. Основным действием конверсии для цели `покупка` пока не назначено (рекомендация Google есть в UI).
- На сайте `analytics.js` → gtag после cookie consent; `ad_storage: granted` в консенте. Функция `hundesalonTrackAdsConversion()` уже есть. Без ошибок, связанных с Ads-конверсиями в коде.

## Очередь ручных действий в UI

См. concise-runbook: `docs/ads-manual-runbook.md`

1. Отключи adblock для `ads.google.com`.
2. Добавь видео и изображения в asset group.
3. Добавь 4–6 sitelinks.
4. Добавь темы поиска: `Hundefriseur Leipzig`, `Hundepflege Leipzig`.
5. Добавь audience signals в `/aw/audiences`.
6. В `/aw/conversions` проверь/назначь primary action для `Покупка`; убедись, что `Отправка формы`, `Регистрация`, `Телефон` имеют источник `website` и теги.
7. Сохрани изменения.

## Ссылки

- Кампании: https://ads.google.com/aw/campaigns?ocid=8415382946
- Настройки аккаунта: https://ads.google.com/aw/settings/account?ocid=8415382946
- Местоположения: https://ads.google.com/aw/locations?ocid=8415382946&campaignId=24051075076
- Безопасность: https://ads.google.com/aw/security/settings?ocid=8415382946
- Промо: https://ads.google.com/aw/billing/promotions?ocid=8415382946
- Минус-слова: `docs/ads-account-negatives.md`
