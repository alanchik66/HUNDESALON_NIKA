(function initPricePageData(global) {
  const t = (de, en, ru, uk) => ({ de, en, ru, uk });

  const locales = {
    de: {
      heroKicker: 'Preisliste',
      heroTitle: 'Pflegekategorien mit klaren Preisen',
      heroLead:
        'Die Preisliste ist nach Felltyp und Pflegebedarf aufgebaut. Jede Karte öffnet ein Detailfenster mit Rassen, Leistungen, Preisen und Hinweisen.',
      heroNote: 'Die Preise werden zentral in dieser Konfiguration gepflegt und können später ohne Änderung der Logik angepasst werden.',
      modalTitle: 'Kategorie im Detail',
      breedsTitle: 'Rassen',
      servicesTitle: 'Leistungen',
      pricesTitle: 'Preise',
      notesTitle: 'Hinweise',
      priceItemLabel: 'Leistung / Rasse',
      priceValueLabel: 'Preis',
      closeLabel: 'Schließen',
      bookingLabel: 'Zur Buchung',
      priceFromLabel: 'ab',
      noPriceLabel: 'auf Anfrage',
      cardLabel: 'Details öffnen',
      cardCountSuffix: 'Rassen',
      cardServiceSuffix: 'Leistungen',
    },
    en: {
      heroKicker: 'Price list',
      heroTitle: 'Care categories with clear pricing',
      heroLead:
        'The price list is organised by coat type and care needs. Each card opens a detail view with breeds, services, prices and notes.',
      heroNote: 'Pricing is stored centrally in this configuration and can be adjusted later without changing the renderer.',
      modalTitle: 'Category details',
      breedsTitle: 'Breeds',
      servicesTitle: 'Services',
      pricesTitle: 'Prices',
      notesTitle: 'Notes',
      priceItemLabel: 'Service / breed',
      priceValueLabel: 'Price',
      closeLabel: 'Close',
      bookingLabel: 'Book now',
      priceFromLabel: 'from',
      noPriceLabel: 'on request',
      cardLabel: 'Open details',
      cardCountSuffix: 'breeds',
      cardServiceSuffix: 'services',
    },
    ru: {
      heroKicker: 'Прайс-лист',
      heroTitle: 'Категории ухода с понятными ценами',
      heroLead:
        'Прайс построен по типу шерсти и потребностям ухода. Каждая карточка открывает окно с породами, услугами, ценами и примечаниями.',
      heroNote: 'Цены хранятся централизованно в этой конфигурации и в будущем меняются без правки логики рендеринга.',
      modalTitle: 'Подробности категории',
      breedsTitle: 'Породы',
      servicesTitle: 'Услуги',
      pricesTitle: 'Цены',
      notesTitle: 'Примечания',
      priceItemLabel: 'Услуга / порода',
      priceValueLabel: 'Цена',
      closeLabel: 'Закрыть',
      bookingLabel: 'Записаться',
      priceFromLabel: 'от',
      noPriceLabel: 'по запросу',
      cardLabel: 'Открыть детали',
      cardCountSuffix: 'пород',
      cardServiceSuffix: 'услуг',
    },
    uk: {
      heroKicker: 'Прайс-лист',
      heroTitle: 'Категорії догляду з прозорими цінами',
      heroLead:
        'Прайс побудований за типом шерсті та потребами догляду. Кожна картка відкриває вікно з породами, послугами, цінами та примітками.',
      heroNote: 'Ціни зберігаються централізовано в цій конфігурації та надалі змінюються без правок логіки рендерингу.',
      modalTitle: 'Деталі категорії',
      breedsTitle: 'Породи',
      servicesTitle: 'Послуги',
      pricesTitle: 'Ціни',
      notesTitle: 'Примітки',
      priceItemLabel: 'Послуга / порода',
      priceValueLabel: 'Ціна',
      closeLabel: 'Закрити',
      bookingLabel: 'Записатися',
      priceFromLabel: 'від',
      noPriceLabel: 'за запитом',
      cardLabel: 'Відкрити деталі',
      cardCountSuffix: 'порід',
      cardServiceSuffix: 'послуг',
    },
  };

  const serviceLabels = {
    bath: t('Baden', 'Bath', 'Купання', 'Купання'),
    dry: t('Föhnen', 'Drying', 'Сушка', 'Сушіння'),
    brushing: t('Ausbürsten', 'Brushing', 'Вычёсывание', 'Вичісування'),
    silhouette: t('Silhouette formen', 'Silhouette shaping', 'Оформлення силуету', 'Оформлення силуету'),
    spa: t('SPA', 'SPA', 'СПА', 'СПА'),
    deshedding: t('Express-Fellwechsel', 'Express deshedding', 'Экспресс-линька', 'Експрес-линька'),
    trim: t('Trimmen / Handtrimmen', 'Hand stripping', 'Тримминг / ручной тримминг', 'Тримінг / ручний тримінг'),
    nails: t('Krallen schneiden', 'Nail trim', 'Стрижка когтей', 'Підрізання кігтів'),
    ears: t('Ohren reinigen', 'Ear cleaning', 'Чистка ушей', 'Чистка вух'),
    earHair: t('Ohrenhaare entfernen', 'Removing ear hair', 'Удаление волос из ушей', 'Видалення волосся з вух'),
    paws: t('Pfotenpflege', 'Paw care', 'Обработка лап', 'Обробка лап'),
    dematting: t('Entfilzen', 'Dematting', 'Распутывание колтунов', 'Розплутування ковтунів'),
    ozone: t('Ozontherapie', 'Ozone therapy', 'Озонотерапия', 'Озонотерапія'),
    mask: t('Aufbau-Maske', 'Restorative mask', 'Восстанавливающая маска', 'Відновлювальна маска'),
    teeth: t('Ultraschall-Zahnpflege', 'Ultrasonic teeth cleaning', 'Ультразвуковая чистка зубов', 'Ультразвукова чистка зубів'),
    undercoat: t('Unterwolle entfernen', 'Undercoat removal', 'Удаление подшерстка', 'Видалення підшерстя'),
    silhouetteFinish: t('Form nacharbeiten', 'Shape finishing', 'Доработка формы', 'Оформлення форми'),
  };

  const categories = [
    {
      id: 'decorative-growing-coat',
      title: t('Dekorative Rassen mit wachsendem Fell', 'Decorative breeds with growing coat', 'Декоративные породы с растущей шерстью', 'Декоративні породи з шерстю, що росте'),
      summary: t(
        'Sanfte Komplettpflege für Rassen mit regelmäßigem Hygiene- und Formpflegebedarf.',
        'Gentle full care for breeds that need regular hygiene and styling maintenance.',
        'Мягкий комплексный уход для пород, которым нужен регулярный гигиенический и декоративный груминг.',
        'М’який комплексний догляд для порід, яким потрібен регулярний гігієнічний і декоративний грумінг.',
      ),
      breeds: {
        de: ['Yorkshire Terrier', 'Biewer Yorkshire Terrier', 'Malteser', 'Bolonka', 'Shih Tzu', 'Havaneser', 'Lhasa Apso', 'Chinesischer Schopfhund', 'Pekinese'],
        en: ['Yorkshire Terrier', 'Biewer Yorkie', 'Maltese', 'Bolonka', 'Shih Tzu', 'Havanese', 'Lhasa Apso', 'Chinese Crested', 'Pekingese'],
        ru: ['Йоркширский терьер', 'Бивер-йорк', 'Мальтезе', 'Болонка', 'Ши-тцу', 'Гаванский бишон', 'Лхаса апсо', 'Китайская хохлатая', 'Пекинес'],
        uk: ['Йоркширський тер’єр', 'Бівер-йорк', 'Мальтезе', 'Болонка', 'Ши-тцу', 'Гаванський бішон', 'Лхаса апсо', 'Китайська чубата', 'Пекінес'],
      },
      services: ['bath', 'dry', 'brushing', 'silhouette', 'spa', 'deshedding'],
      priceRows: [
        {
          label: t('Komplettpflege', 'Full grooming', 'Комплексный груминг', 'Комплексний грумінг'),
          price: t('ab 85 €', 'from 85 €', 'от 85 €', 'від 85 €'),
        },
        {
          label: t('Pflege zwischen den Terminen', 'Maintenance care', 'Поддерживающий уход', 'Підтримувальний догляд'),
          price: t('ab 45 €', 'from 45 €', 'от 45 €', 'від 45 €'),
        },
      ],
      notes: [
        t(
          'Der Endpreis hängt vom Fellzustand, von Verfilzungen, der Größe und dem Verhalten des Tieres ab.',
          'Final price depends on coat condition, mats, size and behaviour.',
          'Итог зависит от состояния шерсти, колтунов, размера и поведения животного.',
          'Підсумок залежить від стану шерсті, ковтунів, розміру та поведінки тварини.'
        ),
      ],
    },
    {
      id: 'poodles-and-doodles',
      title: t('Pudel und Pudelmischlinge', 'Poodles and doodle-type breeds', 'Пудели и породы пудельного типа', 'Пуделі та породи пудельного типу'),
      summary: t(
        'Rassengerechte Pflege mit präziser Form, Volumen und weicher Fellstruktur.',
        'Breed-appropriate care with precise shape, volume and a soft coat texture.',
        'Породный уход с точной геометрией формы, объёмом и мягкой текстурой шерсти.',
        'Породний догляд із точною геометрією форми, об’ємом і м’якою текстурою шерсті.',
      ),
      breeds: {
        de: ['Toypudel', 'Zwergpudel', 'Kleinpudel', 'Mittelpudel', 'Großpudel', 'Maltipoo', 'Cavapoo', 'Cockapoo', 'Labradoodle', 'Goldendoodle'],
        en: ['Toy Poodle', 'Miniature Poodle', 'Small Poodle', 'Medium Poodle', 'Standard Poodle', 'Maltipoo', 'Cavapoo', 'Cockapoo', 'Labradoodle', 'Goldendoodle'],
        ru: ['Той-пудель', 'Карликовый пудель', 'Малый пудель', 'Средний пудель', 'Большой пудель', 'Мальтипу', 'Кавапу', 'Кокапу', 'Лабрадудль', 'Голдендудль'],
        uk: ['Той-пудель', 'Карликовий пудель', 'Малий пудель', 'Середній пудель', 'Великий пудель', 'Мальтіпу', 'Кавапу', 'Кокапу', 'Лабрадудль', 'Голдендудль'],
      },
      services: ['bath', 'dry', 'brushing', 'silhouette', 'spa'],
      priceRows: [
        { label: t('Toypudel', 'Toy Poodle', 'Той-пудель', 'Той-пудель'), price: t('95–110 €', '95–110 €', '95–110 €', '95–110 €') },
        { label: t('Zwergpudel', 'Miniature Poodle', 'Карликовый пудель', 'Карликовий пудель'), price: t('ab 110 €', 'from 110 €', 'от 110 €', 'від 110 €') },
        { label: t('Kleinpudel', 'Small Poodle', 'Малый пудель', 'Малий пудель'), price: t('ab 120 €', 'from 120 €', 'от 120 €', 'від 120 €') },
        { label: t('Mittelpudel', 'Medium Poodle', 'Средний пудель', 'Середній пудель'), price: t('ab 140 €', 'from 140 €', 'от 140 €', 'від 140 €') },
        { label: t('Großpudel', 'Standard Poodle', 'Большой пудель', 'Великий пудель'), price: t('ab 150 €', 'from 150 €', 'от 150 €', 'від 150 €') },
        { label: t('Pudelmischlinge', 'Doodle mixes', 'Пудельные метисы', 'Пудельні метиси'), price: t('ab 120 €', 'from 120 €', 'от 120 €', 'від 120 €') },
      ],
      notes: [
        t(
          'Финальная цена зависит от структуры кудрей, длины, плотности и выбранного силуэта.',
          'Final pricing depends on curl structure, length, density and the chosen silhouette.',
          'Итоговая цена зависит от структуры кудрей, длины, плотности и выбранного силуэта.',
          'Підсумкова ціна залежить від структури кучерів, довжини, щільності та вибраного силуету.'
        ),
      ],
    },
    {
      id: 'bichons',
      title: t('Bichon-Rassen', 'Bichons', 'Бишоны', 'Бішони'),
      summary: t(
        'Leichtes Volumen, eine saubere Form und schonende Pflege für weiße und feine Felltypen.',
        'Light volume, a neat shape and gentle care for white and delicate coats.',
        'Лёгкий объём, аккуратная форма и мягкий уход за белой и тонкой шерстью.',
        'Легкий об’єм, акуратна форма та м’який догляд за білою і тонкою шерстю.',
      ),
      breeds: {
        de: ['Bichon Frisé', 'Coton de Tuléar'],
        en: ['Bichon Frise', 'Coton de Tulear'],
        ru: ['Бишон-фризе', 'Котон-де-тулеар'],
        uk: ['Бішон-фрізе', 'Котон-де-тулеар'],
      },
      services: ['bath', 'dry', 'brushing', 'silhouette', 'spa'],
      priceRows: [
        { label: t('Bichon Frisé', 'Bichon Frise', 'Бишон-фризе', 'Бішон-фрізе'), price: t('ab 85 €', 'from 85 €', 'от 85 €', 'від 85 €') },
        { label: t('Coton de Tuléar', 'Coton de Tulear', 'Котон-де-тулеар', 'Котон-де-тулеар'), price: t('ab 85 €', 'from 85 €', 'от 85 €', 'від 85 €') },
      ],
      notes: [
        t(
          'Особенно важны чистый объём, мягкая сушка и сохранение воздушной формы.',
          'Volume, gentle drying and the airy outline matter most here.',
          'Особливо важливі чистий об’єм, м’яке сушіння та збереження повітряної форми.',
          'Особливо важливі чистий об’єм, м’яке сушіння та збереження повітряної форми.'
        ),
      ],
    },
    {
      id: 'spitzes',
      title: t('Spitzrassen', 'Spitz breeds', 'Шпицы', 'Шпіци'),
      summary: t(
        'Arbeit mit dichtem Unterfell, klarer Silhouette und natürlichem Volumen.',
        'Work with dense undercoat, a defined silhouette and natural volume.',
        'Работа с плотным подшёрстком, выразительным силуэтом и естественным объёмом.',
        'Робота з щільним підшерстям, виразним силуетом і природним об’ємом.',
      ),
      breeds: {
        de: ['Zwergspitz', 'Kleinspitz', 'Mittelspitz', 'Großspitz', 'Wolfsspitz'],
        en: ['Pomeranian', 'Small Spitz', 'Medium Spitz', 'Large Spitz', 'Wolfspitz'],
        ru: ['Померанский шпиц', 'Малый шпиц', 'Средний шпиц', 'Большой шпиц', 'Вольфшпиц'],
        uk: ['Померанський шпіц', 'Малий шпіц', 'Середній шпіц', 'Великий шпіц', 'Вольфшпіц'],
      },
      services: ['bath', 'dry', 'brushing', 'undercoat', 'deshedding'],
      priceRows: [
        { label: t('Zwergspitz', 'Pomeranian', 'Померанский шпиц', 'Померанський шпіц'), price: t('80–100 €', '80–100 €', '80–100 €', '80–100 €') },
        { label: t('Klein- und Mittelspitz', 'Small / medium Spitz', 'Малый / средний шпиц', 'Малий / середній шпіц'), price: t('от 100 €', 'from 100 €', 'от 100 €', 'від 100 €') },
        { label: t('Großspitz und Wolfspitz', 'Large / Wolfspitz', 'Большой шпиц и вольфшпиц', 'Великий та вольфшпіц'), price: t('от 120 €', 'from 120 €', 'от 120 €', 'від 120 €') },
      ],
      notes: [
        t(
          'При плотной линьке отдельно учитывается объем подшерстка и время работы.',
          'Bei starker Haarung werden Unterwollmenge und Zeitaufwand separat berechnet.',
          'За щільної линьки окремо враховується обсяг підшерстя та час роботи.',
          'За щільної линьки окремо враховується обсяг підшерстя та час роботи.'
        ),
      ],
    },
    {
      id: 'handstrip-breeds',
      title: t('Trimmbare Rassen', 'Hand-stripped breeds', 'Тримингуемые породы', 'Тримінгуємі породи'),
      summary: t(
        'Rauhaarige Rassen, die handgetrimmt oder kombiniert gepflegt werden.',
        'Wire-coated breeds that need hand stripping or combined trimming.',
        'Жесткошерстные породы, которым нужен ручной или комбинированный тримминг.',
        'Жорсткошерсті породи, яким потрібен ручний або комбінований тримінг.',
      ),
      breeds: {
        de: ['Zwergschnauzer', 'Mittelschnauzer', 'Riesenschnauzer', 'West Highland White Terrier', 'Jack Russell Terrier (rauhaar)', 'Foxterrier', 'Border Terrier', 'Norwich Terrier', 'Norfolk Terrier'],
        en: ['Miniature Schnauzer', 'Standard Schnauzer', 'Giant Schnauzer', 'West Highland White Terrier', 'Wire-haired Jack Russell Terrier', 'Fox Terrier', 'Border Terrier', 'Norwich Terrier', 'Norfolk Terrier'],
        ru: ['Цвергшнауцер', 'Миттельшнауцер', 'Ризеншнауцер', 'Вест-хайленд-уайт-терьер', 'Джек-рассел (жесткошёрстный)', 'Фокстерьер', 'Бордер-терьер', 'Норвич-терьер', 'Норфолк-терьер'],
        uk: ['Цвергшнауцер', 'Міттельшнауцер', 'Різеншнауцер', 'Вест-хайленд-уайт-тер’єр', 'Джек-рассел (жорсткошерстий)', 'Фокстер’єр', 'Бордер-тер’єр', 'Норвіч-тер’єр', 'Норфолк-тер’єр'],
      },
      services: ['trim', 'bath', 'dry', 'brushing', 'silhouetteFinish'],
      priceRows: [
        { label: t('Mittelgroße Rassen', 'Medium-sized breeds', 'Породы среднего размера', 'Породи середнього розміру'), price: t('от 95 €', 'from 95 €', 'от 95 €', 'від 95 €') },
        { label: t('Große Rassen', 'Large breeds', 'Крупные породы', 'Великі породи'), price: t('от 110 €', 'from 110 €', 'от 110 €', 'від 110 €') },
      ],
      notes: [
        t(
          'Итоговая стоимость зависит от структуры шерсти, ее зрелости и объема ручной работы.',
          'Final price depends on coat structure, coat maturity and the amount of hand work.',
          'Підсумкова вартість залежить від структури шерсті, зрілості шерсті й обсягу ручної роботи.',
          'Підсумкова вартість залежить від структури шерсті, зрілості шерсті й обсягу ручної роботи.'
        ),
      ],
    },
    {
      id: 'spaniels',
      title: t('Spaniel-Rassen', 'Spaniels', 'Спаниели', 'Спанієлі'),
      summary: t(
        'Rassen mit schöner Form, sanftem Volumen und sauberem Finish.',
        'Breeds with a beautiful outline, soft volume and a neat finish.',
        'Породы с красивой формой, мягким объёмом и аккуратной филировкой.',
        'Породи з красивою формою, м’яким об’ємом та акуратним філіруванням.',
      ),
      breeds: {
        de: ['Cocker Spaniel', 'Cavalier King Charles Spaniel', 'Springer Spaniel'],
        en: ['Cocker Spaniel', 'Cavalier King Charles Spaniel', 'Springer Spaniel'],
        ru: ['Кокер-спаниель', 'Кавалер-кинг-чарльз-спаниель', 'Спрингер-спаниель'],
        uk: ['Кокер-спаніель', 'Кавалер-кінг-чарльз-спаніель', 'Спрінгер-спаніель'],
      },
      services: ['bath', 'dry', 'brushing', 'silhouette', 'spa'],
      priceRows: [
        { label: t('Cocker-Spaniel', 'Cocker Spaniel', 'Кокер-спаниель', 'Кокер-спаніель'), price: t('105–115 €', '105–115 €', '105–115 €', '105–115 €') },
        { label: t('Cavalier-King-Charles-Spaniel', 'Cavalier King Charles Spaniel', 'Кавалер-кинг-чарльз-спаниель', 'Кавалер-кінг-чарльз-спаніель'), price: t('ab 90 €', 'from 90 €', 'от 90 €', 'від 90 €') },
        { label: t('Springer-Spaniel', 'Springer Spaniel', 'Спрингер-спаниель', 'Спрінгер-спаніель'), price: t('ab 120 €', 'from 120 €', 'от 120 €', 'від 120 €') },
      ],
      notes: [
        t(
          'Объем шерсти и длина финальной стрижки влияют на итоговый расчет.',
          'Fellvolumen und Finish-Länge beeinflussen das Endangebot.',
          'Об’єм шерсті та довжина фінішу впливають на підсумковий розрахунок.',
          'Об’єм шерсті та довжина фінішу впливають на підсумковий розрахунок.'
        ),
      ],
    },
    {
      id: 'short-haired',
      title: t('Kurzhaarrassen', 'Short-haired breeds', 'Гладкошерстные породы', 'Гладкошерсті породи'),
      summary: t(
        'Basispflege für gesunde Haut, Glanz und Hygiene.',
        'Basic care that supports healthy skin, coat shine and hygiene.',
        'Базовый уход, который поддерживает кожу, блеск шерсти и гигиену.',
        'Базовий догляд, який підтримує шкіру, блиск шерсті та гігієну.',
      ),
      breeds: {
        de: ['Dobermann', 'Dalmatiner', 'Boxer', 'Weimaraner', 'Ungarische Vizsla'],
        en: ['Dobermann', 'Dalmatian', 'Boxer', 'Weimaraner', 'Vizsla'],
        ru: ['Доберман', 'Далматин', 'Боксер', 'Веймаранер', 'Венгерская выжла'],
        uk: ['Доберман', 'Далматин', 'Боксер', 'Веймаранер', 'Угорська вижла'],
      },
      services: ['bath', 'dry', 'nails', 'ears'],
      priceRows: [
        { label: t('Klein / mittel', 'Small / medium', 'Малые / средние', 'Малі / середні'), price: t('от 45 €', 'from 45 €', 'от 45 €', 'від 45 €') },
        { label: t('Groß', 'Large', 'Крупные', 'Великі'), price: t('от 60 €', 'from 60 €', 'от 60 €', 'від 60 €') },
      ],
      notes: [
        t(
          'Пакет строится вокруг купания, сушки, когтей и ушей без лишнего объема.',
          'Dieses Paket konzentriert sich auf Baden, Föhnen, Krallen und Ohren ohne unnötiges Volumen.',
          'Пакет будується навколо купання, сушіння, кігтів і вух без зайвого об’єму.',
          'Пакет будується навколо купання, сушіння, кігтів і вух без зайвого об’єму.'
        ),
      ],
    },
    {
      id: 'double-coat-longhair',
      title: t('Langhaarrassen mit Doppelfell', 'Long-haired double-coat breeds', 'Длинношерстные породы с двойной шерстью', 'Довгошерсті породи з подвійною шерстю'),
      summary: t(
        'Dichtes Unterfell, Volumen und eine klare Form nach dem Trocknen.',
        'Dense undercoat, volume and a defined shape after drying.',
        'Плотный подшёрсток, объём и выразительное восстановление формы после сушки.',
        'Щільний підшерсток, об’єм і виразне відновлення форми після сушіння.',
      ),
      breeds: {
        de: ['Siberian Husky', 'Samojede', 'Malamute', 'Akita', 'Weißer Schweizer Schäferhund', 'Deutscher Schäferhund', 'Golden Retriever', 'Berner Sennenhund', 'Neufundländer'],
        en: ['Siberian Husky', 'Samoyed', 'Malamute', 'Akita', 'White Swiss Shepherd', 'German Shepherd', 'Golden Retriever', 'Bernese Mountain Dog', 'Newfoundland'],
        ru: ['Хаски', 'Самоед', 'Маламут', 'Акита', 'Белая швейцарская овчарка', 'Немецкая овчарка', 'Голден ретривер', 'Бернский зенненхунд', 'Ньюфаундленд'],
        uk: ['Хаскі', 'Самоїд', 'Маламут', 'Акіта', 'Біла швейцарська вівчарка', 'Німецька вівчарка', 'Голден ретривер', 'Бернський зенненхунд', 'Ньюфаундленд'],
      },
      services: ['bath', 'dry', 'brushing', 'undercoat', 'deshedding'],
      priceRows: [
        { label: t('Komplettpflege', 'Full care', 'Полный уход', 'Повний догляд'), price: t('от 140 €', 'from 140 €', 'от 140 €', 'від 140 €') },
        { label: t('Express-Fellwechsel', 'Express shedding', 'Экспресс-линька', 'Експрес-лінька'), price: t('от 120 €', 'from 120 €', 'от 120 €', 'від 120 €') },
      ],
      notes: [
        t(
          'Чем больше подшерстка и чем плотнее шерсть, тем выше объем работы и время сушки.',
          'Je dichter Unterfell und Fell sind, desto mehr Zeit brauchen Finish und Trocknung.',
          'Чим більше підшерстя і щільніша шерсть, тим більший обсяг роботи й час сушіння.',
          'Чим більше підшерстя і щільніша шерсть, тим більший обсяг роботи й час сушіння.'
        ),
      ],
    },
    {
      id: 'express-shedding',
      title: t('Express-Fellwechsel', 'Express deshedding', 'Экспресс-линька', 'Експрес-линька'),
      summary: t(
        'Separate Kategorie für das schnelle Entfernen loser Haare und von Unterwolle.',
        'Separate category for the quick removal of shed hair and undercoat.',
        'Отдельная категория для быстрого удаления выпавшей шерсти и подшёрстка.',
        'Окрема категорія для швидкого видалення випалої шерсті та підшерстя.',
      ),
      breeds: {
        de: ['Kleine Hunde', 'Mittelgroße Hunde', 'Große Hunde', 'Riesige Hunde'],
        en: ['Small dogs', 'Medium dogs', 'Large dogs', 'Giant dogs'],
        ru: ['Маленькие собаки', 'Средние собаки', 'Крупные собаки', 'Гигантские собаки'],
        uk: ['Малі собаки', 'Середні собаки', 'Великі собаки', 'Гігантські собаки'],
      },
      services: ['bath', 'dry', 'brushing', 'undercoat', 'deshedding'],
      priceRows: [
        { label: t('Klein', 'Small', 'Малые', 'Малі'), price: t('от 70 €', 'from 70 €', 'от 70 €', 'від 70 €') },
        { label: t('Mittel', 'Medium', 'Средние', 'Середні'), price: t('от 70 €', 'from 70 €', 'от 70 €', 'від 70 €') },
        { label: t('Groß', 'Large', 'Крупные', 'Великі'), price: t('80–100 €', '80–100 €', '80–100 €', '80–100 €') },
        { label: t('Riesig', 'Giant', 'Гигантские', 'Гігантські'), price: t('от 120 €', 'from 120 €', 'от 120 €', 'від 120 €') },
      ],
      notes: [
        t(
          'Процедура снижает количество выпадающей шерсти, но не отменяет естественную линьку.',
          'Die Behandlung reduziert loses Fell, stoppt den natürlichen Fellwechsel aber nicht.',
          'Процедура зменшує кількість шерсті, що випадає, але не скасовує природну линьку.',
          'Процедура зменшує кількість шерсті, що випадає, але не скасовує природну линьку.'
        ),
      ],
    },
    {
      id: 'additional-services',
      title: t('Zusatzleistungen', 'Additional services', 'Дополнительные услуги', 'Додаткові послуги'),
      summary: t(
        'Ein separater Bereich für Zusatzpflege, die oft mit der Hauptleistung kombiniert wird.',
        'A separate block for care that is often added to the main service.',
        'Отдельный блок для ухода, который часто добавляется к основной процедуре.',
        'Окремий блок для догляду, який часто додається до основної процедури.',
      ),
      breeds: {
        de: ['Zusatzleistungen nach Bedarf'],
        en: ['Add-on services as needed'],
        ru: ['Дополнительные услуги по необходимости'],
        uk: ['Додаткові послуги за потреби'],
      },
      services: ['nails', 'ears', 'earHair', 'paws', 'dematting', 'spa', 'ozone', 'mask', 'teeth'],
      priceRows: [
        { label: t('Krallen schneiden', 'Nail trim', 'Подрезание когтей', 'Підрізання кігтів'), price: t('15 €', '15 €', '15 €', '15 €') },
        { label: t('Ohren reinigen', 'Ear cleaning', 'Чистка ушей', 'Чистка вух'), price: t('15 €', '15 €', '15 €', '15 €') },
        { label: t('Ohrenhaare entfernen', 'Removing ear hair', 'Удаление волос из ушей', 'Видалення волосся з вух'), price: t('по запросу', 'on request', 'по запросу', 'за запитом') },
        { label: t('Pfotenpflege', 'Paw care', 'Обработка лап', 'Обробка лап'), price: t('по запросу', 'on request', 'по запросу', 'за запитом') },
        { label: t('Entfilzen', 'Dematting', 'Распутывание колтунов', 'Розплутування ковтунів'), price: t('1 € / мин', '1 € / min', '1 € / мин', '1 € / хв') },
        { label: t('SPA', 'SPA', 'СПА', 'СПА'), price: t('от 15 €', 'from 15 €', 'от 15 €', 'від 15 €') },
        { label: t('Ozontherapie', 'Ozone therapy', 'Озонотерапия', 'Озонотерапія'), price: t('от 15 €', 'from 15 €', 'от 15 €', 'від 15 €') },
        { label: t('Aufbau-Maske', 'Restorative mask', 'Восстанавливающая маска', 'Відновлювальна маска'), price: t('от 15 €', 'from 15 €', 'от 15 €', 'від 15 €') },
        { label: t('Ultraschall-Zahnpflege', 'Ultrasonic teeth cleaning', 'Ультразвуковая чистка зубов', 'Ультразвукова чистка зубів'), price: t('от 100 €', 'from 100 €', 'от 100 €', 'від 100 €') },
      ],
      notes: [
        t(
          'Некоторые услуги могут сочетаться с основной процедурой и пересчитываются индивидуально.',
          'Einige Leistungen lassen sich mit der Hauptbehandlung kombinieren und werden individuell berechnet.',
          'Деякі послуги можна поєднувати з основною процедурою, і вони рахуються індивідуально.',
          'Деякі послуги можна поєднувати з основною процедурою, і вони рахуються індивідуально.'
        ),
      ],
    },
  ];

  global.PricePageCatalog = {
    locales,
    serviceLabels,
    categories,
    bookingHref: {
      de: 'onlayn-bronirovanie.html',
      en: 'onlayn-bronirovanie.html',
      ru: 'onlayn-bronirovanie.html',
      uk: 'onlayn-bronirovanie.html',
    },
  };
})(window);
