/*
 * ================================================================
 * HUNDESALON NIKA — Page Modules
 * ================================================================
 * Page-specific interactive logic: booking modal, sendmail forms,
 * message draft tools, and smooth hash-link scrolling.
 * Loaded on pages that need specialised behaviour beyond main.js.
 *
 * Version: 2026-04-20
 * ================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
  const pageLang = (document.documentElement.lang || 'ru').toLowerCase().slice(0, 2);
  const scrollRoot = document.querySelector('.site-scroll-root');

  const bookingCopyByLang = {
    ru: {
      weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      services: [
        'Стрижка собак',
        'Купание',
        'Тримминг',
        'Экспресс-линька',
        'Стрижка кошек',
      ],
      fallbackService: 'Выбранная услуга',
      chooseService: 'Выберите услугу',
      chooseDate: 'Выберите дату',
      chooseTime: 'Выберите время',
      chooseContact: 'Заполните имя, email и телефон',
      choosePrivacy: 'Подтвердите согласие на обработку персональных данных',
      dateInPast: 'Выберите будущую дату',
      fileType: 'Можно загрузить только JPG или PNG',
      fileSize: 'Файл должен быть не больше 5 МБ',
      summaryTitle: 'Проверьте запись перед отправкой',
      summaryConfirm: 'Подтвердить и отправить',
      summaryEdit: 'Изменить данные',
      labels: {
        service: 'Услуга',
        date: 'Дата',
        time: 'Время',
        name: 'Имя',
        email: 'Email',
        phone: 'Телефон',
        payment: 'Оплата',
        file: 'Файл',
        payNow: 'Оплатить сейчас',
        payLater: 'Оплата в салоне',
        noFile: 'Без файла',
      },
      closeModal: 'Закрыть окно',
    },
    uk: {
      weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
      services: [
        'Стрижка собак',
        'Купання',
        'Тримінг',
        'Експрес-линька',
        'Стрижка котів',
      ],
      fallbackService: 'Обрана послуга',
      chooseService: 'Оберіть послугу',
      chooseDate: 'Оберіть дату',
      chooseTime: 'Оберіть час',
      chooseContact: 'Заповніть імʼя, email і телефон',
      choosePrivacy: 'Підтвердьте згоду на обробку персональних даних',
      dateInPast: 'Оберіть майбутню дату',
      fileType: 'Можна завантажити лише JPG або PNG',
      fileSize: 'Файл має бути не більше 5 МБ',
      summaryTitle: 'Перевірте запис перед надсиланням',
      summaryConfirm: 'Підтвердити й надіслати',
      summaryEdit: 'Змінити дані',
      labels: {
        service: 'Послуга',
        date: 'Дата',
        time: 'Час',
        name: 'Імʼя',
        email: 'Email',
        phone: 'Телефон',
        payment: 'Оплата',
        file: 'Файл',
        payNow: 'Оплатити зараз',
        payLater: 'Оплата в салоні',
        noFile: 'Без файлу',
      },
      closeModal: 'Закрити вікно',
    },
    en: {
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      services: [
        'Dog haircut',
        'Bathing',
        'Hand stripping',
        'Express deshedding',
        'Cat grooming',
      ],
      fallbackService: 'Selected service',
      chooseService: 'Please select a service',
      chooseDate: 'Please select a date',
      chooseTime: 'Please select a time',
      chooseContact: 'Please fill in name, email, and phone',
      choosePrivacy: 'Please confirm personal data processing consent',
      dateInPast: 'Please choose a future date',
      fileType: 'Only JPG or PNG files are allowed',
      fileSize: 'File size must be up to 5 MB',
      summaryTitle: 'Review your booking before sending',
      summaryConfirm: 'Confirm and send',
      summaryEdit: 'Edit details',
      labels: {
        service: 'Service',
        date: 'Date',
        time: 'Time',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        payment: 'Payment',
        file: 'File',
        payNow: 'Pay now',
        payLater: 'Pay at salon',
        noFile: 'No file',
      },
      closeModal: 'Close dialog',
    },
    de: {
      weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      services: [
        'Hundeschnitt',
        'Baden',
        'Trimming',
        'Express-Fellwechselpflege',
        'Katzenpflege',
      ],
      fallbackService: 'Ausgewählte Leistung',
      chooseService: 'Bitte wählen Sie eine Leistung',
      chooseDate: 'Bitte wählen Sie ein Datum',
      chooseTime: 'Bitte wählen Sie eine Uhrzeit',
      chooseContact: 'Bitte füllen Sie Name, E-Mail und Telefon aus',
      choosePrivacy: 'Bitte bestätigen Sie die Verarbeitung personenbezogener Daten',
      dateInPast: 'Bitte wählen Sie ein zukünftiges Datum',
      fileType: 'Nur JPG- oder PNG-Dateien sind erlaubt',
      fileSize: 'Die Datei darf maximal 5 MB groß sein',
      summaryTitle: 'Bitte prüfen Sie Ihre Buchung vor dem Absenden',
      summaryConfirm: 'Bestätigen und senden',
      summaryEdit: 'Angaben ändern',
      labels: {
        service: 'Leistung',
        date: 'Datum',
        time: 'Uhrzeit',
        name: 'Name',
        email: 'E-Mail',
        phone: 'Telefon',
        payment: 'Zahlung',
        file: 'Datei',
        payNow: 'Jetzt bezahlen',
        payLater: 'Zahlung im Salon',
        noFile: 'Keine Datei',
      },
      closeModal: 'Dialog schließen',
    },
  };
  const bookingCopy = bookingCopyByLang[pageLang] || bookingCopyByLang.en;

  const injectHiddenValue = (form, name, value) => {
    let field = form.querySelector(`input[name="${name}"]`);

    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      form.prepend(field);
    }

    field.value = value;
  };

  const formCopy = {
    success: {
      ru: 'Сообщение отправлено! Мы свяжемся с вами в ближайшее время.',
      uk: "Повідомлення надіслано! Ми зв'яжемося з вами найближчим часом.",
      en: 'Message sent! We will get back to you soon.',
      de: 'Ihre Nachricht wurde gesendet! Wir melden uns in Kürze.',
    },
    error: {
      ru: 'Ошибка при отправке. Пожалуйста, позвоните нам по телефону.',
      uk: 'Помилка надсилання. Будь ласка, зателефонуйте нам.',
      en: 'Failed to send. Please contact us by phone.',
      de: 'Senden fehlgeschlagen. Bitte kontaktieren Sie uns telefonisch.',
    },
    sending: {
      ru: 'Отправляю...',
      uk: 'Надсилаю...',
      en: 'Sending...',
      de: 'Wird gesendet...',
    },
    localFunctionsRequired: {
      ru: url =>
        `Локальная страница открыта без серверной отправки. Откройте ${url} — там форма отправит заявку правильно.`,
      uk: url =>
        `Локальну сторінку відкрито без серверного надсилання. Відкрийте ${url} — там форма надішле заявку правильно.`,
      en: url => `This local page is running without server sending. Open ${url} and the booking form will submit correctly.`,
      de: url =>
        `Diese lokale Seite läuft ohne Server-Versand. Öffnen Sie ${url}, dann sendet das Buchungsformular korrekt.`,
    },
  };

  const SENDMAIL_ENDPOINT_TIMEOUT_MS = 4500;

  const isPrivateLanHost = hostname =>
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(String(hostname || '').trim());

  const getLocalCloudflareSendmailUrl = () => {
    const { protocol, hostname, port } = window.location;
    const isLocalStaticHost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || isPrivateLanHost(hostname);
    const isStaticPreviewPort = ['5500', '5501', '5502', '5503', '5504'].includes(port);

    if (!isLocalStaticHost || !isStaticPreviewPort) {
      return '';
    }

    return `${protocol}//${hostname}:8788/sendmail`;
  };

  const getLocalCloudflarePageUrl = () => {
    const sendmailUrl = getLocalCloudflareSendmailUrl();
    if (!sendmailUrl) return '';

    const url = new URL(sendmailUrl);
    url.pathname = window.location.pathname;
    url.search = '';
    return url.toString();
  };

  const getSendmailEndpoints = () => {
    const endpoints = ['/sendmail'];
    const localCloudflareUrl = getLocalCloudflareSendmailUrl();

    if (localCloudflareUrl) {
      endpoints.push(localCloudflareUrl);
    }

    return endpoints;
  };

  const messageDraftCopy = {
    title: {
      ru: 'Помощник для текста',
      uk: 'Помічник для тексту',
      en: 'Text helper',
      de: 'Texthilfe',
    },
    button: {
      ru: 'Подготовить черновик',
      uk: 'Підготувати чернетку',
      en: 'Prepare draft',
      de: 'Entwurf vorbereiten',
    },
    loading: {
      ru: 'Готовлю черновик...',
      uk: 'Готую чернетку...',
      en: 'Preparing draft...',
      de: 'Entwurf wird erstellt...',
    },
    done: {
      ru: 'Черновик добавлен в поле сообщения.',
      uk: 'Чернетку додано до поля повідомлення.',
      en: 'Draft added to the message field.',
      de: 'Entwurf wurde in das Nachrichtenfeld eingefugt.',
    },
    failed: {
      ru: 'Не удалось создать черновик. Попробуйте снова чуть позже.',
      uk: 'Не вдалося створити чернетку. Спробуйте трохи пізніше.',
      en: 'Could not create draft. Please try again shortly.',
      de: 'Entwurf konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
    },
    localDevHint: {
      ru: 'Локальный запуск: откройте сайт через http://127.0.0.1:8788 (npm run dev:cf).',
      uk: 'Локальний запуск: відкрийте сайт через http://127.0.0.1:8788 (npm run dev:cf).',
      en: 'Local run: open the site via http://127.0.0.1:8788 (npm run dev:cf).',
      de: 'Lokaler Start: Bitte Seite uber http://127.0.0.1:8788 offnen (npm run dev:cf).',
    },
    apiKeyMissing: {
      ru: 'Сервис черновиков сейчас недоступен в локальном режиме.',
      uk: 'Сервіс чернеток зараз недоступний у локальному режимі.',
      en: 'Draft service is temporarily unavailable in local mode.',
      de: 'Der Entwurfsdienst ist lokal vorubergehend nicht verfugbar.',
    },
  };

  const normalizeDraftMessage = value => {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      const joined = value
        .map(part => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
          return '';
        })
        .join('\n');
      return joined.trim();
    }
    return '';
  };

  const submitSendmailForm = async (form, submitBtn) => {
    const originalText = submitBtn?.textContent ?? '';

    form.querySelectorAll('.form-status').forEach(el => el.remove());

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = formCopy.sending[pageLang] ?? formCopy.sending.de;
    }

    const statusEl = document.createElement('p');
    statusEl.className = 'form-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.setAttribute('tabindex', '-1');

    let shouldShowLocalFunctionHint = false;
    let lastResult = null;

    try {
      for (const endpoint of getSendmailEndpoints()) {
        let response;
        const controller = new window.AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), SENDMAIL_ENDPOINT_TIMEOUT_MS);

        try {
          response = await fetch(endpoint, {
            method: 'POST',
            body: new FormData(form),
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          });
        } catch (error) {
          lastResult = { success: false, status: 0, error };
          shouldShowLocalFunctionHint = Boolean(getLocalCloudflareSendmailUrl());
          continue;
        } finally {
          window.clearTimeout(timeoutId);
        }

        const result = await response.json().catch(() => ({ success: false }));
        lastResult = { ...result, status: response.status };

        if (response.ok && result.success) {
          statusEl.classList.add('form-status--success');
          statusEl.textContent = result.message || (formCopy.success[pageLang] ?? formCopy.success.de);
          form.reset();
          break;
        }

        if ((response.status === 404 || response.status === 405) && endpoint === '/sendmail') {
          shouldShowLocalFunctionHint = Boolean(getLocalCloudflareSendmailUrl());
          continue;
        }
      }
    } catch {
      lastResult = { success: false };
    } finally {
      if (!statusEl.classList.contains('form-status--success')) {
        const localCloudflarePageUrl = getLocalCloudflarePageUrl();
        statusEl.classList.add('form-status--error');
        statusEl.textContent =
          shouldShowLocalFunctionHint && localCloudflarePageUrl
            ? (formCopy.localFunctionsRequired[pageLang] ?? formCopy.localFunctionsRequired.de)(localCloudflarePageUrl)
            : lastResult?.message || (formCopy.error[pageLang] ?? formCopy.error.de);
      }

      form.appendChild(statusEl);
      window.requestAnimationFrame(() => statusEl.focus({ preventScroll: true }));

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }

    return statusEl.classList.contains('form-status--success');
  };

  const initSendmailForms = () => {
    const forms = document.querySelectorAll('form[action$="/sendmail"]');
    if (!forms.length) return;

    forms.forEach(form => {
      if (form.id === 'booking-form') {
        return;
      }

      const isBookingForm =
        form.querySelector('input[name="service"][type="hidden"]') &&
        form.querySelector('input[name="date"][type="hidden"]') &&
        form.querySelector('input[name="time"][type="hidden"]');
      const isFeedbackForm =
        !isBookingForm &&
        (form.closest('.complaint-form') !== null || form.querySelector('select[name="subject"]') !== null);
      const formType = isBookingForm ? 'booking' : isFeedbackForm ? 'feedback' : 'contact';
      const messageField = form.querySelector('textarea[name="message"]');

      injectHiddenValue(form, 'lang', pageLang);
      injectHiddenValue(form, 'form_type', formType);

      if (formType === 'contact') {
        form.querySelector('input[name="name"]')?.setAttribute('required', '');
        form.querySelector('input[name="email"]')?.setAttribute('required', '');
        messageField?.setAttribute('required', '');
      }

      if (formType === 'feedback') {
        messageField?.setAttribute('required', '');
        form.querySelector('input[name="name"]')?.removeAttribute('required');
        form.querySelector('input[name="email"]')?.removeAttribute('required');
      }

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const submitBtn = form.querySelector('[type="submit"]');
        await submitSendmailForm(form, submitBtn);
      });
    });
  };

  const initMessageDraftTools = () => {
    const resolveDraftEndpoints = () => {
      const port = window.location.port;

      if (port === '8788') {
        return ['/message-draft'];
      }

      return ['/message-draft', '/functions/message-draft'];
    };

    const requestMessageDraft = async requestBody => {
      let lastError = null;

      for (const endpoint of resolveDraftEndpoints()) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            await response.text();
            if (response.status === 503) {
              throw new Error('DRAFT_SERVICE_UNCONFIGURED');
            }

            const error = new Error(`Draft request failed with status ${response.status} on ${endpoint}`);
            // Retry with next endpoint for infra-like failures.
            if (response.status === 404 || response.status === 405 || response.status >= 500) {
              lastError = error;
              continue;
            }
            throw error;
          }

          return await response.json();
        } catch (error) {
          lastError = error;
        }
      }

      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isStaticPreview = window.location.port === '5502';
      if (isLocalHost && isStaticPreview) {
        throw new Error('LOCAL_CF_DEV_REQUIRED');
      }

      throw lastError || new Error('Draft endpoints are unavailable');
    };

    const forms = document.querySelectorAll('form[action$="/sendmail"]');
    if (!forms.length) return;

    forms.forEach(form => {
      const messageField = form.querySelector('textarea[name="message"]');
      if (!messageField) return;
      if (form.dataset.messageDraftReady === 'true') return;
      form.dataset.messageDraftReady = 'true';

      const tools = document.createElement('div');
      tools.className = 'message-draft-tools';

      const title = document.createElement('span');
      title.className = 'message-draft-title';
      title.textContent = messageDraftCopy.title[pageLang] ?? messageDraftCopy.title.de;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-draft-btn';
      button.textContent = messageDraftCopy.button[pageLang] ?? messageDraftCopy.button.de;

      const status = document.createElement('p');
      status.className = 'message-draft-status';

      tools.appendChild(title);
      tools.appendChild(button);
      messageField.insertAdjacentElement('beforebegin', tools);
      messageField.insertAdjacentElement('afterend', status);

      button.addEventListener('click', async () => {
        const formType = form.querySelector('input[name="form_type"]')?.value || 'contact';
        const name = form.querySelector('input[name="name"]')?.value?.trim() || '';
        const service = form.querySelector('input[name="service"]')?.value?.trim() || '';
        const existingText = messageField.value.trim();

        status.className = 'message-draft-status message-draft-status--loading';
        status.textContent = messageDraftCopy.loading[pageLang] ?? messageDraftCopy.loading.de;
        button.disabled = true;

        try {
          const payload = await requestMessageDraft({
            temperature: 0.45,
            max_tokens: 260,
            messages: [
              {
                role: 'system',
                content:
                  'You write polite, concise salon customer messages in the requested language. Keep tone warm and practical. No markdown.',
              },
              {
                role: 'user',
                content: [
                  `Language: ${pageLang}`,
                  `Form type: ${formType}`,
                  `Customer name: ${name || 'not provided'}`,
                  `Service: ${service || 'not provided'}`,
                  `Existing message: ${existingText || 'empty'}`,
                  'Task: create a clear customer message draft for HUNDESALON NIKA contact form.',
                  'Output: plain text only, 70-120 words, with specific request details and preferred contact follow-up.',
                ].join('\n'),
              },
            ],
          });

          const draftText = normalizeDraftMessage(payload?.choices?.[0]?.message?.content);
          if (!draftText) {
            throw new Error('Draft response is empty');
          }

          messageField.value = draftText;
          status.className = 'message-draft-status message-draft-status--success';
          status.textContent = messageDraftCopy.done[pageLang] ?? messageDraftCopy.done.de;
        } catch (error) {
          status.className = 'message-draft-status message-draft-status--error';
          status.textContent =
            error?.message === 'LOCAL_CF_DEV_REQUIRED'
              ? (messageDraftCopy.localDevHint[pageLang] ?? messageDraftCopy.localDevHint.de)
              : error?.message === 'DRAFT_SERVICE_UNCONFIGURED'
                ? (messageDraftCopy.apiKeyMissing[pageLang] ?? messageDraftCopy.apiKeyMissing.de)
                : (messageDraftCopy.failed[pageLang] ?? messageDraftCopy.failed.de);
        } finally {
          button.disabled = false;
        }
      });
    });
  };

  const resolveHashTarget = hashHref => {
    if (!hashHref || hashHref === '#') return null;
    const rawId = hashHref.startsWith('#') ? hashHref.slice(1) : hashHref;
    if (!rawId || !/^[A-Za-z][\w-]*$/.test(rawId)) {
      return null;
    }
    return document.getElementById(rawId);
  };

  const initSmoothHashLinks = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;

      anchor.addEventListener('click', event => {
        const target = resolveHashTarget(targetId);
        if (!target) return;

        event.preventDefault();

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
          inline: 'nearest',
        });

        if (scrollRoot) {
          window.requestAnimationFrame(() => {
            scrollRoot.dispatchEvent(new Event('scroll'));
          });
        }
      });
    });
  };

  const initBookingModal = () => {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;

    const closeControl = modal.querySelector('.modal-close');
    const closeTriggers = modal.querySelectorAll('[data-booking-close]');
    const form = modal.querySelector('#booking-form');
    const serviceList = modal.querySelector('#service-list');
    const calendarContainer = modal.querySelector('#calendar-container');
    const timeSlotsContainer = modal.querySelector('#time-slots-container');
    const selectedServiceField = modal.querySelector('#selected-service');
    const selectedDateField = modal.querySelector('#selected-date');
    const selectedTimeField = modal.querySelector('#selected-time');
    const bookingFileInput = modal.querySelector('input[name="pet_photo"]');
    const privacyInput = modal.querySelector('input[name="privacy_consent"]');
    const paymentInput = modal.querySelector('input[name="payment_now"]');
    const uploadedFileUrlField = modal.querySelector('input[name="uploaded_file_url"]');
    const bookingSummary = modal.querySelector('[data-booking-summary]');
    const bookingFilePreview = modal.querySelector('[data-booking-file-preview]');
    const steps = Array.from(modal.querySelectorAll('.step'));
    const panels = {
      1: modal.querySelector('#step-1'),
      2: modal.querySelector('#step-2'),
      3: modal.querySelector('#step-3'),
    };
    const nextStep1 = modal.querySelector('#next-step-1');
    const nextStep2 = modal.querySelector('#next-step-2');
    const prevStep2 = modal.querySelector('#prev-step-2');
    const prevStep3 = modal.querySelector('#prev-step-3');
    const openTriggers = document.querySelectorAll('#open-booking-btn, .select-service-btn, .online-order-btn');

    if (
      !form ||
      !serviceList ||
      !calendarContainer ||
      !timeSlotsContainer ||
      !selectedServiceField ||
      !selectedDateField ||
      !selectedTimeField
    ) {
      return;
    }

    // Add missing accessibility hooks without having to duplicate markup across all pages.
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');

    if (closeControl) {
      closeControl.setAttribute('aria-label', bookingCopy.closeModal);

      if (closeControl.tagName !== 'BUTTON') {
        closeControl.setAttribute('role', 'button');
        closeControl.setAttribute('tabindex', '0');
      }
    }

    const validationMessage = document.createElement('p');
    validationMessage.className = 'booking-validation-message';
    validationMessage.hidden = true;
    validationMessage.setAttribute('aria-live', 'assertive');
    validationMessage.setAttribute('aria-hidden', 'true');
    validationMessage.setAttribute('tabindex', '-1');
    form.prepend(validationMessage);

    const state = {
      step: 1,
      selectedService: selectedServiceField.value || '',
      selectedDate: selectedDateField.value || '',
      selectedTime: selectedTimeField.value || '',
      summaryConfirmed: false,
      uploadedFileUrl: uploadedFileUrlField?.value || '',
    };
    let lastFocusedElement = null;
    const formatLocalDate = date => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const syncHiddenFields = () => {
      selectedServiceField.value = state.selectedService;
      selectedDateField.value = state.selectedDate;
      selectedTimeField.value = state.selectedTime;
      if (uploadedFileUrlField) {
        uploadedFileUrlField.value = state.uploadedFileUrl;
      }
    };

    const resetSummaryConfirmation = () => {
      state.summaryConfirmed = false;
      bookingSummary?.setAttribute('hidden', 'hidden');
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn && submitBtn.dataset.originalText) {
        submitBtn.textContent = submitBtn.dataset.originalText;
      }
    };

    const clearValidationMessage = () => {
      validationMessage.textContent = '';
      validationMessage.hidden = true;
      validationMessage.classList.remove('is-visible');
      validationMessage.setAttribute('aria-hidden', 'true');
    };

    const showValidationMessage = (message, focusTarget) => {
      validationMessage.textContent = message;
      validationMessage.hidden = false;
      validationMessage.classList.add('is-visible');
      validationMessage.setAttribute('aria-hidden', 'false');

      window.requestAnimationFrame(() => {
        (focusTarget || validationMessage)?.focus?.({ preventScroll: true });
      });
    };

    const isFutureDate = value => {
      if (!value) {
        return false;
      }
      const selected = new Date(`${value}T00:00:00`);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return selected >= today;
    };

    const validateBookingFile = () => {
      const file = bookingFileInput?.files?.[0];
      if (!file) {
        return true;
      }

      const allowedTypes = ['image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        showValidationMessage(bookingCopy.fileType, bookingFileInput);
        return false;
      }

      if (file.size > 5 * 1024 * 1024) {
        showValidationMessage(bookingCopy.fileSize, bookingFileInput);
        return false;
      }

      return true;
    };

    const renderFilePreview = () => {
      if (!bookingFilePreview || !bookingFileInput) {
        return;
      }

      const file = bookingFileInput.files?.[0];
      if (!file) {
        bookingFilePreview.hidden = true;
        bookingFilePreview.innerHTML = '';
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      bookingFilePreview.hidden = false;
      bookingFilePreview.innerHTML = `
        <span>${bookingCopy.labels.file}: ${file.name}</span>
        <img src="${previewUrl}" alt="" loading="lazy">
      `;
    };

    const ensureBookingFileUploaded = async () => {
      const file = bookingFileInput?.files?.[0];
      if (!file || state.uploadedFileUrl) {
        return true;
      }

      const uploadData = new FormData();
      uploadData.append('file', file);
      uploadData.append('lang', pageLang);
      uploadData.append('service', state.selectedService);
      uploadData.append('date', state.selectedDate);
      uploadData.append('time', state.selectedTime);

      try {
        const response = await fetch('/upload', {
          method: 'POST',
          body: uploadData,
          headers: { Accept: 'application/json' },
        });
        const result = await response.json().catch(() => ({}));
        if (response.ok && result.success && result.fileUrl) {
          state.uploadedFileUrl = result.fileUrl;
          syncHiddenFields();
          if (bookingFilePreview) {
            bookingFilePreview.hidden = false;
            const link = document.createElement('a');
            link.href = result.fileUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = result.fileUrl;
            bookingFilePreview.appendChild(link);
          }
        }
        return true;
      } catch {
        return true;
      }
    };

    const renderBookingSummary = ({ nameValue, emailValue, phoneValue }) => {
      if (!bookingSummary) {
        return;
      }

      const labels = bookingCopy.labels;
      const file = bookingFileInput?.files?.[0];
      const paymentLabel = paymentInput?.checked ? labels.payNow : labels.payLater;
      const rows = [
        [labels.service, state.selectedService],
        [labels.date, state.selectedDate],
        [labels.time, state.selectedTime],
        [labels.name, nameValue],
        [labels.email, emailValue],
        [labels.phone, phoneValue],
        [labels.payment, paymentLabel],
        [labels.file, state.uploadedFileUrl || file?.name || labels.noFile],
      ];

      bookingSummary.innerHTML = `
        <h4>${bookingCopy.summaryTitle}</h4>
        <dl>
          ${rows.map(([label, value]) => `<dt>${label}</dt><dd>${value || '—'}</dd>`).join('')}
        </dl>
      `;
      bookingSummary.hidden = false;
    };

    const setStep = step => {
      state.step = step;
      clearValidationMessage();

      Object.entries(panels).forEach(([key, panel]) => {
        panel?.classList.toggle('active', Number(key) === step);
      });

      steps.forEach((item, index) => {
        const isActive = index + 1 === step;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-current', isActive ? 'step' : 'false');
      });
    };

    const renderServiceList = () => {
      serviceList.innerHTML = '';
      const services =
        bookingCopy.services.includes(state.selectedService) || !state.selectedService
          ? bookingCopy.services
          : [state.selectedService, ...bookingCopy.services];

      services.forEach(serviceName => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'service-option';
        button.textContent = serviceName;
        button.classList.toggle('selected', state.selectedService === serviceName);

        button.addEventListener('click', () => {
          state.selectedService = serviceName;
          syncHiddenFields();
          resetSummaryConfirmation();
          clearValidationMessage();
          renderServiceList();
        });

        serviceList.appendChild(button);
      });
    };

    const renderCalendar = () => {
      const today = new Date();
      const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      let startDayOfWeek = firstDay.getDay();
      let dayNumber = 1;

      if (startDayOfWeek === 0) {
        startDayOfWeek = 7;
      }

      const calendar = document.createElement('div');
      calendar.className = 'calendar';

      bookingCopy.weekdays.forEach(weekday => {
        const cell = document.createElement('div');
        cell.className = 'calendar-weekday';
        cell.textContent = weekday;
        calendar.appendChild(cell);
      });

      for (let index = 0; index < 42; index += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'calendar-day';

        if (index < startDayOfWeek - 1 || dayNumber > lastDay.getDate()) {
          cell.classList.add('is-empty');
          cell.setAttribute('tabindex', '-1');
          cell.setAttribute('aria-hidden', 'true');
          calendar.appendChild(cell);
          continue;
        }

        const date = new Date(today.getFullYear(), today.getMonth(), dayNumber);
        const isoDate = formatLocalDate(date);
        const isPastDay = date < normalizedToday;

        cell.textContent = String(dayNumber);
        cell.dataset.date = isoDate;
        cell.classList.toggle('selected', state.selectedDate === isoDate);

        if (isPastDay) {
          cell.classList.add('is-disabled');
          cell.disabled = true;
        } else {
          cell.addEventListener('click', () => {
            state.selectedDate = isoDate;
            syncHiddenFields();
            resetSummaryConfirmation();
            clearValidationMessage();
            renderCalendar();
          });
        }

        calendar.appendChild(cell);
        dayNumber += 1;
      }

      calendarContainer.innerHTML = '';
      calendarContainer.appendChild(calendar);
    };

    const renderTimeSlots = () => {
      const timeSlots = [
        '09:00',
        '10:00',
        '11:00',
        '12:00',
        '13:00',
        '14:00',
        '15:00',
        '16:00',
        '17:00',
        '18:00',
        '19:00',
      ];
      timeSlotsContainer.innerHTML = '';

      timeSlots.forEach(time => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'time-slot';
        button.textContent = time;
        button.classList.toggle('selected', state.selectedTime === time);

        button.addEventListener('click', () => {
          state.selectedTime = time;
          syncHiddenFields();
          resetSummaryConfirmation();
          clearValidationMessage();
          renderTimeSlots();
        });

      timeSlotsContainer.appendChild(button);
      });
    };

    const bindNativeBookingFields = () => {
      const today = formatLocalDate(new Date());
      selectedDateField.setAttribute('min', today);
      selectedTimeField.setAttribute('min', '09:00');
      selectedTimeField.setAttribute('max', '19:00');

      selectedDateField.addEventListener('change', () => {
        state.selectedDate = selectedDateField.value;
        resetSummaryConfirmation();
        clearValidationMessage();
        renderCalendar();
      });

      selectedTimeField.addEventListener('change', () => {
        state.selectedTime = selectedTimeField.value;
        resetSummaryConfirmation();
        clearValidationMessage();
        renderTimeSlots();
      });

      form.querySelectorAll('input, textarea, select').forEach(control => {
        control.addEventListener('input', resetSummaryConfirmation);
        control.addEventListener('change', resetSummaryConfirmation);
      });

      bookingFileInput?.addEventListener('change', () => {
        state.uploadedFileUrl = '';
        syncHiddenFields();
        resetSummaryConfirmation();
        clearValidationMessage();
        if (validateBookingFile()) {
          renderFilePreview();
        }
      });
    };

    const resolveServiceFromTrigger = trigger => {
      const wrapper = trigger.closest('.select-btn-wrapper');
      const fromData = wrapper?.dataset.service?.trim();

      if (fromData) return fromData;

      const rowLabel = wrapper?.previousElementSibling?.querySelector('tbody tr td:first-child')?.textContent?.trim();
      return rowLabel || bookingCopy.fallbackService;
    };

    const openModal = (serviceName = '') => {
      lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      state.step = 1;
      state.selectedService = serviceName || state.selectedService;
      state.summaryConfirmed = false;
      clearValidationMessage();
      resetSummaryConfirmation();
      modal.classList.remove('booking-modal-sent');
      syncHiddenFields();
      setStep(1);
      renderServiceList();
      modal.classList.add('active');
      modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('booking-modal-open');

      window.requestAnimationFrame(() => {
        modal.querySelector('.service-option.selected, .service-option, input, button')?.focus();
      });
    };

    const closeModal = () => {
      clearValidationMessage();
      resetSummaryConfirmation();
      modal.classList.remove('booking-modal-sent');
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('booking-modal-open');
      lastFocusedElement?.focus();
    };

    const moveToDateStep = () => {
      if (!state.selectedService) {
        showValidationMessage(
          bookingCopy.chooseService,
          serviceList.querySelector('.service-option.selected, .service-option')
        );
        return;
      }

      setStep(2);
      renderCalendar();
      renderTimeSlots();
    };

    const moveToContactStep = () => {
      if (!state.selectedDate) {
        showValidationMessage(
          bookingCopy.chooseDate,
          calendarContainer.querySelector('.calendar-day.selected, .calendar-day:not(.is-empty):not(.is-disabled)')
        );
        return;
      }

      if (!isFutureDate(state.selectedDate)) {
        showValidationMessage(bookingCopy.dateInPast, selectedDateField);
        return;
      }

      if (!state.selectedTime) {
        showValidationMessage(
          bookingCopy.chooseTime,
          timeSlotsContainer.querySelector('.time-slot.selected, .time-slot')
        );
        return;
      }

      setStep(3);
    };

    openTriggers.forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        const preselectedService = trigger.id === 'open-booking-btn' ? '' : resolveServiceFromTrigger(trigger);
        openModal(preselectedService);
      });
    });

    nextStep1?.addEventListener('click', moveToDateStep);
    nextStep2?.addEventListener('click', moveToContactStep);
    prevStep2?.addEventListener('click', () => setStep(1));
    prevStep3?.addEventListener('click', () => setStep(2));
    closeTriggers.forEach(trigger => {
      trigger.addEventListener('click', closeModal);
    });
    closeControl?.addEventListener('click', closeModal);
    closeControl?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeModal();
      }
    });

    modal.addEventListener('click', event => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      clearValidationMessage();
      syncHiddenFields();

      if (!state.selectedService) {
        setStep(1);
        showValidationMessage(
          bookingCopy.chooseService,
          serviceList.querySelector('.service-option.selected, .service-option')
        );
        return;
      }

      if (!state.selectedDate) {
        setStep(2);
        renderCalendar();
        renderTimeSlots();
        showValidationMessage(
          bookingCopy.chooseDate,
          calendarContainer.querySelector('.calendar-day.selected, .calendar-day:not(.is-empty):not(.is-disabled)')
        );
        return;
      }

      if (!isFutureDate(state.selectedDate)) {
        setStep(2);
        renderCalendar();
        renderTimeSlots();
        showValidationMessage(bookingCopy.dateInPast, selectedDateField);
        return;
      }

      if (!state.selectedTime) {
        setStep(2);
        renderCalendar();
        renderTimeSlots();
        showValidationMessage(
          bookingCopy.chooseTime,
          timeSlotsContainer.querySelector('.time-slot.selected, .time-slot')
        );
        return;
      }

      const nameValue = form.querySelector('input[name="name"]')?.value?.trim() ?? '';
      const emailValue = form.querySelector('input[name="email"]')?.value?.trim() ?? '';
      const phoneValue = form.querySelector('input[name="phone"]')?.value?.trim() ?? '';

      if (!nameValue || !emailValue || !phoneValue) {
        setStep(3);
        showValidationMessage(
          bookingCopy.chooseContact,
          form.querySelector(
            !nameValue
              ? 'input[name="name"]'
              : !emailValue
                ? 'input[name="email"]'
                : 'input[name="phone"]'
          )
        );
        return;
      }

      if (!validateBookingFile()) {
        setStep(3);
        return;
      }

      if (privacyInput && !privacyInput.checked) {
        setStep(3);
        showValidationMessage(bookingCopy.choosePrivacy, privacyInput);
        return;
      }

      if (!state.summaryConfirmed) {
        renderBookingSummary({ nameValue, emailValue, phoneValue });
        state.summaryConfirmed = true;
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
          submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.textContent;
          submitBtn.textContent = bookingCopy.summaryConfirm;
        }
        window.requestAnimationFrame(() => bookingSummary?.focus?.({ preventScroll: true }));
        return;
      }

      await ensureBookingFileUploaded();
      const submitBtn = form.querySelector('[type="submit"]');
      const sent = await submitSendmailForm(form, submitBtn);
      if (sent) {
        modal.classList.add('booking-modal-sent');
        state.selectedService = '';
        state.selectedDate = '';
        state.selectedTime = '';
        state.summaryConfirmed = false;
        state.uploadedFileUrl = '';
        syncHiddenFields();
        resetSummaryConfirmation();
        renderFilePreview();
      }
    });

    bindNativeBookingFields();
  };

  initSendmailForms();
  initMessageDraftTools();
  initSmoothHashLinks();
  initBookingModal();
});
