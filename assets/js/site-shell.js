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
  position: relative !important;
  width: 62px !important;
  height: 62px !important;
  border-radius: 50% !important;
  border-style: solid !important;
  border-width: 1px !important;
  border-color: rgba(213, 226, 255, 0.28) !important;
  box-shadow:
    0 0 0 1px rgba(126, 164, 235, 0.18) inset,
    0 0 14px rgba(125, 174, 255, 0.24) !important;
  animation: weatherRainRingPulse 1.8s cubic-bezier(0.22, 0.61, 0.36, 1) infinite !important;
}

.weather-header-state__spinner::before {
  content: '' !important;
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  width: 7px !important;
  height: 10px !important;
  margin-left: -3.5px !important;
  margin-top: -27px !important;
  border-radius: 52% 52% 58% 58% !important;
  background: linear-gradient(180deg, rgba(227, 239, 255, 0.95), rgba(112, 170, 255, 0.82)) !important;
  box-shadow:
    0 27px 0 -1px rgba(227, 239, 255, 0.95),
    19px 19px 0 -1px rgba(206, 225, 255, 0.88),
    27px 0 0 -1px rgba(198, 220, 255, 0.84),
    19px -19px 0 -1px rgba(186, 211, 252, 0.8),
    0 -27px 0 -1px rgba(203, 227, 255, 0.9),
    -19px -19px 0 -1px rgba(186, 211, 252, 0.8),
    -27px 0 0 -1px rgba(198, 220, 255, 0.84),
    -19px 19px 0 -1px rgba(206, 225, 255, 0.88),
    0 0 10px rgba(125, 174, 255, 0.48) !important;
  transform-origin: 3.5px 27px !important;
  animation:
    weatherRainDropsSpin 1.25s linear infinite,
    weatherRainDropsBreath 1.25s ease-in-out infinite !important;
}

/* Hide all textual loading copy in state overlay ("Загрузка погоды" and localized variants). */
.weather-header-state__inner {
  display: grid !important;
  place-items: center !important;
  gap: 0 !important;
}

.weather-header-state__inner p {
  margin: 0 !important;
  font-size: 0 !important;
  line-height: 0 !important;
  color: transparent !important;
  letter-spacing: 0 !important;
  opacity: 0 !important;
}

.weather-header-state__inner p::before,
.weather-header-state__inner p::after {
  content: none !important;
}

/* Scene preload: hide text label and show elegant raindrop circle loader. */
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
  width: 62px !important;
  height: 62px !important;
  font-size: 0 !important;
  line-height: 0 !important;
  color: transparent !important;
  letter-spacing: 0 !important;
  text-transform: none !important;
  opacity: 1 !important;
}

.weather-app__scene-fallback .text-sm::before,
.weather-app__scene-fallback--header .text-sm::before,
.weather-app__scene-fallback [class*='text-sm']::before,
.weather-app__scene-fallback--header [class*='text-sm']::before {
  content: '' !important;
  position: absolute !important;
  inset: 0 !important;
  border-radius: 50% !important;
  border: 1px solid rgba(213, 226, 255, 0.28) !important;
  box-shadow:
    0 0 0 1px rgba(126, 164, 235, 0.18) inset,
    0 0 14px rgba(125, 174, 255, 0.24) !important;
  animation: weatherRainRingPulse 1.8s cubic-bezier(0.22, 0.61, 0.36, 1) infinite !important;
}

.weather-app__scene-fallback .text-sm::after,
.weather-app__scene-fallback--header .text-sm::after,
.weather-app__scene-fallback [class*='text-sm']::after,
.weather-app__scene-fallback--header [class*='text-sm']::after {
  content: '' !important;
  position: absolute !important;
  left: 50% !important;
  top: 50% !important;
  width: 7px !important;
  height: 10px !important;
  margin-left: -3.5px !important;
  margin-top: -27px !important;
  border-radius: 52% 52% 58% 58% !important;
  background: linear-gradient(180deg, rgba(227, 239, 255, 0.95), rgba(112, 170, 255, 0.82)) !important;
  box-shadow:
    0 27px 0 -1px rgba(227, 239, 255, 0.95),
    19px 19px 0 -1px rgba(206, 225, 255, 0.88),
    27px 0 0 -1px rgba(198, 220, 255, 0.84),
    19px -19px 0 -1px rgba(186, 211, 252, 0.8),
    0 -27px 0 -1px rgba(203, 227, 255, 0.9),
    -19px -19px 0 -1px rgba(186, 211, 252, 0.8),
    -27px 0 0 -1px rgba(198, 220, 255, 0.84),
    -19px 19px 0 -1px rgba(206, 225, 255, 0.88),
    0 0 10px rgba(125, 174, 255, 0.48) !important;
  transform-origin: 3.5px 27px !important;
  animation:
    weatherRainDropsSpin 1.25s linear infinite,
    weatherRainDropsBreath 1.25s ease-in-out infinite !important;
}

@keyframes weatherRainDropsSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes weatherRainDropsBreath {
  0%,
  100% {
    opacity: 0.86;
    filter: saturate(0.95) brightness(0.96);
  }

  50% {
    opacity: 1;
    filter: saturate(1.08) brightness(1.08);
  }
}

