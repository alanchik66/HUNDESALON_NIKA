/*
 * HUNDESALON NIKA — Price configurator catalog
 * Breeds (DE market), grooming services, tier-based Richtpreise.
 */
(function initPriceCatalog(global) {
  const GROUP_ORDER = ['dogs', 'cats', 'others'];

  const groupLabels = {
    de: { dogs: 'Hunde', cats: 'Katzen', others: 'Andere Tiere', other: 'Andere / Mischling' },
    en: { dogs: 'Dogs', cats: 'Cats', others: 'Other pets', other: 'Other / mixed breed' },
    ru: { dogs: 'Собаки', cats: 'Кошки', others: 'Другие животные', other: 'Другое / метис' },
    uk: { dogs: 'Собаки', cats: 'Коти', others: 'Інші тварини', other: 'Інше / метис' },
  };

  const breedCatalog = {
    dogs: [
      ['affenpinscher', 'medium'],
      ['airedale-terrier', 'large'],
      ['akita', 'large_double'],
      ['alaskan-malamute', 'large_double'],
      ['american-staffordshire-terrier', 'medium'],
      ['australian-shepherd', 'large_double'],
      ['basenji', 'short'],
      ['basset-hound', 'medium'],
      ['beagle', 'medium'],
      ['bearded-collie', 'large_double'],
      ['bedlington-terrier', 'medium'],
      ['bernese-mountain-dog', 'giant'],
      ['bichon-frise', 'toy_long'],
      ['border-collie', 'large_double'],
      ['border-terrier', 'medium'],
      ['borzoi', 'large'],
      ['boston-terrier', 'short'],
      ['boxer', 'short'],
      ['briard', 'large_double'],
      ['bull-terrier', 'medium'],
      ['bullmastiff', 'giant'],
      ['cairn-terrier', 'medium'],
      ['cavalier-king-charles-spaniel', 'medium'],
      ['chihuahua', 'toy_long'],
      ['chow-chow', 'large_double'],
      ['cocker-spaniel', 'medium_cocker'],
      ['collie', 'large_double'],
      ['dachshund', 'medium'],
      ['dalmatian', 'short'],
      ['dobermann', 'short'],
      ['dogue-de-bordeaux', 'giant'],
      ['english-bulldog', 'medium'],
      ['english-cocker-spaniel', 'medium_cocker'],
      ['english-setter', 'large_double'],
      ['english-springer-spaniel', 'large_double'],
      ['flat-coated-retriever', 'large_double'],
      ['fox-terrier', 'medium'],
      ['french-bulldog', 'medium'],
      ['german-shepherd', 'large_double'],
      ['german-shorthaired-pointer', 'short'],
      ['german-spitz-klein', 'spitz'],
      ['german-spitz-mittel', 'spitz'],
      ['german-spitz-gross', 'spitz'],
      ['golden-retriever', 'large_double'],
      ['great-dane', 'giant'],
      ['greyhound', 'short'],
      ['havanese', 'toy_long'],
      ['hovawart', 'large_double'],
      ['irish-setter', 'large_double'],
      ['irish-wolfhound', 'giant'],
      ['jack-russell-terrier', 'medium'],
      ['king-charles-spaniel', 'toy_long'],
      ['komondor', 'giant'],
      ['kuvasz', 'giant'],
      ['labrador-retriever', 'short'],
      ['lagotto-romagnolo', 'medium'],
      ['leonberger', 'giant'],
      ['lhasa-apso', 'toy_long'],
      ['maltese', 'toy_long'],
      ['manchester-terrier', 'medium'],
      ['mastiff', 'giant'],
      ['miniature-pinscher', 'toy_long'],
      ['miniature-schnauzer', 'medium'],
      ['mudi', 'medium'],
      ['newfoundland', 'giant'],
      ['norfolk-terrier', 'medium'],
      ['norwich-terrier', 'medium'],
      ['old-english-sheepdog', 'large_double'],
      ['papillon', 'toy_long'],
      ['parson-russell-terrier', 'medium'],
      ['pekingese', 'toy_long'],
      ['pomeranian', 'spitz'],
      ['poodle-toy', 'toy_poodle'],
      ['poodle-miniature', 'poodle_dwarf'],
      ['poodle-medium', 'poodle_small'],
      ['poodle-standard', 'poodle_standard'],
      ['portuguese-water-dog', 'large_double'],
      ['pug', 'medium'],
      ['puli', 'large_double'],
      ['rhodesian-ridgeback', 'short'],
      ['rottweiler', 'large'],
      ['rough-collie', 'large_double'],
      ['samoyed', 'large_double'],
      ['schnauzer-standard', 'large'],
      ['schnauzer-giant', 'large'],
      ['scottish-terrier', 'medium'],
      ['shar-pei', 'medium'],
      ['shetland-sheepdog', 'medium'],
      ['shiba-inu', 'spitz'],
      ['shih-tzu', 'toy_long'],
      ['siberian-husky', 'large_double'],
      ['soft-coated-wheaten-terrier', 'large_double'],
      ['st-bernard', 'giant'],
      ['staffordshire-bull-terrier', 'medium'],
      ['tibetan-terrier', 'medium'],
      ['vizsla', 'short'],
      ['weimaraner', 'short'],
      ['west-highland-white-terrier', 'medium'],
      ['whippet', 'short'],
      ['yorkshire-terrier', 'toy_long'],
    ],
    cats: [
      ['abyssinian', 'cat_standard'],
      ['american-shorthair', 'cat_standard'],
      ['bengal', 'cat_standard'],
      ['birman', 'cat_standard'],
      ['british-shorthair', 'cat_standard'],
      ['burmese', 'cat_standard'],
      ['devon-rex', 'cat_standard'],
      ['domestic-shorthair', 'cat_standard'],
      ['domestic-longhair', 'cat_standard'],
      ['european-shorthair', 'cat_standard'],
      ['exotic-shorthair', 'cat_standard'],
      ['maine-coon', 'cat_large'],
      ['norwegian-forest-cat', 'cat_large'],
      ['oriental-shorthair', 'cat_standard'],
      ['persian', 'cat_standard'],
      ['ragdoll', 'cat_large'],
      ['russian-blue', 'cat_standard'],
      ['savannah', 'cat_large'],
      ['scottish-fold', 'cat_standard'],
      ['siamese', 'cat_standard'],
      ['siberian-cat', 'cat_large'],
      ['somali', 'cat_standard'],
      ['sphynx', 'cat_standard'],
      ['turkish-angora', 'cat_standard'],
    ],
    others: [
      ['rabbit', 'other_pet'],
      ['guinea-pig', 'other_pet'],
      ['ferret', 'other_pet'],
      ['chinchilla', 'other_pet'],
      ['degu', 'other_pet'],
      ['rat', 'other_pet'],
      ['hamster', 'other_pet'],
    ],
  };

  const breedNames = {
    'affenpinscher': { de: 'Affenpinscher', en: 'Affenpinscher', ru: 'Аффенпинчер', uk: 'Аффенпінчер' },
    'airedale-terrier': { de: 'Airedale Terrier', en: 'Airedale Terrier', ru: 'Эрдельтерьер', uk: 'Ерделтер\'єр' },
    'akita': { de: 'Akita', en: 'Akita', ru: 'Акита', uk: 'Акіта' },
    'alaskan-malamute': { de: 'Alaskan Malamute', en: 'Alaskan Malamute', ru: 'Аласкинский маламут', uk: 'Аласкинський маламут' },
    'american-staffordshire-terrier': { de: 'American Staffordshire Terrier', en: 'American Staffordshire Terrier', ru: 'Американский стаффордширский терьер', uk: 'Американський стаффордширський тер’єр' },
    'australian-shepherd': { de: 'Australian Shepherd', en: 'Australian Shepherd', ru: 'Австралийская овчарка', uk: 'Австралійська вівчарка' },
    'basenji': { de: 'Basenji', en: 'Basenji', ru: 'Басенджи', uk: 'Басенджі' },
    'basset-hound': { de: 'Basset Hound', en: 'Basset Hound', ru: 'Бассет-хаунд', uk: 'Басет-хаунд' },
    'beagle': { de: 'Beagle', en: 'Beagle', ru: 'Бигль', uk: 'Бігль' },
    'bearded-collie': { de: 'Bearded Collie', en: 'Bearded Collie', ru: 'Бородатый колли', uk: 'Бородатий колі' },
    'bedlington-terrier': { de: 'Bedlington Terrier', en: 'Bedlington Terrier', ru: 'Бедлингтон-терьер', uk: 'Бедлінгтон-тер’єр' },
    'bernese-mountain-dog': { de: 'Berner Sennenhund', en: 'Bernese Mountain Dog', ru: 'Бернский зенненхунд', uk: 'Бернський зенненхунд' },
    'bichon-frise': { de: 'Bichon Frisé', en: 'Bichon Frisé', ru: 'Бишон фризе', uk: 'Бішон фрізе' },
    'border-collie': { de: 'Border Collie', en: 'Border Collie', ru: 'Бордер-колли', uk: 'Бордер-колі' },
    'border-terrier': { de: 'Border Terrier', en: 'Border Terrier', ru: 'Бордер-терьер', uk: 'Бордер-тер\'єр' },
    'borzoi': { de: 'Barsoi', en: 'Borzoi', ru: 'Русская псовая борзая', uk: 'Російський псовий хорт' },
    'boston-terrier': { de: 'Boston Terrier', en: 'Boston Terrier', ru: 'Бостон-терьер', uk: 'Бостон-тер’єр' },
    'boxer': { de: 'Boxer', en: 'Boxer', ru: 'Боксёр', uk: 'Боксер' },
    'briard': { de: 'Briard', en: 'Briard', ru: 'Бриар', uk: 'Бріар' },
    'bull-terrier': { de: 'Bullterrier', en: 'Bull Terrier', ru: 'Бультерьер', uk: 'Бультер\'єр' },
    'bullmastiff': { de: 'Bullmastiff', en: 'Bullmastiff', ru: 'Бульмастиф', uk: 'Бульмастиф' },
    'cairn-terrier': { de: 'Cairn Terrier', en: 'Cairn Terrier', ru: 'Керн-терьер', uk: 'Керн-тер\'єр' },
    'cavalier-king-charles-spaniel': { de: 'Cavalier King Charles Spaniel', en: 'Cavalier King Charles Spaniel', ru: 'Кавалер-кинг-чарльз-спаниель', uk: 'Кавалер-кінг-чарльз-спанієль' },
    'chihuahua': { de: 'Chihuahua', en: 'Chihuahua', ru: 'Чихуахуа', uk: 'Чихуахуа' },
    'chow-chow': { de: 'Chow-Chow', en: 'Chow Chow', ru: 'Чау-чау', uk: 'Чау-чау' },
    'cocker-spaniel': { de: 'Cocker Spaniel', en: 'Cocker Spaniel', ru: 'Кокер-спаниель', uk: 'Кокер-спаніель' },
    'collie': { de: 'Collie', en: 'Collie', ru: 'Колли', uk: 'Колі' },
    'dachshund': { de: 'Dackel', en: 'Dachshund', ru: 'Такса', uk: 'Такса' },
    'dalmatian': { de: 'Dalmatiner', en: 'Dalmatian', ru: 'Далматин', uk: 'Далматин' },
    'dobermann': { de: 'Dobermann', en: 'Dobermann', ru: 'Доберман', uk: 'Доберман' },
    'dogue-de-bordeaux': { de: 'Dogue de Bordeaux', en: 'Dogue de Bordeaux', ru: 'Бордоский дог', uk: 'Бордоський дог' },
    'english-bulldog': { de: 'Englische Bulldogge', en: 'English Bulldog', ru: 'Английский бульдог', uk: 'Англійський бульдог' },
    'english-cocker-spaniel': { de: 'English Cocker Spaniel', en: 'English Cocker Spaniel', ru: 'Английский кокер-спаниель', uk: 'Англійський кокер-спаніель' },
    'english-setter': { de: 'English Setter', en: 'English Setter', ru: 'Английский сеттер', uk: 'Англійський сеттер' },
    'english-springer-spaniel': { de: 'English Springer Spaniel', en: 'English Springer Spaniel', ru: 'Английский спрингер-спаниель', uk: 'Англійський спрингер-спанієль' },
    'flat-coated-retriever': { de: 'Flat-Coated Retriever', en: 'Flat-Coated Retriever', ru: 'Прямошерстный ретривер', uk: 'Прямошерстий ретривер' },
    'fox-terrier': { de: 'Foxterrier', en: 'Fox Terrier', ru: 'Фокстерьер', uk: 'Фокстер’єр' },
    'french-bulldog': { de: 'Französische Bulldogge', en: 'French Bulldog', ru: 'Французский бульдог', uk: 'Французький бульдог' },
    'german-shepherd': { de: 'Deutscher Schäferhund', en: 'German Shepherd', ru: 'Немецкая овчарка', uk: 'Німецька вівчарка' },
    'german-shorthaired-pointer': { de: 'Deutsch Kurzhaar', en: 'German Shorthaired Pointer', ru: 'Немецкий короткошерстный пойнтер', uk: 'Німецький короткошерстий пойнтер' },
    'german-spitz-klein': { de: 'Kleinspitz', en: 'German Spitz (Klein)', ru: 'Малый шпиц', uk: 'Малий шпіц' },
    'german-spitz-mittel': { de: 'Mittelspitz', en: 'German Spitz (Mittel)', ru: 'Средний шпиц', uk: 'Середній шпіц' },
    'german-spitz-gross': { de: 'Großspitz', en: 'German Spitz (Groß)', ru: 'Большой шпиц', uk: 'Великий шпіц' },
    'golden-retriever': { de: 'Golden Retriever', en: 'Golden Retriever', ru: 'Золотистый ретривер', uk: 'Золотистий ретривер' },
    'great-dane': { de: 'Deutsche Dogge', en: 'Great Dane', ru: 'Немецкий дог', uk: 'Німецький дог' },
    'greyhound': { de: 'Greyhound', en: 'Greyhound', ru: 'Грейхаунд', uk: 'Грейхаунд' },
    'havanese': { de: 'Havaneser', en: 'Havanese', ru: 'Хаванез', uk: 'Хаванез' },
    'hovawart': { de: 'Hovawart', en: 'Hovawart', ru: 'Ховаварт', uk: 'Ховаварт' },
    'irish-setter': { de: 'Irish Setter', en: 'Irish Setter', ru: 'Ирландский сеттер', uk: 'Ірландський сетер' },
    'irish-wolfhound': { de: 'Irish Wolfhound', en: 'Irish Wolfhound', ru: 'Ирландский волкодав', uk: 'Ірландський вовкодав' },
    'jack-russell-terrier': { de: 'Jack Russell Terrier', en: 'Jack Russell Terrier', ru: 'Джек-рассел-терьер', uk: 'Джек-рассел-тер’єр' },
    'king-charles-spaniel': { de: 'King Charles Spaniel', en: 'King Charles Spaniel', ru: 'Кинг-чарльз-спаниель', uk: 'Кінг-чарльз-спанієль' },
    'komondor': { de: 'Komondor', en: 'Komondor', ru: 'Комондор', uk: 'Комондор' },
    'kuvasz': { de: 'Kuvasz', en: 'Kuvasz', ru: 'Кувас', uk: 'Кувас' },
    'labrador-retriever': { de: 'Labrador Retriever', en: 'Labrador Retriever', ru: 'Лабрадор-ретривер', uk: 'Лабрадор-ретривер' },
    'lagotto-romagnolo': { de: 'Lagotto Romagnolo', en: 'Lagotto Romagnolo', ru: 'Лаготто-романьоло', uk: 'Лагото-романьйоло' },
    'leonberger': { de: 'Leonberger', en: 'Leonberger', ru: 'Леонбергер', uk: 'Леонбергер' },
    'lhasa-apso': { de: 'Lhasa Apso', en: 'Lhasa Apso', ru: 'Лхаса апсо', uk: 'Лхаса-апсо' },
    'maltese': { de: 'Malteser', en: 'Maltese', ru: 'Мальтезе', uk: 'Мальтезе' },
    'manchester-terrier': { de: 'Manchester Terrier', en: 'Manchester Terrier', ru: 'Манчестер-терьер', uk: 'Манчестер-тер’єр' },
    'mastiff': { de: 'Mastiff', en: 'Mastiff', ru: 'Мастиф', uk: 'Мастиф' },
    'miniature-pinscher': { de: 'Zwergpinscher', en: 'Miniature Pinscher', ru: 'Карликовый пинчер', uk: 'Цвергпінчер' },
    'miniature-schnauzer': { de: 'Zwergschnauzer', en: 'Miniature Schnauzer', ru: 'Цвергшнауцер', uk: 'Цвергшнауцер' },
    'mudi': { de: 'Mudi', en: 'Mudi', ru: 'Муди', uk: 'Муді' },
    'newfoundland': { de: 'Neufundländer', en: 'Newfoundland', ru: 'Ньюфаундленд', uk: 'Ньюфаундленд' },
    'norfolk-terrier': { de: 'Norfolk Terrier', en: 'Norfolk Terrier', ru: 'Норфолк-терьер', uk: 'Норфолк-тер’єр' },
    'norwich-terrier': { de: 'Norwich Terrier', en: 'Norwich Terrier', ru: 'Норвич-терьер', uk: 'Норвіч-тер’єр' },
    'old-english-sheepdog': { de: 'Bobtail', en: 'Old English Sheepdog', ru: 'Бобтейл', uk: 'Бобтейл' },
    'papillon': { de: 'Papillon', en: 'Papillon', ru: 'Папильон', uk: 'Папійон' },
    'parson-russell-terrier': { de: 'Parson Russell Terrier', en: 'Parson Russell Terrier', ru: 'Парсон-рассел-терьер', uk: 'Парсон-рассел-тер’єр' },
    'pekingese': { de: 'Pekingese', en: 'Pekingese', ru: 'Пекинес', uk: 'Пекінес' },
    'pomeranian': { de: 'Zwergspitz (Pomeranian)', en: 'Pomeranian', ru: 'Померанский шпиц', uk: 'Померанський шпіц' },
    'poodle-toy': { de: 'Toypudel', en: 'Toy Poodle', ru: 'Той-пудель', uk: 'Той-пудель' },
    'poodle-miniature': { de: 'Zwergpudel', en: 'Miniature Poodle', ru: 'Карликовый пудель', uk: 'Карликовий пудель' },
    'poodle-medium': { de: 'Kleinpudel', en: 'Medium Poodle', ru: 'Малый пудель', uk: 'Малий пудель' },
    'poodle-standard': { de: 'Großpudel', en: 'Standard Poodle', ru: 'Большой пудель', uk: 'Великий пудель' },
    'portuguese-water-dog': { de: 'Portugiesischer Wasserhund', en: 'Portuguese Water Dog', ru: 'Португальская водяная собака', uk: 'Португальський водяний собака' },
    'pug': { de: 'Mops', en: 'Pug', ru: 'Мопс', uk: 'Мопс' },
    'puli': { de: 'Puli', en: 'Puli', ru: 'Пули', uk: 'Пулі' },
    'rhodesian-ridgeback': { de: 'Rhodesian Ridgeback', en: 'Rhodesian Ridgeback', ru: 'Родезийский риджбек', uk: 'Родезійський риджбек' },
    'rottweiler': { de: 'Rottweiler', en: 'Rottweiler', ru: 'Ротвейлер', uk: 'Ротвейлер' },
    'rough-collie': { de: 'Langhaarcollie', en: 'Rough Collie', ru: 'Длинношерстный колли', uk: 'Довгошерстий колі' },
    'samoyed': { de: 'Samojede', en: 'Samoyed', ru: 'Самоед', uk: 'Самоїд' },
    'schnauzer-standard': { de: 'Mittelschnauzer', en: 'Standard Schnauzer', ru: 'Миттельшнауцер', uk: 'Мітельшнауцер' },
    'schnauzer-giant': { de: 'Riesenschnauzer', en: 'Giant Schnauzer', ru: 'Ризеншнауцер', uk: 'Різеншнауцер' },
    'scottish-terrier': { de: 'Scottish Terrier', en: 'Scottish Terrier', ru: 'Шотландский терьер', uk: 'Шотландський тер’єр' },
    'shar-pei': { de: 'Shar-Pei', en: 'Shar-Pei', ru: 'Шарпей', uk: 'Шарпей' },
    'shetland-sheepdog': { de: 'Sheltie', en: 'Shetland Sheepdog', ru: 'Шелти', uk: 'Шелті' },
    'shiba-inu': { de: 'Shiba Inu', en: 'Shiba Inu', ru: 'Сиба-ину', uk: 'Сіба-іну' },
    'shih-tzu': { de: 'Shih Tzu', en: 'Shih Tzu', ru: 'Ши-тцу', uk: 'Ши-тцу' },
    'siberian-husky': { de: 'Sibirischer Husky', en: 'Siberian Husky', ru: 'Сибирский хаски', uk: 'Сибірський хаскі' },
    'soft-coated-wheaten-terrier': { de: 'Soft Coated Wheaten Terrier', en: 'Soft Coated Wheaten Terrier', ru: 'Мягкошерстный пшеничный терьер', uk: 'М’якошерстий пшеничний тер’єр' },
    'st-bernard': { de: 'Bernhardiner', en: 'St. Bernard', ru: 'Сенбернар', uk: 'Сенбернар' },
    'staffordshire-bull-terrier': { de: 'Staffordshire Bullterrier', en: 'Staffordshire Bull Terrier', ru: 'Стаффордширский бультерьер', uk: 'Стаффордширський бультер’єр' },
    'tibetan-terrier': { de: 'Tibet Terrier', en: 'Tibetan Terrier', ru: 'Тибетский терьер', uk: 'Тибетський тер’єр' },
    'vizsla': { de: 'Vizsla', en: 'Vizsla', ru: 'Венгерская выжла', uk: 'Угорська вижла' },
    'weimaraner': { de: 'Weimaraner', en: 'Weimaraner', ru: 'Веймаранер', uk: 'Веймаранер' },
    'west-highland-white-terrier': { de: 'West Highland White Terrier', en: 'West Highland White Terrier', ru: 'Вест-хайленд-уайт-терьер', uk: 'Вест-хайленд-вайт-тер’єр' },
    'whippet': { de: 'Whippet', en: 'Whippet', ru: 'Уиппет', uk: 'Віппет' },
    'yorkshire-terrier': { de: 'Yorkshire Terrier', en: 'Yorkshire Terrier', ru: 'Йоркширский терьер', uk: 'Йоркширський тер\'єр' },
    abyssinian: { de: 'Abessiner', en: 'Abyssinian', ru: 'Абиссинская кошка', uk: 'Абісинська кішка' },
    'american-shorthair': { de: 'American Shorthair', en: 'American Shorthair', ru: 'Американская короткошерстная', uk: 'Американська короткошерста' },
    bengal: { de: 'Bengal', en: 'Bengal', ru: 'Бенгальская кошка', uk: 'Бенгальська кішка' },
    birman: { de: 'Heilige Birma', en: 'Birman', ru: 'Бирманская кошка', uk: 'Бірманська кішка' },
    'british-shorthair': { de: 'Britisch Kurzhaar', en: 'British Shorthair', ru: 'Британская короткошерстная', uk: 'Британська короткошерста' },
    burmese: { de: 'Burma', en: 'Burmese', ru: 'Бурманская кошка', uk: 'Бурманська кішка' },
    'devon-rex': { de: 'Devon Rex', en: 'Devon Rex', ru: 'Девон-рекс', uk: 'Девон-рекс' },
    'domestic-shorthair': { de: 'Hauskatze (Kurzhaar)', en: 'Domestic shorthair cat', ru: 'Домашняя короткошерстная кошка', uk: 'Домашня короткошерста кішка' },
    'domestic-longhair': { de: 'Hauskatze (Langhaar)', en: 'Domestic longhair cat', ru: 'Домашняя длинношерстная кошка', uk: 'Домашня довгошерста кішка' },
    'european-shorthair': { de: 'Europäisch Kurzhaar', en: 'European Shorthair', ru: 'Европейская короткошерстная', uk: 'Європейська короткошерста' },
    'exotic-shorthair': { de: 'Exotisch Kurzhaar', en: 'Exotic Shorthair', ru: 'Экзотическая короткошерстная', uk: 'Екзотична короткошерста' },
    'maine-coon': { de: 'Maine Coon', en: 'Maine Coon', ru: 'Мейн-кун', uk: 'Мейн-кун' },
    'norwegian-forest-cat': { de: 'Norwegische Waldkatze', en: 'Norwegian Forest Cat', ru: 'Норвежская лесная кошка', uk: 'Норвезька лісова кішка' },
    'oriental-shorthair': { de: 'Orientalisch Kurzhaar', en: 'Oriental Shorthair', ru: 'Ориентальная короткошерстная', uk: 'Орієнтальна короткошерста' },
    persian: { de: 'Perser', en: 'Persian', ru: 'Персидская кошка', uk: 'Перська кішка' },
    ragdoll: { de: 'Ragdoll', en: 'Ragdoll', ru: 'Рэгдолл', uk: 'Регдол' },
    'russian-blue': { de: 'Russisch Blau', en: 'Russian Blue', ru: 'Русская голубая', uk: 'Російська блакитна' },
    savannah: { de: 'Savannah', en: 'Savannah', ru: 'Саванна', uk: 'Саванна' },
    'scottish-fold': { de: 'Schottische Faltohrkatze', en: 'Scottish Fold', ru: 'Шотландская вислоухая', uk: 'Шотландська висловуха' },
    siamese: { de: 'Siamkatze', en: 'Siamese', ru: 'Сиамская кошка', uk: 'Сіамська кішка' },
    'siberian-cat': { de: 'Sibirische Katze', en: 'Siberian Cat', ru: 'Сибирская кошка', uk: 'Сибірська кішка' },
    somali: { de: 'Somali', en: 'Somali', ru: 'Сомалийская кошка', uk: 'Сомалійська кішка' },
    sphynx: { de: 'Sphynx', en: 'Sphynx', ru: 'Сфинкс', uk: 'Сфінкс' },
    'turkish-angora': { de: 'Türkisch Angora', en: 'Turkish Angora', ru: 'Турецкая ангора', uk: 'Турецька ангора' },
    rabbit: { de: 'Kaninchen', en: 'Rabbit', ru: 'Кролик', uk: 'Кролик' },
    'guinea-pig': { de: 'Meerschweinchen', en: 'Guinea pig', ru: 'Морская свинка', uk: 'Морська свинка' },
    ferret: { de: 'Frettchen', en: 'Ferret', ru: 'Хорёк', uk: 'Тхір' },
    chinchilla: { de: 'Chinchilla', en: 'Chinchilla', ru: 'Шиншилла', uk: 'Шиншила' },
    degu: { de: 'Degu', en: 'Degu', ru: 'Дегу', uk: 'Дегу' },
    rat: { de: 'Ratte', en: 'Rat', ru: 'Крыса', uk: 'Щур' },
    hamster: { de: 'Hamster', en: 'Hamster', ru: 'Хомяк', uk: 'Хом\'як' },
  };

  const serviceDefs = [
    {
      key: 'cat-brush',
      groups: ['cats', 'others'],
      booking: { de: 'Katzenpflege', en: 'Cat grooming', ru: 'Груминг кошки', uk: 'Грумінг кота' },
      label: { de: 'Katze auskämmen', en: 'Cat brushing', ru: 'Вычёсывание кошки', uk: 'Вичісування кота' },
      note: {
        de: 'Für Maine Coons und große Katzen kann ein Zuschlag von +15 € anfallen.',
        en: 'A surcharge of +15 € may apply for Maine Coons and large cats.',
        ru: 'Для мейн-кунов и крупных кошек возможна доплата +15 €.',
        uk: 'Для мейн-кунів і великих котів можлива доплата +15 €.',
      },
      prices: { cat_standard: '60 €', cat_large: '75 €', other_pet: 'auf Anfrage' },
      desc: {
        de: 'Krallen, Augen, Ohren und gründliches Auskämmen.',
        en: 'Nails, eyes, ears and thorough brushing.',
        ru: 'Когти, глаза, уши и тщательное вычёсывание.',
        uk: 'Кігті, очі, вуха та ретельне вичісування.',
      },
    },
    {
      key: 'cat-full',
      groups: ['cats', 'others'],
      booking: { de: 'Katzenpflege', en: 'Cat grooming', ru: 'Груминг кошки', uk: 'Грумінг кота' },
      label: { de: 'Komplettpflege Katze mit Baden', en: 'Full cat groom with bath', ru: 'Полный груминг кошки с купанием', uk: 'Повний грумінг кота з купанням' },
      note: {
        de: 'Für Maine Coons und große Katzen kann ein Zuschlag von +15 € anfallen.',
        en: 'A surcharge of +15 € may apply for Maine Coons and large cats.',
        ru: 'Для мейн-кунов и крупных кошек возможна доплата +15 €.',
        uk: 'Для мейн-кунів і великих котів можлива доплата +15 €.',
      },
      prices: { cat_standard: '90 €', cat_large: '105 €', other_pet: 'auf Anfrage' },
      desc: {
        de: 'Umfassende Pflege inklusive Baden und Föhnen.',
        en: 'Complete care including bath and drying.',
        ru: 'Комплексный уход с купанием и сушкой.',
        uk: 'Комплексний догляд із купанням і сушінням.',
      },
    },
    {
      key: 'cat-clip',
      groups: ['cats', 'others'],
      booking: { de: 'Katzenpflege', en: 'Cat grooming', ru: 'Груминг кошки', uk: 'Грумінг кота' },
      label: { de: 'Katzenschnitt', en: 'Cat haircut', ru: 'Стрижка кошки', uk: 'Стрижка кота' },
      note: {
        de: 'Für Maine Coons und große Katzen kann ein Zuschlag von +15 € anfallen.',
        en: 'A surcharge of +15 € may apply for Maine Coons and large cats.',
        ru: 'Для мейн-кунов и крупных кошек возможна доплата +15 €.',
        uk: 'Для мейн-кунів і великих котів можлива доплата +15 €.',
      },
      prices: { cat_standard: '60 €', cat_large: '75 €', other_pet: 'auf Anfrage' },
      desc: {
        de: 'Maschinenschnitt mit Hygienepflege.',
        en: 'Clipper haircut with hygiene care.',
        ru: 'Стрижка машинкой с гигиеническим уходом.',
        uk: 'Стрижка машинкою з гігієнічним доглядом.',
      },
    },
    {
      key: 'cat-clip-bath',
      groups: ['cats', 'others'],
      booking: { de: 'Katzenpflege', en: 'Cat grooming', ru: 'Груминг кошки', uk: 'Грумінг кота' },
      label: { de: 'Katzenschnitt mit Baden', en: 'Cat haircut with bath', ru: 'Стрижка кошки с купанием', uk: 'Стрижка кота з купанням' },
      note: {
        de: 'Für Maine Coons und große Katzen kann ein Zuschlag von +15 € anfallen.',
        en: 'A surcharge of +15 € may apply for Maine Coons and large cats.',
        ru: 'Для мейн-кунов и крупных кошек возможна доплата +15 €.',
        uk: 'Для мейн-кунів і великих котів можлива доплата +15 €.',
      },
      prices: { cat_standard: '80 €', cat_large: '95 €', other_pet: 'auf Anfrage' },
      desc: {
        de: 'Kombinierte Pflege, auch als Löwenschnitt möglich.',
        en: 'Combined treatment with an optional lion cut.',
        ru: 'Комбинированный уход, возможен вариант «под льва».',
        uk: 'Комбінований догляд, можливий варіант «під лева».',
      },
    },
    {
      key: 'dematting',
      groups: ['dogs', 'cats', 'others'],
      booking: { de: 'Zusatzleistung', en: 'Extra service', ru: 'Дополнительная услуга', uk: 'Додаткова послуга' },
      label: { de: 'Entfilzen', en: 'Dematting', ru: 'Удаление колтунов', uk: 'Видалення ковтунів' },
      note: {
        de: 'Zuschläge werden nur bei tatsächlichem Bedarf berechnet.',
        en: 'Extra charges apply only when truly needed.',
        ru: 'Доплата рассчитывается только при фактической необходимости.',
        uk: 'Доплата розраховується лише за фактичної потреби.',
      },
      prices: { default: '1 € / Minute' },
      desc: {
        de: 'Schonendes Entfilzen, wenn es für das Tier sicher ist.',
        en: 'Careful dematting whenever it is safe for the pet.',
        ru: 'Бережное удаление колтунов, если это безопасно для питомца.',
        uk: 'Дбайливе видалення ковтунів, якщо це безпечно для улюбленця.',
      },
    },
    {
      key: 'deshedding',
      groups: ['dogs', 'others'],
      booking: { de: 'Express-Fellwechsel', en: 'Express deshedding', ru: 'Экспресс-линька', uk: 'Експрес-линька' },
      label: { de: 'Express-Fellwechsel', en: 'Express deshedding', ru: 'Экспресс-линька', uk: 'Експрес-линька' },
      note: {
        de: 'Reduziert lose Haare deutlich, stoppt den natürlichen Fellwechsel nicht.',
        en: 'Reduces loose coat significantly but does not stop natural shedding.',
        ru: 'Заметно снижает линьку, но не отменяет естественный цикл.',
        uk: 'Помітно зменшує линьку, але не скасовує природний цикл.',
      },
      prices: {
        toy_long: 'ab 70 €',
        medium: 'ab 70 €',
        spitz: '80-100 €',
        large_double: 'ab 120 €',
        giant: 'ab 120 €',
        short: 'ab 70 €',
        default: 'ab 70 €',
      },
      desc: {
        de: 'Professionelle Entfernung von losem Haar und Unterwolle.',
        en: 'Professional removal of loose coat and undercoat.',
        ru: 'Профессиональное удаление отмершей шерсти и подшёрстка.',
        uk: 'Професійне видалення відмерлої шерсті та підшерстка.',
      },
    },
    {
      key: 'dental',
      groups: ['dogs', 'cats', 'others'],
      booking: { de: 'Zusatzleistung', en: 'Extra service', ru: 'Дополнительная услуга', uk: 'Додаткова послуга' },
      label: { de: 'Ultraschall-Zahnpflege', en: 'Ultrasonic dental care', ru: 'Ультразвуковой уход за зубами', uk: 'Ультразвуковий догляд за зубами' },
      note: {
        de: 'Ersetzt keine tierärztliche Zahnbehandlung.',
        en: 'Does not replace veterinary dental treatment.',
        ru: 'Не заменяет ветеринарную стоматологию.',
        uk: 'Не замінює ветеринарну стоматологію.',
      },
      prices: { default: 'ab 100 €' },
      desc: {
        de: 'Sanfte Zahnpflege ohne Narkose.',
        en: 'Gentle teeth cleaning without anaesthesia.',
        ru: 'Деликатная гигиена зубов без анестезии.',
        uk: 'Делікатна гігієна зубів без анестезії.',
      },
    },
    {
      key: 'full-groom',
      groups: ['dogs', 'others'],
      booking: { de: 'Komplettpflege Hund', en: 'Full dog grooming', ru: 'Полный груминг собаки', uk: 'Повний грумінг собаки' },
      label: { de: 'Komplettpflege Hund', en: 'Full dog grooming', ru: 'Полный груминг собаки', uk: 'Повний грумінг собаки' },
      note: {
        de: 'Der Endpreis hängt von Fellzustand, Verfilzungen, Verhalten und Zeitaufwand ab.',
        en: 'Final price depends on coat condition, mats, behaviour and time required.',
        ru: 'Итоговая цена зависит от состояния шерсти, колтунов, поведения и времени работы.',
        uk: 'Кінцева ціна залежить від стану шерсті, ковтунів, поведінки та часу роботи.',
      },
      prices: {
        toy_long: '85-90 €',
        toy_poodle: '95-110 €',
        poodle_dwarf: 'ab 110 €',
        poodle_small: 'ab 120 €',
        poodle_standard: 'ab 140 €',
        medium_cocker: '105-115 €',
        medium: 'ab 90 €',
        large_double: 'ab 140 €',
        large: 'ab 120 €',
        giant: 'ab 150 €',
        short: 'ab 60 €',
        default: 'ab 85 €',
      },
      desc: {
        de: 'Komplettpflege mit Baden, Föhnen, Schnitt und Fellfinish.',
        en: 'Full grooming with bath, drying, haircut and coat finishing.',
        ru: 'Комплексный уход с купанием, сушкой, стрижкой и оформлением шерсти.',
        uk: 'Комплексний догляд із купанням, сушінням, стрижкою та оформленням шерсті.',
      },
    },
    {
      key: 'handstrip',
      groups: ['dogs'],
      booking: { de: 'Trimmen / Handstripping', en: 'Hand stripping', ru: 'Тримминг / хендстриппинг', uk: 'Тримінг / хендстрипінг' },
      label: { de: 'Trimmen / Handstripping', en: 'Hand stripping', ru: 'Тримминг / хендстриппинг', uk: 'Тримінг / хендстрипінг' },
      note: {
        de: 'Für rauhaarige Rassen nach Fellstruktur und Aufwand.',
        en: 'For wire-coated breeds based on coat structure and workload.',
        ru: 'Для жестошёрстных пород с учётом структуры шерсти и объёма работы.',
        uk: 'Для жорсткошерстих порід з урахуванням структури шерсті та обсягу роботи.',
      },
      prices: { medium: 'ab 95 €', large: 'ab 110 €', default: 'ab 95 €' },
      desc: {
        de: 'Rassegerechtes Trimmen per Hand oder Maschine.',
        en: 'Breed-appropriate hand or clipper stripping.',
        ru: 'Породный тримминг вручную или машинкой.',
        uk: 'Породний триммінг вручну або машинкою.',
      },
    },
    {
      key: 'hygiene',
      groups: ['dogs', 'others'],
      booking: { de: 'Hygienepflege', en: 'Hygiene care', ru: 'Гигиенический уход', uk: 'Гігієнічний догляд' },
      label: { de: 'Hygienepflege', en: 'Hygiene care', ru: 'Гигиенический уход', uk: 'Гігієнічний догляд' },
      note: {
        de: 'Ideal als pflegender Zwischentermin zwischen zwei Komplettpflege-Terminen.',
        en: 'Maintenance care between full grooming appointments.',
        ru: 'Поддерживающий уход между полноценными грумингами.',
        uk: 'Підтримувальний догляд між повноцінними грумінгами.',
      },
      prices: {
        toy_long: 'ab 45 €',
        medium: 'ab 60 €',
        large_double: 'ab 80 €',
        giant: 'ab 80 €',
        short: 'ab 45 €',
        default: 'ab 45 €',
      },
      desc: {
        de: 'Baden, Föhnen, Bürsten, Ohren, Augen, Krallen und Hygienezonen.',
        en: 'Bath, dry, brush, ears, eyes, nails and hygiene areas.',
        ru: 'Купание, сушка, вычёсывание, уши, глаза, когти и гигиенические зоны.',
        uk: 'Купання, сушіння, вичісування, вуха, очі, кігті та гігієнічні зони.',
      },
    },
    {
      key: 'nail-trim',
      groups: ['dogs', 'cats', 'others'],
      booking: { de: 'Krallenpflege', en: 'Nail trim', ru: 'Подстригание когтей', uk: 'Стрижка кігтів' },
      label: { de: 'Krallen schneiden', en: 'Nail trim', ru: 'Подстригание когтей', uk: 'Стрижка кігтів' },
      note: {
        de: 'Kurzer Termin, oft kombiniert mit anderen Leistungen.',
        en: 'Short appointment, often combined with other services.',
        ru: 'Короткий визит, часто в сочетании с другими услугами.',
        uk: 'Короткий візит, часто в поєднанні з іншими послугами.',
      },
      prices: { default: 'ab 15 €' },
      desc: {
        de: 'Schonendes Kürzen und Kontrolle der Krallen.',
        en: 'Gentle nail trimming and check.',
        ru: 'Бережная стрижка и контроль длины когтей.',
        uk: 'Дбайлива стрижка та контроль довжини кігтів.',
      },
    },
    {
      key: 'parasite',
      groups: ['dogs', 'cats', 'others'],
      booking: { de: 'Zusatzleistung', en: 'Extra service', ru: 'Дополнительная услуга', uk: 'Додаткова послуга' },
      label: { de: 'Behandlung bei Parasiten', en: 'Parasite treatment', ru: 'Обработка при паразитах', uk: 'Обробка при паразитах' },
      note: {
        de: 'Zusätzliche Hygiene für Tier, Arbeitsplatz und Werkzeuge.',
        en: 'Additional sanitation for pet, workstation and tools.',
        ru: 'Дополнительная санитарная обработка питомца и рабочего места.',
        uk: 'Додаткова санітарна обробка улюбленця та робочого місця.',
      },
      prices: { default: 'ab 40 €' },
      desc: {
        de: 'Wird bei festgestellten Parasiten durchgeführt.',
        en: 'Applied when parasites are detected.',
        ru: 'Проводится при обнаружении паразитов.',
        uk: 'Проводиться при виявленні паразитів.',
      },
    },
    {
      key: 'puppy-intro',
      groups: ['dogs'],
      booking: { de: 'Welpen-Eingewöhnung', en: 'Puppy introduction groom', ru: 'Первый груминг щенка', uk: 'Перший грумінг цуценя' },
      label: { de: 'Welpen-Eingewöhnung', en: 'Puppy introduction groom', ru: 'Первый груминг щенка', uk: 'Перший грумінг цуценя' },
      note: {
        de: 'Sanfter Ersttermin für Welpen bis ca. 6 Monate.',
        en: 'Gentle first visit for puppies up to about 6 months.',
        ru: 'Мягкое знакомство с грумингом для щенков до ~6 месяцев.',
        uk: 'М’яке знайомство з грумінгом для цуценят до ~6 місяців.',
      },
      prices: { default: 'ab 50 €' },
      desc: {
        de: 'Kennenlernen, leichte Pflege, positive Salon-Erfahrung.',
        en: 'Introduction, light care, positive salon experience.',
        ru: 'Знакомство, лёгкий уход, позитивный опыт в салоне.',
        uk: 'Знайомство, легкий догляд, позитивний досвід у салоні.',
      },
    },
    {
      key: 'small-pets',
      groups: ['others'],
      booking: { de: 'Pflege für kleines Heimtier', en: 'Small pet care', ru: 'Уход за мелким декоративным животным', uk: 'Догляд за дрібною декоративною твариною' },
      label: { de: 'Kleine Heimtiere', en: 'Small pets', ru: 'Мелкие декоративные животные', uk: 'Дрібні декоративні тварини' },
      note: {
        de: 'Preis nach Tierart und Pflegeumfang individuell.',
        en: 'Pricing is calculated individually by species and care scope.',
        ru: 'Стоимость рассчитывается индивидуально после уточнения вида животного.',
        uk: 'Вартість розраховується індивідуально після уточнення виду тварини.',
      },
      prices: { other_pet: 'auf Anfrage', default: 'auf Anfrage' },
      desc: {
        de: 'Krallen, Bürsten, Entfilzen und grundlegende Fellpflege.',
        en: 'Nails, brushing, dematting and basic coat care.',
        ru: 'Подстригание когтей, вычёсывание, удаление колтунов и базовый уход.',
        uk: 'Стрижка кігтів, вичісування, видалення ковтунів і базовий догляд.',
      },
    },
    {
      key: 'spa',
      groups: ['dogs', 'cats', 'others'],
      booking: { de: 'SPA-Pflege', en: 'SPA care', ru: 'СПА-уход', uk: 'СПА-догляд' },
      label: { de: 'SPA-Pflege', en: 'SPA care', ru: 'СПА-уход', uk: 'СПА-догляд' },
      note: {
        de: 'Wird individuell auf Haut und Fell abgestimmt.',
        en: 'Selected individually for skin and coat condition.',
        ru: 'Формат ухода подбирается индивидуально под состояние шерсти и кожи.',
        uk: 'Формат догляду підбирається індивідуально під стан шерсті та шкіри.',
      },
      prices: { default: 'ab 15 €' },
      desc: {
        de: 'Masken, Regeneration, Ozontherapie und Spezialkosmetik.',
        en: 'Masks, restorative care, ozone therapy and special cosmetics.',
        ru: 'Маски, восстановительный уход, озонотерапия и специальные процедуры.',
        uk: 'Маски, відновлювальний догляд, озонотерапія та спеціальні процедури.',
      },
    },
  ];

  const onRequest = {
    de: 'auf Anfrage',
    en: 'on request',
    ru: 'по запросу',
    uk: 'за запитом',
  };

  const pick = (map, lang) => map[lang] || map.en || map.de || '';

  const localeFor = lang => {
    if (lang === 'de') return 'de-DE';
    if (lang === 'uk') return 'uk-UA';
    if (lang === 'ru') return 'ru-RU';
    return 'en-GB';
  };

  const buildBreeds = lang => {
    const labels = groupLabels[lang] || groupLabels.en;
    const locale = localeFor(lang);
    const groups = {};

    GROUP_ORDER.forEach(groupKey => {
      const items = breedCatalog[groupKey]
        .map(([id, tier]) => ({
          id,
          group: groupKey,
          tier,
          label: pick(breedNames[id] || { en: id }, lang),
          isOther: false,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));

      items.push({
        id: `${groupKey}-other`,
        group: groupKey,
        tier: groupKey === 'cats' ? 'cat_standard' : groupKey === 'others' ? 'other_pet' : 'medium',
        label: labels.other,
        isOther: true,
      });

      groups[groupKey] = {
        key: groupKey,
        label: labels[groupKey],
        items,
      };
    });

    return groups;
  };

  const buildServices = lang => {
    const locale = localeFor(lang);
    return serviceDefs
      .map(def => ({
        key: def.key,
        label: pick(def.label, lang),
        bookingService: pick(def.booking, lang),
        note: pick(def.note, lang),
        description: pick(def.desc, lang),
        groups: def.groups,
        prices: def.prices,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale, { sensitivity: 'base' }));
  };

  const breedValue = entry => `${entry.group}:${entry.id}`;

  const parseBreedValue = value => {
    const [group, ...rest] = String(value || '').split(':');
    const id = rest.join(':');
    return { group, id };
  };

  const findBreed = (breedGroups, value) => {
    const { group, id } = parseBreedValue(value);
    return breedGroups[group]?.items.find(item => item.id === id) || null;
  };

  const resolveQuote = (service, breed, lang) => {
    if (!service || !breed) {
      return { price: '', description: '' };
    }

    const tier = breed.isOther ? 'default' : breed.tier;
    const priceMap = service.prices || {};
    let price =
      priceMap[tier] ||
      priceMap.default ||
      (breed.group === 'others' || breed.isOther ? onRequest[lang] || onRequest.en : '');

    if (lang === 'ru') {
      price = String(price).replace(/^ab /, 'от ').replace('auf Anfrage', 'по запросу');
    } else if (lang === 'uk') {
      price = String(price).replace(/^ab /, 'від ').replace('auf Anfrage', 'за запитом');
    } else if (lang === 'en') {
      price = String(price).replace(/^ab /, 'from ').replace('auf Anfrage', 'on request');
    }

    if (breed.isOther && !String(price).includes('Anfrage') && !String(price).includes('request') && !String(price).includes('запрос') && !String(price).includes('запит')) {
      price = lang === 'de' ? `ca. ${price}` : lang === 'ru' ? `ориент. ${price}` : lang === 'uk' ? `орієнт. ${price}` : `approx. ${price}`;
    }

    if (breed.group === 'cats' && breed.tier === 'cat_large' && service.key.startsWith('cat-')) {
      price = priceMap.cat_large || price;
    }

    return {
      price,
      description: service.description,
    };
  };

  const build = lang => {
    const safeLang = ['de', 'en', 'ru', 'uk'].includes(lang) ? lang : 'en';
    return {
      breedGroups: buildBreeds(safeLang),
      services: buildServices(safeLang),
      breedValue,
      findBreed: (groups, value) => findBreed(groups, value),
      resolveQuote: (service, breed, quoteLang) => resolveQuote(service, breed, quoteLang || safeLang),
    };
  };

  global.PriceCatalog = { build, GROUP_ORDER };
})(window);
