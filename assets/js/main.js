/*
 * Main interactive layer for the site.
 * Shared header, language navigation, and weather widget bootstrap live in site-shell.js.
 */
document.addEventListener('DOMContentLoaded', () => {
  const siteShell = window.SiteShell?.init?.() || {};
  const preloaderNotice = siteShell.preloaderNotice || {
    title: 'Sorry, the website is temporarily unavailable',
    body: 'Due to technical reasons, the website did not finish loading right now.',
    reload: 'Reload page',
  };
  const getThemeToggleLabel =
    siteShell.getThemeToggleLabel || (isLight => (isLight ? 'Switch to dark theme' : 'Switch to light theme'));
  const menuA11y = siteShell.menuA11y || {
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    expandGallery: 'Open gallery section',
    collapseGallery: 'Close gallery section',
  };
  siteShell.initLanguageDropdown?.();

  /* ========== PRELOADER ========== */
  const preloader = document.getElementById('preloader');
  if (preloader) {
    let preloaderIssueTimer = null;
    let preloaderDismissTimer = null;
    let preloaderRemoved = false;

    const dismissPreloader = () => {
      if (preloaderRemoved) return;

      preloaderRemoved = true;

      if (preloaderIssueTimer) {
        window.clearTimeout(preloaderIssueTimer);
      }

      if (preloaderDismissTimer) {
        window.clearTimeout(preloaderDismissTimer);
      }

      document.body.classList.add('site-loaded');
      preloader.style.opacity = '0';
      setTimeout(() => preloader.remove(), 350);
    };

    const dismissPreloaderSoon = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(dismissPreloader);
      });
    };

    const showPreloaderIssue = () => {
      if (document.body.classList.contains('site-loaded') || preloader.dataset.issueShown === 'true') return;
      preloader.dataset.issueShown = 'true';
      preloader.classList.add('preloader-has-message');

      const notice = document.createElement('div');
      notice.className = 'preloader-message';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      notice.innerHTML = `
                <strong>${preloaderNotice.title}</strong>
                <span>${preloaderNotice.body}</span>
                <button type="button" class="preloader-message-reload">${preloaderNotice.reload}</button>
            `;
      notice.querySelector('.preloader-message-reload')?.addEventListener('click', () => {
        window.location.reload();
      });
      preloader.appendChild(notice);
    };

    preloaderIssueTimer = window.setTimeout(showPreloaderIssue, 10000);

    const heroImage = document.querySelector('.hero-photo-img');
    if (heroImage?.complete) {
      dismissPreloaderSoon();
    } else if (heroImage) {
      heroImage.addEventListener('load', dismissPreloaderSoon, { once: true });
      heroImage.addEventListener('error', dismissPreloaderSoon, { once: true });
      preloaderDismissTimer = window.setTimeout(dismissPreloaderSoon, 1800);
    } else {
      preloaderDismissTimer = window.setTimeout(dismissPreloaderSoon, 600);
    }

    window.addEventListener('load', dismissPreloaderSoon, { once: true });
  } else {
    window.addEventListener('load', () => {
      document.body.classList.add('site-loaded');
    });
  }

  /* ========== THEME TOGGLE ========== */
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') document.body.classList.add('light');
    themeToggle.textContent = '';
    themeToggle.setAttribute('aria-label', getThemeToggleLabel(document.body.classList.contains('light')));

    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light');
      const isLight = document.body.classList.contains('light');
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
      themeToggle.textContent = '';
      themeToggle.setAttribute('aria-label', getThemeToggleLabel(isLight));
    });
  }

  const scrollRoot = (() => {
    const existing = document.querySelector('.site-scroll-root');
    if (existing) return existing;

    const root = document.createElement('div');
    root.className = 'site-scroll-root';

    const bodyChildren = Array.from(document.body.childNodes);
    bodyChildren.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') return;
      root.appendChild(node);
    });

    document.body.insertBefore(root, document.body.firstChild);
    return root;
  })();

  /* ========== BURGER MENU — PROFESSIONAL MOBILE PANEL ========== */
  const getByAnyId = (...ids) => ids.map(id => document.getElementById(id)).find(Boolean) || null;

  const burger = getByAnyId('burgerBtn', 'burger-btn');
  const mobileNav = getByAnyId('mobile-nav', 'mobile-nav');
  const overlay = getByAnyId('mobile-nav-overlay', 'mobile-nav-overlay');
  const mobileGalleryBtn = getByAnyId('mobileGalleryBtn', 'mobile-gallery-btn');
  const mobileGalleryMenu = getByAnyId('mobileGalleryMenu', 'mobile-gallery-menu');

  const createLiquidScrollbar = ({
    scrollTarget,
    thumbParent,
    thumbClass = '',
    viewportPadding = 0,
    minHeight = 72,
    minWidth = 72,
    axis = 'y',
  }) => {
    if (!scrollTarget || !thumbParent) return null;
    if (scrollTarget.dataset.customScrollbarBound === 'true') return null;
    scrollTarget.dataset.customScrollbarBound = 'true';

    const track = document.createElement('div');
    track.className = `custom-scrollbar-track ${thumbClass.replace('thumb', 'track')}`.trim();

    const thumb = document.createElement('div');
    thumb.className = `custom-scrollbar-thumb ${thumbClass}`.trim();
    track.appendChild(thumb);

    /* Read parent layout BEFORE inserting the track — otherwise the
           insertion triggers a forced reflow when we then call
           getComputedStyle. Reading first means the browser only does one
           layout pass per scrollbar instead of two. */
    if (thumbParent !== document.body) {
      const parentStyle = window.getComputedStyle(thumbParent);
      if (parentStyle.position === 'static') {
        thumbParent.style.position = 'relative';
      }
    }
    thumbParent.appendChild(track);

    let isDragging = false;
    let startPointer = 0;
    let startOffset = 0;
    let scrollAnimTimeout = null;
    let lastScrollOffset = axis === 'x' ? scrollTarget.scrollLeft : scrollTarget.scrollTop;

    const axisSize = axis === 'x' ? 'Width' : 'Height';
    const scrollKey = axis === 'x' ? 'scrollLeft' : 'scrollTop';
    const clientKey = axis === 'x' ? 'clientWidth' : 'clientHeight';
    const scrollSizeKey = axis === 'x' ? 'scrollWidth' : 'scrollHeight';
    const pointerKey = axis === 'x' ? 'clientX' : 'clientY';
    const offsetKey = axis === 'x' ? 'left' : 'top';
    const sizeStyleKey = axis === 'x' ? 'width' : 'height';
    const minThumbSize = axis === 'x' ? minWidth : minHeight;
    const scrollingForwardClass = axis === 'x' ? 'scrolling-forward' : 'scrolling-down';
    const scrollingBackwardClass = axis === 'x' ? 'scrolling-backward' : 'scrolling-up';

    const getMetrics = () => {
      return {
        scrollSize: scrollTarget[scrollSizeKey],
        clientSize: scrollTarget[clientKey],
        scrollOffset: scrollTarget[scrollKey],
        trackSize: Math.max(track[`client${axisSize}`] - viewportPadding * 2, 0),
        minTop: viewportPadding,
      };
    };

    const updateThumb = () => {
      const { scrollSize, clientSize, scrollOffset, trackSize, minTop } = getMetrics();
      const maxScroll = Math.max(scrollSize - clientSize, 0);

      if (maxScroll <= 0 || trackSize <= 0) {
        thumb.style.opacity = '0';
        return;
      }

      const thumbSize = Math.min(trackSize, Math.max(trackSize * (clientSize / scrollSize), minThumbSize));
      const maxOffset = Math.max(trackSize - thumbSize, 0);
      const offset = minTop + (maxScroll > 0 ? (scrollOffset / maxScroll) * maxOffset : 0);

      thumb.style[sizeStyleKey] = `${Math.round(thumbSize)}px`;
      thumb.style[offsetKey] = `${Math.round(offset)}px`;
      thumb.style.removeProperty('opacity');
    };

    const handleScroll = () => {
      const currentScrollOffset = scrollTarget[scrollKey];
      const directionClass = currentScrollOffset >= lastScrollOffset ? scrollingForwardClass : scrollingBackwardClass;

      updateThumb();
      thumb.classList.remove('scrolling-up', 'scrolling-down', 'scrolling-forward', 'scrolling-backward');
      thumb.classList.add('scrolling');
      thumb.classList.add(directionClass);
      if (scrollAnimTimeout) clearTimeout(scrollAnimTimeout);
      scrollAnimTimeout = setTimeout(() => {
        thumb.classList.remove(
          'scrolling',
          'scrolling-up',
          'scrolling-down',
          'scrolling-forward',
          'scrolling-backward'
        );
      }, 1100);
      lastScrollOffset = currentScrollOffset;
    };

    scrollTarget.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateThumb);
    window.addEventListener('load', updateThumb);

    thumb.addEventListener('mousedown', e => {
      isDragging = true;
      startPointer = e[pointerKey];
      startOffset = parseFloat(thumb.style[offsetKey]) || 0;
      document.body.classList.add('scrollbar-dragging');
      thumb.classList.add('active', 'dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;

      const { scrollSize, clientSize, trackSize, minTop } = getMetrics();
      const maxScroll = Math.max(scrollSize - clientSize, 0);
      const thumbSize = axis === 'x' ? thumb.offsetWidth : thumb.offsetHeight;
      const maxOffset = Math.max(trackSize - thumbSize, 0);

      if (maxScroll <= 0 || maxOffset <= 0) return;

      let nextOffset = startOffset + (e[pointerKey] - startPointer);
      nextOffset = Math.max(minTop, Math.min(minTop + maxOffset, nextOffset));

      const progress = (nextOffset - minTop) / maxOffset;

      thumb.classList.remove('scrolling-up', 'scrolling-down', 'scrolling-forward', 'scrolling-backward');
      thumb.classList.add(e[pointerKey] >= startPointer ? scrollingForwardClass : scrollingBackwardClass, 'scrolling');
      scrollTarget[scrollKey] = progress * maxScroll;
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.classList.remove('scrollbar-dragging');
      thumb.classList.remove(
        'active',
        'dragging',
        'scrolling-up',
        'scrolling-down',
        'scrolling-forward',
        'scrolling-backward',
        'scrolling'
      );
    });

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => updateThumb());
      resizeObserver.observe(scrollTarget);
      resizeObserver.observe(track);
    }

    if ('MutationObserver' in window) {
      const mutationObserver = new MutationObserver(() => updateThumb());
      mutationObserver.observe(scrollTarget, { childList: true, subtree: true, characterData: true });
    }

    updateThumb();

    return { updateThumb, thumb, track };
  };

  const pageScrollbar = createLiquidScrollbar({
    scrollTarget: scrollRoot,
    thumbParent: document.body,
    thumbClass: 'custom-scrollbar-thumb--page',
    viewportPadding: 12,
  });

  const mobileNavScrollbar = mobileNav
    ? createLiquidScrollbar({
        scrollTarget: mobileNav,
        thumbParent: mobileNav,
        thumbClass: 'custom-scrollbar-thumb--nav',
        viewportPadding: 0,
        minHeight: 36,
      })
    : null;

  Array.from(document.querySelectorAll('.service-list'))
    .map(panel =>
      createLiquidScrollbar({
        scrollTarget: panel,
        thumbParent: panel,
        thumbClass: 'custom-scrollbar-thumb--panel',
        viewportPadding: 10,
        minHeight: 34,
      })
    )
    .filter(Boolean);

  Array.from(document.querySelectorAll('.table-wrapper'))
    .map(panel =>
      createLiquidScrollbar({
        scrollTarget: panel,
        thumbParent: panel,
        thumbClass: 'custom-scrollbar-thumb--inline-x',
        viewportPadding: 12,
        minWidth: 72,
        axis: 'x',
      })
    )
    .filter(Boolean);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

  const normalizeWheelDelta = (event, delta) => {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 18;
    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * 120;
    return delta;
  };

  const enableInertialScroll = (
    scrollTarget,
    { axis = 'y', intensity = 0.92, easing = 0.14, threshold = 0.45, maxStep = axis === 'x' ? 220 : 280 } = {}
  ) => {
    if (!scrollTarget || prefersReducedMotion || !hasFinePointer) return;
    if (scrollTarget.dataset.inertialScrollBound === 'true') return;
    scrollTarget.dataset.inertialScrollBound = 'true';

    const scrollKey = axis === 'x' ? 'scrollLeft' : 'scrollTop';
    const scrollSizeKey = axis === 'x' ? 'scrollWidth' : 'scrollHeight';
    const clientSizeKey = axis === 'x' ? 'clientWidth' : 'clientHeight';

    let frameId = null;
    let targetOffset = scrollTarget[scrollKey];
    let currentOffset = scrollTarget[scrollKey];

    const getMaxOffset = () => Math.max(scrollTarget[scrollSizeKey] - scrollTarget[clientSizeKey], 0);
    const clampOffset = value => Math.max(0, Math.min(getMaxOffset(), value));

    const tick = () => {
      currentOffset += (targetOffset - currentOffset) * easing;

      if (Math.abs(targetOffset - currentOffset) <= threshold) {
        currentOffset = targetOffset;
        scrollTarget[scrollKey] = Math.round(currentOffset);
        frameId = null;
        return;
      }

      scrollTarget[scrollKey] = Math.round(currentOffset);
      frameId = window.requestAnimationFrame(tick);
    };

    const startAnimation = () => {
      if (frameId !== null) return;
      currentOffset = scrollTarget[scrollKey];
      frameId = window.requestAnimationFrame(tick);
    };

    scrollTarget.addEventListener(
      'wheel',
      event => {
        if (event.ctrlKey || event.metaKey) return;
        if (
          event.target instanceof Element &&
          event.target.closest('input, textarea, select, [contenteditable="true"]')
        )
          return;

        const rawDelta =
          axis === 'x'
            ? Math.abs(event.deltaX) > 0.01
              ? event.deltaX
              : event.shiftKey
                ? event.deltaY
                : 0
            : event.deltaY;

        if (Math.abs(rawDelta) < 0.01) return;

        const maxOffset = getMaxOffset();
        if (maxOffset <= 0) return;

        const normalizedDelta = normalizeWheelDelta(event, rawDelta);
        const boundedStep = Math.max(-maxStep, Math.min(maxStep, normalizedDelta * intensity));
        const nextTarget = clampOffset(targetOffset + boundedStep);

        const atStart = scrollTarget[scrollKey] <= 0 && boundedStep < 0;
        const atEnd = scrollTarget[scrollKey] >= maxOffset && boundedStep > 0;

        if (nextTarget === targetOffset && (atStart || atEnd)) return;

        event.preventDefault();
        targetOffset = nextTarget;
        startAnimation();
      },
      { passive: false }
    );

    scrollTarget.addEventListener(
      'scroll',
      () => {
        if (frameId !== null) return;
        currentOffset = scrollTarget[scrollKey];
        targetOffset = currentOffset;
      },
      { passive: true }
    );
  };

  enableInertialScroll(scrollRoot, { axis: 'y', intensity: 0.94, easing: 0.12, maxStep: 300 });
  enableInertialScroll(mobileNav, { axis: 'y', intensity: 0.9, easing: 0.16, maxStep: 220 });
  document.querySelectorAll('.service-list').forEach(panel => {
    enableInertialScroll(panel, { axis: 'y', intensity: 0.88, easing: 0.17, maxStep: 180 });
  });
  document.querySelectorAll('.table-wrapper').forEach(panel => {
    enableInertialScroll(panel, { axis: 'x', intensity: 0.9, easing: 0.18, maxStep: 210 });
  });

  const getVisibleHeaderBottom = () => {
    const header = document.querySelector('header.header');
    if (!header) return 0;

    const headerStyle = window.getComputedStyle(header);
    const headerRect = header.getBoundingClientRect();
    const headerVisible =
      headerRect.height > 0 &&
      headerRect.bottom > 0 &&
      headerStyle.display !== 'none' &&
      headerStyle.visibility !== 'hidden' &&
      parseFloat(headerStyle.opacity || '1') > 0.02;

    if (!headerVisible) return 0;

    const topRow = header.querySelector('.top-row');
    let visibleBottom = Math.max(0, headerRect.top);

    if (topRow) {
      const topRowRect = topRow.getBoundingClientRect();
      const topRowStyle = window.getComputedStyle(topRow);
      const topRowVisible =
        topRowRect.height > 0 &&
        topRowRect.bottom > 0 &&
        topRowStyle.display !== 'none' &&
        topRowStyle.visibility !== 'hidden' &&
        parseFloat(topRowStyle.opacity || '1') > 0.02;

      if (topRowVisible) {
        visibleBottom = Math.max(visibleBottom, topRowRect.bottom);
      }
    }

    const socialVisible = header.querySelector('.social-bar.show-social');

    if (socialVisible) {
      const rect = socialVisible.getBoundingClientRect();
      const style = window.getComputedStyle(socialVisible);
      const isVisible =
        rect.height > 0 &&
        rect.bottom > 0 &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity || '1') > 0.02;

      if (isVisible) {
        visibleBottom = Math.max(visibleBottom, rect.bottom);
      }
    }

    if (visibleBottom <= Math.max(0, headerRect.top)) {
      visibleBottom = Math.max(0, headerRect.bottom);
    }

    return Math.min(window.innerHeight, Math.round(visibleBottom));
  };

  const syncContentTopOffsets = () => {
    const headerBottom = getVisibleHeaderBottom();
    if (headerBottom <= 0) return;

    const rootStyle = document.documentElement.style;
    const rootComputed = window.getComputedStyle(document.documentElement);
    const sectionBaseOffset = parseFloat(rootComputed.getPropertyValue('--section-top-offset-base')) || 0;
    const heroBaseOffset = parseFloat(rootComputed.getPropertyValue('--hero-top-offset-base')) || 0;
    const sectionPaddingTop =
      parseFloat(window.getComputedStyle(document.querySelector('.section') || document.body).paddingTop) || 0;
    const heroPaddingTop =
      parseFloat(window.getComputedStyle(document.querySelector('.hero') || document.body).paddingTop) || 0;
    const isPhoneViewport = window.innerWidth <= 600;
    const isMobileViewport = window.innerWidth <= 899;
    const sectionBuffer = isPhoneViewport ? 12 : isMobileViewport ? 16 : 24;
    const heroBuffer = isPhoneViewport ? 6 : isMobileViewport ? 10 : 24;

    const sectionOffset = Math.max(sectionBaseOffset, Math.ceil(headerBottom + sectionBuffer - sectionPaddingTop));
    const heroOffset = Math.max(heroBaseOffset, Math.ceil(headerBottom + heroBuffer - heroPaddingTop));

    rootStyle.setProperty('--section-top-offset-dynamic', `${sectionOffset}px`);
    rootStyle.setProperty('--hero-top-offset-dynamic', `${heroOffset}px`);
  };

  const updatePageScrollbarOffset = () => {
    syncContentTopOffsets();

    if (!pageScrollbar?.track) return;

    const baseTop = 14;
    const baseBottom = 14;
    const footer = document.querySelector('footer.footer');
    let nextTop = baseTop;
    let nextBottom = baseBottom;

    const visibleBottom = getVisibleHeaderBottom();
    if (visibleBottom > 0) {
      nextTop = Math.max(baseTop, Math.round(visibleBottom + 10));
    }

    if (footer) {
      const rect = footer.getBoundingClientRect();
      const isVisible = rect.top < window.innerHeight && rect.height > 0;

      if (isVisible) {
        nextBottom = Math.max(baseBottom, Math.round(window.innerHeight - rect.top + 8));
      }
    }

    pageScrollbar.track.style.top = `${nextTop}px`;
    pageScrollbar.track.style.bottom = `${nextBottom}px`;
    pageScrollbar.updateThumb();
  };

  window.addEventListener('resize', updatePageScrollbarOffset);
  window.addEventListener('load', updatePageScrollbarOffset);
  updatePageScrollbarOffset();

  if (burger && mobileNav && overlay) {
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    let lastFocusedElement = null;
    const refreshMobileNavScrollbar = () => {
      if (!mobileNavScrollbar) return;
      requestAnimationFrame(() => {
        mobileNavScrollbar.updateThumb();
        requestAnimationFrame(() => mobileNavScrollbar.updateThumb());
      });
    };

    const syncMobileNavLayout = () => {
      const headerBottom = Math.min(window.innerHeight, Math.max(0, Math.round(getVisibleHeaderBottom())));
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const availableHeight = Math.max(viewportHeight - headerBottom - 16, 0);
      mobileNav.style.setProperty('--mobile-nav-offset', `${headerBottom + 8}px`);
      mobileNav.style.setProperty('--mobile-nav-height', `${availableHeight}px`);
      refreshMobileNavScrollbar();
    };

    const setGalleryMenuState = isOpen => {
      if (!mobileGalleryBtn || !mobileGalleryMenu) return;
      mobileGalleryBtn.classList.toggle('is-open', isOpen);
      mobileGalleryBtn.setAttribute('aria-expanded', String(isOpen));
      mobileGalleryBtn.setAttribute('aria-label', isOpen ? menuA11y.collapseGallery : menuA11y.expandGallery);
      mobileGalleryMenu.classList.toggle('open', isOpen);
      refreshMobileNavScrollbar();
    };

    const setMenuState = (isOpen, { restoreFocus = true } = {}) => {
      syncMobileNavLayout();

      burger.classList.toggle('active', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.setAttribute('aria-label', isOpen ? menuA11y.closeMenu : menuA11y.openMenu);

      mobileNav.classList.toggle('active', isOpen);
      mobileNav.setAttribute('aria-hidden', String(!isOpen));

      overlay.classList.toggle('active', isOpen);
      overlay.hidden = !isOpen;

      if (isOpen) {
        const scrollY = scrollRoot.scrollTop;
        document.body.classList.add('nav-open');
        document.body.style.top = `-${scrollY}px`;
        document.body.dataset.scrollY = scrollY;
      } else {
        const savedY = parseInt(document.body.dataset.scrollY || '0', 10);
        document.body.classList.remove('nav-open');
        document.body.style.top = '';
        scrollRoot.scrollTop = savedY;
      }

      if ('inert' in mobileNav) {
        mobileNav.inert = !isOpen;
      }

      if (isOpen) {
        lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        refreshMobileNavScrollbar();
        requestAnimationFrame(() => {
          mobileNav.querySelector(focusableSelector)?.focus({ preventScroll: true });
        });
      } else {
        setGalleryMenuState(false);
        if (restoreFocus) {
          lastFocusedElement?.focus({ preventScroll: true });
        }
      }
    };

    const isMenuOpen = () => mobileNav.classList.contains('active');
    const closeMenu = options => setMenuState(false, options);
    const toggleMenu = () => setMenuState(!isMenuOpen());

    if ('inert' in mobileNav) {
      mobileNav.inert = true;
    }
    syncMobileNavLayout();
    setGalleryMenuState(false);
    refreshMobileNavScrollbar();

    burger.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', () => closeMenu());
    mobileNav.addEventListener('transitionend', refreshMobileNavScrollbar);

    document.addEventListener('keydown', event => {
      if (!isMenuOpen()) return;

      if (event.key === 'Escape') {
        closeMenu();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(mobileNav.querySelectorAll(focusableSelector)).filter(
        element => !element.hasAttribute('disabled') && element.getClientRects().length > 0
      );

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    });

    window.addEventListener('resize', () => {
      syncMobileNavLayout();
      if (window.innerWidth <= 900) {
        document.body.classList.remove('hide-header');
      }
      if (window.innerWidth > 900 && isMenuOpen()) {
        closeMenu({ restoreFocus: false });
      }
    });

    const handleHeaderWeatherLayout = () => {
      syncMobileNavLayout();
      refreshMobileNavScrollbar();
    };

    window.addEventListener('site-shell:weather-ready', handleHeaderWeatherLayout);
    window.addEventListener('site-shell:weather-toggle', handleHeaderWeatherLayout);

    if (window.ResizeObserver) {
      const headerResizeObserver = new ResizeObserver(() => {
        handleHeaderWeatherLayout();
      });

      const header = document.querySelector('header.header');
      if (header) {
        headerResizeObserver.observe(header);
      }
    }

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => closeMenu({ restoreFocus: false }));
    });

    if (mobileGalleryBtn && mobileGalleryMenu) {
      mobileGalleryBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        setGalleryMenuState(!mobileGalleryMenu.classList.contains('open'));
      });

      mobileGalleryMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          setGalleryMenuState(false);
          refreshMobileNavScrollbar();
        });
      });
    }
  }

  /* ========== HEADER SCROLL + SOCIAL BAR + HERO PARALLAX ========== */
  const pageHeader = document.querySelector('header.header');
  const pageTopRow = pageHeader?.querySelector('.top-row');
  const socialBar = document.querySelector('.social-bar');
  const socialPlayerToggle = document.querySelector('.social-player-toggle');
  const socialMusicMenu = document.getElementById('social-music-menu');
  const socialSpotifyPanel = document.getElementById('social-spotify-panel');
  const socialApplePanel = document.getElementById('social-apple-panel');
  const allMusicPanels = [socialSpotifyPanel, socialApplePanel].filter(Boolean);
  const socialIconsToggle = document.querySelector('.social-icons-toggle');
  const socialIconsList = document.getElementById('social-icons-list');
  const socialServicePicker = document.getElementById('social-service-picker');
  const hero = document.querySelector('.hero');

  let activeMusicPanel = null;

  /* Panel is positioned via CSS (position:absolute inside .social-player-wrap,
       slides to the right). JS positioning is no longer needed. */
  const positionPanel = panel => {
    if (!panel) return;
    // Clear any stale inline styles from previous builds
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');
    panel.style.removeProperty('--spotify-origin-x');
  };

  const closeAllMusicUI = () => {
    if (socialPlayerToggle) {
      socialPlayerToggle.classList.remove('is-open');
      socialPlayerToggle.setAttribute('aria-expanded', 'false');
    }
    if (socialServicePicker) {
      socialServicePicker.classList.remove('is-open');
      socialServicePicker.hidden = true;
      socialServicePicker.setAttribute('aria-hidden', 'true');
    }
    if (socialMusicMenu) {
      socialMusicMenu.classList.remove('is-open');
      socialMusicMenu.hidden = true;
      socialMusicMenu.setAttribute('aria-hidden', 'true');
    }
    allMusicPanels.forEach(p => {
      p.classList.remove('is-open');
      p.hidden = true;
      p.setAttribute('aria-hidden', 'true');
      p.style.removeProperty('left');
      p.style.removeProperty('top');
      p.style.removeProperty('--spotify-origin-x');
    });
    activeMusicPanel = null;
    document.body.dataset.spotifyPanelOpen = 'false';
  };

  /* Lazily set iframe src only on first open to avoid loading Spotify/Apple
       Music until the user actually opens a panel. This prevents their heavy
       Next.js bundles and Sentry telemetry from polluting the console and
       speeds up initial page load. */
  const activateLazyIframe = panel => {
    if (!panel) return;
    const iframe = panel.querySelector('iframe[data-lazy-src]');
    if (iframe && !iframe.getAttribute('src')) {
      iframe.setAttribute('src', iframe.dataset.lazySrc);
    }
  };

  const openServicePanel = panel => {
    if (!panel) return;
    if (socialMusicMenu) {
      socialMusicMenu.classList.remove('is-open');
      socialMusicMenu.hidden = true;
      socialMusicMenu.setAttribute('aria-hidden', 'true');
    }
    allMusicPanels.forEach(p => {
      if (p !== panel) {
        p.classList.remove('is-open');
        p.hidden = true;
        p.setAttribute('aria-hidden', 'true');
      }
    });
    activeMusicPanel = panel;
    panel.hidden = false;
    panel.setAttribute('aria-hidden', 'false');
    activateLazyIframe(panel);
    positionPanel(panel);
    requestAnimationFrame(() => {
      panel.classList.add('is-open');
      positionPanel(panel);
    });
    document.body.dataset.spotifyPanelOpen = 'true';
  };

  if (socialPlayerToggle) {
    closeAllMusicUI();

    socialPlayerToggle.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const pickerOpen = socialServicePicker?.classList.contains('is-open');
      const panelOpen = activeMusicPanel?.classList.contains('is-open');
      if (pickerOpen || panelOpen) {
        closeAllMusicUI();
      } else if (socialServicePicker) {
        socialServicePicker.hidden = false;
        socialServicePicker.setAttribute('aria-hidden', 'false');
        socialPlayerToggle.setAttribute('aria-expanded', 'true');
        socialPlayerToggle.classList.add('is-open');
        requestAnimationFrame(() => socialServicePicker.classList.add('is-open'));
      } else {
        openServicePanel(socialSpotifyPanel);
      }
    });

    document.querySelectorAll('.social-service-btn').forEach(btn => {
      btn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const panelId = btn.dataset.panel;
        const panel = document.getElementById(panelId);
        if (socialServicePicker) {
          socialServicePicker.classList.remove('is-open');
          socialServicePicker.hidden = true;
          socialServicePicker.setAttribute('aria-hidden', 'true');
        }
        socialPlayerToggle.classList.remove('is-open');
        openServicePanel(panel);
      });
    });

    document.addEventListener('click', event => {
      const pickerOpen = socialServicePicker?.classList.contains('is-open');
      const panelOpen = activeMusicPanel?.classList.contains('is-open');
      if (!pickerOpen && !panelOpen) return;
      if (socialPlayerToggle.contains(event.target)) return;
      if (socialServicePicker?.contains(event.target)) return;
      if (activeMusicPanel?.contains(event.target)) return;
      closeAllMusicUI();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeAllMusicUI();
      }
    });

    window.addEventListener('resize', () => {
      if (activeMusicPanel && activeMusicPanel.classList.contains('is-open')) {
        positionPanel(activeMusicPanel);
      }
    });
  }

  /* ── Social icons toggle: выкат влево ── */
  if (socialIconsToggle && socialIconsList) {
    const closeSocialIcons = () => {
      socialIconsToggle.setAttribute('aria-expanded', 'false');
      socialIconsToggle.classList.remove('is-open');
      socialIconsList.hidden = true;
      socialIconsList.setAttribute('aria-hidden', 'true');
      socialIconsList.classList.remove('is-open');
    };

    socialIconsToggle.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = socialIconsList.classList.contains('is-open');
      if (isOpen) {
        closeSocialIcons();
      } else {
        socialIconsToggle.setAttribute('aria-expanded', 'true');
        socialIconsToggle.classList.add('is-open');
        socialIconsList.hidden = false;
        socialIconsList.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => {
          socialIconsList.classList.add('is-open');
        });
      }
    });

    document.addEventListener('click', event => {
      if (!socialIconsList.classList.contains('is-open')) return;
      if (socialIconsToggle.contains(event.target)) return;
      if (socialIconsList.contains(event.target)) return;
      closeSocialIcons();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeSocialIcons();
    });
  }

  [pageHeader, pageTopRow, socialBar].filter(Boolean).forEach(element => {
    element.addEventListener('transitionend', () => {
      updatePageScrollbarOffset();
      if (activeMusicPanel?.classList.contains('is-open')) {
        positionPanel(activeMusicPanel);
      }
    });
  });

  const syncHeaderAdaptiveLayout = () => {
    updatePageScrollbarOffset();
    if (activeMusicPanel?.classList.contains('is-open')) {
      positionPanel(activeMusicPanel);
    }
  };

  window.addEventListener('site-shell:weather-ready', syncHeaderAdaptiveLayout);
  window.addEventListener('site-shell:weather-toggle', syncHeaderAdaptiveLayout);

  if (window.ResizeObserver && pageHeader) {
    const adaptiveHeaderObserver = new ResizeObserver(() => {
      syncHeaderAdaptiveLayout();
    });

    adaptiveHeaderObserver.observe(pageHeader);
    if (pageTopRow) {
      adaptiveHeaderObserver.observe(pageTopRow);
    }
  }

  let lastScroll = scrollRoot.scrollTop;
  let ticking = false;

  const handleScroll = () => {
    const current = scrollRoot.scrollTop;
    const delta = current - lastScroll;
    const shouldAutoHideHeader = window.innerWidth > 900 && !document.body.classList.contains('nav-open');

    /* Hide header on scroll down only on desktop and after meaningful movement */
    if (!shouldAutoHideHeader || current <= 24) {
      document.body.classList.remove('hide-header');
    } else if (delta > 10 && current > 160) {
      document.body.classList.add('hide-header');
    } else if (delta < -10 || current < 96) {
      document.body.classList.remove('hide-header');
    }

    /* Social bar only at very top. Spotify-panel state is managed by site-shell.js. */
    if (current < 24) {
      socialBar?.classList.add('show-social');
      pageHeader?.classList.add('header-social-visible');
    } else {
      socialBar?.classList.remove('show-social');
      pageHeader?.classList.remove('header-social-visible');
    }

    /* Hero parallax */
    if (hero) {
      const offset = Math.min(current * 0.15, 80);
      hero.style.transform = `translateY(${offset}px)`;
      hero.style.filter = 'none';
    }

    updatePageScrollbarOffset();

    lastScroll = current;
    ticking = false;
  };

  scrollRoot.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
      }
    },
    { passive: true }
  );

  handleScroll();

  /* ========== GEM ROTATION ON SCROLL ==========
       Rotates the emerald facet angles as the user scrolls — mimics
       turning a cut gemstone in the hand. Each facet has a unique
       rotation multiplier so they move independently (natural stone feel).
       Uses a spring/lerp so motion is smooth and has inertia. */
  (function initGemRotation() {
    const BASE = { a1: 122, a2: 158, a3: 98, a4: 38, a5: 178, base: 132 };
    /* How many degrees each facet rotates per 1000px of scroll.
           Odd multipliers keep facets desynchronised — more natural. */
    const MULT = { a1: 18, a2: 13, a3: 22, a4: 15, a5: 9, base: 7 };
    const MAX_OFFSET = 28; /* max ± degrees from base */

    let currentOffset = 0; /* smoothed scroll-driven angle offset */
    let targetOffset = 0;
    let lastY = scrollRoot.scrollTop;
    let rafId = null;

    const lerp = (a, b, t) => a + (b - a) * t;

    const tick = () => {
      currentOffset = lerp(currentOffset, targetOffset, 0.06);

      /* Snap to rest when close enough — avoid infinite RAF loop */
      if (Math.abs(currentOffset - targetOffset) < 0.01) {
        currentOffset = targetOffset;
        rafId = null;
        applyAngles();
        return;
      }

      applyAngles();
      rafId = requestAnimationFrame(tick);
    };

    const applyAngles = () => {
      const s = document.documentElement.style;
      s.setProperty('--gem-a1', (BASE.a1 + (currentOffset * MULT.a1) / 10).toFixed(2) + 'deg');
      s.setProperty('--gem-a2', (BASE.a2 + (currentOffset * MULT.a2) / 10).toFixed(2) + 'deg');
      s.setProperty('--gem-a3', (BASE.a3 - (currentOffset * MULT.a3) / 10).toFixed(2) + 'deg');
      s.setProperty('--gem-a4', (BASE.a4 + (currentOffset * MULT.a4) / 10).toFixed(2) + 'deg');
      s.setProperty('--gem-a5', (BASE.a5 - (currentOffset * MULT.a5) / 10).toFixed(2) + 'deg');
      s.setProperty('--gem-base', (BASE.base + (currentOffset * MULT.base) / 10).toFixed(2) + 'deg');
    };

    scrollRoot.addEventListener(
      'scroll',
      () => {
        const y = scrollRoot.scrollTop;
        const delta = y - lastY;
        lastY = y;

        /* Accumulate direction; clamp to ±MAX_OFFSET */
        targetOffset = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, targetOffset + delta * 0.012));

        /* Slowly drift back to 0 when user is not scrolling —
               simulates letting go of the stone */
        targetOffset *= 0.98;

        if (!rafId) rafId = requestAnimationFrame(tick);
      },
      { passive: true }
    );
  })();

  /* Language dropdown is already initialized near the top of DOMContentLoaded
       (see siteShell.initLanguageDropdown?.() call after the siteShell init).
       Do not call it again here — the duplicate call was a no-op but produced
       noisy console logs. */

  /* ========== SCROLL REVEAL ========== */
  const reveals = document.querySelectorAll('.reveal');
  const revealVisibleContent = () => {
    reveals.forEach(el => {
      const rect = el.getBoundingClientRect();
      const isNearViewport = rect.top < window.innerHeight + 120 && rect.bottom > -120;
      if (isNearViewport) {
        el.classList.add('active');
      }
    });
  };

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, root: scrollRoot }
    );

    reveals.forEach(el => revealObserver.observe(el));
    window.setTimeout(revealVisibleContent, 700);
  } else {
    reveals.forEach(el => el.classList.add('active'));
  }

  /* ========== CURSOR GLOW ==========
       Simple, natural circular halo that follows the cursor with a gentle
       trailing motion. The halo is centred on the cursor — no rotation,
       no tear-drop shape. CSS handles the visual; JS only animates the
       position. */
  const cursorGlow = document.createElement('div');
  cursorGlow.className = 'cursor-glow is-idle';
  document.body.appendChild(cursorGlow);

  let cursorGlowX = window.innerWidth * 0.5;
  let cursorGlowY = window.innerHeight * 0.5;
  let cursorGlowTargetX = cursorGlowX;
  let cursorGlowTargetY = cursorGlowY;
  let cursorGlowVelocityX = 0;
  let cursorGlowVelocityY = 0;

  const renderCursorGlow = () => {
    const dx = cursorGlowTargetX - cursorGlowX;
    const dy = cursorGlowTargetY - cursorGlowY;

    /* Gentle spring follow — not too snappy, not too laggy. */
    cursorGlowVelocityX = (cursorGlowVelocityX + dx * 0.03) * 0.84;
    cursorGlowVelocityY = (cursorGlowVelocityY + dy * 0.03) * 0.84;
    cursorGlowX += cursorGlowVelocityX;
    cursorGlowY += cursorGlowVelocityY;

    /* CSS centres the halo via negative margin, so we just translate to
           the raw cursor coordinates — no rotation, no offset hacks. */
    cursorGlow.style.transform = `translate(${cursorGlowX}px, ${cursorGlowY}px)`;
    window.requestAnimationFrame(renderCursorGlow);
  };

  window.requestAnimationFrame(renderCursorGlow);

  document.addEventListener(
    'mousemove',
    e => {
      cursorGlowTargetX = e.clientX;
      cursorGlowTargetY = e.clientY;
      cursorGlow.classList.remove('is-idle');
      cursorGlow.classList.add('is-active');
    },
    { passive: true }
  );

  document.addEventListener('mouseout', e => {
    if (!e.relatedTarget) {
      cursorGlow.classList.remove('is-active');
      cursorGlow.classList.add('is-idle');
    }
  });

  window.addEventListener('blur', () => {
    cursorGlow.classList.remove('is-active');
    cursorGlow.classList.add('is-idle');
  });

  /* ========== 3D TILT + GLOW FOR ALL TILES ========== */
  const tiltCards = document.querySelectorAll(
    '.service-card, .promo-card, .review-card, .gallery-item, .social-card, .news-card, .winner-card'
  );
  const TILT_MAX = 12;

  tiltCards.forEach(card => {
    let raf = null;

    card.addEventListener('mousemove', e => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const px = cx / rect.width;
        const py = cy / rect.height;
        const ry = (px - 0.5) * TILT_MAX;
        const rx = (0.5 - py) * TILT_MAX;
        card.style.setProperty('--rx', `${rx.toFixed(2)}deg`);
        card.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
        card.style.setProperty('--glow-x', `${(px * 100).toFixed(1)}%`);
        card.style.setProperty('--glow-y', `${(py * 100).toFixed(1)}%`);
        raf = null;
      });
    });

    card.addEventListener('mouseleave', () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
      }
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  /* ========== SVG TURBULENCE FILTER FOR PLASMA ========== */
  if (!document.getElementById('plasma-filters')) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('id', 'plasma-filters');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML =
      '<defs>' +
      '<filter id="plasma-warp" x="-20%" y="-20%" width="140%" height="140%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.015 0.02" numOctaves="3" seed="2" result="noise">' +
      '<animate attributeName="seed" values="1;2;3;4;5;6;7;8;9;10;11;12;1" dur="18s" calcMode="linear" repeatCount="indefinite"/>' +
      '<animate attributeName="baseFrequency" values="0.015 0.02;0.018 0.024;0.013 0.018;0.016 0.022;0.015 0.02" dur="14s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite"/>' +
      '</feTurbulence>' +
      '<feDisplacementMap in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G">' +
      '<animate attributeName="scale" values="28;34;24;32;28" dur="12s" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1" repeatCount="indefinite"/>' +
      '</feDisplacementMap>' +
      '</filter>' +
      '</defs>';
    document.body.appendChild(svg);
  }

  /* ========== ANIMATED TOUCH POINTS FOR PLASMA ========== */
  /* Проекция точки курсора на ближайший край пилюли (непрерывно, без дискретных точек) */
  function projectToEdge(mx, my) {
    /* Центр пилюли */
    const cx = 50,
      cy = 50;
    const dx = mx - cx,
      dy = my - cy;
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return [50, 0];
    /* Горизонтальный эллипс: полуось X ~48, полуось Y ~46 (скруглённая пилюля) */
    const ax = 48,
      ay = 46;
    const angle = Math.atan2(dy / ay, dx / ax);
    return [cx + ax * Math.cos(angle), cy + ay * Math.sin(angle)];
  }

  /* Позиции для автономных блуждающих точек */
  const edgePositions = [
    [20, 2],
    [35, 0],
    [50, 1],
    [65, 0],
    [80, 2],
    [95, 12],
    [98, 30],
    [99, 50],
    [98, 70],
    [95, 88],
    [80, 98],
    [65, 100],
    [50, 99],
    [35, 100],
    [20, 98],
    [5, 88],
    [2, 70],
    [1, 50],
    [2, 30],
    [5, 12],
  ];

  function animateTouchPoint(el) {
    /* Состояние одной точки */
    el._cx = 50;
    el._cy = 50; /* текущая позиция */
    el._tx = 50;
    el._ty = 50; /* целевая */
    el._sz = 16;
    el._tsz = 16; /* размер */
    el._op = 0;
    el._top = 0.25; /* непрозрачность */
    el._spd = 0.02 + Math.random() * 0.03; /* скорость lerp */
    el._timer = 0;
    el._nextMove = 0;
  }

  /* ЕДИНЫЙ rAF цикл для ВСЕХ точек — максимально плавно */
  const allTouchPoints = [];
  let touchRaf = 0;
  const now = () => performance.now();

  function tickTouches(ts) {
    for (let i = 0; i < allTouchPoints.length; i++) {
      const el = allTouchPoints[i];
      if (!el._active) continue;

      /* Хаотическая смена цели — непрерывно, без задержек */
      if (ts >= el._nextMove) {
        const pos = edgePositions[Math.floor(Math.random() * edgePositions.length)];
        el._tx = pos[0];
        el._ty = pos[1];
        el._tsz = 10 + Math.random() * 22;
        el._top = 0.12 + Math.random() * 0.38;
        el._spd = 0.015 + Math.random() * 0.04;
        el._nextMove = ts + 1200 + Math.random() * 3500;
      }

      /* Lerp — непрерывная интерполяция */
      const s = el._spd;
      el._cx += (el._tx - el._cx) * s;
      el._cy += (el._ty - el._cy) * s;
      el._sz += (el._tsz - el._sz) * 0.03;

      el.style.left = el._cx.toFixed(1) + '%';
      el.style.top = el._cy.toFixed(1) + '%';
      el.style.width = el.style.height = el._sz.toFixed(1) + 'px';

      /* Opacity: курсорные лапки управляются CSS-классом, остальные — lerp */
      if (!el._isCursor) {
        el._op += (el._top - el._op) * 0.04;
        el.style.opacity = el._op.toFixed(3);
      }
    }

    touchRaf = requestAnimationFrame(tickTouches);
  }

  function startTouchLoop() {
    if (!touchRaf) touchRaf = requestAnimationFrame(tickTouches);
  }

  /* ========== NAV CLICK — PLASMA EFFECT + DELAY NAVIGATION ========== */
  document.querySelectorAll('.nav-main > a, .nav-main > .dropdown > a').forEach(link => {
    if (link.classList.contains('active') || link.getAttribute('aria-current') === 'page') {
      const activePlasma = document.createElement('span');
      activePlasma.className = 'nav-plasma--active';
      link.appendChild(activePlasma);

      const wanderers = [];
      for (let i = 0; i < 3; i++) {
        const tp = document.createElement('span');
        tp.className = 'nav-plasma-touch';
        activePlasma.appendChild(tp);
        animateTouchPoint(tp);
        tp._active = true;
        const p = edgePositions[Math.floor(Math.random() * edgePositions.length)];
        tp._cx = p[0];
        tp._cy = p[1];
        tp._tx = p[0];
        tp._ty = p[1];
        tp._nextMove = now() + i * 600 + Math.random() * 1500;
        allTouchPoints.push(tp);
        wanderers.push(tp);
      }

      const cursorTips = [];
      for (let i = 0; i < 3; i++) {
        const ct = document.createElement('span');
        ct.className = 'nav-plasma-touch nav-plasma-touch--cursor';
        activePlasma.appendChild(ct);
        animateTouchPoint(ct);
        ct._active = false;
        ct._isCursor = true;
        ct._cx = 50;
        ct._cy = 50;
        allTouchPoints.push(ct);
        cursorTips.push(ct);
      }

      startTouchLoop();

      let activeCursorTips = [];

      link.addEventListener('mouseenter', e => {
        cursorTips.forEach(ct => {
          ct._active = false;
          ct.classList.remove('active');
        });
        const count = 1 + Math.floor(Math.random() * 3);
        const shuffled = cursorTips.slice().sort(() => Math.random() - 0.5);
        activeCursorTips = shuffled.slice(0, count);
        activeCursorTips.forEach((ct, i) => {
          ct._angleOffset = (i - Math.floor(count / 2)) * (0.18 + Math.random() * 0.12);
          ct._active = true;
          ct.classList.add('active');
          ct._tsz = 18 + Math.random() * 12;
        });
        const rect = link.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * 100;
        const my = ((e.clientY - rect.top) / rect.height) * 100;
        positionCursorTips(mx, my);
        moveRaysToward(mx, my);
      });

      function positionCursorTips(mx, my) {
        const ep = projectToEdge(mx, my);
        const baseAngle = Math.atan2(ep[1] - 50, ep[0] - 50);
        activeCursorTips.forEach((ct, idx) => {
          const a = baseAngle + ct._angleOffset;
          const edgeX = 50 + 48 * Math.cos(a);
          const edgeY = 50 + 46 * Math.sin(a);
          let t;
          if (idx === 0) {
            t = 0;
          } else {
            t = 0.4 + idx * 0.3;
          }
          const px = mx + (edgeX - mx) * t;
          const py = my + (edgeY - my) * t;
          ct._cx = px;
          ct._cy = py;
          ct._tx = px;
          ct._ty = py;
          ct.style.left = px.toFixed(1) + '%';
          ct.style.top = py.toFixed(1) + '%';
          const sz = (1 - t * 0.4) * ct._tsz;
          ct.style.width = ct.style.height = sz.toFixed(1) + 'px';
        });
      }

      function moveRaysToward(mx, my) {
        const dx = (mx - 50) * 0.5;
        const dy = (my - 50) * 0.5;
        activePlasma.style.setProperty('--plasma-x', dx.toFixed(1));
        activePlasma.style.setProperty('--plasma-y', dy.toFixed(1));
      }

      link.addEventListener('mousemove', e => {
        const rect = link.getBoundingClientRect();
        const mx = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        const my = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
        positionCursorTips(mx, my);
        moveRaysToward(mx, my);
      });

      link.addEventListener('mouseleave', () => {
        activeCursorTips.forEach(ct => {
          ct.classList.remove('active');
          setTimeout(() => {
            ct._active = false;
          }, 600);
        });
        activeCursorTips = [];
        activePlasma.style.setProperty('--plasma-x', '0');
        activePlasma.style.setProperty('--plasma-y', '0');
      });
    }

    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      e.preventDefault();
      link.style.pointerEvents = 'none';
      const plasma = document.createElement('span');
      plasma.className = 'nav-plasma';
      link.appendChild(plasma);
      plasma.addEventListener('animationend', function handler(ev) {
        if (ev.animationName === 'navPlasmaLifecycle') {
          plasma.remove();
          plasma.removeEventListener('animationend', handler);
        }
      });
      setTimeout(() => {
        plasma.remove();
        window.location.href = href;
      }, 1400);
    });
  });

  /* ========== SOCIAL ICONS — ENTRANCE ANIMATION ON PAGE LOAD ========== */
  requestAnimationFrame(() => {
    const allSocialLinks = document.querySelectorAll(
      '.social-icon, .header-social-link, .footer-socials .social-link--icon'
    );
    allSocialLinks.forEach((link, i) => {
      const icon = link.querySelector('i');
      if (!icon) return;
      const delay = i * 150;
      setTimeout(() => {
        icon.style.animation =
          'iconSocialBounceFlip 2.4s cubic-bezier(0.22,0.61,0.36,1) forwards, iconMetalShimmer var(--icon-sheen-duration) ease-in-out infinite';
        void icon.offsetWidth;
        setTimeout(() => {
          icon.style.animation = '';
        }, 2500);
      }, delay);
    });
  });

  /* ========== SOCIAL ICON CLICK — PLAY FLIP + NAVIGATE ========== */
  const animatedSocialClickMedia = window.matchMedia('(width <= 900px)');
  document.querySelectorAll('.social-icon, .header-social-link, .footer-socials .social-link--icon').forEach(link => {
    let clicking = false;
    link.addEventListener('click', e => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      if (!animatedSocialClickMedia.matches) return;
      e.preventDefault();
      if (clicking) return;
      clicking = true;
      const icon = link.querySelector('i');
      if (icon) {
        icon.style.animation = 'none';
        void icon.offsetWidth;
        icon.style.animation =
          'iconSocialBounceFlip 2.4s cubic-bezier(0.22,0.61,0.36,1) forwards, iconMetalShimmer var(--icon-sheen-duration) ease-in-out infinite';
      }
      setTimeout(() => {
        clicking = false;
        if (icon) icon.style.animation = '';
        if (link.getAttribute('target') === '_blank') {
          window.open(href, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = href;
        }
      }, 2500);
    });
  });

  /* ========== NAV PROGRESS LINE ========== */
  const navMain = document.querySelector('.nav-main');
  if (navMain) {
    let progressBar = navMain.querySelector('.nav-progress');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'nav-progress';
      navMain.appendChild(progressBar);
    }

    const updateScrollProgress = () => {
      const max = scrollRoot.scrollHeight - scrollRoot.clientHeight;
      const p = max > 0 ? scrollRoot.scrollTop / max : 0;
      progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
    };

    updateScrollProgress();
    scrollRoot.addEventListener('scroll', updateScrollProgress, { passive: true });
    window.addEventListener('resize', updateScrollProgress);
  }
});
