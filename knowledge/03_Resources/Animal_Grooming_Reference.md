# HUNDESALON_NIKA: предметный справочник по безопасному грумингу животных

**Назначение:** внутренний knowledge source для AI-помощника HUNDESALON_NIKA и команды салона.

**Охват каталога:** собаки, кошки, морские свинки, кролики.

**Дата проверки источников:** 2026-08-31.

**Статус:** справочник по уходу, благополучию и безопасной коммуникации. Это не ветеринарный протокол, не диагноз, не схема лечения и не прайс-лист.

## 1. Базовые правила для AI-помощника

1. Благополучие животного важнее завершения косметической процедуры. При боли, выраженном страхе, ухудшении дыхания, травме или другом красном флаге помощник должен рекомендовать остановить процедуру и выбрать безопасную маршрутизацию, а не убеждать продолжать. Принцип минимально стрессового обращения поддерживают [WSAVA Animal Welfare Guidelines](https://wsava.org/wp-content/uploads/2019/12/WSAVA-Animal-Welfare-Guidelines-2018.pdf) и [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).
2. Название породы описывает ожидаемый диапазон признаков, но не заменяет оценку конкретного животного. Тип и состояние шерсти, размер, возраст, здоровье, переносимость прикосновений и предыдущий опыт могут отличаться даже внутри одной породы. Для собак породные сведения проверяются по текущей [FCI Breeds Nomenclature](https://www.fci.be/en/Nomenclature/) и конкретному стандарту породы; FCI отдельно показывает разновидности по размеру, шерсти и окрасу в [Breeds with Varieties](https://www.fci.be/en/nomenclature/varietes.aspx).
3. Справочник не создаёт и не изменяет услуги, цены, скидки или коммерческие обещания. По услугам и ценам бот использует только актуальный детальный каталог сайта. Если процедура отсутствует в каталоге, бот не обещает её и передаёт вопрос сотруднику салона.
4. Бот отвечает на активной локали клиента. На `ru` весь клиентский ответ и названия пород должны быть на русском, на `de` на немецком, на `en` на английском, на `uk` на украинском. Нельзя смешивать языки, подставлять транслитерацию или показывать рядом названия породы из других локалей. Для немецких и английских официальных наименований собак опорой служат локализованные стандарты FCI; в интерфейсе всегда используется каноническое название из соответствующей локали каталога сайта. [FCI сообщает, что стандарты доступны на официальных рабочих языках, включая немецкий и английский](https://www.fci.be/EN/Launch-of-our-Mobile-App-FCI-Breeds-Nomenclature-3598.html).
5. Если локализованное название породы или точная разновидность не определены, бот не переводит их предположительно. Он уточняет породу, разновидность шерсти и размер либо передаёт подбор сотруднику салона.
6. Бот не выдаёт медицинские предположения за факт. Он может нейтрально описать наблюдаемый признак, например «покраснение», «выделения», «болезненность при касании», но не называть заболевание или его причину. Оценка боли у собак и кошек требует совместного учёта поведения, позы и реакции на прикосновение, а диагностическое заключение относится к ветеринарной компетенции. [AAHA Pain Assessment Principles](https://www.aaha.org/resources/2022-aaha-pain-management-guidelines-for-dogs-and-cats/guiding-principles-of-pain-assessment/).
7. Бот никогда не рекомендует лекарства, седативные средства, противопаразитарные препараты, лечебные шампуни, ушные или глазные препараты и не указывает дозировки. Фармакологическую подготовку назначает только ветеринар после оценки животного. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).

## 2. Иерархия решений

При ответе или подготовке процедуры используется следующий порядок:

1. **Безопасность и красные флаги:** приоритет над косметическим результатом и плановой записью. [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/).
2. **Фактическое состояние животного:** дыхание, поведение, движения, кожа, глаза, уши, лапы, когти, шерсть и задняя гигиеническая зона оцениваются до начала работы без постановки диагноза. Изменения поведения, позы и движений могут указывать на боль или неблагополучие. [AAHA Pain Assessment Principles](https://www.aaha.org/resources/2022-aaha-pain-management-guidelines-for-dogs-and-cats/guiding-principles-of-pain-assessment/).
3. **Точная разновидность и тип шерсти:** для собак проверяются FCI-стандарт и разновидность, но итоговый метод ухода выбирается по фактической шерсти. [FCI Breeds with Varieties](https://www.fci.be/en/nomenclature/varietes.aspx).
4. **Категория и индекс сайта:** используются только готовые данные локализованного каталога. Бот не пересчитывает и не переопределяет их на основании общих знаний.
5. **Пожелание клиента:** учитывается только в пределах безопасной, доступной и согласованной услуги.

## 3. Минимальный предгруминговый сбор сведений

До рекомендации бот должен по необходимости уточнить:

- вид животного;
- породу и разновидность шерсти, если они известны;
- возраст;
- актуальный вес или размер, если от него зависит категория;
- длину, плотность, линьку, наличие колтунов и загрязнений;
- переносимость расчёсывания, воды, сушки, машинки, прикосновения к лапам, ушам и морде;
- известные хронические состояния, аллергию или чувствительность кожи, недавнюю операцию или травму, беременность, назначенное ветеринаром ограничение;
- необычные симптомы, снижение аппетита, изменение активности или поведения;
- предыдущий негативный опыт и известные триггеры.

Краткие, предсказуемые контакты и постепенное положительное приучение к касаниям лап, ушей и тела снижают стресс у собак и кошек. [AAHA Preparing Your Pet for a Successful Veterinary Visit](https://www.aaha.org/resources/preparing-your-pet-for-a-successful-veterinary-visit/). Для морских свинок и кроликов как животных-жертв особенно важны медленные движения, низкая рабочая позиция и полноценная поддержка тела. [PDSA: How to Hold a Guinea Pig](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pigs-as-pets), [RSPCA: Handling Rabbits](https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/company/handling).

## 4. Универсальный протокол обращения и стресса

### 4.1. Рабочая среда

- Использовать устойчивую нескользящую поверхность, спокойный голос, плавные движения и только необходимую степень фиксации. Силовая фиксация повышает риск травмы животного и человека. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).
- Давать животному время осмотреться, по возможности сохранять предсказуемый порядок действий, делать короткие паузы и использовать положительное подкрепление, которое безопасно и заранее допустимо для конкретного животного. [Cornell: Grooming and Cooperative Care](https://riney.vet.cornell.edu/member-benefits-health-tips/grooming-cooperative-care-february-2026?hs_amp=true).
- Не наказывать, не повышать голос и не удерживать животное несколькими людьми ради необязательной процедуры. AAHA прямо относит коллективное силовое удержание для подстригания когтей к неподходящим методам. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).

### 4.2. Чтение поведения

WSAVA описывает четыре общих ответа на стресс: попытка уйти, защитная реакция, замирание и смещённые действия. Замирание нельзя принимать за спокойное согласие. [WSAVA Animal Welfare Guidelines, раздел о поведенческих реакциях на стресс](https://wsava.org/wp-content/uploads/2019/12/WSAVA-Animal-Welfare-Guidelines-2018.pdf).

Ранние сигналы для паузы:

- отворачивание, попытка увеличить дистанцию, отдёргивание лапы или тела;
- облизывание губ без еды, зевота не от усталости, частое сканирование помещения;
- напряжение мышц, внезапное замирание, расширенные зрачки, прижатые уши;
- учащённое дыхание, дрожь, попытка спрятаться или вырваться;
- рычание, лай, шипение, удар лапой или попытка укуса.

Эти реакции могут отражать страх, боль или их сочетание; бот не определяет причину, а рекомендует снизить нагрузку, сделать паузу и переоценить безопасность. [WSAVA Animal Welfare Guidelines](https://wsava.org/wp-content/uploads/2019/12/WSAVA-Animal-Welfare-Guidelines-2018.pdf), [AAHA Pain Management Guidelines](https://www.aaha.org/resources/2022-aaha-pain-management-guidelines-for-dogs-and-cats/an-evolving-philosophy-of-pain-management/).

### 4.3. Обязательное прекращение

Процедуру прекращают, если после паузы животное не возвращается ниже стрессового порога, контакт усиливает реакцию, появляется риск падения, укуса, травмы позвоночника или конечностей либо необходима силовая фиксация. Продолжение «любой ценой» противоречит принципу минимально стрессового обращения. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/), [Cornell: Grooming and Cooperative Care](https://riney.vet.cornell.edu/member-benefits-health-tips/grooming-cooperative-care-february-2026?hs_amp=true).

## 5. Собаки

### 5.1. Порода, разновидность, категория и размерный индекс

- FCI-группа отражает происхождение и назначение породы, а не салонный способ ухода. Категории HUNDESALON_NIKA являются практическими груминг-категориями и не должны автоматически выводиться из номера группы FCI. Официальные группы и стандарты опубликованы в [FCI Breeds Nomenclature](https://www.fci.be/en/Nomenclature/).
- У одной породы могут существовать разновидности по размеру и типу шерсти. Например, FCI отдельно ведёт такие признаки в таблице разновидностей; поэтому точная разновидность важнее общего названия породы. [FCI Breeds with Varieties](https://www.fci.be/en/nomenclature/varietes.aspx).
- Для метиса или нераспознанной породы решение основывается на фактическом размере, структуре шерсти, подшёрстке, склонности к колтунам и объёме работы. Бот не приравнивает метиса к похожей породе без уточнения.
- Для короткошёрстной категории размерный индекс `XS`, `S`, `M` или `L` берётся только из канонической записи каталога. Если выбранная порода или её разновидность сопоставлена с `L`, бот показывает и озвучивает только `L`; `XS`, `S` и `M` не должны предлагаться ни после поиска, ни после ручного выбора. То же правило действует для каждого другого индекса.
- Если у записи нет надёжного размерного индекса, бот не выбирает его по внешнему сходству и не показывает все индексы как равнозначные. Он уточняет актуальный вес и размер, затем использует предусмотренное каталогом правило или передаёт выбор сотруднику салона.

### 5.2. Практические типы шерсти

| Тип шерсти | Ожидаемый уход | Ограничения и проверка |
|---|---|---|
| Постоянно растущая, прямая или шелковистая | Послойное расчёсывание и проверка расчёской до кожи, регулярное формирование длины, тщательное промывание и полная сушка. | Не вырывать плотные колтуны и не проводить болезненное расчёсывание. Метод и длина зависят от конкретной шерсти и выбранной услуги. Постоянно растущая шерсть требует регулярного профессионального ухода. [Texas A&M: Brushing Up for Shedding Season](https://vetmed.tamu.edu/news/uncategorized/reduce-dog-shedding/). |
| Кудрявая или шерстистая | Разделение шерсти на небольшие зоны, расчёсывание до кожи, контроль сваливания у ушей, подмышек, паха, лап и мест трения. После мытья нужна полная контролируемая сушка. | Инструмент выбирается по фактической плотности и чувствительности кожи; универсального инструмента для всех типов шерсти нет. [Texas A&M: Brushing Up for Shedding Season](https://vetmed.tamu.edu/news/uncategorized/reduce-dog-shedding/). |
| Двойная шерсть с остевым волосом и подшёрстком | Удаление свободного подшёрстка расчёсыванием и продувом, распутывание без повреждения остевого волоса, тщательная сушка до кожи. | Не предлагать короткое бритьё по умолчанию и не объяснять его «охлаждением». Полное сбривание двойной шерсти обычно не требуется и может изменить отрастание. [Texas A&M: Summer Dog Grooming](https://vetmed.tamu.edu/news/pet-talk/summer-dog-grooming/). |
| Жёсткая шерсть | Определить, предусмотрен ли для породы и состояния шерсти тримминг, стрижка или комбинированный уход; сохранять функциональную текстуру в рамках согласованной услуги. | Не считать всех терьеров одинаковыми: стандарт породы и фактическая разновидность шерсти имеют приоритет. [FCI Breeds Nomenclature](https://www.fci.be/en/Nomenclature/). |
| Короткая гладкая шерсть | Мягкое удаление свободного волоса, щадящее мытьё по необходимости и полная сушка без перегрева. | Агрессивный фурминатор, сильное давление или многократные проходы по одному месту могут раздражать кожу; инструмент должен соответствовать шерсти. Общий принцип индивидуального инструмента подтверждает [Texas A&M: Brushing Up for Shedding Season](https://vetmed.tamu.edu/news/uncategorized/reduce-dog-shedding/). |
| Длинная шерсть с очёсами | Послойное расчёсывание, особый контроль ушей, груди, живота, хвоста, подмышек и лап; удаление свободного подшёрстка без выдёргивания здоровой шерсти. | Влажная плотная шерсть удерживает влагу у кожи, поэтому её необходимо полностью высушить. [Cornell: Hot Spots](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/hot-spots). |
| Шнуровая шерсть | Работать по породному стандарту и сложившейся структуре шнуров; разделять и сушить шнуры полностью, не расчёсывать их как обычную длинную шерсть. | Перед изменением структуры требуется согласование с владельцем и специалистом, знакомым с породой. Особая структура шерсти фиксируется в конкретных стандартах FCI, например [FCI Standard No. 55, Puli](https://www.fci.be/Nomenclature/Standards/055g01-en.pdf). |
| Голая или минимальная шерсть | Визуальный осмотр кожи, очень мягкое очищение только подходящими животному средствами, защита от трения и перегрева. | Не применять инструменты для удаления подшёрстка и не маскировать воспаление косметикой. Любые высыпания, корки, мокнутие или болезненность требуют ветеринарной оценки. [UC Davis Dermatology Fact Sheets](https://www.vetmed.ucdavis.edu/hospital/animal-health-topics/dermatology-fact-sheets). |

### 5.3. Купание, расчёсывание и сушка

- Частота купания индивидуальна. Слишком частое купание может пересушивать и раздражать кожу, поэтому бот не назначает универсальный интервал. [AAHA: Why Does My Pet Shed?](https://www.aaha.org/resources/pets-and-shedding/).
- Используются только средства, предназначенные для соответствующего вида животного и согласованные с известной чувствительностью. Лечебный шампунь не предлагается без ветеринарного назначения. [Texas A&M: Basic Pet Grooming Needs](https://vetmed.tamu.edu/news/pet-talk/basic-grooming/).
- Колтун сначала оценивают по площади, плотности, близости к коже и реакции животного. Болезненное «вычёсывание любой ценой» недопустимо; при скрытой ране, мокнутии, запахе, крови или выраженной боли работа прекращается и рекомендуется ветеринар. [Cornell: Grooming and Cooperative Care](https://riney.vet.cornell.edu/member-benefits-health-tips/grooming-cooperative-care-february-2026?hs_amp=true), [Cornell: Hot Spots](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/hot-spots).
- После мытья шерсть и кожа должны быть полностью высушены без перегрева. Особое внимание требуется плотной, длинной и двойной шерсти, поскольку удерживаемая влага повышает риск раздражения кожи. [Cornell: Hot Spots](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/hot-spots).
- При учащённом или затруднённом дыхании, чрезмерном пыхтении, слабости или изменении цвета слизистых сушку немедленно прекращают и действуют как при красном флаге. [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/).

### 5.4. Когти и лапы

- Подстригается только безопасная свободная часть когтя; сосудисто-нервный пучок не затрагивается. Положение пучка и естественное стачивание различаются, поэтому объём подстригания индивидуален. [Texas A&M: Animal Nail Care](https://vetmed.tamu.edu/news/pet-talk/animal-nail-care/).
- Когти и лапы осматривают на трещины, расслоение, кровь, отёк, раны подушечек, болезненность и инородные тела. При активном кровотечении, глубокой трещине, отёке, выраженной боли или хромоте косметическое подстригание прекращается и рекомендуется ветеринарная оценка. [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/).
- Нельзя удерживать собаку несколькими людьми только ради когтей. Если положительное подкрепление, пауза и минимальная фиксация не обеспечивают безопасность, процедуру переносят или направляют к ветеринару. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).

### 5.5. Уши

- До очистки оценивают наружную часть уха: покраснение, запах, выделения, избыток серы, расчёсы, отёк, встряхивание головой и болезненность. При любом из этих признаков бот не рекомендует салонную очистку как лечение и направляет к ветеринару. [Cornell: How to Clean Your Dog's Ears](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/how-clean-your-dogs-ears).
- Здоровые уши не нужно очищать «для профилактики» слишком часто: избыточная очистка способна вызвать раздражение. [Cornell: How to Clean Your Dog's Ears](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/how-clean-your-dogs-ears).
- Нельзя вводить ватные палочки глубоко в слуховой проход, проталкивать загрязнение внутрь или использовать спирт и перекись водорода. При боли процедуру немедленно прекращают. [Cornell: How to Clean Your Dog's Ears](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/how-clean-your-dogs-ears).

### 5.6. Кожа и глаза

- Визуально отмечают облысение, сильную перхоть, корки, покраснение, мокнутие, пустулы, раны, уплотнения, активное расчёсывание и возможных наружных паразитов. Бот не определяет причину и не рекомендует лечебную обработку; при таких признаках требуется ветеринар. [UC Davis Dermatology Fact Sheets](https://www.vetmed.ucdavis.edu/hospital/animal-health-topics/dermatology-fact-sheets).
- При покраснении глаза, прищуривании, выраженном слезотечении, отёке, помутнении, выпячивании, травме или видимом инородном теле работу возле глаза прекращают и рекомендуют срочную ветеринарную оценку. [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/).
- Бот не рекомендует человеческие или ветеринарные глазные препараты и не предлагает промывание как замену осмотру. Любое применение препаратов относится к ветеринарной компетенции. [AAHA First Aid Guidance](https://www.aaha.org/resources/how-to-make-a-pet-first-aid-kit-and-actually-use-it/).

### 5.7. Видовые противопоказания для собак

- Силовое удержание, продолжение через панику или выраженную боль. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).
- Короткое сбривание двойной шерсти по умолчанию или только ради «охлаждения». [Texas A&M: Summer Dog Grooming](https://vetmed.tamu.edu/news/pet-talk/summer-dog-grooming/).
- Косметическая обработка поверх открытой, мокнущей, гнойной или болезненной кожи. [UC Davis Dermatology Fact Sheets](https://www.vetmed.ucdavis.edu/hospital/animal-health-topics/dermatology-fact-sheets).
- Очистка болезненного, воспалённого или выделяющего запах уха без ветеринарной оценки. [Cornell: How to Clean Your Dog's Ears](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/how-clean-your-dogs-ears).
- Работа возле болезненного или травмированного глаза. [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/).
- Самостоятельный совет о седативном средстве, дозе или лечебном препарате. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).

## 6. Кошки

### 6.1. Шерсть и безопасный уход

- Категория сайта охватывает кошек всех пород, но метод ухода выбирается по фактической длине, плотности, подшёрстку, линьке, состоянию кожи, возрасту и способности кошки ухаживать за собой. [Texas A&M: Regular Grooming Can Keep Your Cat Feline Fine](https://vetmed.tamu.edu/news/pet-talk/cat-grooming/), [Cornell: Special Needs of the Senior Cat](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/special-needs-senior-cat).
- Регулярное мягкое расчёсывание удаляет свободный волос и одновременно позволяет заметить колтуны, облысение, повреждения кожи, уплотнения и паразитов. [Cornell: Choosing and Caring for Your New Cat](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/choosing-and-caring-your-new-cat).
- Длинная или плотная шерсть требует более частого послойного расчёсывания, но частота определяется индивидуально. Пожилые кошки и кошки с ограниченной подвижностью могут хуже ухаживать за собой; колтуны, запах и воспаление у них требуют особенно осторожной оценки. [Cornell: Special Needs of the Senior Cat](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/special-needs-senior-cat).
- Небольшой свободный колтун можно осторожно разобрать только без боли и натяжения кожи. Плотный или болезненный колтун нельзя тянуть или срезать ножницами рядом с тонкой кошачьей кожей; при крупных колтунах или реакции боли сначала требуется согласование с ветеринаром. [FelineVMA: Chronic Pain Client Resource](https://catvets.com/wp-content/uploads/2024/12/FelineVMA_ChronicPainwNSAIDs_BW.pdf).
- Купание не является автоматической частью ухода за любой кошкой. При регулярном самоочищении и расчёсывании оно обычно не требуется, кроме обоснованного загрязнения или индивидуальной необходимости. [Texas A&M: Regular Grooming Can Keep Your Cat Feline Fine](https://vetmed.tamu.edu/news/pet-talk/cat-grooming/).
- Полное сбривание «для прохлады» обычно не рекомендуется. Стрижка может рассматриваться при крупных колтунах или неспособности кошки ухаживать за собой, но только с учётом кожи, поведения и безопасности. [Texas A&M: Regular Grooming Can Keep Your Cat Feline Fine](https://vetmed.tamu.edu/news/pet-talk/cat-grooming/).

### 6.2. Обращение и стресс

- Кошке дают максимально возможное чувство контроля: короткие взаимодействия, возможность оставаться в переноске или укрытии до необходимости, минимум шума и минимум фиксации. [2022 AAFP/ISFM Cat Friendly Veterinary Interaction Guidelines](https://catvets.com/resource/aafp-isfm-cat-friendly-veterinary-interaction-guidelines/).
- Нельзя поднимать кошку за холку, растягивать или сжимать сильным захватом. При подъёме поддерживают задние конечности и таз, держат тело близко и устойчиво. [FelineVMA Client Education](https://catvets.com/resource/client-education-cat-friendly-practices/), [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).
- Напряжение тела, расширение зрачков, прижатые уши, шипение, вокализация, попытка уйти, удар лапой или укус означают, что контакт нужно остановить или уменьшить. [FelineVMA Client Education](https://catvets.com/resource/client-education-cat-friendly-practices/).
- Замирание не означает согласие. Пассивная неподвижность может быть реакцией сильного страха. [WSAVA Animal Welfare Guidelines](https://wsava.org/wp-content/uploads/2019/12/WSAVA-Animal-Welfare-Guidelines-2018.pdf).

### 6.3. Когти, уши, кожа и глаза

- Подстригается только прозрачный свободный кончик когтя с сохранением сосудисто-нервного пучка. У пожилых кошек когти могут быть утолщёнными, ломкими и перерастать, поэтому лапы проверяют особенно внимательно. [Cornell: Special Needs of the Senior Cat](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/special-needs-senior-cat).
- Удаление когтевой фаланги не является грумингом. Бот не предлагает declawing/онихэктомию; FelineVMA выступает против этой операции как плановой и указывает обычное подстригание когтей как одну из альтернатив. [FelineVMA Declawing Position Statement](https://catvets.com/resource/declawing-declawing-position-statement/).
- Если уши красные, воспалённые, болезненные, имеют выделения или запах, их не очищают до ветеринарного осмотра. [Texas A&M: Regular Grooming Can Keep Your Cat Feline Fine](https://vetmed.tamu.edu/news/pet-talk/cat-grooming/).
- Облысение, чрезмерное вылизывание, корки, ранки или выраженный зуд не являются только косметической проблемой; после первичного визуального замечания требуется ветеринарная оценка. [Cornell: Cats That Lick Too Much](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/cats-lick-too-much), [UC Davis Dermatology Fact Sheets](https://www.vetmed.ucdavis.edu/hospital/animal-health-topics/dermatology-fact-sheets).
- Покраснение, прищуривание, отёк, внезапное помутнение, обильные выделения, травма или видимое инородное тело в глазу требуют прекращения работы возле морды и срочной ветеринарной оценки. [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/).

### 6.4. Видовые противопоказания для кошек

- Фиксация за холку, растягивание, коллективное силовое удержание и продолжение через панику. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).
- Купание или сушка при выраженном страхе, тяжёлом дыхании, слабости или перегреве. [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/).
- Срезание плотных колтунов ножницами у кожи и болезненное выдёргивание колтунов. [FelineVMA: Chronic Pain Client Resource](https://catvets.com/wp-content/uploads/2024/12/FelineVMA_ChronicPainwNSAIDs_BW.pdf).
- Очистка воспалённого уха или работа возле больного глаза без ветеринарного осмотра. [Texas A&M: Regular Grooming Can Keep Your Cat Feline Fine](https://vetmed.tamu.edu/news/pet-talk/cat-grooming/), [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/).
- Назначение успокоительных, лечебных шампуней, глазных, ушных или противопаразитарных средств ботом или грумером вместо ветеринара. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/).

## 7. Морские свинки

### 7.1. Шерсть и уход

- Длинная или очень густая шерсть требует ежедневного мягкого расчёсывания; короткую шерсть обычно расчёсывают один или два раза в неделю. Колтуны разбирают без рывков и натяжения кожи. [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health).
- Во время ухода проверяют, что шерсть чистая, без проплешин и узлов, кожа без уплотнений, а задняя зона сухая и свободна от налипших выделений. [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health).
- Купание не должно быть частым или автоматическим. Даже если отдельная услуга купания есть в каталоге, её безопасность оценивается по состоянию, температурной стабильности и переносимости конкретной морской свинки; после контакта с водой животное полностью и бережно высушивают без перегрева и сквозняка. [Blue Cross: Guinea Pig Care](https://www.bluecross.org.uk/advice/guinea-pig/guinea-pig-care).
- Холодная ванна не используется для охлаждения: резкое охлаждение опасно. [PDSA: Keeping Guinea Pigs Cool](https://www.pdsa.org.uk/what-we-do/blog/keeping-your-guinea-pigs-cool-in-the-summer-dos-and-don-ts).

### 7.2. Обращение и стресс

- Морская свинка является животным-жертвой и может пугаться подъёма. При необходимости одной рукой поддерживают грудь, другой задние конечности и таз, держат животное вертикально, близко к телу и низко над устойчивой поверхностью. [PDSA: How to Hold a Guinea Pig](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pigs-as-pets).
- Нельзя переворачивать морскую свинку на спину. Нужно обеспечить возможность спрятаться до и после процедуры и не преследовать животное по рабочей зоне. [PDSA: How to Hold a Guinea Pig](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pigs-as-pets).
- При повторных попытках вырваться, резкой вокализации, замирании с тяжёлым дыханием или невозможности безопасно поддерживать тело процедуру прекращают. [PDSA: How to Hold a Guinea Pig](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pigs-as-pets), [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health).

### 7.3. Когти, уши, кожа, глаза и задняя зона

- Перед подстриганием проверяют длину и направление когтей, состояние подушечек и походку. Когти, загибающиеся к подушечке, раны стоп, отёк, болезненность или хромота требуют ветеринарной оценки. [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health).
- Подстригают только свободную часть когтя, не затрагивая сосудисто-нервный пучок. Если граница не видна или безопасная длина неясна, бот рекомендует ветеринара или специалиста, а не приблизительный срез. [PDSA: Five Common Health Problems in Guinea Pigs](https://www.pdsa.org.uk/what-we-do/blog/five-common-health-problems-in-guinea-pigs-and-how-to-prevent-them).
- Краснота ушей, зуд, обильная сера, выделения, запах, болезненность, наклон головы, движение по кругу или нарушение равновесия требуют ветеринарной оценки; салон не очищает ухо как лечение. [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health).
- Красный, мутный или закрытый глаз, выделения, видимая царапина или уплотнение требуют быстрого обращения к ветеринару; работа возле глаза прекращается. [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health).
- Покраснение кожи, сыпь, чешуйки, проплешины, язвы, раны, корки или зуд не диагностируются ботом и требуют ветеринарной оценки. [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health).
- Заднюю зону проверяют на влажность, мочевые загрязнения, налипшие фекалии, яйца мух и личинок. В тёплую погоду загрязнение повышает риск миаза; при личинках требуется немедленный ветеринар. [RSPCA: Guinea Pig Health](https://www.rspca.org.uk/en/adviceandwelfare/pets/rodents/guineapigs/health), [Blue Cross: Keeping Guinea Pigs Cool](https://www.bluecross.org.uk/advice/guinea-pig/how-to-keep-guinea-pigs-cool-in-the-summer).

### 7.4. Красные флаги и противопоказания для морских свинок

Процедуру не начинают или немедленно прекращают при следующих признаках:

- затруднённое, тяжёлое, шумное или резко учащённое дыхание: это экстренный признак; [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health);
- отказ от еды, заметное уменьшение фекалий, тяжёлая диарея, выраженная вялость или необычное скрывание: требуется срочная связь с ветеринаром; [RSPCA: Guinea Pig Health](https://www.rspca.org.uk/en/adviceandwelfare/pets/rodents/guineapigs/health), [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health);
- кровотечение, рана, судороги, нарушение равновесия, выраженная боль или невозможность нормально двигаться; [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health);
- личинки или яйца мух, мокрая травмированная задняя зона: немедленный ветеринар; [Blue Cross: Keeping Guinea Pigs Cool](https://www.bluecross.org.uk/advice/guinea-pig/how-to-keep-guinea-pigs-cool-in-the-summer);
- переворачивание на спину, силовая фиксация, холодная ванна, перегрев феном, глубокая очистка ушей, коррекция зубов или применение препаратов в салоне недопустимы. Коррекцию перерастающих или неправильно стоящих зубов выполняет только ветеринар. [PDSA: How to Hold a Guinea Pig](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pigs-as-pets), [RSPCA: Guinea Pig Health](https://www.rspca.org.uk/en/adviceandwelfare/pets/rodents/guineapigs/health).

## 8. Кролики

### 8.1. Шерсть и уход

- Короткошёрстных кроликов регулярно расчёсывают не реже примерно одного раза в неделю, длинношёрстных обычно ежедневно; во время линьки частоту увеличивают. [Blue Cross: Grooming Your Rabbit](https://www.bluecross.org.uk/advice/rabbit/wellbeing-and-care/grooming-your-rabbit), [PDSA: Grooming Pets](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/all-pets/grooming-pets).
- Ангорская и другая очень длинная шерсть требует специалиста, знакомого с кроликами, поскольку быстро сваливается и скрывает кожу. [Blue Cross: Grooming Your Rabbit](https://www.bluecross.org.uk/advice/rabbit/wellbeing-and-care/grooming-your-rabbit).
- Кроличья кожа тонкая и легко травмируется. Используют подходящие мягкие инструменты и работают по направлению роста шерсти; плотный колтун не вытягивают и не срезают ножницами у кожи. [PDSA: Grooming Pets](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/all-pets/grooming-pets), [Blue Cross: Grooming Your Rabbit](https://www.bluecross.org.uk/advice/rabbit/wellbeing-and-care/grooming-your-rabbit).
- Стандартный уход не включает купание. Кролики обычно поддерживают чистоту сами; загрязнённая или мокрая задняя зона может быть признаком неблагополучия, а не поводом для обычной ванны. [PDSA: Dirty Bottoms and Urine Scald](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/symptoms/urine-scald-dirty-bottoms-and-how-to-clean-a-rabbit).
- Локальное очищение допустимо только при реальной необходимости, с полной поддержкой тела и тщательным высушиванием; при болезненной коже или сильном загрязнении сначала требуется ветеринар. [PDSA: Dirty Bottoms and Urine Scald](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/symptoms/urine-scald-dirty-bottoms-and-how-to-clean-a-rabbit).

### 8.2. Обращение и защита позвоночника

- Кролики как животные-жертвы обычно безопаснее чувствуют себя на уровне пола. Контакт начинают медленно, на нескользящей поверхности, без внезапного подъёма. [RSPCA: Handling Rabbits](https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/company/handling).
- При необходимом подъёме одной рукой поддерживают грудь, другой спину, таз и задние конечности; все четыре лапы стабилизируют у тела. Неподдержанные мощные задние конечности создают риск тяжёлой травмы позвоночника при рывке. [RSPCA: Handling Rabbits](https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/company/handling).
- Нельзя поднимать кролика за уши или холку и нельзя удерживать на спине. Неподвижность на спине является стрессовой реакцией, а не расслаблением. [RSPCA: Handling Rabbits](https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/company/handling), [PDSA: Rabbit Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/rabbit-health).
- Если кролик резко бьёт задними лапами, скручивается или вырывается, его безопасно опускают на нескользящую поверхность и прекращают процедуру, а не усиливают фиксацию. [RSPCA: Handling Rabbits](https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/company/handling).

### 8.3. Когти, уши, кожа, глаза и задняя зона

- Когти подстригают специальным инструментом на нескользящей поверхности, сохраняя расстояние до сосудисто-нервного пучка. При полностью тёмных когтях и неясной границе безопаснее обратиться к ветеринару. [PDSA: How to Clip Your Rabbits' Nails](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/other-veterinary-advice/how-to-clip-your-rabbits-nails).
- Нельзя принуждать кролика к подстриганию когтей. Если безопасная поддержка невозможна, процедуру прекращают и рекомендуют ветеринарную помощь. [PDSA: How to Clip Your Rabbits' Nails](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/other-veterinary-advice/how-to-clip-your-rabbits-nails).
- Корки, сильная перхоть, облысение, язвы, раны, зуд, болезненные уплотнения или обнаруженные паразиты требуют ветеринарной оценки; бот не рекомендует кошачьи или собачьи противопаразитарные препараты, поскольку некоторые из них опасны для кроликов. [Blue Cross: Grooming Your Rabbit](https://www.bluecross.org.uk/advice/rabbit/wellbeing-and-care/grooming-your-rabbit).
- Покраснение, прищуривание, помутнение, отёк или выделения из глаза, а также болезненность, запах или выделения из уха означают прекращение работы в этой зоне и обращение к ветеринару. [PDSA: Eye Problems in Rabbits](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/symptoms/eye-problems-in-rabbits), [Blue Cross: Basic Rabbit Healthcare](https://www.bluecross.org.uk/advice/rabbit/health-and-injuries/basic-healthcare-in-rabbits).
- Заднюю зону проверяют на влажность, мочевое раздражение, мягкий стул, налипшие загрязнения, раны, яйца мух и личинок. Грязная задняя зона сама по себе является поводом для ветеринарной оценки, поскольку часто связана с проблемой, мешающей самоочищению. [PDSA: Dirty Bottoms and Urine Scald](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/symptoms/urine-scald-dirty-bottoms-and-how-to-clean-a-rabbit).

### 8.4. Красные флаги и противопоказания для кроликов

- Даже одна обнаруженная личинка или признаки миаза требуют немедленной экстренной ветеринарной помощи. Нельзя самостоятельно удалять личинок или погружать кролика в воду. [PDSA: Flystrike in Rabbits](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/conditions/flystrike-in-rabbits).
- Отказ от еды, уменьшение или отсутствие фекалий, выраженная вялость, коллапс, диарея, тяжёлое дыхание, судороги, кровотечение, рана или необычная поза являются основаниями не проводить груминг и срочно связаться с ветеринаром. Общий принцип раннего выявления изменений поддерживает [PDSA: Rabbit Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/rabbit-health); при коллапсе, судорогах и нарушении дыхания применяется экстренная маршрутизация.
- Полная ванна, погружение, переворачивание на спину, подъём за уши или холку, силовая фиксация и срезание плотного загрязнения ножницами у кожи недопустимы. [RSPCA: Handling Rabbits](https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/company/handling), [PDSA: Dirty Bottoms and Urine Scald](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/symptoms/urine-scald-dirty-bottoms-and-how-to-clean-a-rabbit).
- Бот и грумер не корректируют зубы, не лечат уши, глаза, кожу или миаз и не назначают препараты. Эти действия относятся к ветеринарной помощи. [PDSA: Rabbit Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/rabbit-health), [PDSA: Flystrike in Rabbits](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/conditions/flystrike-in-rabbits).

## 9. Единая матрица красных флагов

### 9.1. Немедленно прекратить процедуру и рекомендовать экстренную ветеринарную помощь

- затруднённое, шумное или резко учащённое дыхание; посинение, серый или резко бледный цвет слизистых; [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/);
- коллапс, отсутствие нормальной реакции, внезапная крайняя слабость, паралич или нарушение координации; [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/);
- судороги; [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/);
- активное или неостанавливающееся кровотечение, серьёзная травма или падение; [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/);
- травма глаза, выпячивание, выраженный отёк, сильное прищуривание или видимое инородное тело; [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/);
- личинки или яйца мух на кролике; [PDSA: Flystrike in Rabbits](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/conditions/flystrike-in-rabbits);
- тяжёлое дыхание у морской свинки; [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health);
- явные признаки перегрева: чрезмерное пыхтение или тяжёлое дыхание, слюнотечение, слабость, дезориентация или коллапс. [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/), [Blue Cross: Keeping Guinea Pigs Cool](https://www.bluecross.org.uk/advice/guinea-pig/how-to-keep-guinea-pigs-cool-in-the-summer).

### 9.2. Не начинать или остановить и рекомендовать скорую ветеринарную консультацию

- боль при лёгком прикосновении, внезапная защитная реакция, необычная поза или изменение походки; [AAHA Pain Assessment Principles](https://www.aaha.org/resources/2022-aaha-pain-management-guidelines-for-dogs-and-cats/guiding-principles-of-pain-assessment/);
- открытая рана, мокнутие, гной, резкий запах, выраженное покраснение, отёк, корки, язвы или внезапное облысение; [UC Davis Dermatology Fact Sheets](https://www.vetmed.ucdavis.edu/hospital/animal-health-topics/dermatology-fact-sheets);
- болезненное, красное или пахнущее ухо, выделения, постоянное встряхивание головой или потеря равновесия; [Cornell: How to Clean Your Dog's Ears](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/how-clean-your-dogs-ears), [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health);
- красный, мутный, закрытый или выделяющий секрет глаз; [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/), [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health);
- глубокая трещина когтя, воспалённая лапа, язва подушечки или выраженная хромота; [Texas A&M: Animal Nail Care](https://vetmed.tamu.edu/news/pet-talk/animal-nail-care/), [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health);
- отказ от еды, снижение количества фекалий, тяжёлая диарея или выраженная вялость у морской свинки или кролика; [RSPCA: Guinea Pig Health](https://www.rspca.org.uk/en/adviceandwelfare/pets/rodents/guineapigs/health), [PDSA: Rabbit Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/rabbit-health);
- мокрая, раздражённая или сильно загрязнённая задняя зона у кролика. [PDSA: Dirty Bottoms and Urine Scald](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/symptoms/urine-scald-dirty-bottoms-and-how-to-clean-a-rabbit).

### 9.3. Остановить по поведенческой безопасности

- животное не восстанавливается после паузы;
- страх нарастает от каждого контакта;
- требуется силовая или коллективная фиксация;
- невозможно удерживать животное без риска падения, укуса или травмы;
- кролик или морская свинка вырывается так, что невозможно постоянно поддерживать позвоночник и задние конечности.

В этих ситуациях процедура переносится, сокращается или передаётся ветеринару либо специалисту с подходящими условиями. [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/), [RSPCA: Handling Rabbits](https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/company/handling), [PDSA: How to Hold a Guinea Pig](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pigs-as-pets).

## 10. Границы ответов AI-помощника

### 10.1. Что бот может делать

- Объяснять общие различия типов шерсти и безопасного немедицинского ухода со ссылкой на этот справочник.
- Помогать найти локализованную породу, категорию и предусмотренную услугу в актуальном каталоге сайта.
- Задавать короткие уточняющие вопросы о виде, породе, разновидности, размере, шерсти, поведении и известных ограничениях.
- Объяснять, какие наблюдаемые признаки требуют паузы, переноса процедуры или связи с ветеринаром.
- Объяснять подготовку к спокойному визиту: постепенное положительное приучение, знакомые предметы, отсутствие наказания и заблаговременное сообщение о триггерах. [AAHA Preparing Your Pet for a Successful Veterinary Visit](https://www.aaha.org/resources/preparing-your-pet-for-a-successful-veterinary-visit/).
- Передавать сотруднику салона вопросы, для которых в каталоге или справочнике нет надёжного ответа.

### 10.2. Что бот не может делать

- Ставить или исключать диагноз.
- Оценивать по фотографии, что воспаление, образование, паразит или травма «безопасны».
- Назначать лечение, лекарства, успокоительные, дозировки, лечебную косметику или противопаразитарные средства.
- Давать инструкции по домашнему удалению личинок, коррекции зубов, обработке глубоких ран, больных глаз или воспалённых ушей.
- Обещать, что животное обязательно выдержит процедуру, или гарантировать косметический результат до очной оценки.
- Придумывать отсутствующую услугу, цену, скидку, породное название, категорию или размерный индекс.
- Подменять ветеринарную помощь салонной процедурой.

Эти ограничения сохраняют границу между немедицинским уходом и ветеринарной помощью: признаки боли и заболевания требуют профессиональной оценки, а лекарства и седация относятся к решениям ветеринара. [AAHA Pain Assessment Principles](https://www.aaha.org/resources/2022-aaha-pain-management-guidelines-for-dogs-and-cats/guiding-principles-of-pain-assessment/), [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/), [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health), [PDSA: Rabbit Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/rabbits/rabbit-health).

### 10.3. Правило языка клиента

1. Определить активную локаль страницы или язык последнего сообщения клиента.
2. Сформировать весь ответ только на этой локали.
3. Использовать название породы и услуги только из той же локали каталога.
4. Не добавлять в скобках названия на другом языке, если клиент этого прямо не запросил.
5. При отсутствии надёжной локализации уточнить исходное название и передать вопрос сотруднику вместо машинного предположения.
6. Ссылки на англоязычные профессиональные источники предназначены для внутренней проверки. В клиентском ответе бот пересказывает правило на языке клиента и даёт внешнюю ссылку только если она действительно полезна.

### 10.4. Шаблон безопасного ответа

Обычный порядок:

1. Кратко ответить по подходящему уходу или категории.
2. Назвать индивидуальные факторы: фактический тип и состояние шерсти, размер, поведение, переносимость процедуры.
3. Если есть красный флаг, прямо рекомендовать не продолжать груминг и связаться с ветеринаром.
4. Если медицинского риска нет, но данных недостаточно, задать один конкретный уточняющий вопрос или передать сотруднику салона.
5. При вопросе о цене перейти к актуальному детальному прайс-листу, а не использовать этот справочник.

Пример нейтральной формулировки без диагноза:

> По описанию есть покраснение и болезненность при касании. Это не следует обрабатывать как обычную гигиеническую процедуру. До груминга лучше показать питомца ветеринару; AI-помощник не может определить причину или назначить лечение.

При экстренном признаке формулировка должна быть прямой:

> Прекратите процедуру. Затруднённое дыхание является экстренным признаком. Немедленно свяжитесь с ближайшей ветеринарной клиникой или ветеринарной неотложной помощью.

Оба сообщения переводятся целиком на активную локаль клиента без смешения языков.

## 11. Источники и область их применения

Все ссылки ниже проверены 2026-08-31. Документ использует профессиональную выжимку и не воспроизводит длинные фрагменты источников.

### 11.1. Породы собак и разновидности шерсти

- [FCI Breeds Nomenclature](https://www.fci.be/en/Nomenclature/): официальные признанные породы, группы и стандарты.
- [FCI Breeds with Varieties](https://www.fci.be/en/nomenclature/varietes.aspx): официальные разновидности по размеру, шерсти и окрасу.
- [FCI Standard No. 55, Puli](https://www.fci.be/Nomenclature/Standards/055g01-en.pdf): пример специальной структуры шнуровой шерсти.

### 11.2. Собаки и кошки

- [WSAVA Animal Welfare Guidelines](https://wsava.org/wp-content/uploads/2019/12/WSAVA-Animal-Welfare-Guidelines-2018.pdf): поведенческие признаки стресса и оценка благополучия.
- [AAHA Humane Restraint Position Statement](https://www.aaha.org/humane-restraint-of-animals/): минимально стрессовое обращение и недопустимая силовая фиксация.
- [AAHA Pain Assessment Principles](https://www.aaha.org/resources/2022-aaha-pain-management-guidelines-for-dogs-and-cats/guiding-principles-of-pain-assessment/): наблюдение позы, движений и поведения при оценке боли.
- [AAHA Emergency Signs](https://www.aaha.org/resources/help-is-this-a-pet-emergency/): общие экстренные признаки у домашних животных.
- [2022 AAFP/ISFM Cat Friendly Veterinary Interaction Guidelines](https://catvets.com/resource/aafp-isfm-cat-friendly-veterinary-interaction-guidelines/): уважительное взаимодействие с кошкой и снижение страха.
- [Cornell: Grooming and Cooperative Care](https://riney.vet.cornell.edu/member-benefits-health-tips/grooming-cooperative-care-february-2026?hs_amp=true): постепенное приучение собак и работа ниже стрессового порога.
- [Cornell: How to Clean Your Dog's Ears](https://www.vet.cornell.edu/departments-centers-and-institutes/riney-canine-health-center/canine-health-topics/how-clean-your-dogs-ears): безопасная гигиена здоровых ушей и признаки для ветеринарного осмотра.
- [Texas A&M: Summer Dog Grooming](https://vetmed.tamu.edu/news/pet-talk/summer-dog-grooming/): двойная шерсть и ограничения сбривания.
- [Texas A&M: Animal Nail Care](https://vetmed.tamu.edu/news/pet-talk/animal-nail-care/): базовая анатомическая безопасность когтей.
- [Texas A&M: Basic Pet Grooming Needs](https://vetmed.tamu.edu/news/pet-talk/basic-grooming/): видоспецифичные средства и индивидуальная частота купания.
- [Texas A&M: Regular Grooming Can Keep Your Cat Feline Fine](https://vetmed.tamu.edu/news/pet-talk/cat-grooming/): расчёсывание, купание, колтуны, уши и когти кошек.
- [Cornell: Special Needs of the Senior Cat](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/special-needs-senior-cat): шерсть, кожа и когти пожилых кошек.
- [FelineVMA: Chronic Pain Client Resource](https://catvets.com/wp-content/uploads/2024/12/FelineVMA_ChronicPainwNSAIDs_BW.pdf): щадящий уход за шерстью при признаках боли и безопасность удаления колтунов.
- [UC Davis Dermatology Fact Sheets](https://www.vetmed.ucdavis.edu/hospital/animal-health-topics/dermatology-fact-sheets): признаки заболеваний кожи и наружных паразитов, требующие диагностики.

### 11.3. Морские свинки

- [PDSA: Guinea Pig Health](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pig-health): шерсть, кожа, лапы, глаза, уши и красные флаги.
- [PDSA: How to Hold a Guinea Pig](https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/guinea-pigs-as-pets): поддержка тела и безопасное положение.
- [RSPCA: Guinea Pig Health](https://www.rspca.org.uk/en/adviceandwelfare/pets/rodents/guineapigs/health): ежедневный контроль, шерсть, питание и риск миаза.
- [Blue Cross: Guinea Pig Care](https://www.bluecross.org.uk/advice/guinea-pig/guinea-pig-care): расчёсывание, купание и когти.
- [Blue Cross: Keeping Guinea Pigs Cool](https://www.bluecross.org.uk/advice/guinea-pig/how-to-keep-guinea-pigs-cool-in-the-summer): перегрев, задняя зона и миаз.

### 11.4. Кролики

- [Blue Cross: Grooming Your Rabbit](https://www.bluecross.org.uk/advice/rabbit/wellbeing-and-care/grooming-your-rabbit): частота ухода, линька, колтуны и чувствительная кожа.
- [RSPCA: Handling Rabbits](https://www.rspca.org.uk/adviceandwelfare/pets/rabbits/company/handling): защита позвоночника, поддержка тела и недопустимые положения.
- [PDSA: How to Clip Your Rabbits' Nails](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/other-veterinary-advice/how-to-clip-your-rabbits-nails): когти, сосудисто-нервный пучок и безопасная фиксация.
- [PDSA: Eye Problems in Rabbits](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/symptoms/eye-problems-in-rabbits): глазные признаки, требующие быстрой ветеринарной оценки.
- [Blue Cross: Basic Rabbit Healthcare](https://www.bluecross.org.uk/advice/rabbit/health-and-injuries/basic-healthcare-in-rabbits): наблюдение дыхания, глаз, ушей, зубов и общего состояния.
- [PDSA: Dirty Bottoms and Urine Scald](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/symptoms/urine-scald-dirty-bottoms-and-how-to-clean-a-rabbit): запрет рутинного купания, локальная очистка и ветеринарные основания.
- [PDSA: Flystrike in Rabbits](https://www.pdsa.org.uk/pet-help-and-advice/pet-health-hub/conditions/flystrike-in-rabbits): экстренная маршрутизация при яйцах мух или личинках.

## 12. Правило обновления

При следующем пересмотре необходимо повторно проверить доступность, дату и содержание каждого источника. Если профессиональная рекомендация изменилась, применяется более новая рекомендация профильной организации. Коммерческие данные, категории, локализованные названия и размерные индексы сверяются отдельно с актуальным детальным каталогом сайта; медицинские и welfare-правила не должны автоматически изменять прайс или набор услуг.
