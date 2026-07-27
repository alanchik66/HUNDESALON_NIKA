(function () {
  const COPY = {
    de: {
      sending: 'Wird gesendet...',
      success: 'Danke. Die Begrüßungsmail ist unterwegs.',
      error: 'Die Anmeldung ist gerade nicht möglich. Bitte versuchen Sie es später erneut.',
      consentRequired: 'Bitte bestätigen Sie die Einwilligung zum Newsletter.',
      consentHtml:
        'Ich willige in den Erhalt ausgewählter Pflege-Tipps und Angebote per E-Mail ein. Details in der <a href="datenschutz.html">Datenschutzerklärung</a>. Abmeldung jederzeit möglich.',
    },
    ru: {
      sending: 'Отправляем...',
      success: 'Спасибо. Приветственное письмо уже отправляется.',
      error: 'Подписка сейчас недоступна. Попробуйте позже.',
      consentRequired: 'Подтвердите согласие на получение рассылки.',
      consentHtml:
        'Я соглашаюсь получать выбранные советы по уходу и предложения по e-mail. Подробности в <a href="datenschutz.html">политике конфиденциальности</a>. Отписка в любое время.',
    },
    en: {
      sending: 'Sending...',
      success: 'Thank you. The welcome email is on its way.',
      error: 'Subscription is not available right now. Please try again later.',
      consentRequired: 'Please confirm newsletter consent.',
      consentHtml:
        'I agree to receive selected care tips and offers by email. Details in the <a href="datenschutz.html">privacy policy</a>. Unsubscribe anytime.',
    },
    uk: {
      sending: 'Надсилаємо...',
      success: 'Дякуємо. Вітальний лист уже надсилається.',
      error: 'Підписка зараз недоступна. Спробуйте пізніше.',
      consentRequired: 'Підтвердьте згоду на отримання розсилки.',
      consentHtml:
        'Я погоджуюся отримувати вибрані поради з догляду та пропозиції електронною поштою. Деталі в <a href="datenschutz.html">політиці конфіденційності</a>. Відписка будь-коли.',
    },
  };

  const getLang = form =>
    (form.querySelector('input[name="lang"]')?.value || document.documentElement.lang || 'de')
      .toLowerCase()
      .slice(0, 2);

  const ensureConsentField = form => {
    if (form.querySelector('input[name="newsletter_consent"]')) {
      return;
    }
    const lang = getLang(form);
    const copy = COPY[lang] || COPY.de;
    const label = document.createElement('label');
    label.className = 'newsletter-form__consent';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'newsletter_consent';
    input.required = true;
    input.value = 'on';
    const span = document.createElement('span');
    span.innerHTML = copy.consentHtml;
    const privacyLink = span.querySelector('a');
    if (privacyLink) privacyLink.href = `/${lang}/datenschutz.html`;
    label.append(input, span);
    const submit = form.querySelector('[type="submit"]');
    if (submit) {
      form.insertBefore(label, submit);
    } else {
      form.appendChild(label);
    }
  };

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
    ensureConsentField(form);
    const ensureHiddenField = (name, value) => {
      let field = form.querySelector(`input[name="${name}"]`);
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = name;
        form.appendChild(field);
      }
      field.value = value;
    };
    ensureHiddenField('source', window.location.pathname);
    ensureHiddenField('source_form', 'newsletter');

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const lang = getLang(form);
      const copy = COPY[lang] || COPY.de;
      const consent = form.querySelector('input[name="newsletter_consent"]');
      if (consent && !consent.checked) {
        setStatus(form, 'error', copy.consentRequired);
        consent.focus();
        return;
      }
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
