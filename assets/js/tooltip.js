/**
 * HUNDESALON_NIKA — Smart Tooltip System
 * Показывает подсказки при наведении на элементы сайта.
 */
(function () {
  'use strict';

  /* ---- определяем язык страницы ---- */
  const pageLang = (document.documentElement.lang || 'ru').toLowerCase().substring(0, 2);

  /* ---- словари подсказок ---- */
  const T = {
    ru: {
      /* навигация */
      'nav:o-nas': 'Узнайте о нас и нашей команде',
      'nav:nashi-uslugi': 'Полный список услуг по уходу',
      'nav:prays-list': 'Актуальные цены на все процедуры',
      'nav:galereya': 'Фотогалерея наших работ',
      'nav:do-i-posle': 'Результаты до и после груминга',
      'nav:kontakty': 'Как нас найти и связаться',
      'nav:blog': 'Полезные статьи об уходе за питомцами',
      'nav:social': 'Мы в соцсетях',
      'nav:reyting': 'Рейтинг и отзывы клиентов',
      'nav:partnerstvo': 'Стать нашим партнёром',
      'nav:vvedenie': 'Вводная информация о салоне',
      'nav:onlayn-bronirovanie': 'Забронировать онлайн прямо сейчас',
      'nav:index': 'Главная страница сайта',
      /* кнопки */
      'btn:online': 'Запишитесь быстро и удобно',
      'btn:theme': 'Сменить тему оформления',
      'btn:burger': 'Открыть меню навигации',
      'btn:lang': 'Выбрать язык интерфейса',
      'btn:neon': 'Перейти к разделу',
      'btn:spotify': 'Открыть плеер Spotify',
      /* соцсети */
      'social:instagram': 'Наш Instagram — ежедневные фото',
      'social:facebook': 'Наша страница в Facebook',
      'social:telegram': 'Написать нам в Telegram',
      'social:whatsapp': 'Написать нам в WhatsApp',
      'social:viber': 'Позвонить через Viber',
      'social:tiktok': 'TikTok — забавные видео',
      'social:youtube': 'YouTube — мастер-классы',
      'social:email': 'Написать нам письмо',
      'social:share': 'Все наши соцсети',
      'social:phone': 'Позвонить нам',
      /* карточки */
      'card:service': 'Нажмите, чтобы узнать подробнее',
      'card:promo': 'Специальное предложение — успейте воспользоваться!',
      'card:gallery': 'Фото одной из наших работ',
      'card:review': 'Отзыв нашего клиента',
      'card:social': 'Подписывайтесь и следите за новостями',
      /* логотип */
      logo: 'Главная страница сайта',
      /* hero */
      'hero:cta': 'Посмотреть все цены',
      /* footer */
      'footer:nav': 'Перейти в раздел',
      /* изображения */
      'img:gallery': 'Фото из нашей галереи',
    },
    uk: {
      'nav:o-nas': 'Дізнайтесь про нас та нашу команду',
      'nav:nashi-uslugi': 'Повний перелік послуг з догляду',
      'nav:prays-list': 'Актуальні ціни на всі процедури',
      'nav:galereya': 'Фотогалерея наших робіт',
      'nav:do-i-posle': 'Результати до і після грумінгу',
      'nav:kontakty': "Як нас знайти та зв'язатися",
      'nav:blog': 'Корисні статті про догляд за тваринами',
      'nav:social': 'Ми в соцмережах',
      'nav:reyting': 'Рейтинг і відгуки клієнтів',
      'nav:partnerstvo': 'Стати нашим партнером',
      'nav:vvedenie': 'Вступна інформація про салон',
      'nav:onlayn-bronirovanie': 'Забронювати онлайн просто зараз',
      'nav:index': 'Головна сторінка сайту',
      'btn:online': 'Запишіться швидко та зручно',
      'btn:theme': 'Змінити тему оформлення',
      'btn:burger': 'Відкрити меню навігації',
      'btn:lang': 'Вибрати мову інтерфейсу',
      'btn:neon': 'Перейти до розділу',
      'btn:spotify': 'Відкрити плеєр Spotify',
      'social:instagram': 'Наш Instagram — щоденні фото',
      'social:facebook': 'Наша сторінка у Facebook',
      'social:telegram': 'Написати нам у Telegram',
      'social:whatsapp': 'Написати нам у WhatsApp',
      'social:viber': 'Подзвонити через Viber',
      'social:tiktok': 'TikTok — кумедні відео',
      'social:youtube': 'YouTube — майстер-класи',
      'social:email': 'Написати нам листа',
      'social:share': 'Всі наші соцмережі',
      'social:phone': 'Зателефонувати нам',
      'card:service': 'Натисніть, щоб дізнатися більше',
      'card:promo': 'Спеціальна пропозиція — не пропустіть!',
      'card:gallery': 'Фото однієї з наших робіт',
      'card:review': 'Відгук нашого клієнта',
      'card:social': 'Підписуйтесь і стежте за новинами',
      logo: 'Головна сторінка сайту',
      'hero:cta': 'Переглянути всі ціни',
      'footer:nav': 'Перейти до розділу',
      'img:gallery': 'Фото з нашої галереї',
    },
    en: {
      'nav:o-nas': 'Learn about us and our team',
      'nav:nashi-uslugi': 'Full list of grooming services',
      'nav:prays-list': 'Up-to-date prices for all procedures',
      'nav:galereya': 'Photo gallery of our work',
      'nav:do-i-posle': 'Before and after grooming results',
      'nav:kontakty': 'How to find and contact us',
      'nav:blog': 'Useful articles about pet care',
      'nav:social': 'Find us on social media',
      'nav:reyting': 'Client ratings and reviews',
      'nav:partnerstvo': 'Become our partner',
      'nav:vvedenie': 'Intro information about the salon',
      'nav:onlayn-bronirovanie': 'Book online right now',
      'nav:index': 'Website home page',
      'btn:online': 'Book quickly and easily',
      'btn:theme': 'Toggle colour theme',
      'btn:burger': 'Open navigation menu',
      'btn:lang': 'Choose interface language',
      'btn:neon': 'Go to section',
      'btn:spotify': 'Open Spotify player',
      'social:instagram': 'Our Instagram — daily photos',
      'social:facebook': 'Our Facebook page',
      'social:telegram': 'Message us on Telegram',
      'social:whatsapp': 'Message us on WhatsApp',
      'social:viber': 'Call us via Viber',
      'social:tiktok': 'TikTok — fun videos',
      'social:youtube': 'YouTube — tutorials',
      'social:email': 'Send us an email',
      'social:share': 'All our social networks',
      'social:phone': 'Call us',
      'card:service': 'Click to learn more',
      'card:promo': "Special offer — don't miss it!",
      'card:gallery': 'Photo from our gallery',
      'card:review': 'A review from one of our clients',
      'card:social': 'Follow us and stay up to date',
      logo: 'Website home page',
      'hero:cta': 'See all prices',
      'footer:nav': 'Go to section',
      'img:gallery': 'Photo from our gallery',
    },
    de: {
      'nav:o-nas': 'Über uns und unser Team',
      'nav:nashi-uslugi': 'Vollständige Leistungsübersicht',
      'nav:prays-list': 'Aktuelle Preise für alle Behandlungen',
      'nav:galereya': 'Fotogalerie unserer Arbeiten',
      'nav:do-i-posle': 'Vorher-Nachher-Ergebnisse',
      'nav:kontakty': 'So finden und erreichen Sie uns',
      'nav:blog': 'Nützliche Artikel zur Tierpflege',
      'nav:social': 'Wir in sozialen Netzwerken',
      'nav:reyting': 'Bewertungen und Kundenmeinungen',
      'nav:partnerstvo': 'Werden Sie unser Partner',
      'nav:vvedenie': 'Einführung in den Salon',
      'nav:onlayn-bronirovanie': 'Jetzt online buchen',
      'nav:index': 'Startseite der Website',
      'btn:online': 'Schnell und einfach buchen',
      'btn:theme': 'Farbschema wechseln',
      'btn:burger': 'Navigationsmenü öffnen',
      'btn:lang': 'Sprache wählen',
      'btn:neon': 'Zum Abschnitt',
      'btn:spotify': 'Spotify-Player öffnen',
      'social:instagram': 'Unser Instagram — tägliche Fotos',
      'social:facebook': 'Unsere Facebook-Seite',
      'social:telegram': 'Schreiben Sie uns auf Telegram',
      'social:whatsapp': 'Schreiben Sie uns auf WhatsApp',
      'social:viber': 'Über Viber anrufen',
      'social:tiktok': 'TikTok — lustige Videos',
      'social:youtube': 'YouTube — Tutorials',
      'social:email': 'E-Mail an uns',
      'social:share': 'Alle unsere sozialen Netzwerke',
      'social:phone': 'Uns anrufen',
      'card:service': 'Klicken für mehr Details',
      'card:promo': 'Sonderangebot — nicht verpassen!',
      'card:gallery': 'Foto aus unserer Galerie',
      'card:review': 'Kundenbewertung',
      'card:social': 'Folgen Sie uns und bleiben Sie auf dem Laufenden',
      logo: 'Startseite der Website',
      'hero:cta': 'Alle Preise ansehen',
      'footer:nav': 'Zum Abschnitt',
      'img:gallery': 'Foto aus unserer Galerie',
    },
  };

  const MEDIA_LIBRARY_TOOLTIPS = {
    ru: {
      mediaLibrary: 'Перейти в Нашу МЕДИАТЕКУ',
      spotify: 'Открыть плеер Spotify',
      appleMusic: 'Открыть плеер Apple Music',
    },
    uk: {
      mediaLibrary: 'Перейти до Нашої МЕДІАТЕКИ',
      spotify: 'Відкрити плеєр Spotify',
      appleMusic: 'Відкрити плеєр Apple Music',
    },
    de: {
      mediaLibrary: 'Unsere Mediathek öffnen',
      spotify: 'Spotify-Player öffnen',
      appleMusic: 'Apple-Music-Player öffnen',
    },
    en: {
      mediaLibrary: 'Open our media library',
      spotify: 'Open Spotify player',
      appleMusic: 'Open Apple Music player',
    },
  };

  const TOOLTIP_GRAMMAR_FIXES = {
    ru: {
      'Перейти в меню Наша МЕДИАТЕКА': 'Перейти в Нашу МЕДИАТЕКУ',
      'Открыть Spotify-плеер': 'Открыть плеер Spotify',
      'Открыть Apple Music': 'Открыть плеер Apple Music',
    },
    uk: {
      'Перейти до меню Наша МЕДІАТЕКА': 'Перейти до Нашої МЕДІАТЕКИ',
      'Відкрити Spotify-плеєр': 'Відкрити плеєр Spotify',
      'Відкрити Apple Music': 'Відкрити плеєр Apple Music',
    },
    de: {
      'Zum Menü Unsere Mediathek wechseln': 'Unsere Mediathek öffnen',
      'Apple Music öffnen': 'Apple-Music-Player öffnen',
    },
    en: {
      'Go to the Our Media Library menu': 'Open our media library',
      'Open Apple Music': 'Open Apple Music player',
    },
  };

  const t = T[pageLang] || T.ru;
  const mediaTooltip = MEDIA_LIBRARY_TOOLTIPS[pageLang] || MEDIA_LIBRARY_TOOLTIPS.ru;
  const tooltipGrammarFixes = TOOLTIP_GRAMMAR_FIXES[pageLang] || TOOLTIP_GRAMMAR_FIXES.ru;

  function normalizeTooltipText(text) {
    if (!text) return '';

    /* Global copy rule: every hover tooltip should read naturally in the current page language. */
    const cleaned = String(text)
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();

    return tooltipGrammarFixes[cleaned] || cleaned;
  }

  /* ---- утилита: нормализовать href в ключ маршрута ---- */
  function routeKey(href) {
    if (!href) return '';
    const clean = href.split('?')[0].split('#')[0];
    return clean.replace(/^.*\//, '').replace(/\.html$/, '') || 'index';
  }

  /* ---- создать DOM-элемент подсказки ---- */
  const tip = document.createElement('div');
  tip.className = 'nika-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);

  let hideTimer = null;

  /* высота фиксированной шапки — чтобы тултип не прятался под ней */
  function getHeaderHeight() {
    const header = document.querySelector('header.header');
    if (!header) return 0;
    const rect = header.getBoundingClientRect();
    return rect.bottom > 0 ? rect.bottom : 0;
  }

  function showTip(text, target) {
    text = normalizeTooltipText(text);
    if (!text) return;
    clearTimeout(hideTimer);

    /* сброс классов направления перед расчётом */
    tip.classList.remove('nika-tooltip--visible', 'nika-tooltip--below', 'nika-tooltip--left', 'nika-tooltip--right');
    tip.style.cssText = '';
    delete tip.dataset.noArrow;
    delete tip.dataset.compact;

    /* текст в span — textContent only (no innerHTML; alt text must not become HTML) */
    tip.replaceChildren();
    const textNode = document.createElement('span');
    textNode.className = 'nika-tip-text';
    textNode.textContent = text;
    tip.appendChild(textNode);

    /* viewport-координаты целевого элемента */
    const rect = target.getBoundingClientRect();
    const elCX = rect.left + rect.width / 2;
    const elCY = rect.top + rect.height / 2;

    /* --- контекст элемента --- */
    const isBurger = target.id === 'burgerBtn' || !!target.closest('#burgerBtn');
    const isLangBtn = !!target.closest('.lang-dropdown-btn') || !!target.closest('.language-dropdown');
    const isOnlineBtn = !!target.closest('.header-online-btn');
    const inMobileNav = !!target.closest('#mobile-nav');
    const inHeader = !!target.closest('.header');
    const isPageTitle = !!target.closest('.page-title, .breadcrumb, h1');
    const isLogo = !!target.closest('.logo') || target.classList.contains('logo-img');
    const isHeaderSocial = !!target.closest('.social-icons .social-icon');
    const socialBarEl = document.querySelector('.social-bar');
    const hasVisibleSocialBar = !!(
      socialBarEl &&
      socialBarEl.classList.contains('show-social') &&
      socialBarEl.getBoundingClientRect().height > 0 &&
      getComputedStyle(socialBarEl).opacity !== '0'
    );

    if (isHeaderSocial && !hasVisibleSocialBar) {
      hideTip();
      return;
    }

    if (isHeaderSocial || ((inHeader || isPageTitle) && hasVisibleSocialBar && !isLogo && !isLangBtn && !isBurger)) {
      tip.dataset.compact = '1';
    }

    /* предварительный рендер для замера размера */
    tip.style.visibility = 'hidden';
    tip.style.display = 'block';

    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const MARGIN = 8; /* базовый отступ от края вьюпорта */
    const GAP = 4; /* зазор между элементом и тултипом */

    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const headerH = getHeaderHeight();
    const tooltipGap = 12;

    /* --- выбор направления --- */
    let placement;

    if (isBurger || inMobileNav) {
      placement = 'right';
    } else if (isLangBtn) {
      placement = 'left';
    } else if (isHeaderSocial) {
      placement = 'top';
    } else if (inHeader || isPageTitle) {
      placement = 'bottom';
    } else {
      const spaceTop = rect.top - headerH;
      const spaceBottom = vh - rect.bottom;
      const spaceLeft = rect.left - MARGIN;
      const spaceRight = vw - rect.right - MARGIN;
      const needH = th + GAP;
      const needW = tw + GAP;
      const preferRight = elCX < vw / 2;

      if (preferRight && spaceRight >= needW) placement = 'right';
      else if (!preferRight && spaceLeft >= needW) placement = 'left';
      else if (spaceTop >= needH) placement = 'top';
      else if (spaceBottom >= needH) placement = 'bottom';
      else if (!preferRight && spaceRight >= needW) placement = 'right';
      else if (preferRight && spaceLeft >= needW) placement = 'left';
      else
        placement = [
          ['top', spaceTop],
          ['bottom', spaceBottom],
          ['right', spaceRight],
          ['left', spaceLeft],
        ].sort((a, b) => b[1] - a[1])[0][0];
    }

    /* --- viewport-координаты (position: fixed) --- */
    /* Global tooltip rule: show above the pointer first, then fall back only if required. */
    const topFirstSpace = rect.top - MARGIN;
    const bottomFallbackSpace = vh - rect.bottom - MARGIN;
    const leftFallbackSpace = rect.left - MARGIN;
    const rightFallbackSpace = vw - rect.right - MARGIN;
    const requiredVerticalSpace = th + tooltipGap;
    const requiredHorizontalSpace = tw + tooltipGap;

    if (topFirstSpace >= requiredVerticalSpace) {
      placement = 'top';
    } else if (bottomFallbackSpace >= requiredVerticalSpace) {
      placement = 'bottom';
    } else if (rightFallbackSpace >= requiredHorizontalSpace || leftFallbackSpace >= requiredHorizontalSpace) {
      placement = rightFallbackSpace >= leftFallbackSpace ? 'right' : 'left';
    }

    let finalLeft,
      finalTop,
      arrowOffset = 0;

    if (placement === 'top' || placement === 'bottom') {
      /* горизонтальное центрирование по элементу */
      finalLeft = elCX - tw / 2;
      finalLeft = Math.max(MARGIN, Math.min(finalLeft, vw - tw - MARGIN));

      /* смещение стрелки */
      const tipCX = finalLeft + tw / 2;
      const maxShift = tw / 2 - 12;
      arrowOffset = Math.max(-maxShift, Math.min(maxShift, elCX - tipCX));

      if (placement === 'top') {
        if (isHeaderSocial && hasVisibleSocialBar) {
          /* соцсети → над полосой доп меню */
          const stripeTop = socialBarEl.getBoundingClientRect().top;
          finalTop = stripeTop - th - tooltipGap;
        } else {
          finalTop = rect.top - th - tooltipGap;
        }
      } else if (isLogo && hasVisibleSocialBar) {
        /* логотип → тултип правее слова ГЛАВНАЯ в доп-меню */
        const socialHome = document.querySelector('.social-home');
        const anchorEl = socialHome || socialBarEl;
        const aRect = anchorEl.getBoundingClientRect();
        const iconsEl = document.querySelector('.social-icons') || socialBarEl;
        const iconsRect = iconsEl.getBoundingClientRect();
        finalLeft = aRect.right + 12;
        finalLeft = Math.max(MARGIN, Math.min(finalLeft, vw - tw - MARGIN));
        finalTop = iconsRect.top + iconsRect.height / 2 - th / 2;
        tip.dataset.noArrow = '1';
      } else if (isOnlineBtn && hasVisibleSocialBar) {
        /* онлайн-заказ → ниже, ровно между кнопкой и верхней полосой доп меню */
        const stripeTop = socialBarEl.getBoundingClientRect().top;
        const tooltipCenterY = (rect.bottom + stripeTop) / 2;
        finalTop = tooltipCenterY - th / 2;
      } else if ((inHeader || isPageTitle) && hasVisibleSocialBar) {
        /* элементы хедера → ровно между серединой кнопки и нижней полосой меню */
        const stripeCenterY = socialBarEl.getBoundingClientRect().top + 4;
        const tooltipCenterY = (elCY + stripeCenterY) / 2;
        finalTop = tooltipCenterY - th / 2;
      } else {
        finalTop = rect.bottom + tooltipGap;
      }
    } else {
      /* left / right — вертикально центрируем */
      finalTop = elCY - th / 2;
      finalTop = Math.max(MARGIN, Math.min(finalTop, vh - th - MARGIN));

      finalLeft = placement === 'right' ? rect.right + tooltipGap : rect.left - tw - tooltipGap;
    }

    /* применяем стрелочный сдвиг через CSS-переменную */
    if (placement === 'top' || placement === 'bottom') {
      finalTop = Math.max(MARGIN, Math.min(finalTop, vh - th - MARGIN));
    }

    tip.style.setProperty('--arrow-shift', arrowOffset + 'px');

    tip.style.visibility = '';
    tip.style.display = '';
    tip.style.left = finalLeft + 'px';
    tip.style.top = finalTop + 'px';

    if (placement === 'bottom') tip.classList.add('nika-tooltip--below');
    if (placement === 'left') tip.classList.add('nika-tooltip--left');
    if (placement === 'right') tip.classList.add('nika-tooltip--right');

    tip.classList.add('nika-tooltip--visible');
  }

  function hideTip() {
    tip.classList.remove('nika-tooltip--visible', 'nika-tooltip--below', 'nika-tooltip--left', 'nika-tooltip--right');
    delete tip.dataset.noArrow;
    delete tip.dataset.compact;
  }

  /* ---- назначить подсказку элементу ---- */
  function attach(el, text) {
    const tooltipText = normalizeTooltipText(text);
    if (!el || !tooltipText || el.dataset.nikaTooltip) return;
    el.dataset.nikaTooltip = tooltipText;

    if (el.hasAttribute('title')) {
      el.dataset.nikaNativeTitle = el.getAttribute('title') || '';
      el.removeAttribute('title');
    }

    /* лого и nav:index — фиксированная позиция справа от лого, уровень хедера */
    if (
      el.closest('.logo') ||
      (el.tagName === 'A' && /index\.html$|^\.\.\/$|^\.\/index/.test(el.getAttribute('href') || '')) ||
      el.dataset.nikaAnchor === 'logo-right'
    ) {
      el.dataset.nikaAnchor = 'logo-right';
    }

    el.addEventListener('mouseenter', () => showTip(tooltipText, el));
    el.addEventListener('mouseleave', () => {
      hideTimer = setTimeout(hideTip, 120);
    });
    el.addEventListener('focus', () => showTip(tooltipText, el));
    el.addEventListener('blur', hideTip);
    el.addEventListener('click', hideTip);
  }

  /* ---- определяем иконку соцсети ---- */
  function socialKey(el) {
    const i = el.querySelector('i');
    if (!i) return null;
    const cls = i.className;
    if (cls.includes('instagram')) return 'social:instagram';
    if (cls.includes('facebook')) return 'social:facebook';
    if (cls.includes('telegram')) return 'social:telegram';
    if (cls.includes('whatsapp')) return 'social:whatsapp';
    if (cls.includes('viber')) return 'social:viber';
    if (cls.includes('tiktok')) return 'social:tiktok';
    if (cls.includes('youtube')) return 'social:youtube';
    if (cls.includes('envelope')) return 'social:email';
    if (cls.includes('share-alt')) return 'social:share';
    if (cls.includes('phone')) return 'social:phone';
    return null;
  }

  /* ---- основной проход ---- */
  function scanAndAttach() {
    /* логотип */
    document.querySelectorAll('.logo a, .logo-img').forEach(el => attach(el, t['logo']));

    /* кнопка бургера */
    const burger = document.getElementById('burgerBtn');
    if (burger) attach(burger, t['btn:burger']);

    /* переключатель темы */
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) attach(themeBtn, t['btn:theme']);

    /* кнопка языка */
    document.querySelectorAll('.lang-dropdown-btn').forEach(el => attach(el, t['btn:lang']));

    /* кнопка онлайн-заказа */
    document.querySelectorAll('.header-online-btn').forEach(el => attach(el, t['btn:online']));

    /* Media library toggle and submenu services */
    document.querySelectorAll('.social-player-toggle').forEach(el => attach(el, mediaTooltip.mediaLibrary));
    document
      .querySelectorAll('.social-music-item[data-music-service="spotify"]')
      .forEach(el => attach(el, mediaTooltip.spotify));
    document
      .querySelectorAll('.social-music-item[data-music-service="apple"]')
      .forEach(el => attach(el, mediaTooltip.appleMusic));

    /* навигационные ссылки (десктоп + мобиль) */
    document.querySelectorAll('.nav-main a, #mobile-nav a').forEach(el => {
      const key = 'nav:' + routeKey(el.getAttribute('href'));
      const text = t[key] || t['btn:neon'];
      attach(el, text);
      /* nav:index — тот же якорь что и у логотипа */
      if (key === 'nav:index') el.dataset.nikaAnchor = 'logo-right';
    });

    /* ссылка домой в social bar */
    document.querySelectorAll('.social-home a').forEach(el => {
      const key = 'nav:' + routeKey(el.getAttribute('href'));
      attach(el, t[key] || t['nav:index']);
      el.dataset.nikaAnchor = 'logo-right';
    });

    /* кнопки btn-neon (hero, секции) — включая заголовки типа ГЛАВНАЯ */
    document.querySelectorAll('.btn-neon, .page-title, .breadcrumb a, h1').forEach(el => {
      if (el.dataset.nikaTooltip) return;
      const href = el.getAttribute('href') || '';
      const key = 'nav:' + routeKey(href);
      const text = t[key] || t['btn:neon'];
      attach(el, text);
      if (key === 'nav:index' || /index\.html$|^\.\.\/$/.test(href)) {
        el.dataset.nikaAnchor = 'logo-right';
      }
    });

    /* соцсети в хедере (.social-icon) */
    document.querySelectorAll('.social-icons .social-icon').forEach(el => {
      const key = socialKey(el);
      if (key) attach(el, t[key]);
    });

    /* соцсети в футере (.social-link) */
    document.querySelectorAll('.footer-socials .social-link').forEach(el => {
      const key = socialKey(el);
      if (key) attach(el, t[key] || t['footer:nav']);
    });

    /* карточки услуг */
    document.querySelectorAll('.service-card').forEach(el => attach(el, t['card:service']));

    /* акции */
    document.querySelectorAll('.promo-card').forEach(el => attach(el, t['card:promo']));

    /* фото галереи */
    document.querySelectorAll('.gallery-item').forEach(el => attach(el, t['img:gallery']));
    document.querySelectorAll('.gallery-item img').forEach(el => attach(el, t['img:gallery']));

    /* отзывы */
    document.querySelectorAll('.review-card').forEach(el => attach(el, t['card:review']));

    /* карточки соцсетей на social.html */
    document.querySelectorAll('.social-card').forEach(el => {
      const key = socialKey(el);
      attach(el, key ? t[key] : t['card:social']);
    });

    /* footer nav */
    document.querySelectorAll('.footer-nav a').forEach(el => {
      const key = 'nav:' + routeKey(el.getAttribute('href'));
      attach(el, t[key] || t['footer:nav']);
    });

    /* Не вешаем tooltip на все изображения по alt:
       это превращает alt-тексты в лишние визуальные сноски. */
  }

  /* ---- запуск: после рендера шапки из main.js ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      /* дать main.js время построить шапку */
      requestAnimationFrame(() => requestAnimationFrame(scanAndAttach));
    });
  } else {
    requestAnimationFrame(() => requestAnimationFrame(scanAndAttach));
  }

  /* пересканировать после динамических изменений (debounced — не на каждую мутацию) */
  let scanDebounceTimer = null;
  const scheduleScanAndAttach = () => {
    if (scanDebounceTimer) {
      window.clearTimeout(scanDebounceTimer);
    }
    scanDebounceTimer = window.setTimeout(() => {
      scanDebounceTimer = null;
      scanAndAttach();
    }, 180);
  };

  const observer = new MutationObserver(mutations => {
    const hasElementChanges = mutations.some(
      mutation => mutation.type === 'childList' && (mutation.addedNodes.length || mutation.removedNodes.length)
    );
    if (hasElementChanges) {
      scheduleScanAndAttach();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
