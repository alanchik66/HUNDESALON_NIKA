(function () {
  const COPY = {
    de: {
      sending: 'Wird gesendet...',
      success: 'Danke. Die Begrüßungsmail ist unterwegs.',
      error: 'Die Anmeldung ist gerade nicht möglich. Bitte versuchen Sie es später erneut.',
    },
    ru: {
      sending: 'Отправляем...',
      success: 'Спасибо. Приветственное письмо уже отправляется.',
      error: 'Подписка сейчас недоступна. Попробуйте позже.',
    },
    en: {
      sending: 'Sending...',
      success: 'Thank you. The welcome email is on its way.',
      error: 'Subscription is not available right now. Please try again later.',
    },
    uk: {
      sending: 'Надсилаємо...',
      success: 'Дякуємо. Вітальний лист уже надсилається.',
      error: 'Підписка зараз недоступна. Спробуйте пізніше.',
    },
  };

  const getLang = form =>
    (form.querySelector('input[name="lang"]')?.value || document.documentElement.lang || 'de').toLowerCase().slice(0, 2);

  const setStatus = (form, type, message) => {
    let status = form.querySelector('.newsletter-form__status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'newsletter-form__status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      form.appendChild(status);
    }
    status.className = `newsletter-form__status newsletter-form__status--${type}`;
    status.textContent = message;
  };

  const bindForm = form => {
    if (form.dataset.newsletterReady === 'true') {
      return;
    }
    form.dataset.newsletterReady = 'true';

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const lang = getLang(form);
      const copy = COPY[lang] || COPY.de;
      const submit = form.querySelector('[type="submit"]');
      const originalText = submit?.textContent || '';
      const pageField = form.querySelector('input[name="page"]');
      if (pageField) {
        pageField.value = window.location.pathname;
      }

      if (submit) {
        submit.disabled = true;
        submit.textContent = copy.sending;
      }
      setStatus(form, 'loading', copy.sending);

      try {
        const response = await fetch('/subscribe', {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.success === false) {
          throw new Error(result.message || copy.error);
        }
        form.reset();
        setStatus(form, 'success', result.message || copy.success);
      } catch (error) {
        setStatus(form, 'error', error?.message || copy.error);
      } finally {
        if (submit) {
          submit.disabled = false;
          submit.textContent = originalText;
        }
      }
    });
  };

  const init = () => {
    document.querySelectorAll('form[data-newsletter-form]').forEach(bindForm);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
