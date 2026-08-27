const ROUTES = Object.freeze({
  de: {
    booking: '/de/onlayn-bronirovanie',
    prices: '/de/prays-list',
    contact: '/de/kontakty',
  },
  en: {
    booking: '/en/onlayn-bronirovanie',
    prices: '/en/prays-list',
    contact: '/en/kontakty',
  },
  ru: {
    booking: '/ru/onlayn-bronirovanie',
    prices: '/ru/prays-list',
    contact: '/ru/kontakty',
  },
  uk: {
    booking: '/uk/onlayn-bronirovanie',
    prices: '/uk/prays-list',
    contact: '/uk/kontakty',
  },
});

const COPY = Object.freeze({
  de: {
    eyebrow: 'Premium-Fellpflege',
    title: 'Alles für Ihr Tier. Mit Liebe zum Detail.',
    lead: 'Wählen Sie einen Bereich – der passende Weg öffnet sich sofort.',
    bookingTitle: 'Online-Termin',
    bookingDescription: 'Wunschtermin bequem anfragen',
    pricesTitle: 'Leistungen & Preise',
    pricesDescription: 'Passende Pflege transparent finden',
    contactTitle: 'Adresse & Zeiten',
    contactDescription: 'Unser Salon in Leipzig',
    supportTitle: 'Mitarbeiter kontaktieren',
    supportDescription: 'Wir antworten direkt im Telegram-Chat',
    promise: 'Persönliche Beratung · Transparente Preise · Liebevolle Fellpflege',
    languageEyebrow: 'Ihre Sprache',
    languageTitle: 'Wie dürfen wir Sie begrüßen?',
  },
  en: {
    eyebrow: 'Premium coat care',
    title: 'Everything for your pet. With care in every detail.',
    lead: 'Choose a section and the right path opens immediately.',
    bookingTitle: 'Book online',
    bookingDescription: 'Request your preferred appointment',
    pricesTitle: 'Services & prices',
    pricesDescription: 'Find the right care with clear pricing',
    contactTitle: 'Address & hours',
    contactDescription: 'Our salon in Leipzig',
    supportTitle: 'Contact support',
    supportDescription: 'We reply directly in the Telegram chat',
    promise: 'Personal advice · Transparent prices · Loving coat care',
    languageEyebrow: 'Your language',
    languageTitle: 'How would you like us to welcome you?',
  },
  ru: {
    eyebrow: 'Премиальный уход за шерстью',
    title: 'Всё для питомца. С вниманием к каждой детали.',
    lead: 'Выберите раздел — нужный путь откроется сразу.',
    bookingTitle: 'Онлайн-запись',
    bookingDescription: 'Удобно запросить желаемое время',
    pricesTitle: 'Услуги и цены',
    pricesDescription: 'Прозрачно подобрать подходящий уход',
    contactTitle: 'Адрес и часы',
    contactDescription: 'Наш салон в Лейпциге',
    supportTitle: 'Связаться с сотрудником',
    supportDescription: 'Ответим прямо в Telegram-чате',
    promise: 'Личная консультация · Прозрачные цены · Бережный уход за шерстью',
    languageEyebrow: 'Ваш язык',
    languageTitle: 'Как вас поприветствовать?',
  },
  uk: {
    eyebrow: 'Преміальний догляд за шерстю',
    title: 'Усе для улюбленця. З увагою до кожної деталі.',
    lead: 'Оберіть розділ — потрібний шлях відкриється одразу.',
    bookingTitle: 'Онлайн-запис',
    bookingDescription: 'Зручно надіслати запит на час',
    pricesTitle: 'Послуги й ціни',
    pricesDescription: 'Прозоро підібрати потрібний догляд',
    contactTitle: 'Адреса й години',
    contactDescription: 'Наш салон у Лейпцигу',
    supportTitle: 'Зв’язатися з підтримкою',
    supportDescription: 'Відповімо безпосередньо в Telegram-чаті',
    promise: 'Особиста консультація · Прозорі ціни · Дбайливий догляд за шерстю',
    languageEyebrow: 'Ваша мова',
    languageTitle: 'Як вас привітати?',
  },
});

const LANGUAGE_LABELS = Object.freeze({
  de: 'DE',
  en: 'EN',
  ru: 'RU',
  uk: 'UK',
});

const languageSheet = document.querySelector('#telegram-menu-languages');
const languageTrigger = document.querySelector('[data-language-trigger]');
const currentLanguage = document.querySelector('[data-current-language]');
const telegramWebApp = window.Telegram?.WebApp;
let activeLanguage = 'de';

function initializeTelegramWebApp() {
  if (!telegramWebApp) return;

  telegramWebApp.ready();
  telegramWebApp.expand();
  try {
    telegramWebApp.setHeaderColor('#031910');
    telegramWebApp.setBackgroundColor('#010502');
  } catch {
    // Older Telegram clients keep their own WebView colors.
  }
}

function normalizeLanguage(value) {
  const language = String(value || '').trim().toLowerCase().split('-')[0];
  return Object.hasOwn(COPY, language) ? language : 'de';
}

function resolveInitialLanguage() {
  const params = new URLSearchParams(window.location.search);
  return normalizeLanguage(params.get('lang') || navigator.language);
}

function setLanguage(language, { updateUrl = true } = {}) {
  activeLanguage = normalizeLanguage(language);
  const copy = COPY[activeLanguage];
  document.documentElement.lang = activeLanguage;
  currentLanguage.textContent = LANGUAGE_LABELS[activeLanguage];

  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.dataset.i18n;
    if (copy[key]) element.textContent = copy[key];
  });

  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === activeLanguage));
  });

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', activeLanguage);
    window.history.replaceState({}, '', url);
  }
}

function closeLanguageSheet() {
  languageSheet.hidden = true;
  languageTrigger.setAttribute('aria-expanded', 'false');
  languageTrigger.focus();
}

function openLanguageSheet() {
  languageSheet.hidden = false;
  languageTrigger.setAttribute('aria-expanded', 'true');
  languageSheet.querySelector(`[data-language="${activeLanguage}"]`)?.focus();
}

function openRoute(route) {
  if (route === 'support') {
    const supportUrl = 'https://t.me/hundesalon_nika_support_bot?start=support';
    if (telegramWebApp?.openTelegramLink) {
      telegramWebApp.openTelegramLink(supportUrl);
    } else {
      window.location.assign(supportUrl);
    }
    return;
  }

  const target = ROUTES[activeLanguage][route];
  if (!target) return;
  const targetUrl = new URL(target, window.location.origin).href;
  if (telegramWebApp?.openLink) {
    telegramWebApp.openLink(targetUrl);
  } else {
    window.location.assign(targetUrl);
  }
}

languageTrigger.addEventListener('click', openLanguageSheet);

document.querySelectorAll('[data-language-close]').forEach(element => {
  element.addEventListener('click', closeLanguageSheet);
});

document.querySelectorAll('[data-language]').forEach(button => {
  button.addEventListener('click', () => {
    setLanguage(button.dataset.language);
    closeLanguageSheet();
  });
});

document.querySelectorAll('[data-route]').forEach(button => {
  button.addEventListener('click', () => openRoute(button.dataset.route));
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !languageSheet.hidden) closeLanguageSheet();
});

initializeTelegramWebApp();
setLanguage(resolveInitialLanguage(), { updateUrl: false });
