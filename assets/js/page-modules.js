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
      services: ['Стрижка собак', 'Купание', 'Тримминг', 'Экспресс-линька', 'Стрижка кошек', 'Ваши предложения'],
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
      datetimePickDate: 'Сначала выберите дату в календаре',
      datetimePickTime: 'Теперь выберите удобное время',
      datetimeDateChosen: 'Дата выбрана',
    },
    uk: {
      weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
      services: ['Стрижка собак', 'Купання', 'Тримінг', 'Експрес-линька', 'Стрижка котів', 'Ваші пропозиції'],
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
      datetimePickDate: 'Спочатку оберіть дату в календарі',
      datetimePickTime: 'Тепер оберіть зручний час',
      datetimeDateChosen: 'Дату обрано',
    },
    en: {
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      services: ['Dog haircut', 'Bathing', 'Hand stripping', 'Express deshedding', 'Cat grooming', 'Your suggestions'],
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
      datetimePickDate: 'Start by choosing a date in the calendar',
      datetimePickTime: 'Now pick a convenient time',
      datetimeDateChosen: 'Date selected',
    },
    de: {
      weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      services: ['Hundeschnitt', 'Baden', 'Trimming', 'Express-Fellwechselpflege', 'Katzenpflege', 'Ihre Vorschläge'],
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
      datetimePickDate: 'Wählen Sie zuerst ein Datum im Kalender',
      datetimePickTime: 'Wählen Sie nun eine passende Uhrzeit',
      datetimeDateChosen: 'Datum gewählt',
    },
  };

  const bookingLocaleByLang = {
    ru: 'ru-RU',
    uk: 'uk-UA',
    en: 'en-GB',
    de: 'de-DE',
  };
  const bookingLocale = bookingLocaleByLang[pageLang] || bookingLocaleByLang.en;
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
      en: url =>
        `This local page is running without server sending. Open ${url} and the booking form will submit correctly.`,
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
    authFailed: {
      ru: 'Сервис черновиков временно недоступен из-за ошибки авторизации.',
      uk: 'Сервіс чернеток тимчасово недоступний через помилку авторизації.',
      en: 'Draft service is temporarily unavailable due to authorization issues.',
      de: 'Der Entwurfsdienst ist vorübergehend wegen eines Autorisierungsfehlers nicht verfügbar.',
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
                : error?.message === 'SERVICE_GATEWAY_AUTH_FAILED'
                  ? (messageDraftCopy.authFailed[pageLang] ?? messageDraftCopy.authFailed.de)
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

    if (modal.closest('.site-scroll-root')) {
      document.body.appendChild(modal);
    }

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

    const step2Panel = panels[2];
    const nativeFieldsGrid = modal.querySelector('[data-booking-native-fields]');
    let datetimeBody = step2Panel?.querySelector('.booking-datetime-body');
    let datetimeStatusEl = step2Panel?.querySelector('[data-booking-datetime-status]');
    let calendarBlockEl = step2Panel?.querySelector('.booking-datetime-block--calendar');
    let timeBlockEl = step2Panel?.querySelector('.booking-datetime-block--time');
    let choiceRowEl = step2Panel?.querySelector('[data-booking-datetime-choice]');
    let monthTitleEl = step2Panel?.querySelector('[data-booking-month-title]');
    let timeHintEl = step2Panel?.querySelector('[data-booking-time-hint]');
    let choiceDateEl = step2Panel?.querySelector('[data-booking-choice-date]');
    let choiceTimeEl = step2Panel?.querySelector('[data-booking-choice-time]');

    const formatDisplayDate = isoDate => {
      if (!isoDate) {
        return '';
      }

      const [year, month, day] = isoDate.split('-').map(Number);
      return new Intl.DateTimeFormat(bookingLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(year, month - 1, day));
    };

    const formatMonthTitle = referenceDate => {
      return new Intl.DateTimeFormat(bookingLocale, {
        month: 'long',
        year: 'numeric',
      }).format(referenceDate);
    };

    const ensureDatetimeBlock = (className, kickerText, metaSelector) => {
      const blockSelector = `.${className.split(' ')[0]}`;
      let blockEl = step2Panel?.querySelector(blockSelector);

      if (!blockEl) {
        blockEl = document.createElement('section');
        blockEl.className = `booking-datetime-block ${className}`;
        blockEl.innerHTML = `
          <div class="booking-datetime-block__head">
            <span class="booking-datetime-block__kicker"></span>
            <span class="booking-datetime-block__meta" ${metaSelector}></span>
          </div>`;
        blockEl.querySelector('.booking-datetime-block__kicker').textContent = kickerText;
      }

      return blockEl;
    };

    const buildDatetimeStepLayout = () => {
      if (!step2Panel) {
        return;
      }

      const step2Buttons = step2Panel.querySelector('.modal-buttons');

      step2Panel.querySelector('[data-booking-datetime-summary]')?.remove();
      step2Panel.querySelectorAll('.booking-datetime-section').forEach(section => {
        if (calendarContainer.parentElement === section) {
          section.removeChild(calendarContainer);
        }

        if (timeSlotsContainer.parentElement === section) {
          section.removeChild(timeSlotsContainer);
        }

        section.remove();
      });
      step2Panel.querySelector('.booking-datetime-panels')?.remove();

      if (!datetimeBody) {
        datetimeBody = document.createElement('div');
        datetimeBody.className = 'booking-datetime-body';
        step2Panel.insertBefore(datetimeBody, step2Buttons);
      }

      if (!datetimeStatusEl) {
        datetimeStatusEl = document.createElement('div');
        datetimeStatusEl.className = 'booking-datetime-status';
        datetimeStatusEl.dataset.bookingDatetimeStatus = '';
        datetimeStatusEl.dataset.state = 'date';
      }

      calendarBlockEl = ensureDatetimeBlock(
        'booking-datetime-block--calendar',
        bookingCopy.labels.date,
        'data-booking-month-title'
      );
      monthTitleEl = calendarBlockEl.querySelector('[data-booking-month-title]');

      timeBlockEl = ensureDatetimeBlock(
        'booking-datetime-block--time is-awaiting-date',
        bookingCopy.labels.time,
        'data-booking-time-hint'
      );
      timeHintEl = timeBlockEl.querySelector('[data-booking-time-hint]');

      if (!choiceRowEl) {
        choiceRowEl = document.createElement('div');
        choiceRowEl.className = 'booking-datetime-choice';
        choiceRowEl.dataset.bookingDatetimeChoice = '';
        choiceRowEl.innerHTML = `
          <div class="booking-datetime-choice__item" data-booking-choice-item="date" data-filled="false">
            <span class="booking-datetime-choice__label"></span>
            <span class="booking-datetime-choice__value" data-booking-choice-date>—</span>
          </div>
          <div class="booking-datetime-choice__item" data-booking-choice-item="time" data-filled="false">
            <span class="booking-datetime-choice__label"></span>
            <span class="booking-datetime-choice__value" data-booking-choice-time>—</span>
          </div>`;
        choiceRowEl.querySelector('[data-booking-choice-item="date"] .booking-datetime-choice__label').textContent =
          bookingCopy.labels.date;
        choiceRowEl.querySelector('[data-booking-choice-item="time"] .booking-datetime-choice__label').textContent =
          bookingCopy.labels.time;
      }

      choiceDateEl = choiceRowEl.querySelector('[data-booking-choice-date]');
      choiceTimeEl = choiceRowEl.querySelector('[data-booking-choice-time]');

      calendarBlockEl.appendChild(calendarContainer);
      timeBlockEl.appendChild(timeSlotsContainer);

      datetimeBody.append(datetimeStatusEl, calendarBlockEl, timeBlockEl, choiceRowEl);

      if (nativeFieldsGrid) {
        nativeFieldsGrid.classList.add('booking-native-grid--hidden');
        if (form && nativeFieldsGrid.parentElement !== form) {
          form.append(nativeFieldsGrid);
        }
      }
    };

    const updateDatetimeStepState = () => {
      const hasDate = Boolean(state.selectedDate);
      const hasTime = Boolean(state.selectedTime);
      const monthReference = hasDate
        ? (() => {
            const [year, month, day] = state.selectedDate.split('-').map(Number);
            return new Date(year, month - 1, day);
          })()
        : new Date();

      timeBlockEl?.classList.toggle('is-awaiting-date', !hasDate);
      timeBlockEl?.classList.toggle('is-ready', hasDate && !hasTime);
      timeBlockEl?.classList.toggle('is-complete', hasTime);

      timeSlotsContainer.classList.toggle('is-awaiting-date', !hasDate);
      timeSlotsContainer.classList.toggle('is-ready', hasDate && !hasTime);
      timeSlotsContainer.classList.toggle('is-complete', hasTime);

      if (datetimeStatusEl) {
        if (!hasDate) {
          datetimeStatusEl.textContent = bookingCopy.datetimePickDate;
          datetimeStatusEl.dataset.state = 'date';
        } else if (!hasTime) {
          datetimeStatusEl.textContent = `${bookingCopy.datetimeDateChosen}: ${formatDisplayDate(state.selectedDate)}`;
          datetimeStatusEl.dataset.state = 'time';
        } else {
          datetimeStatusEl.textContent = `${formatDisplayDate(state.selectedDate)} · ${state.selectedTime}`;
          datetimeStatusEl.dataset.state = 'ready';
        }
      }

      if (timeHintEl) {
        timeHintEl.textContent = hasDate ? bookingCopy.datetimePickTime : bookingCopy.datetimePickDate;
      }

      if (monthTitleEl) {
        monthTitleEl.textContent = formatMonthTitle(monthReference);
      }

      if (choiceDateEl) {
        choiceDateEl.textContent = hasDate ? formatDisplayDate(state.selectedDate) : '—';
        choiceDateEl.closest('[data-booking-choice-item]')?.setAttribute('data-filled', hasDate ? 'true' : 'false');
      }

      if (choiceTimeEl) {
        choiceTimeEl.textContent = hasTime ? state.selectedTime : '—';
        choiceTimeEl.closest('[data-booking-choice-item]')?.setAttribute('data-filled', hasTime ? 'true' : 'false');
      }

      if (selectedTimeField) {
        selectedTimeField.disabled = !hasDate;
        if (!hasDate) {
          selectedTimeField.value = '';
        }
      }

      window.requestAnimationFrame(refreshDatetimeScrollState);
    };

    buildDatetimeStepLayout();

    const bookingScrollbars = {
      services: null,
      calendarDays: null,
      timeSlots: null,
      form: null,
    };

    const bindBookingScrollbar = (scrollTarget, thumbParent = scrollTarget) => {
      const bind = window.HundesalonLiquidScrollbar?.bind;
      if (!bind || !scrollTarget || scrollTarget.dataset.customScrollbarBound === 'true') {
        return null;
      }

      scrollTarget.setAttribute('data-custom-scrollbar-host', '');

      return bind({
        scrollTarget,
        thumbParent,
        thumbClass: 'custom-scrollbar-thumb--panel',
        viewportPadding: 10,
        minHeight: 34,
      });
    };

    const getCalendarDaysScroll = () => calendarContainer?.querySelector('.calendar-days-scroll');

    const ensureBookingScrollbars = () => {
      if (!bookingScrollbars.services) {
        bookingScrollbars.services = bindBookingScrollbar(serviceList, serviceList);
      }

      const calendarDaysScroll = getCalendarDaysScroll();
      if (calendarDaysScroll && calendarDaysScroll.dataset.customScrollbarBound !== 'true') {
        bookingScrollbars.calendarDays = bindBookingScrollbar(
          calendarDaysScroll,
          calendarBlockEl || calendarDaysScroll
        );
      }

      if (timeSlotsContainer && timeSlotsContainer.dataset.customScrollbarBound !== 'true') {
        bookingScrollbars.timeSlots = bindBookingScrollbar(timeSlotsContainer, timeBlockEl || timeSlotsContainer);
      }

      const step3Form = panels[3]?.querySelector('form');
      if (step3Form && !bookingScrollbars.form && step3Form.dataset.customScrollbarBound !== 'true') {
        bookingScrollbars.form = bindBookingScrollbar(step3Form, step3Form);
      }
    };

    const refreshBookingScrollbars = () => {
      Object.values(bookingScrollbars).forEach(handle => {
        handle?.updateThumb?.();
      });
    };

    ensureBookingScrollbars();

    const stepIndicator = modal.querySelector('.step-indicator');
    const modalContent = modal.querySelector('.modal-content');
    const modalButtonRows = modal.querySelectorAll('.modal-buttons');
    const BOOKING_STEP_MOTION_MS = 420;
    let stepMotionTimer = null;
    let tiltResetTimer = null;

    const ensureBookingGlassLayers = () => {
      if (!modalContent || modalContent.querySelector('.booking-glass-lens')) {
        return;
      }

      const lens = document.createElement('span');
      lens.className = 'booking-glass-lens booking-glass-layer';
      lens.setAttribute('aria-hidden', 'true');

      const caustic = document.createElement('span');
      caustic.className = 'booking-glass-caustic booking-glass-layer';
      caustic.setAttribute('aria-hidden', 'true');

      modalContent.insertBefore(caustic, modalContent.firstChild);
      modalContent.insertBefore(lens, modalContent.firstChild);
    };

    const resetBookingTilt = () => {
      modalContent?.style.setProperty('--booking-tilt-x', '0deg');
      modalContent?.style.setProperty('--booking-tilt-y', '0deg');
      modal.classList.remove('is-tilting');
    };

    const handleBookingPointerMove = event => {
      if (!modal.classList.contains('active') || !modalContent || modal.classList.contains('is-closing')) {
        return;
      }

      const rect = modalContent.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      modal.classList.add('is-tilting');
      modalContent.style.setProperty('--booking-tilt-y', `${(x * 4.2).toFixed(2)}deg`);
      modalContent.style.setProperty('--booking-tilt-x', `${(-y * 3.1).toFixed(2)}deg`);

      if (tiltResetTimer) {
        window.clearTimeout(tiltResetTimer);
      }

      tiltResetTimer = window.setTimeout(() => {
        resetBookingTilt();
        tiltResetTimer = null;
      }, 900);
    };

    ensureBookingGlassLayers();

    if (window.matchMedia('(pointer: fine)').matches) {
      modal.addEventListener('pointermove', handleBookingPointerMove, { passive: true });
      modal.addEventListener('pointerleave', resetBookingTilt, { passive: true });
    }

    serviceList.classList.add('nav-main');
    timeSlotsContainer.classList.add('nav-main');
    stepIndicator?.classList.add('nav-main');
    modalButtonRows.forEach(row => row.classList.add('nav-main'));

    const sanitizeModalActionButtons = () => {
      modal.querySelectorAll('.modal-buttons .filter-btn').forEach(button => {
        button.classList.remove('online-order-pill', 'booking-modal-cta', 'active');
        button.removeAttribute('aria-current');
        button.setAttribute('aria-selected', 'false');
        button.querySelectorAll('.nav-plasma--active, .nav-plasma').forEach(layer => layer.remove());
        window.HundesalonNavPill?.deactivate?.(button);
        delete button.dataset.navPillBound;
      });
    };

    modal.querySelectorAll('.btn-modal:not(.btn-modal-primary)').forEach(button => {
      button.classList.add('filter-btn');
    });
    modal.querySelectorAll('.btn-modal-primary').forEach(button => {
      button.classList.remove('online-order-pill', 'booking-modal-cta');
      button.classList.add('filter-btn');
    });
    sanitizeModalActionButtons();

    document.querySelectorAll('.select-btn-wrapper').forEach(wrapper => {
      wrapper.classList.add('nav-main');
      wrapper.querySelector('.select-service-btn')?.classList.add('filter-btn');
    });

    const scanBookingNavPills = (root = modal) => {
      window.HundesalonNavPill?.scan?.(root);
    };

    const clearBookingPillGroup = buttons => {
      buttons.forEach(button => {
        button.classList.remove('active', 'selected');
        button.setAttribute('aria-selected', 'false');
        button.removeAttribute('aria-current');
        window.HundesalonNavPill?.deactivate?.(button);
      });
    };

    const activateBookingPill = button => {
      if (!button) {
        return;
      }

      button.classList.add('active');
      button.classList.remove('selected');
      button.setAttribute('aria-selected', 'true');
      button.setAttribute('aria-current', 'true');
      window.HundesalonNavPill?.activate?.(button);
    };

    const siteScrollRoot = document.querySelector('.site-scroll-root');
    let savedSiteScrollTop = 0;
    let wheelBlockHandler = null;
    let touchBlockHandler = null;

    const refreshDatetimeScrollState = () => {
      if (!datetimeBody) {
        return;
      }

      datetimeBody.classList.remove('has-overflow', 'can-scroll-more');
    };

    const lockSiteScroll = () => {
      savedSiteScrollTop = siteScrollRoot?.scrollTop || 0;
      siteScrollRoot?.classList.add('booking-scroll-locked');
      document.documentElement.classList.add('booking-modal-open');
      document.body.classList.add('booking-modal-open');

      const resolveBookingWheelScrollTarget = target => {
        const candidates = [
          target.closest('#booking-modal .calendar-days-scroll'),
          target.closest('#booking-modal #time-slots-container'),
          target.closest('#booking-modal .service-list'),
          target.closest('#booking-modal #booking-form'),
        ].filter(Boolean);

        return candidates.find(element => element.scrollHeight > element.clientHeight + 2) || null;
      };

      wheelBlockHandler = event => {
        if (!modal.classList.contains('active')) {
          return;
        }

        const scrollable = resolveBookingWheelScrollTarget(event.target);
        if (!scrollable) {
          event.preventDefault();
          return;
        }

        const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
        const atTop = scrollable.scrollTop <= 0;
        const atBottom = scrollable.scrollTop >= maxScroll - 1;
        if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
          event.preventDefault();
        }
      };

      touchBlockHandler = event => {
        if (!modal.classList.contains('active')) {
          return;
        }

        if (
          event.target.closest(
            '.calendar-days-scroll, #time-slots-container, .service-list, #booking-form, .modal-content'
          )
        ) {
          return;
        }

        event.preventDefault();
      };

      document.addEventListener('wheel', wheelBlockHandler, { passive: false, capture: true });
      document.addEventListener('touchmove', touchBlockHandler, { passive: false, capture: true });
    };

    const unlockSiteScroll = () => {
      siteScrollRoot?.classList.remove('booking-scroll-locked');
      if (siteScrollRoot) {
        siteScrollRoot.scrollTop = savedSiteScrollTop;
      }
      document.documentElement.classList.remove('booking-modal-open');
      document.body.classList.remove('booking-modal-open');

      if (wheelBlockHandler) {
        document.removeEventListener('wheel', wheelBlockHandler, { capture: true });
        wheelBlockHandler = null;
      }

      if (touchBlockHandler) {
        document.removeEventListener('touchmove', touchBlockHandler, { capture: true });
        touchBlockHandler = null;
      }
    };

    const updateStepTabs = () => {
      steps.forEach((item, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === state.step;
        const isComplete = stepNumber < state.step;

        item.classList.toggle('is-complete', isComplete);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        item.setAttribute('tabindex', isActive ? '0' : '-1');

        if (isActive) {
          activateBookingPill(item);
        } else {
          item.classList.remove('active');
          item.removeAttribute('aria-current');
          window.HundesalonNavPill?.deactivate?.(item);
        }
      });
    };

    const navigateToStep = targetStep => {
      if (targetStep === state.step) {
        return;
      }

      if (targetStep < state.step) {
        setStep(targetStep);
        return;
      }

      if (targetStep === 2) {
        moveToDateStep();
        return;
      }

      if (targetStep === 3) {
        if (!state.selectedService) {
          setStep(1);
          showValidationMessage(
            bookingCopy.chooseService,
            serviceList.querySelector('.service-option.active, .service-option')
          );
          return;
        }

        moveToContactStep();
      }
    };

    if (stepIndicator) {
      stepIndicator.setAttribute('role', 'tablist');
    }

    steps.forEach((stepEl, index) => {
      const stepNumber = index + 1;
      stepEl.classList.add('filter-btn');
      stepEl.setAttribute('role', 'tab');
      stepEl.dataset.bookingStep = String(stepNumber);

      if (stepEl.tagName !== 'BUTTON') {
        stepEl.setAttribute('tabindex', stepNumber === 1 ? '0' : '-1');
      }

      stepEl.addEventListener('click', () => navigateToStep(stepNumber));
      stepEl.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigateToStep(stepNumber);
        }
      });
    });

    timeSlotsContainer?.addEventListener('scroll', refreshDatetimeScrollState, { passive: true });
    window.addEventListener('resize', refreshDatetimeScrollState, { passive: true });

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

    const normalizeUploadedFileUrl = rawUrl => {
      try {
        const parsed = new URL(String(rawUrl || ''), window.location.origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return '';
        }
        if (parsed.origin !== window.location.origin) {
          return '';
        }
        if (!parsed.pathname.startsWith('/uploads/')) {
          return '';
        }
        return parsed.toString();
      } catch {
        return '';
      }
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
        bookingFilePreview.replaceChildren();
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      bookingFilePreview.hidden = false;
      bookingFilePreview.replaceChildren();
      const fileLabel = document.createElement('span');
      fileLabel.textContent = `${bookingCopy.labels.file}: ${file.name}`;
      const previewImage = document.createElement('img');
      previewImage.src = previewUrl;
      previewImage.alt = '';
      previewImage.loading = 'lazy';
      bookingFilePreview.append(fileLabel, previewImage);
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
        const safeFileUrl = normalizeUploadedFileUrl(result.fileUrl);
        if (response.ok && result.success && safeFileUrl) {
          state.uploadedFileUrl = safeFileUrl;
          syncHiddenFields();
          if (bookingFilePreview) {
            bookingFilePreview.hidden = false;
            const fileUrlText = document.createElement('span');
            fileUrlText.textContent = safeFileUrl;
            bookingFilePreview.appendChild(fileUrlText);
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

      bookingSummary.replaceChildren();
      const heading = document.createElement('h4');
      heading.textContent = bookingCopy.summaryTitle;
      const list = document.createElement('dl');
      for (const [label, value] of rows) {
        const term = document.createElement('dt');
        term.textContent = label;
        const definition = document.createElement('dd');
        definition.textContent = value || '—';
        list.append(term, definition);
      }
      bookingSummary.append(heading, list);
      bookingSummary.hidden = false;
    };

    const updateModalLayout = step => {
      modal.classList.remove('is-booking-step-1-active', 'is-booking-step-2-active', 'is-booking-step-3-active');
      modal.classList.add(`is-booking-step-${step}-active`);

      if (!modalContent) {
        return;
      }

      modalContent.classList.remove('is-booking-step-1', 'is-booking-step-2', 'is-booking-step-3');
      modalContent.classList.add(`is-booking-step-${step}`);
      stepIndicator?.style.setProperty('--booking-progress', String(step));
    };

    const resetStepScroll = step => {
      modalContent?.scrollTo?.({ top: 0, behavior: 'auto' });

      const activePanel = panels[step];
      activePanel?.scrollTo?.({ top: 0, behavior: 'auto' });
      activePanel?.querySelector('.calendar-days-scroll')?.scrollTo?.({ top: 0, behavior: 'auto' });
      activePanel?.querySelector('#time-slots-container')?.scrollTo?.({ top: 0, behavior: 'auto' });
      activePanel?.querySelector('.service-list, form')?.scrollTo?.({
        top: 0,
        behavior: 'auto',
      });
    };

    const setStep = step => {
      const prevStep = state.step;
      state.step = step;
      clearValidationMessage();

      if (stepMotionTimer) {
        window.clearTimeout(stepMotionTimer);
        stepMotionTimer = null;
      }

      modal.classList.remove('is-step-forward', 'is-step-back');
      if (step !== prevStep) {
        modal.classList.add(step > prevStep ? 'is-step-forward' : 'is-step-back');
        stepMotionTimer = window.setTimeout(() => {
          modal.classList.remove('is-step-forward', 'is-step-back');
          stepMotionTimer = null;
        }, BOOKING_STEP_MOTION_MS);
      }

      Object.entries(panels).forEach(([key, panel]) => {
        panel?.classList.toggle('active', Number(key) === step);
      });

      steps.forEach((item, index) => {
        item.classList.toggle('active', index + 1 === step);
      });

      updateStepTabs();
      updateModalLayout(step);

      if (step === 2) {
        renderCalendar();
        renderTimeSlots();
        updateDatetimeStepState();
      }

      window.requestAnimationFrame(() => {
        resetStepScroll(step);
        refreshDatetimeScrollState();
        ensureBookingScrollbars();
        refreshBookingScrollbars();
        sanitizeModalActionButtons();
        scanBookingNavPills(modal);
      });
    };

    const renderServiceList = () => {
      serviceList.innerHTML = '';
      const services =
        bookingCopy.services.includes(state.selectedService) || !state.selectedService
          ? bookingCopy.services
          : [state.selectedService, ...bookingCopy.services];

      const serviceButtons = [];

      services.forEach((serviceName, index) => {
        const button = document.createElement('button');
        const isActive = state.selectedService === serviceName;

        button.type = 'button';
        button.className = 'filter-btn service-option';
        button.textContent = serviceName;
        button.style.setProperty('--service-i', String(index));
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
          button.classList.add('active');
          button.setAttribute('aria-current', 'true');
        }

        button.addEventListener('click', () => {
          if (button.classList.contains('active')) {
            return;
          }

          clearBookingPillGroup(serviceButtons);
          activateBookingPill(button);
          state.selectedService = serviceName;
          syncHiddenFields();
          resetSummaryConfirmation();
          clearValidationMessage();
        });

        serviceButtons.push(button);
        serviceList.appendChild(button);
      });

      scanBookingNavPills(serviceList);
      serviceButtons.filter(button => button.classList.contains('active')).forEach(activateBookingPill);
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

      let weekdaysRow = calendarContainer.querySelector('.calendar-weekdays');
      let daysScroll = calendarContainer.querySelector('.calendar-days-scroll');

      if (!weekdaysRow) {
        weekdaysRow = document.createElement('div');
        weekdaysRow.className = 'calendar-weekdays';
        bookingCopy.weekdays.forEach(weekday => {
          const cell = document.createElement('div');
          cell.className = 'calendar-weekday';
          cell.textContent = weekday;
          weekdaysRow.appendChild(cell);
        });
      }

      if (!daysScroll) {
        daysScroll = document.createElement('div');
        daysScroll.className = 'calendar-days-scroll';
        daysScroll.addEventListener('scroll', refreshDatetimeScrollState, { passive: true });
        calendarContainer.append(weekdaysRow, daysScroll);
      }

      const calendar = document.createElement('div');
      calendar.className = 'calendar calendar-days nav-main';
      const dayButtons = [];

      const leadingBlanks = startDayOfWeek - 1;
      const daysInMonth = lastDay.getDate();
      const cellCount = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

      for (let index = 0; index < cellCount; index += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';

        if (index < leadingBlanks || dayNumber > daysInMonth) {
          cell.className = 'calendar-day is-empty';
          cell.setAttribute('tabindex', '-1');
          cell.setAttribute('aria-hidden', 'true');
          calendar.appendChild(cell);
          continue;
        }

        const date = new Date(today.getFullYear(), today.getMonth(), dayNumber);
        const isoDate = formatLocalDate(date);
        const isPastDay = date < normalizedToday;
        const isActive = state.selectedDate === isoDate;

        cell.className = 'filter-btn calendar-day';
        cell.textContent = String(dayNumber);
        cell.style.setProperty('--calendar-i', String(dayNumber));
        cell.dataset.date = isoDate;
        cell.setAttribute('role', 'tab');
        cell.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
          cell.classList.add('active');
          cell.setAttribute('aria-current', 'true');
        }

        if (isPastDay) {
          cell.classList.add('is-disabled');
          cell.disabled = true;
        } else {
          cell.addEventListener('click', () => {
            if (cell.classList.contains('active')) {
              return;
            }

            clearBookingPillGroup(dayButtons);
            activateBookingPill(cell);
            state.selectedDate = isoDate;
            state.selectedTime = '';
            syncHiddenFields();
            resetSummaryConfirmation();
            clearValidationMessage();
            renderTimeSlots();
            updateDatetimeStepState();
          });
          dayButtons.push(cell);
        }

        calendar.appendChild(cell);
        dayNumber += 1;
      }

      daysScroll.replaceChildren(calendar);
      ensureBookingScrollbars();
      scanBookingNavPills(calendar);
      dayButtons.filter(button => button.classList.contains('active')).forEach(activateBookingPill);
      updateDatetimeStepState();
      window.requestAnimationFrame(refreshBookingScrollbars);
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
      const slotButtons = [];

      timeSlots.forEach((time, index) => {
        const button = document.createElement('button');
        const isActive = state.selectedTime === time;

        button.type = 'button';
        button.className = 'filter-btn time-slot';
        button.textContent = time;
        button.style.setProperty('--slot-i', String(index));
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
          button.classList.add('active');
          button.setAttribute('aria-current', 'true');
        }

        button.addEventListener('click', () => {
          if (button.classList.contains('active')) {
            return;
          }

          clearBookingPillGroup(slotButtons);
          activateBookingPill(button);
          state.selectedTime = time;
          syncHiddenFields();
          resetSummaryConfirmation();
          clearValidationMessage();
          updateDatetimeStepState();
        });

        slotButtons.push(button);
        timeSlotsContainer.appendChild(button);
      });

      scanBookingNavPills(timeSlotsContainer);
      slotButtons.filter(button => button.classList.contains('active')).forEach(activateBookingPill);
      updateDatetimeStepState();
      window.requestAnimationFrame(refreshBookingScrollbars);
    };

    const bindNativeBookingFields = () => {
      const today = formatLocalDate(new Date());
      selectedDateField.setAttribute('min', today);
      selectedTimeField.setAttribute('min', '09:00');
      selectedTimeField.setAttribute('max', '19:00');

      selectedDateField.addEventListener('change', () => {
        state.selectedDate = selectedDateField.value;
        state.selectedTime = '';
        resetSummaryConfirmation();
        clearValidationMessage();
        renderCalendar();
        renderTimeSlots();
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

    const BOOKING_MODAL_OPEN_MS = 860;
    const BOOKING_MODAL_DISMISS_MS = 440;
    let openingTimer = null;
    let closingTimer = null;

    const openModal = (serviceName = '') => {
      if (closingTimer) {
        window.clearTimeout(closingTimer);
        closingTimer = null;
      }

      lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      state.step = 1;
      state.selectedService = serviceName || state.selectedService;
      state.summaryConfirmed = false;
      clearValidationMessage();
      resetSummaryConfirmation();
      modal.classList.remove('booking-modal-sent', 'is-closing', 'is-alive', 'is-tilting');
      resetBookingTilt();
      syncHiddenFields();
      setStep(1);
      renderServiceList();
      modal.classList.add('active', 'is-opening');
      modal.setAttribute('aria-hidden', 'false');
      lockSiteScroll();

      if (openingTimer) {
        window.clearTimeout(openingTimer);
      }

      openingTimer = window.setTimeout(() => {
        modal.classList.remove('is-opening');
        modal.classList.add('is-alive');
        openingTimer = null;
      }, BOOKING_MODAL_OPEN_MS);

      window.requestAnimationFrame(() => {
        ensureBookingScrollbars();
        refreshDatetimeScrollState();
        refreshBookingScrollbars();
        sanitizeModalActionButtons();
        scanBookingNavPills(modal);
        modal.querySelector('.service-option.active, .service-option, input, button')?.focus();
      });
    };

    const closeModal = () => {
      if (!modal.classList.contains('active') || modal.classList.contains('is-closing')) {
        return;
      }

      if (openingTimer) {
        window.clearTimeout(openingTimer);
        openingTimer = null;
      }

      clearValidationMessage();
      resetSummaryConfirmation();
      modal.classList.remove(
        'booking-modal-sent',
        'is-opening',
        'is-alive',
        'is-tilting',
        'is-step-forward',
        'is-step-back'
      );
      resetBookingTilt();
      modal.classList.add('is-closing');
      modal.setAttribute('aria-hidden', 'true');

      closingTimer = window.setTimeout(() => {
        modal.classList.remove('active', 'is-closing');
        closingTimer = null;
        unlockSiteScroll();
        lastFocusedElement?.focus();
      }, BOOKING_MODAL_DISMISS_MS);
    };

    const moveToDateStep = () => {
      if (!state.selectedService) {
        showValidationMessage(
          bookingCopy.chooseService,
          serviceList.querySelector('.service-option.active, .service-option')
        );
        return;
      }

      setStep(2);
    };

    const moveToContactStep = () => {
      if (!state.selectedDate) {
        showValidationMessage(
          bookingCopy.chooseDate,
          calendarContainer.querySelector('.calendar-day.active, .calendar-day:not(.is-empty):not(.is-disabled)')
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
          timeSlotsContainer.querySelector('.time-slot.active, .time-slot')
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
          serviceList.querySelector('.service-option.active, .service-option')
        );
        return;
      }

      if (!state.selectedDate) {
        setStep(2);
        showValidationMessage(
          bookingCopy.chooseDate,
          calendarContainer.querySelector('.calendar-day.active, .calendar-day:not(.is-empty):not(.is-disabled)')
        );
        return;
      }

      if (!isFutureDate(state.selectedDate)) {
        setStep(2);
        showValidationMessage(bookingCopy.dateInPast, selectedDateField);
        return;
      }

      if (!state.selectedTime) {
        setStep(2);
        showValidationMessage(
          bookingCopy.chooseTime,
          timeSlotsContainer.querySelector('.time-slot.active, .time-slot')
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
            !nameValue ? 'input[name="name"]' : !emailValue ? 'input[name="email"]' : 'input[name="phone"]'
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
    updateDatetimeStepState();
    scanBookingNavPills(modal);
    scanBookingNavPills(document);
  };

  initSendmailForms();
  initMessageDraftTools();
  initSmoothHashLinks();
  initBookingModal();
});
