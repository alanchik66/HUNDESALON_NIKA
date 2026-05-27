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
    ru: { ariaLabel: 'Виджет погоды по вашей геолокации' },
    uk: { ariaLabel: 'Віджет погоди за вашою геолокацією' },
    de: { ariaLabel: 'Wetter-Widget fuer Ihre Geolokation' },
    en: { ariaLabel: 'Weather widget for your geolocation' },
  };

  /** Menu toggle aligned to the gold decorative strip between weather and social bar. */
  const HEADER_WEATHER_MENU_TOGGLE_BOTTOM = '-6px';
  /** Arrow: left when closed → CW to down when open (cursor demo: слева → вниз). */
  const HEADER_WEATHER_TOGGLE_ARROW_CLOSED = 'rotate(90deg)';
  const HEADER_WEATHER_TOGGLE_ARROW_OPEN = 'rotate(0deg)';
  /** Preview moon size (+30% vs backup 8fbeca0 baseline), −15% display trim, −20% owner trim. */
  const HEADER_WEATHER_MOON_DISPLAY_SCALE = 0.85;
  const HEADER_WEATHER_MOON_SIZE_REDUCTION = 0.8;
  const HEADER_WEATHER_MOON_SIZE_BOOST =
    1.3 * 0.85 * 1.3 * HEADER_WEATHER_MOON_DISPLAY_SCALE * HEADER_WEATHER_MOON_SIZE_REDUCTION;
  const HEADER_WEATHER_MOON_SIZE_FACTOR = 3 * HEADER_WEATHER_MOON_SIZE_BOOST;
  /** Tiled CSS starfield — fills full trigger/dropdown height (avoids mid-band-only clusters). */
  const HEADER_WEATHER_STARFIELD_TILE_A =
    'radial-gradient(circle, rgba(255, 255, 255, 0.54) 0 0.48px, transparent 0.84px) 0 0 / 30px 30px';
  const HEADER_WEATHER_STARFIELD_TILE_B =
    'radial-gradient(circle, rgba(214, 229, 252, 0.38) 0 0.42px, transparent 0.8px) 12px 8px / 34px 34px';
  /**
   * Red-cross slot (owner screenshot): vertical line under the header lightbulb (~68%),
   * horizontal mid-line of the weather band; geometric center on the intersection.
   */
  const HEADER_WEATHER_ORB_PREVIEW_ANCHOR = Object.freeze({
    left: 68,
    offsetX: -3,
    offsetY: -4,
  });
  const HEADER_WEATHER_MOON_PREVIEW_ANCHOR = HEADER_WEATHER_ORB_PREVIEW_ANCHOR;
  const HEADER_WEATHER_SUN_PREVIEW_ANCHOR = HEADER_WEATHER_ORB_PREVIEW_ANCHOR;
  const HEADER_WEATHER_MOON_PREVIEW_LAYOUT = Object.freeze({
    left: HEADER_WEATHER_MOON_PREVIEW_ANCHOR.left,
    offsetX: HEADER_WEATHER_MOON_PREVIEW_ANCHOR.offsetX,
    offsetY: HEADER_WEATHER_MOON_PREVIEW_ANCHOR.offsetY,
    scale: 0.46 * HEADER_WEATHER_MOON_SIZE_BOOST,
    objectPosition: '50% 48%',
  });
  const HEADER_WEATHER_MOON_DROPDOWN_LAYOUT = Object.freeze({
    left: HEADER_WEATHER_MOON_PREVIEW_ANCHOR.left,
    offsetX: HEADER_WEATHER_MOON_PREVIEW_ANCHOR.offsetX,
    offsetY: HEADER_WEATHER_MOON_PREVIEW_ANCHOR.offsetY,
    scale: 0.38 * HEADER_WEATHER_MOON_SIZE_BOOST,
    objectPosition: '50% 50%',
  });
  const HEADER_WEATHER_SUN_PREVIEW_LAYOUT = Object.freeze({
    left: HEADER_WEATHER_SUN_PREVIEW_ANCHOR.left,
    offsetX: HEADER_WEATHER_SUN_PREVIEW_ANCHOR.offsetX,
    offsetY: HEADER_WEATHER_SUN_PREVIEW_ANCHOR.offsetY,
    scale: 0.94,
    objectPosition: '50% 50%',
  });
  const HEADER_WEATHER_SUN_DROPDOWN_LAYOUT = Object.freeze({
    left: HEADER_WEATHER_SUN_PREVIEW_ANCHOR.left,
    offsetX: HEADER_WEATHER_SUN_PREVIEW_ANCHOR.offsetX,
    offsetY: HEADER_WEATHER_SUN_PREVIEW_ANCHOR.offsetY,
    scale: 0.88,
    objectPosition: '50% 50%',
  });
  /** Header sun: ×1/3 vs previous widget orb (fits header strip ~96–104px tall). */
  const HEADER_WEATHER_SUN_BRIGHTNESS = 1.22;
  const HEADER_WEATHER_SUN_MEDIA_SCALE = 0.88;
  const HEADER_WEATHER_SUN_SIZE_FACTOR = 1.48 / 3;

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
:host([data-weather-variant='header']) .weather-header-preview .weather-orb-stack--preview-back,
:host([data-weather-variant='header']) .weather-header-trigger,
:host([data-weather-variant='header']) .weather-header-card {
  overflow: visible !important;
  clip-path: none !important;
}

/* Smooth weather value updates without blinking. */
:host([data-weather-variant='header']) .weather-header-card__condition,
:host([data-weather-variant='header']) .weather-header-card__meta,
:host([data-weather-variant='header']) .weather-header-card__chip,
:host([data-weather-variant='header']) .weather-header-card__temperature,
:host([data-weather-variant='header']) .weather-header-card__location,
:host([data-weather-variant='header']) .weather-header-card__toggle {
  transition:
    opacity 220ms ease,
    color 280ms ease,
    filter 280ms ease !important;
}

:host([data-weather-variant='header'][data-weather-refreshing='true']) .weather-header-card__condition,
:host([data-weather-variant='header'][data-weather-refreshing='true']) .weather-header-card__meta,
:host([data-weather-variant='header'][data-weather-refreshing='true']) .weather-header-card__chip,
:host([data-weather-variant='header'][data-weather-refreshing='true']) .weather-header-card__temperature,
:host([data-weather-variant='header'][data-weather-refreshing='true']) .weather-header-card__location,
:host([data-weather-variant='header'][data-weather-refreshing='true']) .weather-header-card__toggle {
  opacity: 0.92 !important;
}

/* Some internal preview wrappers may still keep overflow hidden.
   Force anti-clip for all nested preview layers and pseudo-elements. */
:host([data-weather-variant='header']) .weather-header-preview *,
:host([data-weather-variant='header']) .weather-header-preview *::before,
:host([data-weather-variant='header']) .weather-header-preview *::after {
  overflow: visible !important;
  clip-path: none !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
}

/* Unified stars back layer (CSS + 3D canvas) — never mask the cloud scene. */
:host([data-weather-variant='header']) .weather-header-preview__stars-back:not(.is-night-sky)::before,
:host([data-weather-variant='header']) .weather-header-preview__stars-back:not(.is-night-sky)::after {
  content: none !important;
  display: none !important;
  background: none !important;
  box-shadow: none !important;
}

.weather-header-trigger {
  position: relative !important;
  overflow: visible !important;
}

.weather-header-preview__stars-back {
  position: absolute !important;
  top: calc(-1 * var(--header-weather-cloud-rise, 0px)) !important;
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
  height: calc(100% + var(--header-weather-cloud-rise, 0px) + var(--header-weather-cloud-extra-h, 24px)) !important;
  bottom: auto !important;
  z-index: 1 !important;
  pointer-events: none !important;
  overflow: visible !important;
  isolation: isolate !important;
}

/* Stars must never render inside the cloud canvas stack (z-index 8) — only in stars-back. */
.weather-header-preview .weather-app__scene .weather-app__stars-scene--header-panel,
.weather-header-preview .weather-app__scene--header .weather-app__stars-scene--header-panel {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.weather-header-preview__stars-back .weather-app__stars-scene--header-panel {
  position: absolute !important;
  inset: 0 !important;
  z-index: 0 !important;
  pointer-events: none !important;
  overflow: visible !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.weather-header-preview__stars-back.is-night-sky .weather-app__stars-scene--header-panel {
  display: block !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.weather-header-preview__stars-back .weather-app__stars-scene--header-panel canvas {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  display: block !important;
  pointer-events: none !important;
  background: transparent !important;
}

/* AGGRESSIVE RESET: kill every background/border/shadow inside the widget,
   EXCEPT for elements that are part of the dropdown menu, location selector,
   chips/pills inside the dropdown (which need their pill background) and a few
   intentional UI parts. The base preview/scene/trigger area must be invisible
   so only the 3D animation is visible. */
:host([data-weather-variant='header']) .weather-app,
:host([data-weather-variant='header']) .weather-app *:not(.weather-header-dropdown):not(.weather-header-dropdown *):not(.weather-location-selector):not(.weather-location-selector *):not(.weather-header-preview):not(.weather-header-preview *),
:host([data-weather-variant='header']) .weather-app *:not(.weather-header-dropdown):not(.weather-header-dropdown *):not(.weather-location-selector):not(.weather-location-selector *):not(.weather-header-preview):not(.weather-header-preview *)::before,
:host([data-weather-variant='header']) .weather-app *:not(.weather-header-dropdown):not(.weather-header-dropdown *):not(.weather-location-selector):not(.weather-location-selector *):not(.weather-header-preview):not(.weather-header-preview *)::after {
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
:host([data-weather-variant='header']) {
  --header-weather-menu-toggle-bottom: ${HEADER_WEATHER_MENU_TOGGLE_BOTTOM};
  --header-weather-cloud-rise: 0px;
  --header-weather-cloud-extra-h: 24px;
  --header-weather-text-inset: 0px;
  --header-weather-metrics-gap: 3px;
  --header-weather-metrics-condition-gap: 4px;
  --header-weather-metrics-min-width: 9.5rem;
  --header-weather-condition-font-size: 6.5px;
  --header-weather-condition-line-height: 8.32px;
  --weather-readability-scrim: 0;
  --weather-readability-glow: 0;
  --weather-text-alpha: 0.94;
  --weather-eyebrow-alpha: 0.78;
  --weather-scene-dim: 1;
  --weather-loader-size: clamp(38px, 7.2vw, 44px);
  --weather-loader-core-size: clamp(5px, 1.05vw, 6px);
  --weather-loader-inner-gap: clamp(4px, 0.8vw, 5px);
  --weather-loader-label-offset: calc(var(--weather-loader-size) + 10px);
}

.weather-header-state__spinner {
  position: relative !important;
  width: var(--weather-loader-size) !important;
  height: var(--weather-loader-size) !important;
  border-radius: 50% !important;
  border: 1px solid rgba(224, 233, 248, 0.16) !important;
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 72%)
    !important;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 8px rgba(138, 183, 246, 0.16) !important;
  animation: weatherHeaderLoaderBreath 2.8s ease-in-out infinite !important;
}

.weather-header-state__spinner::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: 50% !important;
  background: conic-gradient(
    from -90deg,
    rgba(245, 225, 170, 0) 0deg,
    rgba(245, 225, 170, 0) 210deg,
    rgba(245, 225, 170, 0.76) 270deg,
    rgba(224, 240, 255, 0.92) 302deg,
    rgba(245, 225, 170, 0) 340deg,
    rgba(245, 225, 170, 0) 360deg
  ) !important;
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
  animation: weatherHeaderLoaderSpin 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite !important;
}

.weather-header-state__spinner::after {
  content: '' !important;
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  width: var(--weather-loader-core-size) !important;
  height: var(--weather-loader-core-size) !important;
  margin-left: calc(var(--weather-loader-core-size) / -2) !important;
  margin-top: calc(var(--weather-loader-core-size) / -2) !important;
  border-radius: 50% !important;
  background: radial-gradient(circle at 50% 50%, rgba(255, 249, 236, 0.98) 0%, rgba(240, 217, 160, 0.9) 100%)
    !important;
  box-shadow:
    0 0 8px rgba(252, 226, 173, 0.56),
    0 0 14px rgba(169, 202, 245, 0.26) !important;
  transform-origin: center calc((var(--weather-loader-size) / 2) - 1px) !important;
  animation:
    weatherHeaderLoaderComet 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite,
    weatherHeaderLoaderPulse 2s ease-in-out infinite !important;
}

.weather-header-state__inner {
  display: grid !important;
  place-items: center !important;
  gap: 10px !important;
}

.weather-header-state__inner p {
  margin: 0 !important;
  font-size: 9px !important;
  line-height: 1.3 !important;
  color: rgba(236, 244, 255, 0.84) !important;
  letter-spacing: 0.12em !important;
  text-transform: uppercase !important;
  text-shadow: 0 1px 4px rgba(28, 48, 78, 0.42) !important;
  opacity: 1 !important;
}

.weather-header-state__inner p::before,
.weather-header-state__inner p::after {
  content: none !important;
}

/* Scene preload: concise glass-gold loader with readable text. */
.weather-app__scene-fallback,
.weather-app__scene-fallback--header {
  display: grid !important;
  place-items: center !important;
  pointer-events: none !important;
}

.weather-app__scene-fallback .text-sm,
.weather-app__scene-fallback--header .text-sm,
.weather-app__scene-fallback [class*='text-sm'],
.weather-app__scene-fallback--header [class*='text-sm'] {
  position: relative !important;
  display: inline-grid !important;
  place-items: center !important;
  min-width: var(--weather-loader-size) !important;
  min-height: var(--weather-loader-size) !important;
  padding-top: var(--weather-loader-label-offset) !important;
  font-size: 9px !important;
  line-height: 1.3 !important;
  color: rgba(236, 244, 255, 0.82) !important;
  letter-spacing: 0.12em !important;
  text-transform: uppercase !important;
  text-shadow: 0 1px 4px rgba(28, 48, 78, 0.42) !important;
  opacity: 1 !important;
}

.weather-app__scene-fallback .text-sm::before,
.weather-app__scene-fallback--header .text-sm::before,
.weather-app__scene-fallback [class*='text-sm']::before,
.weather-app__scene-fallback--header [class*='text-sm']::before {
  content: '' !important;
  position: absolute !important;
  left: 50% !important;
  top: 0 !important;
  width: var(--weather-loader-size) !important;
  height: var(--weather-loader-size) !important;
  margin-left: calc(var(--weather-loader-size) / -2) !important;
  border-radius: 50% !important;
  border: 1px solid rgba(224, 233, 248, 0.16) !important;
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 72%)
    !important;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.08),
    0 0 8px rgba(138, 183, 246, 0.16) !important;
  animation: weatherHeaderLoaderBreath 2.8s ease-in-out infinite !important;
}

.weather-app__scene-fallback .text-sm::after,
.weather-app__scene-fallback--header .text-sm::after,
.weather-app__scene-fallback [class*='text-sm']::after,
.weather-app__scene-fallback--header [class*='text-sm']::after {
  content: '' !important;
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  width: var(--weather-loader-core-size) !important;
  height: var(--weather-loader-core-size) !important;
  margin-left: calc(var(--weather-loader-core-size) / -2) !important;
  margin-top: calc(var(--weather-loader-core-size) / -2) !important;
  border-radius: 50% !important;
  background: radial-gradient(circle at 50% 50%, rgba(255, 249, 236, 0.98) 0%, rgba(240, 217, 160, 0.9) 100%)
    !important;
  box-shadow:
    0 0 8px rgba(252, 226, 173, 0.56),
    0 0 14px rgba(169, 202, 245, 0.26) !important;
  transform-origin: center calc((var(--weather-loader-size) / 2) - 1px) !important;
  animation:
    weatherHeaderLoaderComet 2.2s cubic-bezier(0.22, 1, 0.36, 1) infinite,
    weatherHeaderLoaderPulse 2s ease-in-out infinite !important;
}

@keyframes weatherHeaderLoaderSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes weatherHeaderLoaderPulse {
  0%,
  100% {
    opacity: 0.72;
    transform: scale(0.9);
  }

  50% {
    opacity: 1;
    transform: scale(0.98);
  }
}

@keyframes weatherHeaderLoaderComet {
  from {
    transform: rotate(0deg) translateY(calc((var(--weather-loader-size) / -2) + 1px));
  }
  to {
    transform: rotate(360deg) translateY(calc((var(--weather-loader-size) / -2) + 1px));
  }
}

@keyframes weatherHeaderLoaderBreath {
  0%,
  100% {
    opacity: 0.72;
    filter: saturate(0.92) brightness(0.94);
  }
  50% {
    opacity: 1;
    filter: saturate(1.08) brightness(1.08);
  }
}

@media (max-width: 899px) {
  :host([data-weather-variant='header']) {
    --weather-loader-size: 34px;
    --weather-loader-core-size: 5px;
    --weather-loader-inner-gap: 4px;
    --weather-loader-label-offset: 42px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .weather-header-state__spinner,
  .weather-header-state__spinner::before,
  .weather-app__scene-fallback .text-sm::before,
  .weather-app__scene-fallback--header .text-sm::before,
  .weather-app__scene-fallback [class*='text-sm']::before,
  .weather-app__scene-fallback--header [class*='text-sm']::before,
  .weather-app__scene-fallback .text-sm::after,
  .weather-app__scene-fallback--header .text-sm::after,
  .weather-app__scene-fallback [class*='text-sm']::after,
  .weather-app__scene-fallback--header [class*='text-sm']::after {
    animation-duration: 2.2s !important;
  }
}

.weather-header-preview {
  position: relative !important;
  z-index: 1 !important;
  height: 100% !important;
  min-height: 100% !important;
  border-radius: 0 !important;
  overflow: visible !important;
}

.weather-app--header {
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

/* Header scene: rise into the logo row, keep natural aspect (no tall canvas stretch). */
.weather-app--header .weather-app__scene,
.weather-app--header .weather-app__scene--header {
  display: block !important;
  position: absolute !important;
  top: calc(-1 * var(--header-weather-cloud-rise, 0px)) !important;
  left: 50% !important;
  right: auto !important;
  bottom: auto !important;
  width: 114% !important;
  max-width: none !important;
  height: calc(100% + var(--header-weather-cloud-rise, 0px) + var(--header-weather-cloud-extra-h, 24px)) !important;
  min-height: calc(100% + var(--header-weather-cloud-rise, 0px) + var(--header-weather-cloud-extra-h, 24px)) !important;
  max-height: none !important;
  transform: translateX(-50%) !important;
  transform-origin: center top !important;
  overflow: visible !important;
  opacity: 1 !important;
  visibility: visible !important;
  background: transparent !important;
  z-index: 0 !important;
}

/* No edge masks: clouds must never be clipped. */
.weather-app--header .weather-app__scene canvas {
  mask-image: none !important;
  -webkit-mask-image: none !important;
}

.weather-app--header canvas {
  position: absolute !important;
  inset: 0 !important;
  display: block !important;
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
  max-height: none !important;
  transform: none !important;
  transform-origin: center top !important;
  pointer-events: none !important;
  opacity: 1 !important;
  visibility: visible !important;
  background: transparent !important;
  z-index: 0 !important;
}

.weather-orb-overlay {
  position: absolute !important;
  top: var(--orb-top, 0px) !important;
  left: var(--orb-left, 50%) !important;
  pointer-events: none !important;
  z-index: 12 !important;
  overflow: visible !important;
  isolation: isolate !important;
  opacity: 0 !important;
  visibility: hidden !important;
  transform: translateX(-50%) scale(var(--orb-scale-hidden, 0.94)) !important;
  transform-origin: center center !important;
  transition: opacity 1.35s ease-in-out !important;
  mix-blend-mode: normal !important;
}

.weather-orb-overlay.is-moon {
  /* Layer stack: stars (1) → moon (9) → sun (10) → clouds (12) → weather info (20+). */
  z-index: 13 !important;
  isolation: isolate !important;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

/* Preview orb: anchor point is the geometric center (red-cross slot in the preview band). */
.weather-orb-overlay--preview.is-moon,
.weather-orb-overlay--preview.is-sun {
  transform-origin: center center !important;
}

/* Moon layer under clouds: never clip the orb (no overflow/clip on this stack). */
:host([data-weather-variant='header']) .weather-header-preview .weather-orb-stack--preview-back,
.weather-header-preview .weather-orb-stack--preview-back {
  position: absolute !important;
  inset: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 9 !important;
  overflow: visible !important;
  pointer-events: none !important;
  clip-path: none !important;
  -webkit-clip-path: none !important;
  contain: none !important;
}

.weather-orb-overlay--preview.is-moon {
  z-index: 9 !important;
  isolation: isolate !important;
}

:host([data-weather-variant='header']) .weather-header-preview .weather-orb-stack--preview-back .weather-orb-overlay.is-moon,
.weather-header-preview .weather-orb-stack--preview-back .weather-orb-overlay.is-moon {
  overflow: visible !important;
  clip-path: none !important;
  -webkit-clip-path: none !important;
  contain: none !important;
}

:host([data-weather-variant='header']) .weather-header-preview .weather-orb-stack--preview-back .weather-orb-overlay.is-moon.is-visible,
.weather-header-preview .weather-orb-stack--preview-back .weather-orb-overlay.is-moon.is-visible {
  opacity: var(--orb-crossfade-opacity, 1) !important;
  visibility: visible !important;
}

.weather-app--header .weather-header-preview .weather-app__scene,
.weather-app--header .weather-header-preview .weather-app__scene--header {
  z-index: 12 !important;
}

.weather-header-preview .weather-orb-stack--preview-front {
  position: absolute !important;
  inset: 0 !important;
  top: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  z-index: 10 !important;
  overflow: visible !important;
  pointer-events: none !important;
}

/* Keep moon visible in expanded dropdown too. */
.weather-orb-stack--dropdown [data-orb-role='moon'],
.weather-orb-overlay--dropdown.is-moon {
  display: block !important;
  visibility: visible !important;
  pointer-events: none !important;
}

.weather-orb-overlay.is-moon.is-visible {
  transform: translateX(calc(-50% + var(--orb-offset-x, 0px))) translateY(var(--orb-offset-y, 0px))
    scale(var(--orb-scale-visible, 1)) !important;
}

.weather-orb-overlay.is-moon:not(.is-visible) {
  transform: translateX(calc(-50% + var(--orb-offset-x, 0px))) translateY(var(--orb-offset-y, 0px))
    scale(var(--orb-scale-hidden, 0.94)) !important;
}

.weather-orb-overlay.is-sun {
  z-index: 1 !important;
  isolation: auto !important;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

.weather-orb-overlay.is-sun.is-visible {
  transform: translateX(calc(-50% + var(--orb-offset-x, 0px))) translateY(var(--orb-offset-y, 0px))
    scale(var(--orb-scale-visible, 1)) !important;
}

.weather-orb-overlay.is-sun:not(.is-visible) {
  transform: translateX(calc(-50% + var(--orb-offset-x, 0px))) translateY(var(--orb-offset-y, 0px))
    scale(var(--orb-scale-hidden, 0.94)) !important;
}

/* Moon uses pure MP4 source: disable decorative veil layers around orb. */
.weather-orb-overlay.is-moon::before,
.weather-orb-overlay.is-moon::after {
  content: none !important;
  display: none !important;
}

/* Opaque backplate so CSS/3D stars never show through moon alpha on the night disk. */
.weather-orb-overlay--preview.is-moon.is-visible::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  inset: 3% !important;
  border-radius: 50% !important;
  background: radial-gradient(
    circle at 50% 48%,
    rgb(6 11 16 / 0.94) 0%,
    rgb(4 8 12 / 0.9) 58%,
    rgb(4 8 12 / 0.55) 72%,
    transparent 78%
  ) !important;
  z-index: 0 !important;
  pointer-events: none !important;
  transform: none !important;
}

.weather-orb-overlay.is-visible {
  opacity: var(--orb-crossfade-opacity, 1) !important;
  visibility: visible !important;
  transform: translateX(-50%) scale(var(--orb-scale-visible, 1)) !important;
}

.weather-orb-stack {
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  z-index: 12 !important;
  overflow: visible !important;
  max-width: 100% !important;
  max-height: 100% !important;
}

.weather-orb-stack .weather-orb-overlay {
  top: var(--orb-top, 0px) !important;
  left: var(--orb-left, 50%) !important;
}

.weather-orb-overlay--preview {
  width: clamp(82px, 19vw, 118px) !important;
  height: clamp(82px, 19vw, 118px) !important;
}

.weather-orb-overlay--preview.is-moon {
  width: clamp(${82 * HEADER_WEATHER_MOON_SIZE_FACTOR}px, ${19 * HEADER_WEATHER_MOON_SIZE_FACTOR}vw, ${118 * HEADER_WEATHER_MOON_SIZE_FACTOR}px) !important;
  height: clamp(${82 * HEADER_WEATHER_MOON_SIZE_FACTOR}px, ${19 * HEADER_WEATHER_MOON_SIZE_FACTOR}vw, ${118 * HEADER_WEATHER_MOON_SIZE_FACTOR}px) !important;
  left: ${HEADER_WEATHER_MOON_PREVIEW_ANCHOR.left}% !important;
  top: 50% !important;
  right: auto !important;
  bottom: auto !important;
  margin: 0 !important;
  transition: opacity 1.35s ease-in-out !important;
}

.weather-orb-overlay--preview.is-moon.is-visible,
.weather-orb-overlay--preview.is-moon:not(.is-visible) {
  transform: translateX(calc(-50% + ${HEADER_WEATHER_MOON_PREVIEW_ANCHOR.offsetX}px))
    translateY(calc(-50% + ${HEADER_WEATHER_MOON_PREVIEW_ANCHOR.offsetY}px))
    scale(var(--orb-scale-visible, 1)) !important;
}

.weather-orb-overlay--preview.is-moon.is-visible {
  opacity: calc(0.38 + var(--orb-crossfade-opacity, 1) * 0.62) !important;
  filter: drop-shadow(0 0 12px rgb(244 248 255 / 0.18)) drop-shadow(0 0 22px rgb(186 205 255 / 0.16)) !important;
}

.weather-orb-overlay--preview.is-moon:not(.is-visible) {
  transform: translateX(calc(-50% + ${HEADER_WEATHER_MOON_PREVIEW_ANCHOR.offsetX}px))
    translateY(calc(-50% + ${HEADER_WEATHER_MOON_PREVIEW_ANCHOR.offsetY}px))
    scale(var(--orb-scale-hidden, 0.94)) !important;
}

.weather-orb-overlay--preview.is-sun {
  width: clamp(${82 * HEADER_WEATHER_SUN_SIZE_FACTOR}px, ${19 * HEADER_WEATHER_SUN_SIZE_FACTOR}vw, ${118 * HEADER_WEATHER_SUN_SIZE_FACTOR}px) !important;
  height: clamp(${82 * HEADER_WEATHER_SUN_SIZE_FACTOR}px, ${19 * HEADER_WEATHER_SUN_SIZE_FACTOR}vw, ${118 * HEADER_WEATHER_SUN_SIZE_FACTOR}px) !important;
  left: ${HEADER_WEATHER_SUN_PREVIEW_ANCHOR.left}% !important;
  top: 50% !important;
  right: auto !important;
  bottom: auto !important;
  margin: 0 !important;
  transition: opacity 1.35s ease-in-out !important;
}

.weather-orb-overlay--preview.is-sun.is-visible {
  opacity: calc(var(--orb-crossfade-opacity, 1) * 0.28) !important;
}

.weather-orb-overlay--preview.is-sun.is-visible,
.weather-orb-overlay--preview.is-sun:not(.is-visible) {
  transform: translateX(calc(-50% + ${HEADER_WEATHER_SUN_PREVIEW_ANCHOR.offsetX}px))
    translateY(calc(-50% + ${HEADER_WEATHER_SUN_PREVIEW_ANCHOR.offsetY}px))
    scale(var(--orb-scale-visible, 1)) !important;
}

.weather-orb-overlay--preview.is-sun:not(.is-visible) {
  transform: translateX(calc(-50% + ${HEADER_WEATHER_SUN_PREVIEW_ANCHOR.offsetX}px))
    translateY(calc(-50% + ${HEADER_WEATHER_SUN_PREVIEW_ANCHOR.offsetY}px))
    scale(var(--orb-scale-hidden, 0.94)) !important;
}

.weather-orb-overlay--preview.is-sun.has-cloud-veil::before,
.weather-orb-overlay--preview.is-sun.has-cloud-veil::after {
  display: none !important;
  content: none !important;
}

.weather-orb-overlay--dropdown {
  width: clamp(72px, 15vw, 96px) !important;
  height: clamp(72px, 15vw, 96px) !important;
}

.weather-orb-overlay--dropdown.is-moon {
  width: clamp(80px, 16vw, 108px) !important;
  height: clamp(80px, 16vw, 108px) !important;
}

.weather-orb-overlay--dropdown.is-sun {
  width: clamp(68px, 14vw, 92px) !important;
  height: clamp(68px, 14vw, 92px) !important;
}

.weather-orb-overlay__video {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  object-position: center center !important;
  opacity: var(--orb-core-opacity, 1) !important;
  transition: opacity 220ms ease !important;
  image-rendering: auto !important;
}

.weather-orb-overlay__video[hidden] {
  display: none !important;
}

.weather-orb-overlay__canvas {
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  opacity: var(--orb-core-opacity, 1) !important;
  transition: opacity 220ms ease !important;
}

.weather-orb-overlay__image {

  display: block !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
  opacity: var(--orb-core-opacity, 1) !important;
  transition: opacity 220ms ease !important;
}

/* [hidden] must override display:block !important — higher specificity (class+attr) wins */
.weather-orb-overlay__canvas[hidden],
.weather-orb-overlay__image[hidden] {
  display: none !important;
}

.weather-orb-overlay::before,
.weather-orb-overlay::after {
  content: none !important;
  display: none !important;
  pointer-events: none !important;
  opacity: 0 !important;
}

/* Hard-disable decorative cloud veil layers (they produced oval artifacts). */
.weather-orb-overlay.has-cloud-veil::before,
.weather-orb-overlay.has-cloud-veil::after {
  content: none !important;
  display: none !important;
  opacity: 0 !important;
}

/* Re-enable cloud veil only for sun with non-oval layers. */
.weather-orb-overlay.is-sun.has-cloud-veil::before,
.weather-orb-overlay.is-sun.has-cloud-veil::after {
  content: "" !important;
  display: block !important;
  border-radius: 0 !important;
}

.weather-orb-overlay.is-sun.has-cloud-veil::before {
  inset: 18% -10% 36% -10% !important;
  opacity: calc(var(--orb-cloud-alpha, 0) * 0.46) !important;
  background:
    linear-gradient(
      180deg,
      rgba(244, 247, 255, 0.52) 0%,
      rgba(214, 225, 241, 0.26) 36%,
      rgba(156, 173, 199, 0.12) 64%,
      rgba(0, 0, 0, 0) 100%
    ),
    linear-gradient(
      166deg,
      rgba(240, 244, 252, 0.36) 0%,
      rgba(204, 217, 238, 0.16) 42%,
      rgba(0, 0, 0, 0) 82%
    ) !important;
  transform:
    translate3d(calc(var(--orb-cloud-drift, 1) * -2%), calc(var(--orb-cloud-lift, 0px) * 0.5), 0)
    skewX(-8deg) !important;
  animation: headerWeatherSunVeilA 11.8s ease-in-out infinite !important;
}

.weather-orb-overlay.is-sun.has-cloud-veil::after {
  inset: 42% -14% 10% -6% !important;
  opacity: calc(var(--orb-cloud-alpha, 0) * 0.38) !important;
  background:
    linear-gradient(
      180deg,
      rgba(250, 252, 255, 0.36) 0%,
      rgba(214, 225, 241, 0.18) 34%,
      rgba(0, 0, 0, 0) 100%
    ),
    linear-gradient(
      194deg,
      rgba(232, 239, 250, 0.3) 0%,
      rgba(196, 210, 234, 0.14) 46%,
      rgba(0, 0, 0, 0) 86%
    ) !important;
  transform:
    translate3d(calc(var(--orb-cloud-drift, 1) * 2%), calc(var(--orb-cloud-lift, 0px) * 0.2), 0)
    skewX(7deg) !important;
  animation: headerWeatherSunVeilB 14.6s ease-in-out infinite !important;
}

.weather-orb-overlay.has-cloud-veil::before {
  inset: 30% 4% 20% 3%;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(248, 250, 255, var(--orb-cloud-highlight-alpha, 0.2)) 24%,
      rgba(206, 220, 244, var(--orb-cloud-depth-alpha, 0.3)) 54%,
      rgba(121, 139, 180, 0.08) 78%,
      rgba(0, 0, 0, 0) 100%
    ),
    radial-gradient(ellipse at 18% 52%, rgba(241, 246, 255, 0.58) 0%, rgba(203, 216, 242, 0.34) 30%, rgba(118, 136, 176, 0.07) 64%, transparent 74%),
    radial-gradient(ellipse at 52% 48%, rgba(244, 248, 255, 0.62) 0%, rgba(209, 222, 245, 0.32) 32%, rgba(113, 133, 176, 0.08) 66%, transparent 78%),
    radial-gradient(ellipse at 82% 56%, rgba(236, 242, 255, 0.56) 0%, rgba(194, 210, 238, 0.28) 31%, rgba(107, 124, 168, 0.06) 67%, transparent 80%);
  filter: none !important;
  transform:
    translate3d(calc(var(--orb-cloud-drift, 1) * 0%), var(--orb-cloud-lift, 0px), 0)
    scaleX(calc(var(--orb-cloud-stretch-x, 1.16) * 0.82))
    scaleY(calc(var(--orb-cloud-stretch-y, 0.84) * 0.82));
  animation: headerWeatherOrbCloudFloat 10.8s ease-in-out infinite;
}

.weather-orb-overlay.has-cloud-veil::after {
  inset: 37% -6% 18% 8%;
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(250, 252, 255, 0.12) 34%,
      rgba(201, 214, 239, 0.2) 62%,
      rgba(0, 0, 0, 0) 100%
    ),
    radial-gradient(ellipse at 30% 54%, rgba(244, 247, 255, 0.42) 0%, rgba(204, 216, 240, 0.18) 34%, transparent 72%),
    radial-gradient(ellipse at 74% 46%, rgba(238, 244, 255, 0.36) 0%, rgba(186, 203, 236, 0.16) 30%, transparent 70%);
  filter: none !important;
  opacity: calc(var(--orb-cloud-alpha, 0) * 0.34);
  transform:
    translate3d(calc(var(--orb-cloud-drift, 1) * 2%), calc(var(--orb-cloud-lift, 0px) * 0.4), 0)
    scaleX(calc(var(--orb-cloud-stretch-x, 1.16) * 0.78))
    scaleY(calc(var(--orb-cloud-stretch-y, 0.84) * 0.78));
  animation: headerWeatherOrbCloudFloatAlt 14.2s ease-in-out infinite;
}

.weather-orb-overlay.is-sun.has-cloud-veil::before {
  box-shadow: 0 0 18px rgba(255, 219, 142, 0.12);
}

.weather-orb-overlay.is-moon.has-cloud-veil::before,
.weather-orb-overlay.is-moon.has-cloud-veil::after {
  background-blend-mode: screen;
}

/* Preview (compact header) — cloud veil full size, layers spread chaotically */
.weather-orb-overlay--preview.has-cloud-veil::before {
  inset: 5% -14% 42% -10%;
  filter: none !important;
  transform:
    translate3d(calc(var(--orb-cloud-drift, 1) * -4%), calc(var(--orb-cloud-lift, 0px) - 6px), 0)
    scaleX(calc(var(--orb-cloud-stretch-x, 1.16) * 1.16))
    scaleY(calc(var(--orb-cloud-stretch-y, 0.84) * 0.65));
  animation: headerWeatherOrbCloudFloatPreviewA 11.4s ease-in-out infinite;
}
.weather-orb-overlay--preview.has-cloud-veil::after {
  inset: 52% -8% -18% 16%;
  filter: none !important;
  transform:
    translate3d(calc(var(--orb-cloud-drift, 1) * 6%), calc(var(--orb-cloud-lift, 0px) + 8px), 0)
    scaleX(calc(var(--orb-cloud-stretch-x, 1.16) * 1.00))
    scaleY(calc(var(--orb-cloud-stretch-y, 0.84) * 1.03));
  animation: headerWeatherOrbCloudFloatPreviewB 15.6s ease-in-out infinite;
}

.weather-orb-overlay--preview.is-moon .weather-orb-overlay__canvas,
.weather-orb-overlay--preview.is-moon .weather-orb-overlay__image,
.weather-orb-overlay--preview.is-moon .weather-orb-overlay__video {
  position: relative;
  z-index: 1 !important;
  isolation: isolate !important;
  object-position: ${HEADER_WEATHER_MOON_PREVIEW_LAYOUT.objectPosition} !important;
}

.weather-orb-overlay--dropdown.is-moon .weather-orb-overlay__canvas,
.weather-orb-overlay--dropdown.is-moon .weather-orb-overlay__image,
.weather-orb-overlay--dropdown.is-moon .weather-orb-overlay__video {
  position: relative;
  z-index: 1 !important;
  object-position: ${HEADER_WEATHER_MOON_DROPDOWN_LAYOUT.objectPosition} !important;
}

.weather-orb-overlay--preview.is-sun .weather-orb-overlay__canvas,
.weather-orb-overlay--preview.is-sun .weather-orb-overlay__image,
.weather-orb-overlay--preview.is-sun .weather-orb-overlay__video {
  position: relative;
  z-index: 1 !important;
  object-position: ${HEADER_WEATHER_SUN_PREVIEW_LAYOUT.objectPosition} !important;
}

.weather-orb-overlay--dropdown.is-sun .weather-orb-overlay__canvas,
.weather-orb-overlay--dropdown.is-sun .weather-orb-overlay__image,
.weather-orb-overlay--dropdown.is-sun .weather-orb-overlay__video {
  position: relative;
  z-index: 1 !important;
  object-position: ${HEADER_WEATHER_SUN_DROPDOWN_LAYOUT.objectPosition} !important;
}

.weather-orb-overlay--preview.is-moon.has-cloud-veil::before,
.weather-orb-overlay--preview.is-moon.has-cloud-veil::after {
  z-index: 2 !important;
}

@keyframes headerWeatherOrbCloudFloatPreviewA {
  0%,
  100% {
    transform: translate3d(-6%, -4%, 0) scale(1.06);
  }
  38% {
    transform: translate3d(5%, 2%, 0) scale(0.94);
  }
  70% {
    transform: translate3d(-2%, 5%, 0) scale(1.02);
  }
}

@keyframes headerWeatherOrbCloudFloatPreviewB {
  0%,
  100% {
    transform: translate3d(8%, 6%, 0) scale(0.96);
  }
  45% {
    transform: translate3d(-7%, -3%, 0) scale(1.08);
  }
  80% {
    transform: translate3d(3%, -6%, 0) scale(0.98);
  }
}

@keyframes headerWeatherOrbCloudFloat {
  0%,
  100% {
    transform: translate3d(-2%, 0, 0) scale(1);
  }

  50% {
    transform: translate3d(3%, -2%, 0) scale(1.04);
  }
}

@keyframes headerWeatherOrbCloudFloatAlt {
  0%,
  100% {
    transform: translate3d(3%, 0, 0) scale(1.02);
  }

  50% {
    transform: translate3d(-5%, 2%, 0) scale(0.97);
  }
}

@keyframes headerWeatherSunVeilA {
  0%,
  100% {
    transform: translate3d(-3%, -2%, 0) skewX(-8deg);
  }
  50% {
    transform: translate3d(4%, 2%, 0) skewX(-5deg);
  }
}

@keyframes headerWeatherSunVeilB {
  0%,
  100% {
    transform: translate3d(3%, 2%, 0) skewX(7deg);
  }
  50% {
    transform: translate3d(-4%, -1%, 0) skewX(4deg);
  }
}

.weather-orb-overlay.is-sun .weather-orb-overlay__canvas,
.weather-orb-overlay.is-sun .weather-orb-overlay__image {
  filter: none !important;
}

.weather-orb-overlay.is-sun .weather-orb-overlay__video,
.weather-orb-overlay.is-sun .weather-orb-overlay__canvas,
.weather-orb-overlay.is-sun .weather-orb-overlay__image {
  position: relative !important;
  z-index: 1 !important;
}

.weather-orb-overlay.is-sun.has-cloud-veil::before,
.weather-orb-overlay.is-sun.has-cloud-veil::after {
  z-index: 2 !important;
}

.weather-orb-overlay.is-moon .weather-orb-overlay__canvas,
.weather-orb-overlay.is-moon .weather-orb-overlay__image {
  clip-path: none !important;
}

/* Sun/Moon — VP9 WebM with native alpha (no black plate). */
.weather-orb-overlay.is-sun.is-native-alpha .weather-orb-overlay__video,
.weather-orb-overlay.is-moon.is-native-alpha .weather-orb-overlay__video {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  background: transparent !important;
  mix-blend-mode: normal !important;
  image-rendering: auto !important;
}

.weather-orb-overlay.is-sun.is-native-alpha .weather-orb-overlay__video {
  position: absolute !important;
  inset: 0 !important;
  width: calc(100% * ${HEADER_WEATHER_SUN_MEDIA_SCALE}) !important;
  height: calc(100% * ${HEADER_WEATHER_SUN_MEDIA_SCALE}) !important;
  margin: auto !important;
  object-fit: contain !important;
  filter:
    brightness(${HEADER_WEATHER_SUN_BRIGHTNESS})
    saturate(1.1)
    contrast(1.04)
    drop-shadow(0 0 10px rgba(255, 196, 110, 0.72))
    drop-shadow(0 0 26px rgba(255, 150, 55, 0.38))
    drop-shadow(0 0 48px rgba(255, 110, 30, 0.18)) !important;
}

.weather-orb-overlay.is-sun.is-native-alpha:not(.has-cloud-veil)::before {
  content: "" !important;
  display: block !important;
  position: absolute !important;
  inset: -14% !important;
  border-radius: 50% !important;
  z-index: 0 !important;
  pointer-events: none !important;
  opacity: 0.88 !important;
  background: none !important;
  box-shadow:
    0 0 22px 10px rgba(255, 210, 130, 0.5),
    0 0 48px 22px rgba(255, 165, 70, 0.28),
    0 0 88px 38px rgba(255, 120, 40, 0.12) !important;
  animation: none !important;
  transform: none !important;
}

.weather-orb-overlay.is-moon.is-native-alpha .weather-orb-overlay__video {
  filter:
    brightness(1.1)
    saturate(1.18)
    hue-rotate(12deg)
    contrast(1.05)
    drop-shadow(0 0 12px rgba(148, 194, 255, 0.26))
    drop-shadow(0 0 24px rgba(98, 156, 244, 0.16)) !important;
}

.weather-orb-overlay.is-sun.is-native-alpha .weather-orb-overlay__canvas,
.weather-orb-overlay.is-sun.is-native-alpha .weather-orb-overlay__image,
.weather-orb-overlay.is-moon.is-native-alpha .weather-orb-overlay__canvas,
.weather-orb-overlay.is-moon.is-native-alpha .weather-orb-overlay__image {
  display: none !important;
}

/* NASA Eyes–style WebGL sun (Earth viewpoint, annual orbit). */
.weather-orb-overlay.is-sun.is-nasa-eyes .weather-orb-overlay__video,
.weather-orb-overlay.is-sun.is-nasa-eyes .weather-orb-overlay__image {
  display: none !important;
  visibility: hidden !important;
}

.weather-orb-overlay.is-sun.is-nasa-eyes .weather-orb-overlay__canvas {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  width: calc(100% * ${HEADER_WEATHER_SUN_MEDIA_SCALE}) !important;
  height: calc(100% * ${HEADER_WEATHER_SUN_MEDIA_SCALE}) !important;
  margin: auto !important;
  background: transparent !important;
  filter:
    brightness(${HEADER_WEATHER_SUN_BRIGHTNESS})
    saturate(1.12)
    contrast(1.05)
    drop-shadow(0 0 12px rgba(255, 200, 120, 0.65))
    drop-shadow(0 0 28px rgba(255, 150, 55, 0.32)) !important;
}

.weather-orb-overlay.is-sun.is-nasa-eyes.has-cloud-veil::before,
.weather-orb-overlay.is-sun.is-nasa-eyes.has-cloud-veil::after {
  opacity: 0.42 !important;
}

/* Sun/Moon — MP4 fallback: off-screen decode + canvas chroma-key (Safari / no WebM). */
.weather-orb-overlay.is-sun:not(.is-native-alpha) .weather-orb-overlay__video,
.weather-orb-overlay.is-moon:not(.is-native-alpha) .weather-orb-overlay__video {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}

.weather-orb-overlay.is-sun:not(.is-native-alpha) .weather-orb-overlay__canvas,
.weather-orb-overlay.is-moon:not(.is-native-alpha) .weather-orb-overlay__canvas {
  opacity: 1 !important;
  visibility: visible !important;
  background: transparent !important;
  filter: none !important;
  mix-blend-mode: normal !important;
  image-rendering: auto !important;
}

.weather-orb-overlay.is-moon:not(.is-native-alpha) .weather-orb-overlay__canvas,
.weather-orb-overlay.is-moon:not(.is-native-alpha) .weather-orb-overlay__image {
  filter:
    brightness(1.08)
    saturate(1.14)
    hue-rotate(12deg)
    contrast(1.04) !important;
}

.weather-orb-overlay.is-sun:not(.is-native-alpha) .weather-orb-overlay__image,
.weather-orb-overlay.is-moon:not(.is-native-alpha) .weather-orb-overlay__image {
  display: none !important;
  filter: none !important;
}

/* Stars: brighter and crisper — override the aggressive filter:none reset
   by matching its :not() chain to gain equal specificity, then win by
   source order (this rule appears later in the same style block). */
:host([data-weather-variant='header']) .weather-header-preview__stars-back .weather-app__stars-scene--header-panel canvas {
  z-index: 0 !important;
  filter: brightness(1.28) contrast(1.08) saturate(1.04) !important;
}

:host([data-weather-variant='header']) .weather-header-preview .weather-app__scene--header canvas,
:host([data-weather-variant='header']) .weather-header-dropdown__scene canvas:not(.weather-orb-overlay__canvas) {
  filter: none !important;
}

.weather-header-preview {
  isolation: isolate !important;
  overflow: visible !important;
  contain: none !important;
}
  row-gap: 0 !important;
:host([data-weather-variant='header']),
:host([data-weather-variant='header']) [data-weather-widget-root],
:host([data-weather-variant='header']) .weather-header-preview {
  contain: none !important;
  padding-bottom: 0 !important;

:host([data-weather-variant='header']) .weather-header-preview__stars-back.is-night-sky::before,
:host([data-weather-variant='header']) .weather-header-preview__stars-back.is-night-sky::after,
.weather-header-preview__stars-back.is-night-sky::before,
  min-height: auto !important;
  margin-bottom: 0 !important;
  display: block !important;
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  z-index: 0 !important;
  opacity: var(--preview-stars-opacity, 0.82) !important;
  margin-top: var(--weather-meta-equal-gap) !important;
  margin-bottom: var(--weather-meta-equal-gap) !important;
  background-color: transparent !important;
.weather-header-card__info-panel,
.weather-header-card__left-stack {
  row-gap: 0 !important;
}
  border: none !important;
  box-shadow: none !important;
  filter: none !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
}

:host([data-weather-variant='header']) .weather-header-preview__stars-back.is-night-sky::before,
.weather-header-preview__stars-back.is-night-sky::before {
  background-image:
    ${HEADER_WEATHER_STARFIELD_TILE_A},
    ${HEADER_WEATHER_STARFIELD_TILE_B},
    radial-gradient(circle at 4% 3%, rgba(255, 255, 255, 0.9) 0 0.62px, transparent 1px),
    radial-gradient(circle at 96% 4%, rgba(255, 255, 255, 0.88) 0 0.6px, transparent 0.98px),
    radial-gradient(circle at 6% 97%, rgba(255, 255, 255, 0.86) 0 0.6px, transparent 0.98px),
    radial-gradient(circle at 94% 95%, rgba(236, 244, 255, 0.82) 0 0.58px, transparent 0.96px),
    radial-gradient(circle at 8% 12%, rgba(255, 255, 255, 0.92) 0 0.65px, transparent 1.05px),
    radial-gradient(circle at 16% 26%, rgba(228, 238, 255, 0.8) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 24% 8%, rgba(255, 255, 255, 0.88) 0 0.65px, transparent 1.02px),
    radial-gradient(circle at 32% 19%, rgba(201, 224, 255, 0.72) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 40% 6%, rgba(255, 255, 255, 0.9) 0 0.65px, transparent 1.02px),
    radial-gradient(circle at 49% 22%, rgba(235, 244, 255, 0.78) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 57% 11%, rgba(255, 255, 255, 0.92) 0 0.68px, transparent 1.06px),
    radial-gradient(circle at 66% 28%, rgba(236, 242, 252, 0.74) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 74% 9%, rgba(255, 255, 255, 0.9) 0 0.65px, transparent 1.02px),
    radial-gradient(circle at 83% 21%, rgba(240, 245, 253, 0.76) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 91% 7%, rgba(255, 255, 255, 0.9) 0 0.65px, transparent 1.02px),
    radial-gradient(circle at 12% 43%, rgba(255, 255, 255, 0.86) 0 0.62px, transparent 1px),
    radial-gradient(circle at 21% 56%, rgba(210, 228, 255, 0.72) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 30% 41%, rgba(255, 255, 255, 0.88) 0 0.62px, transparent 1px),
    radial-gradient(circle at 38% 63%, rgba(235, 244, 255, 0.78) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 47% 48%, rgba(255, 255, 255, 0.86) 0 0.62px, transparent 1px),
    radial-gradient(circle at 55% 64%, rgba(208, 227, 255, 0.7) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 63% 46%, rgba(255, 255, 255, 0.86) 0 0.62px, transparent 1px),
    radial-gradient(circle at 72% 58%, rgba(229, 239, 255, 0.76) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 80% 44%, rgba(255, 255, 255, 0.9) 0 0.62px, transparent 1px),
    radial-gradient(circle at 89% 60%, rgba(238, 244, 252, 0.7) 0 0.56px, transparent 0.94px) !important;
  animation: weatherHeaderStarsTwinkle 6.6s ease-in-out infinite;
}

:host([data-weather-variant='header']) .weather-header-preview__stars-back.is-night-sky::after,
.weather-header-preview__stars-back.is-night-sky::after {
  opacity: calc(var(--preview-stars-opacity, 0.82) * 0.72) !important;
  filter: none !important;
  background-image:
    ${HEADER_WEATHER_STARFIELD_TILE_B},
    radial-gradient(circle at 18px 14px, rgba(255, 255, 255, 0.46) 0 0.44px, transparent 0.78px) 0 0 / 38px 38px,
    radial-gradient(circle at 14% 18%, rgba(255, 255, 255, 0.96) 0 1.05px, transparent 1.55px),
    radial-gradient(circle at 36% 14%, rgba(229, 241, 255, 0.86) 0 0.88px, transparent 1.32px),
    radial-gradient(circle at 58% 18%, rgba(255, 255, 255, 0.94) 0 1.02px, transparent 1.5px),
    radial-gradient(circle at 78% 16%, rgba(246, 249, 254, 0.82) 0 0.88px, transparent 1.32px),
    radial-gradient(circle at 26% 52%, rgba(255, 255, 255, 0.92) 0 0.95px, transparent 1.42px),
    radial-gradient(circle at 50% 56%, rgba(232, 243, 255, 0.86) 0 0.88px, transparent 1.32px),
    radial-gradient(circle at 74% 50%, rgba(255, 255, 255, 0.92) 0 0.95px, transparent 1.42px),
    radial-gradient(circle at 40% 80%, rgba(226, 238, 255, 0.8) 0 0.82px, transparent 1.24px),
    radial-gradient(circle at 66% 76%, rgba(248, 250, 254, 0.86) 0 0.88px, transparent 1.3px) !important;
  animation: weatherHeaderStarsTwinkleAlt 8.1s ease-in-out infinite;
}

/* Menu hero: balanced grid, natural cloud band, compact celestial accent. */
/* Full-menu night stars (hero + forecast + details), same rules as preview strip. */
:host([data-weather-variant='header']) .weather-header-dropdown__stars-back:not(.is-night-sky)::before,
:host([data-weather-variant='header']) .weather-header-dropdown__stars-back:not(.is-night-sky)::after {
  content: none !important;
  display: none !important;
  background: none !important;
  box-shadow: none !important;
}

.weather-header-dropdown__stars-back {
  position: absolute !important;
  inset: 0 !important;
  z-index: 0 !important;
  pointer-events: none !important;
  overflow: visible !important;
  isolation: isolate !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__stars-back.is-night-sky::before,
:host([data-weather-variant='header']) .weather-header-dropdown__stars-back.is-night-sky::after,
.weather-header-dropdown__stars-back.is-night-sky::before,
.weather-header-dropdown__stars-back.is-night-sky::after {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  inset: 0 !important;
  pointer-events: none !important;
  z-index: 0 !important;
  opacity: var(--dropdown-stars-opacity, 0.82) !important;
  mix-blend-mode: normal !important;
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  filter: none !important;
  mask-image: none !important;
  -webkit-mask-image: none !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__stars-back.is-night-sky::before,
.weather-header-dropdown__stars-back.is-night-sky::before {
  background-image:
    ${HEADER_WEATHER_STARFIELD_TILE_A},
    ${HEADER_WEATHER_STARFIELD_TILE_B},
    radial-gradient(circle at 5% 2%, rgba(255, 255, 255, 0.9) 0 0.62px, transparent 1px),
    radial-gradient(circle at 95% 3%, rgba(255, 255, 255, 0.88) 0 0.6px, transparent 0.98px),
    radial-gradient(circle at 4% 98%, rgba(255, 255, 255, 0.86) 0 0.6px, transparent 0.98px),
    radial-gradient(circle at 96% 96%, rgba(236, 244, 255, 0.84) 0 0.58px, transparent 0.96px),
    radial-gradient(circle at 8% 12%, rgba(255, 255, 255, 0.92) 0 0.65px, transparent 1.05px),
    radial-gradient(circle at 16% 26%, rgba(228, 238, 255, 0.8) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 24% 8%, rgba(255, 255, 255, 0.88) 0 0.65px, transparent 1.02px),
    radial-gradient(circle at 32% 19%, rgba(201, 224, 255, 0.72) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 40% 6%, rgba(255, 255, 255, 0.9) 0 0.65px, transparent 1.02px),
    radial-gradient(circle at 49% 22%, rgba(235, 244, 255, 0.78) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 57% 11%, rgba(255, 255, 255, 0.92) 0 0.68px, transparent 1.06px),
    radial-gradient(circle at 66% 28%, rgba(236, 242, 252, 0.74) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 74% 9%, rgba(255, 255, 255, 0.9) 0 0.65px, transparent 1.02px),
    radial-gradient(circle at 83% 21%, rgba(240, 245, 253, 0.76) 0 0.58px, transparent 0.98px),
    radial-gradient(circle at 91% 7%, rgba(255, 255, 255, 0.9) 0 0.65px, transparent 1.02px),
    radial-gradient(circle at 12% 43%, rgba(255, 255, 255, 0.86) 0 0.62px, transparent 1px),
    radial-gradient(circle at 21% 56%, rgba(210, 228, 255, 0.72) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 30% 41%, rgba(255, 255, 255, 0.88) 0 0.62px, transparent 1px),
    radial-gradient(circle at 38% 63%, rgba(235, 244, 255, 0.78) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 47% 48%, rgba(255, 255, 255, 0.86) 0 0.62px, transparent 1px),
    radial-gradient(circle at 55% 64%, rgba(208, 227, 255, 0.7) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 63% 46%, rgba(255, 255, 255, 0.86) 0 0.62px, transparent 1px),
    radial-gradient(circle at 72% 58%, rgba(229, 239, 255, 0.76) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 80% 44%, rgba(255, 255, 255, 0.9) 0 0.62px, transparent 1px),
    radial-gradient(circle at 89% 60%, rgba(238, 244, 252, 0.7) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 6% 72%, rgba(255, 255, 255, 0.84) 0 0.6px, transparent 0.98px),
    radial-gradient(circle at 18% 84%, rgba(224, 238, 255, 0.74) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 28% 76%, rgba(255, 255, 255, 0.86) 0 0.6px, transparent 0.98px),
    radial-gradient(circle at 42% 88%, rgba(232, 242, 255, 0.72) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 54% 74%, rgba(255, 255, 255, 0.84) 0 0.6px, transparent 0.98px),
    radial-gradient(circle at 68% 86%, rgba(214, 230, 252, 0.7) 0 0.56px, transparent 0.94px),
    radial-gradient(circle at 82% 78%, rgba(255, 255, 255, 0.86) 0 0.6px, transparent 0.98px),
    radial-gradient(circle at 94% 92%, rgba(240, 245, 253, 0.74) 0 0.56px, transparent 0.94px) !important;
  animation: weatherDropdownStarsTwinkle 6.6s ease-in-out infinite;
}

:host([data-weather-variant='header']) .weather-header-dropdown__stars-back.is-night-sky::after,
.weather-header-dropdown__stars-back.is-night-sky::after {
  opacity: calc(var(--dropdown-stars-opacity, 0.82) * 0.5) !important;
  background-image:
    ${HEADER_WEATHER_STARFIELD_TILE_B},
    radial-gradient(circle at 20px 16px, rgba(255, 255, 255, 0.44) 0 0.44px, transparent 0.78px) 0 0 / 36px 36px,
    radial-gradient(circle at 14% 18%, rgba(255, 255, 255, 0.96) 0 1.05px, transparent 1.55px),
    radial-gradient(circle at 36% 14%, rgba(229, 241, 255, 0.86) 0 0.88px, transparent 1.32px),
    radial-gradient(circle at 58% 18%, rgba(255, 255, 255, 0.94) 0 1.02px, transparent 1.5px),
    radial-gradient(circle at 78% 16%, rgba(246, 249, 254, 0.82) 0 0.88px, transparent 1.32px),
    radial-gradient(circle at 26% 52%, rgba(255, 255, 255, 0.92) 0 0.95px, transparent 1.42px),
    radial-gradient(circle at 50% 56%, rgba(232, 243, 255, 0.86) 0 0.88px, transparent 1.32px),
    radial-gradient(circle at 74% 50%, rgba(255, 255, 255, 0.92) 0 0.95px, transparent 1.42px),
    radial-gradient(circle at 40% 80%, rgba(226, 238, 255, 0.8) 0 0.82px, transparent 1.24px),
    radial-gradient(circle at 66% 76%, rgba(248, 250, 254, 0.86) 0 0.88px, transparent 1.3px),
    radial-gradient(circle at 12% 68%, rgba(255, 255, 255, 0.9) 0 0.92px, transparent 1.38px),
    radial-gradient(circle at 88% 72%, rgba(228, 239, 255, 0.82) 0 0.86px, transparent 1.28px),
    radial-gradient(circle at 22% 94%, rgba(255, 255, 255, 0.88) 0 0.9px, transparent 1.34px),
    radial-gradient(circle at 48% 96%, rgba(236, 244, 255, 0.8) 0 0.84px, transparent 1.26px),
    radial-gradient(circle at 72% 92%, rgba(255, 255, 255, 0.9) 0 0.9px, transparent 1.34px) !important;
  animation: weatherDropdownStarsTwinkleAlt 8.1s ease-in-out infinite;
}

.weather-header-dropdown__hero,
.weather-header-dropdown__body,
.weather-header-dropdown__forecast-list,
.weather-header-dropdown__detail-card,
.weather-header-dropdown__forecast-pill,
.weather-header-dropdown .weather-location-selector {
  position: relative !important;
  z-index: 1 !important;
}

.weather-header-dropdown__hero,
.weather-header-dropdown__body,
.weather-header-dropdown__forecast-list,
.weather-header-dropdown__detail-card,
.weather-header-dropdown__forecast-pill {
  background-color: rgb(5 10 9) !important;
  background-image: none !important;
}

.weather-header-dropdown__hero {
  overflow: hidden !important;
  display: grid !important;
  grid-template-rows: auto auto !important;
  align-content: start !important;
  row-gap: 0 !important;
  min-height: clamp(154px, 23vw, 184px) !important;
}

.weather-header-dropdown__hero::after {
  background:
    linear-gradient(180deg, rgb(5 10 9 / 6%) 0%, rgb(5 10 9 / 0%) 24%, rgb(5 10 9 / 58%) 100%),
    linear-gradient(90deg, rgb(5 10 9 / 34%) 0%, rgb(5 10 9 / 5%) 44%, rgb(5 10 9 / 26%) 100%) !important;
}

/* WebGL sky in dropdown hero banded into visible ovals on dark UI — keep flat backdrop + CSS stars. */
.weather-header-dropdown__hero .weather-header-dropdown__scene canvas:not(.weather-orb-overlay__canvas) {
  opacity: 0.38 !important;
  visibility: visible !important;
  filter: saturate(0.92) brightness(0.78) contrast(1.02) !important;
}

.weather-header-dropdown__hero .weather-header-dropdown__scene {
  position: absolute !important;
  inset: auto !important;
  left: 50% !important;
  top: -8% !important;
  width: 116% !important;
  height: 112% !important;
  transform: translateX(-50%) !important;
  transform-origin: center top !important;
  z-index: 0 !important;
  isolation: isolate !important;
  overflow: visible !important;
  pointer-events: none !important;
}

.weather-header-dropdown__hero .weather-header-dropdown__scene canvas {
  display: block !important;
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  max-height: none !important;
  opacity: 1 !important;
  visibility: visible !important;
  pointer-events: none !important;
}

.weather-header-dropdown__hero .weather-orb-stack {
  z-index: 2 !important;
  pointer-events: none !important;
}

.weather-header-dropdown__scene.is-night-sky::before,
.weather-header-dropdown__scene.is-night-sky::after {
  content: none !important;
  display: none !important;
  background: none !important;
}

@keyframes weatherDropdownStarsTwinkle {
  0%,
  100% {
    opacity: calc(var(--dropdown-stars-opacity, 0.82) * 0.88);
    transform: translateY(0);
  }

  50% {
    opacity: var(--dropdown-stars-opacity, 0.82);
    transform: translateY(-0.5px);
  }
}

@keyframes weatherDropdownStarsTwinkleAlt {
  0%,
  100% {
    opacity: calc(var(--dropdown-stars-opacity, 0.82) * 0.56);
  }

  50% {
    opacity: calc(var(--dropdown-stars-opacity, 0.82) * 0.74);
  }
}

@keyframes weatherHeaderStarsTwinkle {
  0%,
  100% {
    opacity: calc(var(--preview-stars-opacity, 0.82) * 0.88);
    transform: translateY(0);
  }

  50% {
    opacity: var(--preview-stars-opacity, 0.82);
    transform: translateY(-0.5px);
  }
}

@keyframes weatherHeaderStarsTwinkleAlt {
  0%,
  100% {
    opacity: calc(var(--preview-stars-opacity, 0.82) * 0.56);
  }

  50% {
    opacity: calc(var(--preview-stars-opacity, 0.82) * 0.74);
  }
}

.weather-orb-overlay__canvas,
.weather-orb-overlay__video,
.weather-orb-overlay__image {
  filter: none !important;
}

.weather-header-trigger {
  z-index: 30 !important;
  cursor: default !important;
  pointer-events: auto !important;
}

.weather-header-card {
  position: absolute !important;
  inset: 0 !important;
  z-index: 20 !important;
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  pointer-events: none !important;
}

.weather-header-card,
.weather-header-card__content,
.weather-header-trigger {
  opacity: 1 !important;
  visibility: visible !important;
}

.weather-header-card__content {
  position: relative !important;
  display: block !important;
  width: 100% !important;
  min-height: 100% !important;
  height: 100% !important;
  z-index: 22 !important;
  overflow: visible !important;
  background: transparent !important;
  pointer-events: none !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.56) !important;
  box-sizing: border-box !important;
  padding: 6px 18px 0 var(--header-weather-text-inset, 0px) !important;
}

.weather-header-card__title-block,
.weather-header-card__eyebrow,
.weather-header-card__location-row,
.weather-header-card__location,
.weather-header-card__meta,
.weather-location-selector,
.weather-location-selector__current {
  margin-left: 0 !important;
  padding-left: 0 !important;
  text-align: left !important;
  justify-content: flex-start !important;
  align-items: flex-start !important;
}

.weather-header-card__title-block {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  width: max-content !important;
  max-width: 100% !important;
}

.weather-header-card__info-panel,
.weather-header-card__left-stack {
  --weather-info-column-shift-x: 0px;
  --weather-info-column-shift-y: 0px;
  --weather-info-column-width: max-content;
  --weather-info-location-meta-gap: 2px;
  --weather-info-title-temp-gap: var(--weather-info-location-meta-gap, 2px);
  --weather-info-temp-feels-gap: 8px;
  --weather-info-feels-line-gap: 2px;
  --weather-feels-stack-max-height: calc(var(--header-weather-temp-value-size, 22px) * 0.9);
  display: grid !important;
  grid-template-columns: var(--weather-info-column-width, max-content) !important;
  grid-auto-rows: max-content !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  justify-items: flex-start !important;
  align-content: flex-start !important;
  width: var(--weather-info-column-width, max-content) !important;
  max-width: calc(100% - 118px) !important;
  margin: 0 !important;
  padding: 0 0 10px 0 !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
  row-gap: var(--weather-info-title-temp-gap, 2px) !important;
  position: relative !important;
  left: 0 !important;
  transform: translate3d(var(--weather-info-column-shift-x, 0px), var(--weather-info-column-shift-y, 0px), 0)
    !important;
  pointer-events: none !important;
}

.weather-header-card__info-panel > .weather-header-card__title-block,
.weather-header-card__left-stack > .weather-header-card__title-block,
.weather-header-card__info-panel > .weather-header-card__temp-row,
.weather-header-card__left-stack > .weather-header-card__temp-row {
  margin-left: 0 !important;
  padding-left: 0 !important;
  left: 0 !important;
  right: auto !important;
  transform: none !important;
  align-self: flex-start !important;
}

.weather-header-card__temp-row {
  display: grid !important;
  grid-template-columns: max-content max-content !important;
  grid-template-rows: auto !important;
  align-items: center !important;
  justify-content: start !important;
  column-gap: var(--weather-info-temp-feels-gap, 8px) !important;
  row-gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: max-content !important;
  max-width: none !important;
  position: relative !important;
  pointer-events: none !important;
  border: none !important;
  background: transparent !important;
}

.weather-header-card__info-panel > .weather-header-card__bottom,
.weather-header-card__left-stack > .weather-header-card__bottom {
  display: none !important;
}

.weather-header-card__temp-row > .weather-header-card__chips:empty {
  display: none !important;
}

.weather-header-card__metrics-panel,
.weather-header-card__right-column {
  --weather-metrics-gap: 0px;
  position: absolute !important;
  right: 8px !important;
  top: 4px !important;
  bottom: 10px !important;
  left: auto !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  align-items: flex-end !important;
  width: max-content !important;
  min-width: 62px !important;
  max-width: none !important;
  min-height: calc(100% - 14px) !important;
  text-align: right !important;
  z-index: 124 !important;
  pointer-events: none !important;
  row-gap: var(--weather-metrics-gap, 0px) !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  margin: 0 !important;
  transform: none !important;
}

/* Adaptive readability: no rectangular tiles — only typography opacity + shadow on bright clouds. */
:host([data-weather-variant='header']) .weather-header-card__content::before,
:host([data-weather-variant='header']) .weather-header-card__right-column::before {
  display: none !important;
  content: none !important;
  opacity: 0 !important;
  background: none !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}

:host([data-weather-variant='header']) .weather-header-card__chip {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
}

:host([data-weather-variant='header']) .weather-header-card__title-block,
:host([data-weather-variant='header']) .weather-header-card__bottom,
:host([data-weather-variant='header']) .weather-header-card__right-column,
:host([data-weather-variant='header']) .weather-header-card__metrics-block,
:host([data-weather-variant='header']) .weather-header-card__metrics-block > .weather-header-card__condition,
:host([data-weather-variant='header']) .weather-header-card__metrics-block > .weather-header-card__chip,
:host([data-weather-variant='header']) .weather-header-card__condition,
:host([data-weather-variant='header']) .weather-header-card__chip,
:host([data-weather-variant='header']) .weather-header-card__chip span,
:host([data-weather-variant='header']) .weather-header-card__chip strong,
:host([data-weather-variant='header']) .weather-header-card__temperature,
:host([data-weather-variant='header']) .weather-header-card__temperature-value,
:host([data-weather-variant='header']) .weather-header-card__temperature-unit,
:host([data-weather-variant='header']) .weather-header-card__location,
:host([data-weather-variant='header']) .weather-header-card__meta,
:host([data-weather-variant='header']) .weather-header-card__toggle,
:host([data-weather-variant='header']) .weather-location-selector__current,
:host([data-weather-variant='header']) .weather-location-selector__city {
  --weather-text-shadow-core: 0 1px 2px rgb(0 0 0 / calc(0.34 + var(--weather-readability-glow, 0) * 0.52));
  --weather-text-shadow-halo: 0 0 calc(6px + var(--weather-readability-glow, 0) * 16px)
    rgb(6 16 22 / calc(0.16 + var(--weather-readability-glow, 0) * 0.5));
  color: rgb(255 246 228 / var(--weather-text-alpha, 0.94)) !important;
  text-shadow: var(--weather-text-shadow-core), var(--weather-text-shadow-halo) !important;
  transition:
    color 360ms ease,
    text-shadow 360ms ease,
    opacity 360ms ease !important;
}

:host([data-weather-variant='header']) .weather-header-card__eyebrow {
  color: rgb(255 231 184 / var(--weather-eyebrow-alpha, 0.78)) !important;
}

:host([data-weather-text-readability='medium']) .weather-header-card__title-block,
:host([data-weather-text-readability='medium']) .weather-header-card__bottom,
:host([data-weather-text-readability='medium']) .weather-header-card__right-column,
:host([data-weather-text-readability='medium']) .weather-header-card__metrics-block,
:host([data-weather-text-readability='medium']) .weather-header-card__metrics-block > .weather-header-card__condition,
:host([data-weather-text-readability='medium']) .weather-header-card__metrics-block > .weather-header-card__chip,
:host([data-weather-text-readability='medium']) .weather-header-card__chip,
:host([data-weather-text-readability='medium']) .weather-header-card__temperature,
:host([data-weather-text-readability='medium']) .weather-header-card__location,
:host([data-weather-text-readability='medium']) .weather-header-card__meta,
:host([data-weather-text-readability='medium']) .weather-header-card__condition,
:host([data-weather-text-readability='medium']) .weather-header-card__toggle,
:host([data-weather-text-readability='high']) .weather-header-card__title-block,
:host([data-weather-text-readability='high']) .weather-header-card__bottom,
:host([data-weather-text-readability='high']) .weather-header-card__right-column,
:host([data-weather-text-readability='high']) .weather-header-card__metrics-block,
:host([data-weather-text-readability='high']) .weather-header-card__metrics-block > .weather-header-card__condition,
:host([data-weather-text-readability='high']) .weather-header-card__metrics-block > .weather-header-card__chip,
:host([data-weather-text-readability='high']) .weather-header-card__chip,
:host([data-weather-text-readability='high']) .weather-header-card__chip span,
:host([data-weather-text-readability='high']) .weather-header-card__chip strong,
:host([data-weather-text-readability='high']) .weather-header-card__temperature,
:host([data-weather-text-readability='high']) .weather-header-card__temperature-value,
:host([data-weather-text-readability='high']) .weather-header-card__temperature-unit,
:host([data-weather-text-readability='high']) .weather-header-card__location,
:host([data-weather-text-readability='high']) .weather-header-card__meta,
:host([data-weather-text-readability='high']) .weather-header-card__condition,
:host([data-weather-text-readability='high']) .weather-header-card__toggle,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-bottom,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-top,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-temp,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-temp span,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-temp small,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-copy strong,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-copy > span,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-title strong,
:host([data-weather-text-readability='high']) .weather-header-dropdown__hero-meta,
:host([data-weather-text-readability='high']) .weather-header-dropdown__eyebrow {
  text-shadow:
    0 1px 2px rgb(0 0 0 / calc(0.52 + var(--weather-readability-glow, 0) * 0.28)),
    0 0 calc(10px + var(--weather-readability-glow, 0) * 12px) rgb(6 16 22 / calc(0.28 + var(--weather-readability-glow, 0) * 0.42)) !important;
}

@media (prefers-reduced-motion: reduce) {
  :host([data-weather-variant='header']) .weather-header-card__title-block,
  :host([data-weather-variant='header']) .weather-header-card__bottom,
  :host([data-weather-variant='header']) .weather-header-card__chip,
  :host([data-weather-variant='header']) .weather-header-card__temperature,
  :host([data-weather-variant='header']) .weather-header-card__location,
  :host([data-weather-variant='header']) .weather-header-card__meta {
    transition-duration: 0.01ms !important;
  }
}

.weather-header-card__location,
.weather-header-card__location-row,
.weather-header-card__eyebrow,
.weather-header-card__meta,
.weather-header-card__side,
.weather-header-card__toggle {
  position: relative !important;
  z-index: 24 !important;
  pointer-events: auto !important;
}

.weather-header-card__toggle {
  pointer-events: auto !important;
  cursor: pointer !important;
  display: inline-flex !important;
  align-items: flex-end !important;
  justify-content: center !important;
  gap: 0 !important;
  min-height: auto !important;
  width: max-content !important;
  max-width: max-content !important;
  padding: 1px !important;
  color: rgba(255, 238, 207, 0.96) !important;
  font-size: 7px !important;
  line-height: 1 !important;
  white-space: nowrap !important;
  letter-spacing: 0.14em !important;
  text-transform: uppercase !important;
  border-radius: 999px !important;
  border: 1px solid rgba(255, 232, 176, 0.22) !important;
  background: linear-gradient(180deg, rgba(255, 235, 193, 0.12), rgba(5, 12, 10, 0.58)) !important;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  overflow: visible !important;
}

.weather-header-card__toggle span {
  pointer-events: none !important;
}

.weather-header-card__toggle span:first-child {
  display: inline-block !important;
  line-height: 1 !important;
}

.weather-header-card__toggle-icon {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 5.082px !important;
  height: 5.082px !important;
  position: absolute !important;
  right: -7.082px !important;
  top: auto !important;
  bottom: -1px !important;
  margin-top: 0 !important;
  opacity: 0.9 !important;
  visibility: visible !important;
  font-size: 0 !important;
  line-height: 0 !important;
  background: url('/assets/images/icon-pak/Gotovie%20iconki%20dlya%20saita/unter.png') center/contain no-repeat !important;
  --arrow-rotate: ${HEADER_WEATHER_TOGGLE_ARROW_CLOSED};
  --arrow-shift-x: 0px;
  transform: var(--arrow-rotate) translateX(var(--arrow-shift-x)) !important;
  will-change: transform !important;
  transition: transform 0.44s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease !important;
  transform-origin: 50% 100% !important;
  animation: weatherHeaderToggleArrowSheen var(--icon-sheen-duration, 2.35s) ease-in-out infinite !important;
}

.weather-header-card__toggle-icon.is-open,
:host([data-weather-variant='header'][data-weather-expanded='true']) .weather-header-card__toggle-icon {
  --arrow-rotate: ${HEADER_WEATHER_TOGGLE_ARROW_OPEN};
  animation: none !important;
}

.weather-header-trigger:active .weather-header-card__toggle-icon.is-open,
.weather-header-trigger:focus-visible .weather-header-card__toggle-icon.is-open {
  --arrow-rotate: ${HEADER_WEATHER_TOGGLE_ARROW_OPEN};
}

@keyframes weatherHeaderToggleArrowSheen {
  0%,
  100% {
    filter: drop-shadow(0 2px 4px rgb(0 0 0 / 18%)) contrast(1.04) brightness(0.98) saturate(1.04);
    opacity: 0.97;
  }

  50% {
    filter: drop-shadow(0 3px 6px rgb(0 0 0 / 22%)) contrast(1.08) brightness(1.08) saturate(1.1);
    opacity: 1;
  }
}

@keyframes iconArrowGlassBounce {
  0%,
  100% {
    transform: var(--arrow-rotate, rotate(0deg)) translateX(var(--arrow-shift-x, 0px)) translateY(0) scale(1);
  }

  30% {
    transform: var(--arrow-rotate, rotate(0deg)) translateX(var(--arrow-shift-x, 0px)) translateY(-3px) scale(1.05);
  }

  58% {
    transform: var(--arrow-rotate, rotate(0deg)) translateX(var(--arrow-shift-x, 0px)) translateY(1px) scale(0.985);
  }

  76% {
    transform: var(--arrow-rotate, rotate(0deg)) translateX(var(--arrow-shift-x, 0px)) translateY(-1px) scale(1.015);
  }
}

@keyframes iconSurfaceRefraction {
  0%,
  100% {
    filter: drop-shadow(0 2px 4px rgb(0 0 0 / 18%)) contrast(1.04) brightness(0.98) saturate(1.04);
    opacity: 0.97;
  }

  50% {
    filter: drop-shadow(0 3px 6px rgb(0 0 0 / 22%)) contrast(1.08) brightness(1.08) saturate(1.1);
    opacity: 1;
  }
}

.weather-header-card__top,
.weather-header-dropdown__hero-top,
.weather-header-dropdown__hero-bottom,
.weather-header-dropdown__hero-title,
.weather-header-dropdown__hero-temp,
.weather-header-dropdown__hero-copy,
.weather-header-dropdown__hero-chips {
  position: relative !important;
  z-index: 123 !important;
}

/* Top row must stay static so toggle/condition anchor to full content, not a 40px strip. */
.weather-header-card__top {
  display: block !important;
  position: static !important;
  width: 100% !important;
  padding-right: 114px !important;
  z-index: 123 !important;
}

.weather-header-card__side {
  position: static !important;
  width: auto !important;
  height: auto !important;
  display: block !important;
  pointer-events: auto !important;
}

.weather-header-card__side > .weather-header-card__condition {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}

.weather-header-card__condition {
  display: none !important;
}

.weather-header-card__metrics-panel > .weather-header-card__condition,
.weather-header-card__right-column > .weather-header-card__condition {
  position: relative !important;
  top: auto !important;
  right: 0 !important;
  left: auto !important;
  bottom: auto !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-end !important;
  justify-content: flex-start !important;
  gap: 0 !important;
  visibility: visible !important;
  width: 100% !important;
  max-width: var(--header-weather-metrics-min-width, 9.5rem) !important;
  min-width: 0 !important;
  height: auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  text-align: right !important;
  white-space: normal !important;
  overflow: visible !important;
  font-size: var(--header-weather-condition-font-size, 6.5px) !important;
  line-height: var(--header-weather-condition-line-height, 8.32px) !important;
  font-weight: 600 !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  transform: none !important;
  flex: 0 0 auto !important;
  order: 1 !important;
}

.weather-header-card__condition-line {
  display: block !important;
  font-size: inherit !important;
  line-height: inherit !important;
  font-weight: inherit !important;
  letter-spacing: inherit !important;
  text-align: inherit !important;
  white-space: nowrap !important;
  margin: 0 !important;
  padding: 0 !important;
}

.weather-header-card__metrics-panel > .weather-header-card__chip,
.weather-header-card__right-column > .weather-header-card__chip {
  position: relative !important;
  top: auto !important;
  right: 0 !important;
  left: auto !important;
  bottom: auto !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-end !important;
  justify-content: flex-start !important;
  text-align: right !important;
  pointer-events: auto !important;
  transform: none !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  min-width: 62px !important;
  flex: 0 0 auto !important;
}

.weather-header-card__right-column > .weather-header-card__chip > span {
  display: block !important;
  width: 100% !important;
  text-align: right !important;
  margin: 0 !important;
  padding: 0 !important;
}

.weather-header-card__right-column > .weather-header-card__chip > span:first-child {
  margin-bottom: 1px !important;
}

.weather-header-card__right-column > .weather-header-card__chip[data-weather-metric='pressure'],
.weather-header-card__right-column > .weather-header-card__chip--pressure-fallback {
  order: 2 !important;
  margin-top: 0 !important;
}

.weather-header-card__right-column > .weather-header-card__chip[data-weather-metric='pressure'] > span,
.weather-header-card__right-column > .weather-header-card__chip--pressure-fallback > span {
  font-size: 5px !important;
  line-height: 5px !important;
  letter-spacing: 0.7px !important;
  font-weight: 400 !important;
  text-transform: uppercase !important;
}

.weather-header-card__right-column > .weather-header-card__chip[data-weather-metric='humidity'],
.weather-header-card__right-column > .weather-header-card__chip--humidity-fallback {
  order: 3 !important;
  margin-top: 0 !important;
}

/* City name must never be truncated in compact header preview. */
.weather-location-selector,
.weather-location-selector__current,
.weather-location-selector__current * {
  width: auto !important;
  min-width: max-content !important;
  max-width: none !important;
  overflow: visible !important;
  text-overflow: clip !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
  line-height: 1.2 !important;
}

.weather-location-selector__current {
  padding-bottom: 1px !important;
}

/* New widget markup: city is rendered as .weather-header-card__location. */
.weather-header-card__location-row,
.weather-header-card__location {
  overflow: visible !important;
  text-overflow: clip !important;
  white-space: nowrap !important;
}

.weather-header-card__location {
  display: inline-block !important;
  line-height: 1.28 !important;
  padding-bottom: 2px !important;
}

.weather-header-card__title-block,
.weather-header-card__top,
.weather-header-card__location-row {
  overflow: visible !important;
  clip-path: none !important;
}

.weather-header-card__title-block {
  row-gap: 0 !important;
}


.weather-header-card__location-row {
  margin: 0 !important;
}

.weather-header-card__meta {
  margin: 0 !important;
}
.weather-header-card__location-row {
  margin-bottom: 0 !important;
}

/* Keep top-left typography identical across locales (RU baseline). */
.weather-header-card__eyebrow {
  display: none !important;
}

.weather-header-card__location-row {
  display: flex !important;
  align-items: flex-start !important;
  min-height: auto !important;
  margin-bottom: 0 !important;
}

.weather-header-card__location {
  font-size: 14px !important;
  line-height: 17px !important;
  font-weight: 500 !important;
  letter-spacing: -0.01em !important;
  margin: 0 !important;
}

.weather-header-card__meta {
  --weather-meta-equal-gap: 4px;
  font-size: 10px !important;
  line-height: 12px !important;
  letter-spacing: 0.01em !important;
  opacity: 0.8 !important;
  margin-top: var(--weather-meta-equal-gap, 4px) !important;
  margin-bottom: var(--weather-meta-equal-gap, 4px) !important;
}

.weather-header-card__info-panel,
.weather-header-card__left-stack {
  row-gap: 0 !important;
}

.weather-header-card__bottom {
  display: none !important;
}

.weather-header-card__temp-row > .weather-header-card__temperature,
.weather-header-card__bottom > .weather-header-card__temperature {
  grid-column: 1 !important;
  grid-row: 1 !important;
  align-self: center !important;
  margin: 0 !important;
  padding: 0 !important;
}

.weather-header-card__temp-row > .weather-header-card__chips,
.weather-header-card__bottom > .weather-header-card__chips {
  grid-column: 2 !important;
  grid-row: 1 !important;
  align-self: center !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: center !important;
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: max-content !important;
  min-width: 0 !important;
  max-width: none !important;
  line-height: 0 !important;
  font-size: 0 !important;
  text-align: left !important;
  pointer-events: auto !important;
  border: none !important;
  background: transparent !important;
}

.weather-header-card__chip--feels-like,
.weather-header-card__temp-row > .weather-header-card__chips > .weather-header-card__chip--feels-like,
.weather-header-card__temp-row > .weather-header-card__chips > .weather-header-card__chip[data-weather-metric='feels'],
.weather-header-card__bottom > .weather-header-card__chips > .weather-header-card__chip--feels-like,
.weather-header-card__bottom > .weather-header-card__chips > .weather-header-card__chip[data-weather-metric='feels'],
.weather-header-card__content > .weather-header-card__chip--feels-like {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  flex-wrap: nowrap !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  text-align: left !important;
  flex-shrink: 0 !important;
  gap: var(--weather-info-feels-line-gap, 0px) !important;
  text-transform: none !important;
}

.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] {
  --weather-info-feels-line-gap: 2px;
  --weather-feels-stack-height: auto;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;
  justify-content: flex-start !important;
  align-content: flex-start !important;
  align-items: flex-start !important;
  gap: var(--weather-info-feels-line-gap, 2px) !important;
  row-gap: var(--weather-info-feels-line-gap, 2px) !important;
  overflow: visible !important;
  box-sizing: border-box !important;
  border: none !important;
  background: transparent !important;
  transform: none !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  pointer-events: auto !important;
}

.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] > .weather-header-card__feels-label {
  display: block !important;
  width: max-content !important;
  flex: 0 0 auto !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: 4.5px !important;
  line-height: 5px !important;
  letter-spacing: 0.12em !important;
  font-weight: 400 !important;
  color: rgb(255 246 228 / 0.58) !important;
  text-transform: uppercase !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  pointer-events: auto !important;
}

.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] > .weather-header-card__feels-value,
.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] > .weather-header-card__feels-row {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: baseline !important;
  justify-content: flex-start !important;
  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;
  box-sizing: border-box !important;
  padding: 0 !important;
  margin: 0 !important;
  column-gap: 4px !important;
  align-self: flex-start !important;
  flex-shrink: 0 !important;
  font-size: inherit !important;
  line-height: inherit !important;
  font-weight: 400 !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  pointer-events: auto !important;
}

.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-prefix {
  font-size: 4.5px !important;
  line-height: 5px !important;
  letter-spacing: 0.12em !important;
  font-weight: 400 !important;
  text-transform: uppercase !important;
  opacity: 0.92 !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  pointer-events: auto !important;
}

.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-temp,
.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-temp-number,
.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-temp-unit {
  display: inline-block !important;
  flex: 0 0 auto !important;
  width: auto !important;
  max-width: none !important;
  white-space: nowrap !important;
}

.weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-temp {
  display: inline-flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: baseline !important;
  gap: 0 !important;
  margin-left: 0 !important;
  text-align: left !important;
  user-select: text !important;
  -webkit-user-select: text !important;
  pointer-events: auto !important;
}

.weather-header-card__feels-label {
  display: block !important;
  font-size: 5px !important;
  line-height: 5px !important;
  letter-spacing: 0.7px !important;
  font-weight: 400 !important;
  margin: 0 !important;
  opacity: 1 !important;
  white-space: nowrap !important;
  text-align: left !important;
  text-transform: none !important;
}

:host([data-weather-variant='header']) .weather-header-card__feels-label {
  display: inline-block !important;
  transform: none !important;
  transform-origin: left center !important;
}

.weather-header-card__feels-row,
.weather-header-card__feels-value {
  display: inline-flex !important;
  flex-direction: row !important;
  flex-wrap: nowrap !important;
  align-items: baseline !important;
  justify-content: flex-start !important;
  column-gap: 3px !important;
  margin: 0 !important;
  padding: 0 !important;
  width: max-content !important;
  min-width: max-content !important;
  max-width: max-content !important;
  font-size: 9px !important;
  line-height: 9px !important;
  font-weight: 500 !important;
  white-space: nowrap !important;
  text-align: left !important;
  box-sizing: border-box !important;
  word-break: keep-all !important;
  overflow-wrap: normal !important;
}

.weather-header-card__feels-fallback {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: center !important;
  gap: 2px !important;
  margin: 0 !important;
  padding: 0 !important;
  width: max-content !important;
  min-width: max-content !important;
  max-width: none !important;
}

.weather-header-card__feels-fallback-label,
.weather-header-card__feels-fallback-prefix {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: 4.5px !important;
  line-height: 5px !important;
  letter-spacing: 0.12em !important;
  font-weight: 400 !important;
  text-transform: uppercase !important;
  color: rgb(255 246 228 / 0.58) !important;
}

.weather-header-card__feels-fallback-row {
  display: inline-flex !important;
  align-items: baseline !important;
  gap: 3px !important;
  margin: 0 !important;
  padding: 0 !important;
  width: max-content !important;
  white-space: nowrap !important;
}

.weather-header-card__feels-fallback-temp {
  display: inline-flex !important;
  align-items: baseline !important;
  gap: 0 !important;
  font-size: 9px !important;
  line-height: 9px !important;
  font-weight: 500 !important;
  color: rgb(255 246 228 / var(--weather-text-alpha, 0.94)) !important;
}

.weather-header-card__feels-fallback-temp-unit {
  font-size: 0.58em !important;
  line-height: 1 !important;
  opacity: 0.9 !important;
}

.weather-header-card__feels-prefix {
  display: inline-block !important;
  font-size: 8px !important;
  line-height: 8px !important;
  letter-spacing: 0.4px !important;
  font-weight: 500 !important;
  text-transform: none !important;
  opacity: 0.96 !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

.weather-header-card__feels-temp {
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: baseline !important;
  flex-wrap: nowrap !important;
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}

.weather-header-card__temperature-value {
  display: inline-block !important;
  font-size: 1em !important;
  line-height: 1 !important;
  font-weight: 200 !important;
  letter-spacing: -0.05em !important;
  font-variant-numeric: tabular-nums !important;
  vertical-align: baseline !important;
  margin: 0 !important;
  padding: 0 !important;
}

.weather-header-card__feels-temp-number {
  display: inline-block !important;
  font-size: 1em !important;
  line-height: 1 !important;
  font-weight: 200 !important;
  letter-spacing: 0.04em !important;
  font-variant-numeric: tabular-nums !important;
  vertical-align: baseline !important;
  margin: 0 !important;
  padding: 0 !important;
}

:host([data-weather-variant='header']) .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-label,
:host([data-weather-variant='header']) .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-prefix {
  color: rgb(255 246 228 / 0.55) !important;
}

:host([data-weather-variant='header']) .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-temp,
:host([data-weather-variant='header']) .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-temp-number,
:host([data-weather-variant='header']) .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-temp-unit {
  color: rgb(255 246 228 / var(--weather-text-alpha, 0.94)) !important;
}

.weather-header-card__temperature-unit,
.weather-header-card__feels-temp-unit,
.weather-header-dropdown__hero-temp small {
  display: inline-block !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: 0.46em !important;
  line-height: 1 !important;
  letter-spacing: 0 !important;
  transform: translate(0.03em, -0.92em) !important;
  opacity: 0.9 !important;
  white-space: nowrap !important;
  vertical-align: baseline !important;
}

.weather-header-card__feels-temp-unit {
  font-size: max(0.46em, 4.8px) !important;
}

.weather-header-card__bottom > .weather-header-card__chips > .weather-header-card__chip[data-weather-metric='wind'] {
  display: none !important;
}

.weather-header-card__temperature {
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: baseline !important;
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  text-align: left !important;
  transform: none !important;
}

.weather-header-card__location-row,
.weather-header-card__meta,
.weather-header-card__title-block,
.weather-header-card__eyebrow {
  transform: none !important;
}

.weather-header-card__temperature,
.weather-header-card__temp-row > .weather-header-card__temperature,
.weather-header-card__bottom > .weather-header-card__temperature {
  --header-weather-temp-value-size: 34px;
  font-size: var(--header-weather-temp-value-size, 22px) !important;
}

.weather-header-card__bottom {
  display: grid !important;
  grid-template-columns: max-content max-content !important;
  align-items: center !important;
  justify-content: start !important;
  column-gap: 10px !important;
  margin: 0 !important;
  padding: 0 !important;
  width: max-content !important;
  max-width: none !important;
}

.weather-header-card__temperature-value {
  font-size: 1em !important;
  font-weight: 300 !important;
  letter-spacing: -0.055em !important;
  font-variant-numeric: tabular-nums !important;
  line-height: 1 !important;
}

.weather-header-card__temp-row {
  grid-template-columns: max-content max-content !important;
  column-gap: 10px !important;
  align-items: center !important;
}

:host([data-weather-variant='header']) .weather-header-card__right-column,
:host([data-weather-variant='header']) .weather-header-card__metrics-panel,
:host([data-weather-variant='header']) .weather-header-card__condition,
:host([data-weather-variant='header']) .weather-header-card__chip[data-weather-metric='pressure'],
:host([data-weather-variant='header']) .weather-header-card__chip[data-weather-metric='humidity'],
:host([data-weather-variant='header']) .weather-header-card__chip[data-weather-metric='wind']:not(.weather-header-card__chip--feels-like) {
  display: none !important;
}

.weather-header-card__temp-row > .weather-header-card__chips > .weather-header-card__chip:not(.weather-header-card__chip--feels-like) {
  display: none !important;
}

.weather-header-card__bottom > .weather-header-card__chips > .weather-header-card__chip:not(.weather-header-card__chip--feels-like) {
  display: none !important;
}

.weather-header-card__temp-row > .weather-header-card__chips {
  align-self: center !important;
  justify-content: center !important;
}

.weather-header-card__toggle {
  position: absolute !important;
  left: 50% !important;
  right: auto !important;
  top: auto !important;
  bottom: var(--header-weather-menu-toggle-bottom, -6px) !important;
  transform: translateX(-50%) !important;
  z-index: 130 !important;
  pointer-events: auto !important;
}

.weather-header-dropdown__hero-top {
  position: relative !important;
  z-index: 5 !important;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) auto !important;
  align-items: start !important;
  gap: 10px 12px !important;
  padding: 16px 18px 4px !important;
  width: 100% !important;
}

.weather-header-dropdown__hero-title {
  min-width: 0 !important;
  max-width: min(72%, 280px) !important;
}

.weather-header-dropdown__eyebrow {
  font-size: 9px !important;
  letter-spacing: 0.16em !important;
  margin: 0 0 4px !important;
  color: rgb(255 231 184 / 70%) !important;
}

.weather-header-dropdown__hero-title strong {
  font-size: clamp(15px, 3.4vw, 17px) !important;
  line-height: 1.18 !important;
  font-weight: 600 !important;
}

.weather-header-dropdown__hero-meta {
  font-size: 10px !important;
  line-height: 1.25 !important;
  margin: 4px 0 0 !important;
  color: rgb(255 239 209 / 72%) !important;
}

.weather-header-dropdown__close {
  position: relative !important;
  inset: auto !important;
  grid-column: 2 !important;
  grid-row: 1 !important;
  align-self: start !important;
  justify-self: end !important;
  flex: 0 0 auto !important;
  z-index: 6 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 32px !important;
  height: 32px !important;
  min-width: 32px !important;
  min-height: 32px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  outline: none !important;
  border-radius: 999px !important;
  cursor: pointer !important;
  overflow: hidden !important;
  color: transparent !important;
  font-size: 0 !important;
  line-height: 0 !important;
  letter-spacing: 0 !important;
  -webkit-tap-highlight-color: transparent !important;
  background: linear-gradient(
    165deg,
    rgb(14 22 26 / 44%) 0%,
    rgb(8 14 18 / 30%) 100%
  ) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.06) !important;
  backdrop-filter: blur(14px) saturate(1.06) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 236 200 / 12%),
    0 2px 10px rgb(4 10 14 / 18%) !important;
}

.weather-header-dropdown__close::before,
.weather-header-dropdown__close::after {
  content: '' !important;
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  width: 12px !important;
  height: 1.5px !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  border-radius: 999px !important;
  background: rgb(255 244 228 / 90%) !important;
  transform: translate(-50%, -50%) rotate(45deg) !important;
  pointer-events: none !important;
}

.weather-header-dropdown__close::after {
  transform: translate(-50%, -50%) rotate(-45deg) !important;
}

.weather-header-dropdown__hero-bottom {
  --hero-dropdown-condition-size: 12px;
  --hero-dropdown-condition-lh: 1.12;
  --hero-dropdown-condition-lines: 2;
  --hero-dropdown-condition-pad: 0px;
  --hero-dropdown-updated-size: 10px;
  --hero-dropdown-updated-lh: 1.2;
  --hero-dropdown-copy-gap: 4px;
  --hero-dropdown-temp-condition-gap: 12px;
  --hero-dropdown-copy-height: calc(
    var(--hero-dropdown-condition-size) * var(--hero-dropdown-condition-lh) *
      var(--hero-dropdown-condition-lines) + var(--hero-dropdown-condition-pad) +
      var(--hero-dropdown-copy-gap) + var(--hero-dropdown-updated-size) * var(--hero-dropdown-updated-lh)
  );
  position: relative !important;
  inset: auto !important;
  bottom: auto !important;
  left: auto !important;
  right: auto !important;
  z-index: 5 !important;
  display: grid !important;
  grid-template-columns: max-content minmax(0, 1fr) !important;
  grid-template-rows: auto auto auto !important;
  grid-template-areas:
    'temp condition'
    'temp updated'
    'chips chips' !important;
  align-items: start !important;
  justify-content: stretch !important;
  column-gap: 16px !important;
  row-gap: 1px !important;
  padding: 0 18px 4px !important;
  width: 100% !important;
  flex-wrap: nowrap !important;
  margin-top: 0 !important;
}

.weather-header-dropdown__hero-temp {
  grid-area: temp !important;
  grid-row: 1 / 3 !important;
  display: inline-flex !important;
  flex-direction: row !important;
  align-items: baseline !important;
  justify-content: flex-start !important;
  gap: 0 !important;
  box-sizing: border-box !important;
  height: var(--hero-dropdown-copy-height) !important;
  max-height: var(--hero-dropdown-copy-height) !important;
  min-height: 0 !important;
  overflow: hidden !important;
  line-height: 1 !important;
  flex: 0 0 auto !important;
  align-self: start !important;
  justify-self: start !important;
  margin: 0 !important;
  padding: 0 !important;
}

.weather-header-dropdown__hero-temp span {
  font-size: var(--hero-dropdown-copy-height) !important;
  font-weight: 200 !important;
  letter-spacing: -0.05em !important;
  line-height: 1 !important;
  height: auto !important;
  max-height: none !important;
  font-variant-numeric: tabular-nums !important;
  display: inline-block !important;
  vertical-align: baseline !important;
}

.weather-header-dropdown__hero-temp small {
  font-weight: 500 !important;
  align-self: auto !important;
  vertical-align: baseline !important;
}

/* Children participate in hero-bottom grid via display:contents. */
.weather-header-dropdown__hero-copy {
  display: contents !important;
}

.weather-header-dropdown__hero-copy strong {
  grid-area: condition !important;
  align-self: start !important;
  justify-self: start !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  gap: 1px !important;
  margin: 0 !important;
  padding: 0 0 var(--hero-dropdown-condition-pad) !important;
  font-size: var(--hero-dropdown-condition-size) !important;
  line-height: var(--hero-dropdown-condition-lh) !important;
  font-weight: 600 !important;
  letter-spacing: 0.02em !important;
  text-align: left !important;
  max-width: 100% !important;
}

.weather-header-dropdown__condition-line {
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: inherit !important;
  line-height: inherit !important;
  font-weight: inherit !important;
  letter-spacing: inherit !important;
  white-space: nowrap !important;
}

.weather-header-dropdown__hero-copy > span {
  grid-area: updated !important;
  align-self: start !important;
  justify-self: start !important;
  margin: 0 !important;
  padding: 0 !important;
  font-size: var(--hero-dropdown-updated-size) !important;
  line-height: var(--hero-dropdown-updated-lh) !important;
  letter-spacing: 0.01em !important;
  color: rgb(255 242 214 / 76%) !important;
  white-space: nowrap !important;
}

.weather-header-dropdown__hero-chips {
  grid-column: 1 / -1 !important;
  grid-row: 3 !important;
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  align-self: start !important;
  align-items: stretch !important;
  justify-content: stretch !important;
  gap: 6px !important;
  width: 100% !important;
  max-width: 100% !important;
  margin-top: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
}

.weather-header-dropdown__hero-chips::-webkit-scrollbar {
  display: none !important;
}

.weather-header-dropdown__hero-chips span {
  width: 100% !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  min-height: 22px !important;
  height: auto !important;
  font-size: 9px !important;
  line-height: 1.15 !important;
  letter-spacing: 0.04em !important;
  padding: 4px 10px !important;
  border-radius: 999px !important;
  border: 1px solid rgb(255 232 176 / 18%) !important;
  background: rgb(5 12 10 / 48%) !important;
  color: rgb(255 246 228 / 92%) !important;
  white-space: nowrap !important;
  -webkit-backdrop-filter: blur(10px) !important;
  backdrop-filter: blur(10px) !important;
}

@media (max-width: 560px) {
  .weather-header-dropdown__hero-bottom {
    grid-template-columns: max-content minmax(0, 1fr) !important;
    grid-template-rows: auto auto auto !important;
    grid-template-areas:
      'temp condition'
      'temp updated'
      'chips chips' !important;
    row-gap: 6px !important;
  }
}

.weather-header-dropdown__forecast-list > .weather-header-dropdown__forecast-pill:first-child {
  display: none !important;
}

.weather-header-dropdown__forecast-list,
.weather-header-dropdown__details-grid {
  display: grid !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__forecast-pill,
:host([data-weather-variant='header']) .weather-header-dropdown__detail-card,
:host([data-weather-variant='header']) .weather-header-dropdown__close,
:host([data-weather-variant='header']) .weather-location-selector__suggestion {
  transition:
    transform 0.24s ease,
    border-color 0.24s ease,
    background 0.24s ease,
    opacity 0.24s ease !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__forecast-pill:hover,
:host([data-weather-variant='header']) .weather-header-dropdown__detail-card:hover,
:host([data-weather-variant='header']) .weather-location-selector__suggestion:hover {
  transform: translateY(-1px) !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__close:hover {
  transform: none !important;
  background: linear-gradient(
    165deg,
    rgb(18 28 32 / 52%) 0%,
    rgb(10 18 22 / 38%) 100%
  ) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 236 200 / 16%),
    0 3px 12px rgb(4 10 14 / 22%) !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__close:hover::before,
:host([data-weather-variant='header']) .weather-header-dropdown__close:hover::after {
  background: rgb(255 248 236 / 96%) !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__close:focus-visible {
  outline: 2px solid rgb(255 216 160 / 72%) !important;
  outline-offset: 2px !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__close:active::before,
:host([data-weather-variant='header']) .weather-header-dropdown__close:active::after {
  transform: translate(-50%, -50%) scale(0.94) rotate(45deg) !important;
}

:host([data-weather-variant='header']) .weather-header-dropdown__close:active::after {
  transform: translate(-50%, -50%) scale(0.94) rotate(-45deg) !important;
}

@media (prefers-reduced-motion: reduce) {
  :host([data-weather-variant='header']) .weather-header-dropdown__close:active::before,
  :host([data-weather-variant='header']) .weather-header-dropdown__close:active::after {
    transform: translate(-50%, -50%) rotate(45deg) !important;
  }

  :host([data-weather-variant='header']) .weather-header-dropdown__close:active::after {
    transform: translate(-50%, -50%) rotate(-45deg) !important;
  }
}

.weather-header-dropdown {
  z-index: 10000 !important;
  position: absolute !important;
  left: 50% !important;
  right: auto !important;
  top: calc(100% + 38px) !important;
  transform: translateX(-50%) !important;
  overflow: hidden !important;
  isolation: isolate !important;
  background-color: rgb(5 10 9) !important;
  background-image: none !important;
  width: min(
    calc(100vw - (var(--site-side-padding, 14px) * 2)),
    clamp(500px, 36vw, 620px)
  ) !important;
  max-width: min(
    calc(100vw - (var(--site-side-padding, 14px) * 2)),
    clamp(500px, 36vw, 620px)
  ) !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  max-height: min(78dvh, calc(100dvh - 112px)) !important;
  overflow-x: hidden !important;
  overflow-y: auto !important;
  overscroll-behavior: contain !important;
  touch-action: pan-y !important;
  -webkit-overflow-scrolling: touch !important;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

.weather-header-dropdown::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
}

.weather-header-dropdown.is-scrolling {
  scrollbar-width: thin !important;
}

.weather-header-dropdown.is-scrolling::-webkit-scrollbar {
  width: 6px !important;
  height: 6px !important;
}

.weather-header-dropdown.is-scrolling::-webkit-scrollbar-track {
  background: rgb(255 255 255 / 12%) !important;
  border-radius: 999px !important;
}

.weather-header-dropdown.is-scrolling::-webkit-scrollbar-thumb {
  background: rgb(255 232 176 / 44%) !important;
  border-radius: 999px !important;
}

.weather-header-dropdown__toolbar {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  justify-items: stretch !important;
  align-items: stretch !important;
  row-gap: 12px !important;
  padding-inline: 16px !important;
}

.weather-location-selector--compact {
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  width: 100% !important;
  justify-content: stretch !important;
  align-items: stretch !important;
  gap: 12px !important;
}

.weather-location-selector__form--compact {
  flex: 0 0 auto !important;
  width: 100% !important;
  max-width: 100% !important;
  justify-self: center !important;
}

.weather-location-selector__search-wrap,
.weather-location-selector__search {
  width: 100% !important;
  max-width: 100% !important;
}

.weather-location-selector__input {
  width: 100% !important;
  letter-spacing: 0 !important;
  font-size: clamp(11px, 1.65vw, 15px) !important;
  line-height: 1.25 !important;
}

.weather-location-selector__input::placeholder {
  letter-spacing: 0 !important;
}

.weather-location-selector__current--compact {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  align-self: center !important;
  justify-self: center !important;
  width: 100% !important;
  max-width: 100% !important;
  min-height: 40px !important;
  padding: 0 16px !important;
  border: 1px solid rgba(255, 224, 165, 0.32) !important;
  border-radius: 999px !important;
  background: linear-gradient(180deg, rgba(11, 18, 16, 0.94) 0%, rgba(8, 14, 12, 0.92) 100%) !important;
  color: rgba(255, 244, 220, 0.96) !important;
  line-height: 1 !important;
  transform: none !important;
  transition: border-color 0.24s ease, background-color 0.24s ease, color 0.24s ease,
    box-shadow 0.24s ease !important;
}

.weather-location-selector__current--compact:hover,
.weather-location-selector__current--compact:focus-visible {
  border-color: rgba(245, 230, 178, 0.52) !important;
  background: linear-gradient(180deg, rgba(14, 23, 20, 0.96) 0%, rgba(10, 17, 14, 0.94) 100%) !important;
  box-shadow: 0 0 0 1px rgba(245, 230, 178, 0.28), inset 0 0 20px rgba(201, 168, 76, 0.1) !important;
}

.weather-location-selector__current--compact:active {
  transform: translateY(1px) !important;
}

.weather-location-selector__current--compact svg {
  display: none !important;
}

.weather-location-selector__current--compact::before {
  content: '';
  display: inline-block;
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  background-image: url('/assets/images/icon-pak/Gotovie%20iconki%20dlya%20saita/Locate.png');
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  transform: translateY(1px);
  margin-right: 1px;
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

@media (max-width: 899px) {
  :host([data-weather-variant='header']),
  :host([data-weather-variant='header']) [data-weather-widget-root] {
    border-radius: 0 !important;
    clip-path: none !important;
    overflow: visible !important;
  }

  .weather-orb-overlay--preview {
    width: 102px !important;
    height: 102px !important;
  }

  .weather-orb-overlay--preview.is-moon {
    width: ${102 * HEADER_WEATHER_MOON_SIZE_FACTOR}px !important;
    height: ${102 * HEADER_WEATHER_MOON_SIZE_FACTOR}px !important;
  }

  .weather-orb-overlay--preview.is-sun {
    width: ${Math.round(102 * HEADER_WEATHER_SUN_SIZE_FACTOR)}px !important;
    height: ${Math.round(102 * HEADER_WEATHER_SUN_SIZE_FACTOR)}px !important;
    max-width: 42% !important;
    max-height: 88% !important;
  }

  .weather-orb-overlay--dropdown {
    width: clamp(68px, 18vw, 88px) !important;
    height: clamp(68px, 18vw, 88px) !important;
  }

  .weather-orb-overlay--dropdown.is-moon {
    width: clamp(76px, 19vw, 96px) !important;
    height: clamp(76px, 19vw, 96px) !important;
  }

  .weather-header-card__toggle span:first-child {
    display: inline !important;
  }

  .weather-header-dropdown__forecast-list,
  .weather-header-dropdown__details-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: 7px !important;
  }

  .weather-header-dropdown__forecast-pill,
  .weather-header-dropdown__detail-card {
    min-width: 0 !important;
    padding: 8px 7px !important;
  }

  .weather-header-dropdown__forecast-pill strong,
  .weather-header-dropdown__detail-card strong {
    font-size: 12px !important;
  }

  .weather-location-selector__current--compact {
    width: 100% !important;
    max-width: none !important;
    min-height: 38px !important;
    padding-inline: 14px !important;
    transform: none !important;
  }

  /* Mobile stretch lock: keep temp + feels row readable and prevent overlap in all locales. */
  .weather-header-card__content {
    padding: 8px 14px 0 var(--header-weather-text-inset, 0px) !important;
  }

  .weather-header-card__info-panel,
  .weather-header-card__left-stack {
    max-width: calc(100% - 96px) !important;
    width: calc(100% - 96px) !important;
    min-width: 0 !important;
  }

  .weather-header-card__temp-row,
  .weather-header-card__bottom {
    grid-template-columns: max-content max-content !important;
    column-gap: 12px !important;
    width: max-content !important;
    max-width: none !important;
  }

  .weather-header-card__temp-row > .weather-header-card__temperature,
  .weather-header-card__bottom > .weather-header-card__temperature {
    margin-right: 2px !important;
  }

  .weather-header-card__temp-row > .weather-header-card__chips,
  .weather-header-card__bottom > .weather-header-card__chips {
    width: max-content !important;
    min-width: max-content !important;
    max-width: none !important;
    overflow: visible !important;
  }

  .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] > .weather-header-card__feels-label,
  .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] .weather-header-card__feels-prefix {
    font-size: 5.5px !important;
    line-height: 6.5px !important;
  }

  .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] > .weather-header-card__feels-value,
  .weather-header-card__chip--feels-like[data-weather-feels-layout='custom'] > .weather-header-card__feels-row {
    column-gap: 3px !important;
    font-size: 10px !important;
    line-height: 10px !important;
  }

  .weather-header-card__temperature-unit,
  .weather-header-card__feels-temp-unit {
    transform: translate(0.02em, -0.62em) !important;
  }

}

/* Final hard lock (desktop/tablet): menu button at center cross zone. */
:host([data-weather-variant='header']) .weather-header-card__top {
  position: relative !important;
  width: 100% !important;
}

:host([data-weather-variant='header']) .weather-header-card__side {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  pointer-events: none !important;
}

:host([data-weather-variant='header']) .weather-header-card__toggle {
  position: absolute !important;
  left: 50% !important;
  right: auto !important;
  top: auto !important;
  bottom: var(--header-weather-menu-toggle-bottom, -6px) !important;
  transform: translateX(-50%) !important;
  z-index: 130 !important;
  pointer-events: auto !important;
}
`;

  const WEATHER_WIDGET_ASSET_VERSION = '20260522-moon-visibility-v3';
  /** Full mission_2160p30.mp4 timeline (7:38) mapped to each local night window. */
  const HEADER_WEATHER_MOON_VIDEO_DURATION_SEC = 458.233333;
  const HEADER_WEATHER_MOON_DAY_MIN_OPACITY = 0.22;
  /** NASA / Eyes-style warm loop (sun:fetch-nasa or sun_reference.mp4). */
  const HEADER_WEATHER_SUN_VIDEO_DURATION_SEC = 10;
  const HEADER_WEATHER_SUN_VIDEO_FILES = Object.freeze(['sun_alpha.webm']);
  /** Civil-style handoff moon ↔ sun (ms). */
  const HEADER_WEATHER_ORB_CROSSFADE_MS = 42 * 60 * 1000;
  const HEADER_WEATHER_MOON_VIDEO_FILES = Object.freeze(['mission_2160p30_alpha.webm']);

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
    'vvedenie.html',
    'social.html',
    'reyting.html',
    'partnerstvo.html',
    'impressum.html',
    'datenschutz.html',
  ]);

  let headerWeatherLoaderPromise = null;
  const HEADER_WEATHER_GEOCODE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
  const HEADER_WEATHER_CURRENT_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
  const HEADER_WEATHER_ASTRO_ENDPOINT = 'https://api.sunrise-sunset.org/json';
  const HEADER_WEATHER_REVERSE_GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
  const HEADER_WEATHER_STATIC_FALLBACK_COORDS = Object.freeze({ latitude: 51.320486, longitude: 12.416501 });
  const HEADER_WEATHER_ASTRO_REFRESH_INTERVAL = 60000;
  const HEADER_WEATHER_WIDGET_REFRESH_INTERVAL = 60 * 1000;
  const HEADER_WEATHER_TIME_SYNC_INTERVAL = 30 * 60 * 1000;
  const HEADER_WEATHER_LIVE_CLOCK_INTERVAL = 1000; // Update live clock every 1 second
  const HEADER_WEATHER_TIME_SYNC_TIMEOUT = 4500;
  const HEADER_WEATHER_CLOUDS_ENABLED = true;
  const HEADER_WEATHER_MAX_CLOCK_DRIFT_MS = 7 * 24 * 60 * 60 * 1000;
  const HEADER_WEATHER_LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000;
  const HEADER_WEATHER_CURRENT_CACHE_TTL = 45 * 1000;
  const HEADER_WEATHER_ASTRO_CACHE_TTL = 12 * 60 * 60 * 1000;
  const HEADER_WEATHER_GEO_STORAGE_KEY = 'header_weather_geo_v1';
  const HEADER_WEATHER_GEO_CACHE_TTL = 30 * 60 * 1000;
  const HEADER_WEATHER_READINGS_STORAGE_KEY = 'header_weather_readings_v1';
  const HEADER_WEATHER_READINGS_CACHE_TTL = 12 * 60 * 60 * 1000;
  const HEADER_WEATHER_GEO_TIMEOUT = 10000;
  const HEADER_WEATHER_STRICT_STYLE_LOCK = true;
  const HEADER_WEATHER_BERLIN_LABEL = 'Ber' + 'lin';
  const HEADER_WEATHER_BERLIN_ALIAS_KEY = ('ber' + 'lin').toLowerCase();
  const HEADER_WEATHER_DEFAULT_TIMEZONE = `Europe/${HEADER_WEATHER_BERLIN_LABEL}`;
  const HEADER_WEATHER_SEARCH_PLACEHOLDER_BY_LANG = Object.freeze({
    ru: 'Искать место: страна, город, индекс, село, район',
    uk: 'Шукати місце: країна, місто, індекс',
    de: 'Ort suchen: Land, Stadt, PLZ',
    en: 'Search place: country, city, ZIP',
  });
  const headerWeatherLocationCache = new Map();
  const headerWeatherCurrentCache = new Map();
  const headerWeatherAstroCache = new Map();
  let headerWeatherServerTimeOffsetMs = 0;
  let headerWeatherServerTimeSyncedAt = 0;
  const HEADER_WEATHER_ORB_RENDER_PROFILES = {
    sun: {
      useFullFrame: true,
      keyFloor: 4,
      featherCeiling: 72,
      focusThreshold: 118,
      focusAlphaFloor: 18,
      paddingRatio: 0.48,
      baseMarginRatio: 0.1,
      maxScale: 0.88,
      sourceFilter: 'brightness(2) saturate(1.12) contrast(1.05)',
      outputFilter: 'brightness(1.02) saturate(1.06) contrast(1.02)',
    },
    moon: {
      keyFloor: 32,
      featherCeiling: 120,
      alphaFloor: 8,
      focusThreshold: 88,
      focusAlphaFloor: 28,
      paddingRatio: 0.28,
      baseMarginRatio: 0.04,
      maxScale: 2.4,
      sourceFilter: 'brightness(1.02) contrast(1.04)',
      outputFilter: 'brightness(1.02) contrast(1.03)',
    },
  };

  function emitHeaderWeatherEvent(type, expanded = false) {
    window.dispatchEvent(new CustomEvent(type, { detail: { expanded } }));
  }

  function extractSupportedLang(rawLang) {
    const normalized = String(rawLang || '')
      .toLowerCase()
      .trim()
      .slice(0, 2);

    return SUPPORTED_LANGS.includes(normalized) ? normalized : null;
  }

  function normalizeLangCode(rawLang) {
    return extractSupportedLang(rawLang) || 'en';
  }

  function resolvePreferredLaunchLanguage() {
    const storedPreference = extractSupportedLang(localStorage.getItem('preferred_lang'));
    if (storedPreference) {
      return storedPreference;
    }

    const languageCandidates =
      Array.isArray(window.navigator?.languages) && window.navigator.languages.length
        ? window.navigator.languages
        : [window.navigator?.language, window.navigator?.userLanguage].filter(Boolean);

    for (const candidate of languageCandidates) {
      const matched = extractSupportedLang(candidate);
      if (matched) {
        return matched;
      }
    }

    return 'de';
  }

  function getLaunchLanguageRedirectUrl(context) {
    if (context.currentLang) {
      return null;
    }

    const preferredLang = resolvePreferredLaunchLanguage();
    return buildLanguageUrl(context, preferredLang);
  }

  function resolvePageContext() {
    const currentUrl = new URL(window.location.href);
    const pathParts = currentUrl.pathname.split('/').filter(Boolean);
    const langIndex = pathParts.findIndex(part => SUPPORTED_LANGS.includes(part));
    const currentLang = langIndex >= 0 ? normalizeLangCode(pathParts[langIndex]) : null;
    const currentRoute = langIndex >= 0 ? pathParts.slice(langIndex + 1).join('/') : '';
    const htmlLang = normalizeLangCode(document.documentElement.lang);
    const pageLang = currentLang || htmlLang;

    if (document.documentElement.lang !== pageLang) {
      document.documentElement.lang = pageLang;
    }

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
          <a href="${homeHref}"${isHomeRoute ? ' class="active"' : ''} aria-label="${copy.home}" title="${copy.home}">
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
              <img src="${assetPrefix}/images/icon-pak/Gotovie iconki dlya saita/spotify.png" alt="Spotify">
            </button>
            <button class="social-service-btn" type="button" data-panel="social-apple-panel" aria-label="Apple Music">
              <img src="${assetPrefix}/images/icon-pak/Gotovie iconki dlya saita/apple_music.png" alt="Apple Music">
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
      <img src="${assetPrefix}/images/icon-pak/Gotovie iconki dlya saita/clash_royale.png" class="promo-btn-icon" alt="" aria-hidden="true">
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
    hardenHeaderA11y();
  }

  function hardenHeaderA11y() {
    const header = document.querySelector('header.header');
    if (!header) {
      return;
    }

    // Header is a landmark container, not an interactive control.
    header.removeAttribute('tabindex');
    header.removeAttribute('contenteditable');

    if (!header.hasAttribute('role')) {
      header.setAttribute('role', 'banner');
    }
  }

  function getHeaderWeatherHost() {
    return document.querySelector('.header-weather-widget[data-weather-widget]');
  }

  function getHeaderWeatherWidgetBasePath(host) {
    const widgetSrc = host?.dataset?.widgetSrc || '';
    if (!widgetSrc) {
      return '';
    }

    const cleanSrc = widgetSrc.split('?')[0];
    const lastSlash = cleanSrc.lastIndexOf('/');
    return lastSlash >= 0 ? cleanSrc.slice(0, lastSlash) : '';
  }

  function getHeaderWeatherAssetsBasePath(host) {
    const widgetBase = getHeaderWeatherWidgetBasePath(host);
    if (!widgetBase) {
      return '';
    }
    return widgetBase.replace(/3d-weather-codrops-main\/dist-widget\/?$/, 'assets');
  }

  let headerWeatherSunSceneModulePromise = null;

  function resolveHeaderWeatherSunSceneModuleUrl() {
    const shellScript = document.querySelector('script[src*="site-shell.js"]');
    if (shellScript?.src) {
      try {
        const scriptUrl = new URL(shellScript.src, window.location.href);
        return new URL(`./header-weather-sun-scene.js?v=${WEATHER_WIDGET_ASSET_VERSION}`, scriptUrl).href;
      } catch (_) {
        // Fall through to site-root assets path.
      }
    }

    return new URL(`/assets/js/header-weather-sun-scene.js?v=${WEATHER_WIDGET_ASSET_VERSION}`, window.location.href)
      .href;
  }

  function loadHeaderWeatherSunSceneModule() {
    if (!headerWeatherSunSceneModulePromise) {
      const moduleUrl = resolveHeaderWeatherSunSceneModuleUrl();
      headerWeatherSunSceneModulePromise = import(/* webpackIgnore: true */ moduleUrl);
    }
    return headerWeatherSunSceneModulePromise;
  }

  function stopHeaderWeatherSunScene(overlay) {
    if (!overlay) {
      return;
    }
    overlay.__sunSceneMountToken = null;
    if (overlay.__sunScene) {
      overlay.__sunScene.stop();
      overlay.__sunScene.dispose();
      overlay.__sunScene = null;
    }
    if (overlay.__sunSceneResizeObserver) {
      overlay.__sunSceneResizeObserver.disconnect();
      overlay.__sunSceneResizeObserver = null;
    }
  }

  function updateHeaderWeatherSunSceneGeo(overlay, geoState) {
    if (!overlay?.__sunScene || !geoState) {
      return;
    }
    overlay.__sunScene.setGeoState(geoState);
    overlay.__sunScene.resize();
  }

  function normalizeHeaderWeatherLocationKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function parseHeaderWeatherCoordinates(value) {
    const match = String(value || '').match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) {
      return null;
    }

    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null;
    }

    return { latitude, longitude };
  }

  function readHeaderWeatherStoredGeo() {
    try {
      const raw = localStorage.getItem(HEADER_WEATHER_GEO_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      const latitude = Number(parsed?.latitude);
      const longitude = Number(parsed?.longitude);
      const expiresAt = Number(parsed?.expiresAt);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(expiresAt)) {
        return null;
      }

      if (expiresAt <= Date.now()) {
        return null;
      }

      return { latitude, longitude, expiresAt };
    } catch (_) {
      return null;
    }
  }

  function storeHeaderWeatherGeo(latitude, longitude) {
    try {
      localStorage.setItem(
        HEADER_WEATHER_GEO_STORAGE_KEY,
        JSON.stringify({
          latitude,
          longitude,
          expiresAt: Date.now() + HEADER_WEATHER_GEO_CACHE_TTL,
        })
      );
    } catch (_) {
      // Ignore storage failures in private mode.
    }
  }

  async function resolveHeaderWeatherBrowserGeoCoords() {
    const cachedGeo = readHeaderWeatherStoredGeo();
    if (cachedGeo) {
      return { ...cachedGeo, source: 'cache' };
    }

    if (window.isSecureContext && navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: HEADER_WEATHER_GEO_TIMEOUT,
            maximumAge: HEADER_WEATHER_GEO_CACHE_TTL,
          });
        });

        const latitude = Number(position?.coords?.latitude);
        const longitude = Number(position?.coords?.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          storeHeaderWeatherGeo(latitude, longitude);
          return { latitude, longitude, source: 'gps', expiresAt: Date.now() + HEADER_WEATHER_GEO_CACHE_TTL };
        }
      } catch (_) {
        // GPS permission denied or unavailable. Use salon static coordinates (Stötteritz) directly.
      }
    }

    // Primary fallback: salon static coordinates (Stötteritz)
    return {
      latitude: HEADER_WEATHER_STATIC_FALLBACK_COORDS.latitude,
      longitude: HEADER_WEATHER_STATIC_FALLBACK_COORDS.longitude,
      source: 'static-salon',
    };
  }

  async function applyHeaderWeatherAutoGeoLocation(host) {
    if (!host || host.dataset.weatherGeoResolved === 'true') {
      return;
    }

    const coords = await resolveHeaderWeatherBrowserGeoCoords();
    if (!coords) {
      host.dataset.weatherGeoResolved = 'false';
      return;
    }

    host.dataset.weatherLocation = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
    host.dataset.weatherGeoResolved = 'true';
    host.dataset.weatherGeoSource = coords.source || 'unknown';

    if (coords.source === 'static-salon') {
      host.dataset.weatherRegionLabel = 'Sachsen';
    }
  }

  function getHeaderWeatherLocationLabel(host) {
    const locationLabel = host?.shadowRoot?.querySelector('.weather-header-card__location')?.textContent?.trim();
    return locationLabel || host?.dataset?.weatherLocation || 'Leipzig';
  }

  function formatHeaderWeatherCityDistrictDisplayLabel(value) {
    const applySoftBreakHints = input => {
      const normalized = String(input || '')
        .replace(/\s+/g, ' ')
        .trim();
      const cityDistrictMatch = normalized.match(/^([^,]+?)\s-\s(.+)$/);
      if (cityDistrictMatch) {
        const city = cityDistrictMatch[1].trim().replace(/\s+/g, '\u00a0');
        const district = cityDistrictMatch[2].trim();
        // First preferred wrap point: between city and district.
        return `${city} -\u200B ${district}`.replace(/,\s+/g, ',\u200B ');
      }

      return normalized.replace(/,\s+/g, ',\u200B ');
    };

    const raw = String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!raw) {
      return raw;
    }

    if (/\s-\s/.test(raw)) {
      return applySoftBreakHints(raw);
    }

    const commaParts = raw
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);

    if (commaParts.length === 2 && commaParts[0].toLowerCase() !== commaParts[1].toLowerCase()) {
      return applySoftBreakHints(`${commaParts[1]} - ${commaParts[0]}`);
    }

    if (!raw.includes(',') && !raw.includes('.') && /stötteritz/i.test(raw)) {
      return applySoftBreakHints(`Leipzig - ${raw}`);
    }

    return applySoftBreakHints(raw);
  }

  function getHeaderWeatherLanguageFallbacks() {
    const pageLanguage = String(document.documentElement.lang || 'en')
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];

    return Array.from(new Set([pageLanguage || 'en', 'de', 'en']));
  }

  function buildHeaderWeatherDistrictLabel(address) {
    if (!address || typeof address !== 'object') {
      return null;
    }

    const formatCityDistrictLabel = (cityValue, districtValue) => {
      const city = String(cityValue || '').trim();
      const district = String(districtValue || '').trim();
      if (city && district && city.toLowerCase() !== district.toLowerCase()) {
        return `${city} - ${district}`;
      }
      return city || district || null;
    };

    const district =
      address.suburb ||
      address.city_district ||
      address.neighbourhood ||
      address.quarter ||
      address.borough ||
      address.hamlet ||
      '';

    const city = address.city || address.town || address.village || address.county || '';

    return formatCityDistrictLabel(city, district);
  }

  function normalizeHeaderWeatherGermanStateLabel(value, address = null) {
    const isoCode = String(address?.['ISO3166-2-lvl4'] || '')
      .trim()
      .toUpperCase();
    const isoStateMap = {
      'DE-BW': 'Baden-Wurttemberg',
      'DE-BY': 'Bayern',
      'DE-BE': HEADER_WEATHER_BERLIN_LABEL,
      'DE-BB': 'Brandenburg',
      'DE-HB': 'Bremen',
      'DE-HH': 'Hamburg',
      'DE-HE': 'Hessen',
      'DE-MV': 'Mecklenburg-Vorpommern',
      'DE-NI': 'Niedersachsen',
      'DE-NW': 'Nordrhein-Westfalen',
      'DE-RP': 'Rheinland-Pfalz',
      'DE-SL': 'Saarland',
      'DE-SN': 'Sachsen',
      'DE-ST': 'Sachsen-Anhalt',
      'DE-SH': 'Schleswig-Holstein',
      'DE-TH': 'Thuringen',
    };

    if (isoCode && isoStateMap[isoCode]) {
      return isoStateMap[isoCode];
    }

    const rawValue = String(value || '').trim();
    if (!rawValue) {
      return null;
    }

    const countryCode = String(address?.country_code || '')
      .trim()
      .toLowerCase();
    if (countryCode && countryCode !== 'de') {
      return rawValue;
    }

    const normalizedKey = rawValue.toLowerCase();
    const germanStateAliasMap = {
      'baden-wurttemberg': 'Baden-Wurttemberg',
      'baden wurttemberg': 'Baden-Wurttemberg',
      'baden-wuerttemberg': 'Baden-Wurttemberg',
      'baden wuerttemberg': 'Baden-Wurttemberg',
      bavaria: 'Bayern',
      bayern: 'Bayern',
      [HEADER_WEATHER_BERLIN_ALIAS_KEY]: HEADER_WEATHER_BERLIN_LABEL,
      brandenburg: 'Brandenburg',
      bremen: 'Bremen',
      hamburg: 'Hamburg',
      hesse: 'Hessen',
      hessen: 'Hessen',
      'mecklenburg-vorpommern': 'Mecklenburg-Vorpommern',
      'mecklenburg vorpommern': 'Mecklenburg-Vorpommern',
      'lower saxony': 'Niedersachsen',
      niedersachsen: 'Niedersachsen',
      'north rhine-westphalia': 'Nordrhein-Westfalen',
      'north rhine westphalia': 'Nordrhein-Westfalen',
      'nordrhein-westfalen': 'Nordrhein-Westfalen',
      'nordrhein westfalen': 'Nordrhein-Westfalen',
      'rhineland-palatinate': 'Rheinland-Pfalz',
      'rhineland palatinate': 'Rheinland-Pfalz',
      'rheinland-pfalz': 'Rheinland-Pfalz',
      'rheinland pfalz': 'Rheinland-Pfalz',
      saarland: 'Saarland',
      saxony: 'Sachsen',
      sachsen: 'Sachsen',
      'saxony-anhalt': 'Sachsen-Anhalt',
      'saxony anhalt': 'Sachsen-Anhalt',
      'sachsen-anhalt': 'Sachsen-Anhalt',
      'sachsen anhalt': 'Sachsen-Anhalt',
      'schleswig-holstein': 'Schleswig-Holstein',
      'schleswig holstein': 'Schleswig-Holstein',
      thuringia: 'Thuringen',
      thuringen: 'Thuringen',
      'free state of saxony': 'Sachsen',
      'free state of bavaria': 'Bayern',
      'free state of thuringia': 'Thuringen',
      'freistaat sachsen': 'Sachsen',
      'freistaat bayern': 'Bayern',
      'freistaat thuringen': 'Thuringen',
      саксония: 'Sachsen',
      'нижняя саксония': 'Niedersachsen',
      тюрінгія: 'Thuringen',
      'ніжня саксонія': 'Niedersachsen',
      саксонія: 'Sachsen',
    };

    return germanStateAliasMap[normalizedKey] || rawValue;
  }

  async function fetchHeaderWeatherReverseGeoMeta(latitude, longitude) {
    const languageFallbacks = getHeaderWeatherLanguageFallbacks();

    for (const language of languageFallbacks) {
      const url = new URL(HEADER_WEATHER_REVERSE_GEOCODE_ENDPOINT);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('lat', String(latitude));
      url.searchParams.set('lon', String(longitude));
      url.searchParams.set('zoom', '18');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('layer', 'address');
      url.searchParams.set('accept-language', `${language},de,en`);

      try {
        const response = await fetch(url.toString(), {
          mode: 'cors',
          credentials: 'omit',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          continue;
        }

        const payload = await response.json();
        const address = payload?.address || null;
        const districtLabel = buildHeaderWeatherDistrictLabel(address);
        const regionLabel = normalizeHeaderWeatherGermanStateLabel(
          address?.state || address?.region || address?.state_district || address?.county || null,
          address
        );

        if (districtLabel || regionLabel) {
          return {
            districtLabel,
            regionLabel,
          };
        }
      } catch (_) {
        // Keep trying with next language fallback.
      }
    }

    return null;
  }

  function getHeaderWeatherDateInTimeZone(timeZone, referenceDate = new Date(getHeaderWeatherNowMs())) {
    try {
      const formatter = new window.Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(referenceDate).reduce((accumulator, part) => {
        if (part.type !== 'literal') {
          accumulator[part.type] = part.value;
        }
        return accumulator;
      }, {});
      if (parts.year && parts.month && parts.day) {
        return `${parts.year}-${parts.month}-${parts.day}`;
      }
    } catch (_) {
      // Fall through to the ISO fallback below.
    }

    return referenceDate.toISOString().slice(0, 10);
  }

  function getHeaderWeatherNowMs() {
    return Date.now() + (Number.isFinite(headerWeatherServerTimeOffsetMs) ? headerWeatherServerTimeOffsetMs : 0);
  }

  function getHeaderWeatherBrowserTimeZone() {
    try {
      const browserTimeZone = window.Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (typeof browserTimeZone === 'string' && browserTimeZone.includes('/')) {
        return browserTimeZone;
      }
    } catch (_) {
      // Ignore and use fallback chain.
    }

    return null;
  }

  function normalizeHeaderWeatherTimeZone(value) {
    const timeZone = String(value || '').trim();
    if (!timeZone) {
      return null;
    }

    try {
      // Intl with explicit timeZone validates IANA IDs and applies DST rules automatically.
      new window.Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(getHeaderWeatherNowMs()));
      return timeZone;
    } catch (_) {
      return null;
    }
  }

  function resolveHeaderWeatherTimeZone(host, locationMeta = null) {
    return (
      normalizeHeaderWeatherTimeZone(host?.__weatherTimeZone) ||
      normalizeHeaderWeatherTimeZone(host?.__weatherWidgetData?.location?.tz_id) ||
      normalizeHeaderWeatherTimeZone(host?.__weatherWidgetData?.location?.timezone) ||
      normalizeHeaderWeatherTimeZone(locationMeta?.timezone) ||
      getHeaderWeatherBrowserTimeZone() ||
      HEADER_WEATHER_DEFAULT_TIMEZONE
    );
  }

  function getHeaderWeatherTimeSources() {
    return [
      {
        id: 'origin-date-header',
        url: `${window.location.origin}/robots.txt`,
        method: 'HEAD',
        mode: 'same-origin',
        type: 'date-header',
      },
      {
        id: 'worldtimeapi-utc',
        url: 'https://worldtimeapi.org/api/timezone/Etc/UTC',
        method: 'GET',
        mode: 'cors',
        type: 'json-field',
        field: 'utc_datetime',
      },
      {
        id: 'timeapiio-utc',
        url: 'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
        method: 'GET',
        mode: 'cors',
        type: 'json-field',
        field: 'dateTime',
      },
    ];
  }

  function withHeaderWeatherTimeout(promise, timeoutMs = HEADER_WEATHER_TIME_SYNC_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const timerId = window.setTimeout(() => {
        reject(new Error('Header weather time sync timeout.'));
      }, timeoutMs);

      promise.then(
        value => {
          window.clearTimeout(timerId);
          resolve(value);
        },
        error => {
          window.clearTimeout(timerId);
          reject(error);
        }
      );
    });
  }

  async function fetchHeaderWeatherSourceTimeMs(source) {
    const separator = source.url.includes('?') ? '&' : '?';
    const requestUrl = `${source.url}${separator}_ts=${Date.now()}`;
    const requestStartedAt = Date.now();
    const response = await fetch(requestUrl, {
      method: source.method || 'GET',
      mode: source.mode || 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        Accept: 'application/json, text/plain, */*',
      },
    });
    const requestEndedAt = Date.now();

    if (!response.ok) {
      throw new Error(`Header weather time source failed with status ${response.status}.`);
    }

    let serverTimeMs = null;
    if (source.type === 'date-header') {
      const dateHeader = response.headers.get('date');
      if (dateHeader) {
        serverTimeMs = Date.parse(dateHeader);
      }
    } else if (source.type === 'json-field') {
      const payload = await response.json();
      const rawValue = payload?.[source.field];
      if (typeof rawValue === 'number') {
        serverTimeMs = rawValue > 1e12 ? rawValue : rawValue * 1000;
      } else if (typeof rawValue === 'string') {
        serverTimeMs = Date.parse(rawValue);
      }
    }

    if (!Number.isFinite(serverTimeMs)) {
      throw new Error(`Header weather time source ${source.id} returned invalid time.`);
    }

    const clientMidpointMs = requestStartedAt + (requestEndedAt - requestStartedAt) / 2;
    return serverTimeMs - clientMidpointMs;
  }

  async function syncHeaderWeatherClockWithServers(force = false) {
    const nowMs = Date.now();
    if (!force && nowMs - headerWeatherServerTimeSyncedAt < HEADER_WEATHER_TIME_SYNC_INTERVAL) {
      return;
    }

    const sources = getHeaderWeatherTimeSources();
    for (const source of sources) {
      try {
        const nextOffsetMs = await withHeaderWeatherTimeout(fetchHeaderWeatherSourceTimeMs(source));
        if (Math.abs(nextOffsetMs) <= HEADER_WEATHER_MAX_CLOCK_DRIFT_MS) {
          headerWeatherServerTimeOffsetMs = nextOffsetMs;
          headerWeatherServerTimeSyncedAt = Date.now();
          return;
        }
      } catch (_) {
        // Try the next source silently.
      }
    }
  }

  function formatHeaderWeatherLiveTime(timeZone) {
    try {
      return new window.Intl.DateTimeFormat('en-GB', {
        timeZone: timeZone || 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(getHeaderWeatherNowMs()));
    } catch (_) {
      return new window.Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(getHeaderWeatherNowMs()));
    }
  }

  function resolveHeaderWeatherDateLocale() {
    const lang = String(document.documentElement.lang || 'en')
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];

    if (lang === 'ru') {
      return 'ru-RU';
    }
    if (lang === 'uk') {
      return 'uk-UA';
    }
    if (lang === 'de') {
      return 'de-DE';
    }
    return 'en-GB';
  }

  function formatHeaderWeatherLiveWeekday(timeZone) {
    const locale = resolveHeaderWeatherDateLocale();
    try {
      const weekday = new window.Intl.DateTimeFormat(locale, {
        timeZone: timeZone || 'UTC',
        weekday: 'short',
      }).format(new Date(getHeaderWeatherNowMs()));

      const cleanedWeekday = String(weekday || '')
        .replace(/\.$/, '')
        .trim();

      if (!cleanedWeekday) {
        return '';
      }

      return cleanedWeekday.charAt(0).toUpperCase() + cleanedWeekday.slice(1);
    } catch (_) {
      return '';
    }
  }

  function buildHeaderWeatherMetaText(timeZone, regionLabel = '') {
    const liveTime = formatHeaderWeatherLiveTime(timeZone);
    const liveWeekday = formatHeaderWeatherLiveWeekday(timeZone);
    const region = String(regionLabel || '').trim();

    const chunks = [liveTime, liveWeekday, region].filter(Boolean);
    return chunks.join(' · ');
  }

  function getHeaderWeatherKnownWeekdayTokens(timeZone) {
    const locale = resolveHeaderWeatherDateLocale();
    const set = new Set();

    try {
      for (let dayOffset = -6; dayOffset <= 6; dayOffset += 1) {
        const date = new Date(getHeaderWeatherNowMs() + dayOffset * 86400000);
        const weekday = new window.Intl.DateTimeFormat(locale, {
          timeZone: timeZone || 'UTC',
          weekday: 'short',
        }).format(date);

        const normalized = String(weekday || '')
          .replace(/\.$/, '')
          .trim()
          .toLowerCase();

        if (normalized) {
          set.add(normalized);
        }
      }
    } catch (_) {
      // Keep an empty set when Intl/timeZone is unavailable.
    }

    return set;
  }

  function stripHeaderWeatherWeekdayTokens(text, timeZone) {
    const source = String(text || '').trim();
    if (!source) {
      return source;
    }

    const knownWeekdays = getHeaderWeatherKnownWeekdayTokens(timeZone);
    if (!knownWeekdays.size) {
      return source;
    }

    let result = source;
    const escapeRegExp = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Remove standalone weekday tokens regardless of separator style (· • , ; / - | space).
    knownWeekdays.forEach(token => {
      if (!token) {
        return;
      }

      const escaped = escapeRegExp(token);
      const tokenPattern = new RegExp(`(^|[\\s·•|,;:/-])${escaped}(?=\\.?($|[\\s·•|,;:/-]))`, 'giu');
      result = result.replace(tokenPattern, '$1');
    });

    // Normalize repeated separators/spaces after weekday removal.
    result = result
      .replace(/[\s]*[·•|][\s]*/g, ' · ')
      .replace(/[\s]*,[\s]*/g, ', ')
      .replace(/(?:\s*·\s*){2,}/g, ' · ')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s*[·•|,;:/-]+\s*/u, '')
      .replace(/\s*[·•|,;:/-]+\s*$/u, '')
      .trim();

    return result;
  }

  function rewriteHeaderWeatherTimeText(text, liveTime, timeZone) {
    if (!text || !liveTime) {
      return text;
    }

    const sanitizedText = stripHeaderWeatherWeekdayTokens(text, timeZone);

    if (/^\s*\d{1,2}:\d{2}/.test(sanitizedText)) {
      return sanitizedText.replace(/^\s*\d{1,2}:\d{2}/, liveTime);
    }

    return sanitizedText.replace(/\d{1,2}:\d{2}/, liveTime);
  }

  function syncHeaderWeatherLiveClock(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    const timeZone = resolveHeaderWeatherTimeZone(host);
    const liveTime = formatHeaderWeatherLiveTime(timeZone);
    const liveWeekday = formatHeaderWeatherLiveWeekday(timeZone);
    const forcedRegionLabel = String(host?.dataset?.weatherRegionLabel || '').trim();
    const timeNodes = root.querySelectorAll(
      '.weather-header-card__meta, .weather-header-dropdown__hero-meta, .weather-header-dropdown__hero-copy span'
    );

    timeNodes.forEach(node => {
      if (!node) {
        return;
      }

      if (
        forcedRegionLabel &&
        (node.classList.contains('weather-header-card__meta') ||
          node.classList.contains('weather-header-dropdown__hero-meta'))
      ) {
        const nextForcedText = buildHeaderWeatherMetaText(timeZone, forcedRegionLabel);
        if (nextForcedText !== node.textContent) {
          node.textContent = nextForcedText;
        }
        return;
      }

      const nextText = rewriteHeaderWeatherTimeText(
        node.textContent || '',
        liveWeekday ? `${liveTime} · ${liveWeekday}` : liveTime,
        timeZone
      );
      if (nextText && nextText !== node.textContent) {
        node.textContent = nextText;
      }
    });
  }

  function shiftHeaderWeatherDate(dateString, dayOffset) {
    const date = new Date(`${dateString}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return date.toISOString().slice(0, 10);
  }

  function clampHeaderWeatherValue(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function resolveHeaderWeatherOrbFixedLayout(kind, variant) {
    if (variant === 'preview') {
      return kind === 'moon' ? { ...HEADER_WEATHER_MOON_PREVIEW_LAYOUT } : { ...HEADER_WEATHER_SUN_PREVIEW_LAYOUT };
    }

    if (variant === 'dropdown') {
      return kind === 'moon' ? { ...HEADER_WEATHER_MOON_DROPDOWN_LAYOUT } : { ...HEADER_WEATHER_SUN_DROPDOWN_LAYOUT };
    }

    return null;
  }

  function getHeaderWeatherFallbackOrbKind(host) {
    const hour = getHeaderWeatherHour(host);
    const fallbackHour = typeof hour === 'number' ? hour : new Date(getHeaderWeatherNowMs()).getHours();
    return fallbackHour >= 19 || fallbackHour < 6 ? 'moon' : 'sun';
  }

  function getHeaderWeatherFallbackOrbProgress(host, kind) {
    const hour = getHeaderWeatherHour(host);
    const fallbackHour = typeof hour === 'number' ? hour : new Date(getHeaderWeatherNowMs()).getHours();

    if (kind === 'sun') {
      return clampHeaderWeatherValue((fallbackHour - 6) / 12, 0, 1);
    }

    const nightHour = fallbackHour >= 19 ? fallbackHour - 19 : fallbackHour + 5;
    return clampHeaderWeatherValue(nightHour / 11, 0, 1);
  }

  function getHeaderWeatherHour(host) {
    const metaText = host?.shadowRoot?.querySelector('.weather-header-card__meta')?.textContent || '';
    const match = metaText.match(/(\d{1,2}):(\d{2})/);
    if (!match) {
      return null;
    }

    const hour = Number(match[1]);
    return Number.isFinite(hour) ? hour : null;
  }

  function getHeaderWeatherConditionPlainText(conditionEl) {
    if (!(conditionEl instanceof HTMLElement)) {
      return '';
    }

    const lineNodes = Array.from(
      conditionEl.querySelectorAll('.weather-header-card__condition-line, .weather-header-dropdown__condition-line')
    );
    if (lineNodes.length) {
      return lineNodes
        .map(line => (line.textContent || '').trim())
        .filter(Boolean)
        .join(' ');
    }

    return (conditionEl.innerText || conditionEl.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function getHeaderWeatherConditionText(host) {
    const conditionEl = host?.shadowRoot?.querySelector('.weather-header-card__condition');
    return getHeaderWeatherConditionPlainText(conditionEl).toLowerCase();
  }

  function buildHeaderWeatherConditionLineTexts(raw, langCode = (document.documentElement.lang || 'ru').toLowerCase()) {
    const normalized = String(raw || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) {
      return [];
    }

    const upper = normalized.toLocaleUpperCase(langCode);
    const words = upper.split(' ').filter(Boolean);
    if (words.length >= 2) {
      const splitAt = words.length === 2 ? 1 : Math.ceil(words.length / 2);
      const firstLine = words.slice(0, splitAt).join(' ');
      const secondLine = words.slice(splitAt).join(' ');
      return [firstLine, secondLine].filter(Boolean);
    }

    return [upper];
  }

  function applyHeaderWeatherConditionTypography(condition, rawText) {
    if (!(condition instanceof HTMLElement)) {
      return;
    }

    const langCode = (document.documentElement.lang || 'ru').toLowerCase();
    const raw =
      typeof rawText === 'string' && rawText.trim()
        ? rawText.replace(/\s+/g, ' ').trim()
        : getHeaderWeatherConditionPlainText(condition);
    const lines = buildHeaderWeatherConditionLineTexts(raw, langCode);
    if (!lines.length) {
      return;
    }

    const renderLine = (text, className) => {
      const line = document.createElement('span');
      line.className = className;
      line.textContent = text;
      return line;
    };

    condition.replaceChildren(...lines.map(text => renderLine(text, 'weather-header-card__condition-line')));

    const conditionFontSizePx = 8;
    const conditionLineHeightPx = Math.max(conditionFontSizePx + 1, Math.round(conditionFontSizePx * 1.2 * 100) / 100);

    condition.style.setProperty('display', 'flex', 'important');
    condition.style.setProperty('flex-direction', 'column', 'important');
    condition.style.setProperty('align-items', 'flex-end', 'important');
    condition.style.setProperty('justify-content', 'flex-start', 'important');
    condition.style.setProperty('gap', '0', 'important');
    condition.style.setProperty('font-size', `${conditionFontSizePx}px`, 'important');
    condition.style.setProperty('line-height', `${conditionLineHeightPx}px`, 'important');
    condition.style.setProperty('font-weight', '600', 'important');
    condition.style.setProperty('letter-spacing', '0', 'important');
    condition.style.setProperty('text-transform', 'none', 'important');
    condition.style.setProperty('white-space', 'normal', 'important');
    condition.style.setProperty('text-align', 'right', 'important');
    condition.style.setProperty('max-width', 'var(--header-weather-metrics-min-width, 9.5rem)', 'important');
    condition.style.setProperty('min-width', '0', 'important');
    condition.style.setProperty('min-height', '0', 'important');
    condition.style.setProperty('height', 'auto', 'important');
    condition.style.setProperty('flex', '0 0 auto', 'important');
    condition.style.setProperty('overflow', 'visible', 'important');
  }

  function applyHeaderWeatherDropdownConditionTypography(conditionNode, rawText) {
    if (!(conditionNode instanceof HTMLElement)) {
      return;
    }

    const langCode = (document.documentElement.lang || 'ru').toLowerCase();
    const raw =
      typeof rawText === 'string' && rawText.trim()
        ? rawText.replace(/\s+/g, ' ').trim()
        : getHeaderWeatherConditionPlainText(conditionNode);
    const lines = buildHeaderWeatherConditionLineTexts(raw, langCode);
    if (!lines.length) {
      return;
    }

    const renderLine = text => {
      const line = document.createElement('span');
      line.className = 'weather-header-dropdown__condition-line';
      line.textContent = text;
      return line;
    };

    conditionNode.replaceChildren(...lines.map(renderLine));
    conditionNode.style.setProperty('display', 'flex', 'important');
    conditionNode.style.setProperty('flex-direction', 'column', 'important');
    conditionNode.style.setProperty('align-items', 'flex-start', 'important');
    conditionNode.style.setProperty('justify-content', 'flex-start', 'important');
    conditionNode.style.setProperty('gap', '2px', 'important');
    conditionNode.style.setProperty('margin', '0', 'important');
    conditionNode.style.setProperty('padding', '0', 'important');
    conditionNode.style.setProperty('text-align', 'left', 'important');
    conditionNode.style.setProperty('max-width', '100%', 'important');
    conditionNode.style.setProperty('white-space', 'normal', 'important');
  }

  function getHeaderWeatherConditionCode(host) {
    const conditionCode = Number(
      host?.__weatherCurrentMeta?.weatherCode ??
        host?.dataset?.weatherCode ??
        host?.__weatherWidgetData?.current?.condition?.code
    );
    return Number.isFinite(conditionCode) ? conditionCode : null;
  }

  function resolveHeaderWeatherConditionLabel(host) {
    const conditionCode = getHeaderWeatherConditionCode(host);
    if (conditionCode === null) {
      return '';
    }

    const lang = getHeaderWeatherPressureLang(host);
    const labels = {
      ru: {
        clear: 'Ясно',
        partly: 'Переменная облачность',
        cloudy: 'Облачно',
        overcast: 'Пасмурно',
        fog: 'Туман',
        drizzle: 'Морось',
        rain: 'Дождь',
        showers: 'Ливни',
        snow: 'Снег',
        thunder: 'Гроза',
      },
      uk: {
        clear: 'Ясно',
        partly: 'Мінлива хмарність',
        cloudy: 'Хмарно',
        overcast: 'Похмуро',
        fog: 'Туман',
        drizzle: 'Мряка',
        rain: 'Дощ',
        showers: 'Зливи',
        snow: 'Сніг',
        thunder: 'Гроза',
      },
      de: {
        clear: 'Klar',
        partly: 'Teilweise bewölkt',
        cloudy: 'Bewölkt',
        overcast: 'Bedeckt',
        fog: 'Nebel',
        drizzle: 'Nieselregen',
        rain: 'Regen',
        showers: 'Regenschauer',
        snow: 'Schnee',
        thunder: 'Gewitter',
      },
      en: {
        clear: 'Clear',
        partly: 'Partly cloudy',
        cloudy: 'Cloudy',
        overcast: 'Overcast',
        fog: 'Fog',
        drizzle: 'Drizzle',
        rain: 'Rain',
        showers: 'Rain showers',
        snow: 'Snow',
        thunder: 'Thunderstorm',
      },
    };

    const dict = labels[lang] || labels.ru;
    const wmoCode = conditionCode <= 99 ? conditionCode : null;

    if (wmoCode !== null) {
      if (wmoCode === 0) return dict.clear;
      if (wmoCode === 1) return dict.clear;
      if (wmoCode === 2) return dict.partly;
      if (wmoCode === 3) return dict.overcast;
      if (wmoCode === 45 || wmoCode === 48) return dict.fog;
      if ([51, 53, 55, 56, 57].includes(wmoCode)) return dict.drizzle;
      if ([61, 63, 65, 66, 67].includes(wmoCode)) return dict.rain;
      if ([80, 81, 82].includes(wmoCode)) return dict.showers;
      if ([71, 73, 75, 77, 85, 86].includes(wmoCode)) return dict.snow;
      if ([95, 96, 99].includes(wmoCode)) return dict.thunder;
      return dict.cloudy;
    }

    const isPartlyCloudyCode = conditionCode === 1003 || conditionCode === 2;
    const isCloudyCode = conditionCode === 1006;
    const isOvercastCode = conditionCode === 1009 || conditionCode === 3;
    const isFogCode = conditionCode === 1030 || conditionCode === 45 || conditionCode === 48;
    const isShowerCode = conditionCode === 1240 || (conditionCode >= 80 && conditionCode <= 82);
    const isRainCode = [1153, 1183].includes(conditionCode) || (conditionCode >= 61 && conditionCode <= 67);
    const isSnowCode = conditionCode === 1210 || (conditionCode >= 71 && conditionCode <= 77);
    const isThunderCode = conditionCode === 1273 || (conditionCode >= 95 && conditionCode <= 99);

    if (isThunderCode) return dict.thunder;
    if (isSnowCode) return dict.snow;
    if (isShowerCode) return dict.showers;
    if (isRainCode) return dict.rain;
    if (isFogCode) return dict.fog;
    if (isOvercastCode) return dict.overcast;
    if (isCloudyCode) return dict.cloudy;
    if (isPartlyCloudyCode) return dict.partly;
    return dict.clear;
  }

  function getHeaderWeatherReadingCopy(host) {
    const lang = getHeaderWeatherPressureLang(host);
    const copyByLang = {
      ru: { feels: 'Ощущается', wind: 'Ветер', humidity: 'Влажность', updated: 'Обновлено' },
      uk: { feels: 'Відчувається', wind: 'Вітер', humidity: 'Вологість', updated: 'Оновлено' },
      de: { feels: 'Gefühlt', wind: 'Wind', humidity: 'Luftfeuchte', updated: 'Aktualisiert' },
      en: { feels: 'Feels like', wind: 'Wind', humidity: 'Humidity', updated: 'Updated' },
    };

    return copyByLang[lang] || copyByLang.ru;
  }

  function parseHeaderWeatherNumericToken(text) {
    const normalized = String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const match = normalized.match(/(-?\d{1,3}(?:[.,]\d+)?)/);
    if (!match) {
      return null;
    }

    const value = Number(match[1].replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }

  function normalizeHeaderWeatherHumidityValue(value) {
    if (typeof value === 'string') {
      const match = value.match(/(\d{1,3})\s*%/);
      if (!match) {
        return null;
      }
      const humidity = Number(match[1]);
      if (!Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
        return null;
      }
      return `${Math.round(humidity)}%`;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
      return null;
    }

    return `${Math.round(numericValue)}%`;
  }

  function readHeaderWeatherReadingsCache(host) {
    if (!host) {
      return null;
    }

    if (host.__weatherReadingsCacheLoaded) {
      return host.__weatherReadingsCache || null;
    }

    host.__weatherReadingsCacheLoaded = true;

    try {
      const raw = localStorage.getItem(HEADER_WEATHER_READINGS_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const payload = JSON.parse(raw);
      const expiresAt = Number(payload?.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        localStorage.removeItem(HEADER_WEATHER_READINGS_STORAGE_KEY);
        return null;
      }

      host.__weatherReadingsCache = {
        humidity: normalizeHeaderWeatherHumidityValue(payload?.humidity),
        pressureMmHg:
          Number.isFinite(Number(payload?.pressureMmHg)) && Number(payload.pressureMmHg) > 0
            ? Math.round(Number(payload.pressureMmHg))
            : null,
        updatedAt: Number(payload?.updatedAt) || Date.now(),
      };

      return host.__weatherReadingsCache;
    } catch {
      return null;
    }
  }

  function writeHeaderWeatherReadingsCache(host, nextValues) {
    if (!host || !nextValues || typeof nextValues !== 'object') {
      return;
    }

    const previous = readHeaderWeatherReadingsCache(host) || {};
    const humidity =
      nextValues.humidity === undefined
        ? previous.humidity || null
        : normalizeHeaderWeatherHumidityValue(nextValues.humidity);

    const pressureMmHg =
      nextValues.pressureMmHg === undefined
        ? previous.pressureMmHg || null
        : Number.isFinite(Number(nextValues.pressureMmHg)) && Number(nextValues.pressureMmHg) > 0
          ? Math.round(Number(nextValues.pressureMmHg))
          : null;

    const payload = {
      humidity,
      pressureMmHg,
      updatedAt: Date.now(),
      expiresAt: Date.now() + HEADER_WEATHER_READINGS_CACHE_TTL,
    };

    host.__weatherReadingsCacheLoaded = true;
    host.__weatherReadingsCache = payload;

    try {
      localStorage.setItem(HEADER_WEATHER_READINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures (private mode / quota).
    }
  }

  function hydrateHeaderWeatherReadingsFromCache(host) {
    if (!host) {
      return;
    }

    const cached = readHeaderWeatherReadingsCache(host);
    if (!cached) {
      return;
    }

    if (!host.__weatherHumidityValue && cached.humidity) {
      host.__weatherHumidityValue = cached.humidity;
    }

    if (
      (!Number.isFinite(Number(host.__weatherPressureMmHg)) || Number(host.__weatherPressureMmHg) <= 0) &&
      Number.isFinite(Number(cached.pressureMmHg)) &&
      Number(cached.pressureMmHg) > 0
    ) {
      host.__weatherPressureMmHg = Math.round(Number(cached.pressureMmHg));
      host.__weatherPressureValue = formatHeaderWeatherPressureValue(host, host.__weatherPressureMmHg);
    }
  }

  function extractHeaderWeatherReadingsFromHost(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return null;
    }

    const tempNode = root.querySelector('.weather-header-card__temperature-value');
    const temp = parseHeaderWeatherNumericToken(tempNode?.textContent);
    const condition = getHeaderWeatherConditionPlainText(root.querySelector('.weather-header-card__condition'));
    const meta = root.querySelector('.weather-header-card__meta')?.textContent?.trim() || '';
    const chipNodes = Array.from(root.querySelectorAll('.weather-header-card__chip'));
    const findChip = pattern => chipNodes.find(chip => pattern.test((chip.textContent || '').replace(/\s+/g, ' ')));

    const feelsChip = findChip(/gef|ощущ|feels|відчува/i);
    const windChip = findChip(/wind|ветер|вітер/i);
    const humidityChip = findChip(/humid|влаж|feucht|волог|umid|humedad/i);
    const pressureChip = findChip(/pressure|давлен|тиск|druck|presion/i);

    const feelsValue = parseHeaderWeatherNumericToken(
      feelsChip?.querySelector('strong')?.textContent || feelsChip?.textContent
    );
    const windText = (windChip?.textContent || '').replace(/\s+/g, ' ').trim();
    const windMatch = windText.match(/(-?\d{1,3}(?:[.,]\d+)?)\s*(km\/h|км\/ч|mph)?/i);
    const humidityMatch = (humidityChip?.textContent || '').match(/(\d{1,3})\s*%/);
    const pressureText = (pressureChip?.textContent || '').replace(/\s+/g, ' ').trim();

    if (temp === null && !condition && feelsValue === null && !windMatch && !humidityMatch) {
      return null;
    }

    return {
      temp: temp === null ? null : Math.round(temp),
      condition,
      meta,
      feels: feelsValue === null ? null : formatHeaderWeatherCelsiusText(feelsValue),
      wind: windMatch ? `${Math.round(Number(windMatch[1].replace(',', '.')))} ${windMatch[2] || 'km/h'}` : null,
      humidity: humidityMatch ? `${humidityMatch[1]}%` : null,
      pressure: pressureText || null,
      source: 'widget-preview',
    };
  }

  function buildHeaderWeatherReadingsFromMeta(host) {
    const meta = host?.__weatherCurrentMeta;
    if (!meta) {
      return null;
    }

    const temp = Number(meta.temperature);
    const feels = Number(meta.apparentTemperature);
    const wind = Number(meta.windSpeedKph);
    const humidity = Number(meta.humidity);
    const pressureMmHg =
      Number.isFinite(Number(meta.pressureMmHg)) && Number(meta.pressureMmHg) > 0
        ? Number(meta.pressureMmHg)
        : Number.isFinite(Number(meta.surfacePressure)) && Number(meta.surfacePressure) > 0
          ? Math.round(Number(meta.surfacePressure) * 0.750061683)
          : Number.isFinite(Number(meta.pressureMsl)) && Number(meta.pressureMsl) > 0
            ? Math.round(Number(meta.pressureMsl) * 0.750061683)
            : null;

    const condition = resolveHeaderWeatherConditionLabel(host);
    if (
      !Number.isFinite(temp) &&
      !condition &&
      !Number.isFinite(feels) &&
      !Number.isFinite(wind) &&
      !Number.isFinite(humidity)
    ) {
      return null;
    }

    return {
      temp: Number.isFinite(temp) ? Math.round(temp) : null,
      condition: condition || '',
      meta: '',
      feels: Number.isFinite(feels) ? formatHeaderWeatherCelsiusText(feels) : null,
      wind: Number.isFinite(wind) ? `${Math.round(wind)} km/h` : null,
      humidity: Number.isFinite(humidity) ? `${Math.round(humidity)}%` : null,
      pressure: pressureMmHg === null ? null : formatHeaderWeatherPressureValue(host, pressureMmHg),
      source: 'open-meteo-meta',
    };
  }

  function resolveHeaderWeatherReadings(host) {
    hydrateHeaderWeatherReadingsFromCache(host);

    const widgetReadings = extractHeaderWeatherReadingsFromHost(host);
    const fallbackReadings = buildHeaderWeatherReadingsFromMeta(host);
    const resolvedReadings = widgetReadings || fallbackReadings;

    if (!resolvedReadings) {
      return null;
    }

    if (!resolvedReadings.humidity) {
      resolvedReadings.humidity = normalizeHeaderWeatherHumidityValue(host?.__weatherHumidityValue);
    }

    if (!resolvedReadings.pressure && Number.isFinite(Number(host?.__weatherPressureMmHg))) {
      resolvedReadings.pressure = formatHeaderWeatherPressureValue(host, Number(host.__weatherPressureMmHg));
    }

    return resolvedReadings;
  }

  function applyHeaderWeatherDropdownReadings(host, readings) {
    const root = host?.shadowRoot;
    if (!root || !readings) {
      return false;
    }

    const copy = getHeaderWeatherReadingCopy(host);
    let changed = false;

    const heroTempValue = root.querySelector('.weather-header-dropdown__hero-temp span');
    if (
      heroTempValue &&
      readings.temp !== null &&
      Number(readings.temp) !== parseHeaderWeatherNumericToken(heroTempValue.textContent)
    ) {
      heroTempValue.textContent = String(readings.temp);
      changed = true;
    }

    const conditionNode = root.querySelector('.weather-header-dropdown__hero-copy strong');
    const nextConditionText = (readings.condition || '').replace(/\s+/g, ' ').trim();
    if (conditionNode instanceof HTMLElement && nextConditionText) {
      const currentConditionText = getHeaderWeatherConditionPlainText(conditionNode);
      if (currentConditionText !== nextConditionText) {
        applyHeaderWeatherDropdownConditionTypography(conditionNode, nextConditionText);
        changed = true;
      }
    }

    const updatedNode = root.querySelector('.weather-header-dropdown__hero-copy span');
    if (updatedNode && readings.meta && updatedNode.textContent?.trim() !== readings.meta) {
      const updatedPrefix = `${copy.updated}:`;
      if (readings.meta.toLowerCase().includes(copy.updated.toLowerCase())) {
        updatedNode.textContent = readings.meta;
      } else {
        updatedNode.textContent = `${updatedPrefix} ${readings.meta}`;
      }
      changed = true;
    }

    const dropdownChips = Array.from(root.querySelectorAll('.weather-header-dropdown__hero-chips span'));
    const applyChip = (pattern, value, label) => {
      if (!value) {
        return;
      }

      const chip = dropdownChips.find(node => pattern.test(node.textContent || ''));
      if (!chip) {
        return;
      }

      const nextText = `${label}: ${value}`;
      if (chip.textContent?.trim() !== nextText) {
        chip.textContent = nextText;
        changed = true;
      }
    };

    applyChip(/gef|ощущ|feels|відчува/i, readings.feels, copy.feels);
    applyChip(/wind|ветер|вітер/i, readings.wind, copy.wind);
    applyChip(/humid|влаж|feucht|волог|umid|humedad/i, readings.humidity, copy.humidity);

    return changed;
  }

  function syncHeaderWeatherUnifiedReadings(host) {
    if (!host?.shadowRoot) {
      return;
    }

    const readings = resolveHeaderWeatherReadings(host);
    if (!readings) {
      return;
    }

    host.__weatherReadingsSnapshot = readings;
    applyHeaderWeatherDropdownReadings(host, readings);
    const dropdownConditionNode = host.shadowRoot?.querySelector('.weather-header-dropdown__hero-copy strong');
    if (dropdownConditionNode instanceof HTMLElement && readings.condition) {
      applyHeaderWeatherDropdownConditionTypography(dropdownConditionNode, readings.condition);
    }
    normalizeHeaderWeatherCelsiusUnits(host);
    applyHeaderWeatherTextReadability(host, host.__weatherOrbAtmosphere || null);

    if (Number.isFinite(readings.temp)) {
      host.dataset.weatherTemp = String(readings.temp);
    }
    if (readings.condition) {
      host.dataset.weatherCondition = readings.condition;
    }
    if (readings.humidity) {
      host.__weatherHumidityValue = readings.humidity;
      writeHeaderWeatherReadingsCache(host, { humidity: readings.humidity });
    }
    if (readings.pressure) {
      const pressureMmHg = parseHeaderWeatherNumericToken(readings.pressure);
      if (pressureMmHg !== null) {
        host.__weatherPressureMmHg = pressureMmHg;
        host.__weatherPressureValue = readings.pressure;
        writeHeaderWeatherReadingsCache(host, { pressureMmHg });
      }
    }
  }

  function scheduleHeaderWeatherReadingsSync(host) {
    if (!host) {
      return;
    }

    if (host.__weatherReadingsSyncFrameScheduled) {
      host.__weatherReadingsSyncPending = true;
      return;
    }

    host.__weatherReadingsSyncFrameScheduled = true;
    window.requestAnimationFrame(() => {
      host.__weatherReadingsSyncFrameScheduled = false;
      syncHeaderWeatherUnifiedReadings(host);
      if (host.__weatherReadingsSyncPending) {
        host.__weatherReadingsSyncPending = false;
        scheduleHeaderWeatherReadingsSync(host);
      }
    });
  }

  function bindHeaderWeatherReadingsObserver(host) {
    if (!host?.shadowRoot || host.__weatherReadingsObserver) {
      return;
    }

    const observer = new MutationObserver(mutations => {
      const shouldSync = mutations.some(mutation => {
        if (mutation.type === 'characterData') {
          return true;
        }

        if (mutation.type !== 'childList') {
          return false;
        }

        const target = mutation.target;
        return (
          target instanceof Element &&
          (target.matches?.(
            '.weather-header-card__temperature, .weather-header-card__condition, .weather-header-card__meta, .weather-header-card__chips, .weather-header-dropdown__hero-temp, .weather-header-dropdown__hero-copy, .weather-header-dropdown__hero-chips'
          ) ||
            target.closest?.(
              '.weather-header-card__temperature, .weather-header-card__condition, .weather-header-card__meta, .weather-header-card__chips, .weather-header-dropdown__hero-temp, .weather-header-dropdown__hero-copy, .weather-header-dropdown__hero-chips'
            ))
        );
      });

      if (shouldSync) {
        scheduleHeaderWeatherReadingsSync(host);
      }
    });

    observer.observe(host.shadowRoot, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    host.__weatherReadingsObserver = observer;
  }

  function getHeaderWeatherPressureLang(host) {
    return normalizeLangCode(
      host?.__weatherLocale || host?.dataset?.weatherLocale || document.documentElement.lang || 'ru'
    );
  }

  function getHeaderWeatherPressureUnitText(host) {
    const lang = getHeaderWeatherPressureLang(host);
    const unitByLang = {
      ru: 'мм рт. ст.',
      uk: 'мм рт. ст.',
      de: 'mmHg',
      en: 'mmHg',
    };

    return unitByLang[lang] || unitByLang.ru;
  }

  /** Main preview temperature value (e.g. "20") — aligned to reference preview composition. */
  const HEADER_WEATHER_TEMP_VALUE_SIZE_PX = 34;

  /** °C suffix scale — compact superscript look that matches the reference crop. */
  const HEADER_WEATHER_CELSIUS_UNIT_FONT_EM = 0.46;
  /** Fine-tuned upward nudge: keep °C near the upper-right corner, but not above it. */
  const HEADER_WEATHER_CELSIUS_UNIT_BASELINE_OFFSET_EM = -0.92;
  /** Subtle right shift so °C sits to the upper-right of the digit, not directly above it. */
  const HEADER_WEATHER_CELSIUS_UNIT_RIGHT_SHIFT_EM = 0.03;
  /** Prevent feels-like unit from becoming unreadably tiny in ultra-compact fallback layouts. */
  const HEADER_WEATHER_CELSIUS_FEELS_UNIT_MIN_PX = 4.8;

  /** Canonical Celsius suffix on site: number immediately followed by U+00B0 + Latin C — e.g. "19°C". */
  const HEADER_WEATHER_CELSIUS_SUFFIX = '\u00b0C';

  function stampHeaderWeatherCelsiusUnitTypography(unitNode) {
    if (!(unitNode instanceof HTMLElement)) {
      return;
    }

    unitNode.style.setProperty('display', 'inline-block', 'important');
    unitNode.style.setProperty('font-size', `${HEADER_WEATHER_CELSIUS_UNIT_FONT_EM}em`, 'important');
    unitNode.style.setProperty('line-height', '1', 'important');
    unitNode.style.setProperty('letter-spacing', '0', 'important');
    unitNode.style.setProperty('transform', 'none', 'important');
    unitNode.style.setProperty('margin', '0', 'important');
    unitNode.style.setProperty('padding', '0', 'important');
    unitNode.style.setProperty('opacity', '0.9', 'important');
    unitNode.style.setProperty('white-space', 'nowrap', 'important');
    unitNode.style.setProperty('vertical-align', 'baseline', 'important');

    if (unitNode.classList.contains('weather-header-card__feels-temp-unit')) {
      const parentFontSize = parseFloat(getComputedStyle(unitNode.parentElement || unitNode).fontSize || '0');
      const targetSizePx = parentFontSize * HEADER_WEATHER_CELSIUS_UNIT_FONT_EM;
      if (
        Number.isFinite(targetSizePx) &&
        targetSizePx > 0 &&
        targetSizePx < HEADER_WEATHER_CELSIUS_FEELS_UNIT_MIN_PX
      ) {
        unitNode.style.setProperty('font-size', `${HEADER_WEATHER_CELSIUS_FEELS_UNIT_MIN_PX}px`, 'important');
      }
    }
  }

  function syncHeaderWeatherCelsiusUnitTopToDigit(unitNode, numberNode) {
    if (!(unitNode instanceof HTMLElement) || !(numberNode instanceof HTMLElement)) {
      return;
    }

    stampHeaderWeatherCelsiusUnitTypography(unitNode);
    numberNode.style.setProperty('display', 'inline-block', 'important');
    numberNode.style.setProperty('line-height', '1', 'important');
    numberNode.style.setProperty('vertical-align', 'baseline', 'important');
    unitNode.style.setProperty('vertical-align', 'baseline', 'important');

    const offsetEm = HEADER_WEATHER_CELSIUS_UNIT_BASELINE_OFFSET_EM;
    const rightShiftEm = HEADER_WEATHER_CELSIUS_UNIT_RIGHT_SHIFT_EM;
    unitNode.style.setProperty(
      'transform',
      offsetEm || rightShiftEm ? `translate(${rightShiftEm}em, ${offsetEm}em)` : 'none',
      'important'
    );

    const digitRect = numberNode.getBoundingClientRect();
    const unitRect = unitNode.getBoundingClientRect();
    if (!digitRect.height || !unitRect.height) {
      return;
    }

    const maxUnitTopPx = Math.round(digitRect.top + 1.2);
    if (unitRect.top < maxUnitTopPx - 0.5) {
      const downPx = Math.round((maxUnitTopPx - unitRect.top) * 10) / 10;
      unitNode.style.setProperty(
        'transform',
        offsetEm || rightShiftEm
          ? `translate(${rightShiftEm}em, ${offsetEm}em) translateY(${downPx}px)`
          : `translateY(${downPx}px)`,
        'important'
      );
    }
  }

  function isHeaderWeatherCelsiusUnitText(text) {
    return /(?:°|\u00b0)\s*C/i.test(String(text || '').trim());
  }

  /** Feels-like secondary temp (18/19) — 1px smaller than scaled main reference. */
  const HEADER_WEATHER_FEELS_TEMP_SHRINK_PX = 1;
  const HEADER_WEATHER_FEELS_TEMP_LETTER_SPACING_EM = 0.04;
  const HEADER_WEATHER_FEELS_MUTED_COLOR = 'rgb(255 246 228 / 0.55)';

  /**
   * Reference preset for the compact block:
   * 1) "ОЩУЩАЕТСЯ" right-aligned to geolocation label edge
   * 2) "КАК" pinned left, "28°C" pinned right in the same row
   * Keep this object as a single customization point for future tuning.
   */
  const HEADER_WEATHER_FEELS_REFERENCE_PRESET = Object.freeze({
    id: 'reference-v1',
    rowLayout: 'inline-tight',
    compactAnchorOffsetPx: 3,
    desktopAnchorOffsetPx: 1,
    rowGapPx: 2,
    // Optical compensation by locale so temperature end visually lands at label end.
    localeWidthNudgePx: Object.freeze({
      ru: 0.8,
      uk: 0.9,
      de: 0.6,
      en: 0.5,
    }),
  });

  function fitHeaderWeatherInlineTextWidth(node, maxWidthPx, minFontSizePx = 3.8) {
    if (!(node instanceof HTMLElement) || !Number.isFinite(maxWidthPx) || maxWidthPx <= 0) {
      return;
    }

    const computed = window.getComputedStyle(node);
    let fontSize = Number.parseFloat(computed.fontSize) || 0;
    let lineHeight = Number.parseFloat(computed.lineHeight) || 0;
    let letterSpacing = Number.parseFloat(computed.letterSpacing) || 0;
    let guard = 0;

    while (guard < 20 && node.getBoundingClientRect().width > maxWidthPx + 0.5 && fontSize > minFontSizePx) {
      fontSize = Number(Math.max(minFontSizePx, fontSize - 0.2).toFixed(2));
      lineHeight = Number(Math.max(minFontSizePx + 0.2, lineHeight - 0.2).toFixed(2));
      letterSpacing = Number(Math.max(0, letterSpacing - 0.02).toFixed(3));
      node.style.setProperty('font-size', `${fontSize}px`, 'important');
      node.style.setProperty('line-height', `${lineHeight}px`, 'important');
      node.style.setProperty('letter-spacing', `${letterSpacing}px`, 'important');
      guard += 1;
    }
  }

  function applyHeaderWeatherFeelsReferencePresetLayout({ feelsLikeChip, valueEl, labelBox, lang }) {
    if (!(feelsLikeChip instanceof HTMLElement) || !(valueEl instanceof HTMLElement) || !labelBox?.width) {
      return;
    }

    const langCode = normalizeLangCode(lang || document.documentElement.lang || 'ru');
    const nudgeMultiplier = HEADER_WEATHER_FEELS_REFERENCE_PRESET.localeWidthNudgePx[langCode] || 0.8;
    const baselineWidthPx = 52.5 + nudgeMultiplier;
    const blockWidthPx = Math.max(1, Math.round(Number(baselineWidthPx) * 10) / 10);

    feelsLikeChip.dataset.weatherFeelsPreset = HEADER_WEATHER_FEELS_REFERENCE_PRESET.id;
    feelsLikeChip.dataset.weatherFeelsRowLayout = HEADER_WEATHER_FEELS_REFERENCE_PRESET.rowLayout;
    feelsLikeChip.dataset.weatherFeelsLang = langCode;
    feelsLikeChip.style.setProperty('width', `${blockWidthPx}px`, 'important');
    feelsLikeChip.style.setProperty('min-width', `${blockWidthPx}px`, 'important');
    feelsLikeChip.style.setProperty('max-width', `${blockWidthPx}px`, 'important');

    valueEl.style.setProperty('width', `${blockWidthPx}px`, 'important');
    valueEl.style.setProperty('min-width', `${blockWidthPx}px`, 'important');
    valueEl.style.setProperty('max-width', `${blockWidthPx}px`, 'important');
    valueEl.style.setProperty('justify-content', 'space-between', 'important');
    valueEl.style.setProperty('column-gap', '0', 'important');

    // Keep the feels-like right edge optically aligned with the geolocation block right edge.
    const chipRect = feelsLikeChip.getBoundingClientRect();
    if (chipRect.width > 0) {
      const titleRightEdge = Number(labelBox.left) + Number(labelBox.width);
      const edgeDelta = titleRightEdge - Number(chipRect.right);
      if (Number.isFinite(edgeDelta)) {
        const currentMarginLeft = Number.parseFloat(window.getComputedStyle(feelsLikeChip).marginLeft || '0') || 0;
        const targetMarginLeft = Math.max(-64, Math.min(64, currentMarginLeft + edgeDelta));
        const roundedMarginLeft = Math.round(targetMarginLeft * 10) / 10;
        feelsLikeChip.style.setProperty('margin-left', `${roundedMarginLeft}px`, 'important');
      }
    }
  }

  function runHeaderWeatherPostLayoutPass(callback, frameCount = 2) {
    if (typeof callback !== 'function') {
      return;
    }

    callback();

    const extraPasses = Number.isFinite(frameCount) ? Math.max(0, Math.floor(frameCount)) : 0;
    if (!extraPasses || typeof requestAnimationFrame !== 'function') {
      return;
    }

    let remainingPasses = extraPasses;
    const tick = () => {
      callback();
      remainingPasses -= 1;
      if (remainingPasses > 0) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  function setupHeaderWeatherFeelsLayoutAutoSync({ feelsLikeChip, syncLayout, observeNodes = [], observeRoot = null }) {
    if (!(feelsLikeChip instanceof HTMLElement) || typeof syncLayout !== 'function') {
      return () => {};
    }

    if (typeof feelsLikeChip.__weatherFeelsAutoSyncCleanup === 'function') {
      feelsLikeChip.__weatherFeelsAutoSyncCleanup();
    }

    let disposed = false;
    let rafId = 0;
    const timeoutIds = [];
    const listeners = [];

    const scheduleSync = () => {
      if (disposed || !feelsLikeChip.isConnected) {
        return;
      }

      if (typeof requestAnimationFrame !== 'function') {
        syncLayout();
        return;
      }

      if (rafId) {
        return;
      }

      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (!disposed && feelsLikeChip.isConnected) {
          syncLayout();
        }
      });
    };

    const bootstrapSyncDelays = [40, 120, 260];
    bootstrapSyncDelays.forEach(delayMs => {
      const timerId = setTimeout(scheduleSync, delayMs);
      timeoutIds.push(timerId);
    });

    const handleWindowResize = () => {
      scheduleSync();
    };
    window.addEventListener('resize', handleWindowResize, { passive: true });
    window.addEventListener('orientationchange', handleWindowResize, { passive: true });
    listeners.push(['resize', handleWindowResize]);
    listeners.push(['orientationchange', handleWindowResize]);

    const uniqueObservedNodes = Array.from(new Set(observeNodes.filter(node => node instanceof Element)));
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            scheduleSync();
          })
        : null;
    if (resizeObserver) {
      uniqueObservedNodes.forEach(node => resizeObserver.observe(node));
    }

    const mutationTarget =
      observeRoot instanceof ShadowRoot || observeRoot instanceof HTMLElement || observeRoot instanceof DocumentFragment
        ? observeRoot
        : feelsLikeChip.closest('.weather-header-card') || feelsLikeChip.parentElement;
    const mutationObserver =
      mutationTarget instanceof Node
        ? new MutationObserver(() => {
            scheduleSync();
          })
        : null;
    if (mutationObserver && mutationTarget) {
      mutationObserver.observe(mutationTarget, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-weather-expanded'],
      });
    }

    const cleanup = () => {
      if (disposed) {
        return;
      }

      disposed = true;

      if (rafId && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }

      timeoutIds.forEach(timerId => clearTimeout(timerId));
      timeoutIds.length = 0;

      listeners.forEach(([eventName, handler]) => {
        window.removeEventListener(eventName, handler);
      });

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (mutationObserver) {
        mutationObserver.disconnect();
      }
    };

    feelsLikeChip.__weatherFeelsAutoSyncCleanup = cleanup;
    return cleanup;
  }

  function syncHeaderWeatherFeelsBaseline(feelsLikeChip, mainTempNode, valueNode) {
    if (!(feelsLikeChip instanceof HTMLElement)) {
      return;
    }

    if (!(mainTempNode instanceof HTMLElement) || !(valueNode instanceof HTMLElement)) {
      feelsLikeChip.style.setProperty('transform', 'none', 'important');
      return;
    }

    const mainTempBox = mainTempNode.getBoundingClientRect();
    const valueBox = valueNode.getBoundingClientRect();
    if (!mainTempBox.height || !valueBox.height) {
      feelsLikeChip.style.setProperty('transform', 'none', 'important');
      return;
    }

    const shiftUpPx = Math.round((valueBox.bottom - mainTempBox.bottom) * 10) / 10;
    if (shiftUpPx > 0.4) {
      feelsLikeChip.style.setProperty('transform', `translateY(-${shiftUpPx}px)`, 'important');
    } else {
      feelsLikeChip.style.setProperty('transform', 'none', 'important');
    }
  }

  function resetHeaderWeatherPlacementRetry(host) {
    if (!host) {
      return;
    }

    if (host.__weatherPlacementRetryTimer) {
      clearTimeout(host.__weatherPlacementRetryTimer);
      host.__weatherPlacementRetryTimer = null;
    }
    host.__weatherPlacementRetryCount = 0;
  }

  function scheduleHeaderWeatherPlacementRetry(host) {
    if (!host || !host.isConnected) {
      return;
    }

    if (host.__weatherPlacementRetryTimer) {
      return;
    }

    const currentRetryCount = Number(host.__weatherPlacementRetryCount) || 0;
    if (currentRetryCount >= 4) {
      return;
    }

    const nextRetryCount = currentRetryCount + 1;
    host.__weatherPlacementRetryCount = nextRetryCount;
    const delayMs = 60 + nextRetryCount * 70;

    host.__weatherPlacementRetryTimer = setTimeout(() => {
      host.__weatherPlacementRetryTimer = null;
      ensureHeaderWeatherMenuPlacementLock(host);
    }, delayMs);
  }

  function formatHeaderWeatherCelsiusText(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return `--${HEADER_WEATHER_CELSIUS_SUFFIX}`;
    }

    return `${Math.round(numeric)}${HEADER_WEATHER_CELSIUS_SUFFIX}`;
  }

  function normalizeHeaderWeatherCelsiusString(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/(-?\d{1,3})\s*°\s*([CcСс])/gu, '$1\u00b0C')
      .replace(/(-?\d{1,3})\s*([CcСс])\s*°/gu, '$1\u00b0C')
      .replace(/°\s*([CcСс])/gu, '\u00b0C')
      .replace(/([CcСс])\s*°/gu, '\u00b0C')
      .replace(/\u00b0\s*C/gi, '\u00b0C')
      .replace(/\s+\u00b0C/g, '\u00b0C');
  }

  function lockHeaderWeatherMainTemperatureTypography(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return false;
    }

    const triggerNode = root.querySelector('.weather-header-trigger');
    const triggerHeight =
      triggerNode instanceof HTMLElement ? Math.round(triggerNode.getBoundingClientRect().height || 0) : 0;
    const compactPreview = triggerHeight > 0 && triggerHeight <= 92;
    const previewTempSizePx = compactPreview ? 22 : HEADER_WEATHER_TEMP_VALUE_SIZE_PX;

    let changed = false;
    root.querySelectorAll('.weather-header-card__temperature').forEach(node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const size = `${previewTempSizePx}px`;
      if (node.style.getPropertyValue('font-size') !== size) {
        node.style.setProperty('font-size', size, 'important');
        changed = true;
      }
    });

    root.querySelectorAll('.weather-header-card__temperature-value').forEach(node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      node.style.setProperty('font-size', '1em', 'important');
      node.style.setProperty('font-weight', '300', 'important');
      node.style.setProperty('line-height', '1', 'important');
      node.style.setProperty('letter-spacing', '-0.055em', 'important');
      node.style.setProperty('display', 'inline-block', 'important');
      node.style.setProperty('vertical-align', 'baseline', 'important');
    });

    root.querySelectorAll('.weather-header-card__temperature').forEach(tempNode => {
      if (!(tempNode instanceof HTMLElement)) {
        return;
      }
      const numberNode = tempNode.querySelector('.weather-header-card__temperature-value');
      const unitNode = tempNode.querySelector('.weather-header-card__temperature-unit');
      if (numberNode instanceof HTMLElement && unitNode instanceof HTMLElement) {
        syncHeaderWeatherCelsiusUnitTopToDigit(unitNode, numberNode);
      }
    });

    root.querySelectorAll('.weather-header-card__feels-temp').forEach(tempNode => {
      if (!(tempNode instanceof HTMLElement)) {
        return;
      }
      const numberNode = tempNode.querySelector('.weather-header-card__feels-temp-number');
      const unitNode = tempNode.querySelector('.weather-header-card__feels-temp-unit');
      if (numberNode instanceof HTMLElement && unitNode instanceof HTMLElement) {
        syncHeaderWeatherCelsiusUnitTopToDigit(unitNode, numberNode);
      }
    });

    root.querySelectorAll('.weather-header-dropdown__hero-temp').forEach(tempNode => {
      if (!(tempNode instanceof HTMLElement)) {
        return;
      }
      const numberNode = tempNode.querySelector('span');
      const unitNode = tempNode.querySelector('small');
      if (numberNode instanceof HTMLElement && unitNode instanceof HTMLElement) {
        syncHeaderWeatherCelsiusUnitTopToDigit(unitNode, numberNode);
      }
    });

    const previewChips =
      root.querySelector('.weather-header-card__temp-row .weather-header-card__chips') ||
      root.querySelector('.weather-header-card__bottom > .weather-header-card__chips') ||
      root.querySelector('.weather-header-card__chips');
    if (previewChips instanceof HTMLElement) {
      const chipNodes = Array.from(previewChips.querySelectorAll('.weather-header-card__chip'));
      const feelsChip = chipNodes.find(chip => /gef|ощущ|feels|відчува/i.test(chip.textContent || '')) || null;
      const windChip = chipNodes.find(chip => /wind|ветер|вітер/i.test(chip.textContent || '')) || null;
      if (windChip instanceof HTMLElement) {
        windChip.remove();
        changed = true;
      }

      if (feelsChip instanceof HTMLElement) {
        const lang = (document.documentElement.lang || 'ru').toLowerCase();
        const textByLang = {
          ru: { label: 'ОЩУЩАЕТСЯ', prefix: 'КАК' },
          uk: { label: 'ВІДЧУВАЄТЬСЯ', prefix: 'ЯК' },
          de: { label: 'GEFÜHLT', prefix: 'WIE' },
          en: { label: 'FEELS', prefix: 'LIKE' },
        };
        const labelText = (textByLang[lang] || textByLang.en).label;
        const prefixText = (textByLang[lang] || textByLang.en).prefix;
        const rawFeels = (feelsChip.textContent || '').replace(/\s+/g, ' ').trim();
        const match = rawFeels.match(/(-?\d{1,2})(?:\s*\u00b0\s*[CcСс])?/);
        const apparentTemperature = Number(host?.__weatherCurrentMeta?.apparentTemperature);
        const feelsNumber = Number.isFinite(apparentTemperature)
          ? String(Math.round(apparentTemperature))
          : match?.[1] || '--';

        feelsChip.classList.add('weather-header-card__chip--feels-like');
        feelsChip.dataset.weatherMetric = 'feels';
        feelsChip.dataset.weatherFeelsLayout = 'custom';

        const label = document.createElement('span');
        label.className = 'weather-header-card__feels-label';
        label.textContent = labelText;

        const row = document.createElement('span');
        row.className = 'weather-header-card__feels-value weather-header-card__feels-row';
        const prefix = document.createElement('span');
        prefix.className = 'weather-header-card__feels-prefix';
        prefix.textContent = prefixText;
        const tempWrap = document.createElement('span');
        tempWrap.className = 'weather-header-card__feels-temp';
        const number = document.createElement('span');
        number.className = 'weather-header-card__feels-temp-number';
        number.textContent = feelsNumber;
        const unit = document.createElement('span');
        unit.className = 'weather-header-card__feels-temp-unit';
        unit.textContent = HEADER_WEATHER_CELSIUS_SUFFIX;
        tempWrap.append(number, unit);
        row.append(prefix, tempWrap);

        if (feelsChip.dataset.weatherCollapsedFormatted !== 'true') {
          feelsChip.replaceChildren(label, row);
          feelsChip.dataset.weatherCollapsedFormatted = 'true';
          changed = true;
        }

        chipNodes.forEach(chip => {
          if (chip === feelsChip) {
            chip.style.setProperty('display', 'flex', 'important');
            return;
          }
          chip.style.setProperty('display', 'none', 'important');
        });

        previewChips.style.setProperty('display', 'flex', 'important');
        previewChips.style.setProperty('align-items', 'center', 'important');
        previewChips.style.setProperty('justify-content', 'flex-start', 'important');
      }
    }

    const previewMoon = root.querySelector('.weather-orb-overlay--preview.is-moon');
    if (previewMoon instanceof HTMLElement) {
      previewMoon.style.setProperty('opacity', '0.62', 'important');
      previewMoon.style.setProperty(
        'filter',
        'brightness(1.18) saturate(1.08) drop-shadow(0 0 12px rgba(232, 212, 139, 0.36))',
        'important'
      );
    }

    return changed;
  }

  function normalizeHeaderWeatherCelsiusUnits(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return false;
    }

    let changed = false;
    const unitDisplay = HEADER_WEATHER_CELSIUS_SUFFIX;

    root.querySelectorAll('.weather-header-card__temperature-unit').forEach(node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const next = unitDisplay;
      if (node.textContent !== next) {
        node.textContent = next;
        changed = true;
      }
    });

    root.querySelectorAll('.weather-header-dropdown__hero-temp small').forEach(node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const next = unitDisplay;
      if (node.textContent !== next) {
        node.textContent = next;
        changed = true;
      }
    });

    root.querySelectorAll('.weather-header-card__feels-temp-unit').forEach(node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const next = unitDisplay;
      if (node.textContent !== next) {
        node.textContent = next;
        changed = true;
      }
    });

    root
      .querySelectorAll(
        '.weather-header-card__chip:not([data-weather-feels-layout="custom"]), .weather-header-dropdown__hero-chips span'
      )
      .forEach(chip => {
        if (!(chip instanceof HTMLElement)) {
          return;
        }

        const raw = (chip.textContent || '').replace(/\s+/g, ' ').trim();
        const celsiusMatch = raw.match(/^(.*?)(-?\d{1,2})\s*°?\s*([CcСс])\s*$/u);
        if (!celsiusMatch) {
          return;
        }

        const prefix = celsiusMatch[1].trim();
        const number = celsiusMatch[2];
        const next = normalizeHeaderWeatherCelsiusString(
          prefix ? `${prefix} ${number}${unitDisplay}` : `${number}${unitDisplay}`
        );
        if (raw !== next.replace(/\s+/g, ' ').trim()) {
          chip.textContent = next;
          changed = true;
        }
      });

    root
      .querySelectorAll('.weather-header-dropdown__forecast-pill strong, .weather-header-dropdown__detail-card strong')
      .forEach(node => {
        if (!(node instanceof HTMLElement)) {
          return;
        }

        const raw = (node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!raw) {
          return;
        }

        const next = raw
          .replace(/(-?\d{1,2})\s*°(?!\s*[CcСс])/gu, '$1°C')
          .replace(/°C\s*\/\s*(-?\d{1,2})\s*°(?!\s*[CcСс])/gu, '°C / $1°C');

        if (next !== raw) {
          node.textContent = next;
          changed = true;
        }
      });

    // Keep °C anchored consistently to the top-right of the numeric glyph in every known temperature block.
    root.querySelectorAll('.weather-header-card__temperature').forEach(tempNode => {
      if (!(tempNode instanceof HTMLElement)) {
        return;
      }

      const numberNode = tempNode.querySelector('.weather-header-card__temperature-value');
      const unitNode = tempNode.querySelector('.weather-header-card__temperature-unit');
      if (numberNode instanceof HTMLElement && unitNode instanceof HTMLElement) {
        syncHeaderWeatherCelsiusUnitTopToDigit(unitNode, numberNode);
      }
    });

    root.querySelectorAll('.weather-header-card__feels-temp').forEach(tempNode => {
      if (!(tempNode instanceof HTMLElement)) {
        return;
      }

      const numberNode = tempNode.querySelector('.weather-header-card__feels-temp-number');
      const unitNode = tempNode.querySelector('.weather-header-card__feels-temp-unit');
      if (numberNode instanceof HTMLElement && unitNode instanceof HTMLElement) {
        syncHeaderWeatherCelsiusUnitTopToDigit(unitNode, numberNode);
      }
    });

    root.querySelectorAll('.weather-header-dropdown__hero-temp').forEach(tempNode => {
      if (!(tempNode instanceof HTMLElement)) {
        return;
      }

      const numberNode = tempNode.querySelector('span');
      const unitNode = tempNode.querySelector('small');
      if (numberNode instanceof HTMLElement && unitNode instanceof HTMLElement) {
        syncHeaderWeatherCelsiusUnitTopToDigit(unitNode, numberNode);
      }
    });

    changed = lockHeaderWeatherMainTemperatureTypography(host) || changed;

    return changed;
  }

  function formatHeaderWeatherPressureValue(host, pressureMmHg) {
    const unitText = getHeaderWeatherPressureUnitText(host);
    const normalizedPressure = Number(pressureMmHg);
    if (!Number.isFinite(normalizedPressure) || normalizedPressure <= 0) {
      return `-- ${unitText}`;
    }

    return `${Math.round(normalizedPressure)} ${unitText}`;
  }

  function getHeaderWeatherCloudCover(host) {
    const cloudCover = Number(
      host?.__weatherCurrentMeta?.cloudCover ?? host?.dataset?.weatherCloud ?? host?.__weatherWidgetData?.current?.cloud
    );
    return Number.isFinite(cloudCover) ? clampHeaderWeatherValue(cloudCover, 0, 100) : null;
  }

  function resolveHeaderWeatherTextReadability(host, orbAtmosphere) {
    const cloudCover = getHeaderWeatherCloudCover(host);
    const cloudNorm = cloudCover === null ? 0.42 : cloudCover / 100;
    const orbAlpha = Number(orbAtmosphere?.alpha) || 0;
    const mode = String(orbAtmosphere?.mode || '');
    const conditionText = getHeaderWeatherConditionText(host);
    const isBrightScene =
      mode === 'precipitation' ||
      mode === 'overcast' ||
      mode === 'fog' ||
      mode === 'cloudy' ||
      /(rain|shower|лив|дожд|snow|снег|туман|fog|overcast|пасмур|bedeckt|cloud|облач|хмар)/i.test(conditionText);

    let score = cloudNorm * 0.48 + orbAlpha * 0.52;
    if (isBrightScene) {
      score += 0.14;
    }
    if (mode === 'precipitation') {
      score += 0.14;
    }
    if (cloudNorm >= 0.58) {
      score += 0.1;
    }

    return clampHeaderWeatherValue(score, 0, 1);
  }

  function applyHeaderWeatherTextReadability(host, orbAtmosphere) {
    if (!host) {
      return;
    }

    const score = resolveHeaderWeatherTextReadability(host, orbAtmosphere);
    const tier = score < 0.34 ? 'low' : score < 0.62 ? 'medium' : 'high';
    const textAlpha = clampHeaderWeatherValue(0.96 - score * 0.34, 0.58, 0.96);
    const eyebrowAlpha = clampHeaderWeatherValue(0.86 - score * 0.22, 0.58, 0.86);

    host.dataset.weatherTextReadability = tier;
    host.style.setProperty('--weather-readability-scrim', '0');
    host.style.setProperty('--weather-readability-glow', score.toFixed(3));
    host.style.setProperty('--weather-text-alpha', textAlpha.toFixed(3));
    host.style.setProperty('--weather-eyebrow-alpha', eyebrowAlpha.toFixed(3));
    host.style.setProperty('--weather-scene-dim', '1');
  }

  function resolveHeaderWeatherOrbAtmosphere(host) {
    const conditionText = getHeaderWeatherConditionText(host);
    const conditionCode = getHeaderWeatherConditionCode(host);
    const cloudCover = getHeaderWeatherCloudCover(host);
    const normalizedCloudCover = cloudCover === null ? null : clampHeaderWeatherValue(cloudCover / 100, 0, 1);
    const isClearCode = conditionCode === 1000 || conditionCode === 0 || conditionCode === 1;
    const isPartlyCloudyCode = conditionCode === 1003 || conditionCode === 2;
    const isCloudyCode = conditionCode === 1006;
    const isOvercastCode = conditionCode === 1009 || conditionCode === 3;
    const isFogCode = conditionCode === 1030 || conditionCode === 45 || conditionCode === 48;
    const isPrecipitationCode =
      [1153, 1183, 1210, 1240, 1273].includes(conditionCode) ||
      (conditionCode >= 51 && conditionCode <= 67) ||
      (conditionCode >= 71 && conditionCode <= 77) ||
      (conditionCode >= 80 && conditionCode <= 82) ||
      (conditionCode >= 85 && conditionCode <= 86) ||
      (conditionCode >= 95 && conditionCode <= 99);

    if (!conditionText && normalizedCloudCover === null && conditionCode === null) {
      return { alpha: 0 };
    }

    const isClearText = /(clear|sunny|mostly clear|mainly clear|ясно|солнеч|klar|sonnig|bezchmurn|безхмар)/.test(
      conditionText
    );
    const isPartlyCloudyText =
      /(partly|few clouds|scattered|переменн|мінлива|teilweise|leicht bewölkt|locker bewölkt|interval)/.test(
        conditionText
      );
    const isPrecipitationText =
      /(rain|drizzle|shower|storm|snow|sleet|thunder|дожд|лив|гроз|снег|морось|regen|schauer|gewitter|schnee|niesel|hagel)/.test(
        conditionText
      );
    const isOvercastText = /(overcast|пасмур|bedeckt)/.test(conditionText);
    const isCloudyText = /(cloud|облач|хмар|bewölkt)/.test(conditionText);
    const isFogText = /(fog|mist|туман|nebel)/.test(conditionText);

    if (isClearCode || isClearText) {
      return {
        alpha: normalizedCloudCover !== null ? clampHeaderWeatherValue(normalizedCloudCover * 0.05, 0, 0.06) : 0,
      };
    }

    let mode = 'cloudy';
    let alpha = normalizedCloudCover !== null ? 0.08 + normalizedCloudCover * 0.2 : 0.14;
    let blur = 16;
    let stretchX = 1.12;
    let stretchY = 0.82;
    let drift = 1;
    let lift = 0;
    let coreOpacity = 0.98;
    let depthAlpha = 0.24;
    let highlightAlpha = 0.16;

    /* Primary source of truth: cloud_cover from live weather API. */
    if (normalizedCloudCover !== null) {
      if (normalizedCloudCover <= 0.12) {
        mode = 'clear';
        alpha = 0.02 + normalizedCloudCover * 0.12;
        blur = 12;
        stretchX = 1.02;
        stretchY = 0.9;
        drift = 0.88;
        coreOpacity = 1;
        depthAlpha = 0.12;
        highlightAlpha = 0.1;
      } else if (normalizedCloudCover <= 0.38) {
        mode = 'partly';
        alpha = 0.05 + normalizedCloudCover * 0.18;
        blur = 14;
        stretchX = 1.06;
        stretchY = 0.88;
        drift = 0.92;
        coreOpacity = 0.99;
        depthAlpha = 0.18;
        highlightAlpha = 0.14;
      } else if (normalizedCloudCover <= 0.75) {
        mode = 'cloudy';
        alpha = 0.08 + normalizedCloudCover * 0.14;
        blur = 16;
        stretchX = 1.04;
        stretchY = 0.92;
        drift = 1;
        coreOpacity = 0.97;
        depthAlpha = 0.24;
        highlightAlpha = 0.16;
      } else {
        mode = 'overcast';
        alpha = 0.12 + normalizedCloudCover * 0.14;
        blur = 18;
        stretchX = 1.06;
        stretchY = 0.88;
        drift = 1.08;
        lift = 1;
        coreOpacity = 0.95;
        depthAlpha = 0.3;
        highlightAlpha = 0.2;
      }
    }

    /* Weather code has stronger semantic priority than cloud_cover buckets.
       Example: code=3 (overcast) must not look like light clouds even at 60-70% cover. */
    if (normalizedCloudCover !== null) {
      if (isPrecipitationCode || isPrecipitationText) {
        mode = 'precipitation';
        alpha = 0.24 + normalizedCloudCover * 0.2;
        blur = 24;
        stretchX = 1.22;
        stretchY = 0.8;
        drift = 1.08;
        lift = 1;
        coreOpacity = 0.92;
        depthAlpha = 0.32;
        highlightAlpha = 0.18;
      } else if (isFogCode || isFogText) {
        mode = 'fog';
        alpha = 0.22 + normalizedCloudCover * 0.16;
        blur = 26;
        stretchX = 1.32;
        stretchY = 0.78;
        drift = 0.88;
        lift = 2;
        coreOpacity = 0.97;
        depthAlpha = 0.22;
        highlightAlpha = 0.12;
      } else if (isOvercastCode || isOvercastText) {
        mode = 'overcast';
        alpha = 0.22 + normalizedCloudCover * 0.14;
        blur = 20;
        stretchX = 1.06;
        stretchY = 0.9;
        drift = 1.14;
        lift = 1;
        coreOpacity = 0.95;
        depthAlpha = 0.34;
        highlightAlpha = 0.22;
      } else if (isCloudyCode || isCloudyText) {
        mode = 'cloudy';
        alpha = 0.18 + normalizedCloudCover * 0.2;
        blur = 18;
        stretchX = 1.16;
        stretchY = 0.84;
        drift = 1.02;
        coreOpacity = 0.97;
        depthAlpha = 0.26;
        highlightAlpha = 0.18;
      } else if (isPartlyCloudyCode || isPartlyCloudyText) {
        mode = 'partly';
        alpha = 0.08 + normalizedCloudCover * 0.18;
        blur = 14;
        stretchX = 1.06;
        stretchY = 0.88;
        drift = 0.92;
        coreOpacity = 0.99;
        depthAlpha = 0.18;
        highlightAlpha = 0.14;
      }
    }

    if ((isPartlyCloudyCode || isPartlyCloudyText) && normalizedCloudCover === null) {
      mode = 'partly';
      alpha = normalizedCloudCover !== null ? 0.08 + normalizedCloudCover * 0.18 : 0.18;
      blur = 14;
      stretchX = 1.06;
      stretchY = 0.88;
      drift = 0.92;
      coreOpacity = 0.99;
      depthAlpha = 0.18;
      highlightAlpha = 0.14;
    }

    if ((isCloudyCode || isCloudyText) && normalizedCloudCover === null) {
      mode = 'cloudy';
      alpha = normalizedCloudCover !== null ? 0.16 + normalizedCloudCover * 0.22 : 0.3;
      blur = 18;
      stretchX = 1.16;
      stretchY = 0.84;
      drift = 1.02;
      coreOpacity = 0.97;
      depthAlpha = 0.26;
      highlightAlpha = 0.18;
    }

    if ((isOvercastCode || isOvercastText) && normalizedCloudCover === null) {
      mode = 'overcast';
      alpha = normalizedCloudCover !== null ? 0.28 + normalizedCloudCover * 0.22 : 0.46;
      blur = 22;
      stretchX = 1.28;
      stretchY = 0.76;
      drift = 1.14;
      lift = 1;
      coreOpacity = 0.95;
      depthAlpha = 0.34;
      highlightAlpha = 0.22;
    }

    if ((isFogCode || isFogText) && normalizedCloudCover === null) {
      mode = 'fog';
      alpha = normalizedCloudCover !== null ? 0.24 + normalizedCloudCover * 0.14 : 0.34;
      blur = 26;
      stretchX = 1.32;
      stretchY = 0.78;
      drift = 0.88;
      lift = 2;
      coreOpacity = 0.97;
      depthAlpha = 0.22;
      highlightAlpha = 0.12;
    }

    if ((isPrecipitationCode || isPrecipitationText) && normalizedCloudCover === null) {
      mode = 'precipitation';
      alpha = normalizedCloudCover !== null ? 0.24 + normalizedCloudCover * 0.18 : 0.38;
      blur = 24;
      stretchX = 1.22;
      stretchY = 0.8;
      drift = 1.08;
      lift = 1;
      coreOpacity = 0.92;
      depthAlpha = 0.32;
      highlightAlpha = 0.18;
    }

    return {
      mode,
      alpha: clampHeaderWeatherValue(alpha, 0, 0.5),
      blur,
      stretchX,
      stretchY,
      drift,
      lift,
      coreOpacity,
      depthAlpha,
      highlightAlpha,
    };
  }

  async function resolveHeaderWeatherLocationMeta(locationLabel) {
    const normalizedKey = normalizeHeaderWeatherLocationKey(locationLabel);
    if (!normalizedKey) {
      return null;
    }

    const cachedEntry = headerWeatherLocationCache.get(normalizedKey);
    if (cachedEntry?.value && cachedEntry.expiresAt > Date.now()) {
      return cachedEntry.value;
    }

    if (cachedEntry?.promise) {
      return cachedEntry.promise;
    }

    const coordinateMatch = parseHeaderWeatherCoordinates(locationLabel);
    if (coordinateMatch) {
      const promise = (async () => {
        const isSalonCoords =
          Math.abs(coordinateMatch.latitude - HEADER_WEATHER_STATIC_FALLBACK_COORDS.latitude) < 0.001 &&
          Math.abs(coordinateMatch.longitude - HEADER_WEATHER_STATIC_FALLBACK_COORDS.longitude) < 0.001;

        if (isSalonCoords) {
          const coordinateValue = {
            latitude: coordinateMatch.latitude,
            longitude: coordinateMatch.longitude,
            label: 'Leipzig - Stötteritz',
            regionLabel: 'Sachsen',
            timezone: getHeaderWeatherBrowserTimeZone() || HEADER_WEATHER_DEFAULT_TIMEZONE,
          };

          headerWeatherLocationCache.set(normalizedKey, {
            value: coordinateValue,
            expiresAt: Date.now() + HEADER_WEATHER_LOCATION_CACHE_TTL,
          });

          return coordinateValue;
        }

        const reverseMeta = await fetchHeaderWeatherReverseGeoMeta(
          coordinateMatch.latitude,
          coordinateMatch.longitude
        ).catch(() => null);

        const coordinateValue = {
          latitude: coordinateMatch.latitude,
          longitude: coordinateMatch.longitude,
          label: reverseMeta?.districtLabel || locationLabel.trim(),
          regionLabel: reverseMeta?.regionLabel || null,
          timezone: getHeaderWeatherBrowserTimeZone() || HEADER_WEATHER_DEFAULT_TIMEZONE,
        };

        headerWeatherLocationCache.set(normalizedKey, {
          value: coordinateValue,
          expiresAt: Date.now() + HEADER_WEATHER_LOCATION_CACHE_TTL,
        });

        return coordinateValue;
      })().catch(error => {
        headerWeatherLocationCache.delete(normalizedKey);
        throw error;
      });

      headerWeatherLocationCache.set(normalizedKey, { promise });
      return promise;
    }

    const promise = (async () => {
      const pageLanguage = String(document.documentElement.lang || 'en')
        .trim()
        .toLowerCase()
        .split(/[-_]/)[0];
      const attemptedLanguages = Array.from(new Set([pageLanguage || 'en', 'en', '']));
      let result = null;

      for (const language of attemptedLanguages) {
        const url = new URL(HEADER_WEATHER_GEOCODE_ENDPOINT);
        url.searchParams.set('name', locationLabel.trim());
        url.searchParams.set('count', '1');
        url.searchParams.set('format', 'json');
        if (language) {
          url.searchParams.set('language', language);
        }

        const response = await fetch(url.toString(), {
          mode: 'cors',
          credentials: 'omit',
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`Weather geocoding failed with status ${response.status}.`);
        }

        const payload = await response.json();
        result = payload?.results?.[0] || null;
        if (result) {
          break;
        }
      }

      if (!result) {
        return null;
      }

      const cityCandidate = [result.city, result.admin3, result.admin2, result.admin1].find(Boolean) || '';
      const districtCandidate = result.name || '';
      const cityDistrictLabel =
        cityCandidate && districtCandidate && cityCandidate.toLowerCase() !== districtCandidate.toLowerCase()
          ? `${cityCandidate} - ${districtCandidate}`
          : cityCandidate || districtCandidate || '';

      const resolvedValue = {
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
        label:
          cityDistrictLabel || [result.name, result.admin1 || result.admin2, result.country].filter(Boolean).join(', '),
        regionLabel: normalizeHeaderWeatherGermanStateLabel(result.admin1 || result.admin2 || null, {
          country_code: result.country_code,
        }),
        timezone:
          normalizeHeaderWeatherTimeZone(result.timezone) ||
          getHeaderWeatherBrowserTimeZone() ||
          HEADER_WEATHER_DEFAULT_TIMEZONE,
      };

      headerWeatherLocationCache.set(normalizedKey, {
        value: resolvedValue,
        expiresAt: Date.now() + HEADER_WEATHER_LOCATION_CACHE_TTL,
      });

      return resolvedValue;
    })().catch(error => {
      headerWeatherLocationCache.delete(normalizedKey);
      throw error;
    });

    headerWeatherLocationCache.set(normalizedKey, { promise });
    return promise;
  }

  async function fetchHeaderWeatherAstroDay(locationMeta, dateString) {
    const url = new URL(HEADER_WEATHER_ASTRO_ENDPOINT);
    url.searchParams.set('lat', String(locationMeta.latitude));
    url.searchParams.set('lng', String(locationMeta.longitude));
    url.searchParams.set('date', dateString);
    url.searchParams.set('formatted', '0');
    if (locationMeta.timezone) {
      url.searchParams.set('tzid', locationMeta.timezone);
    }

    const response = await fetch(url.toString(), {
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Astronomical lookup failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const results = payload?.results;
    if (!results?.sunrise || !results?.sunset) {
      throw new Error('Astronomical lookup returned incomplete data.');
    }

    return {
      date: dateString,
      sunrise: Date.parse(results.sunrise),
      sunset: Date.parse(results.sunset),
      solarNoon: Date.parse(results.solar_noon),
    };
  }

  async function resolveHeaderWeatherAstro(host) {
    const locationLabel = getHeaderWeatherLocationLabel(host);
    const locationMeta = await resolveHeaderWeatherLocationMeta(locationLabel);
    if (!locationMeta) {
      return null;
    }

    const dateString = getHeaderWeatherDateInTimeZone(resolveHeaderWeatherTimeZone(host, locationMeta));
    const cacheKey = `${locationMeta.latitude.toFixed(4)},${locationMeta.longitude.toFixed(4)}:${dateString}`;
    const cachedEntry = headerWeatherAstroCache.get(cacheKey);

    if (cachedEntry?.value && cachedEntry.expiresAt > Date.now()) {
      return cachedEntry.value;
    }

    if (cachedEntry?.promise) {
      return cachedEntry.promise;
    }

    const promise = Promise.all([
      fetchHeaderWeatherAstroDay(locationMeta, shiftHeaderWeatherDate(dateString, -1)),
      fetchHeaderWeatherAstroDay(locationMeta, dateString),
      fetchHeaderWeatherAstroDay(locationMeta, shiftHeaderWeatherDate(dateString, 1)),
    ])
      .then(([yesterday, today, tomorrow]) => {
        const value = {
          locationMeta,
          yesterday,
          today,
          tomorrow,
        };

        headerWeatherAstroCache.set(cacheKey, {
          value,
          expiresAt: Date.now() + HEADER_WEATHER_ASTRO_CACHE_TTL,
        });

        return value;
      })
      .catch(error => {
        headerWeatherAstroCache.delete(cacheKey);
        throw error;
      });

    headerWeatherAstroCache.set(cacheKey, { promise });
    return promise;
  }

  function resolveHeaderWeatherNightWindow(astroData, nowMs) {
    if (!astroData?.today?.sunrise || !astroData?.today?.sunset) {
      return null;
    }

    const beforeSunrise = nowMs < astroData.today.sunrise;
    const nightStart = beforeSunrise ? astroData.yesterday?.sunset : astroData.today.sunset;
    const nightEnd = beforeSunrise ? astroData.today.sunrise : astroData.tomorrow?.sunrise;
    if (!Number.isFinite(nightStart) || !Number.isFinite(nightEnd) || nightEnd <= nightStart) {
      return null;
    }

    const nightDuration = nightEnd - nightStart;
    const nightProgress = clampHeaderWeatherValue((nowMs - nightStart) / Math.max(nightDuration, 1), 0, 1);

    return { nightStart, nightEnd, nightDuration, nightProgress };
  }

  function resolveHeaderWeatherOrbCrossfadeWeights(nowMs, sunrise, sunset, nightWindow) {
    const twilight = HEADER_WEATHER_ORB_CROSSFADE_MS;
    let moonOpacity = 0;
    let sunOpacity = 0;

    if (nowMs >= sunrise && nowMs < sunset) {
      const afterSunrise = nowMs - sunrise;
      const beforeSunset = sunset - nowMs;
      if (afterSunrise < twilight) {
        moonOpacity = 1 - afterSunrise / twilight;
        sunOpacity = afterSunrise / twilight;
      } else if (beforeSunset < twilight) {
        moonOpacity = beforeSunset / twilight;
        sunOpacity = 1 - beforeSunset / twilight;
      } else {
        sunOpacity = 1;
      }
      moonOpacity = Math.max(moonOpacity, HEADER_WEATHER_MOON_DAY_MIN_OPACITY);
      return { moonOpacity, sunOpacity };
    }

    if (!nightWindow) {
      moonOpacity = 1;
      return { moonOpacity, sunOpacity };
    }

    const afterDusk = nowMs - nightWindow.nightStart;
    const beforeDawn = nightWindow.nightEnd - nowMs;
    if (afterDusk < twilight) {
      sunOpacity = 1 - afterDusk / twilight;
      moonOpacity = afterDusk / twilight;
    } else if (beforeDawn < twilight) {
      moonOpacity = beforeDawn / twilight;
      sunOpacity = 1 - beforeDawn / twilight;
    } else {
      moonOpacity = 1;
    }

    return { moonOpacity, sunOpacity };
  }

  function resolveHeaderWeatherOrbPresentation(host, astroData) {
    const fallbackKind = getHeaderWeatherFallbackOrbKind(host);
    const nowMs = getHeaderWeatherNowMs();

    if (!astroData?.today?.sunrise || !astroData?.today?.sunset) {
      const fallbackProgress = getHeaderWeatherFallbackOrbProgress(host, fallbackKind);
      const moonOpacity = fallbackKind === 'moon' ? 1 : 0;
      const sunOpacity = fallbackKind === 'sun' ? 1 : 0;
      return {
        moon: {
          active: moonOpacity > 0.02,
          opacity: moonOpacity,
          previewLayout: resolveHeaderWeatherOrbFixedLayout('moon', 'preview'),
          dropdownLayout: resolveHeaderWeatherOrbFixedLayout('moon', 'dropdown'),
          timeline: {
            nightProgress: fallbackProgress,
            videoDurationSec: HEADER_WEATHER_MOON_VIDEO_DURATION_SEC,
          },
        },
        sun: {
          active: sunOpacity > 0.02,
          opacity: sunOpacity,
          previewLayout: resolveHeaderWeatherOrbFixedLayout('sun', 'preview'),
          dropdownLayout: resolveHeaderWeatherOrbFixedLayout('sun', 'dropdown'),
          timeline: {
            dayProgress: fallbackProgress,
            videoDurationSec: HEADER_WEATHER_SUN_VIDEO_DURATION_SEC,
          },
        },
        dominantKind: fallbackKind,
      };
    }

    const nightWindow = resolveHeaderWeatherNightWindow(astroData, nowMs);
    const { moonOpacity, sunOpacity } = resolveHeaderWeatherOrbCrossfadeWeights(
      nowMs,
      astroData.today.sunrise,
      astroData.today.sunset,
      nightWindow
    );

    const moonProgress = nightWindow?.nightProgress ?? 0;
    const sunDayProgress =
      nowMs >= astroData.today.sunrise && nowMs < astroData.today.sunset
        ? clampHeaderWeatherValue(
            (nowMs - astroData.today.sunrise) / Math.max(astroData.today.sunset - astroData.today.sunrise, 1),
            0,
            1
          )
        : 0;

    const dominantKind = sunOpacity >= moonOpacity ? 'sun' : 'moon';

    return {
      moon: {
        active: moonOpacity > 0.02,
        opacity: moonOpacity,
        previewLayout: resolveHeaderWeatherOrbFixedLayout('moon', 'preview'),
        dropdownLayout: resolveHeaderWeatherOrbFixedLayout('moon', 'dropdown'),
        timeline: nightWindow
          ? {
              nightStart: nightWindow.nightStart,
              nightEnd: nightWindow.nightEnd,
              nightProgress: nightWindow.nightProgress,
              videoDurationSec: HEADER_WEATHER_MOON_VIDEO_DURATION_SEC,
            }
          : {
              nightProgress: moonProgress,
              videoDurationSec: HEADER_WEATHER_MOON_VIDEO_DURATION_SEC,
            },
      },
      sun: {
        active: sunOpacity > 0.02,
        opacity: sunOpacity,
        previewLayout: resolveHeaderWeatherOrbFixedLayout('sun', 'preview'),
        dropdownLayout: resolveHeaderWeatherOrbFixedLayout('sun', 'dropdown'),
        timeline:
          nowMs >= astroData.today.sunrise && nowMs < astroData.today.sunset
            ? {
                dayStart: astroData.today.sunrise,
                dayEnd: astroData.today.sunset,
                dayProgress: sunDayProgress,
                videoDurationSec: HEADER_WEATHER_SUN_VIDEO_DURATION_SEC,
              }
            : {
                dayProgress: sunDayProgress,
                videoDurationSec: HEADER_WEATHER_SUN_VIDEO_DURATION_SEC,
              },
      },

      dominantKind,
    };
  }

  function resolveHeaderWeatherShowNightStars(host, presentation, astroData) {
    if ((presentation?.moon?.opacity ?? 0) > 0.02) {
      return true;
    }

    const nowMs = getHeaderWeatherNowMs();
    const sunrise = astroData?.today?.sunrise;
    const sunset = astroData?.today?.sunset;
    if (Number.isFinite(sunrise) && Number.isFinite(sunset)) {
      return nowMs < sunrise || nowMs >= sunset;
    }

    return presentation?.dominantKind === 'moon';
  }

  function resolveHeaderWeatherOrbModel(host, astroData) {
    const presentation = resolveHeaderWeatherOrbPresentation(host, astroData);
    const kind = presentation.dominantKind;
    return {
      kind,
      previewLayout: kind === 'moon' ? presentation.moon.previewLayout : presentation.sun.previewLayout,
      dropdownLayout: kind === 'moon' ? presentation.moon.dropdownLayout : presentation.sun.dropdownLayout,
      presentation,
    };
  }

  function applyHeaderWeatherOrbLayout(overlay, layout) {
    if (!overlay) {
      return;
    }

    const orbKind = overlay.dataset.orbKind || overlay.dataset.orbRole || '';
    const isPreviewOrb =
      overlay.classList.contains('weather-orb-overlay--preview') &&
      (orbKind === 'moon' ||
        orbKind === 'sun' ||
        overlay.classList.contains('is-moon') ||
        overlay.classList.contains('is-sun'));

    if (isPreviewOrb && (orbKind === 'moon' || orbKind === 'sun')) {
      layout = resolveHeaderWeatherOrbFixedLayout(orbKind, 'preview');
      overlay.dataset.orbPositionLocked = 'preview';
      overlay.style.removeProperty('--orb-left');
      overlay.style.removeProperty('--orb-top');
      overlay.style.removeProperty('--orb-offset-x');
      overlay.style.removeProperty('--orb-offset-y');
    }

    if (!layout) {
      if (!isPreviewOrb) {
        overlay.style.removeProperty('--orb-left');
        overlay.style.removeProperty('--orb-top');
        overlay.style.removeProperty('--orb-offset-x');
        overlay.style.removeProperty('--orb-offset-y');
      }
      overlay.style.removeProperty('--orb-scale-visible');
      overlay.style.removeProperty('--orb-scale-hidden');
      overlay.dataset.orbLayoutKey = '';
      overlay.dataset.orbPositionLocked = '';
      return;
    }

    const fallbackVariant = isPreviewOrb ? 'preview' : 'dropdown';
    const fallbackLayout =
      orbKind === 'moon' || orbKind === 'sun' ? resolveHeaderWeatherOrbFixedLayout(orbKind, fallbackVariant) : null;

    layout = {
      ...layout,
      scale: Number.isFinite(Number(layout.scale)) ? Number(layout.scale) : Number(fallbackLayout?.scale) || 1,
      left: isPreviewOrb
        ? Number(layout.left)
        : Number.isFinite(Number(layout.left))
          ? Number(layout.left)
          : Number(fallbackLayout?.left),
      top: isPreviewOrb
        ? Number(layout.top)
        : Number.isFinite(Number(layout.top))
          ? Number(layout.top)
          : Number(fallbackLayout?.top),
      offsetX:
        typeof layout.offsetX === 'number'
          ? layout.offsetX
          : typeof fallbackLayout?.offsetX === 'number'
            ? fallbackLayout.offsetX
            : layout.offsetX,
      offsetY:
        typeof layout.offsetY === 'number'
          ? layout.offsetY
          : typeof fallbackLayout?.offsetY === 'number'
            ? fallbackLayout.offsetY
            : layout.offsetY,
    };

    if (!isPreviewOrb && (!Number.isFinite(layout.left) || !Number.isFinite(layout.top))) {
      overlay.style.removeProperty('--orb-left');
      overlay.style.removeProperty('--orb-top');
      overlay.style.removeProperty('--orb-offset-x');
      overlay.style.removeProperty('--orb-offset-y');
      overlay.style.removeProperty('--orb-scale-visible');
      overlay.style.removeProperty('--orb-scale-hidden');
      overlay.dataset.orbLayoutKey = '';
      overlay.dataset.orbPositionLocked = '';
      return;
    }

    const layoutKey = isPreviewOrb
      ? String(layout.scale ?? 1)
      : [layout.left, layout.top, layout.scale, layout.offsetX ?? '', layout.offsetY ?? ''].join('|');
    if (overlay.dataset.orbLayoutKey === layoutKey) {
      return;
    }
    overlay.dataset.orbLayoutKey = layoutKey;

    const visibleScale = Number(layout.scale) || 1;
    overlay.style.setProperty('--orb-scale-visible', visibleScale.toFixed(3));
    overlay.style.setProperty('--orb-scale-hidden', Math.max(0.88, visibleScale - 0.08).toFixed(3));

    if (isPreviewOrb) {
      return;
    }

    overlay.style.setProperty('--orb-left', `${layout.left.toFixed(2)}%`);
    overlay.style.setProperty('--orb-top', `${layout.top.toFixed(2)}px`);

    if (orbKind === 'moon' || orbKind === 'sun') {
      const isPreview = overlay.classList.contains('weather-orb-overlay--preview');
      const orbDefaults =
        orbKind === 'moon'
          ? isPreview
            ? HEADER_WEATHER_MOON_PREVIEW_LAYOUT
            : HEADER_WEATHER_MOON_DROPDOWN_LAYOUT
          : isPreview
            ? HEADER_WEATHER_SUN_PREVIEW_LAYOUT
            : HEADER_WEATHER_SUN_DROPDOWN_LAYOUT;
      const offsetX =
        typeof layout.offsetX === 'number'
          ? layout.offsetX
          : typeof orbDefaults?.offsetX === 'number'
            ? orbDefaults.offsetX
            : 0;
      const offsetY =
        typeof layout.offsetY === 'number'
          ? layout.offsetY
          : typeof orbDefaults?.offsetY === 'number'
            ? orbDefaults.offsetY
            : 0;
      overlay.style.setProperty('--orb-offset-x', `${offsetX}px`);
      overlay.style.setProperty('--orb-offset-y', `${offsetY}px`);
    } else {
      overlay.style.removeProperty('--orb-offset-x');
      overlay.style.removeProperty('--orb-offset-y');
    }
  }

  async function fetchHeaderWeatherCurrent(host, locationMeta) {
    const url = new URL(HEADER_WEATHER_CURRENT_ENDPOINT);
    url.searchParams.set('latitude', String(locationMeta.latitude));
    url.searchParams.set('longitude', String(locationMeta.longitude));
    url.searchParams.set(
      'current',
      [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(',')
    );
    url.searchParams.set('timezone', resolveHeaderWeatherTimeZone(host, locationMeta));

    const response = await fetch(url.toString(), {
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Current weather lookup failed with status ${response.status}.`);
    }

    const payload = await response.json();
    const current = payload?.current;
    if (!current) {
      throw new Error('Current weather lookup returned incomplete data.');
    }

    const pressureMsl = Number(current.pressure_msl);
    const surfacePressure = Number(current.surface_pressure);
    const windSpeedKph = Number(current.wind_speed_10m);

    return {
      weatherCode: Number(current.weather_code),
      cloudCover: Number(current.cloud_cover),
      precipitation: Number(current.precipitation),
      humidity: Number(current.relative_humidity_2m),
      temperature: Number(current.temperature_2m),
      apparentTemperature: Number(current.apparent_temperature),
      isDay: Number(current.is_day),
      pressureMsl: Number.isFinite(pressureMsl) ? pressureMsl : null,
      surfacePressure: Number.isFinite(surfacePressure) ? surfacePressure : null,
      windSpeedKph: Number.isFinite(windSpeedKph) ? windSpeedKph : null,
    };
  }

  async function resolveHeaderWeatherCurrent(host) {
    const locationLabel = getHeaderWeatherLocationLabel(host);
    const locationMeta = await resolveHeaderWeatherLocationMeta(locationLabel);
    if (!locationMeta) {
      return null;
    }

    const cacheKey = `${normalizeHeaderWeatherLocationKey(locationLabel)}:${locationMeta.latitude.toFixed(3)}:${locationMeta.longitude.toFixed(3)}`;
    const cachedEntry = headerWeatherCurrentCache.get(cacheKey);
    if (cachedEntry?.value && cachedEntry.expiresAt > Date.now()) {
      return cachedEntry.value;
    }

    if (cachedEntry?.promise) {
      return cachedEntry.promise;
    }

    const promise = (async () => {
      try {
        const resolvedValue = await fetchHeaderWeatherCurrent(host, locationMeta);
        headerWeatherCurrentCache.set(cacheKey, {
          value: resolvedValue,
          expiresAt: Date.now() + HEADER_WEATHER_CURRENT_CACHE_TTL,
        });
        return resolvedValue;
      } catch (error) {
        headerWeatherCurrentCache.delete(cacheKey);
        throw error;
      }
    })();

    headerWeatherCurrentCache.set(cacheKey, { promise });
    return promise;
  }

  async function syncHeaderWeatherPreciseLocationMeta(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    const locationQuery = host.dataset.weatherLocation || getHeaderWeatherLocationLabel(host);
    const locationMeta = await resolveHeaderWeatherLocationMeta(locationQuery).catch(() => null);
    if (!locationMeta) {
      return;
    }

    if (locationMeta.label) {
      const displayLocationLabel = formatHeaderWeatherCityDistrictDisplayLabel(locationMeta.label);
      const locationNodes = root.querySelectorAll('.weather-header-card__location, .weather-location-selector__city');
      locationNodes.forEach(node => {
        if (node && displayLocationLabel && displayLocationLabel !== node.textContent?.trim()) {
          node.textContent = displayLocationLabel;
        }
      });
    }

    if (locationMeta.regionLabel) {
      const normalizedRegionLabel = String(locationMeta.regionLabel).trim();
      if (normalizedRegionLabel) {
        host.dataset.weatherRegionLabel = normalizedRegionLabel;
        const metaNodes = root.querySelectorAll('.weather-header-card__meta, .weather-header-dropdown__hero-meta');
        const timeZone = resolveHeaderWeatherTimeZone(host, locationMeta);
        const nextMetaText = buildHeaderWeatherMetaText(timeZone, normalizedRegionLabel);
        metaNodes.forEach(node => {
          if (node) {
            node.textContent = nextMetaText;
          }
        });
      }
    }
  }

  function applyHeaderWeatherOrbAtmosphere(overlay, atmosphere) {
    if (!overlay) {
      return;
    }

    if (overlay.classList.contains('weather-orb-overlay--preview')) {
      overlay.classList.remove('has-cloud-veil');
      overlay.style.removeProperty('--orb-cloud-alpha');
      overlay.style.removeProperty('--orb-cloud-blur');
      overlay.style.removeProperty('--orb-cloud-stretch-x');
      overlay.style.removeProperty('--orb-cloud-stretch-y');
      overlay.style.removeProperty('--orb-cloud-drift');
      overlay.style.removeProperty('--orb-cloud-lift');
      overlay.style.removeProperty('--orb-cloud-depth-alpha');
      overlay.style.removeProperty('--orb-cloud-highlight-alpha');
      if (overlay.classList.contains('is-sun') && atmosphere && typeof atmosphere === 'object') {
        const coreOpacity = clampHeaderWeatherValue(Number(atmosphere.coreOpacity) || 1, 0.86, 1);
        overlay.style.setProperty('--orb-core-opacity', coreOpacity.toFixed(3));
      } else {
        overlay.style.removeProperty('--orb-core-opacity');
      }
      return;
    }

    if (!HEADER_WEATHER_CLOUDS_ENABLED) {
      overlay.classList.remove('has-cloud-veil');
      overlay.style.removeProperty('--orb-cloud-alpha');
      overlay.style.removeProperty('--orb-core-opacity');
      overlay.style.removeProperty('--orb-cloud-blur');
      overlay.style.removeProperty('--orb-cloud-stretch-x');
      overlay.style.removeProperty('--orb-cloud-stretch-y');
      overlay.style.removeProperty('--orb-cloud-drift');
      overlay.style.removeProperty('--orb-cloud-lift');
      overlay.style.removeProperty('--orb-cloud-depth-alpha');
      overlay.style.removeProperty('--orb-cloud-highlight-alpha');
      return;
    }

    if (overlay.classList.contains('is-moon')) {
      overlay.classList.remove('has-cloud-veil');
      overlay.style.removeProperty('--orb-cloud-alpha');
      overlay.style.removeProperty('--orb-core-opacity');
      overlay.style.removeProperty('--orb-cloud-blur');
      overlay.style.removeProperty('--orb-cloud-stretch-x');
      overlay.style.removeProperty('--orb-cloud-stretch-y');
      overlay.style.removeProperty('--orb-cloud-drift');
      overlay.style.removeProperty('--orb-cloud-lift');
      overlay.style.removeProperty('--orb-cloud-depth-alpha');
      overlay.style.removeProperty('--orb-cloud-highlight-alpha');
      return;
    }

    const isSunOverlay = overlay.classList.contains('is-sun');
    const normalizedAtmosphere =
      atmosphere && typeof atmosphere === 'object'
        ? atmosphere
        : {
            alpha: Number(atmosphere) || 0,
          };
    let resolvedCloudiness = clampHeaderWeatherValue(Number(normalizedAtmosphere.alpha) || 0, 0, 0.92);
    if (isSunOverlay) {
      resolvedCloudiness = clampHeaderWeatherValue(resolvedCloudiness, 0, 0.5);
    }
    overlay.classList.toggle('has-cloud-veil', resolvedCloudiness > 0.03);

    if (resolvedCloudiness > 0.03) {
      overlay.style.setProperty('--orb-cloud-alpha', resolvedCloudiness.toFixed(3));
      overlay.style.setProperty(
        '--orb-core-opacity',
        clampHeaderWeatherValue(
          Number(normalizedAtmosphere.coreOpacity) || Math.max(0.88, 1 - resolvedCloudiness * 0.08),
          0.86,
          1
        ).toFixed(3)
      );
      overlay.style.setProperty('--orb-cloud-blur', `${Math.round(Number(normalizedAtmosphere.blur) || 18)}px`);
      overlay.style.setProperty(
        '--orb-cloud-stretch-x',
        clampHeaderWeatherValue(Number(normalizedAtmosphere.stretchX) || 1.16, 0.92, 1.36).toFixed(3)
      );
      overlay.style.setProperty(
        '--orb-cloud-stretch-y',
        clampHeaderWeatherValue(Number(normalizedAtmosphere.stretchY) || 0.84, 0.7, 1).toFixed(3)
      );
      overlay.style.setProperty(
        '--orb-cloud-drift',
        clampHeaderWeatherValue(Number(normalizedAtmosphere.drift) || 1, 0.72, 1.24).toFixed(3)
      );
      overlay.style.setProperty('--orb-cloud-lift', `${Math.round(Number(normalizedAtmosphere.lift) || 0)}px`);
      overlay.style.setProperty(
        '--orb-cloud-depth-alpha',
        clampHeaderWeatherValue(Number(normalizedAtmosphere.depthAlpha) || 0.24, 0.08, 0.42).toFixed(3)
      );
      overlay.style.setProperty(
        '--orb-cloud-highlight-alpha',
        clampHeaderWeatherValue(Number(normalizedAtmosphere.highlightAlpha) || 0.16, 0.06, 0.28).toFixed(3)
      );
      return;
    }

    overlay.style.removeProperty('--orb-cloud-alpha');
    overlay.style.removeProperty('--orb-core-opacity');
    overlay.style.removeProperty('--orb-cloud-blur');
    overlay.style.removeProperty('--orb-cloud-stretch-x');
    overlay.style.removeProperty('--orb-cloud-stretch-y');
    overlay.style.removeProperty('--orb-cloud-drift');
    overlay.style.removeProperty('--orb-cloud-lift');
    overlay.style.removeProperty('--orb-cloud-depth-alpha');
    overlay.style.removeProperty('--orb-cloud-highlight-alpha');
  }

  function ensureHeaderWeatherToggleArrowBase(host) {
    const toggleIcon = host?.shadowRoot?.querySelector('.weather-header-card__toggle-icon');
    if (!toggleIcon || toggleIcon.dataset.arrowBaseReady === 'true') {
      return toggleIcon;
    }

    toggleIcon.dataset.arrowBaseReady = 'true';
    toggleIcon.textContent = '';
    toggleIcon.setAttribute('aria-hidden', 'true');
    toggleIcon.style.setProperty(
      'background-image',
      "url('/assets/images/icon-pak/Gotovie%20iconki%20dlya%20saita/unter.png')",
      'important'
    );
    toggleIcon.style.setProperty('background-position', 'center', 'important');
    toggleIcon.style.setProperty('background-repeat', 'no-repeat', 'important');
    toggleIcon.style.setProperty('background-size', 'contain', 'important');
    toggleIcon.style.setProperty('width', '7.906px', 'important');
    toggleIcon.style.setProperty('height', '7.906px', 'important');
    toggleIcon.style.setProperty('position', 'absolute', 'important');
    toggleIcon.style.setProperty('right', '-9.906px', 'important');
    toggleIcon.style.setProperty('top', 'auto', 'important');
    toggleIcon.style.setProperty('bottom', '-1px', 'important');
    toggleIcon.style.setProperty('margin-top', '0', 'important');
    toggleIcon.style.setProperty('opacity', '0.9', 'important');
    toggleIcon.style.setProperty('visibility', 'visible', 'important');
    toggleIcon.style.setProperty('transform-origin', '50% 100%', 'important');
    toggleIcon.style.setProperty('font-size', '0', 'important');
    toggleIcon.style.setProperty('line-height', '0', 'important');
    toggleIcon.style.setProperty('--arrow-shift-x', '0px', 'important');
    toggleIcon.style.setProperty('will-change', 'transform', 'important');
    toggleIcon.style.setProperty(
      'transition',
      'transform 0.44s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease',
      'important'
    );

    return toggleIcon;
  }

  function syncHeaderWeatherToggleArrow(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    const trigger = root.querySelector('.weather-header-trigger');
    const toggleIcon = ensureHeaderWeatherToggleArrowBase(host);
    if (!toggleIcon) {
      return;
    }

    const expanded = trigger?.getAttribute('aria-expanded') === 'true' || host.dataset.weatherExpanded === 'true';

    toggleIcon.classList.toggle('is-open', expanded);
    toggleIcon.style.setProperty(
      '--arrow-rotate',
      expanded ? HEADER_WEATHER_TOGGLE_ARROW_OPEN : HEADER_WEATHER_TOGGLE_ARROW_CLOSED,
      'important'
    );
    toggleIcon.style.removeProperty('transform');
  }

  function enforceHeaderWeatherToggleArrow(host) {
    syncHeaderWeatherToggleArrow(host);
  }

  function applyHeaderWeatherEqualMetricSpacing(rightColumn) {
    if (!(rightColumn instanceof HTMLElement)) {
      return;
    }

    const metricNodes = Array.from(
      rightColumn.querySelectorAll(':scope > .weather-header-card__condition, :scope > .weather-header-card__chip')
    ).filter(node => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      const hiddenByDisplay = node.style.getPropertyValue('display') === 'none';
      const hiddenByVisibility = node.style.getPropertyValue('visibility') === 'hidden';
      const ariaHidden = node.getAttribute('aria-hidden') === 'true';
      return !hiddenByDisplay && !hiddenByVisibility && !ariaHidden;
    });

    if (metricNodes.length <= 1) {
      rightColumn.style.setProperty('justify-content', 'flex-start', 'important');
      rightColumn.style.setProperty('row-gap', '0', 'important');
      return;
    }

    const containerHeight = rightColumn.getBoundingClientRect().height || 0;
    const occupiedHeight = metricNodes.reduce((sum, node) => sum + (node.getBoundingClientRect().height || 0), 0);
    const freeHeight = Math.max(0, containerHeight - occupiedHeight);
    const equalGap = freeHeight / (metricNodes.length - 1);
    const normalizedGap = Number.isFinite(equalGap) ? Math.max(0, Math.round(equalGap * 100) / 100) : 0;

    rightColumn.style.setProperty('justify-content', 'flex-start', 'important');
    rightColumn.style.setProperty('row-gap', `${normalizedGap}px`, 'important');
  }

  function syncHeaderWeatherRightColumnAlign(host, layoutRefs) {
    const { rightColumn, condition, pressureChip, humidityChip } = layoutRefs || {};
    if (!(rightColumn instanceof HTMLElement)) {
      return;
    }

    const cardVerticalInsetPx = Number.isFinite(Number(host?.__weatherCardVerticalInsetPx))
      ? Math.max(0, Number(host.__weatherCardVerticalInsetPx))
      : 0;

    const legacyMetricsBlock = rightColumn.querySelector('.weather-header-card__metrics-block');
    if (legacyMetricsBlock instanceof HTMLElement) {
      Array.from(legacyMetricsBlock.children).forEach(child => {
        if (child instanceof HTMLElement) {
          rightColumn.appendChild(child);
        }
      });
      legacyMetricsBlock.remove();
    }

    const mountNode = (node, order) => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      if (node.parentElement !== rightColumn) {
        rightColumn.appendChild(node);
      }

      node.dataset.weatherMetricOrder = String(order);
    };

    mountNode(condition, 1);
    mountNode(pressureChip, 2);
    mountNode(humidityChip, 3);

    [pressureChip, humidityChip].forEach(chip => {
      if (!(chip instanceof HTMLElement)) {
        return;
      }

      chip.style.setProperty('display', 'flex', 'important');
      chip.style.setProperty('visibility', 'visible', 'important');
      chip.style.setProperty('opacity', '1', 'important');
    });

    if (pressureChip instanceof HTMLElement) {
      pressureChip.dataset.weatherMetric = 'pressure';
    }

    if (humidityChip instanceof HTMLElement) {
      humidityChip.dataset.weatherMetric = 'humidity';
    }

    host.__weatherMetricsStructureReady = true;

    if (condition instanceof HTMLElement) {
      condition.style.setProperty('position', 'relative', 'important');
      condition.style.setProperty('top', 'auto', 'important');
      condition.style.setProperty('right', '0', 'important');
      condition.style.setProperty('bottom', 'auto', 'important');
      condition.style.setProperty('left', 'auto', 'important');
      condition.style.setProperty('transform', 'none', 'important');
      condition.style.setProperty('margin', '0', 'important');
    }

    [pressureChip, humidityChip].forEach(chip => {
      if (!(chip instanceof HTMLElement)) {
        return;
      }

      const isReferencePressure =
        chip.dataset.weatherPressureLayout === 'reference' ||
        chip.classList.contains('weather-header-card__chip--pressure-fallback') ||
        chip.dataset.weatherMetric === 'pressure';

      chip.style.setProperty('position', 'relative', 'important');
      chip.style.setProperty('top', 'auto', 'important');
      chip.style.setProperty('right', '0', 'important');
      chip.style.setProperty('bottom', 'auto', 'important');
      chip.style.setProperty('left', 'auto', 'important');
      chip.style.setProperty('transform', 'none', 'important');
      chip.style.setProperty('margin', '0', 'important');
      chip.style.setProperty('width', '100%', 'important');
      chip.style.setProperty('align-items', isReferencePressure ? 'flex-start' : 'flex-end', 'important');
    });

    rightColumn.style.setProperty('display', 'flex', 'important');
    rightColumn.style.setProperty('flex-direction', 'column', 'important');
    rightColumn.style.setProperty('position', 'absolute', 'important');
    rightColumn.style.setProperty('top', `${cardVerticalInsetPx}px`, 'important');
    rightColumn.style.setProperty('right', '8px', 'important');
    rightColumn.style.setProperty('bottom', `${cardVerticalInsetPx}px`, 'important');
    rightColumn.style.setProperty('left', 'auto', 'important');
    rightColumn.style.setProperty('height', 'auto', 'important');
    rightColumn.style.setProperty('min-height', `calc(100% - ${cardVerticalInsetPx * 2}px)`, 'important');
    rightColumn.style.setProperty('max-height', `calc(100% - ${cardVerticalInsetPx * 2}px)`, 'important');
    rightColumn.style.setProperty('justify-content', 'flex-start', 'important');
    rightColumn.style.setProperty('row-gap', '0', 'important');
    rightColumn.style.setProperty('align-items', 'flex-end', 'important');

    applyHeaderWeatherEqualMetricSpacing(rightColumn);
    window.requestAnimationFrame(() => applyHeaderWeatherEqualMetricSpacing(rightColumn));
  }

  function scheduleHeaderWeatherMenuPlacement(host) {
    if (!host) {
      return;
    }

    if (scheduleHeaderWeatherMenuPlacement.__frameId) {
      window.cancelAnimationFrame(scheduleHeaderWeatherMenuPlacement.__frameId);
    }

    scheduleHeaderWeatherMenuPlacement.__frameId = window.requestAnimationFrame(() => {
      scheduleHeaderWeatherMenuPlacement.__frameId = 0;
      enforceHeaderWeatherMenuPlacement(host);
    });
  }

  function bindHeaderWeatherLayoutObserver(host) {
    if (!host?.shadowRoot || host.__weatherLayoutObserver) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (host.__weatherPlacementApplying) {
        return;
      }
      scheduleHeaderWeatherMenuPlacement(host);
    });

    observer.observe(host.shadowRoot, {
      childList: true,
      subtree: true,
    });

    host.__weatherLayoutObserver = observer;
  }

  function resetHeaderWeatherPreviewLayoutState(host) {
    if (!host) {
      return;
    }

    host.__weatherPreviewLayoutReady = false;
    host.__weatherMetricsStructureReady = false;
    host.__weatherRightColumnAnchorWidth = 0;
    host.__weatherTextInsetLocked = undefined;
  }

  function scheduleHeaderBrandColumnAlign(hostOverride) {
    if (typeof window === 'undefined') {
      syncHeaderBrandColumnAlign(hostOverride);
      return;
    }

    if (scheduleHeaderBrandColumnAlign.__frameId) {
      window.cancelAnimationFrame(scheduleHeaderBrandColumnAlign.__frameId);
    }

    scheduleHeaderBrandColumnAlign.__frameId = window.requestAnimationFrame(() => {
      scheduleHeaderBrandColumnAlign.__frameId = 0;
      syncHeaderBrandColumnAlign(hostOverride);
    });
  }

  function ensureHeaderWeatherInfoPanel(root, topRow, titleBlock, bottom) {
    const panelHost =
      topRow instanceof HTMLElement
        ? topRow
        : titleBlock?.parentElement instanceof HTMLElement
          ? titleBlock.parentElement
          : root.querySelector('.weather-header-card__content') instanceof HTMLElement
            ? root.querySelector('.weather-header-card__content')
            : root.querySelector('.weather-header-card') instanceof HTMLElement
              ? root.querySelector('.weather-header-card')
              : null;

    if (!(panelHost instanceof HTMLElement)) {
      return null;
    }

    const duplicatePanels = Array.from(
      root.querySelectorAll('.weather-header-card__info-panel, .weather-header-card__left-stack')
    );
    let infoPanel = duplicatePanels[0] instanceof HTMLElement ? duplicatePanels[0] : null;

    duplicatePanels.slice(1).forEach(panel => {
      if (!(panel instanceof HTMLElement)) {
        return;
      }
      while (panel.firstChild) {
        if (infoPanel instanceof HTMLElement) {
          infoPanel.appendChild(panel.firstChild);
        } else {
          panel.firstChild.remove();
        }
      }
      panel.remove();
    });

    if (!(infoPanel instanceof HTMLElement)) {
      infoPanel = document.createElement('div');
      infoPanel.className = 'weather-header-card__info-panel weather-header-card__left-stack';
    } else if (!infoPanel.classList.contains('weather-header-card__info-panel')) {
      infoPanel.classList.add('weather-header-card__info-panel');
    }

    if (infoPanel.parentElement !== panelHost) {
      panelHost.insertBefore(infoPanel, panelHost.firstChild);
    }

    const titleBlocks = Array.from(root.querySelectorAll('.weather-header-card__title-block'));
    titleBlocks.forEach((block, index) => {
      if (!(block instanceof HTMLElement)) {
        return;
      }
      if (index === 0) {
        if (block.parentElement !== infoPanel) {
          infoPanel.appendChild(block);
        }
        return;
      }
      block.remove();
    });

    if (titleBlock instanceof HTMLElement && titleBlock.parentElement !== infoPanel) {
      infoPanel.appendChild(titleBlock);
    }

    let tempRow = infoPanel.querySelector('.weather-header-card__temp-row');
    if (!(tempRow instanceof HTMLElement)) {
      tempRow = document.createElement('div');
      tempRow.className = 'weather-header-card__temp-row';
    }

    if (bottom instanceof HTMLElement) {
      const temperature = bottom.querySelector('.weather-header-card__temperature');
      const chips = bottom.querySelector('.weather-header-card__chips');
      if (temperature instanceof HTMLElement && temperature.parentElement !== tempRow) {
        tempRow.appendChild(temperature);
      }
      if (chips instanceof HTMLElement && chips.parentElement !== tempRow) {
        tempRow.appendChild(chips);
      }
      bottom.style.setProperty('display', 'none', 'important');
    }

    const panelTemperature = infoPanel.querySelector('.weather-header-card__temperature');
    const panelChips = infoPanel.querySelector('.weather-header-card__chips');
    if (panelTemperature instanceof HTMLElement && panelTemperature.parentElement !== tempRow) {
      tempRow.appendChild(panelTemperature);
    }
    if (panelChips instanceof HTMLElement && panelChips.parentElement !== tempRow) {
      tempRow.appendChild(panelChips);
    }

    if (tempRow.parentElement !== infoPanel) {
      infoPanel.appendChild(tempRow);
    }

    if (titleBlock instanceof HTMLElement && titleBlock.nextElementSibling !== tempRow) {
      infoPanel.appendChild(tempRow);
    }

    return infoPanel;
  }

  function ensureHeaderWeatherMenuToggleAnchor(root, card) {
    const toggle = root.querySelector('.weather-header-card__toggle');
    const anchor = card instanceof HTMLElement ? card : root.querySelector('.weather-header-card');
    if (!(toggle instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
      return null;
    }

    if (toggle.parentElement !== anchor) {
      anchor.appendChild(toggle);
    }

    toggle.style.setProperty('position', 'absolute', 'important');
    toggle.style.setProperty('left', '50%', 'important');
    toggle.style.setProperty('right', 'auto', 'important');
    toggle.style.setProperty('top', 'auto', 'important');
    toggle.style.setProperty('bottom', 'var(--header-weather-menu-toggle-bottom, -6px)', 'important');
    toggle.style.setProperty('transform', 'translateX(-50%)', 'important');
    toggle.style.setProperty('z-index', '130', 'important');
    toggle.style.setProperty('margin', '0', 'important');
    toggle.style.setProperty('pointer-events', 'auto', 'important');

    return toggle;
  }

  function syncHeaderWeatherLeftTextColumn(host, layoutRefs) {
    const {
      eyebrow,
      titleBlock,
      locationRow,
      locationLabel,
      meta,
      tempRow,
      locationCurrent,
      infoPanel,
      feelsLikeChip,
    } = layoutRefs || {};

    const resetNode = node => {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      node.style.setProperty('margin-left', '0', 'important');
      node.style.setProperty('margin-right', '0', 'important');
      node.style.setProperty('padding-left', '0', 'important');
      node.style.setProperty('transform', 'none', 'important');
    };

    resetNode(infoPanel);
    resetNode(titleBlock);
    resetNode(eyebrow);
    resetNode(locationRow);
    resetNode(locationLabel);
    resetNode(locationCurrent);
    resetNode(meta);
    resetNode(tempRow);
    if (feelsLikeChip instanceof HTMLElement && feelsLikeChip.dataset.weatherFeelsLayout !== 'custom') {
      resetNode(feelsLikeChip);
    }

    if (meta instanceof HTMLElement) {
      meta.style.setProperty('display', 'block', 'important');
      meta.style.setProperty('width', 'auto', 'important');
      meta.style.setProperty('max-width', '100%', 'important');
      meta.style.setProperty('text-align', 'left', 'important');
    }

    if (tempRow instanceof HTMLElement) {
      tempRow.style.setProperty('position', 'relative', 'important');
      tempRow.style.setProperty('left', '0', 'important');
      tempRow.style.setProperty('right', 'auto', 'important');
      tempRow.style.setProperty('bottom', 'auto', 'important');
      const temperatureNode = tempRow.querySelector('.weather-header-card__temperature');
      resetNode(temperatureNode);
      const tempValueNode = tempRow.querySelector('.weather-header-card__temperature-value');
      resetNode(tempValueNode);
    }

    if (feelsLikeChip instanceof HTMLElement && feelsLikeChip.dataset.weatherFeelsLayout !== 'custom') {
      feelsLikeChip.style.setProperty('margin-left', '0', 'important');
      feelsLikeChip.style.setProperty('padding-left', '0', 'important');
      feelsLikeChip.style.removeProperty('width');
      feelsLikeChip.style.removeProperty('min-width');
      feelsLikeChip.style.removeProperty('max-width');
    }
  }

  function ensureHeaderWeatherPreviewMetricsVisible(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return false;
    }

    const metricsRoot =
      root.querySelector('.weather-header-card__right-column') ||
      root.querySelector('.weather-header-card__metrics-block');
    const hasPressure =
      metricsRoot?.querySelector('[data-weather-metric="pressure"], .weather-header-card__chip--pressure-fallback') ||
      null;
    const hasHumidity =
      metricsRoot?.querySelector('[data-weather-metric="humidity"], .weather-header-card__chip--humidity-fallback') ||
      null;
    const hasCondition = metricsRoot?.querySelector('.weather-header-card__condition');

    if (hasPressure && hasHumidity && hasCondition) {
      return true;
    }

    host.__weatherPreviewLayoutReady = false;
    host.__weatherMetricsStructureReady = false;
    enforceHeaderWeatherMenuPlacement(host);
    return Boolean(
      metricsRoot?.querySelector('[data-weather-metric="pressure"], .weather-header-card__chip--pressure-fallback')
    );
  }

  function sanitizeHeaderWeatherBottomRow(tempRow, chips) {
    if (!(tempRow instanceof HTMLElement)) {
      return null;
    }

    Array.from(tempRow.querySelectorAll('.weather-header-card__chip')).forEach(chip => {
      const chipText = (chip.textContent || '').toLowerCase();
      const isFeelsLike = /gef|ощущ|feels|відчува/.test(chipText);
      const isWind = /wind|ветер|вітер/.test(chipText);
      const isMetric = /pressure|давлен|тиск|druck|presion|humid|влаж|feucht|волог|umid|humedad/.test(chipText);

      if (isWind || isMetric) {
        if (chips instanceof HTMLElement) {
          chips.appendChild(chip);
        } else {
          chip.remove();
        }
        chip.style.setProperty('display', 'none', 'important');
        return;
      }

      if (!isFeelsLike) {
        chip.remove();
      }
    });

    const feelsCandidates = Array.from(
      tempRow.querySelectorAll('.weather-header-card__chip--feels-like, .weather-header-card__chip')
    ).filter(chip => /gef|ощущ|feels|відчува/i.test(chip.textContent || ''));

    const primary = feelsCandidates[0] || null;
    feelsCandidates.slice(1).forEach(chip => chip.remove());

    if (primary instanceof HTMLElement) {
      primary.classList.add('weather-header-card__chip--feels-like');
      primary.style.removeProperty('display');
      primary.style.setProperty('display', 'flex', 'important');
      primary.style.setProperty('visibility', 'visible', 'important');
      primary.style.setProperty('opacity', '1', 'important');
    }

    return primary;
  }

  function buildHeaderWeatherCelsiusUnitMarkup(numberText) {
    const numberNode = document.createElement('span');
    const unitNode = document.createElement('span');
    numberNode.className = 'weather-header-card__feels-temp-number';
    unitNode.className = 'weather-header-card__feels-temp-unit';
    numberNode.textContent = numberText;
    unitNode.textContent = HEADER_WEATHER_CELSIUS_SUFFIX;
    return { numberNode, unitNode };
  }

  function alignHeaderWeatherFeelsLikeRow(feelsLikeChip, labelEl, layoutRefs) {
    const { tempRow, root } = layoutRefs || {};
    if (!(feelsLikeChip instanceof HTMLElement) || !(labelEl instanceof HTMLElement)) {
      return;
    }

    const valueEl =
      feelsLikeChip.querySelector('.weather-header-card__feels-value, .weather-header-card__feels-row') || null;
    const prefixEl = valueEl?.querySelector('.weather-header-card__feels-prefix') || null;
    const tempEl = valueEl?.querySelector('.weather-header-card__feels-temp') || null;
    if (!(valueEl instanceof HTMLElement) || !(prefixEl instanceof HTMLElement) || !(tempEl instanceof HTMLElement)) {
      return;
    }

    const titleBlockNode =
      root instanceof ShadowRoot || root instanceof DocumentFragment
        ? root.querySelector('.weather-header-card__title-block')
        : null;
    const infoPanelNode =
      root instanceof ShadowRoot || root instanceof DocumentFragment
        ? root.querySelector('.weather-header-card__info-panel, .weather-header-card__left-stack')
        : null;
    const locationNode =
      root instanceof ShadowRoot || root instanceof DocumentFragment
        ? root.querySelector('.weather-header-card__location')
        : null;
    const locationRowNode =
      root instanceof ShadowRoot || root instanceof DocumentFragment
        ? root.querySelector('.weather-header-card__location-row')
        : null;
    const metaNode =
      root instanceof ShadowRoot || root instanceof DocumentFragment
        ? root.querySelector('.weather-header-card__meta')
        : null;

    if (titleBlockNode instanceof HTMLElement) {
      titleBlockNode.style.setProperty('display', 'flex', 'important');
      titleBlockNode.style.setProperty('flex-direction', 'column', 'important');
      titleBlockNode.style.setProperty('row-gap', '0px', 'important');
    }
    if (infoPanelNode instanceof HTMLElement) {
      infoPanelNode.style.setProperty('--weather-info-column-shift-x', '0px', 'important');
      infoPanelNode.style.setProperty('--weather-info-column-shift-y', '0px', 'important');
      infoPanelNode.style.setProperty('--weather-info-column-scale', '1', 'important');
      infoPanelNode.style.setProperty('display', 'flex', 'important');
      infoPanelNode.style.setProperty('flex-direction', 'column', 'important');
      infoPanelNode.style.setProperty('align-items', 'flex-start', 'important');
      infoPanelNode.style.setProperty('justify-content', 'flex-start', 'important');
      infoPanelNode.style.setProperty('transform-origin', 'top left', 'important');
      infoPanelNode.style.setProperty(
        'transform',
        'translate3d(var(--weather-info-column-shift-x, 0px), var(--weather-info-column-shift-y, 0px), 0) scale(var(--weather-info-column-scale, 1))',
        'important'
      );
      infoPanelNode.style.setProperty('row-gap', '0px', 'important');
    }
    if (locationRowNode instanceof HTMLElement) {
      locationRowNode.style.setProperty('margin', '0', 'important');
      locationRowNode.style.setProperty('min-height', 'auto', 'important');
    }
    if (locationNode instanceof HTMLElement) {
      locationNode.style.setProperty('margin', '0', 'important');
      locationNode.style.setProperty('padding-bottom', '0px', 'important');
    }
    if (metaNode instanceof HTMLElement) {
      metaNode.style.setProperty('margin-top', '4.4px', 'important');
      metaNode.style.setProperty('margin-bottom', '4.4px', 'important');
    }

    labelEl.style.setProperty('display', 'block', 'important');
    labelEl.style.setProperty('font-size', '5px', 'important');
    labelEl.style.setProperty('line-height', '5px', 'important');
    labelEl.style.setProperty('letter-spacing', '0.7px', 'important');
    labelEl.style.setProperty('font-weight', '400', 'important');
    labelEl.style.setProperty('margin', '0', 'important');
    labelEl.style.setProperty('opacity', '0.92', 'important');
    labelEl.style.setProperty('white-space', 'nowrap', 'important');
    labelEl.style.setProperty('text-align', 'left', 'important');

    valueEl.style.setProperty('display', 'flex', 'important');
    valueEl.style.setProperty('flex-direction', 'row', 'important');
    valueEl.style.setProperty('flex-wrap', 'nowrap', 'important');
    valueEl.style.setProperty('align-items', 'flex-end', 'important');
    valueEl.style.setProperty('justify-content', 'flex-start', 'important');
    valueEl.style.setProperty('column-gap', '4px', 'important');
    valueEl.style.setProperty('padding-left', '0', 'important');
    valueEl.style.setProperty('width', 'max-content', 'important');
    valueEl.style.setProperty('min-width', 'max-content', 'important');
    valueEl.style.setProperty('max-width', 'none', 'important');
    valueEl.style.setProperty('margin', '0', 'important');
    valueEl.style.setProperty('white-space', 'nowrap', 'important');
    valueEl.style.setProperty('word-break', 'keep-all', 'important');
    valueEl.style.setProperty('overflow-wrap', 'normal', 'important');
    valueEl.style.setProperty('overflow', 'visible', 'important');

    const tempValueAnchor =
      tempRow?.querySelector('.weather-header-card__temperature-value') ||
      feelsLikeChip
        .closest('.weather-header-card__temp-row')
        ?.querySelector('.weather-header-card__temperature-value') ||
      null;
    const chipsNode =
      feelsLikeChip.parentElement instanceof HTMLElement &&
      feelsLikeChip.parentElement.classList.contains('weather-header-card__chips')
        ? feelsLikeChip.parentElement
        : tempRow?.querySelector('.weather-header-card__chips') || null;

    if (tempRow instanceof HTMLElement) {
      tempRow.style.setProperty('align-items', 'end', 'important');
    }

    if (chipsNode instanceof HTMLElement) {
      chipsNode.style.setProperty('display', 'flex', 'important');
      chipsNode.style.setProperty('align-self', 'end', 'important');
      chipsNode.style.setProperty('align-items', 'flex-end', 'important');
      chipsNode.style.setProperty('justify-content', 'flex-start', 'important');
      chipsNode.style.setProperty('line-height', '1', 'important');
      chipsNode.style.setProperty('font-size', 'inherit', 'important');
      chipsNode.style.setProperty('margin-top', '0', 'important');
      chipsNode.style.setProperty('user-select', 'text', 'important');
      chipsNode.style.setProperty('-webkit-user-select', 'text', 'important');
      chipsNode.style.setProperty('pointer-events', 'auto', 'important');
      chipsNode.style.removeProperty('width');
      chipsNode.style.removeProperty('min-width');
    }

    feelsLikeChip.style.setProperty('display', 'inline-flex', 'important');
    feelsLikeChip.style.setProperty('flex-direction', 'column', 'important');
    feelsLikeChip.style.setProperty('align-self', 'end', 'important');
    feelsLikeChip.style.setProperty('transform', 'none', 'important');

    feelsLikeChip.style.setProperty('gap', '2px', 'important');
    feelsLikeChip.style.setProperty('row-gap', '2px', 'important');
    feelsLikeChip.style.setProperty('margin-top', '0', 'important');
    feelsLikeChip.style.setProperty('height', 'auto', 'important');
    feelsLikeChip.style.setProperty('min-height', '0', 'important');
    feelsLikeChip.style.setProperty('max-height', 'none', 'important');
    feelsLikeChip.style.setProperty('justify-content', 'flex-start', 'important');
    feelsLikeChip.style.setProperty('align-content', 'flex-start', 'important');
    feelsLikeChip.style.setProperty('box-sizing', 'border-box', 'important');
    feelsLikeChip.style.setProperty('padding', '0', 'important');
    feelsLikeChip.style.setProperty('background', 'none', 'important');
    feelsLikeChip.style.setProperty('border', 'none', 'important');
    feelsLikeChip.style.setProperty('border-radius', '0', 'important');
    feelsLikeChip.style.setProperty('user-select', 'text', 'important');
    feelsLikeChip.style.setProperty('-webkit-user-select', 'text', 'important');
    feelsLikeChip.style.setProperty('pointer-events', 'auto', 'important');
    valueEl.style.setProperty('margin-top', '0', 'important');
    valueEl.style.setProperty('align-self', 'flex-start', 'important');
    valueEl.style.setProperty('user-select', 'text', 'important');
    valueEl.style.setProperty('-webkit-user-select', 'text', 'important');
    valueEl.style.setProperty('pointer-events', 'auto', 'important');
    labelEl.style.setProperty('flex-shrink', '0', 'important');
    labelEl.style.setProperty('width', 'max-content', 'important');

    prefixEl.style.setProperty('display', 'inline-block', 'important');
    prefixEl.style.setProperty('text-transform', 'uppercase', 'important');
    prefixEl.style.setProperty('font-weight', '400', 'important');
    prefixEl.style.setProperty('font-size', '5px', 'important');
    prefixEl.style.setProperty('line-height', '5px', 'important');
    prefixEl.style.setProperty('letter-spacing', '0.7px', 'important');
    prefixEl.style.setProperty('opacity', '0.92', 'important');
    prefixEl.style.setProperty('margin', '0', 'important');
    prefixEl.style.setProperty('padding', '0', 'important');
    prefixEl.style.setProperty('flex', '0 0 auto', 'important');

    const tempComputed = tempValueAnchor ? window.getComputedStyle(tempValueAnchor) : null;
    const tempFontSizePx = Math.max(
      10.5,
      Math.min(
        13.5,
        (tempComputed
          ? Number.parseFloat(tempComputed.fontSize) || HEADER_WEATHER_TEMP_VALUE_SIZE_PX
          : HEADER_WEATHER_TEMP_VALUE_SIZE_PX) *
          0.55 -
          HEADER_WEATHER_FEELS_TEMP_SHRINK_PX
      )
    );

    const tempNumberNode = tempEl.querySelector('.weather-header-card__feels-temp-number');
    const tempUnitNode = tempEl.querySelector('.weather-header-card__feels-temp-unit');
    const mutedColor = HEADER_WEATHER_FEELS_MUTED_COLOR;
    const mainTempColor =
      tempValueAnchor instanceof HTMLElement
        ? window.getComputedStyle(tempValueAnchor).color
        : 'rgb(255 246 228 / 0.94)';

    tempEl.style.setProperty('display', 'inline-flex', 'important');
    tempEl.style.setProperty('flex-direction', 'row', 'important');
    tempEl.style.setProperty('flex-wrap', 'nowrap', 'important');
    tempEl.style.setProperty('align-items', 'flex-end', 'important');
    tempEl.style.setProperty('margin-left', '0', 'important');
    tempEl.style.setProperty('text-align', 'left', 'important');
    tempEl.style.setProperty('font-weight', '200', 'important');
    tempEl.style.setProperty('font-size', `${tempFontSizePx.toFixed(2)}px`, 'important');
    tempEl.style.setProperty('line-height', `${tempFontSizePx.toFixed(2)}px`, 'important');
    tempEl.style.setProperty('letter-spacing', `${HEADER_WEATHER_FEELS_TEMP_LETTER_SPACING_EM}em`, 'important');
    tempEl.style.setProperty('font-variant-numeric', 'tabular-nums', 'important');
    tempEl.style.setProperty('white-space', 'nowrap', 'important');
    tempEl.style.setProperty('flex', '0 0 auto', 'important');
    tempEl.style.setProperty('color', mainTempColor, 'important');
    tempEl.style.setProperty('user-select', 'text', 'important');
    tempEl.style.setProperty('-webkit-user-select', 'text', 'important');
    tempEl.style.setProperty('pointer-events', 'auto', 'important');
    if (tempComputed) {
      tempEl.style.setProperty('font-family', tempComputed.fontFamily, 'important');
    }

    labelEl.style.setProperty('color', mutedColor, 'important');
    prefixEl.style.setProperty('color', mutedColor, 'important');

    if (tempNumberNode instanceof HTMLElement) {
      tempNumberNode.style.setProperty('display', 'inline-block', 'important');
      tempNumberNode.style.setProperty('font-size', '1em', 'important');
      tempNumberNode.style.setProperty('line-height', '1', 'important');
      tempNumberNode.style.setProperty('font-weight', '200', 'important');
      tempNumberNode.style.setProperty('vertical-align', 'baseline', 'important');
      tempNumberNode.style.setProperty(
        'letter-spacing',
        `${HEADER_WEATHER_FEELS_TEMP_LETTER_SPACING_EM}em`,
        'important'
      );
      tempNumberNode.style.setProperty('font-variant-numeric', 'tabular-nums', 'important');
      tempNumberNode.style.setProperty('color', mainTempColor, 'important');
      tempNumberNode.style.setProperty('user-select', 'text', 'important');
      tempNumberNode.style.setProperty('-webkit-user-select', 'text', 'important');
      tempNumberNode.style.setProperty('pointer-events', 'auto', 'important');
    }

    if (tempUnitNode instanceof HTMLElement) {
      tempUnitNode.style.setProperty('color', mainTempColor, 'important');
      tempUnitNode.style.setProperty('opacity', '0.9', 'important');
      tempUnitNode.style.setProperty('user-select', 'text', 'important');
      tempUnitNode.style.setProperty('-webkit-user-select', 'text', 'important');
      tempUnitNode.style.setProperty('pointer-events', 'auto', 'important');
    }

    feelsLikeChip.style.removeProperty('width');
    feelsLikeChip.style.setProperty('min-width', 'max-content', 'important');
    feelsLikeChip.style.setProperty('max-width', 'none', 'important');
    feelsLikeChip.style.setProperty('align-items', 'flex-start', 'important');
    if (chipsNode instanceof HTMLElement) {
      chipsNode.style.removeProperty('width');
      chipsNode.style.setProperty('min-width', 'max-content', 'important');
    }

    const syncFeelsVerticalCenter = () => {
      const mainTempNode =
        tempRow?.querySelector('.weather-header-card__temperature') ||
        feelsLikeChip.closest('.weather-header-card__temp-row')?.querySelector('.weather-header-card__temperature') ||
        null;

      syncHeaderWeatherFeelsBaseline(feelsLikeChip, mainTempNode, valueEl);

      if (chipsNode instanceof HTMLElement) {
        chipsNode.style.setProperty('margin-top', '0', 'important');
      }
    };

    const findTitleBlockNode = () =>
      feelsLikeChip.closest('.weather-header-card')?.querySelector('.weather-header-card__title-block') || null;

    const syncFeelsHorizontalAnchor = () => {
      const titleBlockNode = findTitleBlockNode();
      if (!(titleBlockNode instanceof HTMLElement)) {
        feelsLikeChip.style.setProperty('margin-left', '0', 'important');
        labelEl.style.setProperty('transform', 'none', 'important');
        return;
      }

      const activeLang = normalizeLangCode(document.documentElement.lang || 'ru');
      const labelBox = titleBlockNode.getBoundingClientRect();

      applyHeaderWeatherFeelsReferencePresetLayout({
        feelsLikeChip,
        valueEl,
        labelBox,
        lang: activeLang,
      });

      const tempWidth = tempEl.getBoundingClientRect().width || 0;
      const blockWidth = valueEl.getBoundingClientRect().width || 0;
      const prefixMaxWidth = Math.max(10, blockWidth - tempWidth - 2);
      fitHeaderWeatherInlineTextWidth(labelEl, blockWidth, 3.8);
      fitHeaderWeatherInlineTextWidth(prefixEl, prefixMaxWidth, 3.6);

      // Keep label geometry stable; horizontal anchor is handled by chip alignment.
      labelEl.style.setProperty('transform', 'none', 'important');
    };

    const syncFeelsLayoutMetrics = () => {
      syncFeelsHorizontalAnchor();
      syncFeelsVerticalCenter();
      if (tempUnitNode instanceof HTMLElement && tempNumberNode instanceof HTMLElement) {
        syncHeaderWeatherCelsiusUnitTopToDigit(tempUnitNode, tempNumberNode);
      }
      const mainUnitNode =
        tempRow?.querySelector('.weather-header-card__temperature-unit') ||
        feelsLikeChip
          .closest('.weather-header-card__temp-row')
          ?.querySelector('.weather-header-card__temperature-unit') ||
        null;
      if (mainUnitNode instanceof HTMLElement && tempValueAnchor instanceof HTMLElement) {
        syncHeaderWeatherCelsiusUnitTopToDigit(mainUnitNode, tempValueAnchor);
      }
      syncFeelsVerticalCenter();
    };

    runHeaderWeatherPostLayoutPass(syncFeelsLayoutMetrics, 2);

    const titleBlockNodeForObserver = findTitleBlockNode();
    setupHeaderWeatherFeelsLayoutAutoSync({
      feelsLikeChip,
      syncLayout: syncFeelsLayoutMetrics,
      observeRoot: root,
      observeNodes: [
        feelsLikeChip,
        labelEl,
        valueEl,
        prefixEl,
        tempEl,
        tempRow,
        chipsNode,
        tempValueAnchor,
        titleBlockNodeForObserver,
      ],
    });
  }

  function applyHeaderWeatherFeelsLikePreview(host, layoutRefs) {
    const { tempRow, chips, root, infoPanel } = layoutRefs || {};
    const workingTempRow =
      tempRow instanceof HTMLElement
        ? tempRow
        : root instanceof ShadowRoot || root instanceof DocumentFragment
          ? root.querySelector('.weather-header-card__bottom')
          : null;

    if (!(workingTempRow instanceof HTMLElement)) {
      return null;
    }

    const feelsLikeChip =
      sanitizeHeaderWeatherBottomRow(workingTempRow, chips) ||
      workingTempRow.querySelector('.weather-header-card__chip--feels-like') ||
      (root instanceof ShadowRoot || root instanceof DocumentFragment
        ? root.querySelector('.weather-header-card__chip--feels-like')
        : null) ||
      null;

    if (!(feelsLikeChip instanceof HTMLElement)) {
      return null;
    }

    const tempRowChips = workingTempRow.querySelector('.weather-header-card__chips');
    if (infoPanel instanceof HTMLElement) {
      const strandedFeels = infoPanel.querySelector(
        ':scope > .weather-header-card__chip--feels-like, .weather-header-card__left-stack > .weather-header-card__chip--feels-like'
      );
      if (strandedFeels instanceof HTMLElement && tempRowChips instanceof HTMLElement) {
        tempRowChips.appendChild(strandedFeels);
      }
    }

    if (tempRowChips instanceof HTMLElement && feelsLikeChip.parentElement !== tempRowChips) {
      tempRowChips.appendChild(feelsLikeChip);
    }

    feelsLikeChip.classList.add('weather-header-card__chip--feels-like');
    feelsLikeChip.dataset.weatherMetric = 'feels';
    feelsLikeChip.dataset.weatherFeelsLayout = 'custom';
    feelsLikeChip.dataset.weatherTypographyReady = 'true';
    feelsLikeChip.style.removeProperty('left');
    feelsLikeChip.style.removeProperty('top');
    feelsLikeChip.style.removeProperty('right');
    feelsLikeChip.style.removeProperty('bottom');
    feelsLikeChip.style.setProperty('position', 'relative', 'important');

    const feelsLikeRawText = (feelsLikeChip.textContent || '').replace(/\s+/g, ' ').trim();
    const feelsLikeMatch = feelsLikeRawText.match(/(-?\d{1,2})(?:\s*\u00b0\s*[CcСс])?/);
    const apparentTemperature = Number(host?.__weatherCurrentMeta?.apparentTemperature);
    const fallbackFeelsLike = Number.isFinite(apparentTemperature) ? Math.round(apparentTemperature) : null;
    const feelsLikeLang = (document.documentElement.lang || 'ru').toLowerCase();
    const feelsLikeTextByLang = {
      ru: { label: 'ОЩУЩАЕТСЯ', prefix: 'КАК' },
      uk: { label: 'ВІДЧУВАЄТЬСЯ', prefix: 'ЯК' },
      de: { label: 'GEFÜHLT', prefix: 'WIE' },
      en: { label: 'FEELS', prefix: 'LIKE' },
    };
    const feelsLikeText = feelsLikeTextByLang[feelsLikeLang] || feelsLikeTextByLang.en;
    const feelsLikeNumericMatch =
      fallbackFeelsLike !== null ? String(fallbackFeelsLike) : feelsLikeMatch ? feelsLikeMatch[1] : null;
    const feelsLikeNumber = feelsLikeNumericMatch || '--';

    const labelEl = document.createElement('span');
    labelEl.className = 'weather-header-card__feels-label';
    labelEl.textContent = feelsLikeText.label;
    labelEl.style.setProperty('text-transform', 'uppercase', 'important');

    const valueEl = document.createElement('span');
    valueEl.className = 'weather-header-card__feels-value weather-header-card__feels-row';

    const prefixEl = document.createElement('span');
    prefixEl.className = 'weather-header-card__feels-prefix';
    prefixEl.textContent = feelsLikeText.prefix;

    const tempEl = document.createElement('span');
    tempEl.className = 'weather-header-card__feels-temp';
    const { numberNode, unitNode } = buildHeaderWeatherCelsiusUnitMarkup(feelsLikeNumber);
    tempEl.append(numberNode, unitNode);

    valueEl.append(prefixEl, tempEl);
    feelsLikeChip.replaceChildren(labelEl, valueEl);

    alignHeaderWeatherFeelsLikeRow(feelsLikeChip, labelEl, {
      root,
      tempRow: workingTempRow,
      eyebrow: root?.querySelector('.weather-header-card__eyebrow') || null,
      locationLabel: root?.querySelector('.weather-header-card__location') || null,
      locationCurrent: root?.querySelector('.weather-location-selector__current') || null,
    });
    normalizeHeaderWeatherCelsiusUnits(host);

    const bottomChipsAfter = tempRow.querySelector('.weather-header-card__chips');
    if (bottomChipsAfter instanceof HTMLElement) {
      const hasVisibleChip = Array.from(bottomChipsAfter.querySelectorAll('.weather-header-card__chip')).some(chip => {
        const style = window.getComputedStyle(chip);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (!hasVisibleChip) {
        bottomChipsAfter.style.setProperty('display', 'none', 'important');
      }
    }

    return feelsLikeChip;
  }

  function ensureHeaderWeatherCollapsedFeelsFallback(host, root) {
    if (!(root instanceof ShadowRoot || root instanceof DocumentFragment)) {
      return null;
    }

    const chips =
      root.querySelector('.weather-header-card__temp-row .weather-header-card__chips') ||
      root.querySelector('.weather-header-card__bottom > .weather-header-card__chips') ||
      root.querySelector('.weather-header-card__chips');
    if (!(chips instanceof HTMLElement)) {
      return null;
    }

    if (chips.querySelector('.weather-header-card__chip--feels-like[data-weather-feels-layout="custom"]')) {
      return chips.querySelector('.weather-header-card__chip--feels-like[data-weather-feels-layout="custom"]');
    }

    const chipNodes = Array.from(chips.querySelectorAll('.weather-header-card__chip'));
    const feelsChip = chipNodes.find(chip => /gef|ощущ|feels|відчува/i.test(chip.textContent || '')) || null;
    if (!(feelsChip instanceof HTMLElement)) {
      return null;
    }

    const lang = (document.documentElement.lang || 'ru').toLowerCase();
    const feelsLikeTextByLang = {
      ru: { label: 'ОЩУЩАЕТСЯ', prefix: 'КАК' },
      uk: { label: 'ВІДЧУВАЄТЬСЯ', prefix: 'ЯК' },
      de: { label: 'GEFÜHLT', prefix: 'WIE' },
      en: { label: 'FEELS', prefix: 'LIKE' },
    };
    const feelsLikeText = feelsLikeTextByLang[lang] || feelsLikeTextByLang.en;
    const feelsLikeRawText = (feelsChip.textContent || '').replace(/\s+/g, ' ').trim();
    const feelsLikeMatch = feelsLikeRawText.match(/(-?\d{1,2})(?:\s*\u00b0\s*[CcСс])?/);
    const apparentTemperature = Number(host?.__weatherCurrentMeta?.apparentTemperature);
    const feelsLikeNumber = Number.isFinite(apparentTemperature)
      ? String(Math.round(apparentTemperature))
      : feelsLikeMatch?.[1] || '--';

    chipNodes.forEach(chip => chip.style.setProperty('display', 'none', 'important'));
    feelsChip.classList.add('weather-header-card__chip--feels-like');
    feelsChip.dataset.weatherMetric = 'feels';
    feelsChip.dataset.weatherFeelsLayout = 'custom';

    const label = document.createElement('span');
    label.className = 'weather-header-card__feels-label';
    label.textContent = feelsLikeText.label;

    const row = document.createElement('span');
    row.className = 'weather-header-card__feels-value weather-header-card__feels-row';

    const prefix = document.createElement('span');
    prefix.className = 'weather-header-card__feels-prefix';
    prefix.textContent = feelsLikeText.prefix;

    const tempWrap = document.createElement('span');
    tempWrap.className = 'weather-header-card__feels-temp';
    const number = document.createElement('span');
    number.className = 'weather-header-card__feels-temp-number';
    number.textContent = feelsLikeNumber;
    const unit = document.createElement('span');
    unit.className = 'weather-header-card__feels-temp-unit';
    unit.textContent = HEADER_WEATHER_CELSIUS_SUFFIX;
    tempWrap.append(number, unit);
    row.append(prefix, tempWrap);
    feelsChip.replaceChildren(label, row);
    feelsChip.style.setProperty('display', 'flex', 'important');

    chips.style.setProperty('display', 'flex', 'important');
    chips.style.setProperty('align-self', 'center', 'important');
    chips.style.setProperty('justify-content', 'center', 'important');
    return feelsChip;
  }

  function refreshHeaderWeatherPreviewValues(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    const triggerNode = root.querySelector('.weather-header-trigger');
    const triggerHeight =
      triggerNode instanceof HTMLElement ? Math.round(triggerNode.getBoundingClientRect().height || 0) : 0;
    const compactPreview = triggerHeight > 0 && triggerHeight <= 92;
    const showMetrics = compactPreview;
    const previewTempSizePx = compactPreview ? 22 : 34;

    hydrateHeaderWeatherReadingsFromCache(host);

    const previewTemperature = root.querySelector('.weather-header-card__temperature');
    if (previewTemperature instanceof HTMLElement) {
      previewTemperature.style.setProperty('--header-weather-temp-value-size', `${previewTempSizePx}px`, 'important');
      previewTemperature.style.setProperty('font-size', `${previewTempSizePx}px`, 'important');
    }

    if (!root.querySelector('.weather-header-card__chip--feels-like[data-weather-feels-layout="custom"]')) {
      applyHeaderWeatherFeelsLikePreview(host, {
        tempRow:
          root.querySelector('.weather-header-card__temp-row') ||
          root.querySelector('.weather-header-card__bottom') ||
          null,
        chips: root.querySelector('.weather-header-card__chips') || null,
        root,
        infoPanel: root.querySelector('.weather-header-card__info-panel, .weather-header-card__left-stack') || null,
      });
    }

    ensureHeaderWeatherCollapsedFeelsFallback(host, root);

    ensureHeaderWeatherPreviewMetricsVisible(host);

    ensureHeaderWeatherCollapsedFeelsFallback(host, root);

    const condition = root.querySelector('.weather-header-card__condition');
    const metricsRoot =
      root.querySelector('.weather-header-card__metrics-block') ||
      root.querySelector('.weather-header-card__right-column');
    const pressureChip =
      metricsRoot?.querySelector('.weather-header-card__chip--pressure-fallback, [data-weather-metric="pressure"]') ||
      null;
    const humidityChip =
      metricsRoot?.querySelector('.weather-header-card__chip--humidity-fallback, [data-weather-metric="humidity"]') ||
      null;

    if (condition instanceof HTMLElement) {
      applyHeaderWeatherConditionTypography(condition);
      condition.style.setProperty('display', showMetrics ? 'block' : 'none', 'important');
      condition.style.setProperty('visibility', showMetrics ? 'visible' : 'hidden', 'important');
      condition.setAttribute('aria-hidden', showMetrics ? 'false' : 'true');
    }

    const dropdownCondition = root.querySelector('.weather-header-dropdown__hero-copy strong');
    if (dropdownCondition instanceof HTMLElement) {
      const dropdownConditionText =
        host?.__weatherReadingsSnapshot?.condition ||
        getHeaderWeatherConditionPlainText(condition) ||
        dropdownCondition.textContent ||
        '';
      if (dropdownConditionText) {
        applyHeaderWeatherDropdownConditionTypography(dropdownCondition, dropdownConditionText);
      }
    }

    if (pressureChip instanceof HTMLElement) {
      const valueEl = Array.from(pressureChip.children).find(
        el => el instanceof HTMLElement && /\d|--/.test(el.textContent || '')
      );
      if (valueEl instanceof HTMLElement) {
        const nextPressure = formatHeaderWeatherPressureValue(host, host?.__weatherPressureMmHg);
        if (nextPressure) {
          if (pressureChip.dataset.weatherPressureLayout === 'reference') {
            const pressureMatch = nextPressure.match(/^(-?\d+(?:[.,]\d+)?)(.*)$/);
            if (pressureMatch) {
              const nextNumber = pressureMatch[1].replace(',', '.');
              if ((valueEl.textContent || '') !== nextNumber) {
                valueEl.textContent = nextNumber;
              }
            }
            return;
          }

          const pressureMatch = nextPressure.match(/^(-?\d+(?:[.,]\d+)?)(.*)$/);
          const numberNode = valueEl.children[0];
          const unitNode = valueEl.children[1];

          if (pressureMatch && numberNode instanceof HTMLElement && unitNode instanceof HTMLElement) {
            const nextNumber = pressureMatch[1].replace(',', '.');
            const nextUnit = pressureMatch[2].trim();
            if ((numberNode.textContent || '') !== nextNumber) {
              numberNode.textContent = nextNumber;
            }
            if ((unitNode.textContent || '') !== nextUnit) {
              unitNode.textContent = nextUnit;
            }
          } else if (nextPressure !== valueEl.textContent) {
            valueEl.textContent = nextPressure;
            delete pressureChip.dataset.weatherTypographyReady;
          }
        }
      }
    }

    if (humidityChip instanceof HTMLElement) {
      const valueEl = Array.from(humidityChip.children).find(
        el => el instanceof HTMLElement && /%|--/.test(el.textContent || '')
      );
      if (valueEl instanceof HTMLElement) {
        const nextHumidity = host?.__weatherHumidityValue || valueEl.textContent;
        if (nextHumidity && nextHumidity !== valueEl.textContent) {
          valueEl.textContent = nextHumidity;
        }
      }
    }
  }

  function enforceHeaderWeatherMenuPlacement(host) {
    const root = host?.shadowRoot;
    if (!root || host.__weatherPlacementApplying) {
      return;
    }

    const hasCompleteLockedPreview = () => {
      if (!root) {
        return false;
      }

      const rightColumn = root.querySelector('.weather-header-card__right-column');
      const pressureChip = root.querySelector(
        '.weather-header-card__chip--pressure-fallback, .weather-header-card__chip[data-weather-metric="pressure"]'
      );
      const humidityChip = root.querySelector(
        '.weather-header-card__chip--humidity-fallback, .weather-header-card__chip[data-weather-metric="humidity"]'
      );
      const feelsLikeChip = root.querySelector(
        '.weather-header-card__chip--feels-like[data-weather-feels-layout="custom"]'
      );
      const conditionNode = root.querySelector('.weather-header-card__condition');

      return [rightColumn, pressureChip, humidityChip, feelsLikeChip, conditionNode].every(
        node => node instanceof HTMLElement
      );
    };

    if (HEADER_WEATHER_STRICT_STYLE_LOCK && host.__weatherPlacementLockedOnce) {
      if (hasCompleteLockedPreview()) {
        resetHeaderWeatherPlacementRetry(host);
        refreshHeaderWeatherPreviewValues(host);
        return;
      }

      host.__weatherPlacementLockedOnce = false;
    }

    host.__weatherPlacementApplying = true;

    try {
      applyHeaderWeatherTextReadability(host, host.__weatherOrbAtmosphere || null);

      scheduleHeaderBrandColumnAlign(host);

      const card = root.querySelector('.weather-header-card');
      const topRow = root.querySelector('.weather-header-card__top');
      const titleBlock = root.querySelector('.weather-header-card__title-block');
      const eyebrow = root.querySelector('.weather-header-card__eyebrow');
      const content = root.querySelector('.weather-header-card__content');
      const condition = root.querySelector('.weather-header-card__condition');
      const meta = root.querySelector('.weather-header-card__meta');
      const bottom = root.querySelector('.weather-header-card__bottom');
      let chips = root.querySelector('.weather-header-card__chips');
      const geoArrowIcon = root.querySelector('.weather-location-selector__current svg');
      const locationCurrent = root.querySelector('.weather-location-selector__current');
      const locationRow = root.querySelector('.weather-header-card__location-row');
      const locationLabel = root.querySelector('.weather-header-card__location');
      const normalizeInlineText = element => {
        if (!element) {
          return;
        }

        const normalized = (element.textContent || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (normalized && normalized !== element.textContent) {
          element.textContent = normalized;
        }
      };
      const parsedInset = Number.parseFloat(
        window.getComputedStyle(host).getPropertyValue('--header-weather-text-inset') || '0'
      );
      const triggerNode = root.querySelector('.weather-header-trigger');
      const triggerHeight =
        triggerNode instanceof HTMLElement ? Math.round(triggerNode.getBoundingClientRect().height || 0) : 0;
      const isHeaderVariant =
        host?.dataset?.weatherVariant === 'header' || host?.getAttribute?.('data-weather-variant') === 'header';
      const measuredInset = Number.isFinite(parsedInset) ? Math.max(0, Math.round(parsedInset)) : 0;
      if (isHeaderVariant && !Number.isFinite(host.__weatherLockedTextInset)) {
        host.__weatherLockedTextInset = 4;
      }
      const contentInset = isHeaderVariant ? host.__weatherLockedTextInset || 4 : measuredInset;
      const compactPreview = isHeaderVariant ? true : triggerHeight > 0 && triggerHeight <= 92;
      const showMetrics = compactPreview;
      const eyebrowSizePx = compactPreview ? 9 : 11;
      const eyebrowLineHeightPx = compactPreview ? 11 : 13;
      const locationSizePx = 12.4;
      const locationLineHeightPx = 15;
      const metaSizePx = compactPreview ? 10.2 : 13;
      const metaLineHeightPx = compactPreview ? 12 : 16;
      const tempSizePx = compactPreview ? 22 : 34;
      const verticalRhythmGapPx = compactPreview ? 6 : 7;
      const tempRowTopGapPx = compactPreview ? Math.max(0, verticalRhythmGapPx - 2) : 32;
      const rowGapPx = compactPreview ? 12 : 10;
      const cardVerticalInsetPx = 6;
      const baseContentPadY = cardVerticalInsetPx;
      let rightColumn = null;
      const rightColumnHost = card || content;

      if (rightColumnHost) {
        rightColumn = root.querySelector('.weather-header-card__right-column');
        if (!rightColumn) {
          rightColumn = document.createElement('div');
          rightColumn.className = 'weather-header-card__right-column weather-header-card__metrics-panel';
          rightColumnHost.appendChild(rightColumn);
        } else if (!rightColumn.classList.contains('weather-header-card__metrics-panel')) {
          rightColumn.classList.add('weather-header-card__metrics-panel');
        } else if (rightColumn.parentElement !== rightColumnHost) {
          rightColumnHost.appendChild(rightColumn);
        }
      }

      if (topRow) {
        topRow.style.setProperty('position', 'static', 'important');
        topRow.style.setProperty('width', '100%', 'important');
      }

      const infoPanel = ensureHeaderWeatherInfoPanel(root, topRow, titleBlock, bottom);
      if (infoPanel instanceof HTMLElement) {
        infoPanel.style.setProperty('position', 'absolute', 'important');
        infoPanel.style.setProperty('top', `${cardVerticalInsetPx}px`, 'important');
        infoPanel.style.setProperty('left', '0', 'important');
        infoPanel.style.setProperty('right', 'auto', 'important');
        infoPanel.style.setProperty('bottom', `${cardVerticalInsetPx}px`, 'important');
        infoPanel.style.setProperty('display', 'flex', 'important');
        infoPanel.style.setProperty('flex-direction', 'column', 'important');
        infoPanel.style.setProperty('justify-content', 'space-between', 'important');
        infoPanel.style.setProperty('align-items', 'flex-start', 'important');
        infoPanel.style.setProperty('height', 'auto', 'important');
        infoPanel.style.setProperty('min-height', `calc(100% - ${cardVerticalInsetPx * 2}px)`, 'important');
        infoPanel.style.setProperty('max-height', `calc(100% - ${cardVerticalInsetPx * 2}px)`, 'important');
        infoPanel.style.setProperty('padding', '0', 'important');
        infoPanel.style.setProperty('margin', '0', 'important');
        infoPanel.style.setProperty('row-gap', '0', 'important');
      }
      host.__weatherCardVerticalInsetPx = cardVerticalInsetPx;
      const tempRow = infoPanel?.querySelector('.weather-header-card__temp-row') || null;
      const tempRowChips =
        tempRow?.querySelector('.weather-header-card__chips') || root.querySelector('.weather-header-card__chips');
      if (tempRowChips instanceof HTMLElement) {
        chips = tempRowChips;
      }

      ensureHeaderWeatherMenuToggleAnchor(root, card);

      if (titleBlock instanceof HTMLElement) {
        titleBlock.style.setProperty('position', 'relative', 'important');
        titleBlock.style.setProperty('top', '0', 'important');
        titleBlock.style.setProperty('left', '0', 'important');
        titleBlock.style.setProperty('margin', '0', 'important');
        titleBlock.style.setProperty('padding', '0', 'important');
      }

      if (eyebrow instanceof HTMLElement) {
        eyebrow.style.setProperty('display', 'none', 'important');
      }

      if (content) {
        content.style.setProperty('position', 'relative', 'important');
        content.style.setProperty('width', '100%', 'important');
        content.style.setProperty('min-height', '100%', 'important');
        content.style.setProperty('height', 'auto', 'important');
        content.style.setProperty('box-sizing', 'border-box', 'important');
        content.style.setProperty('padding-top', `${baseContentPadY}px`, 'important');
        content.style.setProperty('padding-right', '18px', 'important');
        content.style.setProperty('padding-bottom', `${baseContentPadY}px`, 'important');
        content.style.setProperty('padding-left', `${contentInset}px`, 'important');
      }

      if (condition instanceof HTMLElement) {
        normalizeInlineText(condition);
        applyHeaderWeatherConditionTypography(condition);
        condition.style.setProperty('display', showMetrics ? 'block' : 'none', 'important');
        condition.style.setProperty('visibility', showMetrics ? 'visible' : 'hidden', 'important');
        condition.setAttribute('aria-hidden', showMetrics ? 'false' : 'true');
      }

      if (meta) {
        meta.style.setProperty('font-size', `${metaSizePx}px`, 'important');
        meta.style.setProperty('line-height', `${metaLineHeightPx}px`, 'important');
        meta.style.setProperty('letter-spacing', '0.01em', 'important');
        meta.style.setProperty('opacity', '0.76', 'important');
        meta.style.setProperty('color', 'rgb(229 230 226 / 0.76)', 'important');
        meta.style.setProperty('display', 'block', 'important');
        meta.style.setProperty('width', 'auto', 'important');
        meta.style.setProperty('min-width', '0', 'important');
        meta.style.setProperty('box-sizing', 'border-box', 'important');
        meta.style.setProperty('padding', '0', 'important');
        meta.style.setProperty('border-radius', '0', 'important');
        meta.style.setProperty('border', 'none', 'important');
        meta.style.setProperty('background', 'none', 'important');
        meta.style.setProperty('box-shadow', 'none', 'important');
        meta.style.setProperty('white-space', 'nowrap', 'important');
        meta.style.setProperty('overflow', 'hidden', 'important');
        meta.style.setProperty('text-overflow', 'ellipsis', 'important');
        meta.style.setProperty('margin', '0', 'important');

        const metaRegion = meta.querySelector('span');
        if (metaRegion instanceof HTMLElement) {
          metaRegion.style.setProperty('font-size', `${metaSizePx}px`, 'important');
          metaRegion.style.setProperty('line-height', `${metaLineHeightPx}px`, 'important');
          metaRegion.style.setProperty('letter-spacing', '0.01em', 'important');
          metaRegion.style.setProperty('font-weight', '400', 'important');
          metaRegion.style.setProperty('color', 'inherit', 'important');
          metaRegion.style.setProperty('display', 'inline-block', 'important');
        }
      }

      if (geoArrowIcon instanceof Element && geoArrowIcon.tagName.toLowerCase() === 'svg') {
        geoArrowIcon.style.setProperty('width', '9.6px', 'important');
        geoArrowIcon.style.setProperty('height', '9.6px', 'important');
        geoArrowIcon.style.setProperty('min-width', '9.6px', 'important');
        geoArrowIcon.style.setProperty('min-height', '9.6px', 'important');
        geoArrowIcon.style.setProperty('flex-shrink', '0', 'important');
      }

      if (locationCurrent instanceof HTMLElement) {
        locationCurrent.style.setProperty('display', 'inline-flex', 'important');
        locationCurrent.style.setProperty('align-items', 'center', 'important');
        locationCurrent.style.setProperty('gap', '6px', 'important');
        locationCurrent.style.setProperty('width', 'auto', 'important');
        locationCurrent.style.setProperty('min-width', 'max-content', 'important');
        locationCurrent.style.setProperty('max-width', 'none', 'important');
        locationCurrent.style.setProperty('overflow', 'visible', 'important');
        locationCurrent.style.setProperty('text-overflow', 'clip', 'important');
        locationCurrent.style.setProperty('white-space', 'nowrap', 'important');
        locationCurrent.style.setProperty('flex-shrink', '0', 'important');
        locationCurrent.style.setProperty('line-height', '1.2', 'important');
        locationCurrent.style.setProperty('padding-bottom', '1px', 'important');

        Array.from(locationCurrent.children).forEach(child => {
          if (!(child instanceof HTMLElement) || child.tagName.toLowerCase() === 'svg') {
            return;
          }
          child.style.setProperty('width', 'auto', 'important');
          child.style.setProperty('min-width', 'max-content', 'important');
          child.style.setProperty('max-width', 'none', 'important');
          child.style.setProperty('overflow', 'visible', 'important');
          child.style.setProperty('text-overflow', 'clip', 'important');
          child.style.setProperty('white-space', 'nowrap', 'important');
          child.style.setProperty('flex-shrink', '0', 'important');
          child.style.setProperty('line-height', '1.2', 'important');
        });
      }

      if (locationRow instanceof HTMLElement) {
        locationRow.style.setProperty('display', 'flex', 'important');
        locationRow.style.setProperty('flex-direction', 'column', 'important');
        locationRow.style.setProperty('align-items', 'flex-start', 'important');
        locationRow.style.setProperty('justify-content', 'flex-start', 'important');
        locationRow.style.setProperty('row-gap', '1px', 'important');
        locationRow.style.setProperty('gap', '1px', 'important');
        locationRow.style.setProperty('overflow', 'visible', 'important');
        locationRow.style.setProperty('text-overflow', 'clip', 'important');
        locationRow.style.setProperty('white-space', 'normal', 'important');
        locationRow.style.setProperty('min-height', 'auto', 'important');
        locationRow.style.setProperty('margin-bottom', '0', 'important');
      }

      if (locationLabel instanceof HTMLElement) {
        const nextLocationText = formatHeaderWeatherCityDistrictDisplayLabel(locationLabel.textContent || '');
        if (nextLocationText && nextLocationText !== locationLabel.textContent?.trim()) {
          locationLabel.textContent = nextLocationText;
        }
        locationLabel.style.setProperty('display', 'inline-block', 'important');
        locationLabel.style.setProperty('overflow', 'visible', 'important');
        locationLabel.style.setProperty('text-overflow', 'clip', 'important');
        locationLabel.style.setProperty('white-space', 'nowrap', 'important');
        locationLabel.style.setProperty('word-break', 'normal', 'important');
        locationLabel.style.setProperty('overflow-wrap', 'normal', 'important');
        locationLabel.style.setProperty('hyphens', 'none', 'important');
        locationLabel.style.setProperty('font-size', `${locationSizePx}px`, 'important');
        locationLabel.style.setProperty('line-height', `${locationLineHeightPx}px`, 'important');
        locationLabel.style.setProperty('font-weight', '600', 'important');
        locationLabel.style.setProperty('letter-spacing', '-0.015em', 'important');
        locationLabel.style.setProperty('padding-bottom', '0', 'important');
        locationLabel.style.setProperty('margin', '0', 'important');
      }

      if (eyebrow instanceof HTMLElement) {
        if (locationRow instanceof HTMLElement && eyebrow.parentElement !== locationRow) {
          locationRow.prepend(eyebrow);
        }

        eyebrow.style.setProperty('display', 'block', 'important');
        eyebrow.style.setProperty('margin', '0', 'important');
        eyebrow.style.setProperty('font-size', `${eyebrowSizePx}px`, 'important');
        eyebrow.style.setProperty('line-height', `${eyebrowLineHeightPx}px`, 'important');
        eyebrow.style.setProperty('letter-spacing', '0.14em', 'important');
        eyebrow.style.setProperty('font-weight', '400', 'important');
        eyebrow.style.setProperty('text-transform', 'none', 'important');
        eyebrow.style.setProperty('color', 'rgb(233 213 165 / 0.78)', 'important');
        eyebrow.style.setProperty('opacity', '0.78', 'important');
      }

      if (locationLabel instanceof HTMLElement && eyebrow instanceof HTMLElement) {
        const eyebrowWidth = Math.round(eyebrow.getBoundingClientRect().width || 0);
        const locationWidth = Math.round(locationLabel.getBoundingClientRect().width || 0);
        if (eyebrowWidth > 0 && locationWidth > 0) {
          const maxSingleLineWidth = eyebrowWidth;
          const targetRatio = eyebrowWidth / locationWidth;
          const locationShrinkOnWrapPx = 2;
          let adjustedLocationSize = Math.max(
            11.2,
            Math.min(14, Number((locationSizePx * targetRatio + 0.1).toFixed(2)))
          );
          let adjustedLocationLineHeight = Math.max(14, Number((adjustedLocationSize * 1.22).toFixed(2)));
          locationLabel.style.setProperty('font-size', `${adjustedLocationSize}px`, 'important');
          locationLabel.style.setProperty('line-height', `${adjustedLocationLineHeight}px`, 'important');

          locationLabel.style.setProperty('display', 'block', 'important');
          locationLabel.style.setProperty('width', 'auto', 'important');
          locationLabel.style.setProperty('max-width', `${maxSingleLineWidth}px`, 'important');
          locationLabel.style.setProperty('white-space', 'normal', 'important');
          locationLabel.style.setProperty('word-break', 'normal', 'important');
          locationLabel.style.setProperty('overflow-wrap', 'break-word', 'important');
          locationLabel.style.setProperty('hyphens', 'auto', 'important');
          locationLabel.style.setProperty('overflow', 'hidden', 'important');
          locationLabel.style.setProperty('text-overflow', 'ellipsis', 'important');
          locationLabel.style.setProperty('display', '-webkit-box', 'important');
          locationLabel.style.setProperty('-webkit-box-orient', 'vertical', 'important');
          locationLabel.style.setProperty('-webkit-line-clamp', '2', 'important');

          const initialLineHeight =
            Number.parseFloat(window.getComputedStyle(locationLabel).lineHeight) || adjustedLocationLineHeight;
          const initialHeight = locationLabel.getBoundingClientRect().height || 0;
          const initialLines = initialLineHeight > 0 ? initialHeight / initialLineHeight : 1;

          if (initialLines > 1.05) {
            adjustedLocationSize = Number(Math.max(9.2, adjustedLocationSize - locationShrinkOnWrapPx).toFixed(2));
            adjustedLocationLineHeight = Number(Math.max(11.2, adjustedLocationSize * 1.16).toFixed(2));
            locationLabel.style.setProperty('font-size', `${adjustedLocationSize}px`, 'important');
            locationLabel.style.setProperty('line-height', `${adjustedLocationLineHeight}px`, 'important');
          }

          let fitGuard = 0;
          while (fitGuard < 14) {
            const currentHeight = locationLabel.getBoundingClientRect().height;
            const currentLineHeight =
              Number.parseFloat(window.getComputedStyle(locationLabel).lineHeight) || adjustedLocationLineHeight;
            const currentLines = currentLineHeight > 0 ? currentHeight / currentLineHeight : 1;
            if (currentLines <= 2.08 || adjustedLocationSize <= 9.8) {
              break;
            }

            adjustedLocationSize = Number(Math.max(9.8, adjustedLocationSize - 0.2).toFixed(2));
            adjustedLocationLineHeight = Number(Math.max(11.6, adjustedLocationSize * 1.18).toFixed(2));
            locationLabel.style.setProperty('font-size', `${adjustedLocationSize}px`, 'important');
            locationLabel.style.setProperty('line-height', `${adjustedLocationLineHeight}px`, 'important');
            fitGuard += 1;
          }

          if (locationRow instanceof HTMLElement) {
            locationRow.style.setProperty('align-items', 'flex-start', 'important');
            locationRow.style.setProperty('min-height', 'auto', 'important');
            locationRow.style.setProperty('margin-bottom', '0', 'important');
          }
        }
      }

      if (meta instanceof HTMLElement && eyebrow instanceof HTMLElement) {
        const maxMetaWidth = Math.round(eyebrow.getBoundingClientRect().width || 0);
        if (maxMetaWidth > 0) {
          const metaRegion = meta.querySelector('span');
          let fittedMetaFontSize = metaSizePx;
          let fittedMetaLineHeight = metaLineHeightPx;

          meta.style.setProperty('display', 'block', 'important');
          meta.style.setProperty('max-width', `${maxMetaWidth}px`, 'important');
          meta.style.setProperty('width', `${maxMetaWidth}px`, 'important');
          meta.style.setProperty('white-space', 'nowrap', 'important');
          meta.style.setProperty('overflow', 'hidden', 'important');
          meta.style.setProperty('text-overflow', 'ellipsis', 'important');

          let fitGuard = 0;
          while (fitGuard < 14 && meta.getBoundingClientRect().width > maxMetaWidth && fittedMetaFontSize > 8.2) {
            fittedMetaFontSize = Number((fittedMetaFontSize - 0.2).toFixed(2));
            fittedMetaLineHeight = Number(Math.max(10, fittedMetaFontSize * 1.18).toFixed(2));
            meta.style.setProperty('font-size', `${fittedMetaFontSize}px`, 'important');
            meta.style.setProperty('line-height', `${fittedMetaLineHeight}px`, 'important');
            if (metaRegion instanceof HTMLElement) {
              metaRegion.style.setProperty('font-size', `${fittedMetaFontSize}px`, 'important');
              metaRegion.style.setProperty('line-height', `${fittedMetaLineHeight}px`, 'important');
            }
            fitGuard += 1;
          }
        }
      }

      const estimateTextLines = node => {
        if (!(node instanceof HTMLElement)) {
          return 1;
        }
        const computed = window.getComputedStyle(node);
        const lineHeight = Number.parseFloat(computed.lineHeight) || 0;
        const height = node.getBoundingClientRect().height || 0;
        if (!lineHeight || !height) {
          return 1;
        }
        return Math.max(1, Math.round((height / lineHeight) * 10) / 10);
      };

      const locationLines = estimateTextLines(locationLabel);
      const metaLines = estimateTextLines(meta);
      const extraTextLines = Math.max(0, locationLines - 1) + Math.max(0, metaLines - 1);
      const growthPx = extraTextLines > 0 ? Math.min(12, Math.ceil(extraTextLines * 6 + 2)) : 0;

      if (content instanceof HTMLElement) {
        const nextPadY = baseContentPadY + (growthPx > 0 ? Math.ceil(growthPx / 3) : 0);
        content.style.setProperty('padding-top', `${nextPadY}px`, 'important');
        content.style.setProperty('padding-bottom', `${nextPadY}px`, 'important');
      }

      if (triggerNode instanceof HTMLElement) {
        const baseTriggerHeight =
          triggerHeight > 0 ? triggerHeight : Math.round(triggerNode.getBoundingClientRect().height || 0);
        if (baseTriggerHeight > 0) {
          triggerNode.style.setProperty('height', 'auto', 'important');
          triggerNode.style.setProperty('min-height', `${baseTriggerHeight + growthPx}px`, 'important');
        }
      }

      if (card instanceof HTMLElement) {
        const baseCardHeight = triggerHeight > 0 ? triggerHeight : Math.round(card.getBoundingClientRect().height || 0);
        if (baseCardHeight > 0) {
          card.style.setProperty('height', 'auto', 'important');
          card.style.setProperty('min-height', `${baseCardHeight + growthPx}px`, 'important');
        }
      }

      if (tempRow instanceof HTMLElement) {
        tempRow.style.setProperty('margin-left', '0', 'important');
        tempRow.style.setProperty('margin-top', '0', 'important');
        tempRow.style.setProperty('padding-left', '0', 'important');
        tempRow.style.setProperty('grid-template-columns', 'max-content max-content', 'important');
        tempRow.style.setProperty('column-gap', `${rowGapPx}px`, 'important');
        tempRow.style.setProperty('align-items', 'center', 'important');

        const temperatureNode = tempRow.querySelector('.weather-header-card__temperature');
        if (temperatureNode instanceof HTMLElement) {
          temperatureNode.style.setProperty('transform', 'none', 'important');
          temperatureNode.style.setProperty('--header-weather-temp-value-size', `${tempSizePx}px`, 'important');
          temperatureNode.style.setProperty('font-size', `${tempSizePx}px`, 'important');
        }
      } else if (bottom instanceof HTMLElement) {
        bottom.style.setProperty('display', 'grid', 'important');
        bottom.style.setProperty('grid-template-columns', 'max-content max-content', 'important');
        bottom.style.setProperty('column-gap', `${rowGapPx}px`, 'important');
        bottom.style.setProperty('align-items', 'center', 'important');
        bottom.style.setProperty('justify-content', 'start', 'important');
        bottom.style.setProperty('margin', `${tempRowTopGapPx}px 0 0 0`, 'important');
        bottom.style.setProperty('padding', '0', 'important');

        const fallbackTemperatureNode = bottom.querySelector('.weather-header-card__temperature');
        if (fallbackTemperatureNode instanceof HTMLElement) {
          fallbackTemperatureNode.style.setProperty('--header-weather-temp-value-size', `${tempSizePx}px`, 'important');
          fallbackTemperatureNode.style.setProperty('font-size', `${tempSizePx}px`, 'important');
        }
      }

      let layoutPressureChip = null;
      let layoutHumidityChip = null;

      if (chips) {
        const allChips = Array.from(chips.querySelectorAll('.weather-header-card__chip'));
        const metaRegionForTypography = meta?.querySelector('span');
        const tempValueAnchor =
          tempRow?.querySelector('.weather-header-card__temperature-value') ||
          tempRow?.querySelector('.weather-header-card__temperature') ||
          null;
        const metaComputed = metaRegionForTypography ? window.getComputedStyle(metaRegionForTypography) : null;
        const locationComputed = locationLabel instanceof HTMLElement ? window.getComputedStyle(locationLabel) : null;
        const tempComputed = tempValueAnchor ? window.getComputedStyle(tempValueAnchor) : null;
        const applyChipTypography = chip => {
          if (!(chip instanceof HTMLElement)) {
            return;
          }

          if (chip.dataset.weatherTypographyReady === 'true') {
            return;
          }

          const normalizePressureUnit = value => {
            const normalized = String(value || '')
              .replace(/\s+/g, ' ')
              .trim();
            if (!normalized) {
              return normalized;
            }

            const pressureUnitText = getHeaderWeatherPressureUnitText(host);
            return normalized
              .replace(/(mm\s*hg|mmhg|мм\.?\s*рт\.?\s*ст\.?|мм\s*рт\s*ст)/i, pressureUnitText)
              .replace(/(mm|мм)\.?\s*(рт\.?\s*ст\.?|hg|hg\.|h\s*g)/i, pressureUnitText);
          };

          const parts = Array.from(chip.children).filter(el => el instanceof HTMLElement);
          const labelEl = parts[0] || null;
          const valueEl = parts[1] || null;
          const chipText = (chip.textContent || '').toLowerCase();
          const isPressureChip = /pressure|давлен|тиск|druck|presion/.test(chipText);
          const isHumidityChip = /humid|влаж|feucht|волог|umid|humedad/.test(chipText);

          if (labelEl instanceof HTMLElement) {
            if (metaComputed) {
              labelEl.style.setProperty('font-family', metaComputed.fontFamily, 'important');
              labelEl.style.setProperty('font-size', metaComputed.fontSize, 'important');
              labelEl.style.setProperty('font-weight', metaComputed.fontWeight, 'important');
              labelEl.style.setProperty('line-height', metaComputed.lineHeight, 'important');
              labelEl.style.setProperty('letter-spacing', metaComputed.letterSpacing, 'important');
              labelEl.style.setProperty('text-transform', metaComputed.textTransform, 'important');
            }
            labelEl.style.setProperty('opacity', '0.92', 'important');
            labelEl.style.setProperty('margin', '0 0 1px 0', 'important');

            if (isHumidityChip) {
              labelEl.style.setProperty('font-size', '8px', 'important');
              labelEl.style.setProperty('line-height', '8px', 'important');
              labelEl.style.setProperty('letter-spacing', '1px', 'important');
              labelEl.style.setProperty('font-weight', '400', 'important');
            }

            if (isPressureChip) {
              if (metaComputed) {
                labelEl.style.setProperty('font-family', metaComputed.fontFamily, 'important');
                labelEl.style.setProperty('font-size', metaComputed.fontSize, 'important');
                labelEl.style.setProperty('line-height', metaComputed.lineHeight, 'important');
              }
              if (locationComputed) {
                labelEl.style.setProperty('color', locationComputed.color, 'important');
                labelEl.style.setProperty('opacity', locationComputed.opacity, 'important');
              }
            }

            if (isHumidityChip) {
              if (metaComputed) {
                labelEl.style.setProperty('font-family', metaComputed.fontFamily, 'important');
                labelEl.style.setProperty('font-size', metaComputed.fontSize, 'important');
                labelEl.style.setProperty('line-height', metaComputed.lineHeight, 'important');
                labelEl.style.setProperty('font-weight', metaComputed.fontWeight, 'important');
                labelEl.style.setProperty('letter-spacing', metaComputed.letterSpacing, 'important');
                labelEl.style.setProperty('text-transform', metaComputed.textTransform, 'important');
              }
              if (locationComputed) {
                labelEl.style.setProperty('color', locationComputed.color, 'important');
                labelEl.style.setProperty('opacity', locationComputed.opacity, 'important');
              }
            }

            if (isHumidityChip) {
              const humidityLabelRaw = (labelEl.textContent || '').replace(/\s*[~≈]\s*$/u, '').trim();
              labelEl.textContent = `${humidityLabelRaw} ≈`;
            }
          }

          if (valueEl instanceof HTMLElement) {
            const rawValue = (valueEl.textContent || '').trim();
            const valueMatch = rawValue.match(/^(-?\d+(?:[.,]\d+)?|--)(.*)$/);

            if (isPressureChip && valueMatch) {
              const pressureNumberText = valueMatch[1] === '--' ? '--' : valueMatch[1].replace(',', '.');
              const pressureUnitText = getHeaderWeatherPressureUnitText(host);
              let pressureMeta = chip.querySelector('.weather-header-card__pressure-meta');
              let pressureMetaLabel = pressureMeta?.querySelector('.weather-header-card__pressure-meta-label') || null;
              let pressureMetaUnit = pressureMeta?.querySelector('.weather-header-card__pressure-meta-unit') || null;

              if (!(pressureMeta instanceof HTMLElement)) {
                pressureMeta = document.createElement('span');
                pressureMeta.className = 'weather-header-card__pressure-meta';
              }
              if (!(pressureMetaLabel instanceof HTMLElement)) {
                pressureMetaLabel = document.createElement('span');
                pressureMetaLabel.className = 'weather-header-card__pressure-meta-label';
              }
              if (!(pressureMetaUnit instanceof HTMLElement)) {
                pressureMetaUnit = document.createElement('span');
                pressureMetaUnit.className = 'weather-header-card__pressure-meta-unit';
              }

              pressureMetaLabel.textContent = (labelEl?.textContent || '').trim();
              pressureMetaUnit.textContent = pressureUnitText;
              pressureMeta.replaceChildren(pressureMetaLabel, pressureMetaUnit);

              valueEl.textContent = pressureNumberText;
              valueEl.style.setProperty('display', 'block', 'important');
              valueEl.style.setProperty('font-size', '10.5px', 'important');
              valueEl.style.setProperty('line-height', '0.92', 'important');
              valueEl.style.setProperty('font-weight', '300', 'important');
              valueEl.style.setProperty('letter-spacing', '0', 'important');
              valueEl.style.setProperty('margin', '0', 'important');
              valueEl.style.setProperty('white-space', 'nowrap', 'important');
              valueEl.style.setProperty('align-self', 'flex-start', 'important');
              valueEl.style.setProperty('text-align', 'left', 'important');

              pressureMeta.style.setProperty('display', 'flex', 'important');
              pressureMeta.style.setProperty('flex-direction', 'column', 'important');
              pressureMeta.style.setProperty('align-items', 'flex-start', 'important');
              pressureMeta.style.setProperty('justify-content', 'flex-start', 'important');
              pressureMeta.style.setProperty('row-gap', '0', 'important');
              pressureMeta.style.setProperty('margin', '0', 'important');
              pressureMeta.style.setProperty('white-space', 'nowrap', 'important');

              pressureMetaLabel.style.setProperty('display', 'block', 'important');
              if (metaComputed) {
                pressureMetaLabel.style.setProperty('font-family', metaComputed.fontFamily, 'important');
                pressureMetaLabel.style.setProperty('font-size', metaComputed.fontSize, 'important');
                pressureMetaLabel.style.setProperty('line-height', metaComputed.lineHeight, 'important');
                pressureMetaLabel.style.setProperty('font-weight', metaComputed.fontWeight, 'important');
                pressureMetaLabel.style.setProperty('letter-spacing', metaComputed.letterSpacing, 'important');
                pressureMetaLabel.style.setProperty('text-transform', metaComputed.textTransform, 'important');
              } else {
                pressureMetaLabel.style.setProperty('font-size', '8px', 'important');
                pressureMetaLabel.style.setProperty('line-height', '8px', 'important');
                pressureMetaLabel.style.setProperty('font-weight', '400', 'important');
                pressureMetaLabel.style.setProperty('letter-spacing', '1px', 'important');
                pressureMetaLabel.style.setProperty('text-transform', 'uppercase', 'important');
              }
              if (locationComputed) {
                pressureMetaLabel.style.setProperty('color', locationComputed.color, 'important');
                pressureMetaLabel.style.setProperty('opacity', locationComputed.opacity, 'important');
              } else {
                pressureMetaLabel.style.setProperty('opacity', '0.92', 'important');
              }
              pressureMetaLabel.style.setProperty('margin', '0', 'important');
              pressureMetaLabel.style.setProperty('text-align', 'left', 'important');

              pressureMetaUnit.style.setProperty('display', 'block', 'important');
              pressureMetaUnit.style.setProperty('font-size', '5px', 'important');
              pressureMetaUnit.style.setProperty('line-height', '5px', 'important');
              pressureMetaUnit.style.setProperty('font-weight', '400', 'important');
              pressureMetaUnit.style.setProperty('letter-spacing', '0.7px', 'important');
              pressureMetaUnit.style.setProperty('text-transform', 'none', 'important');
              pressureMetaUnit.style.setProperty('opacity', '0.96', 'important');
              pressureMetaUnit.style.setProperty('margin', '0', 'important');
              pressureMetaUnit.style.setProperty('text-align', 'left', 'important');

              chip.style.setProperty('display', 'inline-flex', 'important');
              chip.style.setProperty('flex-direction', 'row', 'important');
              chip.style.setProperty('align-items', 'flex-start', 'important');
              chip.style.setProperty('justify-content', 'flex-end', 'important');
              chip.style.setProperty('column-gap', '8px', 'important');
              chip.style.setProperty('width', 'auto', 'important');
              chip.style.setProperty('max-width', 'max-content', 'important');
              chip.dataset.weatherPressureLayout = 'reference';

              if (chip.children.length !== 2 || chip.children[0] !== valueEl || chip.children[1] !== pressureMeta) {
                chip.replaceChildren(valueEl, pressureMeta);
              }

              chip.dataset.weatherTypographyReady = 'true';
              return;
            }

            if (tempComputed && !isPressureChip) {
              const tempSize = Number.parseFloat(tempComputed.fontSize) || 22;
              const resolvedValueSize = `${Math.max(12.5, Math.min(15.5, tempSize * 0.58)).toFixed(2)}px`;
              valueEl.style.setProperty('font-family', tempComputed.fontFamily, 'important');
              valueEl.style.setProperty('font-weight', tempComputed.fontWeight, 'important');
              valueEl.style.setProperty('line-height', '12px', 'important');
              valueEl.style.setProperty('font-size', resolvedValueSize, 'important');
            }

            valueEl.style.setProperty('letter-spacing', '0', 'important');
            valueEl.style.setProperty('text-transform', 'none', 'important');
            valueEl.style.setProperty('display', 'flex', 'important');
            valueEl.style.setProperty('align-items', 'baseline', 'important');
            valueEl.style.setProperty('justify-content', 'flex-end', 'important');
            valueEl.style.setProperty('flex-wrap', 'nowrap', 'important');
            valueEl.style.setProperty('gap', '1px', 'important');
            valueEl.style.setProperty('white-space', 'nowrap', 'important');
            valueEl.style.setProperty('margin', '0 0 1px 0', 'important');

            if (isPressureChip || isHumidityChip) {
              valueEl.style.setProperty('font-size', '12.5px', 'important');
              valueEl.style.setProperty('line-height', '12.5px', 'important');
              valueEl.style.setProperty('font-weight', '400', 'important');
            }

            if (valueMatch) {
              const numberPart = document.createElement('span');
              const unitPart = document.createElement('span');
              const valueBaseSizePx =
                Number.parseFloat(valueEl.style.fontSize || window.getComputedStyle(valueEl).fontSize) || 13.5;

              numberPart.textContent = valueMatch[1].replace(',', '.');
              numberPart.style.setProperty('display', 'inline', 'important');
              numberPart.style.setProperty('line-height', '1', 'important');

              let unitText = valueMatch[2].trim();
              if (isPressureChip) {
                unitText = normalizePressureUnit(unitText);
              }
              unitPart.textContent = unitText;
              unitPart.style.setProperty('display', 'inline-block', 'important');
              unitPart.style.setProperty('line-height', '1', 'important');
              if (isHeaderWeatherCelsiusUnitText(unitText)) {
                syncHeaderWeatherCelsiusUnitTopToDigit(unitPart, numberPart);
              } else {
                unitPart.style.setProperty('font-size', unitText.length <= 2 ? '0.58em' : '0.66em', 'important');
                unitPart.style.setProperty(
                  'transform',
                  unitText.length <= 2 ? 'translateY(-0.42em)' : 'translateY(-0.14em)',
                  'important'
                );
              }
              unitPart.style.setProperty('text-transform', 'none', 'important');
              unitPart.style.setProperty('font-variant', 'normal', 'important');
              unitPart.style.setProperty('font-variant-caps', 'normal', 'important');
              unitPart.style.setProperty('font-feature-settings', '"smcp" 0, "c2sc" 0', 'important');
              if (isPressureChip) {
                numberPart.style.setProperty('font-size', `${(valueBaseSizePx - 2).toFixed(2)}px`, 'important');
                unitPart.style.setProperty('font-size', '5px', 'important');
                unitPart.style.setProperty('transform', 'translateY(0)', 'important');
                unitPart.style.setProperty('line-height', '1', 'important');
                unitPart.style.setProperty('margin-left', '1px', 'important');
                valueEl.style.setProperty('gap', '1px', 'important');
                valueEl.style.setProperty('align-items', 'flex-end', 'important');
              }
              unitPart.style.setProperty('letter-spacing', '0', 'important');
              unitPart.style.setProperty('opacity', '0.96', 'important');

              if (isHumidityChip) {
                numberPart.style.setProperty('font-size', `${(valueBaseSizePx - 2).toFixed(2)}px`, 'important');
                unitPart.style.setProperty(
                  'font-size',
                  `${Math.max(7, valueBaseSizePx * 0.62 - 2).toFixed(2)}px`,
                  'important'
                );
                unitPart.style.setProperty('transform', 'translateY(0)', 'important');
                unitPart.style.setProperty('line-height', '1', 'important');
                unitPart.style.setProperty('margin-left', '0', 'important');
                valueEl.style.setProperty('gap', '0', 'important');
                valueEl.style.setProperty('align-items', 'flex-end', 'important');
              }

              valueEl.replaceChildren(numberPart, unitPart);
            }
          }

          chip.dataset.weatherTypographyReady = 'true';
        };

        const windChip = allChips.find(chip => /wind|ветер|вітер/i.test(chip.textContent || '')) || null;
        let humidityChip =
          allChips.find(chip => /humid|влаж|feucht|волог|umid|humedad/i.test(chip.textContent || '')) || null;
        let pressureChip =
          allChips.find(chip => /pressure|давлен|тиск|druck|presion/i.test(chip.textContent || '')) || null;
        // Always render humidity row; value is sourced from menu humidity item when available.
        if (!humidityChip && root) {
          const lang = (document.documentElement.lang || 'ru').toLowerCase();
          const labelByLang = {
            ru: 'ВЛАЖНОСТЬ',
            uk: 'ВОЛОГІСТЬ',
            de: 'LUFTFEUCHTE',
            en: 'HUMIDITY',
          };
          const fallbackLabel = labelByLang[lang] || 'HUMIDITY';

          let fallbackChip = root.querySelector('.weather-header-card__chip--humidity-fallback');
          if (!(fallbackChip instanceof HTMLElement)) {
            fallbackChip = document.createElement('div');
            fallbackChip.className = 'weather-header-card__chip weather-header-card__chip--humidity-fallback';
            const labelEl = document.createElement('span');
            const valueEl = document.createElement('span');
            fallbackChip.append(labelEl, valueEl);
          }

          const children = Array.from(fallbackChip.children).filter(el => el instanceof HTMLElement);
          const labelEl = children[0];
          const valueEl = children[1];
          if (labelEl instanceof HTMLElement && valueEl instanceof HTMLElement) {
            labelEl.textContent = fallbackLabel;
            valueEl.textContent = host?.__weatherHumidityValue || '--';
          }

          humidityChip = fallbackChip;
        }

        if (humidityChip && root) {
          const syncHumidityValue = () => {
            hydrateHeaderWeatherReadingsFromCache(host);

            const snapshotHumidity = host?.__weatherReadingsSnapshot?.humidity;
            if (snapshotHumidity) {
              const normalizedSnapshotHumidity = normalizeHeaderWeatherHumidityValue(snapshotHumidity);
              if (normalizedSnapshotHumidity) {
                host.__weatherHumidityValue = normalizedSnapshotHumidity;
                writeHeaderWeatherReadingsCache(host, { humidity: normalizedSnapshotHumidity });
              }
            } else {
              const directHumidity = Number(host?.__weatherCurrentMeta?.humidity);
              if (Number.isFinite(directHumidity) && directHumidity >= 0) {
                const nextHumidity = normalizeHeaderWeatherHumidityValue(directHumidity);
                if (nextHumidity) {
                  host.__weatherHumidityValue = nextHumidity;
                  writeHeaderWeatherReadingsCache(host, { humidity: nextHumidity });
                }
              } else {
                const previewHumidityChip = Array.from(root.querySelectorAll('.weather-header-card__chip')).find(el =>
                  /(влажност[ьи]|humidity|luftfeuchte|вологіст[ьи]|humedad)/i.test(el.textContent || '')
                );
                const previewMatch = (previewHumidityChip?.textContent || '').match(/(\d{1,3})\s*%/);
                if (previewMatch && host) {
                  const nextHumidity = normalizeHeaderWeatherHumidityValue(`${previewMatch[1]}%`);
                  if (nextHumidity) {
                    host.__weatherHumidityValue = nextHumidity;
                    writeHeaderWeatherReadingsCache(host, { humidity: nextHumidity });
                  }
                }
              }
            }

            const valueEl = Array.from(humidityChip.children).find(
              el => el instanceof HTMLElement && /%|--/.test(el.textContent || '')
            );
            if (valueEl instanceof HTMLElement) {
              valueEl.textContent = host?.__weatherHumidityValue || '--';
            }

            return Boolean(host?.__weatherHumidityValue && host.__weatherHumidityValue !== '--');
          };

          const hasHumidityNow = syncHumidityValue();

          // Short bounded retries so humidity appears immediately after async menu rendering.
          if (host) {
            if (host.__weatherHumidityRetryTimer) {
              window.clearTimeout(host.__weatherHumidityRetryTimer);
              host.__weatherHumidityRetryTimer = null;
            }

            if (!hasHumidityNow) {
              let attempts = 0;
              const retrySync = () => {
                attempts += 1;
                const ok = syncHumidityValue();
                if (ok || attempts >= 8) {
                  host.__weatherHumidityRetryTimer = null;
                  return;
                }
                host.__weatherHumidityRetryTimer = window.setTimeout(retrySync, 250);
              };

              host.__weatherHumidityRetryTimer = window.setTimeout(retrySync, 120);
            }
          }
        }

        // Pressure row: keep a strict locale-specific unit and never mix formats.
        if (!pressureChip && root) {
          const lang = getHeaderWeatherPressureLang(host);
          const labelByLang = {
            ru: 'ДАВЛЕНИЕ',
            uk: 'ТИСК',
            de: 'DRUCK',
            en: 'PRESSURE',
          };
          const fallbackLabel = labelByLang[lang] || 'PRESSURE';
          const fallbackValue = formatHeaderWeatherPressureValue(host, host?.__weatherPressureMmHg);

          let fallbackChip = root.querySelector('.weather-header-card__chip--pressure-fallback');
          if (!(fallbackChip instanceof HTMLElement)) {
            fallbackChip = document.createElement('div');
            fallbackChip.className = 'weather-header-card__chip weather-header-card__chip--pressure-fallback';
            const labelEl = document.createElement('span');
            const valueEl = document.createElement('span');
            fallbackChip.append(labelEl, valueEl);
          }

          const children = Array.from(fallbackChip.children).filter(el => el instanceof HTMLElement);
          const labelEl = children[0];
          const valueEl = children[1];
          if (labelEl instanceof HTMLElement && valueEl instanceof HTMLElement) {
            labelEl.textContent = fallbackLabel;
            valueEl.textContent = fallbackValue;
          }

          pressureChip = fallbackChip;
        }

        if (pressureChip && root) {
          hydrateHeaderWeatherReadingsFromCache(host);

          const rootText = (root.textContent || '').replace(/\s+/g, ' ');

          let pressureMmHg = null;

          if (Number.isFinite(Number(host?.__weatherPressureMmHg)) && Number(host.__weatherPressureMmHg) > 0) {
            pressureMmHg = Number(host.__weatherPressureMmHg);
          }

          const directPressureHpa = Number(
            host?.__weatherCurrentMeta?.pressureMsl ?? host?.__weatherCurrentMeta?.surfacePressure
          );
          if (pressureMmHg === null && Number.isFinite(directPressureHpa) && directPressureHpa > 0) {
            pressureMmHg = Math.round(directPressureHpa * 0.750061683);
          }

          if (pressureMmHg === null) {
            const previewPressureChip = Array.from(root.querySelectorAll('.weather-header-card__chip')).find(el =>
              /(давлен|pressure|druck|тиск|presion)/i.test(el.textContent || '')
            );
            const previewPressureText = (previewPressureChip?.textContent || '').replace(/\s+/g, ' ');
            const mmMatch = previewPressureText.match(/(\d{2,4})\s*(мм|mm)/i);
            const hpaMatch = previewPressureText.match(/(\d{2,4})\s*(hpa|mb|mbar|гпа)/i);

            if (mmMatch) {
              pressureMmHg = Number(mmMatch[1]);
            } else if (hpaMatch) {
              const hpa = Number(hpaMatch[1]);
              pressureMmHg = Number.isFinite(hpa) ? Math.round(hpa * 0.750061683) : null;
            }
          }

          if (pressureMmHg === null) {
            const rootMmMatch = rootText.match(/(давлен|pressure|druck|тиск|presion)[^\d]{0,20}(\d{2,4})\s*(мм|mm)/i);
            const rootHpaMatch = rootText.match(
              /(давлен|pressure|druck|тиск|presion)[^\d]{0,20}(\d{2,4})\s*(hpa|mb|mbar|гпа)/i
            );
            if (rootMmMatch) {
              pressureMmHg = Number(rootMmMatch[2]);
            } else if (rootHpaMatch) {
              const hpa = Number(rootHpaMatch[2]);
              pressureMmHg = Number.isFinite(hpa) ? Math.round(hpa * 0.750061683) : null;
            }
          }

          if (pressureMmHg !== null && Number.isFinite(pressureMmHg) && host) {
            host.__weatherPressureMmHg = pressureMmHg;
            host.__weatherPressureValue = formatHeaderWeatherPressureValue(host, pressureMmHg);
            writeHeaderWeatherReadingsCache(host, { pressureMmHg });
          }

          const valueEl = Array.from(pressureChip.children).find(
            el => el instanceof HTMLElement && /\d|--/.test(el.textContent || '')
          );
          if (valueEl instanceof HTMLElement) {
            const nextPressureValue = formatHeaderWeatherPressureValue(host, host?.__weatherPressureMmHg);
            const nextPressureMatch = nextPressureValue.match(/^(-?\d+(?:[.,]\d+)?|--)(.*)$/);
            if (pressureChip.dataset.weatherPressureLayout === 'reference' && nextPressureMatch) {
              const nextPressureNumber = nextPressureMatch[1] === '--' ? '--' : nextPressureMatch[1].replace(',', '.');
              if (valueEl.textContent !== nextPressureNumber) {
                valueEl.textContent = nextPressureNumber;
              }
            } else if (valueEl.textContent !== nextPressureValue) {
              valueEl.textContent = nextPressureValue;
              delete pressureChip.dataset.weatherTypographyReady;
            }
          }
        }

        layoutPressureChip = pressureChip;
        layoutHumidityChip = humidityChip;

        if (tempRow instanceof HTMLElement) {
          sanitizeHeaderWeatherBottomRow(tempRow, chips);
        }

        if (humidityChip) {
          normalizeInlineText(humidityChip);

          humidityChip.style.setProperty('display', 'flex', 'important');
          humidityChip.style.setProperty('flex-direction', 'row', 'important');
          humidityChip.style.setProperty('align-items', 'baseline', 'important');
          humidityChip.style.setProperty('justify-content', 'flex-end', 'important');
          humidityChip.style.setProperty('column-gap', '4px', 'important');

          Array.from(humidityChip.children).forEach(child => {
            if (!(child instanceof HTMLElement)) {
              return;
            }
            normalizeInlineText(child);
            child.style.setProperty('display', 'inline-block', 'important');
            child.style.setProperty('width', 'auto', 'important');
            child.style.setProperty('white-space', 'nowrap', 'important');
            child.style.setProperty('text-align', 'right', 'important');
            child.style.setProperty('margin', '0', 'important');
          });

          applyChipTypography(humidityChip);
        }

        if (pressureChip) {
          normalizeInlineText(pressureChip);

          if (pressureChip.dataset.weatherPressureLayout !== 'reference') {
            delete pressureChip.dataset.weatherTypographyReady;
          }

          pressureChip.style.setProperty('display', 'inline-flex', 'important');
          const isReferencePressureLayout = pressureChip.dataset.weatherPressureLayout === 'reference';
          pressureChip.style.setProperty('flex-direction', isReferencePressureLayout ? 'row' : 'column', 'important');
          pressureChip.style.setProperty(
            'align-items',
            isReferencePressureLayout ? 'flex-start' : 'flex-end',
            'important'
          );
          pressureChip.style.setProperty(
            'justify-content',
            isReferencePressureLayout ? 'flex-end' : 'flex-start',
            'important'
          );
          pressureChip.style.setProperty('column-gap', isReferencePressureLayout ? '8px' : '0', 'important');

          if (pressureChip.dataset.weatherPressureLayout === 'reference') {
            const pressureValueNode = pressureChip.children[0];
            const pressureMetaNode = pressureChip.children[1];
            if (pressureValueNode instanceof HTMLElement) {
              pressureValueNode.style.setProperty('display', 'block', 'important');
              pressureValueNode.style.setProperty('font-size', '10.5px', 'important');
              pressureValueNode.style.setProperty('line-height', '0.92', 'important');
              pressureValueNode.style.setProperty('font-weight', '300', 'important');
              pressureValueNode.style.setProperty('white-space', 'nowrap', 'important');
              pressureValueNode.style.setProperty('margin', '0', 'important');
              pressureValueNode.style.setProperty('align-self', 'flex-start', 'important');
            }
            if (pressureMetaNode instanceof HTMLElement) {
              pressureMetaNode.style.setProperty('display', 'flex', 'important');
              pressureMetaNode.style.setProperty('flex-direction', 'column', 'important');
              pressureMetaNode.style.setProperty('align-items', 'flex-start', 'important');
              pressureMetaNode.style.setProperty('justify-content', 'flex-start', 'important');
              pressureMetaNode.style.setProperty('row-gap', '0', 'important');
            }
          } else {
            Array.from(pressureChip.children).forEach(child => {
              if (!(child instanceof HTMLElement)) {
                return;
              }
              normalizeInlineText(child);
              child.style.setProperty('display', 'block', 'important');
              child.style.setProperty('width', 'auto', 'important');
              child.style.setProperty('white-space', 'nowrap', 'important');
              child.style.setProperty('text-align', 'right', 'important');
            });

            const pressureChildren = Array.from(pressureChip.children).filter(child => child instanceof HTMLElement);
            const pressureLabel = pressureChildren[0] || null;
            if (pressureLabel instanceof HTMLElement) {
              pressureLabel.style.setProperty('display', 'block', 'important');
              pressureLabel.style.setProperty('width', 'max-content', 'important');
              pressureLabel.style.setProperty('margin-left', 'auto', 'important');
              pressureLabel.style.setProperty('text-align', 'right', 'important');
            }
          }

          applyChipTypography(pressureChip);
        }

        if (windChip) {
          windChip.dataset.weatherMetric = 'wind';
          windChip.style.setProperty('display', 'none', 'important');
        }

        const tempRowChips = tempRow?.querySelector('.weather-header-card__chips');
        if (tempRowChips instanceof HTMLElement) {
          tempRowChips.style.setProperty('display', 'flex', 'important');
          Array.from(tempRowChips.querySelectorAll('.weather-header-card__chip')).forEach(chip => {
            if (/wind|ветер|вітер/i.test(chip.textContent || '')) {
              chip.dataset.weatherMetric = 'wind';
              chip.style.setProperty('display', 'none', 'important');
              return;
            }
            if (/gef|ощущ|feels|відчува/i.test(chip.textContent || '')) {
              chip.classList.add('weather-header-card__chip--feels-like');
            }
          });
        }

        if (!chips.children.length) {
          chips.style.setProperty('display', 'none', 'important');
        }
      }

      if (rightColumn instanceof HTMLElement) {
        rightColumn.style.setProperty('display', showMetrics ? 'flex' : 'none', 'important');
        const metricChipPool = [
          ...Array.from(rightColumn.querySelectorAll('.weather-header-card__chip')),
          ...(chips instanceof HTMLElement ? Array.from(chips.querySelectorAll('.weather-header-card__chip')) : []),
          ...Array.from(
            root.querySelectorAll(
              '.weather-header-card__chip--pressure-fallback, .weather-header-card__chip--humidity-fallback'
            )
          ),
        ];
        const pressureChipForLayout =
          layoutPressureChip ||
          rightColumn.querySelector('.weather-header-card__chip--pressure-fallback') ||
          metricChipPool.find(chip => /pressure|давлен|тиск|druck|presion/i.test(chip.textContent || '')) ||
          null;
        const humidityChipForLayout =
          layoutHumidityChip ||
          rightColumn.querySelector('.weather-header-card__chip--humidity-fallback') ||
          metricChipPool.find(chip => /humid|влаж|feucht|волог|umid|humedad/i.test(chip.textContent || '')) ||
          null;

        syncHeaderWeatherRightColumnAlign(host, {
          rightColumn,
          condition,
          pressureChip: pressureChipForLayout,
          humidityChip: humidityChipForLayout,
        });

        rightColumn.style.setProperty('display', showMetrics ? 'flex' : 'none', 'important');
        rightColumn.style.setProperty('visibility', showMetrics ? 'visible' : 'hidden', 'important');
        rightColumn.style.setProperty('pointer-events', showMetrics ? 'auto' : 'none', 'important');
        rightColumn.setAttribute('aria-hidden', showMetrics ? 'false' : 'true');

        const rightColumnMetrics = rightColumn.querySelectorAll(
          '.weather-header-card__chip, .weather-header-card__condition'
        );
        rightColumnMetrics.forEach(metricNode => {
          if (!(metricNode instanceof HTMLElement)) {
            return;
          }
          metricNode.style.setProperty('display', showMetrics ? 'flex' : 'none', 'important');
          metricNode.style.setProperty('visibility', showMetrics ? 'visible' : 'hidden', 'important');
          metricNode.setAttribute('aria-hidden', showMetrics ? 'false' : 'true');
        });
      }

      refreshHeaderWeatherPreviewValues(host);

      let feelsLikeChipForAlign = null;
      const previewTempHost = tempRow instanceof HTMLElement ? tempRow : bottom instanceof HTMLElement ? bottom : null;
      if (previewTempHost instanceof HTMLElement) {
        const strayFeelsChip = content?.querySelector('.weather-header-card__chip--feels-like');
        const tempRowChipsForFeels = previewTempHost.querySelector('.weather-header-card__chips');
        if (strayFeelsChip instanceof HTMLElement && tempRowChipsForFeels instanceof HTMLElement) {
          tempRowChipsForFeels.appendChild(strayFeelsChip);
        }
        feelsLikeChipForAlign = applyHeaderWeatherFeelsLikePreview(host, {
          tempRow: previewTempHost,
          chips,
          root,
          infoPanel,
        });
        ensureHeaderWeatherInfoPanel(root, topRow, titleBlock, bottom);
        if (feelsLikeChipForAlign instanceof HTMLElement) {
          const feelsLabel = feelsLikeChipForAlign.querySelector('.weather-header-card__feels-label');
          if (feelsLabel instanceof HTMLElement) {
            alignHeaderWeatherFeelsLikeRow(feelsLikeChipForAlign, feelsLabel, {
              root,
              tempRow: previewTempHost,
              eyebrow,
              locationLabel,
              locationCurrent,
            });
          }
        }
      }

      syncHeaderWeatherLeftTextColumn(host, {
        eyebrow,
        titleBlock,
        locationRow,
        locationLabel,
        meta,
        tempRow,
        locationCurrent,
        infoPanel,
        feelsLikeChip: feelsLikeChipForAlign,
      });

      ensureHeaderWeatherMenuToggleAnchor(root, card);

      if (feelsLikeChipForAlign instanceof HTMLElement) {
        const feelsLabelFinal = feelsLikeChipForAlign.querySelector('.weather-header-card__feels-label');
        if (feelsLabelFinal instanceof HTMLElement) {
          alignHeaderWeatherFeelsLikeRow(feelsLikeChipForAlign, feelsLabelFinal, {
            root,
            tempRow,
            eyebrow,
            locationLabel,
            locationCurrent,
          });
        }
      }

      const finalizedFeelsChip = ensureHeaderWeatherCollapsedFeelsFallback(host, root);
      if (finalizedFeelsChip instanceof HTMLElement) {
        const finalFeelsLabel = finalizedFeelsChip.querySelector('.weather-header-card__feels-label');
        if (finalFeelsLabel instanceof HTMLElement) {
          alignHeaderWeatherFeelsLikeRow(finalizedFeelsChip, finalFeelsLabel, {
            root,
            tempRow,
            eyebrow,
            locationLabel,
            locationCurrent,
          });
        }
      }

      const finalFeelsChipForBaseline =
        finalizedFeelsChip instanceof HTMLElement ? finalizedFeelsChip : feelsLikeChipForAlign;
      if (finalFeelsChipForBaseline instanceof HTMLElement) {
        const applyFinalFeelsBaseline = () => {
          const mainTempNode =
            tempRow?.querySelector('.weather-header-card__temperature') ||
            bottom?.querySelector('.weather-header-card__temperature') ||
            root.querySelector('.weather-header-card__temperature');
          const finalFeelsValueRow = finalFeelsChipForBaseline.querySelector(
            '.weather-header-card__feels-value, .weather-header-card__feels-row'
          );

          if (!(mainTempNode instanceof HTMLElement) || !(finalFeelsValueRow instanceof HTMLElement)) {
            return;
          }

          syncHeaderWeatherFeelsBaseline(finalFeelsChipForBaseline, mainTempNode, finalFeelsValueRow);
        };

        runHeaderWeatherPostLayoutPass(applyFinalFeelsBaseline, 2);
      } else {
        scheduleHeaderWeatherPlacementRetry(host);
      }

      const syncPressureLabelToLocationColor = () => {
        const finalLocationLabelNode = root.querySelector('.weather-header-card__location');
        const finalPressureMetaLabelNode = root.querySelector('.weather-header-card__pressure-meta-label');
        if (!(finalLocationLabelNode instanceof HTMLElement) || !(finalPressureMetaLabelNode instanceof HTMLElement)) {
          return;
        }

        const locationFinalComputed = window.getComputedStyle(finalLocationLabelNode);
        finalPressureMetaLabelNode.style.setProperty('color', locationFinalComputed.color, 'important');
        finalPressureMetaLabelNode.style.setProperty('opacity', locationFinalComputed.opacity, 'important');
      };
      runHeaderWeatherPostLayoutPass(syncPressureLabelToLocationColor, 2);

      normalizeHeaderWeatherCelsiusUnits(host);
      if (HEADER_WEATHER_STRICT_STYLE_LOCK && hasCompleteLockedPreview()) {
        resetHeaderWeatherPlacementRetry(host);
        host.__weatherPlacementLockedOnce = true;
      } else {
        scheduleHeaderWeatherPlacementRetry(host);
      }
    } finally {
      host.__weatherPlacementApplying = false;
    }
  }

  function ensureHeaderWeatherMenuPlacementLock(host) {
    if (!host || host.__weatherMenuPlacementLockActive) {
      return;
    }

    host.__weatherMenuPlacementLockActive = true;

    const finalize = () => {
      if (!host.isConnected) {
        host.__weatherMenuPlacementLockActive = false;
        return;
      }

      enforceHeaderWeatherMenuPlacement(host);
      if (!HEADER_WEATHER_STRICT_STYLE_LOCK) {
        scheduleHeaderBrandColumnAlign(host);
      }
      syncHeaderWeatherUnifiedReadings(host);
      syncHeaderWeatherToggleArrow(host);
      host.__weatherMenuPlacementLockActive = false;
    };

    enforceHeaderWeatherMenuPlacement(host);
    if (!HEADER_WEATHER_STRICT_STYLE_LOCK) {
      scheduleHeaderBrandColumnAlign(host);
    }
    syncHeaderWeatherUnifiedReadings(host);
    syncHeaderWeatherToggleArrow(host);
    window.requestAnimationFrame(finalize);
  }

  function createHeaderWeatherOrbOverlay(variant, role) {
    const overlay = document.createElement('div');
    overlay.className = `weather-orb-overlay weather-orb-overlay--${variant}`;
    overlay.dataset.orbRole = role;
    overlay.hidden = true;

    const video = document.createElement('video');
    video.className = 'weather-orb-overlay__video';
    video.autoplay = true;
    video.loop = role !== 'moon';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.hidden = true;

    const canvas = document.createElement('canvas');
    canvas.className = 'weather-orb-overlay__canvas';
    canvas.hidden = true;

    const image = document.createElement('img');
    image.className = 'weather-orb-overlay__image';
    image.alt = '';
    image.decoding = 'async';
    image.loading = 'eager';
    image.hidden = true;

    overlay.appendChild(video);
    overlay.appendChild(canvas);
    overlay.appendChild(image);
    return overlay;
  }

  function ensureHeaderWeatherStarsBackLayer(container) {
    if (!container) {
      return null;
    }

    const preview = container.matches?.('.weather-header-preview')
      ? container
      : container.closest?.('.weather-header-preview') || container.querySelector?.('.weather-header-preview');
    if (!preview) {
      return null;
    }

    let starsBack = preview.querySelector(':scope > .weather-header-preview__stars-back');
    if (!starsBack) {
      starsBack = document.createElement('div');
      starsBack.className = 'weather-header-preview__stars-back';
      starsBack.setAttribute('aria-hidden', 'true');
      preview.insertBefore(starsBack, preview.firstChild);
    } else if (preview.firstChild !== starsBack) {
      preview.insertBefore(starsBack, preview.firstChild);
    }

    const starsScenes = Array.from(preview.querySelectorAll('.weather-app__stars-scene--header-panel'));
    starsScenes.forEach(starsScene => {
      if (starsScene.parentElement !== starsBack) {
        starsBack.appendChild(starsScene);
      }
      starsScene.style.setProperty('position', 'absolute', 'important');
      starsScene.style.setProperty('inset', '0', 'important');
      starsScene.style.setProperty('pointer-events', 'none', 'important');
      starsScene.style.setProperty('z-index', '0', 'important');
    });

    return starsBack;
  }

  function syncHeaderWeatherPreviewLayerOrder(preview) {
    if (!(preview instanceof HTMLElement)) {
      return;
    }

    const starsBack = ensureHeaderWeatherStarsBackLayer(preview);
    const backStack = preview.querySelector('.weather-orb-stack--preview-back');
    const frontStack = preview.querySelector('.weather-orb-stack--preview-front');
    const scene = preview.querySelector('.weather-app__scene, .weather-app__scene--header');

    if (starsBack instanceof HTMLElement && preview.firstChild !== starsBack) {
      preview.insertBefore(starsBack, preview.firstChild);
    }

    if (backStack instanceof HTMLElement) {
      if (starsBack instanceof HTMLElement && starsBack.nextElementSibling !== backStack) {
        starsBack.insertAdjacentElement('afterend', backStack);
      } else if (!starsBack && scene instanceof HTMLElement && backStack.parentElement === preview) {
        scene.before(backStack);
      }
    }

    if (frontStack instanceof HTMLElement && backStack instanceof HTMLElement) {
      if (backStack.nextElementSibling !== frontStack) {
        backStack.insertAdjacentElement('afterend', frontStack);
      }
    }

    if (scene instanceof HTMLElement) {
      const anchor = frontStack || backStack || starsBack;
      if (anchor instanceof HTMLElement && anchor.nextElementSibling !== scene) {
        anchor.insertAdjacentElement('afterend', scene);
      }
    }
  }

  function ensureHeaderWeatherDropdownStarsBackLayer(dropdown) {
    if (!dropdown) {
      return null;
    }

    let starsBack = dropdown.querySelector(':scope > .weather-header-dropdown__stars-back');
    if (!starsBack) {
      starsBack = document.createElement('div');
      starsBack.className = 'weather-header-dropdown__stars-back';
      starsBack.setAttribute('aria-hidden', 'true');
      dropdown.insertBefore(starsBack, dropdown.firstChild);
    }

    return starsBack;
  }

  function ensureHeaderWeatherOrbStack(container, variant) {
    const legacyOverlay = container.querySelector(`:scope > .weather-orb-overlay--${variant}`);
    if (
      legacyOverlay &&
      !container.querySelector(`.weather-orb-stack--${variant}`) &&
      !container.querySelector(`.weather-orb-stack--${variant}-back`)
    ) {
      legacyOverlay.remove();
    }

    if (variant === 'preview') {
      ensureHeaderWeatherStarsBackLayer(container);

      let backStack = container.querySelector('.weather-orb-stack--preview-back');
      let frontStack = container.querySelector('.weather-orb-stack--preview-front');
      const legacyStack = container.querySelector(
        '.weather-orb-stack--preview:not(.weather-orb-stack--preview-back):not(.weather-orb-stack--preview-front)'
      );

      let legacyMoon = null;
      let legacySun = null;
      if (legacyStack) {
        legacyMoon = legacyStack.querySelector('[data-orb-role="moon"]');
        legacySun = legacyStack.querySelector('[data-orb-role="sun"]');
        legacyStack.remove();
      }

      if (!backStack) {
        backStack = document.createElement('div');
        backStack.className = 'weather-orb-stack weather-orb-stack--preview weather-orb-stack--preview-back';
        backStack.append(legacyMoon || createHeaderWeatherOrbOverlay('preview', 'moon'));
        const scene = container.querySelector('.weather-app__scene');
        if (scene) {
          scene.before(backStack);
        } else {
          container.prepend(backStack);
        }
      } else if (legacyMoon && !backStack.querySelector('[data-orb-role="moon"]')) {
        backStack.append(legacyMoon);
      }

      if (!frontStack) {
        frontStack = document.createElement('div');
        frontStack.className = 'weather-orb-stack weather-orb-stack--preview weather-orb-stack--preview-front';
        frontStack.append(legacySun || createHeaderWeatherOrbOverlay('preview', 'sun'));
        const scene = container.querySelector('.weather-app__scene');
        if (scene) {
          scene.before(frontStack);
        } else {
          container.appendChild(frontStack);
        }
      } else if (legacySun && !frontStack.querySelector('[data-orb-role="sun"]')) {
        frontStack.append(legacySun);
      }

      const sceneAnchor = container.querySelector('.weather-app__scene');
      if (sceneAnchor && backStack && backStack.nextElementSibling !== frontStack) {
        frontStack?.before(backStack);
      }
      if (sceneAnchor && frontStack && frontStack.nextElementSibling !== sceneAnchor) {
        sceneAnchor.before(frontStack);
      }

      syncHeaderWeatherPreviewLayerOrder(container);

      return {
        moon: backStack.querySelector('[data-orb-role="moon"]'),
        sun: frontStack.querySelector('[data-orb-role="sun"]'),
      };
    }

    let stack = container.querySelector('.weather-orb-stack--dropdown');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'weather-orb-stack weather-orb-stack--dropdown';
      stack.append(createHeaderWeatherOrbOverlay('dropdown', 'moon'));
      stack.append(createHeaderWeatherOrbOverlay('dropdown', 'sun'));
      container.appendChild(stack);
    }

    if (!stack.querySelector('[data-orb-role="moon"]')) {
      stack.prepend(createHeaderWeatherOrbOverlay('dropdown', 'moon'));
    }

    if (!stack.querySelector('[data-orb-role="sun"]')) {
      stack.append(createHeaderWeatherOrbOverlay('dropdown', 'sun'));
    }

    return {
      moon: stack.querySelector('[data-orb-role="moon"]'),
      sun: stack.querySelector('[data-orb-role="sun"]'),
    };
  }

  function stopHeaderWeatherMoonTimelineSync(overlay) {
    if (!overlay) {
      return;
    }
    if (typeof overlay.__moonTimelineRaf === 'number') {
      cancelAnimationFrame(overlay.__moonTimelineRaf);
      overlay.__moonTimelineRaf = null;
    }
    overlay.__moonTimelineGetter = null;
  }

  function syncHeaderWeatherOrbVideoTimeline(overlay, timeline) {
    const video = overlay?.querySelector('video');
    if (!video || !timeline) {
      return;
    }

    const isSun = overlay.dataset.orbKind === 'sun';
    const fallbackDuration = isSun ? HEADER_WEATHER_SUN_VIDEO_DURATION_SEC : HEADER_WEATHER_MOON_VIDEO_DURATION_SEC;
    const duration =
      Number.isFinite(video.duration) && video.duration > 1
        ? video.duration
        : Number(timeline.videoDurationSec) || fallbackDuration;
    const progress = clampHeaderWeatherValue(Number(isSun ? timeline.dayProgress : timeline.nightProgress), 0, 1);
    const targetTime = progress * duration;

    if (Math.abs(video.currentTime - targetTime) > 0.28) {
      try {
        video.currentTime = targetTime;
      } catch (_error) {
        // Seek while metadata loads.
      }
    }

    if (overlay.classList.contains('is-visible') && video.paused) {
      video.play().catch(() => {});
    }
  }

  function startHeaderWeatherOrbTimelineSync(overlay, timelineGetter) {
    stopHeaderWeatherMoonTimelineSync(overlay);
    if (!overlay || typeof timelineGetter !== 'function') {
      return;
    }

    overlay.__moonTimelineGetter = timelineGetter;

    const tick = () => {
      const kind = overlay.dataset.orbKind;
      if (!overlay.isConnected || (kind !== 'moon' && kind !== 'sun')) {
        stopHeaderWeatherMoonTimelineSync(overlay);
        return;
      }

      const timeline = timelineGetter();
      if (timeline && overlay.classList.contains('is-visible')) {
        syncHeaderWeatherOrbVideoTimeline(overlay, timeline);
      }

      overlay.__moonTimelineRaf = requestAnimationFrame(tick);
    };

    tick();
  }

  function applyHeaderWeatherOrbCrossfade(overlay, part) {
    if (!overlay || !part) {
      return;
    }

    const opacity = clampHeaderWeatherValue(Number(part.opacity) || 0, 0, 1);
    overlay.style.setProperty('--orb-crossfade-opacity', opacity.toFixed(3));
    overlay.classList.toggle('is-visible', opacity > 0.02);
    overlay.hidden = opacity < 0.01;
  }

  function stopHeaderWeatherOrbRender(overlay) {
    if (!overlay) {
      return;
    }

    stopHeaderWeatherMoonTimelineSync(overlay);
    stopHeaderWeatherSunScene(overlay);

    const video = overlay.querySelector('video');
    if (overlay.__orbFrameScheduler === 'video' && typeof overlay.__orbFrameHandle === 'number') {
      video?.cancelVideoFrameCallback?.(overlay.__orbFrameHandle);
    } else if (overlay.__orbFrameScheduler === 'raf' && typeof overlay.__orbFrameHandle === 'number') {
      cancelAnimationFrame(overlay.__orbFrameHandle);
    }

    overlay.__orbFrameHandle = null;
    overlay.__orbFrameScheduler = null;
  }

  function clearHeaderWeatherOrbCanvas(overlay) {
    const canvas = overlay?.querySelector('canvas');
    const context = overlay?.__orbCanvasContext;
    if (!canvas || !context) {
      if (overlay?.__orbFrameCanvas && overlay?.__orbFrameContext) {
        overlay.__orbFrameContext.clearRect(0, 0, overlay.__orbFrameCanvas.width, overlay.__orbFrameCanvas.height);
      }
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    if (overlay.__orbFrameCanvas && overlay.__orbFrameContext) {
      overlay.__orbFrameContext.clearRect(0, 0, overlay.__orbFrameCanvas.width, overlay.__orbFrameCanvas.height);
    }
  }

  function resolveHeaderWeatherOrbCropBox(bounds, width, height, renderProfile) {
    if (!bounds || bounds.maxX < bounds.minX || bounds.maxY < bounds.minY) {
      return null;
    }

    const rawWidth = bounds.maxX - bounds.minX + 1;
    const rawHeight = bounds.maxY - bounds.minY + 1;
    const paddingX = Math.round(rawWidth * renderProfile.paddingRatio + width * renderProfile.baseMarginRatio);
    const paddingY = Math.round(rawHeight * renderProfile.paddingRatio + height * renderProfile.baseMarginRatio);
    const expandedLeft = bounds.minX - paddingX;
    const expandedTop = bounds.minY - paddingY;
    const expandedRight = bounds.maxX + paddingX;
    const expandedBottom = bounds.maxY + paddingY;
    const desiredSize = Math.max(
      expandedRight - expandedLeft + 1,
      expandedBottom - expandedTop + 1,
      Math.round(Math.min(width, height) / renderProfile.maxScale)
    );
    const size = Math.min(desiredSize, width, height);
    const centerX = (expandedLeft + expandedRight) / 2;
    const centerY = (expandedTop + expandedBottom) / 2;
    const cropX = clampHeaderWeatherValue(Math.round(centerX - size / 2), 0, Math.max(0, width - size));
    const cropY = clampHeaderWeatherValue(Math.round(centerY - size / 2), 0, Math.max(0, height - size));

    return { x: cropX, y: cropY, size };
  }

  function drawHeaderWeatherOrbFrame(overlay) {
    const video = overlay?.querySelector('video');
    const canvas = overlay?.querySelector('canvas');
    if (!video || !canvas || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return false;
    }

    const isMoonOrb = overlay?.dataset?.orbKind === 'moon';
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isMoonOrb ? 3 : 2);
    const targetWidth = Math.max(1, Math.round(overlay.clientWidth * pixelRatio));
    const targetHeight = Math.max(1, Math.round(overlay.clientHeight * pixelRatio));
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    const outputContext =
      overlay.__orbCanvasContext || canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    const frameCanvas = overlay.__orbFrameCanvas || document.createElement('canvas');
    if (frameCanvas.width !== targetWidth || frameCanvas.height !== targetHeight) {
      frameCanvas.width = targetWidth;
      frameCanvas.height = targetHeight;
    }

    const frameContext =
      overlay.__orbFrameContext || frameCanvas.getContext('2d', { alpha: true, willReadFrequently: true });
    if (!outputContext || !frameContext) {
      return false;
    }

    overlay.__orbCanvasContext = outputContext;
    overlay.__orbFrameCanvas = frameCanvas;
    overlay.__orbFrameContext = frameContext;

    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = 'high';
    frameContext.imageSmoothingEnabled = true;
    frameContext.imageSmoothingQuality = 'high';

    const scale = Math.min(targetWidth / video.videoWidth, targetHeight / video.videoHeight);
    const drawWidth = video.videoWidth * scale;
    const drawHeight = video.videoHeight * scale;
    const offsetX = (targetWidth - drawWidth) / 2;
    const offsetY = (targetHeight - drawHeight) / 2;
    const renderProfile =
      HEADER_WEATHER_ORB_RENDER_PROFILES[overlay?.dataset?.orbKind] || HEADER_WEATHER_ORB_RENDER_PROFILES.sun;

    frameContext.clearRect(0, 0, targetWidth, targetHeight);
    frameContext.filter = renderProfile.sourceFilter || 'none';
    frameContext.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
    frameContext.filter = 'none';

    const frame = frameContext.getImageData(0, 0, targetWidth, targetHeight);
    const { data } = frame;
    const focusBounds = { minX: targetWidth, minY: targetHeight, maxX: -1, maxY: -1, count: 0 };
    const visibleBounds = { minX: targetWidth, minY: targetHeight, maxX: -1, maxY: -1, count: 0 };

    for (let index = 0; index < data.length; index += 4) {
      const brightestChannel = Math.max(data[index], data[index + 1], data[index + 2]);
      let nextAlpha = data[index + 3];

      if (brightestChannel <= renderProfile.keyFloor) {
        nextAlpha = 0;
      } else if (brightestChannel < renderProfile.featherCeiling) {
        nextAlpha = Math.round(
          nextAlpha *
            ((brightestChannel - renderProfile.keyFloor) / (renderProfile.featherCeiling - renderProfile.keyFloor))
        );
      }

      if (renderProfile.alphaFloor && nextAlpha < renderProfile.alphaFloor) {
        nextAlpha = 0;
      }

      data[index + 3] = nextAlpha;
      if (nextAlpha <= 0) {
        continue;
      }

      const pixelIndex = index / 4;
      const x = pixelIndex % targetWidth;
      const y = Math.floor(pixelIndex / targetWidth);

      visibleBounds.minX = Math.min(visibleBounds.minX, x);
      visibleBounds.minY = Math.min(visibleBounds.minY, y);
      visibleBounds.maxX = Math.max(visibleBounds.maxX, x);
      visibleBounds.maxY = Math.max(visibleBounds.maxY, y);
      visibleBounds.count += 1;

      if (nextAlpha >= renderProfile.focusAlphaFloor && brightestChannel >= renderProfile.focusThreshold) {
        focusBounds.minX = Math.min(focusBounds.minX, x);
        focusBounds.minY = Math.min(focusBounds.minY, y);
        focusBounds.maxX = Math.max(focusBounds.maxX, x);
        focusBounds.maxY = Math.max(focusBounds.maxY, y);
        focusBounds.count += 1;
      }
    }

    frameContext.putImageData(frame, 0, 0);

    const cropBox = renderProfile.useFullFrame
      ? null
      : resolveHeaderWeatherOrbCropBox(
          focusBounds.count > 0 ? focusBounds : visibleBounds.count > 0 ? visibleBounds : null,
          targetWidth,
          targetHeight,
          renderProfile
        );

    outputContext.clearRect(0, 0, targetWidth, targetHeight);
    outputContext.filter = renderProfile.outputFilter || 'none';
    if (cropBox) {
      outputContext.drawImage(
        frameCanvas,
        cropBox.x,
        cropBox.y,
        cropBox.size,
        cropBox.size,
        0,
        0,
        targetWidth,
        targetHeight
      );
    } else {
      outputContext.drawImage(frameCanvas, 0, 0, targetWidth, targetHeight);
    }

    outputContext.filter = 'none';

    return true;
  }

  function startHeaderWeatherOrbRender(overlay) {
    const video = overlay?.querySelector('video');
    const canvas = overlay?.querySelector('canvas');
    const image = overlay?.querySelector('img');
    if (!overlay || !video || !canvas) {
      return;
    }

    stopHeaderWeatherOrbRender(overlay);

    const renderFrame = () => {
      if (overlay.hidden || !video.dataset.currentSrc) {
        return;
      }

      const didRender = drawHeaderWeatherOrbFrame(overlay);
      if (didRender) {
        canvas.hidden = false;
        if (image) {
          image.hidden = true;
        }
      }

      if (typeof video.requestVideoFrameCallback === 'function') {
        overlay.__orbFrameScheduler = 'video';
        overlay.__orbFrameHandle = video.requestVideoFrameCallback(() => {
          overlay.__orbFrameHandle = null;
          renderFrame();
        });
        return;
      }

      overlay.__orbFrameScheduler = 'raf';
      overlay.__orbFrameHandle = requestAnimationFrame(() => {
        overlay.__orbFrameHandle = null;
        renderFrame();
      });
    };

    renderFrame();
  }

  // Kept for optional future fallback; moon uses MP4 + canvas chroma-key.
  // eslint-disable-next-line no-unused-vars
  function startHeaderWeatherOrbTextureRender(overlay, texture) {
    stopHeaderWeatherOrbRender(overlay);
    const canvas = overlay.querySelector('canvas');
    if (!canvas) return;

    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d', { alpha: true });
    const REVOLUTION_MS = 200000;
    // Show only the equatorial band — tighter crop eliminates bright polar zones
    const BAND_START = 0.26; // skip top 26% (polar distortion + bright crater rims)
    const BAND_END = 0.74; // skip bottom 26%
    let startTime = null;

    const renderFrame = ts => {
      if (overlay.hidden) return;
      if (!startTime) startTime = ts;

      const pixelRatio = window.devicePixelRatio || 1;
      const w = overlay.clientWidth;
      const h = overlay.clientHeight;
      if (w < 8 || h < 8) {
        // Layout not ready yet, retry next frame
        overlay.__orbFrameScheduler = 'raf';
        overlay.__orbFrameHandle = requestAnimationFrame(renderFrame);
        return;
      }

      const targetWidth = Math.round(w * pixelRatio);
      const targetHeight = Math.round(h * pixelRatio);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      if (offCanvas.width !== targetWidth || offCanvas.height !== targetHeight) {
        offCanvas.width = targetWidth;
        offCanvas.height = targetHeight;
      }

      // Sphere radius — inset by 1px to avoid clip-edge artifacts
      const r = Math.min(targetWidth, targetHeight) / 2 - 1;
      const cx = targetWidth / 2;
      const cy = targetHeight / 2;
      const phase = ((ts - startTime) / REVOLUTION_MS) % 1;

      const texW = texture.naturalWidth || texture.width;
      const texH = texture.naturalHeight || texture.height;
      const srcY = Math.round(texH * BAND_START);
      const srcH = Math.round(texH * (BAND_END - BAND_START));
      // Keep correct aspect of the cropped band
      const croppedAspect = texW / srcH;
      const drawH = r * 2;
      const drawW = drawH * croppedAspect;
      const scrollX = phase * drawW;
      const startX = cx - r - scrollX;

      // Black background — eliminates any white from alpha:true canvas
      offCtx.clearRect(0, 0, targetWidth, targetHeight);
      offCtx.fillStyle = '#000';
      offCtx.fillRect(0, 0, targetWidth, targetHeight);

      offCtx.imageSmoothingEnabled = true;
      offCtx.imageSmoothingQuality = 'high';
      // Draw two copies side-by-side for seamless looping; +2px overlap prevents hairline seam
      offCtx.drawImage(texture, 0, srcY, texW, srcH, startX, cy - r, drawW, drawH);
      offCtx.drawImage(texture, 0, srcY, texW, srcH, startX + drawW - 2, cy - r, drawW, drawH);

      // Hard black ring — seals antialiasing fringe at sphere edge
      offCtx.beginPath();
      offCtx.arc(cx, cy, r, 0, Math.PI * 2);
      offCtx.strokeStyle = 'rgba(0,0,0,1)';
      offCtx.lineWidth = 2.5;
      offCtx.stroke();

      // Draw onto main canvas — glow halo first (no clip), then moon sphere clipped to circle
      const ctx = canvas.getContext('2d', { alpha: true });
      ctx.clearRect(0, 0, targetWidth, targetHeight);

      // Atmospheric glow outside the sphere — warm silver, no blue
      const halo = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r * 1.38);
      halo.addColorStop(0, 'rgba(210,205,195,0.10)');
      halo.addColorStop(0.5, 'rgba(190,185,170,0.05)');
      halo.addColorStop(1, 'rgba(170,165,150,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Moon sphere — clipped to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(offCanvas, 0, 0);
      ctx.restore();

      // Polar contour arcs — thin silver rim only at top and bottom of sphere perimeter
      const polarArcSpan = Math.PI * 0.38; // ~68° arc at each pole
      ctx.save();
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      // Top pole arc
      const topGrad = ctx.createLinearGradient(cx - r * 0.4, cy - r, cx + r * 0.4, cy - r);
      topGrad.addColorStop(0, 'rgba(200,198,190,0)');
      topGrad.addColorStop(0.5, 'rgba(200,198,190,0.32)');
      topGrad.addColorStop(1, 'rgba(200,198,190,0)');
      ctx.strokeStyle = topGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, -Math.PI / 2 - polarArcSpan / 2, -Math.PI / 2 + polarArcSpan / 2);
      ctx.stroke();
      // Bottom pole arc
      const botGrad = ctx.createLinearGradient(cx - r * 0.4, cy + r, cx + r * 0.4, cy + r);
      botGrad.addColorStop(0, 'rgba(200,198,190,0)');
      botGrad.addColorStop(0.5, 'rgba(200,198,190,0.28)');
      botGrad.addColorStop(1, 'rgba(200,198,190,0)');
      ctx.strokeStyle = botGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 1, Math.PI / 2 - polarArcSpan / 2, Math.PI / 2 + polarArcSpan / 2);
      ctx.stroke();
      ctx.restore();

      overlay.__orbFrameScheduler = 'raf';
      overlay.__orbFrameHandle = requestAnimationFrame(renderFrame);
    };

    overlay.__orbFrameScheduler = 'raf';
    overlay.__orbFrameHandle = requestAnimationFrame(renderFrame);
  }

  async function mountHeaderWeatherNasaEyesSun(overlay, assetConfig) {
    const canvas = overlay?.querySelector('canvas');
    const video = overlay?.querySelector('video');
    const image = overlay?.querySelector('img');
    if (!canvas || !assetConfig?.assetsModuleBase) {
      return;
    }

    stopHeaderWeatherOrbRender(overlay);
    stopHeaderWeatherSunScene(overlay);

    const mountToken = `${Date.now()}:${Math.random()}`;
    overlay.__sunSceneMountToken = mountToken;

    try {
      const module = await loadHeaderWeatherSunSceneModule();
      if (overlay.__sunSceneMountToken !== mountToken) {
        return;
      }

      const scene = await module.mountHeaderWeatherSunScene(canvas, {
        sunTextureUrl: assetConfig.sunTextureUrl,
        sunTextureFallbackUrl: assetConfig.sunTextureFallbackUrl,
        geoState: assetConfig.geoState,
      });

      if (overlay.__sunSceneMountToken !== mountToken) {
        scene.dispose();
        return;
      }

      overlay.__sunScene = scene;
      if (!overlay.__sunSceneResizeObserver && typeof ResizeObserver === 'function') {
        overlay.__sunSceneResizeObserver = new ResizeObserver(() => {
          overlay.__sunScene?.resize();
        });
        overlay.__sunSceneResizeObserver.observe(overlay);
      }

      if (video) {
        video.pause();
        video.hidden = true;
        if (video.dataset.currentSrc) {
          video.removeAttribute('src');
          video.load();
          delete video.dataset.currentSrc;
        }
      }
      canvas.hidden = false;
      if (image) {
        image.hidden = true;
      }
      scene.resize();
    } catch (_error) {
      if (overlay.__sunSceneMountToken === mountToken) {
        overlay.__sunSceneMountToken = null;
      }
    }
  }

  function setHeaderWeatherOrbSource(overlay, kind, assetConfig) {
    const video = overlay.querySelector('video');
    const canvas = overlay.querySelector('canvas');
    const image = overlay.querySelector('img');
    const videoSources = Array.isArray(assetConfig?.sources)
      ? assetConfig.sources.filter(Boolean)
      : assetConfig?.src
        ? [assetConfig.src]
        : [];
    const isNasaEyesSun = kind === 'sun' && assetConfig?.type === 'nasa-eyes-sun';
    if (!video) {
      return;
    }

    overlay.classList.toggle('is-sun', kind === 'sun');
    overlay.classList.toggle('is-moon', kind === 'moon');
    overlay.classList.toggle('is-nasa-eyes', isNasaEyesSun);
    overlay.classList.remove('is-native-alpha');
    overlay.dataset.orbKind = kind || '';

    if (!kind || !assetConfig || (!isNasaEyesSun && !videoSources.length && !assetConfig.src)) {
      stopHeaderWeatherOrbRender(overlay);
      stopHeaderWeatherMoonTimelineSync(overlay);
      overlay.hidden = true;
      overlay.classList.remove('is-visible');
      overlay.classList.remove('has-cloud-veil');
      video.onloadeddata = null;
      video.oncanplay = null;
      video.onerror = null;
      if (video.dataset.currentSrc) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        delete video.dataset.currentSrc;
      }
      if (canvas) {
        clearHeaderWeatherOrbCanvas(overlay);
        canvas.hidden = true;
      }
      if (image?.dataset.currentSrc) {
        image.removeAttribute('src');
        delete image.dataset.currentSrc;
      }
      if (image) {
        image.hidden = true;
      }
      delete overlay.dataset.currentSourceList;
      delete overlay.dataset.currentSourceIndex;
      overlay.style.removeProperty('--orb-cloud-alpha');
      overlay.style.removeProperty('--orb-core-opacity');
      overlay.style.removeProperty('--orb-cloud-blur');
      overlay.style.removeProperty('--orb-cloud-stretch-x');
      overlay.style.removeProperty('--orb-cloud-stretch-y');
      overlay.style.removeProperty('--orb-cloud-drift');
      overlay.style.removeProperty('--orb-cloud-lift');
      overlay.style.removeProperty('--orb-cloud-depth-alpha');
      overlay.style.removeProperty('--orb-cloud-highlight-alpha');
      return;
    }

    overlay.hidden = false;
    overlay.classList.add('is-visible');
    delete overlay.dataset.fallbackSrc;

    if (isNasaEyesSun) {
      if (overlay.__sunScene) {
        updateHeaderWeatherSunSceneGeo(overlay, assetConfig.geoState);
        if (video) {
          video.hidden = true;
        }
        if (canvas) {
          canvas.hidden = false;
        }
        if (image) {
          image.hidden = true;
        }
        return;
      }
      mountHeaderWeatherNasaEyesSun(overlay, assetConfig);
      return;
    }

    stopHeaderWeatherSunScene(overlay);

    if (assetConfig.type === 'video-keyed') {
      if (kind === 'moon' || kind === 'sun') {
        video.loop = false;
      }

      const sourceListKey = videoSources.join('|');
      if (overlay.dataset.currentSourceList !== sourceListKey) {
        overlay.dataset.currentSourceList = sourceListKey;
        overlay.dataset.currentSourceIndex = '0';
      }

      const tryVideoSource = sourceIndex => {
        const nextSource = videoSources[sourceIndex];
        const usesNativeAlpha = /\.webm(?:\?|#|$)/i.test(nextSource || '');
        overlay.classList.toggle('is-native-alpha', (kind === 'moon' || kind === 'sun') && usesNativeAlpha);
        const directVideoMode =
          assetConfig.renderMode === 'video-direct' || assetConfig.renderMode === 'video-alpha' || usesNativeAlpha;
        if (!nextSource) {
          stopHeaderWeatherOrbRender(overlay);
          video.pause();
          video.hidden = true;
          if (canvas) {
            canvas.hidden = true;
            clearHeaderWeatherOrbCanvas(overlay);
          }
          if (image) {
            image.hidden = true;
          }
          return;
        }

        overlay.dataset.currentSourceIndex = String(sourceIndex);

        let didAttemptPlayback = false;
        const startPlayback = () => {
          if (didAttemptPlayback) {
            return;
          }
          didAttemptPlayback = true;

          video
            .play()
            .then(() => {
              if (directVideoMode) {
                stopHeaderWeatherOrbRender(overlay);
                video.hidden = false;
                if (canvas) {
                  canvas.hidden = true;
                  clearHeaderWeatherOrbCanvas(overlay);
                }
                if (image) {
                  image.hidden = true;
                }
                if ((kind === 'moon' || kind === 'sun') && assetConfig.timelineBase) {
                  overlay.__moonTimelineBase = assetConfig.timelineBase;
                  const readTimeline = () => {
                    const base = overlay.__moonTimelineBase;
                    if (!base) {
                      return null;
                    }
                    const videoDurationSec =
                      Number(base.videoDurationSec) ||
                      (kind === 'sun' ? HEADER_WEATHER_SUN_VIDEO_DURATION_SEC : HEADER_WEATHER_MOON_VIDEO_DURATION_SEC);
                    if (kind === 'moon') {
                      if (!Number.isFinite(base.nightStart) || !Number.isFinite(base.nightEnd)) {
                        return {
                          nightProgress: Number(base.nightProgress) || 0,
                          videoDurationSec,
                        };
                      }
                      const nowMs = getHeaderWeatherNowMs();
                      return {
                        nightProgress: clampHeaderWeatherValue(
                          (nowMs - base.nightStart) / Math.max(base.nightEnd - base.nightStart, 1),
                          0,
                          1
                        ),
                        videoDurationSec,
                      };
                    }
                    if (!Number.isFinite(base.dayStart) || !Number.isFinite(base.dayEnd)) {
                      return {
                        dayProgress: Number(base.dayProgress) || 0,
                        videoDurationSec,
                      };
                    }
                    const nowMs = getHeaderWeatherNowMs();
                    return {
                      dayProgress: clampHeaderWeatherValue(
                        (nowMs - base.dayStart) / Math.max(base.dayEnd - base.dayStart, 1),
                        0,
                        1
                      ),
                      videoDurationSec,
                    };
                  };
                  syncHeaderWeatherOrbVideoTimeline(overlay, readTimeline());
                  startHeaderWeatherOrbTimelineSync(overlay, readTimeline);
                } else {
                  stopHeaderWeatherMoonTimelineSync(overlay);
                }
              } else {
                video.hidden = true;
                if (canvas) {
                  canvas.hidden = false;
                }
                if (image) {
                  image.hidden = true;
                }
                startHeaderWeatherOrbRender(overlay);
                stopHeaderWeatherMoonTimelineSync(overlay);
              }
            })
            .catch(() => {
              tryVideoSource(sourceIndex + 1);
            });
        };

        video.onloadeddata = startPlayback;
        video.oncanplay = startPlayback;
        video.onloadedmetadata = () => {
          if ((kind === 'moon' || kind === 'sun') && overlay.__moonTimelineGetter) {
            syncHeaderWeatherOrbVideoTimeline(overlay, overlay.__moonTimelineGetter());
          }
        };
        video.onerror = () => {
          tryVideoSource(sourceIndex + 1);
        };

        if (video.dataset.currentSrc !== nextSource) {
          stopHeaderWeatherOrbRender(overlay);
          video.pause();
          video.dataset.currentSrc = nextSource;
          video.src = nextSource;
          video.load();
          return;
        }

        startPlayback();
      };

      tryVideoSource(Number(overlay.dataset.currentSourceIndex || 0));
      return;
    }

    stopHeaderWeatherOrbRender(overlay);
    video.onloadeddata = null;
    video.oncanplay = null;
    video.onerror = null;
    video.pause();
    video.hidden = true;
    if (video.dataset.currentSrc) {
      video.removeAttribute('src');
      video.load();
      delete video.dataset.currentSrc;
    }

    if (canvas) {
      clearHeaderWeatherOrbCanvas(overlay);
      canvas.hidden = true;
    }

    if (image) {
      if (image.dataset.currentSrc !== assetConfig.src) {
        image.dataset.currentSrc = assetConfig.src;
        image.src = assetConfig.src;
      }
      image.hidden = false;
    }
  }

  function syncHeaderWeatherCloudBandLayout(host) {
    if (!host) {
      return;
    }

    const pageHeader = document.querySelector('.header');
    const weatherShell = pageHeader?.querySelector('.header-weather-shell');
    if (!pageHeader || !weatherShell) {
      host.style.removeProperty('--header-weather-cloud-rise');
      return;
    }

    const headerTop = pageHeader.getBoundingClientRect().top;
    const shellTop = weatherShell.getBoundingClientRect().top;
    const rawRisePx = Math.max(0, Math.ceil(shellTop - headerTop + 2));
    // Desktop: keep stars/cloud scene stable and avoid over-stretch when layout shifts.
    const isDesktop = window.innerWidth >= 900;
    const risePx = isDesktop ? 0 : Math.max(0, Math.min(96, rawRisePx));
    if (isDesktop) {
      host.style.setProperty('--header-weather-cloud-extra-h', '4px');
    } else {
      host.style.removeProperty('--header-weather-cloud-extra-h');
    }
    host.style.setProperty('--header-weather-cloud-rise', `${risePx}px`);
  }

  function scheduleHeaderWeatherOrbSync(host) {
    if (!host?.shadowRoot) {
      return;
    }

    if (host.__weatherOrbSyncFrameScheduled) {
      host.__weatherOrbSyncPending = true;
      return;
    }

    host.__weatherOrbSyncFrameScheduled = true;
    window.requestAnimationFrame(() => {
      host.__weatherOrbSyncFrameScheduled = false;
      syncHeaderWeatherOrbOverlay(host);
    });
  }

  async function syncHeaderWeatherOrbOverlay(host) {
    if (!host?.shadowRoot) {
      return;
    }

    if (host.__weatherOrbSyncInFlight) {
      host.__weatherOrbSyncPending = true;
      return;
    }

    host.__weatherOrbSyncInFlight = true;

    const syncToken = `${Date.now()}:${Math.random()}`;
    host.__weatherOrbSyncToken = syncToken;

    try {
      await syncHeaderWeatherClockWithServers();

      let astroData = null;
      try {
        astroData = await resolveHeaderWeatherAstro(host);
      } catch (error) {
        // console.warn('Header weather astro sync failed:', error);
      }

      host.__weatherTimeZone = resolveHeaderWeatherTimeZone(host, astroData?.locationMeta || null);

      try {
        host.__weatherCurrentMeta = await resolveHeaderWeatherCurrent(host);
      } catch (error) {
        host.__weatherCurrentMeta = null;
        // console.warn('Header weather current sync failed:', error);
      }

      if (host.__weatherOrbSyncToken !== syncToken) {
        return;
      }

      const orbModel = resolveHeaderWeatherOrbModel(host, astroData);
      const presentation = orbModel?.presentation || null;
      const orbAtmosphere = resolveHeaderWeatherOrbAtmosphere(host);
      host.__weatherOrbAtmosphere = orbAtmosphere;
      applyHeaderWeatherTextReadability(host, orbAtmosphere);
      const widgetBasePath = getHeaderWeatherWidgetBasePath(host);
      const assetsModuleBase = getHeaderWeatherAssetsBasePath(host);
      const geoState = {
        latitude: Number(astroData?.locationMeta?.latitude) || HEADER_WEATHER_STATIC_FALLBACK_COORDS.latitude,
        longitude: Number(astroData?.locationMeta?.longitude) || HEADER_WEATHER_STATIC_FALLBACK_COORDS.longitude,
        timeMs: getHeaderWeatherNowMs(),
      };
      const moonVideoSources = widgetBasePath
        ? HEADER_WEATHER_MOON_VIDEO_FILES.map(file => `${widgetBasePath}/assets/Moon/${file}`)
        : [];
      const moonAssetConfig = moonVideoSources.length
        ? {
            type: 'video-keyed',
            sources: moonVideoSources,
            timelineBase: presentation?.moon?.timeline || {
              videoDurationSec: HEADER_WEATHER_MOON_VIDEO_DURATION_SEC,
              nightProgress: 0,
            },
          }
        : null;
      const sunVideoSources = widgetBasePath
        ? HEADER_WEATHER_SUN_VIDEO_FILES.map(file => `${widgetBasePath}/assets/Sun/${file}`)
        : [];
      const sunAssetConfig = sunVideoSources.length
        ? {
            type: 'video-keyed',
            sources: sunVideoSources,
            timelineBase: presentation?.sun?.timeline || {
              dayProgress: 0,
              videoDurationSec: HEADER_WEATHER_SUN_VIDEO_DURATION_SEC,
            },
          }
        : widgetBasePath && assetsModuleBase
          ? {
              type: 'nasa-eyes-sun',
              assetsModuleBase,
              sunTextureUrl: `${widgetBasePath}/assets/Sun/nasa_sun_warm.jpg`,
              sunTextureFallbackUrl: `${widgetBasePath}/assets/Sun/nasa_sun_disk.jpg`,
              geoState,
            }
          : null;

      const applyOrbStack = (stack, variantActive, layoutKey = 'preview') => {
        if (!stack) {
          return;
        }

        const moonPart = presentation?.moon;
        const sunPart = presentation?.sun;
        const moonLayout =
          layoutKey === 'dropdown' ? moonPart?.dropdownLayout : resolveHeaderWeatherOrbFixedLayout('moon', 'preview');
        const sunLayout =
          layoutKey === 'dropdown' ? sunPart?.dropdownLayout : resolveHeaderWeatherOrbFixedLayout('sun', 'preview');

        if (stack.moon) {
          const moonAllowed = true;
          applyHeaderWeatherOrbCrossfade(stack.moon, moonAllowed ? moonPart : null);
          applyHeaderWeatherOrbLayout(stack.moon, moonAllowed ? moonLayout : null);
          if (moonAllowed && variantActive && moonPart?.active) {
            setHeaderWeatherOrbSource(stack.moon, 'moon', moonAssetConfig);
            applyHeaderWeatherOrbAtmosphere(stack.moon, orbAtmosphere);
          } else {
            setHeaderWeatherOrbSource(stack.moon, null, null);
            applyHeaderWeatherOrbAtmosphere(stack.moon, 0);
          }
        }

        if (stack.sun) {
          applyHeaderWeatherOrbCrossfade(stack.sun, sunPart);
          applyHeaderWeatherOrbLayout(stack.sun, sunLayout);
          if (variantActive && sunPart?.active) {
            setHeaderWeatherOrbSource(stack.sun, 'sun', sunAssetConfig);
            applyHeaderWeatherOrbAtmosphere(stack.sun, orbAtmosphere);
            if (sunAssetConfig?.type === 'nasa-eyes-sun') {
              updateHeaderWeatherSunSceneGeo(stack.sun, geoState);
            }
          } else {
            stopHeaderWeatherSunScene(stack.sun);
            setHeaderWeatherOrbSource(stack.sun, null, null);
            applyHeaderWeatherOrbAtmosphere(stack.sun, 0);
          }
        }
      };

      const previewContainer = host.shadowRoot.querySelector('.weather-header-preview');
      if (previewContainer) {
        const cloudAlpha = Number(orbAtmosphere?.alpha) || 0;
        const showNightStars = resolveHeaderWeatherShowNightStars(host, presentation, astroData);
        const starOpacity = showNightStars ? clampHeaderWeatherValue(1.08 - cloudAlpha * 0.52, 0.78, 1) : 0;
        const starsBack = ensureHeaderWeatherStarsBackLayer(previewContainer);
        if (starsBack) {
          starsBack.classList.toggle('is-night-sky', showNightStars);
          starsBack.classList.remove('is-day-sky');
          starsBack.style.setProperty('--preview-stars-opacity', `${starOpacity.toFixed(3)}`);
          starsBack.style.removeProperty('--preview-day-stars-opacity');
          starsBack.style.setProperty('display', showNightStars ? 'block' : 'none');
        }
        previewContainer.classList.remove('is-night-sky', 'is-day-sky');
        previewContainer.style.removeProperty('--preview-stars-opacity');
        previewContainer.style.removeProperty('--preview-day-stars-opacity');
        const previewStack = ensureHeaderWeatherOrbStack(previewContainer, 'preview');
        syncHeaderWeatherPreviewLayerOrder(previewContainer);
        applyOrbStack(previewStack, true);
        syncHeaderWeatherPreviewLayerOrder(previewContainer);
      }

      const isExpanded =
        host.shadowRoot.querySelector('.weather-header-trigger')?.getAttribute('aria-expanded') === 'true';
      const dropdownMenu = host.shadowRoot.querySelector('.weather-header-dropdown');
      const dropdownHero = dropdownMenu?.querySelector('.weather-header-dropdown__hero');
      const dropdownMenuScene = dropdownHero?.querySelector('.weather-header-dropdown__scene');
      if (dropdownMenu) {
        const cloudAlpha = Number(orbAtmosphere?.alpha) || 0;
        const showNightStars = resolveHeaderWeatherShowNightStars(host, presentation, astroData);
        const starOpacity = showNightStars ? clampHeaderWeatherValue(1.06 - cloudAlpha * 0.52, 0.78, 1) : 0;
        const dropdownStarsBack = ensureHeaderWeatherDropdownStarsBackLayer(dropdownMenu);
        if (dropdownStarsBack) {
          dropdownStarsBack.classList.toggle('is-night-sky', showNightStars);
          dropdownStarsBack.classList.remove('is-day-sky');
          dropdownStarsBack.style.setProperty('--dropdown-stars-opacity', `${starOpacity.toFixed(3)}`);
          dropdownStarsBack.style.removeProperty('--dropdown-day-stars-opacity');
          dropdownStarsBack.style.setProperty('display', showNightStars ? 'block' : 'none');
        }
        if (dropdownMenuScene) {
          dropdownMenuScene.classList.remove('is-night-sky', 'is-day-sky');
          dropdownMenuScene.style.removeProperty('--dropdown-stars-opacity');
          dropdownMenuScene.style.removeProperty('--dropdown-day-stars-opacity');
        }
      }
      if (dropdownHero) {
        const dropdownStack = ensureHeaderWeatherOrbStack(dropdownHero, 'dropdown');
        applyOrbStack(dropdownStack, isExpanded, 'dropdown');
      }

      enforceHeaderWeatherToggleArrow(host);
      scheduleHeaderWeatherMenuPlacement(host);
      syncHeaderWeatherUnifiedReadings(host);
      scheduleHeaderWeatherReadingsSync(host);
      syncHeaderWeatherLiveClock(host);
      syncHeaderWeatherCloudBandLayout(host);
    } finally {
      host.__weatherOrbSyncInFlight = false;
      if (host.__weatherOrbSyncPending) {
        host.__weatherOrbSyncPending = false;
        scheduleHeaderWeatherOrbSync(host);
      }
    }
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
    const bodyNeedsSync = document.body?.classList.contains('header-weather-expanded') !== expanded;
    if (host.dataset.weatherExpanded !== nextExpandedState) {
      host.dataset.weatherExpanded = nextExpandedState;
      document.body?.classList.toggle('header-weather-expanded', expanded);
      emitHeaderWeatherEvent('site-shell:weather-toggle', expanded);
      if (expanded) {
        scheduleHeaderWeatherSceneClipRelease(host);
        scheduleHeaderWeatherReadingsSync(host);
      }
    } else if (bodyNeedsSync) {
      document.body?.classList.toggle('header-weather-expanded', expanded);
    }

    syncHeaderWeatherToggleArrow(host);
  }

  function applyHeaderWeatherLocationSearchCopy(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    const lang = normalizeLangCode(
      host?.__weatherLocale || host?.dataset?.weatherLocale || document.documentElement.lang
    );
    const placeholder = HEADER_WEATHER_SEARCH_PLACEHOLDER_BY_LANG[lang] || HEADER_WEATHER_SEARCH_PLACEHOLDER_BY_LANG.en;

    root.querySelectorAll('.weather-location-selector__input').forEach(input => {
      if (!(input instanceof HTMLElement) || input.tagName !== 'INPUT') {
        return;
      }
      if (input.placeholder !== placeholder) {
        input.placeholder = placeholder;
      }
    });
  }

  function bindHeaderWeatherOutsideDismiss(host) {
    if (!host || host.__weatherOutsideDismissHandler) {
      return;
    }

    const handler = event => {
      if (!host.isConnected || host.dataset.weatherExpanded !== 'true') {
        return;
      }

      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const clickedInsideHost = path.includes(host) || host.contains(event.target);
      if (clickedInsideHost) {
        return;
      }

      const collapse = host.__weatherWidgetInstance?.collapse;
      if (typeof collapse === 'function') {
        collapse.call(host.__weatherWidgetInstance);
      } else {
        const trigger = host.shadowRoot?.querySelector('.weather-header-trigger[aria-expanded="true"]');
        trigger?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));
      }

      window.setTimeout(() => syncHeaderWeatherExpandedState(host), 0);
    };

    host.__weatherOutsideDismissHandler = handler;
    document.addEventListener('pointerdown', handler, true);
  }

  function bindHeaderWeatherDropdownScrollState(host) {
    if (!host?.shadowRoot || host.__weatherDropdownScrollHandler) {
      return;
    }

    const onScroll = event => {
      const dropdown = event.target?.closest?.('.weather-header-dropdown');
      if (!(dropdown instanceof HTMLElement)) {
        return;
      }

      dropdown.classList.add('is-scrolling');
      if (host.__weatherDropdownScrollTimer) {
        window.clearTimeout(host.__weatherDropdownScrollTimer);
      }
      host.__weatherDropdownScrollTimer = window.setTimeout(() => {
        dropdown.classList.remove('is-scrolling');
      }, 900);
    };

    host.__weatherDropdownScrollHandler = onScroll;
    host.shadowRoot.addEventListener('scroll', onScroll, true);
  }

  function getHeaderWeatherScrollableDropdownContainer(startNode) {
    if (!(startNode instanceof Element)) {
      return null;
    }

    const candidates = [
      startNode.closest('.weather-header-dropdown__body'),
      startNode.closest('.weather-header-dropdown'),
    ].filter(node => node instanceof HTMLElement);

    return candidates.find(node => node.scrollHeight - node.clientHeight > 1) || candidates[0] || null;
  }

  function bindHeaderWeatherScrollContainment(host) {
    if (!host?.shadowRoot || host.__weatherScrollContainmentBound) {
      return;
    }

    const onWheel = event => {
      if (host.dataset.weatherExpanded !== 'true') {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const dropdown = target?.closest('.weather-header-dropdown');
      if (!dropdown) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const scrollContainer = getHeaderWeatherScrollableDropdownContainer(target || dropdown);
      if (!scrollContainer) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      scrollContainer.scrollTop += event.deltaY;
      event.preventDefault();
      event.stopPropagation();
    };

    const onTouchStart = event => {
      if (host.dataset.weatherExpanded !== 'true') {
        host.__weatherTouchScrollLastY = null;
        return;
      }

      const touch = event.touches?.[0];
      host.__weatherTouchScrollLastY = touch ? touch.clientY : null;
    };

    const onTouchMove = event => {
      if (host.dataset.weatherExpanded !== 'true') {
        host.__weatherTouchScrollLastY = null;
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const dropdown = target?.closest('.weather-header-dropdown');
      if (!dropdown) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const touch = event.touches?.[0];
      const lastY = host.__weatherTouchScrollLastY;
      const scrollContainer = getHeaderWeatherScrollableDropdownContainer(target || dropdown);
      if (!touch || !scrollContainer || !Number.isFinite(lastY)) {
        return;
      }

      const deltaY = lastY - touch.clientY;
      host.__weatherTouchScrollLastY = touch.clientY;
      scrollContainer.scrollTop += deltaY;
      event.preventDefault();
      event.stopPropagation();
    };

    const resetTouch = () => {
      host.__weatherTouchScrollLastY = null;
    };

    host.__weatherScrollContainmentBound = true;
    host.__weatherTouchScrollLastY = null;
    host.shadowRoot.addEventListener('wheel', onWheel, { capture: true, passive: false });
    host.shadowRoot.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    host.shadowRoot.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    host.shadowRoot.addEventListener('touchend', resetTouch, true);
    host.shadowRoot.addEventListener('touchcancel', resetTouch, true);
  }

  function bindHeaderWeatherState(host) {
    if (!host || host.__weatherStateObserver || !host.shadowRoot) {
      return;
    }

    const observer = new MutationObserver(mutations => {
      const shouldSync = mutations.some(
        mutation => mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded'
      );

      if (shouldSync) {
        syncHeaderWeatherExpandedState(host);
        syncHeaderWeatherToggleArrow(host);
        scheduleHeaderWeatherOrbSync(host);
        scheduleHeaderWeatherReadingsSync(host);
        applyHeaderWeatherLocationSearchCopy(host);
        bindHeaderWeatherDropdownScrollState(host);
      }
    });

    observer.observe(host.shadowRoot, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-expanded'],
    });

    host.__weatherStateObserver = observer;

    if (!host.__weatherMenuStrictTapBound) {
      const blockNonToggleInteraction = event => {
        const trigger = event.target?.closest?.('.weather-header-trigger');
        if (!trigger) {
          return;
        }
        const toggleButton = event.target?.closest?.('.weather-header-card__toggle');
        if (toggleButton) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
      };
      host.shadowRoot.addEventListener('pointerdown', blockNonToggleInteraction, true);
      host.shadowRoot.addEventListener('click', blockNonToggleInteraction, true);
      host.shadowRoot.addEventListener('touchstart', blockNonToggleInteraction, { capture: true, passive: false });
      host.__weatherMenuStrictTapBound = true;
    }

    applyHeaderWeatherLocationSearchCopy(host);
    bindHeaderWeatherOutsideDismiss(host);
    bindHeaderWeatherDropdownScrollState(host);
    bindHeaderWeatherScrollContainment(host);

    // Apply local timezone rendering immediately to avoid stale time flash on first paint.
    syncHeaderWeatherLiveClock(host);

    syncHeaderWeatherClockWithServers(true)
      .catch(() => null)
      .finally(() => {
        syncHeaderWeatherLiveClock(host);
      });

    host.__weatherLiveClockId = window.setInterval(() => {
      if (!document.hidden) {
        syncHeaderWeatherLiveClock(host);
      }
    }, HEADER_WEATHER_LIVE_CLOCK_INTERVAL);

    host.__weatherTimeSyncId = window.setInterval(() => {
      if (!document.hidden) {
        syncHeaderWeatherClockWithServers().catch(() => null);
      }
    }, HEADER_WEATHER_TIME_SYNC_INTERVAL);

    host.__weatherDataRefreshId = window.setInterval(() => {
      if (!document.hidden) {
        refreshHeaderWeatherWidgetData(host);
      }
    }, HEADER_WEATHER_WIDGET_REFRESH_INTERVAL);

    host.__weatherAstroRefreshId = window.setInterval(() => {
      if (!document.hidden) {
        scheduleHeaderWeatherOrbSync(host);
      }
    }, HEADER_WEATHER_ASTRO_REFRESH_INTERVAL);
    host.__weatherAstroVisibilityHandler = () => {
      if (!document.hidden) {
        syncHeaderWeatherClockWithServers().catch(() => null);
        syncHeaderWeatherLiveClock(host);
        scheduleHeaderWeatherOrbSync(host);
      }
    };
    host.__weatherViewportSyncHandler = () => {
      releaseHeaderWeatherSceneClip(host);
      scheduleHeaderBrandColumnAlign(host);
      syncHeaderWeatherCloudBandLayout(host);
      scheduleHeaderWeatherOrbSync(host);
    };
    document.addEventListener('visibilitychange', host.__weatherAstroVisibilityHandler);
    window.addEventListener('resize', host.__weatherViewportSyncHandler, { passive: true });
    window.addEventListener('orientationchange', host.__weatherViewportSyncHandler, { passive: true });
    bindHeaderWeatherReadingsObserver(host);

    syncHeaderWeatherExpandedState(host);
    syncHeaderWeatherToggleArrow(host);
    scheduleHeaderWeatherOrbSync(host);
    scheduleHeaderWeatherReadingsSync(host);
  }

  async function refreshHeaderWeatherWidgetData(host) {
    if (!host || host.dataset.weatherMounted !== 'true') {
      return;
    }

    if (host.__weatherRefreshInFlight) {
      host.__weatherRefreshPending = true;
      return;
    }

    host.__weatherRefreshInFlight = true;
    host.dataset.weatherRefreshing = 'true';

    try {
      const widgetApi = host.__weatherWidgetInstance;
      const refreshMethod =
        (typeof widgetApi?.refresh === 'function' && widgetApi.refresh.bind(widgetApi)) ||
        (typeof widgetApi?.reload === 'function' && widgetApi.reload.bind(widgetApi)) ||
        (typeof widgetApi?.update === 'function' && widgetApi.update.bind(widgetApi)) ||
        null;

      if (refreshMethod) {
        await Promise.resolve(refreshMethod());
      }

      headerWeatherCurrentCache.clear();
      await syncHeaderWeatherOrbOverlay(host);
      await syncHeaderWeatherPreciseLocationMeta(host);
      syncHeaderWeatherUnifiedReadings(host);
      scheduleHeaderWeatherReadingsSync(host);
      syncHeaderWeatherLiveClock(host);
      syncHeaderWeatherExpandedState(host);
      releaseHeaderWeatherSceneClip(host);
    } catch (_) {
      scheduleHeaderWeatherOrbSync(host);
    } finally {
      releaseHeaderWeatherSceneClip(host);
      window.setTimeout(() => {
        if (host?.dataset) {
          host.dataset.weatherRefreshing = 'false';
        }
      }, 240);
      host.__weatherRefreshInFlight = false;
      if (host.__weatherRefreshPending) {
        host.__weatherRefreshPending = false;
        void refreshHeaderWeatherWidgetData(host);
      }
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

  function enhanceHeaderWeatherCloudRenderer(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    const targetDpr = Math.min(window.devicePixelRatio || 1, 2);
    root.querySelectorAll('.weather-app--header canvas, .weather-header-dropdown__scene canvas').forEach(canvas => {
      const gl = canvas.__r3f?.root?.getState?.()?.gl;
      if (gl?.setPixelRatio && typeof gl.getPixelRatio === 'function') {
        const currentDpr = gl.getPixelRatio();
        if (currentDpr < targetDpr) {
          gl.setPixelRatio(targetDpr);
        }
      }
    });
  }

  function releaseHeaderWeatherSceneClip(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    root
      .querySelectorAll(
        '.weather-app--header, .weather-app--header .weather-header-preview, .weather-app--header .weather-app__scene, .weather-app--header .weather-app__scene--header, .weather-app--header .weather-app__scene div, .weather-app--header .weather-app__scene--header div, .weather-header-dropdown__hero, .weather-header-dropdown__hero .weather-header-dropdown__scene'
      )
      .forEach(node => {
        node.style.setProperty('overflow', 'visible', 'important');
        node.style.setProperty('clip-path', 'none', 'important');
        node.style.setProperty('contain', 'none', 'important');
        node.style.setProperty('max-width', 'none', 'important');
      });

    root.querySelectorAll('.weather-app--header canvas, .weather-header-dropdown__scene canvas').forEach(canvas => {
      canvas.style.setProperty('clip-path', 'none', 'important');
      canvas.style.setProperty('max-width', 'none', 'important');
      canvas.style.setProperty('max-height', 'none', 'important');
      canvas.style.removeProperty('transform');
    });
  }

  function scheduleHeaderWeatherSceneClipRelease(host) {
    if (!host) {
      return;
    }

    [0, 100, 400, 1000, 2200].forEach(delay => {
      window.setTimeout(() => {
        if (host.isConnected && host.dataset.weatherMounted === 'true') {
          releaseHeaderWeatherSceneClip(host);
          syncHeaderWeatherCloudBandLayout(host);
          enhanceHeaderWeatherCloudRenderer(host);
        }
      }, delay);
    });
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
    } else {
      const styleTag = document.createElement('style');
      styleTag.dataset.headerWeatherTransparent = 'true';
      styleTag.textContent = HEADER_WEATHER_TRANSPARENT_STYLES;
      host.shadowRoot.appendChild(styleTag);
    }

    releaseHeaderWeatherSceneClip(host);
    syncHeaderWeatherCloudBandLayout(host);
    enhanceHeaderWeatherCloudRenderer(host);
    scheduleHeaderWeatherSceneClipRelease(host);
  }

  function unmountHeaderWeatherWidget() {
    const host = getHeaderWeatherHost();
    if (!host) {
      return;
    }

    host.__weatherWidgetInstance?.unmount?.();
    host.__weatherWidgetInstance = null;
    host.__weatherCurrentMeta = null;
    host.__weatherStateObserver?.disconnect?.();
    host.__weatherStateObserver = null;
    if (host.__weatherAstroRefreshId) {
      window.clearInterval(host.__weatherAstroRefreshId);
      host.__weatherAstroRefreshId = null;
    }
    if (host.__weatherTimeSyncId) {
      window.clearInterval(host.__weatherTimeSyncId);
      host.__weatherTimeSyncId = null;
    }
    if (host.__weatherLiveClockId) {
      window.clearInterval(host.__weatherLiveClockId);
      host.__weatherLiveClockId = null;
    }
    if (host.__weatherDataRefreshId) {
      window.clearInterval(host.__weatherDataRefreshId);
      host.__weatherDataRefreshId = null;
    }
    if (host.__weatherAstroVisibilityHandler) {
      document.removeEventListener('visibilitychange', host.__weatherAstroVisibilityHandler);
      host.__weatherAstroVisibilityHandler = null;
    }
    if (host.__weatherViewportSyncHandler) {
      window.removeEventListener('resize', host.__weatherViewportSyncHandler);
      window.removeEventListener('orientationchange', host.__weatherViewportSyncHandler);
      host.__weatherViewportSyncHandler = null;
    }
    if (host.__weatherOutsideDismissHandler) {
      document.removeEventListener('pointerdown', host.__weatherOutsideDismissHandler, true);
      host.__weatherOutsideDismissHandler = null;
    }
    if (host.__weatherDropdownScrollHandler && host.shadowRoot) {
      host.shadowRoot.removeEventListener('scroll', host.__weatherDropdownScrollHandler, true);
      host.__weatherDropdownScrollHandler = null;
    }
    if (host.__weatherDropdownScrollTimer) {
      window.clearTimeout(host.__weatherDropdownScrollTimer);
      host.__weatherDropdownScrollTimer = null;
    }
    host.__weatherTimeZone = null;
    host.__weatherReadingsObserver?.disconnect?.();
    host.__weatherReadingsObserver = null;
    host.__weatherLayoutObserver?.disconnect?.();
    host.__weatherLayoutObserver = null;
    resetHeaderWeatherPreviewLayoutState(host);
    host.dataset.weatherMounted = 'false';
    host.dataset.weatherMountScheduled = 'false';
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
      await applyHeaderWeatherAutoGeoLocation(host);

      const weatherWidget = await loadHeaderWeatherWidgetLoader(host.dataset.widgetSrc);
      const fallbackLocation = host.dataset.weatherLocation || 'Leipzig';
      const initialLocation = fallbackLocation;

      const widgetApi = await weatherWidget.mountWeatherWidget(host, {
        variant: 'header',
        locale: host.dataset.weatherLocale || pageLang,
        initialLocation,
        fallbackLocation,
        useGeolocation: false,
        minHeight: host.dataset.weatherMinHeight || '100%',
      });

      host.__weatherWidgetInstance = widgetApi;
      host.__weatherLocale = normalizeLangCode(host.dataset.weatherLocale || pageLang);
      host.dataset.weatherMounted = 'true';
      host.dataset.weatherMountScheduled = 'false';
      host.dataset.weatherRetryCount = '0';
      host.classList.add('is-mounted');
      host.closest('.header-weather-shell')?.classList.remove('weather-shell-error');
      host.closest('.header-weather-shell')?.classList.add('weather-shell-ready');
      applyHeaderWeatherTransparency(host);
      bindHeaderWeatherState(host);
      bindHeaderWeatherLayoutObserver(host);
      ensureHeaderWeatherMenuPlacementLock(host);
      scheduleHeaderBrandColumnAlign(host);
      syncHeaderWeatherOrbOverlay(host);
      void syncHeaderWeatherPreciseLocationMeta(host);
      window.setTimeout(() => {
        scheduleHeaderBrandColumnAlign(host);
        scheduleHeaderWeatherReadingsSync(host);
      }, 320);
      window.setTimeout(() => scheduleHeaderWeatherReadingsSync(host), 1200);

      // Verify that the widget actually rendered interactive content; if not, retry once.
      window.setTimeout(() => {
        if (!host.isConnected || host.dataset.weatherMounted !== 'true') {
          return;
        }

        const trigger = host.shadowRoot?.querySelector('.weather-header-trigger, .weather-header-card__toggle');
        const content = host.shadowRoot?.querySelector('.weather-header-card, .weather-header-preview');
        if (trigger || content) {
          return;
        }

        const retryCount = Number(host.dataset.weatherRetryCount || '0');
        if (retryCount >= 3) {
          return;
        }

        host.dataset.weatherRetryCount = String(retryCount + 1);
        host.dataset.weatherMounted = 'false';
        host.classList.remove('is-mounted');
        host.__weatherWidgetInstance?.unmount?.();
        host.__weatherWidgetInstance = null;
        mountHeaderWeatherWidget(pageLang);
      }, 900);

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
      // console.error('Header weather widget failed to mount:', error);
      host.dataset.weatherMounted = 'false';
      host.dataset.weatherMountScheduled = 'false';
      host.closest('.header-weather-shell')?.classList.remove('weather-shell-ready');
      document.body?.classList.remove('header-weather-expanded');
      emitHeaderWeatherEvent('site-shell:weather-ready', false);

      const retryCount = Number(host.dataset.weatherRetryCount || '0');
      if (retryCount < 3) {
        host.dataset.weatherRetryCount = String(retryCount + 1);
        const retryDelayMs = 1200 * (retryCount + 1);
        window.setTimeout(() => {
          if (
            !host.isConnected ||
            host.dataset.weatherMounted === 'loading' ||
            host.dataset.weatherMounted === 'true'
          ) {
            return;
          }
          mountHeaderWeatherWidget(pageLang);
        }, retryDelayMs);
      } else {
        host.closest('.header-weather-shell')?.classList.add('weather-shell-error');
      }
    }
  }

  function syncHeaderWeatherWidget(pageLang) {
    const host = getHeaderWeatherHost();
    if (!host) {
      unmountHeaderWeatherWidget();
      return;
    }

    const targetLocale = normalizeLangCode(pageLang);
    host.dataset.weatherLocale = targetLocale;

    if (host.dataset.weatherMounted === 'true' && host.__weatherLocale !== targetLocale) {
      unmountHeaderWeatherWidget();
      host.dataset.weatherMounted = 'false';
    }

    if (host.dataset.weatherMountScheduled === 'true' || host.dataset.weatherMounted === 'true') {
      return;
    }

    host.dataset.weatherMountScheduled = 'true';

    /* Defer heavy 3D widget startup until after main content settles.
       On mobile, delay a bit more to keep first paint and scrolling smooth. */
    const scheduleIdle = cb => {
      if (window.requestIdleCallback) {
        window.requestIdleCallback(cb, { timeout: 900 });
      } else {
        window.setTimeout(cb, 80);
      }
    };

    const startMount = () => {
      if (host.dataset.weatherMounted === 'true' || host.dataset.weatherMounted === 'loading') {
        return;
      }
      scheduleIdle(() => {
        mountHeaderWeatherWidget(pageLang);
      });
    };

    const startAfterLoad = () => {
      const postLoadDelay = window.innerWidth <= 899 ? 1100 : 320;
      window.setTimeout(startMount, postLoadDelay);
    };

    // Start mount immediately after shell init; deferred hooks below act as backup retries.
    startMount();

    if (document.readyState === 'complete') {
      startAfterLoad();
      return;
    }

    const onLoad = () => {
      window.removeEventListener('load', onLoad);
      startAfterLoad();
    };

    window.addEventListener('load', onLoad, { once: true });

    // Fallback: if `load` is delayed by third-party/network resources, still mount weather widget.
    const maxWaitBeforeForcedMount = window.innerWidth <= 899 ? 2200 : 1200;
    window.setTimeout(() => {
      if (host.dataset.weatherMounted === 'true' || host.dataset.weatherMounted === 'loading') {
        return;
      }
      window.removeEventListener('load', onLoad);
      startMount();
    }, maxWaitBeforeForcedMount);

    const onFirstInteraction = () => {
      window.removeEventListener('pointerdown', onFirstInteraction, true);
      window.removeEventListener('keydown', onFirstInteraction, true);
      window.removeEventListener('touchstart', onFirstInteraction, true);
      startMount();
    };

    window.addEventListener('pointerdown', onFirstInteraction, { once: true, capture: true, passive: true });
    window.addEventListener('keydown', onFirstInteraction, { once: true, capture: true });
    window.addEventListener('touchstart', onFirstInteraction, { once: true, capture: true, passive: true });
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

  function resolveHeaderHomeBrandAnchor() {
    const homeIcon = document.querySelector('.social-home .home-icon-img');
    if (homeIcon instanceof HTMLElement) {
      const iconStyle = window.getComputedStyle(homeIcon);
      if (iconStyle.display !== 'none' && iconStyle.visibility !== 'hidden' && iconStyle.opacity !== '0') {
        return homeIcon;
      }
    }

    const homeLink = document.querySelector('.social-home a');
    if (homeLink instanceof HTMLElement) {
      return homeLink;
    }

    const homeSlot = document.querySelector('.social-home');
    return homeSlot instanceof HTMLElement ? homeSlot : null;
  }

  function syncHeaderBrandColumnAlign(hostOverride) {
    const header = document.querySelector('.header');
    const logoImage = document.querySelector('.header .logo-img');
    const weatherShell = document.querySelector('.header-weather-shell');
    const topRow = header?.querySelector('.top-row');
    if (!header || !logoImage) {
      return;
    }

    const homeAnchor = resolveHeaderHomeBrandAnchor();
    const homeLeft = homeAnchor ? homeAnchor.getBoundingClientRect().left : null;
    const logoLeft = logoImage.getBoundingClientRect().left;

    if (homeLeft !== null) {
      const logoOffset = Math.round(homeLeft - logoLeft);
      document.documentElement.style.setProperty('--header-logo-align-offset', `${logoOffset}px`);
    }

    const alignedLogoLeft = logoImage.getBoundingClientRect().left;
    const headerLeft = header.getBoundingClientRect().left;
    const brandInset = Math.max(0, Math.round(alignedLogoLeft - headerLeft));
    document.documentElement.style.setProperty('--header-brand-column-inset', `${brandInset}px`);

    let weatherInset = 0;
    if (weatherShell) {
      weatherInset = Math.max(0, Math.round(alignedLogoLeft - weatherShell.getBoundingClientRect().left));
    }

    const host = hostOverride || getHeaderWeatherHost();
    if (host) {
      const eyebrow = host.shadowRoot?.querySelector('.weather-header-card__eyebrow');
      const trigger = host.shadowRoot?.querySelector('.weather-header-trigger');
      let resolvedInset = weatherInset;

      if (eyebrow instanceof HTMLElement) {
        const eyebrowLeft = eyebrow.getBoundingClientRect().left;
        const delta = Math.round(alignedLogoLeft - eyebrowLeft);
        const currentInset = Number.parseFloat(
          window.getComputedStyle(host).getPropertyValue('--header-weather-text-inset') || `${weatherInset}`
        );
        const baseInset = Number.isFinite(currentInset) ? currentInset : weatherInset;
        resolvedInset = Math.max(0, baseInset + delta);
      }

      const previousInset = host.__weatherTextInsetLocked;
      if (!Number.isFinite(previousInset) || Math.abs(resolvedInset - previousInset) >= 2) {
        host.__weatherTextInsetLocked = resolvedInset;
        host.style.setProperty('--header-weather-text-inset', `${resolvedInset}px`);
      }

      if (
        weatherShell instanceof HTMLElement &&
        topRow instanceof HTMLElement &&
        homeAnchor instanceof HTMLElement &&
        trigger instanceof HTMLElement
      ) {
        // Desktop: weather panel must stay centered inside top row without extra JS shifts.
        if (window.innerWidth >= 900) {
          weatherShell.__weatherVerticalShiftY = 0;
          topRow.__weatherExtraPaddingBottom = 0;

          weatherShell.style.removeProperty('transform');
          weatherShell.style.removeProperty('transform-origin');
          weatherShell.style.removeProperty('align-self');
          weatherShell.style.removeProperty('overflow');

          if (Number.isFinite(topRow.__weatherBasePaddingBottom)) {
            topRow.style.setProperty('padding-bottom', `${topRow.__weatherBasePaddingBottom}px`, 'important');
          } else {
            topRow.style.removeProperty('padding-bottom');
          }

          return;
        }

        const targetGapPx = 5;
        const currentShellShiftY = Number.isFinite(weatherShell.__weatherVerticalShiftY)
          ? weatherShell.__weatherVerticalShiftY
          : 0;
        const currentTopRowExtraBottom = Number.isFinite(topRow.__weatherExtraPaddingBottom)
          ? topRow.__weatherExtraPaddingBottom
          : 0;

        if (!Number.isFinite(topRow.__weatherBasePaddingBottom)) {
          topRow.__weatherBasePaddingBottom = Number.parseFloat(window.getComputedStyle(topRow).paddingBottom) || 0;
        }

        const baseTopRowPaddingBottom = topRow.__weatherBasePaddingBottom;
        const logoBottom = logoImage.getBoundingClientRect().bottom;
        const homeTop = homeAnchor.getBoundingClientRect().top;
        const triggerRect = trigger.getBoundingClientRect();
        const baseTriggerTop = triggerRect.top - currentShellShiftY;
        const baseTriggerBottom = triggerRect.bottom - currentShellShiftY;
        const baseHomeTop = homeTop - currentTopRowExtraBottom;
        const nextShellShiftY = Math.max(0, Number((logoBottom + targetGapPx - baseTriggerTop).toFixed(2)));
        const nextTopRowExtraBottom = Math.max(
          0,
          Number((baseTriggerBottom + nextShellShiftY + targetGapPx - baseHomeTop).toFixed(2))
        );

        weatherShell.__weatherVerticalShiftY = nextShellShiftY;
        topRow.__weatherExtraPaddingBottom = nextTopRowExtraBottom;

        weatherShell.style.setProperty('transform', `translateY(${nextShellShiftY}px)`, 'important');
        weatherShell.style.setProperty('transform-origin', 'top center', 'important');
        weatherShell.style.setProperty('align-self', 'start', 'important');
        weatherShell.style.setProperty('overflow', 'visible', 'important');
        topRow.style.setProperty('padding-bottom', `${baseTopRowPaddingBottom + nextTopRowExtraBottom}px`, 'important');
      }
    }
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

      scheduleHeaderBrandColumnAlign();

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

      // Never upscale home label above its base typography. This removes intermittent
      // enlargement when layout reflows or observers run in a different order.
      const rawFitScale = availableWidth / naturalWidth;
      const fitScale = Number.isFinite(rawFitScale) ? Math.max(0.38, Math.min(1, rawFitScale)) : 1;
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

    const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

    const playWeatherLocaleSwitchAnimation = async durationMs => {
      const host = getHeaderWeatherHost();
      if (!host) {
        await wait(durationMs);
        return;
      }

      const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      const effectiveDuration = prefersReducedMotion ? Math.min(durationMs, 140) : durationMs;

      if (typeof host.animate === 'function') {
        try {
          const animation = host.animate(
            [
              { opacity: 1, filter: 'blur(0px) saturate(1)', transform: 'translateY(0px)' },
              { opacity: 0.78, filter: 'blur(0.8px) saturate(0.96)', transform: 'translateY(0.5px)' },
              { opacity: 1, filter: 'blur(0px) saturate(1)', transform: 'translateY(0px)' },
            ],
            {
              duration: effectiveDuration,
              easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
              fill: 'both',
            }
          );
          await animation.finished;
          return;
        } catch (_) {
          /* Ignore animation API failures and continue with a timed fallback. */
        }
      }

      host.classList.add('is-locale-switching');
      await wait(effectiveDuration);
      host.classList.remove('is-locale-switching');
    };

    const remountWeatherPreviewForLanguage = async targetLang => {
      const resolvedLang = normalizeLangCode(targetLang);
      document.documentElement.lang = resolvedLang;

      const host = getHeaderWeatherHost();
      if (!host) {
        return;
      }

      host.dataset.weatherLocale = resolvedLang;

      if (host.dataset.weatherMounted === 'true') {
        unmountHeaderWeatherWidget();
      }

      await mountHeaderWeatherWidget(resolvedLang);
    };

    langDropdown.querySelectorAll('.lang-dropdown-menu li').forEach(item => {
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'menuitem');

      const navigateToLanguage = async () => {
        closeLangDropdown();
        const lang = item.getAttribute('data-lang');
        const nextUrl = lang ? buildLanguageUrl(context, lang) : null;
        if (!nextUrl) {
          return;
        }

        localStorage.setItem('preferred_lang', lang);

        const preNavigationAnimationMs = 260;

        try {
          await Promise.allSettled([
            playWeatherLocaleSwitchAnimation(preNavigationAnimationMs),
            Promise.race([remountWeatherPreviewForLanguage(lang), wait(320)]),
          ]);
        } catch (_) {}

        window.location.href = nextUrl;
      };

      item.addEventListener('click', () => {
        navigateToLanguage();
      });
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

    const launchRedirectUrl = getLaunchLanguageRedirectUrl(context);
    if (launchRedirectUrl && launchRedirectUrl !== window.location.href) {
      window.location.replace(launchRedirectUrl);
      return {
        ...context,
        redirected: true,
      };
    }

    if (context.currentLang) {
      localStorage.setItem('preferred_lang', context.currentLang);
    }

    standardizePageHeader(context);
    hardenHeaderA11y();
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
