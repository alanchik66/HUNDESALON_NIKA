# Operations

## Coverage

- Locales: `de`, `en`, `ru`, `uk`
- Catalog and pricing
- QA and responsive checks
- Release and deployment checks
- External accounts and integrations

## Standard review items

- Content correctness per locale
- Duplicate catalog entries
- Phone, email, and contact consistency
- Desktop and mobile layout integrity
- Evidence of live verification after deploy

## Codex workflow

- [[Codex_Control_Center]]
- [[Codex_Model_Routing]]
- [[01_Projects/HUNDESALON_NIKA/Tasks/README]]
- Keep model choice aligned with task shape.
- Mirror durable routing changes into [[04_Decisions/2026-08-27-Model_Routing_and_Obsidian_Workflow]].

## Verified knowledge capture

- Во время относящейся к проекту работы самостоятельно сохраняй новые проверенные научные и технические знания в существующей тематической справке `03_Resources/`; новую заметку создавай для самостоятельной темы, не дублируя уже записанные факты.
- Для утверждений указывай первичный источник и дату проверки. Разделяй реальные наблюдения, приблизительную модель, расчёт и художественную настройку UI; устаревшую реализацию отмечай как историческую.
- Перед повторным использованием проверяй меняющиеся сведения. Противоречие разрешай по источникам и записывай причину уточнения, не превращая предположение в подтверждённый факт.
- Связывай справку с проектным hub и релевантным кодом/проверками. Общий каталог [[03_Resources/Resources]] и Recent changes в [[Dashboard]] используют Dataview и подхватывают новые resource notes автоматически.
- Пополнение знаний выполняется при активной работе агента над проектом. Dataview, Templater и Git/Graphify обеспечивают свои настроенные индексы, шаблоны и сохранение; они не являются самостоятельным фоновым научным исследователем.
- Не включай внутренние научные справки в клиентскую базу SendPulse/OpenAI через `knowledge:sync` без отдельного запроса. Не сохраняй личную точную геопозицию, секреты и частное состояние браузера в vault.
- Для астрономии и погодной сцены используй [[03_Resources/Astronomy_and_Weather_Visualization]]; выполнение требований проверяй по текущему коду и browser QA.
