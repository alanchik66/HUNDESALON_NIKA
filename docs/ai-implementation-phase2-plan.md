# HUNDESALON_NIKA — Фаза 2 План (3 июня 2026)

## 🚀 Фаза 2: Staging & Production Credits

**Дата начала**: 3 июня 2026, 22:45 UTC  
**Статус**: IN PROGRESS  
**Разработчик**: AI Agent  

---

## 📋 Чек-лист Фазы 2

### 1. ⚠️ OpenRouter Account - ТРЕБУЕТСЯ ДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ

**Статус**: ⏳ Ожидание  
**Приоритет**: 🔴 КРИТИЧНЫЙ

#### Вариант A: Пополнить free account (рекомендуется)
1. Перейти на https://openrouter.ai/credits
2. Нажать "Add Credits" или "Upgrade"
3. Пополнить баланс на $5-10 (достаточно для тестирования)
4. Скопировать API key из https://openrouter.ai/keys

#### Вариант B: Создать платный аккаунт
1. Перейти на https://openrouter.ai
2. Нажать "Sign Up" (если еще не зарегистрирован)
3. Добавить платежные реквизиты
4. Создать API key
5. Скопировать ключ

#### Вариант C: Использовать fallback модель
- Google Gemini 2.0 Flash (обычно бесплатный или дешевый)
- OpenRouter поддерживает множество бесплатных моделей

**Что делать после**:
```
Скопировать новый OPENROUTER_API_KEY
    ↓
Отправить ключ пользователю для добавления в Cursor Dashboard
    ↓
Обновить в Cursor Cloud Agents → Secrets → OPENROUTER_API_KEY
    ↓
Перезагрузить npm run dev:cf
```

---

### 2. 🔐 Cursor Cloud Secrets Update - ОЖИДАЕТСЯ

**Статус**: ⏳ Ожидание пользователя  
**URL**: https://cursor.com/dashboard/cloud-agents

**Шаги**:
1. Откройте Cursor Dashboard
2. Перейдите в Cloud Agents → Secrets
3. Найдите `OPENROUTER_API_KEY`
4. Обновите значение новым API key
5. Нажмите Save

---

### 3. 🔄 Dev-сервер Restart - ГОТОВО К ВЫПОЛНЕНИЮ

**Статус**: ⏳ Ожидание  
**Команда**:
```bash
# Остановить текущий сервер (Ctrl+C в терминале)
# Затем перезапустить:
npm run dev:cf
```

**После перезапуска**:
```bash
# Проверить, что API доступен
curl -X POST http://localhost:8788/seo-generate \
  -H "Content-Type: application/json" \
  -d '{"url":"/de/index.html","locale":"de","pageName":"Test"}'
```

---

### 4. 🧪 Smoke Tests - ГОТОВО К ВЫПОЛНЕНИЮ

После успешного перезапуска dev-сервера с новыми credentials:

#### Test 1: German (основной язык)
```json
POST /seo-generate
{
  "url": "/de/index.html",
  "locale": "de",
  "pageName": "HUNDESALON_NIKA Startseite"
}
```

**Ожидаемый результат**:
```json
{
  "success": true,
  "locale": "de",
  "title": "Hundesalon in Leipzig - Professionelle Hundepflege...",
  "description": "Professionelle Hundepflege in Leipzig...",
  "keywords": ["hundepflege", "grooming", ...],
  "cost": 0.0XX
}
```

#### Test 2: Russian
```json
POST /seo-generate
{
  "url": "/ru/index.html",
  "locale": "ru",
  "pageName": "Груминг-салон в Лейпциге"
}
```

#### Test 3: English
```json
POST /seo-generate
{
  "url": "/en/index.html",
  "locale": "en",
  "pageName": "Grooming Salon in Leipzig"
}
```

#### Test 4: Ukrainian
```json
POST /seo-generate
{
  "url": "/uk/index.html",
  "locale": "uk",
  "pageName": "Груміння салон у Лейпцигу"
}
```

---

### 5. 💰 Cost Analysis - ГОТОВО К ВЫПОЛНЕНИЮ

После успешных smoke tests:

1. **Документировать costs**:
   - Стоимость за запрос для каждого языка
   - Время ответа для каждого запроса
   - Количество токенов per request

2. **Рассчитать месячные расходы**:
   ```
   Cost per SEO page: $0.005-0.01 (примерно)
   Количество страниц: ~50
   Обновления в месяц: 3-4 раза
   
   Месячный бюджет: $50-100 (в рамках лимита)
   ```

3. **Настроить rate limiting**:
   - Max 10 req/min per IP
   - Max 100 req/day total
   - Cost monitoring alerts при >$40/месяц

---

### 6. 📊 Quality Assessment - ГОТОВО К ВЫПОЛНЕНИЮ

#### Criterium 1: Title Quality
- [ ] Инклюдит название сайта ✓
- [ ] Инклюдит целевые ключевые слова ✓
- [ ] Длина 50-60 символов (оптимально для SERP) ✓

#### Criterium 2: Description Quality
- [ ] Инклюдит call-to-action ✓
- [ ] Длина 155-160 символов (оптимально для SERP) ✓
- [ ] Читаемо и профессионально ✓

#### Criterium 3: Language Quality
- [ ] Нет очевидных ошибок перевода ✓
- [ ] Сохранено значение оригинального текста ✓
- [ ] Локализировано для целевого рынка ✓

#### Criterium 4: Performance
- [ ] Response time < 500ms ✓
- [ ] Availability 99%+ ✓
- [ ] No rate limit errors ✓

---

### 7. 🎯 Success Criteria для Фазы 2

- [x] Phase 1 passed (local testing)
- [ ] OpenRouter credentials updated
- [ ] Dev-сервер перезапущен с новыми credits
- [ ] 4 smoke tests passed (all languages)
- [ ] Cost < $1 per test batch
- [ ] Quality score >= 4/5 manual review
- [ ] Ready for Phase 3 partial production

---

## 📞 Следующие шаги

### Для пользователя:
1. Получить/пополнить OpenRouter account
2. Отправить новый API key
3. Добавить в Cursor Cloud Secrets

### Для AI Agent (после обновления credentials):
1. Перезапустить npm run dev:cf
2. Выполнить 4 smoke tests
3. Документировать costs и quality
4. Подготовить Phase 3 (partial production 10%)

---

**Следующая фаза**: Phase 3 - Partial Production (10%) на День 3

---

**Дата создания**: 3 июня 2026, 22:45 UTC  
**Статус документа**: ACTIVE - AWAITING USER ACTION
