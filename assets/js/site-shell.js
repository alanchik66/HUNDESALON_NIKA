/*
 * Shared site shell for localized pages.
 * Responsibilities:
 * - detect the current language/page path
 * - rebuild the shared header/mobile navigation from one source of truth
 * - mount the 3D weather widget in the header
 * - provide localized UI copy used by main.js
 */
(function () {
  const SUPPORTED_LANGS = ['ru', 'uk', 'en', 'de'];

  const THEME_LABELS = {
    ru: {
      toLight: 'Переключить на светлую тему',
      toDark: 'Переключить на тёмную тему',
    },
    uk: {
      toLight: 'Перемкнути на світлу тему',
      toDark: 'Перемкнути на темну тему',
    },
    de: {
      toLight: 'Zum hellen Design wechseln',
      toDark: 'Zum dunklen Design wechseln',
    },
    en: {
      toLight: 'Switch to light theme',
      toDark: 'Switch to dark theme',
    },
  };

  const PRELOADER_COPY = {
    ru: {
      title: 'Извините, сайт временно недоступен',
      body: 'По техническим причинам сайт сейчас не загрузился. Мы стараемся как можно скорее вернуть его в рабочее состояние. Возможно, в данный момент ведутся административные работы.',
      reload: 'Обновить страницу',
    },
    uk: {
      title: 'Вибачте, сайт тимчасово недоступний',
      body: 'Через технічні причини сайт зараз не завантажився. Ми намагаємося якнайшвидше повернути його в робочий стан. Можливо, зараз тривають адміністративні роботи.',
      reload: 'Оновити сторінку',
    },
    de: {
      title: 'Entschuldigung, die Website ist vorübergehend nicht verfügbar',
      body: 'Aus technischen Gründen wurde die Website gerade nicht geladen. Wir arbeiten daran, den normalen Betrieb schnellstmöglich wiederherzustellen. Möglicherweise laufen derzeit administrative Arbeiten.',
      reload: 'Seite neu laden',
    },
    en: {
      title: 'Sorry, the website is temporarily unavailable',
      body: 'Due to technical reasons, the website did not finish loading right now. We are working to restore normal operation as quickly as possible. Administrative maintenance may currently be in progress.',
      reload: 'Reload page',
    },
  };

  const HEADER_COPY = {
    ru: {
      home: 'ГЛАВНАЯ',
      about: 'О НАС',
      services: 'НАШИ УСЛУГИ',
      price: 'ПРАЙС-ЛИСТ',
      gallery: 'ГАЛЕРЕЯ',
      galleryAll: 'НАША ГАЛЕРЕЯ',
      beforeAfter: 'ДО И ПОСЛЕ',
      contacts: 'КОНТАКТЫ',
      booking: 'ОНЛАЙН ЗАКАЗ',
      blog: 'БЛОГ',
      intro: 'ВВЕДЕНИЕ',
      socials: 'НАШИ СОЦИАЛЬНЫЕ СЕТИ',
      rating: 'РЕЙТИНГ',
      partner: 'ПАРТНЕРСКОЕ ПРЕДЛОЖЕНИЕ',
      promotions: 'АКЦИИ',
      selectLanguage: 'Выбрать язык',
    },
    uk: {
      home: 'ГОЛОВНА',
      about: 'ПРО НАС',
      services: 'НАШІ ПОСЛУГИ',
      price: 'ПРАЙС-ЛИСТ',
      gallery: 'ГАЛЕРЕЯ',
      galleryAll: 'НАША ГАЛЕРЕЯ',
      beforeAfter: 'ДО ТА ПІСЛЯ',
      contacts: 'КОНТАКТИ',
      booking: 'ОНЛАЙН ЗАПИС',
      blog: 'БЛОГ',
      intro: 'ВСТУП',
      socials: 'СОЦІАЛЬНІ МЕРЕЖІ',
      rating: 'РЕЙТИНГ І ВІДГУКИ',
      partner: 'ПАРТНЕРСЬКА ПРОПОЗИЦІЯ',
      promotions: 'АКЦІЇ',
      selectLanguage: 'Обрати мову',
    },
    de: {
      home: 'STARTSEITE',
      about: 'ÜBER UNS',
      services: 'UNSERE LEISTUNGEN',
      price: 'PREISLISTE',
      gallery: 'GALERIE',
      galleryAll: 'UNSERE GALERIE',
      beforeAfter: 'VORHER & NACHHER',
      contacts: 'KONTAKTE',
      booking: 'ONLINE BUCHEN',
      blog: 'BLOG',
      intro: 'EINFÜHRUNG',
      socials: 'SOZIALE MEDIEN',
      rating: 'BEWERTUNGEN',
      partner: 'PARTNERSCHAFT',
      promotions: 'ANGEBOTE',
      selectLanguage: 'Sprache wählen',
    },
    en: {
      home: 'HOME',
      about: 'ABOUT US',
      services: 'OUR SERVICES',
      price: 'PRICE LIST',
      gallery: 'GALLERY',
      galleryAll: 'OUR GALLERY',
      beforeAfter: 'BEFORE & AFTER',
      contacts: 'CONTACTS',
      booking: 'BOOK ONLINE',
      blog: 'BLOG',
      intro: 'INTRODUCTION',
      socials: 'SOCIAL MEDIA',
      rating: 'RATING',
      partner: 'PARTNERSHIP OFFER',
      promotions: 'PROMOTIONS',
      selectLanguage: 'Select language',
    },
  };

  const MEDIA_LIBRARY_COPY = {
    ru: {
      mediaLibrary: 'Наша медиатека',
      spotify: 'Spotify',
      appleMusic: 'Apple Music',
    },
    uk: {
      mediaLibrary: 'Наша медіатека',
      spotify: 'Spotify',
      appleMusic: 'Apple Music',
    },
    de: {
      mediaLibrary: 'Unsere Mediathek',
      spotify: 'Spotify',
      appleMusic: 'Apple Music',
    },
    en: {
      mediaLibrary: 'Our Media Library',
      spotify: 'Spotify',
      appleMusic: 'Apple Music',
    },
  };

  const MENU_A11Y = {
    ru: {
      openMenu: 'Открыть меню',
      closeMenu: 'Закрыть меню',
      expandGallery: 'Открыть раздел галереи',
      collapseGallery: 'Скрыть раздел галереи',
    },
    uk: {
      openMenu: 'Відкрити меню',
      closeMenu: 'Закрити меню',
      expandGallery: 'Відкрити розділ галереї',
      collapseGallery: 'Згорнути розділ галереї',
    },
    de: {
      openMenu: 'Menü öffnen',
      closeMenu: 'Menü schließen',
      expandGallery: 'Galeriebereich öffnen',
      collapseGallery: 'Galeriebereich schließen',
    },
    en: {
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
      expandGallery: 'Open gallery section',
      collapseGallery: 'Close gallery section',
    },
  };

  const MENU_SECTION_COPY = {
    ru: { more: 'Дополнительно' },
    uk: { more: 'Додатково' },
    de: { more: 'Mehr' },
    en: { more: 'More' },
  };

  const WEATHER_WIDGET_COPY = {
    ru: { ariaLabel: 'Виджет погоды салона' },
    uk: { ariaLabel: 'Віджет погоди салону' },
    de: { ariaLabel: 'Wetter-Widget des Salons' },
    en: { ariaLabel: 'Salon weather widget' },
  };

  const HEADER_WEATHER_TRANSPARENT_STYLES = `
:host([data-weather-variant='header']),
:host([data-weather-variant='header']) [data-weather-widget-root] {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
  overflow: visible !important;
  background: transparent !important;
  box-shadow: none !important;
  border: none !important;
  outline: none !important;
  border-radius: 0 !important;
  filter: none !important;
}

/* Force overflow:visible on every intermediate shadow DOM container
   so the scene canvas can extend above the widget without clipping. */
:host([data-weather-variant='header']) .weather-app,
:host([data-weather-variant='header']) .weather-app--header,
:host([data-weather-variant='header']) .weather-header-preview,
:host([data-weather-variant='header']) .weather-header-trigger,
:host([data-weather-variant='header']) .weather-header-card {
  overflow: visible !important;
  clip-path: none !important;
}

/* AGGRESSIVE RESET: kill every background/border/shadow inside the widget,
   EXCEPT for elements that are part of the dropdown menu, location selector,
   chips/pills inside the dropdown (which need their pill background) and a few
   intentional UI parts. The base preview/scene/trigger area must be invisible
   so only the 3D animation is visible. */
:host([data-weather-variant='header']) .weather-app,
:host([data-weather-variant='header']) .weather-app *:not(.weather-header-dropdown):not(.weather-header-dropdown *):not(.weather-location-selector):not(.weather-location-selector *),
:host([data-weather-variant='header']) .weather-app *:not(.weather-header-dropdown):not(.weather-header-dropdown *):not(.weather-location-selector):not(.weather-location-selector *)::before,
:host([data-weather-variant='header']) .weather-app *:not(.weather-header-dropdown):not(.weather-header-dropdown *):not(.weather-location-selector):not(.weather-location-selector *)::after {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
  border-style: none !important;
  border-width: 0 !important;
  border-color: transparent !important;
  outline-style: none !important;
  outline-width: 0 !important;
  outline-color: transparent !important;
  outline: none !important;
  filter: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}

/* Restore borders for the spinner ring (it needs a circular ring) */
.weather-header-state__spinner {
  border-style: solid !important;
  border-width: 2px !important;
  border-color: rgba(255, 255, 255, 0.18) !important;
  border-top-color: rgba(255, 238, 207, 0.96) !important;
}

.weather-header-preview {
  height: 100% !important;
  min-height: 100% !important;
  border-radius: 0 !important;
  overflow: visible !important;
}

.weather-app--header,
.weather-header-preview,
.weather-header-card,
.weather-header-card__content,
.weather-header-trigger,
.weather-app__scene,
.weather-app__scene--header,
.weather-app__scene-fallback--header,
.weather-app--header canvas {
  border-radius: 0 !important;
  clip-path: none !important;
}

/* Mask: linear gradient — top is ALWAYS fully opaque so clouds never clip,
   fades only at the bottom edge. */
.weather-app__scene,
.weather-app__scene--header,
.weather-app__scene--header canvas,
.weather-app--header canvas {
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 70%, rgba(0, 0, 0, 0.75) 88%, transparent 100%) !important;
          mask-image: linear-gradient(to bottom, #000 0%, #000 70%, rgba(0, 0, 0, 0.75) 88%, transparent 100%) !important;
  -webkit-mask-repeat: no-repeat !important;
          mask-repeat: no-repeat !important;
  -webkit-mask-size: 100% 100% !important;
          mask-size: 100% 100% !important;
}

.weather-app--header {
  border-radius: 0 !important;
}

.weather-app--header .weather-app__scene,
.weather-app--header .weather-app__scene--header {
  display: block !important;
  position: absolute !important;
  top: 0 !important;
  left: 50% !important;
  width: 118% !important;
  height: calc(100% + 120px) !important;
  min-height: calc(100% + 120px) !important;
  transform: translateX(-50%) !important;
  transform-origin: center top !important;
  overflow: visible !important;
  opacity: 1 !important;
  visibility: visible !important;
  background: transparent !important;
  z-index: 0 !important;
}

.weather-app--header canvas {
  position: absolute !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
  pointer-events: none !important;
  opacity: 1 !important;
  visibility: visible !important;
  background: transparent !important;
  z-index: 0 !important;
}

/* Stars: brighter and crisper — override the aggressive filter:none reset
   by matching its :not() chain to gain equal specificity, then win by
   source order (this rule appears later in the same style block). */
:host([data-weather-variant='header']) .weather-app canvas:not(.weather-header-dropdown):not(.weather-header-dropdown *):not(.weather-location-selector):not(.weather-location-selector *) {
  filter: brightness(1.55) contrast(1.18) saturate(1.12) !important;
}

.weather-header-preview {
  isolation: isolate !important;
}

.weather-header-trigger {
  z-index: 4 !important;
  cursor: default !important;
  pointer-events: auto !important;
}

.weather-header-card {
  position: absolute !important;
  inset: 0 !important;
  z-index: 5 !important;
}

.weather-header-card,
.weather-header-card__content,
.weather-header-trigger {
  opacity: 1 !important;
  visibility: visible !important;
}

.weather-header-card__content {
  position: relative !important;
  z-index: 6 !important;
  overflow: visible !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.56) !important;
}

.weather-header-card__toggle {
  pointer-events: auto !important;
  cursor: pointer !important;
  min-height: 28px !important;
  padding: 2px 8px !important;
  color: rgba(255, 238, 207, 0.96) !important;
}

.weather-header-card__toggle span {
  pointer-events: none !important;
}

.weather-header-card__top,
.weather-header-card__bottom,
.weather-header-card__condition,
.weather-header-dropdown__hero-top,
.weather-header-dropdown__hero-bottom,
.weather-header-dropdown__hero-title,
.weather-header-dropdown__hero-temp,
.weather-header-dropdown__hero-copy,
.weather-header-dropdown__hero-chips {
  position: relative !important;
  z-index: 7 !important;
}

.weather-header-dropdown {
  z-index: 9999 !important;
}

.weather-header-trigger,
.weather-header-trigger:hover,
.weather-header-trigger:focus,
.weather-header-trigger:focus-visible,
.weather-header-trigger:active {
  background: transparent !important;
  outline: none !important;
  box-shadow: none !important;
  border: none !important;
  -webkit-tap-highlight-color: transparent !important;
}

/* Mobile: keep the weather widget open and rectangular, without orb clipping. */
@media (max-width: 899px) {
  :host([data-weather-variant='header']),
  :host([data-weather-variant='header']) [data-weather-widget-root] {
    border-radius: 0 !important;
    clip-path: none !important;
    overflow: visible !important;
  }

  .weather-app--header .weather-app__scene,
  .weather-app--header .weather-app__scene--header {
    top: 0 !important;
    left: 50% !important;
    width: 124% !important;
    height: calc(100% + 440px) !important;
    min-height: calc(100% + 440px) !important;
    transform: translateX(-50%) !important;
    transform-origin: center top !important;
    overflow: visible !important;
  }

  .weather-app--header canvas {
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
  }

  .weather-header-card__content {
    padding: 8px 12px 10px !important;
  }

  .weather-header-card__top,
  .weather-header-card__bottom {
    position: static !important;
    transform: none !important;
  }

  .weather-header-card__title-block {
    max-width: min(46%, 150px) !important;
    transform: translate(28px, -5px) !important;
  }

  .weather-header-card__location {
    max-width: 138px !important;
    font-size: 13px !important;
    line-height: 1.08 !important;
  }

  .weather-header-card__meta {
    max-width: 138px !important;
  }

  .weather-header-card__side {
    position: static !important;
    right: auto !important;
    top: auto !important;
    bottom: auto !important;
    max-width: none !important;
    align-items: flex-end !important;
    transform: none !important;
  }

  .weather-header-card__condition {
    position: absolute !important;
    right: 10px !important;
    top: auto !important;
    bottom: 42px !important;
    width: 58px !important;
    min-width: 58px !important;
    max-width: 58px !important;
    font-size: 8px !important;
    line-height: 1.12 !important;
    overflow: visible !important;
    text-align: right !important;
  }

  .weather-header-card__toggle {
    position: absolute !important;
    left: 50% !important;
    right: auto !important;
    bottom: -7px !important;
    min-width: 120px !important;
    min-height: 20px !important;
    padding: 0 8px !important;
    font-size: 10px !important;
    line-height: 1 !important;
    justify-content: center !important;
    transform: translateX(-50%) !important;
  }

  .weather-header-card__toggle span:first-child {
    display: inline-flex !important;
    max-width: 104px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  .weather-header-card__toggle-icon {
    font-size: 17px !important;
  }

  .weather-header-card__temperature {
    position: absolute !important;
    left: 42px !important;
    bottom: 16px !important;
    transform: none !important;
  }

  .weather-header-card__chips {
    position: absolute !important;
    inset: 0 !important;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    display: block !important;
    transform: none !important;
  }

  .weather-header-card__chip {
    position: absolute !important;
    width: 58px !important;
    min-width: 58px !important;
    max-width: 58px !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    gap: 1px !important;
    line-height: 1.05 !important;
  }

  .weather-header-card__chip:first-child {
    left: 80px !important;
    bottom: 16px !important;
    align-items: flex-start !important;
    text-align: left !important;
  }

  .weather-header-card__chip:last-child {
    right: 10px !important;
    bottom: 16px !important;
    align-items: flex-end !important;
    text-align: right !important;
  }
}
`;

  const WEATHER_WIDGET_ASSET_VERSION = '20260429-weather-balance3';

  const LOCALIZED_ROUTES = new Set([
    '',
    'index.html',
    'o-nas.html',
    'nashi-uslugi.html',
    'prays-list.html',
    'galereya.html',
    'do-i-posle.html',
    'kontakty.html',
    'onlayn-bronirovanie.html',
    'blog.html',
    'blog/kak-podgotovit-sobaku.html',
    'blog/plokhaya-strizhka.html',
    'blog/strizhka-koshek.html',
    'blog/zashchita-ot-parazitov.html',
  ]);

  let headerWeatherLoaderPromise = null;
  let headerWeatherGeoPromise = null;

  function emitHeaderWeatherEvent(type, expanded = false) {
    window.dispatchEvent(new CustomEvent(type, { detail: { expanded } }));
  }

  function resolvePageContext() {
    const currentUrl = new URL(window.location.href);
    const pathParts = currentUrl.pathname.split('/').filter(Boolean);
    const langIndex = pathParts.findIndex(part => SUPPORTED_LANGS.includes(part));
    const currentLang = langIndex >= 0 ? pathParts[langIndex] : null;
    const currentRoute = langIndex >= 0 ? pathParts.slice(langIndex + 1).join('/') : '';
    const pageLang = document.documentElement.lang?.toLowerCase() || currentLang || 'en';

    return {
      currentUrl,
      pathParts,
      langIndex,
      currentLang,
      currentRoute,
      hasTrailingSlash: currentUrl.pathname.endsWith('/'),
      pageLang,
      copy: HEADER_COPY[currentLang || pageLang] || HEADER_COPY.en,
      mediaLibraryCopy: MEDIA_LIBRARY_COPY[currentLang || pageLang] || MEDIA_LIBRARY_COPY.en,
      menuA11y: MENU_A11Y[pageLang] || MENU_A11Y.en,
      menuSections: MENU_SECTION_COPY[pageLang] || MENU_SECTION_COPY.en,
      preloaderNotice: PRELOADER_COPY[pageLang] || PRELOADER_COPY.en,
      weatherWidgetCopy: WEATHER_WIDGET_COPY[pageLang] || WEATHER_WIDGET_COPY.en,
    };
  }

  function getThemeToggleLabel(pageLang, isLight) {
    const themeLabels = THEME_LABELS[pageLang] || THEME_LABELS.en;
    return isLight ? themeLabels.toDark : themeLabels.toLight;
  }

  function getLocalizedRoute(context) {
    if (context.langIndex < 0) {
      return 'index.html';
    }

    const route = context.pathParts.slice(context.langIndex + 1).join('/');
    if (!route) {
      return '';
    }

    return LOCALIZED_ROUTES.has(route) ? route : 'index.html';
  }

  function buildLanguageUrl(context, lang) {
    if (!SUPPORTED_LANGS.includes(lang)) {
      return null;
    }

    if (context.langIndex >= 0) {
      const nextParts = [...context.pathParts];
      nextParts[context.langIndex] = lang;

      const localizedRoute = getLocalizedRoute(context);
      const localizedRouteParts = localizedRoute ? localizedRoute.split('/') : [];
      nextParts.splice(context.langIndex + 1, nextParts.length - (context.langIndex + 1), ...localizedRouteParts);

      const nextUrl = new URL(context.currentUrl.toString());
      nextUrl.pathname = '/' + nextParts.join('/') + (context.hasTrailingSlash && !localizedRoute ? '/' : '');
      return nextUrl.toString();
    }

    return new URL(lang + '/', new URL('./', context.currentUrl)).toString();
  }

  function createHeaderMarkup(context) {
    const currentRouteNormalized = context.currentRoute || 'index.html';
    const depth = currentRouteNormalized.startsWith('blog/') ? 2 : 1;
    const pathPrefix = depth === 1 ? '' : '../';
    const assetPrefix = depth === 1 ? '../assets' : '../../assets';
    const weatherWidgetPrefix =
      depth === 1 ? '../3d-weather-codrops-main/dist-widget' : '../../3d-weather-codrops-main/dist-widget';
    const homeHref = depth === 1 ? 'index.html' : '../index.html';
    const copy = context.copy;
    const mediaLibraryCopy = context.mediaLibraryCopy;

    const activeKey = (() => {
      if (currentRouteNormalized === 'o-nas.html') return 'about';
      if (currentRouteNormalized === 'nashi-uslugi.html') return 'services';
      if (currentRouteNormalized === 'prays-list.html') return 'price';
      if (currentRouteNormalized === 'galereya.html' || currentRouteNormalized === 'do-i-posle.html') return 'gallery';
      if (currentRouteNormalized === 'kontakty.html') return 'contacts';
      return '';
    })();

    const socialIcons = [
      ['https://wa.me/4915151708888', 'fab fa-whatsapp', 'WhatsApp'],
      ['https://t.me/hundesalon_nika', 'fab fa-telegram', 'Telegram'],
      ['viber://chat?number=%2B4915151708888', 'fab fa-viber', 'Viber'],
      ['https://www.instagram.com/hundesalon_nika?igsh=MWthdXgyY2llMWRndw==', 'fab fa-instagram', 'Instagram'],
      ['https://www.tiktok.com/@hundesalon_nika', 'fab fa-tiktok', 'TikTok'],
      ['https://www.facebook.com/share/17SVsvkZEo/?mibextid=wwXIfr', 'fab fa-facebook-f', 'Facebook'],
      ['https://www.youtube.com/@hundesalon_nika', 'fab fa-youtube', 'YouTube'],
      [`${pathPrefix}social.html`, 'fas fa-share-alt', copy.socials],
    ];

    const socialBarMarkup = socialIcons
      .map(([href, iconClass, label]) => {
        const external = href.startsWith('http');
        return `<a href="${href}" class="social-icon"${external ? ' target="_blank" rel="noopener noreferrer"' : ''} aria-label="${label}"><i class="${iconClass}"></i></a>`;
      })
      .join('');

    const desktopSocialBarMarkup = socialBarMarkup;

    const mobileQuickLinksMarkup = [
      ...socialIcons,
      [`${pathPrefix}prays-list.html`, 'site-icon site-icon--euro mobile-menu-euro-icon', copy.price],
    ]
      .map(([href, iconClass, label]) => {
        const external = href.startsWith('http');
        const euroLinkClass = iconClass.includes('site-icon--euro') ? ' mobile-menu-euro-link' : '';
        return `<a href="${href}" class="social-icon${euroLinkClass}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''} aria-label="${label}" title="${label}"><i class="${iconClass}"></i></a>`;
      })
      .join('');

    const primaryLinks =
      context.currentLang === 'ru'
        ? `
  <a href="${pathPrefix}vvedenie.html">${copy.intro}</a>
  <a href="${pathPrefix}o-nas.html">${copy.about}</a>
  <a href="${pathPrefix}nashi-uslugi.html">${copy.services}</a>
  <a href="${pathPrefix}prays-list.html">${copy.price}</a>
  <div class="mobile-dropdown">
    <button class="mobile-dropdown-btn" id="mobileGalleryBtn" type="button" aria-expanded="false" aria-controls="mobileGalleryMenu" aria-label="${context.menuA11y.expandGallery}">${copy.gallery}</button>
    <div class="mobile-dropdown-menu" id="mobileGalleryMenu">
      <a href="${pathPrefix}galereya.html">${copy.galleryAll}</a>
      <a href="${pathPrefix}do-i-posle.html">${copy.beforeAfter}</a>
    </div>
  </div>
  <a href="${pathPrefix}blog.html">${copy.blog}</a>
  <a href="${pathPrefix}kontakty.html">${copy.contacts}</a>`
        : `
  <a href="${pathPrefix}o-nas.html">${copy.about}</a>
  <a href="${pathPrefix}nashi-uslugi.html">${copy.services}</a>
  <a href="${pathPrefix}prays-list.html">${copy.price}</a>
  <div class="mobile-dropdown">
    <button class="mobile-dropdown-btn" id="mobileGalleryBtn" type="button" aria-expanded="false" aria-controls="mobileGalleryMenu" aria-label="${context.menuA11y.expandGallery}">${copy.gallery}</button>
    <div class="mobile-dropdown-menu" id="mobileGalleryMenu">
      <a href="${pathPrefix}galereya.html">${copy.galleryAll}</a>
      <a href="${pathPrefix}do-i-posle.html">${copy.beforeAfter}</a>
    </div>
  </div>
  <a href="${pathPrefix}blog.html">${copy.blog}</a>
  <a href="${pathPrefix}kontakty.html">${copy.contacts}</a>`;

    const secondaryLinks = `
  <a href="${pathPrefix}social.html" class="mobile-nav-link--secondary">${copy.socials}</a>
  <a href="${pathPrefix}reyting.html" class="mobile-nav-link--secondary">${copy.rating}</a>
  <a href="${pathPrefix}partnerstvo.html" class="mobile-nav-link--secondary">${copy.partner}</a>
  <a href="${pathPrefix}onlayn-bronirovanie.html" class="mobile-nav-link--secondary">${copy.booking}</a>`;

    const activeClass = key => (activeKey === key ? ' active' : '');
    const activeAria = key => (activeKey === key ? ' aria-current="page"' : '');
    const isHomeRoute = currentRouteNormalized === '' || currentRouteNormalized === 'index.html';

    return `
<header class="header">
  <div class="top-row">
    <div class="logo-wrapper">
      <div class="logo">
        <a href="${homeHref}">
          <img src="${assetPrefix}/images/logo.png" alt="HUNDESALON_NIKA" class="logo-img">
        </a>
      </div>
    </div>

    <button class="premium-burger" id="burgerBtn" type="button" aria-label="${context.menuA11y.openMenu}" aria-expanded="false" aria-controls="mobile-nav">
      <span></span><span></span><span></span>
    </button>

    <div class="header-weather-shell">
      <div
        class="header-weather-widget"
        data-weather-widget="true"
        data-widget-src="${weatherWidgetPrefix}/weather-widget.iife.js?v=${WEATHER_WIDGET_ASSET_VERSION}"
        data-weather-location="Leipzig"
        data-weather-locale="${context.pageLang}"
        data-weather-min-height="100%"
        aria-label="${context.weatherWidgetCopy.ariaLabel}">
      </div>
    </div>

    <nav class="nav-main">
      <a href="${pathPrefix}o-nas.html" class="btn-neon${activeClass('about')}"${activeAria('about')}>${copy.about}</a>
      <a href="${pathPrefix}nashi-uslugi.html" class="btn-neon${activeClass('services')}"${activeAria('services')}>${copy.services}</a>
      <a href="${pathPrefix}prays-list.html" class="btn-neon${activeClass('price')}"${activeAria('price')}>${copy.price}</a>
      <div class="dropdown">
        <a href="${pathPrefix}galereya.html" class="btn-neon${activeClass('gallery')}"${activeAria('gallery')}>${copy.gallery}</a>
        <div class="dropdown-menu">
          <a href="${pathPrefix}galereya.html">${copy.galleryAll}</a>
          <a href="${pathPrefix}do-i-posle.html"${currentRouteNormalized === 'do-i-posle.html' ? ' class="active"' : ''}>${copy.beforeAfter}</a>
        </div>
      </div>
      <a href="${pathPrefix}kontakty.html" class="btn-neon${activeClass('contacts')}"${activeAria('contacts')}>${copy.contacts}</a>
    </nav>

    <div class="header-controls">
      <div class="language-dropdown">
        <button class="lang-dropdown-btn" type="button" aria-label="${copy.selectLanguage}" title="${copy.selectLanguage}">
          <i class="fas fa-globe"></i>
          <i class="fas fa-chevron-down"></i>
        </button>
        <ul class="lang-dropdown-menu">
          <li data-lang="de"><span class="flag">🇩🇪</span> Deutsch</li>
          <li data-lang="ru"><span class="flag">🇷🇺</span> Русский</li>
          <li data-lang="uk"><span class="flag">🇺🇦</span> Українська</li>
          <li data-lang="en"><span class="flag">🇬🇧</span> English</li>
        </ul>
      </div>
      <a href="${pathPrefix}onlayn-bronirovanie.html" class="header-online-btn">${copy.booking}</a>
      <button id="theme-toggle" class="theme-btn" type="button"></button>
    </div>
  </div>

  <div class="social-bar">
    <div class="social-bar-inner">
      <div class="social-bar-start">
        <div class="social-home">
          <a href="${homeHref}"${isHomeRoute ? ' class="active"' : ''} aria-label="${copy.home}">
            <img class="home-icon-img" src="${assetPrefix}/images/icon-pak/Gotovie iconki dlya saita/Home.png" alt="" aria-hidden="true">
            <span>${copy.home}</span>
          </a>
        </div>
        <span class="social-player-divider" aria-hidden="true"></span>
        <div class="social-player-wrap">
          <button class="social-player-toggle" type="button" aria-label="${mediaLibraryCopy.mediaLibrary}" aria-expanded="false" aria-controls="social-service-picker">
            <span class="social-player-icon" aria-hidden="true"></span>
          </button>
          <div class="social-service-picker" id="social-service-picker" hidden aria-hidden="true">
            <button class="social-service-btn" type="button" data-panel="social-spotify-panel" aria-label="Spotify">
              <img src="${assetPrefix}/images/icon-pak/ROYCE_Transparent_App_Icons/spotify.png" alt="Spotify">
            </button>
            <button class="social-service-btn" type="button" data-panel="social-apple-panel" aria-label="Apple Music">
              <img src="${assetPrefix}/images/icon-pak/ROYCE_Transparent_App_Icons/apple_music.png" alt="Apple Music">
            </button>
          </div>
          <div class="social-player-panel" id="social-spotify-panel" hidden aria-hidden="true">
            <iframe
              data-lazy-src="https://open.spotify.com/embed/playlist/37i9dQZF1DXcBWIGoYBM5M?utm_source=generator"
              title="Spotify player"
              loading="lazy"
              referrerpolicy="no-referrer"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture">
            </iframe>
          </div>
          <div class="social-player-panel" id="social-apple-panel" hidden aria-hidden="true">
            <iframe
              data-lazy-src="https://embed.music.apple.com/us/playlist/top-100-global/pl.d25f5d1181894928af76c85c967f8f31"
              title="Apple Music player"
              loading="lazy"
              referrerpolicy="no-referrer"
              allow="autoplay; encrypted-media; fullscreen"
              style="border-radius:12px;">
            </iframe>
          </div>
        </div>
      </div>
      <div class="social-icons social-icons--desktop">
        ${desktopSocialBarMarkup}
      </div>
      <div class="social-icons-wrap">
        <button class="social-icons-toggle" type="button" aria-label="${copy.socials}" aria-expanded="false" aria-controls="social-icons-list">
          <img src="${assetPrefix}/images/icon-pak/Gotovie iconki dlya saita/sozial-links.png" alt="" aria-hidden="true" class="social-icons-toggle-img">
        </button>
        <div class="social-icons" id="social-icons-list" hidden aria-hidden="true">
          ${socialBarMarkup}
        </div>
      </div>
    </div>
  </div>
</header>
<div id="mobile-nav-overlay" hidden aria-hidden="true"></div>
<nav id="mobile-nav" aria-hidden="true">
  <div class="mobile-nav-group mobile-nav-group--primary">
    ${primaryLinks}
  </div>
  <a href="${pathPrefix}index.html#promotions" class="promo-burger-btn">
    <span class="promo-btn-inner">
      <img src="${assetPrefix}/images/icon-pak/Gotovie iconki dlya saita/clash_royale.png" class="promo-btn-icon" alt="">
      <span class="promo-btn-label">${copy.promotions}</span>
    </span>
  </a>
  <div class="menu-separator" aria-hidden="true"><span>${context.menuSections.more}</span></div>
  <div class="mobile-nav-group mobile-nav-group--secondary">
    ${secondaryLinks}
  </div>
  <div class="menu-separator menu-separator--bottom" aria-hidden="true"></div>
</nav>`;
  }

  function standardizePageHeader(context) {
    const header = document.querySelector('header.header');
    if (!header || !context.currentLang) {
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = createHeaderMarkup(context);

    // Remove all variants of mobile-nav-overlay (kebab and camelCase)
    document.getElementById('mobile-nav-overlay')?.remove();
    document.getElementById('mobileNavOverlay')?.remove();
    // Remove all variants of mobile-nav (kebab and camelCase)
    ['mobile-nav', 'mobileNav'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !header.contains(el)) el.remove();
    });
    document.getElementById('mobile-nav')?.remove();
    document.getElementById('mobileNav')?.remove();

    header.replaceWith(...Array.from(wrapper.children));
  }

  function getHeaderWeatherHost() {
    return document.querySelector('.header-weather-widget[data-weather-widget]');
  }

  function syncHeaderWeatherExpandedState(host) {
    if (!host) {
      document.body?.classList.remove('header-weather-expanded');
      emitHeaderWeatherEvent('site-shell:weather-toggle', false);
      return;
    }

    const trigger = host.shadowRoot?.querySelector('.weather-header-trigger');
    const expanded = trigger?.getAttribute('aria-expanded') === 'true';
    const nextExpandedState = expanded ? 'true' : 'false';
    if (host.dataset.weatherExpanded === nextExpandedState) {
      return;
    }

    host.dataset.weatherExpanded = nextExpandedState;
    document.body?.classList.toggle('header-weather-expanded', expanded);
    emitHeaderWeatherEvent('site-shell:weather-toggle', expanded);
  }

  function bindHeaderWeatherState(host) {
    if (!host || host.__weatherStateObserver || !host.shadowRoot) {
      return;
    }

    const observer = new MutationObserver(mutations => {
      const shouldSync = mutations.some(
        mutation =>
          mutation.type === 'childList' ||
          (mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded')
      );

      if (shouldSync) {
        syncHeaderWeatherExpandedState(host);
      }
    });

    observer.observe(host.shadowRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-expanded'],
    });

    host.__weatherStateObserver = observer;
    syncHeaderWeatherExpandedState(host);

    if (!host.__weatherInteractionScopeBound) {
      host.__weatherInteractionScopeBound = true;
      host.shadowRoot.addEventListener(
        'click',
        ev => {
          const trigger = host.shadowRoot?.querySelector('.weather-header-trigger');
          if (!trigger) {
            return;
          }

          const path = typeof ev.composedPath === 'function' ? ev.composedPath() : [];
          if (!path.includes(trigger)) {
            return;
          }

          const isAllowedControl = path.some(node => {
            if (!(node instanceof Element)) {
              return false;
            }

            return Boolean(
              node.closest('.weather-header-card__toggle, .weather-header-dropdown, .weather-location-selector')
            );
          });

          if (!isAllowedControl) {
            ev.preventDefault();
            ev.stopPropagation();
            ev.stopImmediatePropagation?.();
          }
        },
        true
      );
    }
  }

  function loadHeaderWeatherWidgetLoader(scriptSrc) {
    if (window.Weather3DWidget) {
      return Promise.resolve(window.Weather3DWidget);
    }

    if (headerWeatherLoaderPromise) {
      return headerWeatherLoaderPromise;
    }

    headerWeatherLoaderPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-weather-widget-loader="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.Weather3DWidget), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load weather widget loader.')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.dataset.weatherWidgetLoader = 'true';
      script.onload = () => {
        if (window.Weather3DWidget) {
          resolve(window.Weather3DWidget);
        } else {
          reject(new Error('Weather widget loader is missing global API.'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load weather widget loader.'));
      document.head.appendChild(script);
    });

    return headerWeatherLoaderPromise;
  }

  function applyHeaderWeatherTransparency(host) {
    if (!host?.shadowRoot) {
      return;
    }

    const existing = host.shadowRoot.querySelector('style[data-header-weather-transparent="true"]');
    if (existing) {
      if (existing.textContent !== HEADER_WEATHER_TRANSPARENT_STYLES) {
        existing.textContent = HEADER_WEATHER_TRANSPARENT_STYLES;
      }
      return;
    }

    const styleTag = document.createElement('style');
    styleTag.dataset.headerWeatherTransparent = 'true';
    styleTag.textContent = HEADER_WEATHER_TRANSPARENT_STYLES;
    host.shadowRoot.appendChild(styleTag);
  }

  function resolveHeaderWeatherLocation() {
    if (headerWeatherGeoPromise) {
      return headerWeatherGeoPromise;
    }

    if (!window.isSecureContext || !navigator.geolocation) {
      headerWeatherGeoPromise = Promise.resolve(null);
      return headerWeatherGeoPromise;
    }

    headerWeatherGeoPromise = new Promise(resolve => {
      let resolved = false;
      const finalize = value => {
        if (resolved) {
          return;
        }
        resolved = true;
        resolve(value);
      };

      const timeoutId = window.setTimeout(() => finalize(null), 6500);
      navigator.geolocation.getCurrentPosition(
        position => {
          window.clearTimeout(timeoutId);
          const { latitude, longitude } = position.coords || {};
          if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
            finalize(`${latitude},${longitude}`);
          } else {
            finalize(null);
          }
        },
        () => {
          window.clearTimeout(timeoutId);
          finalize(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 6000,
          maximumAge: 300000,
        }
      );
    });

    return headerWeatherGeoPromise;
  }

  function unmountHeaderWeatherWidget() {
    const host = getHeaderWeatherHost();
    if (!host) {
      return;
    }

    host.__weatherWidgetInstance?.unmount?.();
    host.__weatherWidgetInstance = null;
    host.__weatherStateObserver?.disconnect?.();
    host.__weatherStateObserver = null;
    host.dataset.weatherMounted = 'false';
    delete host.dataset.weatherExpanded;
    host.classList.remove('is-mounted');
    document.body?.classList.remove('header-weather-expanded');
    emitHeaderWeatherEvent('site-shell:weather-ready', false);
    emitHeaderWeatherEvent('site-shell:weather-toggle', false);
  }

  async function mountHeaderWeatherWidget(pageLang) {
    const host = getHeaderWeatherHost();
    if (!host) {
      return;
    }

    if (host.dataset.weatherMounted === 'true' || host.dataset.weatherMounted === 'loading') {
      return;
    }

    host.dataset.weatherMounted = 'loading';

    // On mobile: always start collapsed (ignore persisted expanded state)
    if (window.innerWidth <= 899) {
      delete host.dataset.weatherExpanded;
      document.body?.classList.remove('header-weather-expanded');
    }

    try {
      const weatherWidget = await loadHeaderWeatherWidgetLoader(host.dataset.widgetSrc);
      const fallbackLocation = host.dataset.weatherLocation || 'Leipzig';
      const resolvedLocation = await resolveHeaderWeatherLocation();
      const initialLocation = resolvedLocation || fallbackLocation;

      const widgetApi = await weatherWidget.mountWeatherWidget(host, {
        variant: 'header',
        locale: host.dataset.weatherLocale || pageLang,
        initialLocation,
        fallbackLocation,
        useGeolocation: true,
        minHeight: host.dataset.weatherMinHeight || '100%',
      });

      host.__weatherWidgetInstance = widgetApi;
      host.dataset.weatherMounted = 'true';
      host.classList.add('is-mounted');
      host.closest('.header-weather-shell')?.classList.add('weather-shell-ready');
      applyHeaderWeatherTransparency(host);
      bindHeaderWeatherState(host);

      // Add moon widget overlay (only at night)
      const hour = new Date().getHours();
      const isNight = hour >= 19 || hour < 6;
      if (isNight && !host.querySelector('.moon-widget')) {
        const moonWidget = document.createElement('div');
        moonWidget.className = 'moon-widget';
        moonWidget.setAttribute('data-rotation-speed', '24');
        moonWidget.innerHTML = `
          <div class="moon-rotator">
            <div class="moon-image"></div>
          </div>
        `;
        host.appendChild(moonWidget);
      }

      // Also add moon to expanded menu if it renders in shadowRoot
      if (isNight && host.shadowRoot && !host.shadowRoot.querySelector('.moon-widget')) {
        const shadowMoon = document.createElement('div');
        shadowMoon.className = 'moon-widget';
        shadowMoon.setAttribute('data-rotation-speed', '24');
        shadowMoon.innerHTML = `
          <div class="moon-rotator">
            <div class="moon-image"></div>
          </div>
        `;
        host.shadowRoot.appendChild(shadowMoon);
      }

      // On mobile: collapse the widget (non-interactive decoration)
      if (window.innerWidth <= 899) {
        try {
          widgetApi?.collapse?.();
        } catch (_) {}
        host.dataset.weatherExpanded = 'false';
        document.body?.classList.remove('header-weather-expanded');
      }

      // Mobile: expand widget content to full width
      if (window.innerWidth <= 899 && host.shadowRoot) {
        const expandStyle = document.createElement('style');
        expandStyle.id = 'weather-mobile-expand';
        expandStyle.textContent = `
          @media (width <= 899px) {
            .widget-container,
            .widget-body,
            [class*="container"],
            [class*="body"] {
              width: 100% !important;
              max-width: 100% !important;
            }
            .widget-content,
            [class*="content"] {
              width: 100% !important;
            }
          }
        `;
        host.shadowRoot.appendChild(expandStyle);
      }

      emitHeaderWeatherEvent('site-shell:weather-ready', host.dataset.weatherExpanded === 'true');
    } catch (error) {
      console.error('Header weather widget failed to mount:', error);
      host.dataset.weatherMounted = 'error';
      host.closest('.header-weather-shell')?.classList.add('weather-shell-error');
      document.body?.classList.remove('header-weather-expanded');
      emitHeaderWeatherEvent('site-shell:weather-ready', false);
    }
  }

  function syncHeaderWeatherWidget(pageLang) {
    const host = getHeaderWeatherHost();
    if (!host) {
      unmountHeaderWeatherWidget();
      return;
    }

    /* Defer the (heavy) 3D widget boot until the browser is idle so it does
           not block DOMContentLoaded / first paint. Falls back to setTimeout on
           browsers without requestIdleCallback (Safari). */
    const schedule = window.requestIdleCallback
      ? cb => window.requestIdleCallback(cb, { timeout: 2500 })
      : cb => window.setTimeout(cb, 150);

    schedule(() => {
      mountHeaderWeatherWidget(pageLang);
    });
  }

  function normalizeMenuSeparators(label) {
    document.querySelectorAll('.menu-separator').forEach(separator => {
      separator.setAttribute('aria-hidden', 'true');

      if (!separator.querySelector('span')) {
        const caption = document.createElement('span');
        caption.textContent = label;
        separator.appendChild(caption);
      }
    });
  }

  function fitHomeLabelToLogo() {
    const homeSlot = document.querySelector('.social-home');
    const homeLink = homeSlot?.querySelector('a');
    if (!homeSlot || !homeLink) {
      return;
    }

    homeLink.style.setProperty('--home-fit-scale', '1');

    window.requestAnimationFrame(() => {
      const logoImage = document.querySelector('.logo-img');
      const logoWidth = logoImage?.getBoundingClientRect().width || 0;
      if (logoWidth > 0) {
        const logoSlotWidth = `${Math.round(logoWidth)}px`;
        document.documentElement.style.setProperty('--logo-mark-width', logoSlotWidth);
        homeSlot.style.setProperty('--home-slot-width', logoSlotWidth);
      }

      const homeLabel = homeLink.querySelector('span');
      if (!homeLabel) {
        return;
      }

      const homeIcon = homeLink.querySelector('.home-icon-img');
      const iconVisible = homeIcon ? window.getComputedStyle(homeIcon).display !== 'none' : false;
      const iconWidth = iconVisible ? homeIcon.getBoundingClientRect().width || 22 : 0;
      const iconGap = iconVisible ? 5 : 0;
      const slotWidth = homeSlot.getBoundingClientRect().width;
      const availableWidth = Math.max(slotWidth - iconWidth - iconGap - 2, 0);
      const naturalWidth = homeLabel.getBoundingClientRect().width;
      if (!availableWidth || !naturalWidth) {
        return;
      }

      const fitScale = Math.max(0.38, Math.min(1.08, availableWidth / naturalWidth));
      homeLink.style.setProperty('--home-fit-scale', fitScale.toFixed(3));
    });
  }

  function initLanguageDropdown(context) {
    const langDropdown = document.querySelector('.header-controls .language-dropdown');
    const langBtn = document.querySelector('.header-controls .lang-dropdown-btn');

    if (!langDropdown || !langBtn || langDropdown.dataset.bound === 'true') {
      return;
    }

    langDropdown.dataset.bound = 'true';

    const closeLangDropdown = () => {
      langDropdown.classList.remove('open');
      langBtn.setAttribute('aria-expanded', 'false');
    };

    const openLangDropdown = () => {
      langDropdown.classList.add('open');
      langBtn.setAttribute('aria-expanded', 'true');
    };

    langBtn.setAttribute('aria-haspopup', 'menu');
    langBtn.setAttribute('aria-expanded', 'false');

    langBtn.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      langDropdown.classList.contains('open') ? closeLangDropdown() : openLangDropdown();
    });

    langBtn.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        langDropdown.classList.contains('open') ? closeLangDropdown() : openLangDropdown();
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openLangDropdown();
        langDropdown.querySelector('.lang-dropdown-menu li')?.focus();
      }
    });

    document.addEventListener('click', event => {
      if (!langDropdown.contains(event.target)) {
        closeLangDropdown();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeLangDropdown();
      }
    });

    langDropdown.querySelectorAll('.lang-dropdown-menu li').forEach(item => {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'menuitem');

      const navigateToLanguage = () => {
        closeLangDropdown();
        const lang = item.getAttribute('data-lang');
        const nextUrl = lang ? buildLanguageUrl(context, lang) : null;
        if (!nextUrl) {
          return;
        }

        localStorage.setItem('preferred_lang', lang);
        window.location.href = nextUrl;
      };

      item.addEventListener('click', navigateToLanguage);
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigateToLanguage();
        }
      });
    });
  }

  function init() {
    const context = resolvePageContext();

    if (context.currentLang) {
      localStorage.setItem('preferred_lang', context.currentLang);
    }

    standardizePageHeader(context);
    syncHeaderWeatherWidget(context.pageLang);
    normalizeMenuSeparators(context.menuSections.more);
    fitHomeLabelToLogo();

    window.addEventListener('load', fitHomeLabelToLogo);
    window.addEventListener('resize', fitHomeLabelToLogo);
    document.fonts?.ready?.then(fitHomeLabelToLogo);

    return {
      ...context,
      getThemeToggleLabel: isLight => getThemeToggleLabel(context.pageLang, isLight),
      buildLanguageUrl: lang => buildLanguageUrl(context, lang),
      initLanguageDropdown: () => initLanguageDropdown(context),
    };
  }

  window.SiteShell = {
    init,
  };
})();
