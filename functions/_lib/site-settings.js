import offerDefaults from './promotion-defaults.json' with { type: 'json' };
import { adminDatabase } from './site-admin-auth.js';

// Public feature IDs are shared by the admin API, route gates and the site's generated navigation.
const sections = [
  ['promotions', 'Акции', 'Предложения', 'Страница с предложениями салона', 'promotions'],
  ['services', 'Услуги', 'Салон', 'Каталог услуг салона', 'nashi-uslugi'],
  ['prices', 'Прайс-лист', 'Салон', 'Цены и каталог ухода', 'prays-list'],
  ['booking', 'Онлайн-запись', 'Сервисы', 'Страница записи и приём новых заявок', 'onlayn-bronirovanie'],
  ['shop', 'Магазин', 'Сервисы', 'Витрина товаров и корзина', 'shop'],
  ['gallery', 'Галерея', 'Медиа', 'Фотогалерея салона', 'galereya'],
  ['beforeAfter', 'До и после', 'Медиа', 'Галерея результатов груминга', 'do-i-posle'],
  ['blog', 'Блог', 'Медиа', 'Оглавление и статьи блога', 'blog'],
  ['social', 'Социальные сети', 'Медиа', 'Страница социальных сетей', 'social'],
  ['reviews', 'Отзывы', 'Медиа', 'Отзывы посетителей и отправка нового отзыва', 'reyting'],
  ['about', 'О нас', 'Салон', 'Страница о салоне', 'o-nas'],
  ['intro', 'Знакомство', 'Салон', 'Вводная страница салона', 'vvedenie'],
  ['contacts', 'Контакты', 'Салон', 'Контакты, карта и форма обратной связи', 'kontakty'],
  ['partners', 'Партнёрство', 'Салон', 'Страница для партнёров', 'partnerstvo'],
  ['documents', 'Документы', 'Салон', 'Информационная страница с документами', 'documents'],
  ['newsletter', 'Подписка', 'Сервисы', 'Форма подписки на новости салона'],
  ['aiChat', 'Чат-помощник', 'Сервисы', 'Виджет помощника и публичные запросы чата'],
];

export const MANAGED_LANGS = ['de', 'en', 'ru', 'uk'];
export const OFFER_IDS = Object.keys(offerDefaults);
const sectionKeys = new Set(sections.map(([key]) => key));
const slugs = new Map(sections.filter(row => row[4]).map(([key, , , , slug]) => [slug, key]));
const fields = { badge: 80, title: 160, description: 600 };
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);

export function sectionForPath(pathname) {
  if (/^\/reviews(?:\.html)?\/?$/.test(pathname)) return 'reviews';
  const match = /^\/(de|en|ru|uk)\/([^/?]+)(\/.*)?$/i.exec(pathname);
  if (!match) return null;
  const slug = match[2].toLowerCase().replace(/\.html$/, '');
  if (match[3] && match[3] !== '/' && slug !== 'blog') return null;
  return slugs.get(slug) || null;
}

export function defaultSiteSettings() {
  return { revision: 0, sections: { promotions: false }, offers: {} };
}

function validOffer(value) {
  if (!record(value) || !OFFER_IDS.includes(value.id) || typeof value.enabled !== 'boolean' || !record(value.locales))
    return null;
  const locales = {};
  for (const lang of MANAGED_LANGS) {
    const source = value.locales[lang];
    if (!record(source)) return null;
    locales[lang] = {};
    for (const [field, limit] of Object.entries(fields)) {
      if (typeof source[field] !== 'string') return null;
      const text = source[field].trim();
      if (
        !text ||
        text.length > limit ||
        Array.from(text).some(char => char.charCodeAt(0) < 32 && !'\t\n\r'.includes(char))
      )
        return null;
      locales[lang][field] = text;
    }
  }
  return { id: value.id, enabled: value.enabled, locales };
}

export async function readSiteSettings(env) {
  const state = defaultSiteSettings();
  if (!env?.CHAT_DB && !env?.SITE_ADMIN_KEY) return state;
  let row;
  try {
    row = await adminDatabase(env).prepare('SELECT revision, payload FROM site_settings WHERE id = ?').bind(1).first();
  } catch (error) {
    // An installation without the admin key and migration still serves its original static pages.
    if (!env?.SITE_ADMIN_KEY && /no such table:\s*(?:main\.)?site_settings\b/i.test(String(error?.message)))
      return state;
    throw error;
  }
  if (!row || !Number.isSafeInteger(row.revision) || row.revision < 0) throw new Error('Invalid site settings row');
  const stored = JSON.parse(row.payload);
  if (
    !record(stored) ||
    (stored.sections !== undefined && !record(stored.sections)) ||
    (stored.offers !== undefined && !record(stored.offers))
  )
    throw new Error('Invalid site settings');
  for (const [key, value] of Object.entries(stored.sections || {})) {
    if (!sectionKeys.has(key) || typeof value !== 'boolean') throw new Error('Invalid saved section');
    state.sections[key] = value;
  }
  for (const [key, value] of Object.entries(stored.offers || {})) {
    const offer = validOffer(value);
    if (!offer || offer.id !== key) throw new Error('Invalid saved offer');
    state.offers[key] = offer;
  }
  state.revision = row.revision;
  return state;
}

export function disabledSlugs(state) {
  return [...slugs].filter(([, key]) => state.sections[key] === false).map(([slug]) => slug);
}

export function settingsSnapshot(state) {
  return {
    revision: state.revision,
    settings: sections.map(([key, label, group, description]) => ({
      key,
      label,
      group,
      description,
      enabled: state.sections[key] !== false,
      editable: true,
    })),
    offers: OFFER_IDS.map(id => state.offers[id] || { id, enabled: false, locales: offerDefaults[id] }),
  };
}

export async function saveSettingsChange(env, state, change) {
  if (!record(change) || !Number.isSafeInteger(change.revision) || change.revision < 0) return { status: 400 };
  if (change.revision !== state.revision) return { status: 409 };
  const next = { revision: state.revision + 1, sections: { ...state.sections }, offers: { ...state.offers } };
  if (Object.hasOwn(change, 'offer')) {
    const offer = validOffer(change.offer);
    if (!offer || Object.hasOwn(change, 'key') || Object.hasOwn(change, 'enabled')) return { status: 400 };
    next.offers[offer.id] = offer;
  } else {
    if (!sectionKeys.has(change.key) || typeof change.enabled !== 'boolean') return { status: 400 };
    next.sections[change.key] = change.enabled;
  }
  const payload = JSON.stringify({ sections: next.sections, offers: next.offers });
  const result = await adminDatabase(env)
    .prepare('UPDATE site_settings SET revision = revision + 1, payload = ? WHERE id = 1 AND revision = ?')
    .bind(payload, state.revision)
    .run();
  return result.meta.changes === 1 ? { status: 200, state: next } : { status: 409 };
}
