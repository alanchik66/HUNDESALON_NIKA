# Полное руководство по настройке Google Ads для HUNDESALON NIKA

**Аккаунт:** CID 530-092-3191  
**Бизнес:** Груминг-салон для собак в Лейпциге  
**Сайт:** https://hundesalon-nika.com  
**Цель:** Запись на услуги груминга

---

## 1. КОНВЕРСИОННОЕ ОТСЛЕЖИВАНИЕ (СНАЧАЛА САЙТ)

### Что отслеживаем:
- **Основная конверсия:** Запись на услугу через форму
- **Вторичные конверсии:** Клик на телефон, клик на WhatsApp, просмотр страницы контактов

### Код отслеживания:
Установите на все страницы сайта перед закрывающим `</head>`:

```html
<!-- Google Ads Conversion Tracking -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-CONVERSION_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-CONVERSION_ID');
</script>
```

### Отслеживание записи на услугу:
При успешной отправке формы:

```javascript
gtag('event', 'conversion', {
    'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL',
    'value': 50.00,
    'currency': 'EUR'
});
```

---

## 2. СТРУКТУРА КАМПАНИИ

### Тип кампании:
- **Тип:** Search (Поиск)
- **Подтип:** Website visits (Посещения сайта)
- **Цель:** Leads (Лиды)

### Бюджет:
- **Дневной бюджет:** 20-50 EUR (начинайте с 20 EUR)
- **Стратегия ставок:** Maximize Clicks (Максимизировать клики) с лимитом CPC

### Таргетинг:
- **Местоположение:** Лейпциг + 50 км вокруг
  - Leipzig, Germany
  - Дополнительно: Halle, Dessau, Wittenberg, Borna
- **Языки:** Немецкий (основной), Русский, Английский
- **Устройства:** Все (с приоритетом мобильных)

---

## 3. КЛЮЧЕВЫЕ СЛОВА

### Группа 1: Основные услуги (высокий приоритет)
```
Hundesalon Leipzig
Hund grooming Leipzig
Hund toaletten Leipzig
Hundesalon
Hund styliste Leipzig
Hundeschere Leipzig
Hund baden Leipzig
Hund trimmen Leipzig
```

### Группа 2: Конкретные услуги
```
Hund schneiden Leipzig
Hund waschen Leipzig
Hund pflege Leipzig
Hund friseur Leipzig
Hundesalon preis Leipzig
```

### Группа 3: Породы (если специализируетесь)
```
Golden Retriever grooming Leipzig
Labrador grooming Leipzig
Pudel pflege Leipzig
Hundebürsten Leipzig
```

### Минус-слова (уже настроены на уровне аккаунта):
```
decken lassen, deckrüde, diy, download, ehrenamt, franchise, free, 
gehalt, gratis, job, jobs, kostenlos, lizenz kaufen, pdf, selber machen, 
spenden, stelle, stellenangebot, tierheim, tutorial, welpe kaufen, 
welpen kaufen, wikipedia, youtube
```

---

## 4. ТЕКСТЫ ОБЪЯВЛЕНИЙ

### Объявление 1 (Основное):
**Заголовок 1:** Hundesalon Nika Leipzig  
**Заголовок 2:** Профессиональer Grooming  
**Заголовок 3:** Jetzt Termin vereinbaren  
**Описание 1:** Ihr Hund verdient die beste Pflege. Professionelle Styling-Services in Leipzig.  
**Описание 2:** Termine online buchen. faire Preise & liebevolle Betreuung.  

### Объявление 2 (Акцент на качестве):
**Заголовок 1:** Grooming für Ihren Hund  
**Заголовок 2:** Leipzig & Umgebung  
**Заголовок 3:** Termine noch heute  
**Описание 1:** Erleben Sie professionelle Hundepflege in entspannter Atmosphäre.  
**Описание 2:** Baden, Schneiden, Pflegen - alles für Ihren Vierbeiner.  

### Объявление 3 (Русскоязычное):
**Заголовок 1:** Груминг салон Лейпциг  
**Заголовок 2:** Hundesalon Nika  
**Заголовок 3:** Запись онлайн  
**Описание 1:** Профессиональный уход за вашей собакой в Лейпциге.  
**Описание 2:** Стрижка, купание, уход. Запись через сайт.  

---

## 5. РАСШИРЕНИЯ ОБЪЯВЛЕНИЙ

### Sitelink Extensions (Ссылки на сайте):
- **Termin buchen** → https://hundesalon-nika.com/de/#booking
- **Unsere Services** → https://hundesalon-nika.com/de/#services
- **Preise** → https://hundesalon-nika.com/de/#pricing
- **Kontakt** → https://hundesalon-nika.com/de/#contact

### Call Extensions (Звонки):
- **Номер:** Ваш телефон из контактов
- **Время:** Рабочие часы салона

### Location Extensions (Местоположение):
- Привязка к Google My Business
- Адрес салона в Лейпциге

### Callout Extensions (Краткие фразы):
- "Professionelle Pflege"
- "Liebevolle Betreuung"
- "Faire Preise"
- "Online Buchung"

---

## 6. ПОСАДОЧНЫЕ СТРАНИЦЫ

