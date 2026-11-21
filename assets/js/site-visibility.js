(() => {
  const root = document.documentElement;
  const disabled = new Set((root.dataset.disabledSections ?? 'promotions').split(' ').filter(Boolean));
  // Static links are filtered at the edge. The shell handles the promotions tile before painting it.
  if (!disabled.size || (disabled.size === 1 && disabled.has('promotions'))) return;
  const paths = new Set((root.dataset.disabledPaths ?? 'promotions').split(' ').filter(Boolean));
  const widgets = {
    booking: '#open-booking-btn, [data-price-modal-booking], [data-client-registration-booking], [data-open-booking]',
    newsletter: '[data-newsletter-section], [data-newsletter-form]',
    reviews: '#testimonials, [data-review-form]',
    aiChat: '#hundesalon-ai-chat',
    shop: '[data-cart-open]',
  };
  const widgetSelectors = [...disabled]
    .map(key => widgets[key])
    .filter(Boolean)
    .join(',');
  const selector = ['a[href]', '.nav-gallery-dropdown', '#mobile-nav', '#burgerBtn', widgetSelectors]
    .filter(Boolean)
    .join(',');
  const prior = new WeakMap();

  function blockedLink(link) {
    let url;
    try {
      url = new URL(link.getAttribute('href'), document.baseURI);
    } catch {
      return false;
    }
    if (url.origin !== location.origin) return false;
    const [locale, section] = url.pathname.split('/').filter(Boolean);
    if (!section || !['de', 'en', 'ru', 'uk'].includes(locale)) return false;
    return paths.has(section.replace(/\.html$/, ''));
  }

  function hide(el) {
    if (prior.has(el)) return;
    prior.set(el, {
      hidden: el.hidden,
      inert: el.inert,
      display: el.style.display,
      priority: el.style.getPropertyPriority('display'),
    });
    el.hidden = true;
    el.inert = true;
    el.style.setProperty('display', 'none', 'important');
  }

  function update(element) {
    if (element.matches('#mobile-nav, #burgerBtn')) {
      const links = root.querySelectorAll('#mobile-nav a[href]');
      const burger = document.getElementById('burgerBtn');
      if (burger && links.length && [...links].every(blockedLink)) hide(burger);
    } else if (element.matches('.nav-gallery-dropdown') && (disabled.has('gallery') || disabled.has('beforeAfter'))) {
      const available = [...element.querySelectorAll('.dropdown-menu a[href]')].find(link => !blockedLink(link));
      if (!available) {
        hide(element);
        return;
      }
      const link = document.createElement('a');
      link.className = 'btn-neon';
      link.href = available.href;
      link.textContent = available.querySelector('.dropdown-menu__label')?.textContent || available.textContent;
      if (available.hasAttribute('aria-current')) link.setAttribute('aria-current', 'page');
      element.replaceWith(link);
    } else if (
      (element.matches('a[href]') && blockedLink(element)) ||
      (widgetSelectors && element.matches(widgetSelectors))
    ) {
      hide(element);
    } else if (prior.has(element)) {
      const state = prior.get(element);
      element.hidden = state.hidden;
      element.inert = state.inert;
      element.style.setProperty('display', state.display, state.priority);
      prior.delete(element);
    }
  }

  function scan(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(selector)) update(node);
    node.querySelectorAll(selector).forEach(update);
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') update(record.target);
      else record.addedNodes.forEach(scan);
    }
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  scan(root);
})();
