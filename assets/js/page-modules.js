/*
 * ================================================================
 * HUNDESALON NIKA — Page Modules
 * ================================================================
 * Page-specific interactive logic: booking modal, sendmail forms,
 * AI draft assistants, and smooth hash-link scrolling.
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
        'Стрижка собак (мелкие)',
        'Стрижка собак (средние)',
        'Стрижка собак (крупные)',
        'Стрижка собак (XXL)',
        'Стрижка кошек',
        'Стрижка кроликов',
        'Тримминг',
        'Купание',
        'Чистка зубов ультразвуком',
        'Креативный груминг',
        'Озонотерапия',
      ],
      fallbackService: 'Выбранная услуга',
      chooseService: 'Выберите услугу',
      chooseDate: 'Выберите дату',
      chooseTime: 'Выберите время',
      chooseContact: 'Заполните имя, email и телефон',
      closeModal: 'Закрыть окно',
    },
    uk: {
      weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
      services: [
        'Стрижка собак (малі)',
        'Стрижка собак (середні)',
        'Стрижка собак (великі)',
        'Стрижка собак (XXL)',
        'Стрижка котів',
        'Стрижка кроликів',
        'Тримінг',
        'Купання',
        'Чистка зубів ультразвуком',
        'Креативний грумінг',
        'Озонотерапія',
      ],
      fallbackService: 'Обрана послуга',
      chooseService: 'Оберіть послугу',
      chooseDate: 'Оберіть дату',
      chooseTime: 'Оберіть час',
      chooseContact: 'Заповніть імʼя, email і телефон',
      closeModal: 'Закрити вікно',
    },
    en: {
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      services: [
        'Dog grooming (small)',
        'Dog grooming (medium)',
        'Dog grooming (large)',
        'Dog grooming (XXL)',
        'Cat grooming',
        'Rabbit grooming',
        'Hand stripping',
        'Bathing',
        'Ultrasonic teeth cleaning',
        'Creative grooming',
        'Ozone therapy',
      ],
      fallbackService: 'Selected service',
      chooseService: 'Please select a service',
      chooseDate: 'Please select a date',
      chooseTime: 'Please select a time',
      chooseContact: 'Please fill in name, email, and phone',
      closeModal: 'Close dialog',
    },
    de: {
      weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      services: [
        'Hundefrisur (klein)',
        'Hundefrisur (mittel)',
        'Hundefrisur (groß)',
        'Hundefrisur (XXL)',
        'Katzenpflege',
        'Kaninchenpflege',
        'Trimming',
        'Baden',
        'Ultraschall-Zahnreinigung',
        'Kreatives Grooming',
        'Ozontherapie',
      ],
      fallbackService: 'Ausgewählte Leistung',
      chooseService: 'Bitte wählen Sie eine Leistung',
      chooseDate: 'Bitte wählen Sie ein Datum',
      chooseTime: 'Bitte wählen Sie eine Uhrzeit',
      chooseContact: 'Bitte füllen Sie Name, E-Mail und Telefon aus',
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
  };

  const aiDraftCopy = {
    title: {
      ru: 'AI-помощник для текста',
      uk: 'AI-помічник для тексту',
      en: 'AI text helper',
      de: 'AI-Texthelfer',
    },
    button: {
      ru: 'Сгенерировать черновик',
      uk: 'Згенерувати чернетку',
      en: 'Generate draft',
      de: 'Entwurf generieren',
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
      ru: 'AI недоступен: локально не задан OPENROUTER_API_KEY для Cloudflare Functions.',
      uk: 'AI недоступний: локально не задано OPENROUTER_API_KEY для Cloudflare Functions.',
      en: 'AI unavailable: OPENROUTER_API_KEY is not configured for local Cloudflare Functions.',
      de: 'AI nicht verfugbar: OPENROUTER_API_KEY ist fur lokale Cloudflare Functions nicht gesetzt.',
    },
  };

  const normalizeAssistantMessage = value => {
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

    try {
      const response = await fetch('/sendmail', {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });

      const result = await response.json().catch(() => ({ success: false }));

      if (result.success) {
        statusEl.classList.add('form-status--success');
        statusEl.textContent = formCopy.success[pageLang] ?? formCopy.success.de;
        form.reset();
      } else {
        statusEl.classList.add('form-status--error');
        statusEl.textContent = formCopy.error[pageLang] ?? formCopy.error.de;
      }
    } catch {
      statusEl.classList.add('form-status--error');
      statusEl.textContent = formCopy.error[pageLang] ?? formCopy.error.de;
    } finally {
      form.appendChild(statusEl);
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

  const initAiDraftAssistants = () => {
    const resolveAiEndpoints = () => {
      const port = window.location.port;

      if (port === '8788') {
        return ['/openrouter'];
      }

      return ['/openrouter', '/functions/openrouter'];
    };

    const requestAiDraft = async requestBody => {
      let lastError = null;

      for (const endpoint of resolveAiEndpoints()) {
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
            const errorBody = await response.text();
            if (response.status === 503 && /OPENROUTER_API_KEY/i.test(errorBody)) {
              throw new Error('OPENROUTER_API_KEY_MISSING');
            }

            const error = new Error(`AI request failed with status ${response.status} on ${endpoint}`);
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

      throw lastError || new Error('AI endpoints are unavailable');
    };

    const forms = document.querySelectorAll('form[action$="/sendmail"]');
    if (!forms.length) return;

    forms.forEach(form => {
      const messageField = form.querySelector('textarea[name="message"]');
      if (!messageField) return;
      if (form.dataset.aiDraftReady === 'true') return;
      form.dataset.aiDraftReady = 'true';

      const tools = document.createElement('div');
      tools.className = 'ai-draft-tools';

      const title = document.createElement('span');
      title.className = 'ai-draft-title';
      title.textContent = aiDraftCopy.title[pageLang] ?? aiDraftCopy.title.de;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-draft-btn';
      button.textContent = aiDraftCopy.button[pageLang] ?? aiDraftCopy.button.de;

      const status = document.createElement('p');
      status.className = 'ai-draft-status';

      tools.appendChild(title);
      tools.appendChild(button);
      messageField.insertAdjacentElement('beforebegin', tools);
      messageField.insertAdjacentElement('afterend', status);

      button.addEventListener('click', async () => {
        const formType = form.querySelector('input[name="form_type"]')?.value || 'contact';
        const name = form.querySelector('input[name="name"]')?.value?.trim() || '';
        const service = form.querySelector('input[name="service"]')?.value?.trim() || '';
        const existingText = messageField.value.trim();

        status.className = 'ai-draft-status ai-draft-status--loading';
        status.textContent = aiDraftCopy.loading[pageLang] ?? aiDraftCopy.loading.de;
        button.disabled = true;

        try {
          const payload = await requestAiDraft({
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

          const aiText = normalizeAssistantMessage(payload?.choices?.[0]?.message?.content);
          if (!aiText) {
            throw new Error('AI response is empty');
          }

          messageField.value = aiText;
          status.className = 'ai-draft-status ai-draft-status--success';
          status.textContent = aiDraftCopy.done[pageLang] ?? aiDraftCopy.done.de;
        } catch (error) {
          status.className = 'ai-draft-status ai-draft-status--error';
          status.textContent =
            error?.message === 'LOCAL_CF_DEV_REQUIRED'
              ? aiDraftCopy.localDevHint[pageLang] ?? aiDraftCopy.localDevHint.de
              : error?.message === 'OPENROUTER_API_KEY_MISSING'
                ? aiDraftCopy.apiKeyMissing[pageLang] ?? aiDraftCopy.apiKeyMissing.de
              : aiDraftCopy.failed[pageLang] ?? aiDraftCopy.failed.de;
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
    const form = modal.querySelector('#booking-form');
    const serviceList = modal.querySelector('#service-list');
    const calendarContainer = modal.querySelector('#calendar-container');
    const timeSlotsContainer = modal.querySelector('#time-slots-container');
    const selectedServiceField = modal.querySelector('#selected-service');
    const selectedDateField = modal.querySelector('#selected-date');
    const selectedTimeField = modal.querySelector('#selected-time');
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
          clearValidationMessage();
          renderTimeSlots();
        });

        timeSlotsContainer.appendChild(button);
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
      clearValidationMessage();
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
          form.querySelector('input[name="name"], input[name="email"], input[name="phone"]')
        );
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      const sent = await submitSendmailForm(form, submitBtn);
      if (sent) {
        closeModal();
      }
    });
  };

  initSendmailForms();
  initAiDraftAssistants();
  initSmoothHashLinks();
  initBookingModal();
});
