export const PREVIEW_VISITOR_ACTIONS_PATH = '/__preview_visitor_actions.js';

function connectVisitorActions() {
  const official = 'https://hundesalon-nika.com';
  if (location.origin === official || window.top !== window) return;
  const locale = /^\/(de|en|ru|uk)(?:\/|$)/.exec(location.pathname)?.[1];
  if (!locale) return;
  const base = official + '/' + locale + '/';
  const copy = {
    de: {
      booking: 'Termin auf der Salonwebsite buchen', contact: 'Nachricht auf der Salonwebsite schreiben',
      review: 'Salon auf der Salonwebsite bewerten', newsletter: 'Newsletter auf der Salonwebsite abonnieren',
      chat: 'Zur Hilfe-Schaltfläche auf der Salonwebsite', price: 'Zur Buchung diese Leistung auf der Salonwebsite erneut auswählen',
    },
    en: {
      booking: 'Book an appointment on the salon website', contact: 'Write to the salon on its website',
      review: 'Leave a review on the salon website', newsletter: 'Subscribe on the salon website',
      chat: 'Go to the Help button on the salon website', price: 'Continue booking by selecting the service again on the salon website',
    },
    ru: {
      booking: 'Записаться на сайте салона', contact: 'Написать на сайте салона',
      review: 'Оставить отзыв на сайте салона', newsletter: 'Подписаться на сайте салона',
      chat: 'Перейти к кнопке «Помощь» на сайте салона', price: 'Для записи выберите услугу ещё раз на сайте салона',
    },
    uk: {
      booking: 'Записатися на сайті салону', contact: 'Написати на сайті салону',
      review: 'Залишити відгук на сайті салону', newsletter: 'Підписатися на сайті салону',
      chat: 'Перейти до кнопки «Допомога» на сайті салону', price: 'Для запису виберіть послугу ще раз на сайті салону',
    },
  }[locale];
  const routes = {
    booking: 'onlayn-bronirovanie#open-booking-btn', price: 'prays-list#price-categories',
    contact: 'kontakty#contact-form', review: 'reyting#review-form',
    newsletter: '#newsletter-email-' + locale, chat: '#hundesalon-ai-chat',
  };
  const section = { booking: 'booking', price: 'booking', contact: 'contacts', review: 'reviews', newsletter: 'newsletter', chat: 'aiChat' };
  const disabled = new Set((document.documentElement.dataset.disabledSections || '').split(' '));
  const bookingControls = '#open-booking-btn,.select-service-btn,.online-order-btn,[data-price-modal-booking],[data-client-registration-booking],[data-open-booking]';
  const selector = [
    'form[action="/sendmail"]', 'form[action="/subscribe"]', '.hn-ai-launcher', bookingControls,
  ].join(',');
  const mark = 'data-preview-visitor-action';
  let priceRoute = routes.price;
  const priceNotes = new WeakMap();

  function syncPriceLink(link) {
    if (link.href !== base + priceRoute) link.href = base + priceRoute;
    const note = priceNotes.get(link);
    if (link.nextElementSibling !== note) link.after(note);
    if (note.hidden !== link.hidden) note.hidden = link.hidden;
  }

  function categoryDestination(control) {
    const card = control.closest('[data-category-id]');
    const category = card?.dataset.categoryId;
    if (!category || !/^[a-z0-9-]{1,90}$/.test(category)) return routes.price;
    const id = 'price-card-details-' + category;
    return card.querySelector('[data-price-card-details]')?.id === id ? 'prays-list#' + id : routes.price;
  }

  function actionFor(el) {
    if (el.matches('form')) {
      if (el.matches('[action="/subscribe"]')) return 'newsletter';
      if (el.matches('#booking-form')) return 'booking';
      if (el.matches('[data-client-registration-form]')) return 'price';
      if (el.matches('[data-review-form]')) return 'review';
      return 'contact';
    }
    if (el.matches('.hn-ai-launcher')) return 'chat';
    return el.matches('[data-price-modal-booking]') ? 'price' : 'booking';
  }

  function adapt(el) {
    if (priceNotes.has(el) && el.isConnected) syncPriceLink(el);
    if (el.hasAttribute(mark) || !el.isConnected) return;
    const action = actionFor(el);
    if (disabled.has(section[action]) || (action === 'price' && disabled.has('prices'))) return;
    const link = document.createElement('a');
    link.href = base + (action === 'price' ? priceRoute : routes[action]);
    link.setAttribute(mark, action);
    link.referrerPolicy = 'no-referrer';

    if (el.matches('form')) {
      // The site's setup still uses the original form to initialise other page controls.
      el.setAttribute(mark, action);
      el.hidden = true;
      el.inert = true;
      el.style.setProperty('display', 'none', 'important');
      link.className = 'btn-neon';
      link.textContent = copy[action];
      el.before(link);
      return;
    }
    // price-page.js keeps this anchor to update availability and selection as the visitor explores.
    if (el.matches('a[data-price-modal-booking]')) {
      el.setAttribute(mark, action);
      el.referrerPolicy = 'no-referrer';
      el.setAttribute('aria-label', copy.price);
      el.title = copy.price;
      const note = document.createElement('small');
      note.textContent = copy.price;
      priceNotes.set(el, note);
      syncPriceLink(el);
      return;
    }
    for (const attr of el.attributes) {
      if (/^(class|id|hidden|style|tabindex)$/.test(attr.name) || attr.name.startsWith('data-')) {
        link.setAttribute(attr.name, attr.value);
      }
    }
    const original = el.getAttribute('aria-label') || el.textContent.trim();
    link.setAttribute('aria-label', action === 'chat' || !original ? copy[action] : original + '. ' + copy[action]);
    link.title = copy[action];
    link.append(...Array.from(el.childNodes));
    if (!link.hasChildNodes()) link.textContent = copy[action];
    el.replaceWith(link);
  }

  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(selector)) adapt(node);
    node.querySelectorAll(selector).forEach(adapt);
  }
  // Catalog and assistant controls are built after the page loads and rebuilt on filtering.
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(scan);
      else if (priceNotes.has(record.target)) syncPriceLink(record.target);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'hidden'] });
  scan(document.documentElement);
  // Keep the link's native action, including opening in another tab, ahead of local modal handlers.
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-category-id]')) {
      priceRoute = categoryDestination(event.target);
      const booking = document.querySelector('a[data-price-modal-booking][' + mark + ']');
      if (booking) booking.href = base + priceRoute;
    }
    const link = event.target.closest?.('a[' + mark + ']');
    if (!link) return;
    if (link.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      return;
    }
    event.stopImmediatePropagation();
  }, true);
}

export const PREVIEW_VISITOR_ACTIONS_SCRIPT = '(' + connectVisitorActions.toString() + ')();';
