(function () {
  const CONSENT_KEY = 'hundesalon_cookie_consent';
  const COPY = {
    de: {
      title: 'Privatsphäre & Cookies',
      text: 'Wir nutzen notwendige Cookies für den Betrieb. Analyse und Google Ads-Messung nur mit Ihrer Zustimmung.',
      accept: 'Akzeptieren',
      decline: 'Nur notwendig',
    },
    ru: {
      title: 'Конфиденциальность и cookies',
      text: 'Мы используем необходимые cookies для работы сайта. Аналитику и измерение Google Ads включаем только с вашего согласия.',
      accept: 'Принять',
      decline: 'Только необходимые',
    },
    en: {
      title: 'Privacy & cookies',
      text: 'We use essential cookies for the site. Analytics and Google Ads measurement only with your consent.',
      accept: 'Accept',
      decline: 'Essential only',
    },
    uk: {
      title: 'Конфіденційність і cookies',
      text: 'Ми використовуємо необхідні cookies для роботи сайту. Аналітику та вимірювання Google Ads вмикаємо лише за вашою згодою.',
      accept: 'Прийняти',
      decline: 'Лише необхідні',
    },
  };

  const getLang = () => {
    const htmlLang = (document.documentElement.lang || 'de').toLowerCase().slice(0, 2);
    return COPY[htmlLang] ? htmlLang : 'de';
  };

  const readConsent = () => {
    try {
      return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    } catch {
      return null;
    }
  };

  const saveConsent = analytics => {
    const consent = {
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
      version: 1,
    };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent('hundesalon:cookie-consent', { detail: consent }));
  };

  const createBanner = () => {
    if (readConsent() || document.querySelector('.cookie-consent')) {
      return;
    }

    const copy = COPY[getLang()];
    const banner = document.createElement('section');
    banner.className = 'cookie-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', copy.title);
    banner.innerHTML = `
      <div class="cookie-consent__body">
        <strong>${copy.title}</strong>
        <p>${copy.text}</p>
      </div>
      <div class="cookie-consent__actions">
        <button type="button" class="cookie-consent__btn cookie-consent__btn--ghost" data-cookie-choice="necessary">${copy.decline}</button>
        <button type="button" class="cookie-consent__btn" data-cookie-choice="accept">${copy.accept}</button>
      </div>
    `;

    banner.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const choice = target.dataset.cookieChoice;
      if (!choice) {
        return;
      }

      saveConsent(choice === 'accept');
      banner.classList.add('cookie-consent--leaving');
      window.setTimeout(() => banner.remove(), 220);
    });

    document.body.appendChild(banner);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createBanner, { once: true });
  } else {
    createBanner();
  }
})();
