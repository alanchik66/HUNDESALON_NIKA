(function initPriceLocales(global) {
  const catalog = global.PricePageCatalog;
  if (!catalog?.categoriesByLocale?.ru) return;
  const russianServiceLabels = Object.fromEntries(
    Object.entries(catalog.serviceLabels).map(([key, value]) => [key, value?.ru || ''])
  );
  const localized = (de, en, uk) => ({ de, en, ru: '', uk });
  const service = (de, en, uk) => ({ de, en, ru: '', uk });

  Object.assign(catalog.serviceLabels, {
    conditioning: service('Konditionierung', 'Conditioning', 'Кондиціонування'),
    hygiene: service('Hygienepflege', 'Hygiene care', 'Гігієнічний догляд'),
    grooming: service('Schneiden und Formen', 'Clipping and styling', 'Стрижка та оформлення'),
    eyeCare: service('Augenpflege', 'Eye care', 'Догляд за очима'),
    earCare: service('Ohrenpflege', 'Ear care', 'Догляд за вухами'),
    coatCare: service('Fellpflege', 'Coat care', 'Догляд за шерстю'),
    professionalDry: service('Professionelles Trocknen', 'Professional drying', 'Професійне сушіння'),
    deshedding: service('Entfernen abgestorbener Haare und Unterwolle', 'Dead coat and undercoat removal', 'Видалення відмерлої шерсті й підшерстя'),
    puppyIntro: service('Welpen-Eingewöhnung', 'Puppy introduction grooming', 'Знайомство цуценяти з грумінгом'),
  });
  ['conditioning', 'hygiene', 'grooming', 'eyeCare', 'earCare', 'coatCare', 'professionalDry', 'deshedding', 'puppyIntro'].forEach(key => {
    catalog.serviceLabels[key].ru = russianServiceLabels[key] || catalog.serviceLabels[key].ru;
  });

  const rows = (de, en, uk, prices) => prices.map((price, index) => ({
    label: localized(de[index], en[index], uk[index]),
    price: localized(price.de, price.en, price.uk),
  }));
  const copy = (de, en, uk, breeds, priceLabels, prices) => ({
    title: localized(de, en, uk),
    breeds: { de: breeds.de, en: breeds.en, uk: breeds.uk },
    priceRows: rows(priceLabels.de, priceLabels.en, priceLabels.uk, prices),
  });
  const base = catalog.categoriesByLocale.ru;
  const get = id => base.find(category => category.id === id);
  const summaries = {
    'ru-small-growing-coat': { de: 'Komplettpflege für kleine Rassen mit ständig wachsendem Fell.', en: 'Full care for small breeds with continuously growing coats.', uk: 'Комплексний догляд для малих порід із шерстю, що постійно росте.' },
    'ru-poodles-bichons': { de: 'Sorgfältige Pflege für lockiges und voluminöses Fell.', en: 'Detailed care for curly and voluminous coats.', uk: 'Ретельний догляд за кучерявою та об’ємною шерстю.' },
    'ru-spitz': { de: 'Pflege von dichtem Unterfell, natürlichem Volumen und Form.', en: 'Care for dense undercoat, natural volume and shape.', uk: 'Догляд за щільним підшерстям, природним об’ємом і формою.' },
    'ru-double-coat': { de: 'Komplettpflege für Rassen mit dichtem Unterfell.', en: 'Full care for breeds with dense undercoats.', uk: 'Комплексний догляд за породами з щільним підшерстям.' },
    'ru-spaniels': { de: 'Form, Volumen und sauberes Finish für Spaniels.', en: 'Shape, volume and a neat finish for spaniels.', uk: 'Форма, об’єм та акуратне оформлення шерсті спанієлів.' },
    'ru-wire-coat': { de: 'Schneiden oder Handstripping passend zur rauen Fellstruktur.', en: 'Clipping or hand stripping for wire coat texture.', uk: 'Стрижка або ручний тримінг з урахуванням структури жорсткої шерсті.' },
    'ru-short-coat': { de: 'Komplette Pflege nach Größe des kurzhaarigen Hundes.', en: 'Full care package according to the dog’s size.', uk: 'Повний комплекс догляду відповідно до розміру короткошерстого собаки.' },
    'ru-large-dogs': { de: 'Komplettpflege für große Rassen mit viel Fell.', en: 'Full care for large breeds with a substantial coat volume.', uk: 'Комплексний догляд для великих порід із великим об’ємом шерсті.' },
    'ru-cats-grooming': { de: 'Die Leistung findet im Beisein der Halterin oder des Halters statt.', en: 'The service is performed in the owner’s presence.', uk: 'Послуга проводиться у присутності власника.' },
    'ru-small-animals': { de: 'Schonende Hygiene für Meerschweinchen und Kaninchen.', en: 'Gentle hygiene care for guinea pigs and rabbits.', uk: 'Бережний гігієнічний догляд для морських свинок і кроликів.' },
    'ru-additional-services': { de: 'Zusatzpflege, die zur Hauptleistung ergänzt werden kann.', en: 'Additional care that can be added to the main service.', uk: 'Додатковий догляд, який можна додати до основної процедури.' },
    'ru-important-information': { de: 'Der Preis „ab“ hängt vom tatsächlichen Arbeitsaufwand ab.', en: 'Prices are “from” and depend on the actual amount of work.', uk: 'Вартість вказана «від» і залежить від фактичного обсягу роботи.' },
  };
  const dogServiceNotes = {
    full: {
      de: 'Komplett-Grooming umfasst Beratung, Ausbürsten, professionelles Waschen und Trocknen, Schneiden und Formen des Fells, hygienische Pflege, Augen-, Ohren- und Krallenpflege sowie das abschließende Finish des Hundes.',
      en: 'Full grooming includes a consultation, brushing, professional washing and drying, clipping and coat styling, hygiene care, eye, ear and nail care, and the dog’s final finish.',
      uk: 'Повний грумінг включає консультацію, розчісування, професійне миття та сушіння, стрижку й оформлення шерсті, гігієнічний догляд, догляд за очима, вухами та кігтями і фінальне оформлення собаки.',
    },
    poodleFull: {
      de: 'Bei Pudeln und Bichons umfasst das Komplett-Grooming Beratung, Ausbürsten, professionelles Waschen, Konditionierung und Trocknen, Schneiden und Formen des Fells, hygienische Pflege, Augen-, Ohren- und Krallenpflege sowie das abschließende Finish des Hundes.',
      en: 'For poodles and bichons, full grooming includes a consultation, brushing, professional washing, conditioning and drying, clipping and coat styling, hygiene care, eye, ear and nail care, and the dog’s final finish.',
      uk: 'Для пуделів і бішонів повний грумінг включає консультацію, розчісування, професійне миття, кондиціонування та сушіння, стрижку й оформлення шерсті, гігієнічний догляд, догляд за очима, вухами та кігтями і фінальне оформлення собаки.',
    },
    spitzFull: {
      de: 'Bei Spitzrassen umfasst die Komplettpflege Baden, professionelles Trocknen, gründliches Ausbürsten der Unterwolle, Fellpflege und Formgebung sowie Augen-, Ohren-, Krallen- und Hygienepflege.',
      en: 'For Spitz breeds, full grooming includes bathing, professional drying, thorough undercoat brushing, coat care and shape finishing, plus eye, ear, nail and hygiene care.',
      uk: 'Для шпіців комплексний грумінг включає купання, професійне сушіння, ретельне вичісування підшерстя, догляд за шерстю та оформлення форми, а також догляд за очима, вухами, кігтями і гігієнічний догляд.',
    },
    bath: {
      de: 'Baden und Hygienepflege umfassen professionelles Waschen und Trocknen, Ausbürsten, Krallenpflege, Ohrenreinigung sowie den hygienischen Schnitt an Pfoten, Fang, im Leistenbereich und unter der Rute.',
      en: 'Bath and hygiene care include professional washing and drying, brushing, nail care, ear cleaning, and a hygiene trim of the paws, muzzle, groin area, and under-tail area.',
      uk: 'Купання та гігієнічний догляд включають професійне миття й сушіння, розчісування, обробку кігтів, очищення вух, гігієнічну стрижку лап, морди, пахової зони та зони під хвостом.',
    },
    complexCare: {
      de: 'Die Komplettpflege umfasst professionelles Waschen und Trocknen, gründliches Ausbürsten der Unterwolle, Fellpflege sowie Augen-, Ohren-, Krallen- und Hygienepflege.',
      en: 'Full care includes professional washing and drying, thorough undercoat brushing, coat care, and eye, ear, nail and hygiene care.',
      uk: 'Комплексний догляд включає професійне миття та сушіння, ретельне вичісування підшерстя, догляд за шерстю, очима, вухами, кігтями та гігієнічний догляд.',
    },
    wireCoat: {
      de: 'Schneiden und Formen umfassen Beratung, professionelles Waschen und Trocknen, Fellpflege, hygienische Pflege sowie Augen-, Ohren- und Krallenpflege.',
      en: 'Clipping and styling include a consultation, professional washing and drying, coat shaping, hygiene care, and eye, ear and nail care.',
      uk: 'Стрижка та оформлення включають консультацію, професійне миття й сушіння, догляд та оформлення шерсті, гігієнічний догляд, догляд за очима, вухами та кігтями.',
    },
    trim: {
      de: 'Handstripping wird auf Anfrage und abhängig von Fellstruktur und Fellzustand angeboten.',
      en: 'Hand stripping is available on request and depends on coat structure and condition.',
      uk: 'Ручний тримінг виконується за запитом з урахуванням структури та стану шерсті.',
    },
    shortCoat: {
      de: 'Die Komplettpflege umfasst Baden, professionelles Trocknen, Hygienepflege, Augen- und Ohrenpflege, Krallenschneiden, Ausbürsten und Fellpflege.',
      en: 'Full care includes bathing, professional drying, hygiene care, eye and ear care, nail trimming, brushing, and coat care.',
      uk: 'Повний догляд включає купання, професійне сушіння, гігієнічний догляд, догляд за очима й вухами, обробку кігтів, вичісування та догляд за шерстю.',
    },
    largeDogs: {
      de: 'Die Komplettpflege umfasst Waschen, professionelles Trocknen, gründliches Ausbürsten, Fellpflege sowie Augen-, Ohren-, Krallen- und Hygienepflege.',
      en: 'Full care includes washing, professional drying, thorough brushing, coat care, and eye, ear, nail and hygiene care.',
      uk: 'Повний догляд включає миття, професійне сушіння, ретельне вичісування, догляд за шерстю, очі, вуха, кігті та гігієнічний догляд.',
    },
  };
  const otherServiceNotes = {
    cats: {
      de: 'Ausbürsten und Schneiden umfassen professionelles Ausbürsten, das Entfernen abgestorbener Haare und Unterwolle, Schneiden sowie Augen-, Ohren-, Krallen- und Hygienepflege.',
      en: 'Brushing and clipping include professional brushing, removal of dead hair and undercoat, clipping, and eye, ear, nail and hygiene care.',
      uk: 'Вичісування та стрижка включають професійне вичісування, видалення відмерлої шерсті й підшерстя, стрижку, догляд за очима та вухами, обробку кігтів і гігієнічний догляд.',
    },
    catsBath: {
      de: 'Bei der Variante mit Baden kommen Baden und professionelles Trocknen hinzu. Die Leistung findet im Beisein der Halterin oder des Halters statt.',
      en: 'With the bathing option, bathing and professional drying are added. The service is performed in the owner’s presence.',
      uk: 'У варіанті з купанням додатково виконуються купання та професійне сушіння. Послуга проводиться у присутності власника.',
    },
    smallAnimals: {
      de: 'Bei Meerschweinchen umfasst die Pflege Ausbürsten, das Entfernen abgestorbener Haare, bei Bedarf Kürzen sowie Augen-, Ohren- und Hygienepflege. Baden und Pflege werden als eigene Leistung angeboten; bei Kaninchen gehört Baden nicht zur Standardpflege.',
      en: 'For guinea pigs, care includes brushing, removal of dead hair, trimming when needed, and eye, ear and hygiene care. Bath and care are offered as a separate service; bathing is not part of standard rabbit care.',
      uk: 'Для морських свинок догляд включає вичісування, видалення відмерлої шерсті, за потреби підрівнювання, а також догляд за очима, вухами та гігієнічний догляд. Купання та догляд пропонуються як окрема послуга; купання не входить до стандартного догляду за кроликами.',
    },
    additional: {
      de: 'Zu den Zusatzleistungen gehören Krallenschneiden nach Größe, Ultraschall-Zahnpflege ohne Narkose bis 6 kg, Aufbau-/Wellnessmaske, Ozontherapie und der erste Termin zur Welpengewöhnung.',
      en: 'Additional services include nail trimming by size, ultrasonic teeth cleaning without anaesthesia up to 6 kg, a restorative or wellness mask, ozone therapy and first puppy grooming.',
      uk: 'До додаткових послуг належать підрізання кігтів відповідно до розміру, ультразвукова чистка зубів без наркозу до 6 кг, відновлювальна або оздоровча маска, озонотерапія та перший грумінг цуценяти.',
    },
    additionalDental: {
      de: 'Bei gemeinsamer Buchung mit der Pflege gibt es auf die Ultraschall-Zahnpflege 30 % Rabatt; sie ersetzt keine tierärztliche Zahnbehandlung.',
      en: 'When booked together with grooming, ultrasonic teeth cleaning receives a 30% discount; it does not replace veterinary dental treatment.',
      uk: 'При одночасному бронюванні з грумінгом на ультразвукову чистку зубів діє знижка 30%; процедура не замінює ветеринарне стоматологічне лікування.',
    },
    puppy: {
      de: 'Der erste Termin zur Welpengewöhnung dient der sanften Gewöhnung an Salon und Pflege.',
      en: 'The first puppy grooming visit is designed to gently familiarise the puppy with the salon and grooming care.',
      uk: 'Перший грумінг цуценяти допомагає м’яко познайомити його із салоном і процедурами догляду.',
    },
    important: {
      de: 'Der Preis „ab“ hängt von Fellzustand, Länge und Dichte, Unterwolle, Verfilzungen, Verhalten und tatsächlichem Arbeitsaufwand ab.',
      en: 'The “from” price depends on coat condition, length and density, undercoat, mats, behaviour and the actual amount of work.',
      uk: 'Вартість «від» залежить від стану, довжини й густоти шерсті, кількості підшерстя, ковтунів, поведінки тварини та фактичного обсягу роботи.',
    },
    mats: {
      de: 'Bei starker Verfilzung oder vielen Knoten kann sich der Preis wegen des zusätzlichen Arbeitsaufwands erhöhen.',
      en: 'Severe matting or a large number of mats may increase the price because of the additional work required.',
      uk: 'За сильної зваляності шерсті або великої кількості ковтунів вартість може бути збільшена через додатковий обсяг роботи.',
    },
    safety: {
      de: 'Bei starkem Stress, Widerstand oder aggressivem Verhalten wird zusätzliche Zeit separat berechnet. Wenn die Behandlung unsicher wird, kann sie abgebrochen werden.',
      en: 'In cases of severe stress, resistance or aggressive behaviour, additional time is charged separately. If the treatment becomes unsafe, it may be stopped.',
      uk: 'За сильного стресу, опору або агресивної поведінки додатковий час оплачується окремо. Якщо проведення процедури стає небезпечним, її можуть припинити.',
    },
  };
  const serviceNotesByCategory = {
    'ru-small-growing-coat': [dogServiceNotes.full, dogServiceNotes.bath],
    'ru-poodles-bichons': [dogServiceNotes.poodleFull, dogServiceNotes.bath],
    'ru-spitz': [dogServiceNotes.spitzFull],
    'ru-double-coat': [dogServiceNotes.complexCare],
    'ru-spaniels': [dogServiceNotes.full, dogServiceNotes.bath],
    'ru-wire-coat': [dogServiceNotes.wireCoat, dogServiceNotes.trim, dogServiceNotes.bath],
    'ru-short-coat': [dogServiceNotes.shortCoat],
    'ru-large-dogs': [dogServiceNotes.largeDogs],
    'ru-cats-grooming': [otherServiceNotes.cats, otherServiceNotes.catsBath],
    'ru-small-animals': [otherServiceNotes.smallAnimals],
    'ru-additional-services': [otherServiceNotes.additional, otherServiceNotes.additionalDental, otherServiceNotes.puppy],
    'ru-important-information': [otherServiceNotes.important, otherServiceNotes.mats, otherServiceNotes.safety],
  };
  const apply = (lang, definitions) => {
    catalog.categoriesByLocale[lang] = definitions.map(definition => {
      const category = { ...get(definition.id), ...definition.copy };
      category.breeds = definition.copy.breeds;
      category.priceRows = definition.copy.priceRows;
      category.summary = { [lang]: summaries[definition.id]?.[lang] || definition.copy.title[lang] };
      category.notes = (serviceNotesByCategory[definition.id] || [{ [lang]: summaries[definition.id]?.[lang] || definition.copy.title[lang] }])
        .map(noteText => ({ [lang]: noteText[lang] }));
      return category;
    });
  };

  const prices = {
    main80: { de: 'ab 80 €', en: 'from €80', uk: 'від 80 €' },
    main90: { de: 'ab 90 €', en: 'from €90', uk: 'від 90 €' },
    main105: { de: 'ab 105 €', en: 'from €105', uk: 'від 105 €' },
    main130: { de: 'ab 130 €', en: 'from €130', uk: 'від 130 €' },
    bath60: { de: 'ab 60 €', en: 'from €60', uk: 'від 60 €' },
    bath70: { de: 'ab 70 €', en: 'from €70', uk: 'від 70 €' },
    bath85: { de: 'ab 85 €', en: 'from €85', uk: 'від 85 €' },
    main90x: { de: 'ab 90 €', en: 'from €90', uk: 'від 90 €' },
    main60: { de: 'ab 60 €', en: 'from €60', uk: 'від 60 €' },
    main70: { de: 'ab 70 €', en: 'from €70', uk: 'від 70 €' },
    main90l: { de: 'ab 90 €', en: 'from €90', uk: 'від 90 €' },
    main30: { de: 'ab 30 €', en: 'from €30', uk: 'від 30 €' },
    main40: { de: 'ab 40 €', en: 'from €40', uk: 'від 40 €' },
    main35: { de: 'ab 35 €', en: 'from €35', uk: 'від 35 €' },
    main50: { de: 'ab 50 €', en: 'from €50', uk: 'від 50 €' },
    from15: { de: 'ab 15 €', en: 'from €15', uk: 'від 15 €' },
    from20: { de: 'ab 20 €', en: 'from €20', uk: 'від 20 €' },
    from100: { de: 'ab 100 €', en: 'from €100', uk: 'від 100 €' },
    request: { de: 'auf Anfrage', en: 'on request', uk: 'за запитом' },
  };
  const p = key => prices[key];
  const breed = (de, en, uk) => ({ de, en, uk });
  const make = (id, title, breeds, labels, priceValues) => ({ id, copy: copy(title.de, title.en, title.uk, breeds, labels, priceValues) });

  const common = {
    small: make('ru-small-growing-coat', { de: '1. Kleine Hunde – ständig wachsendes Fell', en: '1. Small dogs — continuously growing coat', uk: '1. Маленькі собаки — шерсть, що постійно росте' }, breed(['Yorkshire Terrier', 'Biewer Yorkshire Terrier', 'Malteser', 'Shih Tzu', 'Havaneser', 'Bologneser', 'Lhasa Apso'], ['Yorkshire Terrier', 'Biewer Yorkshire Terrier', 'Maltese', 'Shih Tzu', 'Havanese', 'Bolognese', 'Lhasa Apso'], ['Йоркширський тер’єр', 'Бівер-йоркширський тер’єр', 'Мальтійська болонка — мальтезе', 'Ши-тцу', 'Гаванська болонка — гаванез', 'Болоньєз', 'Лхаса апсо']), { de: ['Komplettpflege', 'Baden + Hygienepflege'], en: ['Full grooming', 'Bath + hygiene care'], uk: ['Комплексний грумінг', 'Купання + гігієнічний догляд'] }, [p('main80'), p('bath60')]),
    poodles: make('ru-poodles-bichons', { de: '2. Pudel, Bichons und Pudeltypen', en: '2. Poodles, bichons and poodle-type breeds', uk: '2. Пуделі, бішони та пудельні породи' }, breed(['Toypudel', 'Zwergpudel', 'Kleinpudel', 'Mittelpudel', 'Großpudel', 'Bichon Frisé', 'Coton de Tuléar', 'Löwchen', 'Maltipoo'], ['Toy Poodle', 'Miniature Poodle', 'Small Poodle', 'Medium Poodle', 'Standard Poodle', 'Bichon Frise', 'Coton de Tulear', 'Löwchen', 'Maltipoo'], ['Той-пудель', 'Мініатюрний пудель', 'Малий пудель', 'Середній пудель', 'Великий пудель', 'Бішон фрізе', 'Котон де Тулеар', 'Левовий собачка', 'Мальтіпу']), { de: ['Komplettpflege', 'Baden + Hygienepflege'], en: ['Full grooming', 'Bath + hygiene care'], uk: ['Комплексний грумінг', 'Купання + гігієнічний догляд'] }, [p('main90'), p('bath70')]),
    spitz: make('ru-spitz', { de: '3. Spitze', en: '3. Spitz breeds', uk: '3. Шпіци' }, breed(['Zwergspitz / Pomeranian', 'Deutscher Spitz klein', 'Deutscher Spitz mittel', 'Deutscher Spitz groß'], ['Pomeranian / German Spitz', 'German Spitz, small', 'German Spitz, medium', 'German Spitz, large'], ['Померанський шпіц (цвергшпіц)', 'Німецький шпіц малий', 'Німецький шпіц середній', 'Німецький шпіц великий']), { de: ['Komplettpflege'], en: ['Full grooming'], uk: ['Комплексний грумінг'] }, [p('main90')]),
    double: make('ru-double-coat', { de: '4. Doppeltes Fell', en: '4. Double coat', uk: '4. Подвійний тип шерсті' }, breed(['Shiba Inu', 'Pekingese', 'Weitere Rassen mit dichtem Unterfell'], ['Shiba Inu', 'Pekingese', 'Other dense double-coated breeds'], ['Шиба-іну', 'Пекінес', 'Інші породи з подвійною шерстю та щільним підшерстям']), { de: ['Komplettpflege'], en: ['Full care'], uk: ['Комплексний догляд'] }, [p('main90')]),
    spaniels: make('ru-spaniels', { de: '5. Spaniels', en: '5. Spaniels', uk: '5. Спанієлі' }, breed(['Englischer Cocker Spaniel', 'Amerikanischer Cocker Spaniel', 'Cavalier King Charles Spaniel', 'Russischer Spaniel'], ['English Cocker Spaniel', 'American Cocker Spaniel', 'Cavalier King Charles Spaniel', 'Russian Spaniel'], ['Англійський кокер-спанієль', 'Американський кокер-спанієль', 'Кавалер Кінг Чарльз спанієль', 'Російський спанієль']), { de: ['Komplettpflege', 'Baden + Hygienepflege'], en: ['Full grooming', 'Bath + hygiene care'], uk: ['Комплексний грумінг', 'Купання + гігієнічний догляд'] }, [p('main105'), p('bath85')]),
    wire: make('ru-wire-coat', { de: '6. Rauhaarige Rassen', en: '6. Wire-coated breeds', uk: '6. Жорсткошерсті породи' }, breed(['West Highland White Terrier', 'Cairn Terrier', 'Jack Russell Terrier', 'Parson Russell Terrier', 'Zwergschnauzer', 'Mittelschnauzer'], ['West Highland White Terrier', 'Cairn Terrier', 'Jack Russell Terrier', 'Parson Russell Terrier', 'Miniature Schnauzer', 'Standard Schnauzer'], ['Вест-хайленд-вайт-тер’єр', 'Керн-тер’єр', 'Джек-рассел-тер’єр', 'Парсон-рассел-тер’єр', 'Цвергшнауцер', 'Міттельшнауцер']), { de: ['Schneiden', 'Trimmen / Handstripping', 'Baden + Hygienepflege'], en: ['Clipping', 'Hand stripping', 'Bath + hygiene care'], uk: ['Стрижка', 'Тримінг / Handstripping', 'Купання + гігієнічний догляд'] }, [p('main90'), p('request'), p('bath70')]),
    short: make('ru-short-coat', { de: '7. Kurzhaarige Hunde', en: '7. Short-coated dogs', uk: '7. Короткошерсті собаки' }, breed(['Kurzhaar-Chihuahua', 'Toy-Terrier', 'Zwergpinscher', 'Pinscher', 'Französische Bulldogge', 'Mops', 'Beagle', 'Kurzhaar-Dackel', 'Dobermann', 'Dalmatiner'], ['Short-haired Chihuahua', 'Toy Terrier', 'Miniature Pinscher', 'Pinscher', 'French Bulldog', 'Pug', 'Beagle', 'Short-haired Dachshund', 'Dobermann', 'Dalmatian'], ['Чихуахуа гладкошерстий', 'Той-тер’єр', 'Мініатюрний пінчер', 'Пінчер', 'Французький бульдог', 'Мопс', 'Бігль', 'Такса гладкошерста', 'Доберман', 'Далматин']), { de: ['XS – kleine Rassen', 'S/M – kleine und mittelgroße Rassen', 'L – große Rassen'], en: ['XS — small breeds', 'S/M — small and medium breeds', 'L — large breeds'], uk: ['XS — мініатюрні породи', 'S/M — малі та середні породи', 'L — великі породи'] }, [p('main60'), p('main70'), p('main90l')]),
    large: make('ru-large-dogs', { de: '8. Große Hunde', en: '8. Large dogs', uk: '8. Великі собаки' }, breed(['Labrador Retriever', 'Golden Retriever', 'Deutscher Schäferhund', 'Belgischer Schäferhund', 'Siberian Husky', 'Akita Inu', 'Samojede', 'Bernhardiner', 'Bobtail', 'Berner Sennenhund', 'Neufundländer', 'Leonberger'], ['Labrador Retriever', 'Golden Retriever', 'German Shepherd', 'Belgian Shepherd', 'Siberian Husky', 'Akita Inu', 'Samoyed', 'Saint Bernard', 'Bobtail', 'Bernese Mountain Dog', 'Newfoundland', 'Leonberger'], ['Лабрадор-ретривер', 'Золотистий ретривер', 'Німецька вівчарка', 'Бельгійська вівчарка', 'Сибірський хаскі', 'Акіта-іну', 'Самоїд', 'Сенбернар', 'Бобтейл', 'Бернський зенненхунд', 'Ньюфаундленд', 'Леонбергер']), { de: ['Komplettpflege'], en: ['Full care'], uk: ['Комплексний догляд'] }, [p('main130')]),
    cats: make('ru-cats-grooming', { de: 'Katzen – Ausbürsten / Schneiden', en: 'Cats — brushing / clipping', uk: 'Коти — вичісування / стрижка' }, breed(['Katzen aller Rassen'], ['Cats of all breeds'], ['Коти всіх порід']), { de: ['Ausbürsten / Schneiden', 'Ausbürsten / Schneiden + Baden'], en: ['Brushing / clipping', 'Brushing / clipping + bath'], uk: ['Вичісування / стрижка', 'Вичісування / стрижка + купання'] }, [{ de: 'ab 60 €', en: 'from €60', uk: 'від 60 €' }, { de: 'ab 90 €', en: 'from €90', uk: 'від 90 €' }]),
    smallAnimals: make('ru-small-animals', { de: 'Kleintiere', en: 'Small animals', uk: 'Дрібні тварини' }, breed(['Meerschweinchen', 'Kaninchen'], ['Guinea pigs', 'Rabbits'], ['Морські свинки', 'Кролики']), { de: ['Meerschweinchen – Hygienepflege', 'Meerschweinchen – Baden + Pflege', 'Kaninchen – Ausbürsten + Hygienepflege'], en: ['Guinea pigs — hygiene care', 'Guinea pigs — bath + care', 'Rabbits — brushing + hygiene care'], uk: ['Морські свинки — гігієнічний догляд', 'Морські свинки — купання + догляд', 'Кролики — вичісування + гігієнічний догляд'] }, [p('main30'), p('main40'), p('main35')]),
    additional: make('ru-additional-services', { de: 'Zusatzleistungen', en: 'Additional services', uk: 'Додаткові послуги' }, breed(['Hunde', 'Katzen', 'Kleintiere'], ['Dogs', 'Cats', 'Small animals'], ['Собаки', 'Коти', 'Дрібні тварини']), { de: ['Krallen – kleine Tiere', 'Krallen – mittelgroße Tiere', 'Krallen – große Tiere', 'Ultraschall-Zahnpflege bis 6 kg', 'Aufbau- / Wellnessmaske', 'Ozontherapie', 'Erster Termin zur Welpengewöhnung'], en: ['Nail trim — small animals', 'Nail trim — medium animals', 'Nail trim — large animals', 'Ultrasonic teeth cleaning up to 6 kg', 'Restorative / wellness mask', 'Ozone therapy', 'First puppy grooming'], uk: ['Підрізання кігтів — малі тварини', 'Підрізання кігтів — середні тварини', 'Підрізання кігтів — великі тварини', 'Ультразвукова чистка зубів до 6 кг', 'Відновлювальна / оздоровча маска', 'Озонотерапія', 'Перший грумінг цуценяти'] }, [{ de: '7 €', en: '€7', uk: '7 €' }, { de: '10 €', en: '€10', uk: '10 €' }, { de: '12 €', en: '€12', uk: '12 €' }, p('from100'), p('from15'), p('from20'), p('main50')]),
    important: make('ru-important-information', { de: 'Wichtige Informationen', en: 'Important information', uk: 'Важлива інформація' }, breed(['Alle Tiere'], ['All animals'], ['Усі тварини']), { de: ['Zusätzliche Zeit'], en: ['Additional time'], uk: ['Додатковий час'] }, [{ de: 'je weitere 10 Minuten separat', en: 'each additional 10 minutes charged separately', uk: 'кожні додаткові 10 хвилин оплачуються окремо' }]),
  };

  const definitions = Object.values(common);
  apply('de', definitions);
  apply('en', definitions);
  apply('uk', definitions);
})(window);
