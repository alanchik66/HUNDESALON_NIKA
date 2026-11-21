const siteLocales = Object.freeze(['de', 'en', 'ru', 'uk']);

const localizedGroups = [
  [
    'Салон',
    [
      ['index', 'Главная'],
      ['o-nas', 'О нас'],
      ['vvedenie', 'Знакомство с салоном'],
      ['kontakty', 'Контакты'],
      ['social', 'Социальные сети'],
    ],
  ],
  [
    'Услуги и предложения',
    [
      ['nashi-uslugi', 'Наши услуги'],
      ['prays-list', 'Прайс-лист'],
      ['onlayn-bronirovanie', 'Онлайн-запись'],
      ['shop', 'Магазин'],
      ['promotions', 'Акции'],
      ['partnerstvo', 'Партнёрство'],
    ],
  ],
  [
    'Галерея и отзывы',
    [
      ['galereya', 'Галерея'],
      ['do-i-posle', 'До и после'],
      ['reyting', 'Отзывы'],
    ],
  ],
  [
    'Документы',
    [
      ['documents', 'Документы'],
      ['impressum', 'Выходные данные'],
      ['datenschutz', 'Конфиденциальность'],
      ['agb', 'Условия салона'],
    ],
  ],
  [
    'Блог',
    [
      ['blog/blog', 'Блог'],
      ['blog/kak-podgotovit-sobaku', 'Блог · Подготовка собаки'],
      ['blog/preimushchestva-ekspress-linki', 'Блог · Экспресс-линька'],
      ['blog/plokhaya-strizhka', 'Блог · Неудачная стрижка'],
      ['blog/strizhka-koshek', 'Блог · Стрижка кошек'],
      ['blog/zashchita-ot-parazitov', 'Блог · Защита от паразитов'],
    ],
  ],
];

const localizedEntries = localizedGroups.flatMap(([group, pages]) =>
  pages.map(([slug, label]) => Object.freeze({ slug, label, group, locales: siteLocales }))
);

const standaloneEntries = [
  ['reviews', 'Выбор языка отзывов', Object.freeze(['en'])],
  ['telegram-menu', 'Меню Telegram', siteLocales],
].map(([slug, label, locales]) => Object.freeze({ slug, label, group: 'Отдельные страницы', locales }));

export const PAGE_LABELS = new Map(localizedEntries.map(({ slug, label }) => [slug, label]));
export const pageEditorEntries = Object.freeze([...localizedEntries, ...standaloneEntries]);

const standalonePages = new Map(standaloneEntries.map(entry => [entry.slug, entry]));
const localeAliases = new Map([
  ['about', 'o-nas'],
  ['blog', 'blog/blog'],
  ['blog/index', 'blog/blog'],
  ['booking', 'onlayn-bronirovanie'],
  ['dog-grooming-leipzig', 'nashi-uslugi'],
  ['gallery', 'galereya'],
  ['hundefriseur-leipzig', 'nashi-uslugi'],
  ['hundesalon-leipzig', 'nashi-uslugi'],
  ['legal', 'impressum'],
  ['price-list', 'prays-list'],
  ['reviews', 'reyting'],
]);
const rootAliases = new Map([
  ['', 'index'],
  ['index', 'index'],
  ['documents', 'documents'],
  ['hundefriseur-leipzig', 'nashi-uslugi'],
  ['hundesalon-leipzig', 'nashi-uslugi'],
]);

export function pageEditorPath(locale, slug) {
  if (PAGE_LABELS.has(slug) && siteLocales.includes(locale)) {
    return slug === 'index' ? '/' + locale + '/' : '/' + locale + '/' + slug;
  }
  const page = standalonePages.get(slug);
  if (!page?.locales.includes(locale)) return null;
  return slug === 'telegram-menu' ? '/telegram-menu?lang=' + locale : '/' + slug;
}

export function pageEditorAssetPath(locale, slug) {
  const pathname = pageEditorPath(locale, slug);
  if (!pathname) return null;
  if (standalonePages.has(slug)) return '/' + slug + '.html';
  return pathname.endsWith('/') ? pathname + 'index.html' : pathname + '.html';
}

export function pageEditorTarget(pathname) {
  if (typeof pathname !== 'string' || !/^\/(?:[a-z0-9-]+\/)*(?:[a-z0-9-]+(?:\.html)?\/?)?$/.test(pathname)) {
    return null;
  }
  const route = pathname.replace(/\/$/, '').replace(/\.html$/, '');
  const [, first, ...parts] = route.split('/');
  if (!parts.length) {
    const standalone = standalonePages.get(first);
    if (standalone) return { locale: standalone.locales[0], slug: standalone.slug };
    const alias = rootAliases.get(first ?? '');
    if (alias) return { locale: 'de', slug: alias };
  }
  const locale = first === 'ua' ? 'uk' : first;
  const path = parts.join('/') || 'index';
  const slug = localeAliases.get(path) || path;
  return siteLocales.includes(locale) && PAGE_LABELS.has(slug) ? { locale, slug } : null;
}
