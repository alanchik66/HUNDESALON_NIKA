(function () {
  'use strict';

  const CHAT_ID = 'hundesalon-ai-chat';
  const STORAGE_PREFIX = 'hundesalonAiChat:v1';
  const SESSION_KEY = 'hundesalonAiChatSession:v1';
  const MAX_STORED_MESSAGES = 12;
  const MAX_MESSAGE_LENGTH = 1400;
  const SUPPORTED_LOCALES = new Set(['de', 'en', 'ru', 'uk']);
  const BRAND_LOGO = '/assets/images/brand/logo.png';
  const SITE_ORIGIN = 'https://hundesalon-nika.com';

  const COPY = Object.freeze({
    de: Object.freeze({
      assistant: 'KI-Assistent für Hundepflege',
      launcher: 'HUNDESALON_NIKA Assistent öffnen',
      welcome:
        'Guten Tag. Ich beantworte Fragen zu Leistungen, Preisen, Vorbereitung und Terminablauf anhand unserer aktuellen Website.',
      placeholder: 'Ihre Frage an HUNDESALON_NIKA ...',
      send: 'Nachricht senden',
      personalSupport: 'Persönliche Beratung',
      personalSupportOpening: 'Persönliche Beratung wird geöffnet ...',
      personalSupportUnavailable: 'Der Live-Chat wird noch geladen. Bitte versuchen Sie es gleich erneut.',
      attach: 'Datei an einen Mitarbeiter senden',
      attachHint: 'Anhänge werden sicher im persönlichen Live-Chat an unser Team gesendet.',
      emoji: 'Emoji einfügen',
      voice: 'Spracheingabe',
      voiceUnsupported: 'Die Spracheingabe wird von diesem Browser nicht unterstützt.',
      listening: 'Ich höre zu ...',
      voiceError: 'Die Spracheingabe konnte nicht gestartet werden.',
      menu: 'Schnellaktionen',
      minimize: 'Chat minimieren',
      expand: 'Ansicht vergrößern',
      collapse: 'Normale Ansicht',
      download: 'Chatverlauf herunterladen',
      newConversation: 'Neues Gespräch',
      newConversationConfirm: 'Aktuellen Verlauf in diesem Browser löschen und ein neues Gespräch beginnen?',
      typing: 'Der Assistent prüft die Website-Informationen ...',
      unavailable: 'Der Assistent ist gerade nicht erreichbar. Bitte nutzen Sie die persönliche Beratung.',
      rateLimited:
        'Zu viele Anfragen in kurzer Zeit. Bitte warten Sie eine Minute oder nutzen Sie die persönliche Beratung.',
      empty: 'Bitte geben Sie eine Frage ein.',
      tooLong: `Bitte kürzen Sie die Nachricht auf höchstens ${MAX_MESSAGE_LENGTH} Zeichen.`,
      privacy: 'Datenschutz',
      transcriptTitle: 'HUNDESALON_NIKA Gespräch',
      close: 'Schließen',
    }),
    en: Object.freeze({
      assistant: 'AI pet-care assistant',
      launcher: 'Open the HUNDESALON_NIKA assistant',
      welcome:
        'Hello. I answer questions about services, prices, preparation, and appointments using our current website information.',
      placeholder: 'Ask HUNDESALON_NIKA ...',
      send: 'Send message',
      personalSupport: 'Personal support',
      personalSupportOpening: 'Opening personal support ...',
      personalSupportUnavailable: 'The live chat is still loading. Please try again in a moment.',
      attach: 'Send a file to a team member',
      attachHint: 'Attachments are sent securely to our team in the personal live chat.',
      emoji: 'Insert emoji',
      voice: 'Voice input',
      voiceUnsupported: 'Voice input is not supported by this browser.',
      listening: 'Listening ...',
      voiceError: 'Voice input could not be started.',
      menu: 'Quick actions',
      minimize: 'Minimize chat',
      expand: 'Expand view',
      collapse: 'Normal view',
      download: 'Download transcript',
      newConversation: 'New conversation',
      newConversationConfirm: 'Clear the current history in this browser and start a new conversation?',
      typing: 'The assistant is checking the website information ...',
      unavailable: 'The assistant is currently unavailable. Please use personal support.',
      rateLimited: 'Too many requests in a short time. Please wait one minute or use personal support.',
      empty: 'Please enter a question.',
      tooLong: `Please shorten the message to ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      privacy: 'Privacy',
      transcriptTitle: 'HUNDESALON_NIKA conversation',
      close: 'Close',
    }),
    ru: Object.freeze({
      assistant: 'AI-ассистент по уходу за питомцами',
      launcher: 'Открыть ассистента HUNDESALON_NIKA',
      welcome:
        'Здравствуйте. Я отвечаю на вопросы об услугах, ценах, подготовке и записи по актуальной информации нашего сайта.',
      placeholder: 'Ваш вопрос HUNDESALON_NIKA ...',
      send: 'Отправить сообщение',
      personalSupport: 'Личная консультация',
      personalSupportOpening: 'Открываю личную консультацию ...',
      personalSupportUnavailable: 'Live-chat ещё загружается. Повторите попытку через несколько секунд.',
      attach: 'Отправить файл сотруднику',
      attachHint: 'Файлы безопасно отправляются нашей команде в личном live-chat.',
      emoji: 'Вставить emoji',
      voice: 'Голосовой ввод',
      voiceUnsupported: 'Этот браузер не поддерживает голосовой ввод.',
      listening: 'Слушаю ...',
      voiceError: 'Не удалось запустить голосовой ввод.',
      menu: 'Быстрые действия',
      minimize: 'Свернуть чат',
      expand: 'Развернуть просмотр',
      collapse: 'Обычный вид',
      download: 'Скачать транскрипт',
      newConversation: 'Новый разговор',
      newConversationConfirm: 'Очистить текущую историю в этом браузере и начать новый разговор?',
      typing: 'Ассистент проверяет информацию сайта ...',
      unavailable: 'Ассистент сейчас недоступен. Используйте личную консультацию.',
      rateLimited: 'Слишком много запросов за короткое время. Подождите минуту или откройте личную консультацию.',
      empty: 'Введите вопрос.',
      tooLong: `Сократите сообщение до ${MAX_MESSAGE_LENGTH} знаков.`,
      privacy: 'Конфиденциальность',
      transcriptTitle: 'Диалог HUNDESALON_NIKA',
      close: 'Закрыть',
    }),
    uk: Object.freeze({
      assistant: 'AI-асистент з догляду за улюбленцями',
      launcher: 'Відкрити асистента HUNDESALON_NIKA',
      welcome:
        'Вітаю. Я відповідаю на запитання про послуги, ціни, підготовку та запис за актуальною інформацією нашого сайту.',
      placeholder: 'Ваше запитання HUNDESALON_NIKA ...',
      send: 'Надіслати повідомлення',
      personalSupport: 'Особиста консультація',
      personalSupportOpening: 'Відкриваю особисту консультацію ...',
      personalSupportUnavailable: 'Live-chat ще завантажується. Спробуйте ще раз за кілька секунд.',
      attach: 'Надіслати файл співробітнику',
      attachHint: 'Файли безпечно надсилаються нашій команді в особистому live-chat.',
      emoji: 'Вставити emoji',
      voice: 'Голосове введення',
      voiceUnsupported: 'Цей браузер не підтримує голосове введення.',
      listening: 'Слухаю ...',
      voiceError: 'Не вдалося запустити голосове введення.',
      menu: 'Швидкі дії',
      minimize: 'Згорнути чат',
      expand: 'Розгорнути перегляд',
      collapse: 'Звичайний вигляд',
      download: 'Завантажити транскрипт',
      newConversation: 'Нова розмова',
      newConversationConfirm: 'Очистити поточну історію в цьому браузері та почати нову розмову?',
      typing: 'Асистент перевіряє інформацію сайту ...',
      unavailable: 'Асистент зараз недоступний. Скористайтеся особистою консультацією.',
      rateLimited: 'Забагато запитів за короткий час. Зачекайте хвилину або відкрийте особисту консультацію.',
      empty: 'Введіть запитання.',
      tooLong: `Скоротіть повідомлення до ${MAX_MESSAGE_LENGTH} символів.`,
      privacy: 'Конфіденційність',
      transcriptTitle: 'Діалог HUNDESALON_NIKA',
      close: 'Закрити',
    }),
  });

  const ICONS = Object.freeze({
    send: 'M5 12h13m-5-5 5 5-5 5',
    menu: 'M12 6h.01M12 12h.01M12 18h.01',
    minimize: 'M5 12h14',
    expand: 'M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5',
    download: 'M12 3v12m0 0 5-5m-5 5-5-5M5 21h14',
    newConversation: 'M12 5v14M5 12h14',
    support: 'M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z',
    emoji: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 10h.01M15 10h.01M8.5 14a4.5 4.5 0 0 0 7 0',
    voice: 'M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0m6 6v3m-4 0h8',
    attach: 'm21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 1 1-2.8-2.8l8.5-8.5',
    close: 'M6 6l12 12M18 6 6 18',
  });

  const EMOJIS = ['😊', '🐶', '🐱', '❤️', '👍', '😍', '✨', '🐾', '🙏', '😌', '😄', '🎉'];

  function pageLocale() {
    const candidate = String(document.documentElement.lang || location.pathname.split('/')[1] || 'de')
      .toLowerCase()
      .slice(0, 2);
    return SUPPORTED_LOCALES.has(candidate) ? candidate : 'de';
  }

  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('hn-ai-icon');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  function button({ className = '', label, iconName, text = '' }) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = className;
    node.setAttribute('aria-label', label);
    node.title = label;
    if (iconName) node.appendChild(icon(iconName));
    if (text) {
      const span = document.createElement('span');
      span.textContent = text;
      node.appendChild(span);
    }
    return node;
  }

  function safeSessionId() {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (/^[a-z0-9-]{16,64}$/i.test(stored || '')) return stored;
      const created = window.crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, created);
      return created;
    } catch {
      return window.crypto.randomUUID();
    }
  }

  function readStoredMessages(locale) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(`${STORAGE_PREFIX}:${locale}`) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-MAX_STORED_MESSAGES).flatMap(item => {
        const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : '';
        const content = typeof item?.content === 'string' ? item.content.trim().slice(0, 4000) : '';
        return role && content ? [{ role, content }] : [];
      });
    } catch {
      return [];
    }
  }

  function writeStoredMessages(locale, messages) {
    try {
      sessionStorage.setItem(`${STORAGE_PREFIX}:${locale}`, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    } catch {
      // The chat remains usable when browser storage is unavailable.
    }
  }

  function appendSafeAnswer(container, text) {
    const value = String(text || '');
    const urlPattern = /https:\/\/hundesalon-nika\.com\/[\w\-./?%=&+#]*/gi;
    let cursor = 0;
    for (const match of value.matchAll(urlPattern)) {
      if (match.index > cursor) container.appendChild(document.createTextNode(value.slice(cursor, match.index)));
      const link = document.createElement('a');
      link.href = match[0];
      link.target = '_self';
      link.rel = 'noopener';
      link.textContent = match[0].replace(SITE_ORIGIN, '');
      container.appendChild(link);
      cursor = match.index + match[0].length;
    }
    if (cursor < value.length) container.appendChild(document.createTextNode(value.slice(cursor)));
  }

  function initAiChat() {
    if (document.getElementById(CHAT_ID)) return;

    const locale = pageLocale();
    const copy = COPY[locale];
    const state = {
      busy: false,
      expanded: false,
      handoffTimer: null,
      messages: readStoredMessages(locale),
      sessionId: safeSessionId(),
    };

    const root = document.createElement('section');
    root.id = CHAT_ID;
    root.className = 'hn-ai-chat';
    root.dataset.open = 'false';
    root.setAttribute('aria-label', 'HUNDESALON_NIKA AI');

    const launcher = button({ className: 'hn-ai-launcher', label: copy.launcher });
    const launcherLogo = document.createElement('img');
    launcherLogo.src = BRAND_LOGO;
    launcherLogo.alt = '';
    launcherLogo.width = 56;
    launcherLogo.height = 56;
    launcherLogo.decoding = 'async';
    const launcherText = document.createElement('span');
    launcherText.textContent = 'AI';
    launcher.append(launcherLogo, launcherText);

    const panel = document.createElement('div');
    panel.className = 'hn-ai-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'hn-ai-title');

    const header = document.createElement('header');
    header.className = 'hn-ai-header';
    const brand = document.createElement('div');
    brand.className = 'hn-ai-brand';
    const logo = document.createElement('img');
    logo.src = BRAND_LOGO;
    logo.alt = '';
    logo.width = 44;
    logo.height = 44;
    logo.decoding = 'async';
    const titles = document.createElement('div');
    const title = document.createElement('strong');
    title.id = 'hn-ai-title';
    title.textContent = 'HUNDESALON_NIKA';
    const subtitle = document.createElement('span');
    subtitle.textContent = copy.assistant;
    titles.append(title, subtitle);
    brand.append(logo, titles);

    const headerActions = document.createElement('div');
    headerActions.className = 'hn-ai-header-actions';
    const menuToggle = button({ className: 'hn-ai-icon-button', label: copy.menu, iconName: 'menu' });
    menuToggle.setAttribute('aria-expanded', 'false');
    const minimize = button({ className: 'hn-ai-icon-button', label: copy.minimize, iconName: 'minimize' });
    headerActions.append(menuToggle, minimize);
    header.append(brand, headerActions);

    const menu = document.createElement('div');
    menu.className = 'hn-ai-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    const menuTitle = document.createElement('p');
    menuTitle.textContent = copy.menu;
    const expand = button({
      className: 'hn-ai-menu-action',
      label: copy.expand,
      iconName: 'expand',
      text: copy.expand,
    });
    const download = button({
      className: 'hn-ai-menu-action',
      label: copy.download,
      iconName: 'download',
      text: copy.download,
    });
    const reset = button({
      className: 'hn-ai-menu-action',
      label: copy.newConversation,
      iconName: 'newConversation',
      text: copy.newConversation,
    });
    const closeMenu = button({
      className: 'hn-ai-menu-action',
      label: copy.minimize,
      iconName: 'minimize',
      text: copy.minimize,
    });
    menu.append(menuTitle, closeMenu, expand, download, reset);

    const messages = document.createElement('div');
    messages.className = 'hn-ai-messages';
    messages.setAttribute('role', 'log');
    messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-relevant', 'additions');

    const welcome = document.createElement('div');
    welcome.className = 'hn-ai-welcome';
    const welcomeMark = document.createElement('span');
    welcomeMark.textContent = 'AI';
    const welcomeText = document.createElement('p');
    welcomeText.textContent = copy.welcome;
    welcome.append(welcomeMark, welcomeText);
    messages.appendChild(welcome);

    const typing = document.createElement('div');
    typing.className = 'hn-ai-typing';
    typing.hidden = true;
    typing.innerHTML = '<span></span><span></span><span></span>';
    const typingLabel = document.createElement('span');
    typingLabel.className = 'hn-ai-visually-hidden';
    typingLabel.textContent = copy.typing;
    typing.appendChild(typingLabel);

    const composer = document.createElement('form');
    composer.className = 'hn-ai-composer';
    const inputWrap = document.createElement('div');
    inputWrap.className = 'hn-ai-input-wrap';
    const textarea = document.createElement('textarea');
    textarea.rows = 1;
    textarea.maxLength = MAX_MESSAGE_LENGTH;
    textarea.placeholder = copy.placeholder;
    textarea.setAttribute('aria-label', copy.placeholder);
    const send = button({ className: 'hn-ai-send', label: copy.send, iconName: 'send' });
    send.type = 'submit';
    inputWrap.append(textarea, send);

    const composerBar = document.createElement('div');
    composerBar.className = 'hn-ai-composer-bar';
    const tools = document.createElement('div');
    tools.className = 'hn-ai-tools';
    const emojiToggle = button({ className: 'hn-ai-tool', label: copy.emoji, iconName: 'emoji' });
    emojiToggle.setAttribute('aria-expanded', 'false');
    const voice = button({ className: 'hn-ai-tool', label: copy.voice, iconName: 'voice' });
    const attach = button({ className: 'hn-ai-tool', label: copy.attach, iconName: 'attach' });
    tools.append(emojiToggle, attach, voice);
    const support = button({
      className: 'hn-ai-support',
      label: copy.personalSupport,
      iconName: 'support',
      text: copy.personalSupport,
    });
    composerBar.append(tools, support);

    const emojiPicker = document.createElement('div');
    emojiPicker.className = 'hn-ai-emoji-picker';
    emojiPicker.hidden = true;
    emojiPicker.setAttribute('aria-label', copy.emoji);
    for (const emoji of EMOJIS) {
      const emojiButton = button({ className: 'hn-ai-emoji', label: emoji, text: emoji });
      emojiButton.addEventListener('click', () => {
        const start = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
        textarea.setRangeText(emoji, start, textarea.selectionEnd ?? start, 'end');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.focus();
        emojiPicker.hidden = true;
        emojiToggle.setAttribute('aria-expanded', 'false');
      });
      emojiPicker.appendChild(emojiButton);
    }

    const status = document.createElement('p');
    status.className = 'hn-ai-status';
    status.setAttribute('aria-live', 'polite');
    const privacy = document.createElement('a');
    privacy.className = 'hn-ai-privacy';
    privacy.href = `/${locale}/datenschutz.html`;
    privacy.textContent = copy.privacy;
    composer.append(inputWrap, composerBar, emojiPicker, status, privacy);

    panel.append(header, menu, messages, typing, composer);
    root.append(panel, launcher);
    document.body.appendChild(root);

    function setStatus(message, timeout = 4200) {
      clearTimeout(status.__clearTimer);
      status.textContent = message;
      if (message && timeout > 0) {
        status.__clearTimer = setTimeout(() => {
          status.textContent = '';
        }, timeout);
      }
    }

    function closePopovers() {
      menu.hidden = true;
      menuToggle.setAttribute('aria-expanded', 'false');
      emojiPicker.hidden = true;
      emojiToggle.setAttribute('aria-expanded', 'false');
    }

    function setOpen(open) {
      root.dataset.open = String(open);
      launcher.setAttribute('aria-expanded', String(open));
      closePopovers();
      if (open) {
        requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
      }
    }

    function setExpanded(expanded) {
      state.expanded = expanded;
      root.classList.toggle('is-expanded', expanded);
      const label = expanded ? copy.collapse : copy.expand;
      expand.querySelector('span').textContent = label;
      expand.setAttribute('aria-label', label);
      expand.title = label;
      closePopovers();
    }

    function scrollToLatest() {
      requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
      });
    }

    function addMessage(role, content, { handoff = false, persist = true } = {}) {
      const row = document.createElement('article');
      row.className = `hn-ai-message is-${role}`;
      const avatar = document.createElement(role === 'assistant' ? 'img' : 'span');
      avatar.className = 'hn-ai-avatar';
      if (role === 'assistant') {
        avatar.src = BRAND_LOGO;
        avatar.alt = '';
        avatar.width = 34;
        avatar.height = 34;
      } else {
        avatar.textContent = locale === 'de' ? 'Sie' : locale === 'en' ? 'You' : locale === 'ru' ? 'Вы' : 'Ви';
      }
      const bubble = document.createElement('div');
      bubble.className = 'hn-ai-bubble';
      appendSafeAnswer(bubble, content);
      if (handoff) {
        const action = button({
          className: 'hn-ai-inline-support',
          label: copy.personalSupport,
          iconName: 'support',
          text: copy.personalSupport,
        });
        action.addEventListener('click', openHumanChat);
        bubble.appendChild(action);
      }
      row.append(avatar, bubble);
      messages.appendChild(row);
      if (persist) {
        state.messages.push({ role, content });
        state.messages = state.messages.slice(-MAX_STORED_MESSAGES);
        writeStoredMessages(locale, state.messages);
      }
      scrollToLatest();
    }

    for (const item of state.messages) addMessage(item.role, item.content, { persist: false });

    function setBusy(busy) {
      state.busy = busy;
      textarea.disabled = busy;
      send.disabled = busy;
      typing.hidden = !busy;
      if (busy) scrollToLatest();
    }

    function markNativeChatReady() {
      const host = document.querySelector('sp-live-chat');
      if (!host) return false;
      host.setAttribute('data-hundesalon-ai-ready', 'true');
      return Boolean(host.shadowRoot);
    }

    function clickNativeChat() {
      const host = document.querySelector('sp-live-chat');
      const nativeRoot = host?.shadowRoot;
      if (!nativeRoot) return false;
      host.setAttribute('data-hundesalon-ai-ready', 'true');
      const openButton = nativeRoot.querySelector('.widget-fab, .button-open-widget');
      if (!openButton) {
        return Boolean(nativeRoot.querySelector('.widget-wrapper .widget'));
      }
      openButton.click();
      return true;
    }

    function openHumanChat() {
      if (state.handoffTimer) {
        clearInterval(state.handoffTimer);
        state.handoffTimer = null;
      }
      setStatus(copy.personalSupportOpening, 0);
      if (clickNativeChat()) {
        setOpen(false);
        setStatus('');
        return;
      }

      let attempts = 0;
      state.handoffTimer = setInterval(() => {
        attempts += 1;
        if (clickNativeChat()) {
          clearInterval(state.handoffTimer);
          state.handoffTimer = null;
          setOpen(false);
          setStatus('');
          return;
        }
        if (attempts >= 60) {
          clearInterval(state.handoffTimer);
          state.handoffTimer = null;
          setOpen(true);
          setStatus(copy.personalSupportUnavailable);
        }
      }, 500);
    }

    function autoGrow() {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }

    async function submitMessage() {
      if (state.busy) return;
      const content = textarea.value.trim();
      if (!content) {
        setStatus(copy.empty);
        return;
      }
      if (content.length > MAX_MESSAGE_LENGTH) {
        setStatus(copy.tooLong);
        return;
      }

      const history = state.messages.slice(-8);
      textarea.value = '';
      autoGrow();
      addMessage('user', content);
      setBusy(true);
      setStatus('');

      try {
        const response = await fetch('/api/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale,
            message: content,
            history,
            pagePath: location.pathname,
            sessionId: state.sessionId,
          }),
        });
        if (response.status === 429) {
          addMessage('assistant', copy.rateLimited, { handoff: true });
          return;
        }
        if (!response.ok) throw new Error('AI_CHAT_REQUEST_FAILED');
        const result = await response.json();
        const answer =
          typeof result?.answer === 'string' && result.answer.trim() ? result.answer.trim() : copy.unavailable;
        addMessage('assistant', answer, { handoff: Boolean(result?.handoff || result?.available === false) });
      } catch {
        addMessage('assistant', copy.unavailable, { handoff: true });
      } finally {
        setBusy(false);
        textarea.focus({ preventScroll: true });
      }
    }

    function downloadTranscript() {
      const rows = state.messages.map(
        item => `${item.role === 'assistant' ? 'HUNDESALON_NIKA AI' : 'Customer'}: ${item.content}`
      );
      const transcript = `${copy.transcriptTitle}\n${location.href}\n${new Date().toLocaleString()}\n\n${rows.join('\n\n')}\n`;
      const blob = new window.Blob([`\uFEFF${transcript}`], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HUNDESALON_NIKA-AI-chat-${new Date().toISOString().slice(0, 10)}.txt`;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      closePopovers();
    }

    function resetConversation() {
      // eslint-disable-next-line no-alert
      if (!window.confirm(copy.newConversationConfirm)) return;
      state.messages = [];
      writeStoredMessages(locale, []);
      messages.querySelectorAll('.hn-ai-message').forEach(node => node.remove());
      closePopovers();
      textarea.focus();
    }

    function startVoiceInput() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setStatus(copy.voiceUnsupported);
        return;
      }
      const languageMap = { de: 'de-DE', en: 'en-US', ru: 'ru-RU', uk: 'uk-UA' };
      const recognition = new SpeechRecognition();
      recognition.lang = languageMap[locale];
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => {
        voice.classList.add('is-listening');
        setStatus(copy.listening, 0);
      };
      recognition.onresult = event => {
        const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
        if (transcript) {
          textarea.value = `${textarea.value.trim()}${textarea.value.trim() ? ' ' : ''}${transcript}`.slice(
            0,
            MAX_MESSAGE_LENGTH
          );
          autoGrow();
        }
      };
      recognition.onerror = () => setStatus(copy.voiceError);
      recognition.onend = () => {
        voice.classList.remove('is-listening');
        if (status.textContent === copy.listening) setStatus('');
      };
      try {
        recognition.start();
      } catch {
        setStatus(copy.voiceError);
      }
    }

    launcher.addEventListener('click', () => setOpen(root.dataset.open !== 'true'));
    minimize.addEventListener('click', () => setOpen(false));
    closeMenu.addEventListener('click', () => setOpen(false));
    menuToggle.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closePopovers();
      menu.hidden = !willOpen;
      menuToggle.setAttribute('aria-expanded', String(willOpen));
    });
    expand.addEventListener('click', () => setExpanded(!state.expanded));
    download.addEventListener('click', downloadTranscript);
    reset.addEventListener('click', resetConversation);
    support.addEventListener('click', openHumanChat);
    attach.addEventListener('click', () => {
      setStatus(copy.attachHint);
      openHumanChat();
    });
    voice.addEventListener('click', startVoiceInput);
    emojiToggle.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = emojiPicker.hidden;
      closePopovers();
      emojiPicker.hidden = !willOpen;
      emojiToggle.setAttribute('aria-expanded', String(willOpen));
    });
    composer.addEventListener('submit', event => {
      event.preventDefault();
      void submitMessage();
    });
    textarea.addEventListener('input', autoGrow);
    textarea.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        void submitMessage();
      }
    });
    root.addEventListener('click', event => {
      if (!event.target.closest('.hn-ai-menu, .hn-ai-header-actions, .hn-ai-emoji-picker, .hn-ai-tools')) {
        closePopovers();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || root.dataset.open !== 'true') return;
      if (!menu.hidden || !emojiPicker.hidden) {
        closePopovers();
        return;
      }
      if (state.expanded) {
        setExpanded(false);
        return;
      }
      setOpen(false);
      launcher.focus();
    });

    launcher.setAttribute('aria-expanded', 'false');
    markNativeChatReady();
    const nativeObserver = new MutationObserver(() => {
      if (markNativeChatReady()) nativeObserver.disconnect();
    });
    nativeObserver.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => nativeObserver.disconnect(), 20_000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAiChat, { once: true });
  } else {
    initAiChat();
  }
})();