### Основная:
- **URL:** https://hundesalon-nika.com/de/
- **Соответствие:** Немецкий язык, форма записи

### Для немецких запросов:
- https://hundesalon-nika.com/de/

### Для русских запросов:
- https://hundesalon-nika.com/ru/

### Для английских запросов:
- https://hundesalon-nika.com/en/

---

## 7. НАСТРОЙКИ АУДИЕНЦИЙ

### Remarketing (если есть много посетителей):
- Создайте аудитории на основе посещения сайта
- Настройте кампанию для повторного привлечения

### In-Market Audiences:
- "Pet grooming services"
- "Pet care products"
- "Veterinary services"

### Similar Audiences:
- На основе текущих клиентов

---

## 8. РАСПИСАНИЕ ПОКАЗОВ

### Время показов:
- **Дни:** Пн-Сб (рабочие дни салона)
- **Часы:** 08:00 - 20:00 (когда люди могут записаться)

### Настройка:
- Use ad scheduling (Использовать расписание)
- Показывать только в рабочие часы

---

## 9. БИД СТРАТЕГИЯ

### Начальная стадия (первые 2 недели):
- **Стратегия:** Maximize Clicks
- **CPC лимит:** 0.50 - 1.00 EUR
- **Цель:** Сбор данных и кликов

### После сбора данных (через 2 недели):
- **Стратегия:** Maximize Conversions
- **Целевая стоимость конверсии:** 10-15 EUR
- **Цель:** Оптимизация под записи

### Продвинутая стадия (через месяц):
- **Стратегия:** Target CPA
- **Целевой CPA:** 15-20 EUR
- **Цель:** Стабильная стоимость записи

---

## 10. АНАЛИТИКА И ОПТИМИЗАЦИЯ

### Ключевые метрики:
- **CTR (Click-Through Rate):** > 3%
- **CPC (Cost Per Click):** < 1.00 EUR
- **Conversion Rate:** > 5%
- **Cost Per Conversion:** < 20 EUR

### Еженедельные проверки:
1. **Понедельник:** Проверка бюджета и затрат
2. **Среда:** Анализ ключевых слов (добавить/удалить)
3. **Пятница:** Проверка текстов объявлений (A/B тестирование)

### Ежемесячные оптимизации:
1. **Поиск запросов:** Добавление новых минус-слов
2. **Тексты объявлений:** Тестирование новых вариантов
3. **Ставки:** Корректировка на основе данных
4. **Аудитории:** Настройка ремаркетинга

---

## 11. РЕКОМЕНДАЦИИ ПО КОНТЕНТУ

### Для улучшения качества объявления:
1. **Ad Relevance:** Тексты должны соответствовать запросам
2. **Landing Page Experience:** Быстрая загрузка, адаптивность
3. **Expected CTR:** Привлекательные заголовки

### Quality Score улучшения:
- Релевантность ключевых слов и текстов
- Качество посадочной страницы
- История CTR

---

## 12. БЕЗОПАСНОСТЬ И СОБЛЮДЕНИЕ ПРАВИЛ

### Проверьте:
- **Рекламная политика Google Ads** (нет запрещённых товаров/услуг)
- **Защита персональных данных** (GDPR согласие)
- **Проверка на мошенничество** (избегайте подозрительной активности)

### Рекомендации:
- Не копируйте тексты конкурентов
- Используйте уникальные предложения
- Следите за показами на нерелевантные запросы

---

## 13. ЗАПУСК КАМПАНИИ

### Чек-лист перед запуском:
- [ ] Конверсионное отслеживание установлено
- [ ] Все ключевые слова добавлены
- [ ] Минус-слова настроены
- [ ] Тексты объявлений написаны
- [ ] Расширения добавлены
- [ ] Бюджет установлен
- [ ] Таргетинг настроен
- [ ] Расписание показов установлено
- [ ] Посадочные страницы проверены
- [ ] Мобильная версия проверена

### Запуск:
1. Нажмите "Enable" (Включить)
2. Следите за первыми показами в течение 24 часов
3. Проверяйте поиск запросов каждый день первые 3 дня

---

## 14. ПОДДЕРЖКА И ТРАБЛШУТИНГ

### Если нет показов:
- Проверьте статус кампании (Eligible)
- Проверьте бюджет
- Проверьте ставки (не слишком низкие)
- Проверьте качество объявления

### Если высокий CPC:
- Улучшите Quality Score
- Уменьшите ставки на низкокачественные слова
- Добавьте минус-слова

### Если нет конверсий:
- Проверьте посадочную страницу
- Улучшите форму записи
- Проверьте конверсионное отслеживание
- Уменьшите ставки на дорогие клики

---

## 15. КОНТАКТЫ И ПОДДЕРЖКА

### Google Ads Support:
- https://support.google.com/google-ads
- Чат доступен в интерфейсе Google Ads

### Для HUNDESALON NIKA:
- При возникновении проблем проверяйте поиск запросы
- Оптимизируйте минус-слова
- Тестируйте разные тексты объявлений

---

**Документ обновлён:** 2026-07-21  
**Аккаунт Google Ads:** CID 530-092-3191  
**Проект:** HUNDESALON NIKA