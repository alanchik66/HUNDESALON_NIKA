(function integrateFciDogBreeds(global) {
  'use strict';

  const catalog = global.PricePageCatalog;
  const registry = global.FciDogBreedsData;
  if (!catalog?.categoriesByLocale || !Array.isArray(registry?.breeds)) return;

  const CATEGORY = Object.freeze({
    small: 'ru-small-growing-coat',
    poodle: 'ru-poodles-bichons',
    spitz: 'ru-spitz',
    spaniel: 'ru-spaniels',
    wire: 'ru-wire-coat',
    short: 'ru-short-coat',
    large: 'ru-large-dogs',
  });
  const LOCALES = ['de', 'en', 'ru', 'uk'];
  const EXCLUDED_BASE_BREED_KEYS = new Set([
    'ru-poodles-bichons:base:3', // Duplicate of the official FCI Medium Poodle size.
    'ru-short-coat:base:3', // Ambiguous "Toy Terrier" duplicated by explicit Russian/English Toy breeds.
  ]);
  const BASE_BREED_NAME_OVERRIDES = new Map([
    ['ru-poodles-bichons:base:2', { en: 'Medium Poodle' }],
  ]);

  // These FCI standards are already represented by a breed or an explicit
  // coat/size variety in the established salon catalog.
  const REPRESENTED_FCI_NUMBERS = new Set([
    1, 3, 4, 5, 7, 8, 10, 11, 15, 16, 40, 43, 45, 49, 50, 53, 54, 57, 58, 61,
    65, 70, 72, 73, 74, 76, 78, 80, 81, 82, 85, 86, 88, 89, 97, 99, 101, 109,
    111, 113, 119, 122, 123, 125, 126, 127, 128, 136, 137, 139, 140, 143, 144,
    145, 146, 147, 148, 149, 153, 156, 157, 158, 161, 162, 166, 167, 169, 172,
    181, 182, 183, 184, 185, 186, 190, 194, 196, 200, 205, 206, 207, 208, 212,
    215, 218, 227, 233, 234, 235, 243, 250, 253, 255, 262, 270, 272, 283, 286,
    288, 292, 297, 309, 327, 328, 329, 335, 339, 342, 343, 344, 345, 352, 359,
    363,
  ]);

  const EXPANDED_FCI_NUMBERS = new Set([
    15, 21, 89, 94, 99, 103, 148, 192, 218, 223, 234, 269, 288, 310, 321,
    352, 361, 375, 376,
  ]);
  const SHORT_GROUP_1 = new Set([44, 287, 293, 296, 351, 360]);
  const WIRE_GROUP_1 = new Set([56, 171, 191]);
  const SHORT_GROUP_2 = new Set([
    64, 116, 143, 144, 147, 149, 157, 184, 185, 197, 225, 235, 249, 260, 264,
    292, 309, 315, 340, 343, 346, 353, 356, 369, 374,
  ]);
  const WIRE_GROUP_2 = new Set([181, 182, 183, 186, 308]);
  const SHORT_GROUP_3 = new Set([11, 12, 13, 71, 76, 259, 286, 341, 359, 370, 371]);
  const SMALL_GROUP_3 = new Set([86, 236]);
  const LARGE_GROUP_5 = new Set([42, 211, 212, 243, 255, 270, 274, 304, 305, 306, 344, 365]);
  const WIRE_GROUP_6 = new Set([17, 19, 32, 33, 36, 62, 66, 67, 152, 155, 198, 282, 294, 375]);
  const SPANIEL_GROUP_7 = new Set([117]);
  const WIRE_GROUP_7 = new Set([98, 216, 232, 239, 320]);
  const CATEGORY_OVERRIDES = new Map([
    [9, CATEGORY.poodle],
    [75, CATEGORY.small],
    [105, CATEGORY.large],
    [124, CATEGORY.large],
    [221, CATEGORY.large],
    [246, CATEGORY.small],
  ]);

  const SHORT_SERVICE_INDEX = new Map([
    [12, 1], [13, 0], [44, 3], [64, 1], [71, 1], [116, 3], [197, 3],
    [199, 1], [225, 3], [248, 2], [249, 3], [259, 0], [260, 3], [264, 3],
    [273, 2], [287, 2], [293, 2], [296, 2], [315, 3], [338, 3], [340, 3],
    [341, 1], [346, 3], [348, 2], [351, 2], [353, 3], [356, 1], [360, 1],
    [134, 2], [179, 2], [187, 2], [369, 2], [370, 1], [371, 1], [374, 3],
    [377, 1],
  ]);

  const BASE_BREED_TRANSFORMS = [
    {
      fciNumber: 3,
      from: CATEGORY.wire,
      to: CATEGORY.poodle,
      currentNames: { de: 'Kerry Blue Terrier', en: 'Kerry Blue Terrier', ru: 'Керри-блю-терьер', uk: 'Керрі-блю-тер’єр' },
    },
    {
      fciNumber: 40,
      from: CATEGORY.wire,
      to: CATEGORY.poodle,
      currentNames: { de: 'Irish Soft Coated Wheaten Terrier', en: 'Irish Soft Coated Wheaten Terrier', ru: 'Ирландский мягкошерстный пшеничный терьер', uk: 'Ірландський м’якошерстий пшеничний тер’єр' },
    },
    {
      fciNumber: 82,
      from: CATEGORY.wire,
      to: CATEGORY.short,
      serviceIndex: 0,
      currentNames: { de: 'Brabanter Griffon', en: 'Petit Brabançon', ru: 'Пти брабансон', uk: 'Малий брабанський грифон — пті брабансон' },
      names: { de: 'Brabanter Griffon', en: 'Petit Brabançon', ru: 'Пти брабансон', uk: 'Малий брабанський грифон — пті брабансон' },
    },
    {
      fciNumber: 15,
      from: CATEGORY.large,
      to: null,
      currentNames: { de: 'Belgischer Schäferhund', en: 'Belgian Shepherd', ru: 'Бельгийская овчарка', uk: 'Бельгійська вівчарка' },
    },
    {
      fciNumber: 89,
      from: CATEGORY.short,
      to: CATEGORY.short,
      serviceIndex: 3,
      currentNames: { de: 'Podenco Ibicenco', en: 'Ibizan Hound', ru: 'Поденко ибиценко', uk: 'Поденко ібісенко' },
      names: { de: 'Podenco Ibicenco – Kurzhaar', en: 'Ibizan Hound — smooth-haired', ru: 'Поденко ибиценко — короткошёрстный', uk: 'Поденко ібісенко — короткошерстий' },
    },
    {
      fciNumber: 99,
      from: CATEGORY.short,
      to: CATEGORY.short,
      serviceIndex: 3,
      currentNames: { de: 'Weimaraner', en: 'Weimaraner', ru: 'Веймаранер', uk: 'Веймаранер' },
      names: { de: 'Weimaraner – Kurzhaar', en: 'Weimaraner — short-haired', ru: 'Веймаранер — короткошёрстный', uk: 'Веймаранер — короткошерстий' },
    },
    {
      fciNumber: 234,
      from: CATEGORY.short,
      to: CATEGORY.short,
      serviceIndex: 2,
      currentNames: { de: 'Xoloitzcuintle – mittlere Größe', en: 'Xoloitzcuintli — medium size', ru: 'Ксолоитцкуинтли среднего размера', uk: 'Ксолойтцкуінтлі середнього розміру' },
      names: { de: 'Mexikanischer Nackthund – mittelgroß, haarlos', en: 'Xoloitzcuintli — medium, hairless', ru: 'Ксолоитцкуинтли — средний, голый', uk: 'Мексиканський голий собака — середній, голий' },
    },
    {
      fciNumber: 234,
      from: CATEGORY.short,
      to: CATEGORY.short,
      serviceIndex: 3,
      currentNames: { de: 'Xoloitzcuintle – Standardgröße', en: 'Xoloitzcuintli — standard size', ru: 'Ксолоитцкуинтли стандартного размера', uk: 'Ксолойтцкуінтлі стандартного розміру' },
      names: { de: 'Mexikanischer Nackthund – Standardgröße, haarlos', en: 'Xoloitzcuintli — standard, hairless', ru: 'Ксолоитцкуинтли — стандартный, голый', uk: 'Мексиканський голий собака — стандартний, голий' },
    },
  ];

  const variant = (fciNumber, key, categoryId, names, serviceIndex = null) => ({
    fciNumber,
    key,
    categoryId,
    names,
    serviceIndex,
    variant: true,
  });

  const VARIETY_ENTRIES = [
    variant(15, 'groenendael', CATEGORY.large, { de: 'Belgischer Schäferhund – Groenendael', en: 'Belgian Shepherd Dog — Groenendael', ru: 'Бельгийская овчарка — грюнендаль', uk: 'Бельгійська вівчарка — грюнендаль' }),
    variant(15, 'laekenois', CATEGORY.wire, { de: 'Belgischer Schäferhund – Laekenois', en: 'Belgian Shepherd Dog — Laekenois', ru: 'Бельгийская овчарка — лакенуа', uk: 'Бельгійська вівчарка — лакенуа' }),
    variant(15, 'malinois', CATEGORY.short, { de: 'Belgischer Schäferhund – Malinois', en: 'Belgian Shepherd Dog — Malinois', ru: 'Бельгийская овчарка — малинуа', uk: 'Бельгійська вівчарка — малінуа' }, 3),
    variant(15, 'tervueren', CATEGORY.large, { de: 'Belgischer Schäferhund – Tervueren', en: 'Belgian Shepherd Dog — Tervueren', ru: 'Бельгийская овчарка — тервюрен', uk: 'Бельгійська вівчарка — тервюрен' }),
    variant(21, 'great', CATEGORY.short, { de: 'Großer Gascon Saintongeois', en: 'Grand Gascon Saintongeois', ru: 'Большой гасконский сентонжуа', uk: 'Великий гасконський сентонжуа' }, 3),
    variant(21, 'small', CATEGORY.short, { de: 'Kleiner Gascon Saintongeois', en: 'Small Gascon Saintongeois', ru: 'Малый гасконский сентонжуа', uk: 'Малий гасконський сентонжуа' }, 2),
    variant(89, 'rough', CATEGORY.wire, { de: 'Podenco Ibicenco – Rauhaar', en: 'Ibizan Hound — rough-haired', ru: 'Поденко ибиценко — жёсткошёрстный', uk: 'Поденко ібісенко — жорсткошерстий' }),
    variant(94, 'small-smooth', CATEGORY.short, { de: 'Portugiesischer Podengo – klein, Kurzhaar', en: 'Portuguese Podengo — small, smooth-haired', ru: 'Португальский поденгу — малый, короткошёрстный', uk: 'Португальський поденгу — малий, короткошерстий' }, 0),
    variant(94, 'small-wire', CATEGORY.wire, { de: 'Portugiesischer Podengo – klein, Rauhaar', en: 'Portuguese Podengo — small, wire-haired', ru: 'Португальский поденгу — малый, жёсткошёрстный', uk: 'Португальський поденгу — малий, жорсткошерстий' }),
    variant(94, 'medium-smooth', CATEGORY.short, { de: 'Portugiesischer Podengo – mittelgroß, Kurzhaar', en: 'Portuguese Podengo — medium, smooth-haired', ru: 'Португальский поденгу — средний, короткошёрстный', uk: 'Португальський поденгу — середній, короткошерстий' }, 2),
    variant(94, 'medium-wire', CATEGORY.wire, { de: 'Portugiesischer Podengo – mittelgroß, Rauhaar', en: 'Portuguese Podengo — medium, wire-haired', ru: 'Португальский поденгу — средний, жёсткошёрстный', uk: 'Португальський поденгу — середній, жорсткошерстий' }),
    variant(94, 'large-smooth', CATEGORY.short, { de: 'Portugiesischer Podengo – groß, Kurzhaar', en: 'Portuguese Podengo — large, smooth-haired', ru: 'Португальский поденгу — большой, короткошёрстный', uk: 'Португальський поденгу — великий, короткошерстий' }, 3),
    variant(94, 'large-wire', CATEGORY.wire, { de: 'Portugiesischer Podengo – groß, Rauhaar', en: 'Portuguese Podengo — large, wire-haired', ru: 'Португальский поденгу — большой, жёсткошёрстный', uk: 'Португальський поденгу — великий, жорсткошерстий' }),
    variant(99, 'long', CATEGORY.large, { de: 'Weimaraner – Langhaar', en: 'Weimaraner — long-haired', ru: 'Веймаранер — длинношёрстный', uk: 'Веймаранер — довгошерстий' }),
    variant(103, 'rough', CATEGORY.wire, { de: 'Deutscher Jagdterrier – Rauhaar', en: 'German Hunting Terrier — rough-haired', ru: 'Немецкий охотничий терьер — жёсткошёрстный', uk: 'Німецький мисливський тер’єр — жорсткошерстий' }),
    variant(103, 'coarse-smooth', CATEGORY.short, { de: 'Deutscher Jagdterrier – derbglatt', en: 'German Hunting Terrier — coarse smooth-haired', ru: 'Немецкий охотничий терьер — грубый гладкошёрстный', uk: 'Німецький мисливський тер’єр — грубий гладкошерстий' }, 1),
    variant(148, 'standard-long', CATEGORY.small, { de: 'Langhaardackel', en: 'Long-haired Dachshund', ru: 'Такса длинношёрстная', uk: 'Такса довгошерста' }),
    variant(148, 'miniature-long', CATEGORY.small, { de: 'Langhaar-Zwergdackel', en: 'Long-haired Miniature Dachshund', ru: 'Цвергтакса длинношёрстная', uk: 'Цвергтакса довгошерста' }),
    variant(148, 'rabbit-smooth', CATEGORY.short, { de: 'Kurzhaar-Kaninchendackel', en: 'Smooth-haired Rabbit Dachshund', ru: 'Кроличья такса короткошёрстная', uk: 'Кроляча такса короткошерста' }, 0),
    variant(148, 'rabbit-long', CATEGORY.small, { de: 'Langhaar-Kaninchendackel', en: 'Long-haired Rabbit Dachshund', ru: 'Кроличья такса длинношёрстная', uk: 'Кроляча такса довгошерста' }),
    variant(148, 'rabbit-wire', CATEGORY.wire, { de: 'Rauhaar-Kaninchendackel', en: 'Wire-haired Rabbit Dachshund', ru: 'Кроличья такса жёсткошёрстная', uk: 'Кроляча такса жорсткошерста' }),
    variant(192, 'rough', CATEGORY.wire, { de: 'Kromfohrländer – Rauhaar', en: 'Kromfohrländer — rough-haired', ru: 'Кромфорлендер — жёсткошёрстный', uk: 'Кромфорлендер — жорсткошерстий' }),
    variant(192, 'smooth', CATEGORY.short, { de: 'Kromfohrländer – Glatthaar', en: 'Kromfohrländer — smooth-haired', ru: 'Кромфорлендер — гладкошёрстный', uk: 'Кромфорлендер — гладкошерстий' }, 1),
    variant(218, 'long', CATEGORY.small, { de: 'Langhaar-Chihuahua', en: 'Long-haired Chihuahua', ru: 'Чихуахуа длинношёрстный', uk: 'Чихуахуа довгошерстий' }),
    variant(223, 'smooth', CATEGORY.short, { de: 'Holländischer Schäferhund – Kurzhaar', en: 'Dutch Shepherd Dog — short-haired', ru: 'Голландская овчарка — короткошёрстная', uk: 'Нідерландська вівчарка — короткошерста' }, 2),
    variant(223, 'long', CATEGORY.large, { de: 'Holländischer Schäferhund – Langhaar', en: 'Dutch Shepherd Dog — long-haired', ru: 'Голландская овчарка — длинношёрстная', uk: 'Нідерландська вівчарка — довгошерста' }),
    variant(223, 'rough', CATEGORY.wire, { de: 'Holländischer Schäferhund – Rauhaar', en: 'Dutch Shepherd Dog — rough-haired', ru: 'Голландская овчарка — жёсткошёрстная', uk: 'Нідерландська вівчарка — жорсткошерста' }),
    variant(234, 'miniature-hairless', CATEGORY.short, { de: 'Mexikanischer Nackthund – Miniatur, haarlos', en: 'Xoloitzcuintli — miniature, hairless', ru: 'Ксолоитцкуинтли — миниатюрный, голый', uk: 'Мексиканський голий собака — мініатюрний, голий' }, 1),
    variant(234, 'miniature-coated', CATEGORY.short, { de: 'Mexikanischer Nackthund – Miniatur, behaart', en: 'Xoloitzcuintli — miniature, coated', ru: 'Ксолоитцкуинтли — миниатюрный, покрытый шерстью', uk: 'Мексиканський голий собака — мініатюрний, вкритий шерстю' }, 1),
    variant(234, 'medium-coated', CATEGORY.short, { de: 'Mexikanischer Nackthund – mittelgroß, behaart', en: 'Xoloitzcuintli — medium, coated', ru: 'Ксолоитцкуинтли — средний, покрытый шерстью', uk: 'Мексиканський голий собака — середній, вкритий шерстю' }, 2),
    variant(234, 'standard-coated', CATEGORY.short, { de: 'Mexikanischer Nackthund – Standardgröße, behaart', en: 'Xoloitzcuintli — standard, coated', ru: 'Ксолоитцкуинтли — стандартный, покрытый шерстью', uk: 'Мексиканський голий собака — стандартний, вкритий шерстю' }, 3),
    variant(269, 'fringed', CATEGORY.large, { de: 'Saluki – befedert', en: 'Saluki — fringed', ru: 'Салюки — с очёсами', uk: 'Салюкі — з очосами' }),
    variant(269, 'smooth', CATEGORY.short, { de: 'Saluki – Kurzhaar', en: 'Saluki — smooth-haired', ru: 'Салюки — короткошёрстный', uk: 'Салюкі — короткошерстий' }, 3),
    variant(288, 'hairless', CATEGORY.short, { de: 'Chinesischer Schopfhund – haarlos', en: 'Chinese Crested Dog — hairless', ru: 'Китайская хохлатая собака — голая', uk: 'Китайський чубатий собака — голий' }, 0),
    variant(310, 'small-hairless', CATEGORY.short, { de: 'Peruanischer Nackthund – klein, haarlos', en: 'Peruvian Hairless Dog — small, hairless', ru: 'Перуанская голая собака — малая, голая', uk: 'Перуанський голий собака — малий, голий' }, 1),
    variant(310, 'medium-hairless', CATEGORY.short, { de: 'Peruanischer Nackthund – mittelgroß, haarlos', en: 'Peruvian Hairless Dog — medium, hairless', ru: 'Перуанская голая собака — средняя, голая', uk: 'Перуанський голий собака — середній, голий' }, 2),
    variant(310, 'large-hairless', CATEGORY.short, { de: 'Peruanischer Nackthund – groß, haarlos', en: 'Peruvian Hairless Dog — large, hairless', ru: 'Перуанская голая собака — большая, голая', uk: 'Перуанський голий собака — великий, голий' }, 3),
    variant(310, 'small-coated', CATEGORY.short, { de: 'Peruanischer Nackthund – klein, behaart', en: 'Peruvian Hairless Dog — small, coated', ru: 'Перуанская голая собака — малая, покрытая шерстью', uk: 'Перуанський голий собака — малий, вкритий шерстю' }, 1),
    variant(310, 'medium-coated', CATEGORY.short, { de: 'Peruanischer Nackthund – mittelgroß, behaart', en: 'Peruvian Hairless Dog — medium, coated', ru: 'Перуанская голая собака — средняя, покрытая шерстью', uk: 'Перуанський голий собака — середній, вкритий шерстю' }, 2),
    variant(310, 'large-coated', CATEGORY.short, { de: 'Peruanischer Nackthund – groß, behaart', en: 'Peruvian Hairless Dog — large, coated', ru: 'Перуанская голая собака — большая, покрытая шерстью', uk: 'Перуанський голий собака — великий, вкритий шерстю' }, 3),
    variant(321, 'smooth', CATEGORY.short, { de: 'Mallorca-Schäferhund – Kurzhaar', en: 'Majorca Shepherd Dog — short-haired', ru: 'Майоркская овчарка — короткошёрстная', uk: 'Майорська вівчарка — короткошерста' }, 3),
    variant(321, 'long', CATEGORY.large, { de: 'Mallorca-Schäferhund – Langhaar', en: 'Majorca Shepherd Dog — long-haired', ru: 'Майоркская овчарка — длинношёрстная', uk: 'Майорська вівчарка — довгошерста' }),
    variant(339, 'smooth', CATEGORY.short, { de: 'Parson Russell Terrier – Glatthaar', en: 'Parson Russell Terrier — smooth-haired', ru: 'Парсон-рассел-терьер — гладкошёрстный', uk: 'Парсон-рассел-тер’єр — гладкошерстий' }, 1),
    variant(345, 'smooth', CATEGORY.short, { de: 'Jack Russell Terrier – Glatthaar', en: 'Jack Russell Terrier — smooth-haired', ru: 'Джек-рассел-терьер — гладкошёрстный', uk: 'Джек-рассел-тер’єр — гладкошерстий' }, 0),
    variant(352, 'long', CATEGORY.small, { de: 'Russischer Toy – Langhaar', en: 'Russian Toy — long-haired', ru: 'Русский той длинношёрстный', uk: 'Російський той довгошерстий' }),
    variant(361, 'smooth', CATEGORY.short, { de: 'Segugio Maremmano – Kurzhaar', en: 'Segugio Maremmano — smooth-haired', ru: 'Мареммская гончая — короткошёрстная', uk: 'Маремський гончак — короткошерстий' }, 2),
    variant(361, 'rough', CATEGORY.wire, { de: 'Segugio Maremmano – Rauhaar', en: 'Segugio Maremmano — rough-haired', ru: 'Мареммская гончая — жёсткошёрстная', uk: 'Маремський гончак — жорсткошерстий' }),
    variant(375, 'smooth', CATEGORY.short, { de: 'Apenninen-Laufhund – Kurzhaar', en: 'Appennine Hound — smooth-haired', ru: 'Апеннинская гончая — короткошёрстная', uk: 'Апеннінський гончак — короткошерстий' }, 2),
    variant(375, 'rough', CATEGORY.wire, { de: 'Apenninen-Laufhund – Rauhaar', en: 'Appennine Hound — rough-haired', ru: 'Апеннинская гончая — жёсткошёрстная', uk: 'Апеннінський гончак — жорсткошерстий' }),
    variant(376, 'standard-smooth', CATEGORY.short, { de: 'Sabueso Fino Colombiano – Standard, Kurzhaar', en: 'Colombian Fino Hound — standard, smooth-haired', ru: 'Колумбийская гончая фино — стандартная, короткошёрстная', uk: 'Колумбійський гончак фіно — стандартний, короткошерстий' }, 2),
    variant(376, 'large-smooth', CATEGORY.short, { de: 'Sabueso Fino Colombiano – groß, Kurzhaar', en: 'Colombian Fino Hound — large, smooth-haired', ru: 'Колумбийская гончая фино — большая, короткошёрстная', uk: 'Колумбійський гончак фіно — великий, короткошерстий' }, 3),
    variant(376, 'standard-rough', CATEGORY.wire, { de: 'Sabueso Fino Colombiano – Standard, Rauhaar', en: 'Colombian Fino Hound — standard, rough-haired', ru: 'Колумбийская гончая фино — стандартная, жёсткошёрстная', uk: 'Колумбійський гончак фіно — стандартний, жорсткошерстий' }),
    variant(376, 'large-rough', CATEGORY.wire, { de: 'Sabueso Fino Colombiano – groß, Rauhaar', en: 'Colombian Fino Hound — large, rough-haired', ru: 'Колумбийская гончая фино — большая, жёсткошёрстная', uk: 'Колумбійський гончак фіно — великий, жорсткошерстий' }),
  ];

  function classify(record) {
    const number = record.fciNumber;
    if (CATEGORY_OVERRIDES.has(number)) return CATEGORY_OVERRIDES.get(number);
    if (record.group === 1) {
      if (SHORT_GROUP_1.has(number)) return CATEGORY.short;
      if (WIRE_GROUP_1.has(number)) return CATEGORY.wire;
      return CATEGORY.large;
    }
    if (record.group === 2) {
      if (SHORT_GROUP_2.has(number)) return CATEGORY.short;
      if (WIRE_GROUP_2.has(number)) return CATEGORY.wire;
      return CATEGORY.large;
    }
    if (record.group === 3) {
      if (SHORT_GROUP_3.has(number)) return CATEGORY.short;
      if (SMALL_GROUP_3.has(number)) return CATEGORY.small;
      return CATEGORY.wire;
    }
    if (record.group === 4) return CATEGORY.wire;
    if (record.group === 5) {
      if (record.section === 6 || record.section === 7) return CATEGORY.short;
      if (LARGE_GROUP_5.has(number)) return CATEGORY.large;
      return CATEGORY.spitz;
    }
    if (record.group === 6) return WIRE_GROUP_6.has(number) ? CATEGORY.wire : CATEGORY.short;
    if (record.group === 7) {
      if (record.subsection === 3 || WIRE_GROUP_7.has(number)) return CATEGORY.wire;
      if (record.subsection === 2 || SPANIEL_GROUP_7.has(number)) return CATEGORY.spaniel;
      return CATEGORY.short;
    }
    if (record.group === 8) {
      if (record.section === 1) return CATEGORY.large;
      if (record.section === 2) return CATEGORY.spaniel;
      return CATEGORY.poodle;
    }
    if (record.group === 9) {
      if (record.section === 1 || record.section === 2) return CATEGORY.poodle;
      if (record.section === 3 || record.section === 10) return CATEGORY.wire;
      if (record.section === 7) return CATEGORY.spaniel;
      if (record.section === 11) return CATEGORY.short;
      return CATEGORY.small;
    }
    if (record.group === 10) {
      if (record.section === 2) return CATEGORY.wire;
      if (record.section === 3) return CATEGORY.short;
      return CATEGORY.large;
    }
    throw new Error(`Unsupported FCI group for ${number}: ${record.group}`);
  }

  function resolveShortServiceIndex(record) {
    if (SHORT_SERVICE_INDEX.has(record.fciNumber)) return SHORT_SERVICE_INDEX.get(record.fciNumber);
    if (record.group === 6) {
      if (record.subsection === 1) return 3;
      if (record.subsection === 2) return 2;
      if (record.subsection === 3) return 1;
      return record.section === 2 ? 2 : 3;
    }
    if (record.group === 7 || record.group === 10) return 3;
    throw new Error(`Missing short-coat service index for FCI ${record.fciNumber}`);
  }

  function displayName(value, lang) {
    if (lang === 'ru' || lang === 'uk' || value !== value.toLocaleUpperCase(lang)) return value;
    const connectors = lang === 'en' ? new Set(['and', 'of', 'the']) : new Set(['und', 'von', 'der', 'des']);
    let wordIndex = 0;
    return value.toLocaleLowerCase(lang).replace(/\p{L}+(?:['’]\p{L}+)?/gu, word => {
      const lower = word.toLocaleLowerCase(lang);
      const keepLower = wordIndex > 0 && connectors.has(lower);
      wordIndex += 1;
      return keepLower ? lower : `${lower.charAt(0).toLocaleUpperCase(lang)}${lower.slice(1)}`;
    });
  }

  function normalizeName(value) {
    return String(value || '')
      .normalize('NFKD')
      .toLocaleLowerCase()
      .replace(/\p{M}+/gu, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function sortLocalizedBreeds(category, lang, collator) {
    const names = category?.breeds?.[lang];
    if (!Array.isArray(names)) return;
    const fciNumbers = Array.isArray(category.breedFciNumbers)
      ? category.breedFciNumbers
      : Array(names.length).fill(null);
    const serviceIndexes = category.id === CATEGORY.short ? category.breedServiceIndexes : null;
    if (fciNumbers.length !== names.length || (serviceIndexes && serviceIndexes.length !== names.length)) {
      throw new Error(`Breed metadata drift before sorting ${lang}:${category.id}`);
    }

    const sorted = names
      .map((name, index) => ({
        name,
        fciNumber: fciNumbers[index] ?? null,
        breedKey: category.breedKeys[index],
        serviceIndex: serviceIndexes?.[index] ?? null,
        originalIndex: index,
      }))
      .sort((left, right) => collator.compare(left.name, right.name) || left.originalIndex - right.originalIndex);

    category.breeds[lang] = sorted.map(item => item.name);
    category.breedFciNumbers = sorted.map(item => item.fciNumber);
    category.breedKeys = sorted.map(item => item.breedKey);
    if (serviceIndexes) category.breedServiceIndexes = sorted.map(item => item.serviceIndex);
  }

  function cleanBaseBreeds(category, lang) {
    const serviceIndexes = category.id === CATEGORY.short ? category.breedServiceIndexes : null;
    const retained = category.breeds[lang]
      .map((name, index) => {
        const breedKey = category.breedKeys[index];
        return {
          name: BASE_BREED_NAME_OVERRIDES.get(breedKey)?.[lang] || name,
          fciNumber: category.breedFciNumbers[index],
          breedKey,
          serviceIndex: serviceIndexes?.[index] ?? null,
        };
      })
      .filter(item => !EXCLUDED_BASE_BREED_KEYS.has(item.breedKey));

    category.breeds[lang] = retained.map(item => item.name);
    category.breedFciNumbers = retained.map(item => item.fciNumber);
    category.breedKeys = retained.map(item => item.breedKey);
    if (serviceIndexes) category.breedServiceIndexes = retained.map(item => item.serviceIndex);
  }

  function applyBaseBreedTransforms(byId, lang) {
    for (const transform of BASE_BREED_TRANSFORMS) {
      const source = byId.get(transform.from);
      const sourceBreeds = source?.breeds?.[lang];
      const currentName = transform.currentNames[lang];
      const sourceIndex = sourceBreeds?.findIndex(name => normalizeName(name) === normalizeName(currentName));
      if (!Number.isInteger(sourceIndex) || sourceIndex < 0) {
        throw new Error(`Missing ${lang} base breed for FCI ${transform.fciNumber}: ${currentName}`);
      }

      const replacementName = transform.names?.[lang] || sourceBreeds[sourceIndex];
      if (transform.from === transform.to) {
        sourceBreeds[sourceIndex] = replacementName;
        if (transform.from === CATEGORY.short) source.breedServiceIndexes[sourceIndex] = transform.serviceIndex;
        continue;
      }

      sourceBreeds.splice(sourceIndex, 1);
      if (transform.from === CATEGORY.short) source.breedServiceIndexes.splice(sourceIndex, 1);
      if (!transform.to) continue;

      const target = byId.get(transform.to);
      if (!target?.breeds?.[lang]) throw new Error(`Missing ${lang} target category for FCI ${transform.fciNumber}`);
      target.breeds[lang].push(replacementName);
      if (transform.to === CATEGORY.short) target.breedServiceIndexes.push(transform.serviceIndex);
    }
  }

  const genericEntries = registry.breeds
    .filter(record => !REPRESENTED_FCI_NUMBERS.has(record.fciNumber) && !EXPANDED_FCI_NUMBERS.has(record.fciNumber))
    .map(record => {
      const categoryId = classify(record);
      return {
        fciNumber: record.fciNumber,
        key: 'breed',
        categoryId,
        names: Object.fromEntries(LOCALES.map(lang => [lang, displayName(record.names[lang], lang)])),
        serviceIndex: categoryId === CATEGORY.short ? resolveShortServiceIndex(record) : null,
        variant: false,
      };
    });
  const entries = [...genericEntries, ...VARIETY_ENTRIES];

  for (const entry of entries) {
    if (!Object.values(CATEGORY).includes(entry.categoryId)) throw new Error(`Invalid category for FCI ${entry.fciNumber}`);
    for (const lang of LOCALES) {
      if (!entry.names[lang]) throw new Error(`Missing ${lang} name for FCI ${entry.fciNumber}:${entry.key}`);
    }
    if (entry.categoryId === CATEGORY.short && !Number.isInteger(entry.serviceIndex)) {
      throw new Error(`Missing size index for FCI ${entry.fciNumber}:${entry.key}`);
    }
  }

  for (const lang of LOCALES) {
    const categories = catalog.categoriesByLocale[lang] || [];
    const byId = new Map(categories.map(category => [category.id, category]));
    const shortCategory = byId.get(CATEGORY.short);
    if (!shortCategory) throw new Error(`Missing short-coat category for ${lang}`);
    const existingShortBreeds = shortCategory.breeds?.[lang] || [];
    shortCategory.breedServiceIndexes = existingShortBreeds.map((_, index) => {
      if (index < 5) return 0;
      if (index < 16) return 1;
      if (index < 24) return 2;
      return 3;
    });
    applyBaseBreedTransforms(byId, lang);

    const additions = new Map(Object.values(CATEGORY).map(categoryId => [categoryId, []]));
    for (const entry of entries) additions.get(entry.categoryId).push(entry);
    const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });

    for (const [categoryId, categoryEntries] of additions) {
      const category = byId.get(categoryId);
      if (!category?.breeds?.[lang]) throw new Error(`Missing ${lang} breed list for ${categoryId}`);
      category.breedFciNumbers = Array(category.breeds[lang].length).fill(null);
      category.breedKeys = category.breeds[lang].map((_, index) => `${categoryId}:base:${index}`);
      cleanBaseBreeds(category, lang);
      const knownNames = new Set(category.breeds[lang].map(normalizeName));
      categoryEntries.sort((left, right) => collator.compare(left.names[lang], right.names[lang]));
      for (const entry of categoryEntries) {
        const name = entry.names[lang];
        if (knownNames.has(normalizeName(name))) continue;
        category.breeds[lang].push(name);
        category.breedFciNumbers.push(entry.fciNumber);
        category.breedKeys.push(`fci:${entry.fciNumber}:${entry.key}`);
        if (categoryId === CATEGORY.short) category.breedServiceIndexes.push(entry.serviceIndex);
        knownNames.add(normalizeName(name));
      }
    }

    for (const categoryId of Object.values(CATEGORY)) {
      sortLocalizedBreeds(byId.get(categoryId), lang, collator);
    }
  }

  global.FciDogBreedIntegration = Object.freeze({
    categories: CATEGORY,
    entries: Object.freeze(entries),
    representedFciNumbers: Object.freeze([...REPRESENTED_FCI_NUMBERS]),
    registryCount: registry.breeds.length,
    source: registry.source,
  });
})(typeof window !== 'undefined' ? window : globalThis);