@keyframes weatherRainRingPulse {
  0%,
  100% {
    transform: scale(0.985);
    opacity: 0.82;
  }

  50% {
    transform: scale(1.03);
    opacity: 1;
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

.weather-app--header {
  border-radius: 0 !important;
}

/* Scene extends beyond shell so 3D renderer gets a tall enough canvas
   for sun/moon to project into the visible area.
   The header overflow:hidden clips the bottom bleed. */
.weather-app--header .weather-app__scene,
.weather-app--header .weather-app__scene--header {
  display: block !important;
  position: absolute !important;
  top: calc(50% + 12px) !important;
  left: 50% !important;
  width: 124% !important;
  height: calc(100% + 80px) !important;
  min-height: calc(100% + 80px) !important;
  transform: translate(-50%, -50%) !important;
  transform-origin: center center !important;
  overflow: visible !important;
  opacity: 1 !important;
  visibility: visible !important;
  background: transparent !important;
  z-index: -30 !important;
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
  height: 100% !important;
  min-height: 100% !important;
  pointer-events: none !important;
  opacity: 1 !important;
  visibility: visible !important;
  background: transparent !important;
  z-index: -30 !important;
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
  transition: opacity 260ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1) !important;
  mix-blend-mode: normal !important;
}

.weather-orb-overlay.is-moon {
  /* Moon+clouds above scene canvas (z-0); clouds appear over stars/rain. */
  z-index: 1 !important;
}

.weather-orb-overlay.is-visible {
  opacity: 1 !important;
  visibility: visible !important;
  transform: translateX(-50%) scale(var(--orb-scale-visible, 1)) !important;
}

.weather-orb-overlay--preview {
  width: clamp(82px, 19vw, 118px) !important;
  height: clamp(82px, 19vw, 118px) !important;
}

.weather-orb-overlay--dropdown {
  width: clamp(138px, 24vw, 194px) !important;
  height: clamp(138px, 24vw, 194px) !important;
}

.weather-orb-overlay__video {
  display: none !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
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
  content: "";
  position: absolute;
  border-radius: 999px;
  pointer-events: none;
  opacity: 0;
  will-change: transform, opacity;
  transition: opacity 220ms ease, transform 220ms ease, filter 220ms ease;
}

.weather-orb-overlay.has-cloud-veil::before,
.weather-orb-overlay.has-cloud-veil::after {
  opacity: calc(var(--orb-cloud-alpha, 0) * 0.44);
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
  z-index: 2 !important;
  transform: translate(-4%, -72%);
}

.weather-orb-overlay--preview.is-moon.has-cloud-veil::before,
.weather-orb-overlay--preview.is-moon.has-cloud-veil::after {
  z-index: 4 !important;
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

.weather-orb-overlay.is-sun .weather-orb-overlay__canvas,
.weather-orb-overlay.is-sun .weather-orb-overlay__image {
  filter: drop-shadow(0 0 18px rgba(255, 216, 116, 0.42)) drop-shadow(0 0 34px rgba(255, 196, 72, 0.18)) !important;
}

.weather-orb-overlay.is-moon .weather-orb-overlay__canvas,
.weather-orb-overlay.is-moon .weather-orb-overlay__image {
  clip-path: circle(50% at 50% 50%) !important;
}

/* Stars: brighter and crisper — override the aggressive filter:none reset
   by matching its :not() chain to gain equal specificity, then win by
   source order (this rule appears later in the same style block). */
:host([data-weather-variant='header']) .weather-app canvas:not(.weather-header-dropdown):not(.weather-header-dropdown *):not(.weather-location-selector):not(.weather-location-selector *) {
  filter: brightness(1.9) contrast(1.3) saturate(1.18) drop-shadow(0 0 1px rgba(255, 255, 255, 0.66)) drop-shadow(0 0 3px rgba(182, 205, 255, 0.38)) !important;
}

.weather-header-preview {
  isolation: isolate !important;
  overflow: visible !important;
}

.weather-header-trigger {
  z-index: 120 !important;
  cursor: default !important;
  pointer-events: auto !important;
}

.weather-header-card {
  position: absolute !important;
  inset: 0 !important;
  z-index: 121 !important;
}

.weather-header-card,
.weather-header-card__content,
.weather-header-trigger {
  opacity: 1 !important;
  visibility: visible !important;
}

.weather-header-card__content {
  position: relative !important;
  z-index: 122 !important;
  overflow: visible !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.56) !important;
  box-sizing: border-box !important;
  padding: 6px 18px 0 0 !important;
}

.weather-header-card__side {
  position: absolute !important;
  right: 8px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.weather-header-card__toggle {
  pointer-events: auto !important;
  cursor: pointer !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 1px !important;
  min-height: 28px !important;
  padding: 4px 10px !important;
  color: rgba(255, 238, 207, 0.96) !important;
  font-size: 8px !important;
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

.weather-header-card__toggle-icon {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 6.534px !important;
  height: 6.534px !important;
  margin-top: 6px !important;
  opacity: 0.9 !important;
  visibility: visible !important;
  font-size: 0 !important;
  line-height: 0 !important;
  background: url('/assets/images/icon-pak/Gotovie%20iconki%20dlya%20saita/unter.png') center/contain no-repeat !important;
  --arrow-rotate: rotate(90deg);
  --arrow-shift-x: 0px;
  transform: var(--arrow-rotate) translateX(var(--arrow-shift-x)) !important;
  will-change: transform !important;
  transition: transform 0.44s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease !important;
  animation:
    iconSurfaceRefraction var(--icon-sheen-duration, 2.35s) ease-in-out infinite !important;
  transform-origin: right top !important;
}

.weather-header-card__toggle-icon.is-open {
  --arrow-rotate: rotate(0deg);
}

.weather-header-trigger:active .weather-header-card__toggle-icon,
.weather-header-trigger:focus-visible .weather-header-card__toggle-icon {
  --arrow-rotate: rotate(0deg);
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

.weather-header-card__top {
  align-items: center !important;
  position: static !important;
  padding-right: 114px !important;
}

.weather-header-card__side {
  align-items: center !important;
  justify-content: center !important;
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
  z-index: 123 !important;
}

/* Keep menu button anchored to full widget card, not only to the top row. */
.weather-header-card__top {
  position: static !important;
}

/* Final header placement: condition stays top-right, menu button moves to bottom-center. */
.weather-header-card__side {
  position: static !important;
  width: auto !important;
  height: auto !important;
  display: block !important;
  pointer-events: auto !important;
}

.weather-header-card__condition {
  position: absolute !important;
  right: 18px !important;
  top: 4px !important;
  z-index: 124 !important;
  pointer-events: auto !important;
  text-align: right !important;
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

.weather-header-card__location-row {
  margin-bottom: 1px !important;
}

/* Keep top-left typography identical across locales (RU baseline). */
.weather-header-card__eyebrow {
  font-size: 7px !important;
  line-height: 10.5px !important;
  letter-spacing: 0.18em !important;
  font-weight: 400 !important;
  margin: 0 !important;
}

.weather-header-card__location-row {
  display: flex !important;
  align-items: flex-start !important;
  min-height: 18.64px !important;
}

.weather-header-card__location {
  font-size: 13px !important;
  line-height: 16.64px !important;
  font-weight: 600 !important;
  margin: 0 !important;
}

.weather-header-card__meta {
  font-size: 10px !important;
  line-height: 12px !important;
  margin: 0 !important;
}

.weather-header-card__bottom {
  position: absolute !important;
  left: 0 !important;
  right: 18px !important;
  bottom: 10px !important;
  width: auto !important;
  max-width: none !important;
  margin-left: 0 !important;
  display: grid !important;
  grid-template-columns: max-content minmax(0, 1fr) !important;
  column-gap: 0px !important;
  align-items: flex-end !important;
  justify-content: stretch !important;
  z-index: 124 !important;
}

.weather-header-card__bottom > :first-child {
  justify-self: start !important;
  text-align: left !important;
}

.weather-header-card__bottom > :last-child {
  justify-self: end !important;
  text-align: right !important;
}

.weather-header-card__toggle {
  position: absolute !important;
  left: 50% !important;
  bottom: -10px !important;
  transform: translateX(-50%) !important;
  z-index: 124 !important;
  pointer-events: auto !important;
}

.weather-header-dropdown {
  z-index: 10000 !important;
  position: relative !important;
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

/* Mobile: scene contained exactly within widget — same approach as desktop. */
@media (max-width: 899px) {
  :host([data-weather-variant='header']),
  :host([data-weather-variant='header']) [data-weather-widget-root] {
    border-radius: 0 !important;
    clip-path: none !important;
    overflow: visible !important;
  }

  .weather-app--header .weather-app__scene,
  .weather-app--header .weather-app__scene--header {
    position: absolute !important;
    top: 50% !important;
    left: 50% !important;
    width: 132% !important;
    height: calc(100% + 70px) !important;
    min-height: calc(100% + 70px) !important;
    transform: translate(-50%, -50%) !important;
    transform-origin: center center !important;
    overflow: visible !important;
  }

  .weather-app--header canvas {
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 100% !important;
  }

  .weather-orb-overlay--preview {
    width: 102px !important;
    height: 102px !important;
  }

  .weather-orb-overlay--dropdown {
    width: 146px !important;
    height: 146px !important;
  }

  .weather-header-card__toggle {
    min-height: 22px !important;
    padding: 4px 8px !important;
    font-size: 7px !important;
    gap: 4px !important;
  }

  .weather-header-card__toggle span:first-child {
    display: inline !important;
  }

  .weather-header-card__toggle-icon {
    width: 4.2px !important;
    height: 4.2px !important;
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
  bottom: -10px !important;
  transform: translateX(-50%) !important;
  z-index: 124 !important;
  pointer-events: auto !important;
}
`;

  const WEATHER_WIDGET_ASSET_VERSION = '20260511-weather-5min-timesync1';
  const HEADER_WEATHER_MOON_TEXTURE_SRC = '/3d-weather-codrops-main/dist-widget/assets/Moon/moon_texture.jpg';

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
  const HEADER_WEATHER_GEOCODE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
  const HEADER_WEATHER_CURRENT_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
  const HEADER_WEATHER_ASTRO_ENDPOINT = 'https://api.sunrise-sunset.org/json';
  const HEADER_WEATHER_REVERSE_GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
  const HEADER_WEATHER_STATIC_FALLBACK_COORDS = Object.freeze({ latitude: 51.320486, longitude: 12.416501 });
  const HEADER_WEATHER_ASTRO_REFRESH_INTERVAL = 60000;
  const HEADER_WEATHER_WIDGET_REFRESH_INTERVAL = 5 * 60 * 1000;
  const HEADER_WEATHER_TIME_SYNC_INTERVAL = 30 * 60 * 1000;
  const HEADER_WEATHER_LIVE_CLOCK_INTERVAL = 1000; // Update live clock every 1 second
  const HEADER_WEATHER_TIME_SYNC_TIMEOUT = 4500;
  const HEADER_WEATHER_MAX_CLOCK_DRIFT_MS = 7 * 24 * 60 * 60 * 1000;
  const HEADER_WEATHER_LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000;
  const HEADER_WEATHER_CURRENT_CACHE_TTL = 10 * 60 * 1000;
  const HEADER_WEATHER_ASTRO_CACHE_TTL = 12 * 60 * 60 * 1000;
  const HEADER_WEATHER_GEO_STORAGE_KEY = 'header_weather_geo_v1';
  const HEADER_WEATHER_GEO_CACHE_TTL = 30 * 60 * 1000;
  const HEADER_WEATHER_GEO_TIMEOUT = 10000;
  const HEADER_WEATHER_BERLIN_LABEL = 'Ber' + 'lin';
  const HEADER_WEATHER_BERLIN_ALIAS_KEY = ('ber' + 'lin').toLowerCase();
  const HEADER_WEATHER_DEFAULT_TIMEZONE = `Europe/${HEADER_WEATHER_BERLIN_LABEL}`;
  const headerWeatherLocationCache = new Map();
  const headerWeatherCurrentCache = new Map();
  const headerWeatherAstroCache = new Map();
  let headerWeatherServerTimeOffsetMs = 0;
  let headerWeatherServerTimeSyncedAt = 0;
  const HEADER_WEATHER_ORB_LAYOUTS = {
    preview: {
      sun: {
        start: { left: 66, top: 8, scale: 1.0 },
        apex: { left: 66, top: 8, scale: 1.0 },
        end: { left: 66, top: 8, scale: 1.0 },
      },
      moon: {
        start: { left: 66, top: 8, scale: 0.45 },
        apex: { left: 66, top: 8, scale: 0.45 },
        end: { left: 66, top: 8, scale: 0.45 },
      },
    },
    dropdown: {
      sun: {
        start: { left: 68, top: 10, scale: 1.04 },
        apex: { left: 68, top: 10, scale: 1.04 },
        end: { left: 68, top: 10, scale: 1.04 },
      },
      moon: {
        start: { left: 68, top: 10, scale: 0.54 },
        apex: { left: 68, top: 10, scale: 0.54 },
        end: { left: 68, top: 10, scale: 0.54 },
      },
    },
  };
  const HEADER_WEATHER_ORB_RENDER_PROFILES = {
    sun: {
      keyFloor: 6,
      featherCeiling: 86,
      focusThreshold: 102,
      focusAlphaFloor: 44,
      paddingRatio: 0.34,
      baseMarginRatio: 0.06,
      maxScale: 1.34,
      sourceFilter: 'brightness(1.08) saturate(1.06) contrast(1.03)',
      outputFilter: 'brightness(1.05) saturate(1.04) contrast(1.02)',
    },
    moon: {
      keyFloor: 36,
      featherCeiling: 78,
      alphaFloor: 8,
      focusThreshold: 80,
      focusAlphaFloor: 30,
      paddingRatio: 0.32,
      baseMarginRatio: 0.05,
      maxScale: 2.4,
      sourceFilter: 'brightness(1.08) contrast(1.12) saturate(0.88)',
      outputFilter: 'brightness(1.05) contrast(1.08) saturate(0.92)',
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
    // This ensures consistent, reliable location even when GPS is unavailable or denied.
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

    // For salon static coordinates, keep federal state label stable.
    if (coords.source === 'static-salon') {
      host.dataset.weatherRegionLabel = 'Sachsen';
    }
  }

  function getHeaderWeatherLocationLabel(host) {
    const locationLabel = host?.shadowRoot?.querySelector('.weather-header-card__location')?.textContent?.trim();
    return locationLabel || host?.dataset?.weatherLocation || 'Leipzig';
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

    const district =
      address.suburb ||
      address.city_district ||
      address.neighbourhood ||
      address.quarter ||
      address.borough ||
      address.hamlet ||
      '';

    const city = address.city || address.town || address.village || address.county || '';

    if (district && city && district.toLowerCase() !== city.toLowerCase()) {
      return `${district}, ${city}`;
    }

    return district || city || null;
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

  function rewriteHeaderWeatherTimeText(text, liveTime) {
    if (!text || !liveTime) {
      return text;
    }

    if (/^\s*\d{1,2}:\d{2}/.test(text)) {
      return text.replace(/^\s*\d{1,2}:\d{2}/, liveTime);
    }

    return text.replace(/\d{1,2}:\d{2}/, liveTime);
  }

  function syncHeaderWeatherLiveClock(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    const timeZone = resolveHeaderWeatherTimeZone(host);
    const liveTime = formatHeaderWeatherLiveTime(timeZone);
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
        const nextForcedText = `${liveTime} · ${forcedRegionLabel}`;
        if (nextForcedText !== node.textContent) {
          node.textContent = nextForcedText;
        }
        return;
      }

      const nextText = rewriteHeaderWeatherTimeText(node.textContent || '', liveTime);
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

  function lerpHeaderWeatherValue(start, end, amount) {
    return start + (end - start) * amount;
  }

  function interpolateHeaderWeatherOrbLayout(kind, variant, progress) {
    const layoutSet = HEADER_WEATHER_ORB_LAYOUTS[variant]?.[kind];
    if (!layoutSet) {
      return null;
    }

    const clampedProgress = clampHeaderWeatherValue(progress, 0, 1);
    const from = clampedProgress <= 0.5 ? layoutSet.start : layoutSet.apex;
    const to = clampedProgress <= 0.5 ? layoutSet.apex : layoutSet.end;
    const localProgress = clampedProgress <= 0.5 ? clampedProgress / 0.5 : (clampedProgress - 0.5) / 0.5;

    return {
      left: lerpHeaderWeatherValue(from.left, to.left, localProgress),
      top: lerpHeaderWeatherValue(from.top, to.top, localProgress),
      scale: lerpHeaderWeatherValue(from.scale, to.scale, localProgress),
    };
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

  function getHeaderWeatherConditionText(host) {
    const conditionText = host?.shadowRoot?.querySelector('.weather-header-card__condition')?.textContent || '';
    return conditionText.trim().toLowerCase();
  }

  function getHeaderWeatherConditionCode(host) {
    const conditionCode = Number(
      host?.__weatherCurrentMeta?.weatherCode ??
        host?.dataset?.weatherCode ??
        host?.__weatherWidgetData?.current?.condition?.code
    );
    return Number.isFinite(conditionCode) ? conditionCode : null;
  }

  function getHeaderWeatherPressureLang(host) {
    return normalizeLangCode(
      host?.__weatherLocale || host?.dataset?.weatherLocale || document.documentElement.lang || 'ru'
    );
  }

  function getHeaderWeatherPressureUnitText(host) {
    const lang = getHeaderWeatherPressureLang(host);
    const unitByLang = {
      ru: 'мм. рт. ст.',
      uk: 'мм рт. ст.',
      de: 'mmHg',
      en: 'mmHg',
    };

    return unitByLang[lang] || unitByLang.ru;
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
    let alpha = normalizedCloudCover !== null ? 0.12 + normalizedCloudCover * 0.24 : 0.18;
    let blur = 16;
    let stretchX = 1.12;
    let stretchY = 0.82;
    let drift = 1;
    let lift = 0;
    let coreOpacity = 0.98;
    let depthAlpha = 0.24;
    let highlightAlpha = 0.16;

    if (isPartlyCloudyCode || isPartlyCloudyText) {
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

    if (isCloudyCode || isCloudyText) {
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

    if (isOvercastCode || isOvercastText) {
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

    if (isFogCode || isFogText) {
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

    if (isPrecipitationCode || isPrecipitationText) {
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
      alpha: clampHeaderWeatherValue(alpha, 0, 0.62),
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
        // Check if these are the salon static coordinates (Stötteritz)
        const isSalonCoords =
          Math.abs(coordinateMatch.latitude - HEADER_WEATHER_STATIC_FALLBACK_COORDS.latitude) < 0.001 &&
          Math.abs(coordinateMatch.longitude - HEADER_WEATHER_STATIC_FALLBACK_COORDS.longitude) < 0.001;

        if (isSalonCoords) {
          // For salon coordinates, directly return Stötteritz without reverse geocoding
          const coordinateValue = {
            latitude: coordinateMatch.latitude,
            longitude: coordinateMatch.longitude,
            label: 'Stötteritz',
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

      const resolvedValue = {
        latitude: Number(result.latitude),
        longitude: Number(result.longitude),
        label: [result.name, result.admin1 || result.admin2, result.country].filter(Boolean).join(', '),
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

  function resolveHeaderWeatherOrbModel(host, astroData) {
    const fallbackKind = getHeaderWeatherFallbackOrbKind(host);

    if (!astroData?.today?.sunrise || !astroData?.today?.sunset) {
      const fallbackProgress = getHeaderWeatherFallbackOrbProgress(host, fallbackKind);
      return {
        kind: fallbackKind,
        previewLayout: interpolateHeaderWeatherOrbLayout(fallbackKind, 'preview', fallbackProgress),
        dropdownLayout: interpolateHeaderWeatherOrbLayout(fallbackKind, 'dropdown', fallbackProgress),
      };
    }

    const nowMs = getHeaderWeatherNowMs();
    if (nowMs >= astroData.today.sunrise && nowMs < astroData.today.sunset) {
      const solarNoon =
        astroData.today.solarNoon > astroData.today.sunrise && astroData.today.solarNoon < astroData.today.sunset
          ? astroData.today.solarNoon
          : astroData.today.sunrise + (astroData.today.sunset - astroData.today.sunrise) / 2;
      const isMorning = nowMs <= solarNoon;
      const arcStart = isMorning ? astroData.today.sunrise : solarNoon;
      const arcEnd = isMorning ? solarNoon : astroData.today.sunset;
      const segmentProgress = clampHeaderWeatherValue((nowMs - arcStart) / Math.max(arcEnd - arcStart, 1), 0, 1);
      const progress = isMorning ? segmentProgress * 0.5 : 0.5 + segmentProgress * 0.5;

      return {
        kind: 'sun',
        previewLayout: interpolateHeaderWeatherOrbLayout('sun', 'preview', progress),
        dropdownLayout: interpolateHeaderWeatherOrbLayout('sun', 'dropdown', progress),
      };
    }

    const beforeSunrise = nowMs < astroData.today.sunrise;
    const nightStart = beforeSunrise ? astroData.yesterday?.sunset : astroData.today.sunset;
    const nightEnd = beforeSunrise ? astroData.today.sunrise : astroData.tomorrow?.sunrise;
    if (!Number.isFinite(nightStart) || !Number.isFinite(nightEnd) || nightEnd <= nightStart) {
      const fallbackProgress = getHeaderWeatherFallbackOrbProgress(host, 'moon');
      return {
        kind: 'moon',
        previewLayout: interpolateHeaderWeatherOrbLayout('moon', 'preview', fallbackProgress),
        dropdownLayout: interpolateHeaderWeatherOrbLayout('moon', 'dropdown', fallbackProgress),
      };
    }

    const nightMidpoint = nightStart + (nightEnd - nightStart) / 2;
    const beforeMidpoint = nowMs <= nightMidpoint;
    const arcStart = beforeMidpoint ? nightStart : nightMidpoint;
    const arcEnd = beforeMidpoint ? nightMidpoint : nightEnd;
    const segmentProgress = clampHeaderWeatherValue((nowMs - arcStart) / Math.max(arcEnd - arcStart, 1), 0, 1);
    const progress = beforeMidpoint ? segmentProgress * 0.5 : 0.5 + segmentProgress * 0.5;

    return {
      kind: 'moon',
      previewLayout: interpolateHeaderWeatherOrbLayout('moon', 'preview', progress),
      dropdownLayout: interpolateHeaderWeatherOrbLayout('moon', 'dropdown', progress),
    };
  }

  function applyHeaderWeatherOrbLayout(overlay, layout) {
    if (!overlay) {
      return;
    }

    if (!layout) {
      overlay.style.removeProperty('--orb-left');
      overlay.style.removeProperty('--orb-top');
      overlay.style.removeProperty('--orb-scale-visible');
      overlay.style.removeProperty('--orb-scale-hidden');
      return;
    }

    const visibleScale = Number(layout.scale) || 1;
    overlay.style.setProperty('--orb-left', `${layout.left.toFixed(2)}%`);
    overlay.style.setProperty('--orb-top', `${layout.top.toFixed(2)}px`);
    overlay.style.setProperty('--orb-scale-visible', visibleScale.toFixed(3));
    overlay.style.setProperty('--orb-scale-hidden', Math.max(0.88, visibleScale - 0.08).toFixed(3));
  }

  async function fetchHeaderWeatherCurrent(host, locationMeta) {
    const url = new URL(HEADER_WEATHER_CURRENT_ENDPOINT);
    url.searchParams.set('latitude', String(locationMeta.latitude));
    url.searchParams.set('longitude', String(locationMeta.longitude));
    url.searchParams.set('current', 'weather_code,cloud_cover,precipitation,relative_humidity_2m,surface_pressure');
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

    return {
      weatherCode: Number(current.weather_code),
      cloudCover: Number(current.cloud_cover),
      precipitation: Number(current.precipitation),
      humidity: Number(current.relative_humidity_2m),
      surfacePressure: Number(current.surface_pressure),
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
      const locationNodes = root.querySelectorAll('.weather-header-card__location, .weather-location-selector__city');
      locationNodes.forEach(node => {
        if (node && locationMeta.label !== node.textContent?.trim()) {
          node.textContent = locationMeta.label;
        }
      });
    }

    if (locationMeta.regionLabel) {
      const normalizedRegionLabel = String(locationMeta.regionLabel).trim();
      if (normalizedRegionLabel) {
        host.dataset.weatherRegionLabel = normalizedRegionLabel;
        const metaNodes = root.querySelectorAll('.weather-header-card__meta, .weather-header-dropdown__hero-meta');
        const liveTime = formatHeaderWeatherLiveTime(resolveHeaderWeatherTimeZone(host, locationMeta));
        metaNodes.forEach(node => {
          if (node) {
            node.textContent = `${liveTime} · ${normalizedRegionLabel}`;
          }
        });
      }
    }
  }

  function applyHeaderWeatherOrbAtmosphere(overlay, atmosphere) {
    if (!overlay) {
      return;
    }

    const normalizedAtmosphere =
      atmosphere && typeof atmosphere === 'object'
        ? atmosphere
        : {
            alpha: Number(atmosphere) || 0,
          };
    const resolvedCloudiness = clampHeaderWeatherValue(Number(normalizedAtmosphere.alpha) || 0, 0, 0.92);
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

  function enforceHeaderWeatherToggleArrow(host) {
    const toggleIcon = host?.shadowRoot?.querySelector('.weather-header-card__toggle-icon');
    if (!toggleIcon) {
      return;
    }

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
    toggleIcon.style.setProperty('width', '6.534px', 'important');
    toggleIcon.style.setProperty('height', '6.534px', 'important');
    toggleIcon.style.setProperty('margin-top', '6px', 'important');
    toggleIcon.style.setProperty('opacity', '0.9', 'important');
    toggleIcon.style.setProperty('visibility', 'visible', 'important');
    toggleIcon.style.setProperty('transform-origin', 'right top', 'important');
    toggleIcon.style.setProperty('font-size', '0', 'important');
    toggleIcon.style.setProperty('line-height', '0', 'important');
    toggleIcon.style.setProperty(
      '--arrow-rotate',
      toggleIcon.classList.contains('is-open') ? 'rotate(0deg)' : 'rotate(90deg)',
      'important'
    );
    toggleIcon.style.setProperty('--arrow-shift-x', '0px', 'important');
    toggleIcon.style.setProperty('will-change', 'transform', 'important');
    toggleIcon.style.setProperty(
      'transition',
      'transform 0.44s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease',
      'important'
    );
    toggleIcon.style.setProperty(
      'animation',
      'iconSurfaceRefraction var(--icon-sheen-duration, 2.35s) ease-in-out infinite',
      'important'
    );
  }

  function enforceHeaderWeatherMenuPlacement(host) {
    const root = host?.shadowRoot;
    if (!root) {
      return;
    }

    const topRow = root.querySelector('.weather-header-card__top');
    const titleBlock = root.querySelector('.weather-header-card__title-block');
    const eyebrow = root.querySelector('.weather-header-card__eyebrow');
    const card = root.querySelector('.weather-header-card');
    const content = root.querySelector('.weather-header-card__content');
    const side = root.querySelector('.weather-header-card__side');
    const condition = root.querySelector('.weather-header-card__condition');
    const meta = root.querySelector('.weather-header-card__meta');
    const bottom = root.querySelector('.weather-header-card__bottom');
    const chips = root.querySelector('.weather-header-card__chips');
    const geoArrowIcon = root.querySelector('.weather-location-selector__current svg');
    const locationCurrent = root.querySelector('.weather-location-selector__current');
    const locationRow = root.querySelector('.weather-header-card__location-row');
    const locationLabel = root.querySelector('.weather-header-card__location');
    const toggle = root.querySelector('.weather-header-card__toggle');
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
    const contentInset = 0;
    const opticalRightOffset = 8;
    let computedRightOffset = opticalRightOffset;
    let rightColumn = null;
    const rightColumnTop = '4px';
    const rightColumnBottom = '10px';
    const bottomLeftInset = contentInset;

    const rightColumnHost = card || content;

    // Keep right column on a fixed anchor to prevent condition text drifting between re-renders.
    computedRightOffset = opticalRightOffset;

    if (rightColumnHost) {
      rightColumn = root.querySelector('.weather-header-card__right-column');
      if (!rightColumn) {
        rightColumn = document.createElement('div');
        rightColumn.className = 'weather-header-card__right-column';
        rightColumnHost.appendChild(rightColumn);
      } else if (rightColumn.parentElement !== rightColumnHost) {
        rightColumnHost.appendChild(rightColumn);
      }

      rightColumn.style.setProperty('position', 'absolute', 'important');
      rightColumn.style.setProperty('right', `${computedRightOffset}px`, 'important');
      rightColumn.style.setProperty('top', rightColumnTop, 'important');
      rightColumn.style.setProperty('bottom', rightColumnBottom, 'important');
      rightColumn.style.setProperty('left', 'auto', 'important');
      rightColumn.style.setProperty('display', 'flex', 'important');
      rightColumn.style.setProperty('flex-direction', 'column', 'important');
      rightColumn.style.setProperty('justify-content', 'flex-start', 'important');
      rightColumn.style.setProperty('align-items', 'flex-end', 'important');
      rightColumn.style.setProperty('width', 'max-content', 'important');
      rightColumn.style.setProperty('max-width', 'none', 'important');
      rightColumn.style.setProperty('height', 'auto', 'important');
      rightColumn.style.setProperty('min-height', '100%', 'important');
      rightColumn.style.setProperty('text-align', 'right', 'important');
      rightColumn.style.setProperty('z-index', '124', 'important');
      rightColumn.style.setProperty('pointer-events', 'none', 'important');
      rightColumn.style.setProperty('row-gap', '2px', 'important');
      // Жёсткий якорь по самой длинной фразе (например, ПАСМУРНО)
      rightColumn.style.setProperty('min-width', '62px', 'important'); // 62px — ширина "ПАСМУРНО" в текущем шрифте
    }

    if (topRow) {
      topRow.style.setProperty('position', 'relative', 'important');
      topRow.style.setProperty('width', '100%', 'important');
    }

    if (titleBlock instanceof HTMLElement) {
      titleBlock.style.setProperty('position', 'relative', 'important');
      titleBlock.style.setProperty('top', '0', 'important');
      titleBlock.style.setProperty('left', '0', 'important');
      titleBlock.style.setProperty('margin', '0', 'important');
      titleBlock.style.setProperty('padding', '0', 'important');
    }

    if (eyebrow instanceof HTMLElement) {
      eyebrow.style.setProperty('font-size', '7px', 'important');
      eyebrow.style.setProperty('line-height', '10.5px', 'important');
      eyebrow.style.setProperty('letter-spacing', '0.18em', 'important');
      eyebrow.style.setProperty('font-weight', '400', 'important');
      eyebrow.style.setProperty('margin', '0', 'important');
    }

    if (content) {
      content.style.setProperty('box-sizing', 'border-box', 'important');
      content.style.setProperty('padding-top', '6px', 'important');
      content.style.setProperty('padding-right', '18px', 'important');
      content.style.setProperty('padding-bottom', '0', 'important');
      content.style.setProperty('padding-left', '0', 'important');
    }

    if (side) {
      side.style.setProperty('position', 'absolute', 'important');
      side.style.setProperty('top', '0', 'important');
      side.style.setProperty('right', '0', 'important');
      side.style.setProperty('bottom', '0', 'important');
      side.style.setProperty('left', '0', 'important');
      side.style.setProperty('width', '100%', 'important');
      side.style.setProperty('height', '100%', 'important');
      side.style.setProperty('pointer-events', 'none', 'important');
    }

    if (condition) {
      normalizeInlineText(condition);
      const langCode = (document.documentElement.lang || 'ru').toLowerCase();
      const conditionText = (condition.textContent || '').trim();
      if (conditionText) {
        condition.textContent = conditionText.toLocaleUpperCase(langCode);
      }

      if (rightColumn && condition.parentElement !== rightColumn) {
        rightColumn.appendChild(condition);
      } else if (content && condition.parentElement !== content) {
        content.appendChild(condition);
      }

      condition.style.setProperty('position', 'relative', 'important');
      condition.style.setProperty('right', 'auto', 'important');
      condition.style.setProperty('top', 'auto', 'important');
      condition.style.setProperty('bottom', 'auto', 'important');
      condition.style.setProperty('left', 'auto', 'important');
      condition.style.setProperty('z-index', '124', 'important');
      condition.style.setProperty('pointer-events', 'auto', 'important');
      condition.style.setProperty('text-align', 'right', 'important');
      condition.style.setProperty('display', 'block', 'important');
      condition.style.setProperty('width', 'max-content', 'important');
      condition.style.setProperty('max-width', 'none', 'important');
      condition.style.setProperty('overflow', 'visible', 'important');
      condition.style.removeProperty('text-overflow');
      // Жёсткий min-width для устойчивости при zoom/DPI
      condition.style.setProperty('min-width', '62px', 'important'); // 62px — ширина "ПАСМУРНО" в текущем шрифте
      condition.style.setProperty('white-space', 'nowrap', 'important');
      condition.style.setProperty('margin-left', 'auto', 'important');
      condition.style.setProperty('margin-right', '0', 'important');
      condition.style.setProperty('margin-top', '0', 'important');
      condition.style.setProperty('margin-bottom', '0', 'important');
      condition.style.setProperty('align-self', 'flex-end', 'important');
      condition.style.setProperty('order', '1', 'important');

      condition.style.setProperty('font-size', '9.5px', 'important');
      condition.style.setProperty('font-weight', '500', 'important');
      condition.style.setProperty('line-height', '10.64px', 'important');
      condition.style.setProperty('letter-spacing', '0.01em', 'important');
      condition.style.setProperty('text-transform', 'uppercase', 'important');
      condition.style.setProperty('margin', '0', 'important');
      condition.style.setProperty('padding', '0', 'important');
      condition.style.setProperty('transform', 'none', 'important');
      condition.style.setProperty('transition', 'none', 'important');
    }

    if (meta) {
      meta.style.setProperty('font-size', '10px', 'important');
      meta.style.setProperty('line-height', '12px', 'important');
      meta.style.setProperty('white-space', 'nowrap', 'important');
      meta.style.setProperty('margin', '0', 'important');

      const metaRegion = meta.querySelector('span');
      if (metaRegion instanceof HTMLElement) {
        metaRegion.style.setProperty('font-size', '8px', 'important');
        metaRegion.style.setProperty('line-height', '8px', 'important');
        metaRegion.style.setProperty('letter-spacing', '1px', 'important');
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
      locationRow.style.setProperty('align-items', 'flex-start', 'important');
      locationRow.style.setProperty('overflow', 'visible', 'important');
      locationRow.style.setProperty('text-overflow', 'clip', 'important');
      locationRow.style.setProperty('white-space', 'nowrap', 'important');
      locationRow.style.setProperty('min-height', '18.64px', 'important');
      locationRow.style.setProperty('margin-bottom', '1px', 'important');
    }

    if (locationLabel instanceof HTMLElement) {
      locationLabel.style.setProperty('display', 'inline-block', 'important');
      locationLabel.style.setProperty('overflow', 'visible', 'important');
      locationLabel.style.setProperty('text-overflow', 'clip', 'important');
      locationLabel.style.setProperty('white-space', 'nowrap', 'important');
      locationLabel.style.setProperty('font-size', '13px', 'important');
      locationLabel.style.setProperty('line-height', '16.64px', 'important');
      locationLabel.style.setProperty('font-weight', '600', 'important');
      locationLabel.style.setProperty('padding-bottom', '2px', 'important');
      locationLabel.style.setProperty('margin', '0', 'important');
    }

    if (bottom) {
      bottom.style.setProperty('position', 'absolute', 'important');
      bottom.style.setProperty('left', `${bottomLeftInset}px`, 'important');
      bottom.style.setProperty('right', '18px', 'important');
      bottom.style.setProperty('bottom', '10px', 'important');
      bottom.style.setProperty('width', 'auto', 'important');
      bottom.style.setProperty('max-width', 'none', 'important');
      bottom.style.setProperty('margin-left', '0', 'important');
      bottom.style.setProperty('display', 'grid', 'important');
      bottom.style.setProperty('grid-template-columns', 'max-content minmax(0, 1fr)', 'important');
      bottom.style.setProperty('column-gap', '0px', 'important');
      bottom.style.setProperty('align-items', 'flex-end', 'important');
      bottom.style.setProperty('justify-content', 'stretch', 'important');
      bottom.style.setProperty('z-index', '124', 'important');

      const firstChild = bottom.firstElementChild;
      const lastChild = bottom.lastElementChild;
      if (firstChild) {
        firstChild.style.setProperty('justify-self', 'start', 'important');
        firstChild.style.setProperty('text-align', 'left', 'important');
      }
      if (lastChild) {
        lastChild.style.setProperty('justify-self', 'end', 'important');
        lastChild.style.setProperty('text-align', 'right', 'important');
      }
    }

    if (chips) {
      const allChips = Array.from(chips.querySelectorAll('.weather-header-card__chip'));
      const metaRegionForTypography = meta?.querySelector('span');
      const tempValueAnchor = bottom?.firstElementChild instanceof HTMLElement ? bottom.firstElementChild : null;
      const metaComputed = metaRegionForTypography ? window.getComputedStyle(metaRegionForTypography) : null;
      const tempComputed = tempValueAnchor ? window.getComputedStyle(tempValueAnchor) : null;
      const locationLabelColor =
        locationLabel instanceof HTMLElement ? window.getComputedStyle(locationLabel).color : null;
      const locationAnchor = root.querySelector(
        '.weather-header-card__location, .weather-location-selector__current, .weather-location-selector__city, .weather-header-card__eyebrow, .weather-header-card__meta'
      );
      const locationColor =
        locationAnchor instanceof HTMLElement ? window.getComputedStyle(locationAnchor).color : null;
      const conditionColor = condition instanceof HTMLElement ? window.getComputedStyle(condition).color : null;
      const valueAccentColor = conditionColor || locationColor;

      const applyChipTypography = chip => {
        if (!(chip instanceof HTMLElement)) {
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

          if (isHumidityChip || isPressureChip) {
            labelEl.style.setProperty('font-size', '8px', 'important');
            labelEl.style.setProperty('line-height', '8px', 'important');
            labelEl.style.setProperty('letter-spacing', '1px', 'important');
            labelEl.style.setProperty('font-weight', '400', 'important');
          }
        }

        if (valueEl instanceof HTMLElement) {
          const rawValue = (valueEl.textContent || '').trim();
          const valueMatch = rawValue.match(/^(-?\d+(?:[.,]\d+)?)(.*)$/);

          if (tempComputed) {
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

          if (isHumidityChip || isPressureChip) {
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
              unitText = normalizePressureUnit(unitText).toLowerCase();
            }
            unitPart.textContent = unitText;
            unitPart.style.setProperty('display', 'inline-block', 'important');
            unitPart.style.setProperty('line-height', '1', 'important');
            unitPart.style.setProperty('font-size', unitText.length <= 2 ? '0.58em' : '0.66em', 'important');
            unitPart.style.setProperty('text-transform', 'none', 'important');
            unitPart.style.setProperty('font-variant', 'normal', 'important');
            unitPart.style.setProperty('font-variant-caps', 'normal', 'important');
            unitPart.style.setProperty('font-feature-settings', '"smcp" 0, "c2sc" 0', 'important');
            unitPart.style.setProperty(
              'transform',
              unitText.length <= 2 ? 'translateY(-0.42em)' : 'translateY(-0.14em)',
              'important'
            );
            if (isPressureChip) {
              unitPart.style.setProperty('font-family', '"Segoe UI", "Arial", sans-serif', 'important');
              numberPart.style.setProperty('font-size', `${(valueBaseSizePx - 2).toFixed(2)}px`, 'important');
              unitPart.style.setProperty(
                'font-size',
                `${Math.max(7, valueBaseSizePx * 0.62 - 2).toFixed(2)}px`,
                'important'
              );
              unitPart.style.setProperty('transform', 'translateY(-0.08em)', 'important');
              if (valueAccentColor) {
                numberPart.style.setProperty('color', valueAccentColor, 'important');
                unitPart.style.setProperty('color', valueAccentColor, 'important');
              }
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
              if (valueAccentColor) {
                numberPart.style.setProperty('color', valueAccentColor, 'important');
                unitPart.style.setProperty('color', valueAccentColor, 'important');
              }
            }

            valueEl.replaceChildren(numberPart, unitPart);
          }
        }
      };

      const windChip =
        allChips.find(chip => /wind|ветер|вітер/i.test(chip.textContent || '')) || allChips[allChips.length - 1];
      let humidityChip =
        allChips.find(chip => /humid|влаж|feucht|волог|umid|humedad/i.test(chip.textContent || '')) || null;
      let pressureChip =
        allChips.find(chip => /pressure|давлен|тиск|druck|presion/i.test(chip.textContent || '')) || null;
      const feelsLikeChip =
        allChips.find(chip => /gef|ощущ|feels|відчува/i.test(chip.textContent || '')) || allChips[0];

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

        if (rightColumn && fallbackChip.parentElement !== rightColumn) {
          rightColumn.appendChild(fallbackChip);
        }
        humidityChip = fallbackChip;
      }

      if (humidityChip && root) {
        const syncHumidityValue = () => {
          const directHumidity = Number(host?.__weatherCurrentMeta?.humidity);
          if (Number.isFinite(directHumidity) && directHumidity >= 0) {
            host.__weatherHumidityValue = `${Math.round(directHumidity)}%`;
          }

          const menuHumidityChip = Array.from(root.querySelectorAll('.weather-header-dropdown__hero-chips span')).find(
            el => /(влажност[ьи]|humidity|luftfeuchte|вологіст[ьи]|humedad)/i.test(el.textContent || '')
          );
          const menuMatch = (menuHumidityChip?.textContent || '').match(/(\d{1,3})\s*%/);

          if (menuMatch && host) {
            host.__weatherHumidityValue = `${menuMatch[1]}%`;
          } else {
            const rootText = (root.textContent || '').replace(/\s+/g, ' ');
            const rootMatch = rootText.match(
              /(влажност[ьи]|humidity|luftfeuchte|вологіст[ьи]|humedad)\s*:?\s*(\d{1,3})\s*%/i
            );
            if (rootMatch && host) {
              host.__weatherHumidityValue = `${rootMatch[2]}%`;
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

        if (rightColumn && fallbackChip.parentElement !== rightColumn) {
          rightColumn.appendChild(fallbackChip);
        }
        pressureChip = fallbackChip;
      }

      if (pressureChip && root) {
        const rootText = (root.textContent || '').replace(/\s+/g, ' ');

        let pressureMmHg = null;

        const directPressureHpa = Number(host?.__weatherCurrentMeta?.surfacePressure);
        if (Number.isFinite(directPressureHpa) && directPressureHpa > 0) {
          pressureMmHg = Math.round(directPressureHpa * 0.750061683);
        }

        const menuPressureChip = Array.from(root.querySelectorAll('.weather-header-dropdown__hero-chips span')).find(
          el => /(давлен|pressure|druck|тиск|presion)/i.test(el.textContent || '')
        );
        const menuPressureText = (menuPressureChip?.textContent || '').replace(/\s+/g, ' ');
        const mmMatch = menuPressureText.match(/(\d{2,4})\s*(мм|mm)/i);
        const hpaMatch = menuPressureText.match(/(\d{2,4})\s*(hpa|mb|mbar|гпа)/i);

        if (mmMatch) {
          pressureMmHg = Number(mmMatch[1]);
        } else if (hpaMatch) {
          const hpa = Number(hpaMatch[1]);
          pressureMmHg = Number.isFinite(hpa) ? Math.round(hpa * 0.750061683) : null;
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
        }

        const valueEl = Array.from(pressureChip.children).find(
          el => el instanceof HTMLElement && /\d|--/.test(el.textContent || '')
        );
        if (valueEl instanceof HTMLElement) {
          valueEl.textContent = formatHeaderWeatherPressureValue(host, host?.__weatherPressureMmHg);
        }

        if (condition instanceof HTMLElement) {
          condition.style.setProperty('right', '0', 'important');
          condition.style.setProperty('left', 'auto', 'important');
          condition.style.setProperty('transform', 'none', 'important');
          condition.style.setProperty('min-width', '0', 'important');
          condition.style.setProperty('text-align', 'right', 'important');
        }
      }

      if (feelsLikeChip && content && feelsLikeChip.parentElement !== content) {
        content.appendChild(feelsLikeChip);
      }

      if (feelsLikeChip) {
        let feelsLikeLeft = 0;
        let feelsLikeTop = 56;

        if (content instanceof HTMLElement && tempValueAnchor instanceof HTMLElement) {
          const contentRect = content.getBoundingClientRect();
          const tempRect = tempValueAnchor.getBoundingClientRect();

          if (contentRect.width > 0 && tempRect.width > 0) {
            feelsLikeLeft = Math.max(0, Math.round(tempRect.right - contentRect.left + 5));
            const preferredTop = Math.round(tempRect.top - contentRect.top + 1);
            const minTopAtTempRow = Math.round(tempRect.top - contentRect.top);
            feelsLikeTop = Math.max(0, Math.max(preferredTop, minTopAtTempRow));
          }
        }

        feelsLikeChip.style.setProperty('position', 'absolute', 'important');
        feelsLikeChip.style.setProperty('left', `${feelsLikeLeft}px`, 'important');
        feelsLikeChip.style.setProperty('right', 'auto', 'important');
        feelsLikeChip.style.setProperty('top', `${feelsLikeTop}px`, 'important');
        feelsLikeChip.style.setProperty('bottom', 'auto', 'important');
        feelsLikeChip.style.setProperty('z-index', '124', 'important');
        feelsLikeChip.style.setProperty('text-align', 'left', 'important');
        feelsLikeChip.style.setProperty('margin', '0', 'important');
        feelsLikeChip.style.setProperty('padding', '0', 'important');
        feelsLikeChip.style.setProperty('pointer-events', 'auto', 'important');
        feelsLikeChip.style.setProperty('width', 'max-content', 'important');
        feelsLikeChip.style.setProperty('max-width', 'max-content', 'important');
        feelsLikeChip.style.setProperty('display', 'flex', 'important');
        feelsLikeChip.style.setProperty('flex-direction', 'column', 'important');
        feelsLikeChip.style.setProperty('align-items', 'flex-start', 'important');
        feelsLikeChip.style.setProperty('justify-content', 'flex-start', 'important');

        const feelsLikeParts = Array.from(feelsLikeChip.children).filter(child => child instanceof HTMLElement);
        const feelsLikeLabel = feelsLikeParts[0] || null;
        const feelsLikeValue = feelsLikeParts[1] || null;

        const feelsLikeRawText = [
          feelsLikeValue instanceof HTMLElement ? feelsLikeValue.textContent || '' : '',
          feelsLikeChip.textContent || '',
        ]
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        const feelsLikeMatch = feelsLikeRawText.match(/(-?\d{1,2})(?:\s*°?\s*[CcСс])?/);
        const apparentTemperature = Number(host?.__weatherCurrentMeta?.apparentTemperature);
        const fallbackFeelsLike = Number.isFinite(apparentTemperature) ? Math.round(apparentTemperature) : null;
        const feelsLikeDisplayValue = feelsLikeMatch
          ? `${feelsLikeMatch[1]}°C`
          : fallbackFeelsLike !== null
            ? `${fallbackFeelsLike}°C`
            : '--';

        const feelsLikeNumericMatch = feelsLikeDisplayValue.match(/-?\d{1,2}/);
        const feelsLikeLang = (document.documentElement.lang || 'ru').toLowerCase();
        const feelsLikeTextByLang = {
          ru: { label: 'ОЩУЩАЕТСЯ', prefix: 'КАК', unit: 'С' },
          uk: { label: 'ВІДЧУВАЄТЬСЯ', prefix: 'ЯК', unit: 'С' },
          de: { label: 'GEFÜHLT', prefix: 'WIE', unit: 'C' },
          en: { label: 'FEELS LIKE', prefix: 'LIKE', unit: 'C' },
        };
        const feelsLikeText = feelsLikeTextByLang[feelsLikeLang] || feelsLikeTextByLang.en;
        const feelsLikeTempValue = feelsLikeNumericMatch ? `${feelsLikeNumericMatch[0]}°${feelsLikeText.unit}` : '--';

        if (feelsLikeLabel instanceof HTMLElement) {
          feelsLikeLabel.textContent = feelsLikeText.label;
        }

        if (feelsLikeValue instanceof HTMLElement) {
          const prefixNode = document.createElement('span');
          const tempNode = document.createElement('span');
          prefixNode.textContent = feelsLikeText.prefix;
          tempNode.textContent = feelsLikeTempValue;
          feelsLikeValue.replaceChildren(prefixNode, tempNode);
        }

        if (feelsLikeLabel instanceof HTMLElement) {
          feelsLikeLabel.style.setProperty('display', 'block', 'important');
          feelsLikeLabel.style.setProperty('font-size', '5px', 'important');
          feelsLikeLabel.style.setProperty('line-height', '7.5px', 'important');
          feelsLikeLabel.style.setProperty('letter-spacing', '0.7px', 'important');
          feelsLikeLabel.style.setProperty('font-weight', '400', 'important');
          feelsLikeLabel.style.setProperty('margin', '0 0 1px 0', 'important');
          feelsLikeLabel.style.setProperty('opacity', '0.92', 'important');
          feelsLikeLabel.style.setProperty('white-space', 'nowrap', 'important');
          feelsLikeLabel.style.setProperty('text-align', 'left', 'important');

          const labelWidth = Math.ceil(feelsLikeLabel.getBoundingClientRect().width || feelsLikeLabel.scrollWidth || 0);

          if (labelWidth > 0) {
            feelsLikeChip.style.setProperty('width', `${labelWidth}px`, 'important');
            feelsLikeChip.style.setProperty('min-width', `${labelWidth}px`, 'important');
            feelsLikeChip.style.setProperty('max-width', `${labelWidth}px`, 'important');
            feelsLikeChip.style.setProperty('align-items', 'stretch', 'important');
          }

          const geoAnchor =
            eyebrow instanceof HTMLElement
              ? eyebrow
              : locationCurrent instanceof HTMLElement
                ? locationCurrent
                : locationLabel instanceof HTMLElement
                  ? locationLabel
                  : null;

          if (content instanceof HTMLElement && geoAnchor instanceof HTMLElement) {
            const contentRect = content.getBoundingClientRect();
            const geoRect = geoAnchor.getBoundingClientRect();

            if (contentRect.width > 0 && geoRect.width > 0 && labelWidth > 0) {
              const targetRight = geoRect.right - contentRect.left;
              const maxLeft = Math.max(0, Math.round(contentRect.width - labelWidth));
              const alignedLeft = Math.round(targetRight - labelWidth);
              feelsLikeLeft = Math.max(0, Math.min(maxLeft, alignedLeft));
              feelsLikeChip.style.setProperty('left', `${feelsLikeLeft}px`, 'important');
            }
          }
        }

        if (feelsLikeValue instanceof HTMLElement) {
          const labelWidth =
            feelsLikeLabel instanceof HTMLElement
              ? Math.ceil(feelsLikeLabel.getBoundingClientRect().width || feelsLikeLabel.scrollWidth || 0)
              : 0;
          const valueWidthPx = labelWidth > 0 ? labelWidth : 40;
          let valueGapPx = 6;

          feelsLikeValue.style.setProperty('display', 'flex', 'important');
          feelsLikeValue.style.setProperty('align-items', 'flex-end', 'important');
          feelsLikeValue.style.setProperty('justify-content', 'space-between', 'important');
          feelsLikeValue.style.setProperty('column-gap', `${valueGapPx}px`, 'important');
          feelsLikeValue.style.setProperty('width', `${valueWidthPx}px`, 'important');
          feelsLikeValue.style.setProperty('max-width', `${valueWidthPx}px`, 'important');
          feelsLikeValue.style.setProperty('min-width', `${valueWidthPx}px`, 'important');
          feelsLikeValue.style.setProperty('font-size', '8px', 'important');
          feelsLikeValue.style.setProperty('line-height', '12px', 'important');
          feelsLikeValue.style.setProperty('font-weight', '600', 'important');
          feelsLikeValue.style.setProperty('margin', '0', 'important');
          feelsLikeValue.style.setProperty('white-space', 'nowrap', 'important');
          feelsLikeValue.style.setProperty('word-break', 'keep-all', 'important');
          feelsLikeValue.style.setProperty('overflow-wrap', 'normal', 'important');
          feelsLikeValue.style.setProperty('overflow', 'hidden', 'important');

          const valueParts = Array.from(feelsLikeValue.children).filter(child => child instanceof HTMLElement);
          const prefixPart = valueParts[0] || null;
          const tempPart = valueParts[1] || null;
          const humidityNumberSize = tempComputed
            ? Math.max(12.5, Math.min(15.5, (Number.parseFloat(tempComputed.fontSize) || 22) * 0.58)) - 2
            : 10.5;
          const labelComputed = feelsLikeLabel instanceof HTMLElement ? window.getComputedStyle(feelsLikeLabel) : null;
          const prefixFontSizePx = Number.parseFloat(labelComputed?.fontSize || '5') || 5;
          const prefixLineHeightPx = Number.parseFloat(labelComputed?.lineHeight || '7.5') || 7.5;
          const tempFontSizePx = humidityNumberSize;

          if (prefixPart instanceof HTMLElement) {
            prefixPart.style.setProperty('display', 'inline-block', 'important');
            prefixPart.style.setProperty('text-transform', 'uppercase', 'important');
            prefixPart.style.setProperty('font-weight', '500', 'important');
            prefixPart.style.setProperty('font-size', `${prefixFontSizePx}px`, 'important');
            prefixPart.style.setProperty('line-height', `${prefixLineHeightPx}px`, 'important');
            prefixPart.style.setProperty('opacity', '0.96', 'important');
            if (locationColor) {
              prefixPart.style.setProperty('color', locationColor, 'important');
            }
          }

          if (tempPart instanceof HTMLElement) {
            const compactTempText = (tempPart.textContent || '').replace(/\s+/g, ' ').trim();
            const parsedTempMatch = compactTempText.match(/^(-?\d{1,2})(?:\s*°?\s*([CcСс]))?$/);
            const tempNumberText = parsedTempMatch ? parsedTempMatch[1] : compactTempText;
            const tempUnitLetter = parsedTempMatch && parsedTempMatch[2] ? parsedTempMatch[2].toUpperCase() : 'С';
            const tempNumberNode = document.createElement('span');
            const tempUnitNode = document.createElement('span');
            tempNumberNode.textContent = tempNumberText;
            tempUnitNode.textContent = `°${tempUnitLetter}`;
            tempPart.replaceChildren(tempNumberNode, tempUnitNode);

            tempPart.style.setProperty('display', 'inline-block', 'important');
            tempPart.style.setProperty('margin-left', 'auto', 'important');
            tempPart.style.setProperty('text-align', 'right', 'important');
            if (tempComputed) {
              tempPart.style.setProperty('font-family', tempComputed.fontFamily, 'important');
              tempPart.style.setProperty('letter-spacing', tempComputed.letterSpacing, 'important');
            }
            tempPart.style.setProperty('font-weight', tempComputed?.fontWeight || '600', 'important');
            tempPart.style.setProperty('font-size', `${tempFontSizePx.toFixed(2)}px`, 'important');
            tempPart.style.setProperty('line-height', `${tempFontSizePx.toFixed(2)}px`, 'important');
            tempPart.style.setProperty('white-space', 'nowrap', 'important');
            tempPart.style.setProperty('text-transform', 'none', 'important');
            tempPart.style.setProperty('align-self', 'flex-end', 'important');

            tempNumberNode.style.setProperty('display', 'inline', 'important');
            tempNumberNode.style.setProperty('font-size', '1em', 'important');
            tempNumberNode.style.setProperty('line-height', '1', 'important');
            tempNumberNode.style.setProperty('font-weight', 'inherit', 'important');

            tempUnitNode.style.setProperty('display', 'inline-block', 'important');
            tempUnitNode.style.setProperty('font-size', '0.58em', 'important');
            tempUnitNode.style.setProperty('line-height', '1', 'important');
            tempUnitNode.style.setProperty('letter-spacing', '0', 'important');
            tempUnitNode.style.setProperty('transform', 'translateY(-0.42em)', 'important');

            const exactTempColor = locationLabelColor || locationColor;
            if (exactTempColor) {
              tempPart.style.setProperty('color', exactTempColor, 'important');
              tempNumberNode.style.setProperty('color', exactTempColor, 'important');
              tempUnitNode.style.setProperty('color', exactTempColor, 'important');
            }
          }

          if (prefixPart instanceof HTMLElement && tempPart instanceof HTMLElement && labelWidth > 0) {
            const prefixWidth = prefixPart.getBoundingClientRect().width;
            const tempWidth = tempPart.getBoundingClientRect().width;
            const totalWidth = prefixWidth + tempWidth + valueGapPx;

            if (totalWidth > valueWidthPx) {
              valueGapPx = 2;
              feelsLikeValue.style.setProperty('column-gap', `${valueGapPx}px`, 'important');
              const allowedTextWidth = Math.max(1, valueWidthPx - valueGapPx);
              const currentTextWidth = Math.max(1, prefixWidth + tempWidth);
              const fitRatio = Math.min(1, allowedTextWidth / currentTextWidth);
              const fittedPrefixSize = Math.max(6, prefixFontSizePx * fitRatio);

              prefixPart.style.setProperty('font-size', `${fittedPrefixSize.toFixed(2)}px`, 'important');
              prefixPart.style.setProperty(
                'line-height',
                `${Math.max(prefixLineHeightPx * fitRatio, 6).toFixed(2)}px`,
                'important'
              );
            }
          }
        }
      }

      if (humidityChip) {
        normalizeInlineText(humidityChip);

        if (rightColumn && humidityChip.parentElement !== rightColumn) {
          rightColumn.appendChild(humidityChip);
        }

        humidityChip.style.setProperty('position', 'absolute', 'important');
        humidityChip.style.setProperty('right', '0', 'important');
        humidityChip.style.setProperty('top', 'auto', 'important');
        humidityChip.style.setProperty('left', 'auto', 'important');
        humidityChip.style.setProperty('bottom', '0', 'important');
        humidityChip.style.setProperty('z-index', '124', 'important');
        humidityChip.style.setProperty('text-align', 'right', 'important');
        humidityChip.style.setProperty('pointer-events', 'auto', 'important');
        humidityChip.style.setProperty('display', 'flex', 'important');
        humidityChip.style.setProperty('flex-direction', 'column', 'important');
        humidityChip.style.setProperty('align-items', 'flex-end', 'important');
        humidityChip.style.setProperty('justify-content', 'flex-end', 'important');
        humidityChip.style.setProperty('width', 'auto', 'important');
        humidityChip.style.setProperty('max-width', 'none', 'important');
        humidityChip.style.setProperty('white-space', 'nowrap', 'important');
        humidityChip.style.setProperty('margin', '0', 'important');

        Array.from(humidityChip.children).forEach(child => {
          if (!(child instanceof HTMLElement)) {
            return;
          }
          normalizeInlineText(child);
          child.style.setProperty('display', 'block', 'important');
          child.style.setProperty('width', 'auto', 'important');
          child.style.setProperty('white-space', 'nowrap', 'important');
          child.style.setProperty('text-align', 'right', 'important');
        });

        applyChipTypography(humidityChip);
      }

      if (pressureChip) {
        normalizeInlineText(pressureChip);

        if (rightColumn && pressureChip.parentElement !== rightColumn) {
          rightColumn.appendChild(pressureChip);
        }

        pressureChip.style.setProperty('position', 'absolute', 'important');
        pressureChip.style.setProperty('right', '0', 'important');
        pressureChip.style.setProperty('top', 'calc(50% - 6px)', 'important');
        pressureChip.style.setProperty('left', 'auto', 'important');
        pressureChip.style.setProperty('bottom', 'auto', 'important');
        pressureChip.style.setProperty('z-index', '124', 'important');
        pressureChip.style.setProperty('text-align', 'right', 'important');
        pressureChip.style.setProperty('pointer-events', 'auto', 'important');
        pressureChip.style.setProperty('display', 'flex', 'important');
        pressureChip.style.setProperty('flex-direction', 'column', 'important');
        pressureChip.style.setProperty('align-items', 'flex-end', 'important');
        pressureChip.style.setProperty('justify-content', 'flex-start', 'important');
        pressureChip.style.setProperty('width', 'auto', 'important');
        pressureChip.style.setProperty('max-width', 'none', 'important');
        pressureChip.style.setProperty('white-space', 'nowrap', 'important');
        pressureChip.style.setProperty('margin', '0', 'important');
        pressureChip.style.setProperty('transform', 'translateY(-50%)', 'important');

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

        applyChipTypography(pressureChip);
      }

      if (windChip) {
        // Keep wind data for the weather menu, but hide it in the compact header widget preview.
        windChip.style.setProperty('display', 'none', 'important');
      }

      if (!chips.children.length) {
        chips.style.setProperty('display', 'none', 'important');
      }
    }

    if (toggle) {
      if (content && toggle.parentElement !== content) {
        content.appendChild(toggle);
      }

      const resolvedLeft = '50%';

      toggle.style.setProperty('position', 'absolute', 'important');
      toggle.style.setProperty('left', resolvedLeft, 'important');
      toggle.style.setProperty('right', 'auto', 'important');
      toggle.style.setProperty('top', 'auto', 'important');
      toggle.style.setProperty('bottom', '-10px', 'important');
      toggle.style.setProperty('transform', 'translateX(-50%)', 'important');
      toggle.style.setProperty('z-index', '124', 'important');
      toggle.style.setProperty('pointer-events', 'auto', 'important');
    }
  }

  function ensureHeaderWeatherMenuPlacementLock(host) {
    if (!host || host.__weatherMenuPlacementLockActive) {
      return;
    }

    host.__weatherMenuPlacementLockActive = true;
    let pass = 0;
    const timerId = window.setInterval(() => {
      if (!host.isConnected) {
        window.clearInterval(timerId);
        host.__weatherMenuPlacementLockActive = false;
        return;
      }

      enforceHeaderWeatherMenuPlacement(host);
      pass += 1;

      if (pass >= 3) {
        window.clearInterval(timerId);
        host.__weatherMenuPlacementLockActive = false;
      }
    }, 250);
  }

  function createHeaderWeatherOrbOverlay(variant) {
    const overlay = document.createElement('div');
    overlay.className = `weather-orb-overlay weather-orb-overlay--${variant}`;
    overlay.hidden = true;

    const video = document.createElement('video');
    video.className = 'weather-orb-overlay__video';
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');

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

  function ensureHeaderWeatherOrbOverlay(container, variant) {
    let overlay = container.querySelector(`.weather-orb-overlay--${variant}`);
    if (overlay) {
      return overlay;
    }

    overlay = createHeaderWeatherOrbOverlay(variant);
    container.appendChild(overlay);
    return overlay;
  }

  function stopHeaderWeatherOrbRender(overlay) {
    if (!overlay) {
      return;
    }

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

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
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

    const cropBox = resolveHeaderWeatherOrbCropBox(
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

  function setHeaderWeatherOrbSource(overlay, kind, assetConfig) {
    const video = overlay.querySelector('video');
    const canvas = overlay.querySelector('canvas');
    const image = overlay.querySelector('img');
    const videoSources = Array.isArray(assetConfig?.sources)
      ? assetConfig.sources.filter(Boolean)
      : assetConfig?.src
        ? [assetConfig.src]
        : [];
    if (!video) {
      return;
    }

    overlay.classList.toggle('is-sun', kind === 'sun');
    overlay.classList.toggle('is-moon', kind === 'moon');
    overlay.dataset.orbKind = kind || '';

    if (!kind || !assetConfig || (!videoSources.length && !assetConfig.src)) {
      stopHeaderWeatherOrbRender(overlay);
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

    if (assetConfig.type === 'texture-sphere') {
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
      if (!canvas) return;
      const textureSrc = assetConfig.src;
      if (overlay.dataset.textureSphereSrc === textureSrc && overlay.__orbTextureSphereImg?.complete) {
        canvas.hidden = false;
        if (image) image.hidden = true;
        startHeaderWeatherOrbTextureRender(overlay, overlay.__orbTextureSphereImg);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        overlay.__orbTextureSphereImg = img;
        overlay.dataset.textureSphereSrc = textureSrc;
        canvas.hidden = false;
        if (image) image.hidden = true;
        startHeaderWeatherOrbTextureRender(overlay, img);
      };
      img.onerror = () => {
        canvas.hidden = true;
        if (image) image.hidden = true;
      };
      overlay.dataset.textureSphereSrc = textureSrc;
      img.src = textureSrc;
      return;
    }

    if (assetConfig.type === 'video-keyed') {
      const sourceListKey = videoSources.join('|');
      if (overlay.dataset.currentSourceList !== sourceListKey) {
        overlay.dataset.currentSourceList = sourceListKey;
        overlay.dataset.currentSourceIndex = '0';
      }

      const tryVideoSource = sourceIndex => {
        const nextSource = videoSources[sourceIndex];
        if (!nextSource) {
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
              video.hidden = true;
              if (canvas) {
                canvas.hidden = false;
              }
              if (image) {
                image.hidden = true;
              }
              startHeaderWeatherOrbRender(overlay);
            })
            .catch(() => {
              tryVideoSource(sourceIndex + 1);
            });
        };

        video.onloadeddata = startPlayback;
        video.oncanplay = startPlayback;
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
        console.warn('Header weather astro sync failed:', error);
      }

      host.__weatherTimeZone = resolveHeaderWeatherTimeZone(host, astroData?.locationMeta || null);

      try {
        host.__weatherCurrentMeta = await resolveHeaderWeatherCurrent(host);
      } catch (error) {
        host.__weatherCurrentMeta = null;
        console.warn('Header weather current sync failed:', error);
      }

      if (host.__weatherOrbSyncToken !== syncToken) {
        return;
      }

      const orbModel = resolveHeaderWeatherOrbModel(host, astroData);
      const orbKind = orbModel?.kind || null;
      const orbAtmosphere = resolveHeaderWeatherOrbAtmosphere(host);
      const widgetBasePath = getHeaderWeatherWidgetBasePath(host);
      const sunVideoSources = widgetBasePath
        ? [
            `${widgetBasePath}/assets/Sun/3d-animated-realistic-sun-with-glowing-solar-flares-and-surface-turbulence-4k-video.mp4`,
          ]
        : [];
      const assetConfig = orbKind
        ? orbKind === 'sun'
          ? sunVideoSources.length
            ? {
                type: 'video-keyed',
                sources: sunVideoSources,
              }
            : null
          : {
              type: 'texture-sphere',
              src: HEADER_WEATHER_MOON_TEXTURE_SRC,
            }
        : null;

      const previewContainer = host.shadowRoot.querySelector('.weather-header-preview');
      if (previewContainer) {
        const previewOverlay = ensureHeaderWeatherOrbOverlay(previewContainer, 'preview');
        applyHeaderWeatherOrbLayout(previewOverlay, orbModel?.previewLayout);
        setHeaderWeatherOrbSource(previewOverlay, orbKind, assetConfig);
        applyHeaderWeatherOrbAtmosphere(previewOverlay, orbKind ? orbAtmosphere : 0);
      }

      const isExpanded =
        host.shadowRoot.querySelector('.weather-header-trigger')?.getAttribute('aria-expanded') === 'true';
      const dropdownScene = host.shadowRoot.querySelector('.weather-header-dropdown__scene');
      if (dropdownScene) {
        const dropdownOverlay = ensureHeaderWeatherOrbOverlay(dropdownScene, 'dropdown');
        applyHeaderWeatherOrbLayout(dropdownOverlay, orbModel?.dropdownLayout);
        setHeaderWeatherOrbSource(dropdownOverlay, isExpanded ? orbKind : null, assetConfig);
        applyHeaderWeatherOrbAtmosphere(dropdownOverlay, isExpanded && orbKind ? orbAtmosphere : 0);
      }

      enforceHeaderWeatherToggleArrow(host);
      enforceHeaderWeatherMenuPlacement(host);
      ensureHeaderWeatherMenuPlacementLock(host);
      syncHeaderWeatherLiveClock(host);
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
        mutation => mutation.type === 'attributes' && mutation.attributeName === 'aria-expanded'
      );

      if (shouldSync) {
        syncHeaderWeatherExpandedState(host);
        scheduleHeaderWeatherOrbSync(host);
      }
    });

    observer.observe(host.shadowRoot, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-expanded'],
    });

    host.__weatherStateObserver = observer;

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
    host.__weatherViewportSyncHandler = () => scheduleHeaderWeatherOrbSync(host);
    document.addEventListener('visibilitychange', host.__weatherAstroVisibilityHandler);
    window.addEventListener('resize', host.__weatherViewportSyncHandler, { passive: true });
    window.addEventListener('orientationchange', host.__weatherViewportSyncHandler, { passive: true });
    syncHeaderWeatherExpandedState(host);
    scheduleHeaderWeatherOrbSync(host);

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

  function refreshHeaderWeatherWidgetData(host) {
    if (!host || host.dataset.weatherMounted !== 'true') {
      return;
    }

    if (host.dataset.weatherExpanded === 'true') {
      return;
    }

    const pageLang = normalizeLangCode(
      host.dataset.weatherLocale || host.__weatherLocale || document.documentElement.lang
    );
    host.__weatherWidgetInstance?.unmount?.();
    host.__weatherWidgetInstance = null;
    host.dataset.weatherMounted = 'false';
    host.classList.remove('is-mounted');
    mountHeaderWeatherWidget(pageLang);
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
    host.__weatherTimeZone = null;
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
      host.classList.add('is-mounted');
      host.closest('.header-weather-shell')?.classList.add('weather-shell-ready');
      applyHeaderWeatherTransparency(host);
      bindHeaderWeatherState(host);
      syncHeaderWeatherOrbOverlay(host);
      void syncHeaderWeatherPreciseLocationMeta(host);

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
      host.dataset.weatherMountScheduled = 'false';
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
        window.requestIdleCallback(cb, { timeout: 3500 });
      } else {
        window.setTimeout(cb, 220);
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
      const postLoadDelay = window.innerWidth <= 899 ? 1800 : 650;
      window.setTimeout(startMount, postLoadDelay);
    };

    if (document.readyState === 'complete') {
      startAfterLoad();
      return;
    }

    const onLoad = () => {
      window.removeEventListener('load', onLoad);
      startAfterLoad();
    };

    window.addEventListener('load', onLoad, { once: true });

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
