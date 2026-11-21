import { TELEGRAM_MENU_COPY as COPY } from './telegram-menu-copy.js';

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
  if (typeof telegramWebApp.isVersionAtLeast !== 'function' || !telegramWebApp.isVersionAtLeast('6.1')) return;

  try {
    telegramWebApp.setHeaderColor('#031910');
    telegramWebApp.setBackgroundColor('#010502');
  } catch {
    // Older Telegram clients keep their own WebView colors.
  }
}

function normalizeLanguage(value) {
  const language = String(value || '')
    .trim()
    .toLowerCase()
    .split('-')[0];
  return Object.hasOwn(COPY, language) ? language : 'de';
}

function resolveInitialLanguage() {
  const params = new URLSearchParams(window.location.search);
  return normalizeLanguage(params.get('lang') || navigator.language);
}

function pageCopy(language) {
  const copy = { ...COPY[language] };
  const template = document.querySelector(`template[data-telegram-editor="${language}"]`);
  for (const field of template?.content.querySelectorAll('[data-telegram-text]') || []) {
    const key = field.dataset.telegramText;
    if (Object.hasOwn(copy, key)) copy[key] = field.textContent;
  }
  return copy;
}

function setLanguage(language, { updateUrl = true } = {}) {
  activeLanguage = normalizeLanguage(language);
  const copy = pageCopy(activeLanguage);
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
