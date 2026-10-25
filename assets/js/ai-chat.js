(function () {
  'use strict';

  const CHAT_ID = 'hundesalon-ai-chat';
  const STORAGE_PREFIX = 'hundesalonAiChat:v1';
  const SESSION_KEY = 'hundesalonAiChatSession:v1';
  const MAX_STORED_MESSAGES = 12;
  const MAX_MESSAGE_LENGTH = 1400;
  const MAX_FILE_BYTES = 150 * 1024 * 1024;
  const MAX_VOICE_DURATION_MS = 10 * 60 * 1000;
  const UPLOAD_ENDPOINT = '/api/ai-chat-upload';
  const SESSION_ENDPOINT = '/api/ai-chat-session';
  const REGISTRATION_KEY = 'hundesalonAiChatIdentity:v1';
  const MODE_KEY = 'hundesalonAiChatMode:v1';
  const GIF_ENDPOINT = '/api/ai-chat-gifs';
  const EMOJI_DATA_URL = '/assets/data/emoji-17.0.json';
  const EMOJI_RECENTS_KEY = 'hundesalonAiChatEmojiRecents:v1';
  const TEXT_SIZE_KEY = 'hundesalonAiChatTextSize:v1';
  const TEXT_SIZE_ADJUSTMENTS = ['-0.08rem', '0rem', '0.12rem', '0.22rem'];
  const DEFAULT_TEXT_SIZE_LEVEL = 1;
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
      personalSupportActive: 'Persönliche Beratung ist aktiv. Ihre Nachrichten und Dateien gehen direkt an unser Team.',
      personalSupportSent: 'Nachricht wurde an unser Team gesendet.',
      personalSupportSubtitle: 'Persönliche Beratung mit unserem Team',
      personalSupportPlaceholder: 'Ihre Nachricht an unser Team ...',
      aiSupport: 'Zum KI-Assistenten',
      aiSupportActive: 'Der KI-Assistent ist wieder aktiv.',
      attach: 'Datei an einen Mitarbeiter senden',
      attachHint: 'Alle Dateiformate bis 150 MB werden sicher an unser Team gesendet.',
      fileTooLarge: 'Die Datei darf höchstens 150 MB groß sein.',
      uploadPreparing: 'Sicherer Upload wird vorbereitet ...',
      uploadComplete: 'Datei wurde sicher übermittelt.',
      uploadDuplicate: 'Diese Datei wurde bereits empfangen. Es wurde keine zweite Kopie erstellt.',
      uploadStored: 'Die Datei wurde gespeichert, aber die Benachrichtigung des Teams konnte nicht bestätigt werden.',
      uploadFailed: 'Die Datei konnte nicht gesendet werden. Bitte versuchen Sie es erneut.',
      uploadCancel: 'Upload abbrechen',
      emoji: 'Emoji einfügen',
      emojiSearch: 'Emoji suchen',
      emojiLoading: 'Emoji werden geladen ...',
      gif: 'GIF auswählen',
      gifSearch: 'GIFs suchen',
      gifLoading: 'GIFs werden geladen ...',
      gifEmpty: 'Keine passenden GIFs gefunden.',
      gifUnavailable: 'GIFs sind derzeit nicht verfügbar.',
      gifSent: 'GIF wurde zum Gespräch hinzugefügt.',
      voice: 'Sprachnachricht aufnehmen',
      voiceUnsupported: 'Sprachnachrichten werden von diesem Browser nicht unterstützt.',
      listening: 'Aufnahme läuft ...',
      voiceError: 'Die Aufnahme konnte nicht gestartet werden.',
      voiceStop: 'Aufnahme stoppen',
      voiceCancel: 'Aufnahme verwerfen',
      voiceReady: 'Sprachnachricht ist bereit.',
      voiceSend: 'Sprachnachricht senden',
      menu: 'Schnellaktionen',
      minimize: 'Chat minimieren',
      decreaseFont: 'Schrift verkleinern',
      increaseFont: 'Schrift vergrößern',
      expand: 'Ansicht vergrößern',
      collapse: 'Normale Ansicht',
      download: 'Chatverlauf herunterladen',
      clearChat: 'Chat leeren',
      clearChatConfirm: 'Diesen Chatverlauf löschen und ein neues Gespräch beginnen?',
      typing: 'Der Assistent prüft die Website-Informationen ...',
      unavailable: 'Der Assistent ist gerade nicht erreichbar. Bitte nutzen Sie die persönliche Beratung.',
      rateLimited:
        'Zu viele Anfragen in kurzer Zeit. Bitte warten Sie eine Minute oder nutzen Sie die persönliche Beratung.',
      rateLimitedRetry: seconds => `Anfragelimit erreicht. Automatischer neuer Versuch in ${seconds} Sekunden ...`,
      empty: 'Bitte geben Sie eine Frage ein.',
      tooLong: `Bitte kürzen Sie die Nachricht auf höchstens ${MAX_MESSAGE_LENGTH} Zeichen.`,
      privacy: 'Datenschutz',
      transcriptTitle: 'HUNDESALON_NIKA Gespräch',
      closeChat: 'Chat schließen',
      registrationTitle: 'Vor dem ersten Gespräch registrieren',
      registrationIntro: 'So kann unser Team Ihre Anfrage eindeutig zuordnen und persönlich antworten.',
      firstName: 'Vorname',
      lastName: 'Nachname',
      email: 'E-Mail-Adresse',
      phone: 'Telefon (freiwillig)',
      consent: 'Ich stimme der Verarbeitung meiner Angaben zur Bearbeitung dieser Anfrage zu.',
      register: 'Sicher weiter zum Chat',
      registrationError: 'Bitte prüfen Sie Ihre Angaben und versuchen Sie es erneut.',
    }),
    en: Object.freeze({
      assistant: 'AI pet-care assistant',
      launcher: 'Open the HUNDESALON_NIKA assistant',
      welcome:
        'Hello. I answer questions about services, prices, preparation, and appointments using our current website information.',
      placeholder: 'Ask HUNDESALON_NIKA ...',
      send: 'Send message',
      personalSupport: 'Personal support',
      personalSupportActive: 'Personal support is active. Your messages and files go directly to our team.',
      personalSupportSent: 'Your message was sent to our team.',
      personalSupportSubtitle: 'Personal support with our team',
      personalSupportPlaceholder: 'Your message to our team ...',
      aiSupport: 'Switch to AI assistant',
      aiSupportActive: 'The AI assistant is active again.',
      attach: 'Send a file to a team member',
      attachHint: 'All file formats up to 150 MB are sent securely to our team.',
      fileTooLarge: 'The file must not exceed 150 MB.',
      uploadPreparing: 'Preparing secure upload ...',
      uploadComplete: 'The file was sent securely.',
      uploadDuplicate: 'This file was already received. No second copy was created.',
      uploadStored: 'The file was saved, but team notification could not be confirmed.',
      uploadFailed: 'The file could not be sent. Please try again.',
      uploadCancel: 'Cancel upload',
      emoji: 'Insert emoji',
      emojiSearch: 'Search emoji',
      emojiLoading: 'Loading emoji ...',
      gif: 'Choose a GIF',
      gifSearch: 'Search GIFs',
      gifLoading: 'Loading GIFs ...',
      gifEmpty: 'No matching GIFs found.',
      gifUnavailable: 'GIFs are currently unavailable.',
      gifSent: 'GIF added to the conversation.',
      voice: 'Record a voice message',
      voiceUnsupported: 'Voice messages are not supported by this browser.',
      listening: 'Recording ...',
      voiceError: 'The recording could not be started.',
      voiceStop: 'Stop recording',
      voiceCancel: 'Discard recording',
      voiceReady: 'Voice message is ready.',
      voiceSend: 'Send voice message',
      menu: 'Quick actions',
      minimize: 'Minimize chat',
      decreaseFont: 'Decrease text size',
      increaseFont: 'Increase text size',
      expand: 'Expand view',
      collapse: 'Normal view',
      download: 'Download transcript',
      clearChat: 'Clear chat',
      clearChatConfirm: 'Clear this chat history and start a new conversation?',
      typing: 'The assistant is checking the website information ...',
      unavailable: 'The assistant is currently unavailable. Please use personal support.',
      rateLimited: 'Too many requests in a short time. Please wait one minute or use personal support.',
      rateLimitedRetry: seconds => `Request limit reached. Retrying automatically in ${seconds} seconds ...`,
      empty: 'Please enter a question.',
      tooLong: `Please shorten the message to ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      privacy: 'Privacy',
      transcriptTitle: 'HUNDESALON_NIKA conversation',
      closeChat: 'Close chat',
      registrationTitle: 'Register before your first conversation',
      registrationIntro: 'This lets our team match your enquiry and reply to you personally.',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email address',
      phone: 'Phone (optional)',
      consent: 'I agree that my details may be processed to handle this enquiry.',
      register: 'Continue securely to chat',
      registrationError: 'Please check your details and try again.',
    }),
    ru: Object.freeze({
      assistant: 'AI-ассистент по уходу за питомцами',
      launcher: 'Открыть ассистента HUNDESALON_NIKA',
      welcome:
        'Здравствуйте. Я отвечаю на вопросы об услугах, ценах, подготовке и записи по актуальной информации нашего сайта.',
      placeholder: 'Ваш вопрос HUNDESALON_NIKA ...',
      send: 'Отправить сообщение',
      personalSupport: 'Личная консультация',
      personalSupportActive: 'Личная консультация включена. Сообщения и файлы поступают напрямую нашей команде.',
      personalSupportSent: 'Сообщение отправлено нашей команде.',
      personalSupportSubtitle: 'Личная консультация с нашей командой',
      personalSupportPlaceholder: 'Ваше сообщение нашей команде ...',
      aiSupport: 'Перейти к AI-ассистенту',
      aiSupportActive: 'AI-ассистент снова включён.',
      attach: 'Отправить файл сотруднику',
      attachHint: 'Все форматы файлов до 150 МБ безопасно отправляются нашей команде.',
      fileTooLarge: 'Размер файла не должен превышать 150 МБ.',
      uploadPreparing: 'Подготавливаю безопасную загрузку ...',
      uploadComplete: 'Файл безопасно отправлен сотруднику.',
      uploadDuplicate: 'Этот файл уже был получен. Вторая копия не создана.',
      uploadStored: 'Файл сохранён, но уведомление сотрудника не подтверждено.',
      uploadFailed: 'Не удалось отправить файл. Повторите попытку.',
      uploadCancel: 'Отменить загрузку',
      emoji: 'Вставить emoji',
      emojiSearch: 'Поиск emoji',
      emojiLoading: 'Загружаю emoji ...',
      gif: 'Выбрать GIF',
      gifSearch: 'Поиск GIF',
      gifLoading: 'Загружаю GIF ...',
      gifEmpty: 'Подходящие GIF не найдены.',
      gifUnavailable: 'GIF сейчас недоступны.',
      gifSent: 'GIF добавлена в диалог.',
      voice: 'Записать голосовое сообщение',
      voiceUnsupported: 'Этот браузер не поддерживает голосовые сообщения.',
      listening: 'Идёт запись ...',
      voiceError: 'Не удалось начать запись.',
      voiceStop: 'Остановить запись',
      voiceCancel: 'Удалить запись',
      voiceReady: 'Голосовое сообщение готово.',
      voiceSend: 'Отправить голосовое сообщение',
      menu: 'Быстрые действия',
      minimize: 'Свернуть чат',
      decreaseFont: 'Уменьшить шрифт',
      increaseFont: 'Увеличить шрифт',
      expand: 'Развернуть просмотр',
      collapse: 'Обычный вид',
      download: 'Скачать транскрипт',
      clearChat: 'Очистить чат',
      clearChatConfirm: 'Очистить историю этого чата и начать новый разговор?',
      typing: 'Ассистент проверяет информацию сайта ...',
      unavailable: 'Ассистент сейчас недоступен. Используйте личную консультацию.',
      rateLimited: 'Слишком много запросов за короткое время. Подождите минуту или откройте личную консультацию.',
      rateLimitedRetry: seconds => `Достигнут лимит запросов. Повторю автоматически через ${seconds} сек. ...`,
      empty: 'Введите вопрос.',
      tooLong: `Сократите сообщение до ${MAX_MESSAGE_LENGTH} знаков.`,
      privacy: 'Конфиденциальность',
      transcriptTitle: 'Диалог HUNDESALON_NIKA',
      closeChat: 'Закрыть чат',
      registrationTitle: 'Регистрация перед первым обращением',
      registrationIntro: 'Так сотрудник увидит, кто обращается, и сможет ответить вам лично.',
      firstName: 'Имя',
      lastName: 'Фамилия',
      email: 'Электронная почта',
      phone: 'Телефон (по желанию)',
      consent: 'Я согласен(на) на обработку данных для ответа на это обращение.',
      register: 'Безопасно перейти к чату',
      registrationError: 'Проверьте введённые данные и повторите попытку.',
    }),
    uk: Object.freeze({
      assistant: 'AI-асистент з догляду за улюбленцями',
      launcher: 'Відкрити асистента HUNDESALON_NIKA',
      welcome:
        'Вітаю. Я відповідаю на запитання про послуги, ціни, підготовку та запис за актуальною інформацією нашого сайту.',
      placeholder: 'Ваше запитання HUNDESALON_NIKA ...',
      send: 'Надіслати повідомлення',
      personalSupport: 'Особиста консультація',
      personalSupportActive: 'Особисту консультацію ввімкнено. Повідомлення та файли надходять безпосередньо нашій команді.',
      personalSupportSent: 'Повідомлення надіслано нашій команді.',
      personalSupportSubtitle: 'Особиста консультація з нашою командою',
      personalSupportPlaceholder: 'Ваше повідомлення нашій команді ...',
      aiSupport: 'Перейти до AI-асистента',
      aiSupportActive: 'AI-асистента знову ввімкнено.',
      attach: 'Надіслати файл співробітнику',
      attachHint: 'Усі формати файлів до 150 МБ безпечно надсилаються нашій команді.',
      fileTooLarge: 'Розмір файлу не повинен перевищувати 150 МБ.',
      uploadPreparing: 'Готую безпечне завантаження ...',
      uploadComplete: 'Файл безпечно надіслано співробітнику.',
      uploadDuplicate: 'Цей файл уже було отримано. Другу копію не створено.',
      uploadStored: 'Файл збережено, але сповіщення співробітника не підтверджено.',
      uploadFailed: 'Не вдалося надіслати файл. Спробуйте ще раз.',
      uploadCancel: 'Скасувати завантаження',
      emoji: 'Вставити emoji',
      emojiSearch: 'Пошук emoji',
      emojiLoading: 'Завантажую emoji ...',
      gif: 'Вибрати GIF',
      gifSearch: 'Пошук GIF',
      gifLoading: 'Завантажую GIF ...',
      gifEmpty: 'Відповідні GIF не знайдені.',
      gifUnavailable: 'GIF зараз недоступні.',
      gifSent: 'GIF додано до діалогу.',
      voice: 'Записати голосове повідомлення',
      voiceUnsupported: 'Цей браузер не підтримує голосові повідомлення.',
      listening: 'Триває запис ...',
      voiceError: 'Не вдалося почати запис.',
      voiceStop: 'Зупинити запис',
      voiceCancel: 'Видалити запис',
      voiceReady: 'Голосове повідомлення готове.',
      voiceSend: 'Надіслати голосове повідомлення',
      menu: 'Швидкі дії',
      minimize: 'Згорнути чат',
      decreaseFont: 'Зменшити шрифт',
      increaseFont: 'Збільшити шрифт',
      expand: 'Розгорнути перегляд',
      collapse: 'Звичайний вигляд',
      download: 'Завантажити транскрипт',
      clearChat: 'Очистити чат',
      clearChatConfirm: 'Очистити історію цього чату та почати нову розмову?',
      typing: 'Асистент перевіряє інформацію сайту ...',
      unavailable: 'Асистент зараз недоступний. Скористайтеся особистою консультацією.',
      rateLimited: 'Забагато запитів за короткий час. Зачекайте хвилину або відкрийте особисту консультацію.',
      rateLimitedRetry: seconds => `Досягнуто ліміт запитів. Повторю автоматично через ${seconds} с ...`,
      empty: 'Введіть запитання.',
      tooLong: `Скоротіть повідомлення до ${MAX_MESSAGE_LENGTH} символів.`,
      privacy: 'Конфіденційність',
      transcriptTitle: 'Діалог HUNDESALON_NIKA',
      closeChat: 'Закрити чат',
      registrationTitle: 'Реєстрація перед першим зверненням',
      registrationIntro: 'Так співробітник бачитиме, хто звертається, і зможе відповісти особисто.',
      firstName: 'Ім’я',
      lastName: 'Прізвище',
      email: 'Електронна пошта',
      phone: 'Телефон (необов’язково)',
      consent: 'Я погоджуюся на обробку даних для відповіді на це звернення.',
      register: 'Безпечно перейти до чату',
      registrationError: 'Перевірте введені дані та повторіть спробу.',
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
    stop: 'M7 7h10v10H7z',
    trash: 'M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13',
    upload: 'M12 16V4m0 0-5 5m5-5 5 5M5 20h14',
  });

  const FALLBACK_EMOJIS = ['😊', '🐶', '🐱', '❤️', '👍', '😍', '✨', '🐾', '🙏', '😌', '😄', '🎉'];
  const EMOJI_GROUP_ICONS = Object.freeze({
    'Smileys & Emotion': '😀',
    'People & Body': '👋',
    Component: '🎨',
    'Animals & Nature': '🐶',
    'Food & Drink': '🍎',
    'Travel & Places': '🚗',
    Activities: '⚽',
    Objects: '💡',
    Symbols: '❤️',
    Flags: '🏳️',
  });

  function pageLocale() {
    const candidate = String(document.documentElement.lang || location.pathname.split('/')[1] || 'de')
      .toLowerCase()
      .slice(0, 2);
    return SUPPORTED_LOCALES.has(candidate) ? candidate : 'de';
  }

  function readTextSizeLevel() {
    try {
      const storedLevel = localStorage.getItem(TEXT_SIZE_KEY);
      if (storedLevel === null) return DEFAULT_TEXT_SIZE_LEVEL;
      const level = Number(storedLevel);
      return Number.isInteger(level) && level >= 0 && level < TEXT_SIZE_ADJUSTMENTS.length
        ? level
        : DEFAULT_TEXT_SIZE_LEVEL;
    } catch {
      return DEFAULT_TEXT_SIZE_LEVEL;
    }
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

  function sessionStorageKey(locale) {
    return `${SESSION_KEY}:${locale}`;
  }

  function createSessionId(locale) {
    const created = window.crypto.randomUUID();
    try {
      sessionStorage.setItem(sessionStorageKey(locale), created);
    } catch {
      // The in-memory ID still keeps this page isolated when storage is unavailable.
    }
    return created;
  }

  function safeSessionId(locale) {
    try {
      const stored = sessionStorage.getItem(sessionStorageKey(locale));
      if (/^[a-z0-9-]{16,64}$/i.test(stored || '')) return stored;
      return createSessionId(locale);
    } catch {
      return window.crypto.randomUUID();
    }
  }

  function readIdentity() {
    try {
      const value = JSON.parse(localStorage.getItem(REGISTRATION_KEY) || 'null');
      if (
        /^[a-f0-9-]{36}$/i.test(value?.sessionId || '') &&
        /^[a-f0-9-]{64,160}$/i.test(value?.sessionToken || '')
      ) {
        return { sessionId: value.sessionId, sessionToken: value.sessionToken };
      }
    } catch {
      /* registration is shown when the saved identity is unavailable */
    }
    return null;
  }

  function saveIdentity(identity) {
    try {
      localStorage.setItem(
        REGISTRATION_KEY,
        JSON.stringify({ sessionId: identity.sessionId, sessionToken: identity.sessionToken })
      );
    } catch {
      // The active page can keep using the in-memory identity when storage is unavailable.
    }
  }

  function replyCursorKey(sessionId) {
    return `${REGISTRATION_KEY}:reply:${sessionId}`;
  }

  function readReplyCursor(sessionId) {
    try {
      const value = Number(localStorage.getItem(replyCursorKey(sessionId)) || 0);
      return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function saveReplyCursor(sessionId, sequence) {
    try {
      localStorage.setItem(replyCursorKey(sessionId), String(sequence));
    } catch {
      // Reply polling still works in memory for the active page.
    }
  }

  function transcriptRevisionKey(locale, sessionId) {
    return `${STORAGE_PREFIX}:revision:${locale}:${sessionId}`;
  }

  function readTranscriptRevision(locale, sessionId) {
    try {
      const revision = Number(sessionStorage.getItem(transcriptRevisionKey(locale, sessionId)) || 0);
      return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
    } catch {
      return 0;
    }
  }

  function writeTranscriptRevision(locale, sessionId, revision) {
    try {
      sessionStorage.setItem(transcriptRevisionKey(locale, sessionId), String(revision));
    } catch {
      /* keep the in-memory revision when storage is unavailable */
    }
  }

  function normalizeStoredAttachment(input) {
    if (!input || typeof input !== 'object') return null;
    const name = String(input.name || '').trim().slice(0, 180);
    const size = Number(input.size);
    const mimeType = String(input.mimeType || '').trim().slice(0, 120);
    if (!name || !Number.isSafeInteger(size) || size < 0) return null;
    return {
      name,
      size,
      mimeType,
      kind: input.kind === 'voice' ? 'voice' : 'file',
      delivered: input.delivered === true,
    };
  }

  function readStoredMessages(locale) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(`${STORAGE_PREFIX}:${locale}`) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.slice(-MAX_STORED_MESSAGES).flatMap(item => {
        const role = item?.role === 'assistant' ? 'assistant' : item?.role === 'user' ? 'user' : '';
        const content = typeof item?.content === 'string' ? item.content.trim().slice(0, 4000) : '';
        const media = normalizeGif(item?.media);
        const attachment = normalizeStoredAttachment(item?.attachment);
        return role && (content || attachment)
          ? [{ role, content, ...(media ? { media } : {}), ...(attachment ? { attachment } : {}) }]
          : [];
      });
    } catch {
      return [];
    }
  }

  function normalizeGif(input) {
    if (!input || typeof input !== 'object') return null;
    try {
      const url = new URL(String(input.url || ''));
      const preview = new URL(String(input.preview || input.url || ''));
      const allowed = candidate => candidate.protocol === 'https:' && /(^|\.)giphy\.com$/i.test(candidate.hostname);
      if (!allowed(url) || !allowed(preview)) return null;
      return {
        type: 'gif',
        url: url.href,
        preview: preview.href,
        title: String(input.title || 'GIF').trim().slice(0, 160) || 'GIF',
      };
    } catch {
      return null;
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

  let emojiDataPromise;

  function loadEmojiData() {
    emojiDataPromise ||= fetch(EMOJI_DATA_URL, { credentials: 'same-origin' })
      .then(response => {
        if (!response.ok) throw new Error('EMOJI_DATA_REQUEST_FAILED');
        return response.json();
      })
      .then(data => {
        if (!Array.isArray(data?.groups) || !data.groups.length) throw new Error('EMOJI_DATA_INVALID');
        return data.groups;
      });
    return emojiDataPromise;
  }

  function formatBytes(bytes, locale) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024) + ' MB';
  }

  async function sha256Hex(file) {
    const digest = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function formatDuration(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function recorderMimeType() {
    if (!window.MediaRecorder) return '';
    return (
      ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(type =>
        window.MediaRecorder.isTypeSupported(type)
      ) || ''
    );
  }

  function uploadChunk({ uploadUrl, uploadSignature, blob, start, total, mimeType, onProgress, registerRequest }) {
    return new Promise((resolve, reject) => {
      const xhr = new window.XMLHttpRequest();
      registerRequest(xhr);
      xhr.open('POST', '/api/ai-chat-upload-chunk');
      xhr.setRequestHeader('X-Upload-Url', uploadUrl);
      xhr.setRequestHeader('X-Upload-Signature', uploadSignature);
      xhr.setRequestHeader('Content-Type', mimeType);
      xhr.setRequestHeader('Content-Range', `bytes ${start}-${start + blob.size - 1}/${total}`);
      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable) onProgress(start + event.loaded, total);
      });
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const payload = JSON.parse(xhr.responseText || '{}');
            if (payload?.success && payload?.complete === false) resolve(null);
            else if (payload?.success && payload?.file?.id) resolve(payload.file);
            else reject(new Error('UPLOAD_RESPONSE_INVALID'));
          } catch {
            reject(new Error('UPLOAD_RESPONSE_INVALID'));
          }
          return;
        }
        const error = new Error(`UPLOAD_CHUNK_FAILED_${xhr.status}`);
        error.status = xhr.status;
        reject(error);
      });
      xhr.addEventListener('error', () => reject(new Error('UPLOAD_NETWORK_ERROR')));
      xhr.addEventListener('abort', () => reject(new window.DOMException('Upload cancelled', 'AbortError')));
      xhr.send(blob);
    });
  }

  function initAiChat() {
    if (document.getElementById(CHAT_ID)) return;

    const locale = pageLocale();
    const copy = COPY[locale];
    const identity = readIdentity();
    const sessionId = identity?.sessionId || safeSessionId(locale);
    const storedMessages = readStoredMessages(locale);
    let storedMode = 'ai';
    try {
      storedMode = localStorage.getItem(MODE_KEY) === 'human' ? 'human' : 'ai';
    } catch {
      // Keep the default mode when browser storage is unavailable.
    }
    const storedRevision = Math.max(readTranscriptRevision(locale, sessionId), storedMessages.length ? 1 : 0);
    const state = {
      busy: false,
      expanded: false,
      mode: storedMode,
      messages: storedMessages,
      sessionId,
      sessionToken: identity?.sessionToken || '',
      replySequence: identity ? readReplyCursor(identity.sessionId) : 0,
      replyPollPending: false,
      modeChangePending: false,
      modeRevision: 0,
      textSizeLevel: readTextSizeLevel(),
      emojiGroups: null,
      activeEmojiGroup: '',
      activeUpload: null,
      recorder: null,
      recordingUrl: '',
      recordedFile: null,
      gifRequest: null,
      gifSearchTimer: null,
      transcriptTimer: null,
      transcriptSyncPromise: Promise.resolve(),
      transcriptRevision: storedRevision,
      viewportFrame: 0,
    };
    if (storedRevision) writeTranscriptRevision(locale, sessionId, storedRevision);

    const root = document.createElement('section');
    root.id = CHAT_ID;
    root.className = 'hn-ai-chat';
    root.dataset.open = 'false';
    root.dataset.mode = state.mode;
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
    menuToggle.setAttribute('aria-controls', 'hn-ai-menu');
    menuToggle.setAttribute('aria-haspopup', 'menu');
    const decreaseFont = button({
      className: 'hn-ai-icon-button hn-ai-font-button',
      label: copy.decreaseFont,
      text: '−',
    });
    const increaseFont = button({
      className: 'hn-ai-icon-button hn-ai-font-button',
      label: copy.increaseFont,
      text: '+',
    });
    const minimize = button({ className: 'hn-ai-icon-button', label: copy.minimize, iconName: 'minimize' });
    headerActions.append(menuToggle, decreaseFont, increaseFont, minimize);
    header.append(brand, headerActions);

    const menu = document.createElement('div');
    menu.id = 'hn-ai-menu';
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
      label: copy.clearChat,
      iconName: 'trash',
      text: copy.clearChat,
    });
    const closeMenu = button({
      className: 'hn-ai-menu-action',
      label: copy.closeChat,
      iconName: 'close',
      text: copy.closeChat,
    });
    const menuActions = [closeMenu, expand, download, reset];
    menuActions.forEach(action => action.setAttribute('role', 'menuitem'));
    menu.append(menuTitle, ...menuActions);

    const registration = document.createElement('section');
    registration.className = 'hn-ai-registration';
    registration.hidden = Boolean(state.sessionToken);
    const registrationTitle = document.createElement('h3');
    registrationTitle.textContent = copy.registrationTitle;
    const registrationIntro = document.createElement('p');
    registrationIntro.textContent = copy.registrationIntro;
    const registrationForm = document.createElement('form');
    registrationForm.className = 'hn-ai-registration-form';
    const registrationField = (labelText, type, autocomplete, required = true) => {
      const label = document.createElement('label');
      const labelValue = document.createElement('span');
      const field = document.createElement('input');
      labelValue.textContent = labelText;
      field.type = type;
      field.autocomplete = autocomplete;
      field.required = required;
      field.maxLength = type === 'email' ? 254 : type === 'tel' ? 40 : 80;
      label.append(labelValue, field);
      return { label, field };
    };
    const firstName = registrationField(copy.firstName, 'text', 'given-name');
    const lastName = registrationField(copy.lastName, 'text', 'family-name');
    const email = registrationField(copy.email, 'email', 'email');
    const phone = registrationField(copy.phone, 'tel', 'tel', false);
    const consentLabel = document.createElement('label');
    consentLabel.className = 'hn-ai-registration-consent';
    const consent = document.createElement('input');
    consent.type = 'checkbox';
    consent.required = true;
    const consentText = document.createElement('span');
    consentText.textContent = copy.consent;
    consentLabel.append(consent, consentText);
    const registrationSubmit = document.createElement('button');
    registrationSubmit.type = 'submit';
    registrationSubmit.className = 'hn-ai-registration-submit';
    registrationSubmit.textContent = copy.register;
    const registrationError = document.createElement('p');
    registrationError.className = 'hn-ai-registration-error';
    registrationError.setAttribute('role', 'alert');
    registrationForm.append(
      firstName.label,
      lastName.label,
      email.label,
      phone.label,
      consentLabel,
      registrationSubmit,
      registrationError
    );
    registration.append(registrationTitle, registrationIntro, registrationForm);

    const messages = document.createElement('div');
    messages.className = 'hn-ai-messages';
    messages.setAttribute('role', 'log');
    messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-relevant', 'additions');

    const welcome = document.createElement('div');
    welcome.className = 'hn-ai-welcome';
    const welcomeMark = document.createElement('img');
    welcomeMark.src = BRAND_LOGO;
    welcomeMark.alt = '';
    welcomeMark.width = 32;
    welcomeMark.height = 32;
    welcomeMark.decoding = 'async';
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
    composer.hidden = !state.sessionToken;
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
    const gifToggle = button({ className: 'hn-ai-tool hn-ai-gif-tool', label: copy.gif, text: 'GIF' });
    gifToggle.setAttribute('aria-expanded', 'false');
    const voice = button({ className: 'hn-ai-tool', label: copy.voice, iconName: 'voice' });
    const attach = button({ className: 'hn-ai-tool', label: copy.attach, iconName: 'attach' });
    tools.append(emojiToggle, gifToggle, attach, voice);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = 'hn-ai-visually-hidden';
    fileInput.tabIndex = -1;
    fileInput.setAttribute('aria-hidden', 'true');
    const support = button({
      className: 'hn-ai-support',
      label: copy.personalSupport,
      iconName: 'support',
      text: copy.personalSupport,
    });
    composerBar.append(tools, support);

    function updateConversationMode(mode, { announce = true } = {}) {
      state.mode = mode === 'human' ? 'human' : 'ai';
      root.dataset.mode = state.mode;
      const human = state.mode === 'human';
      subtitle.textContent = human ? copy.personalSupportSubtitle : copy.assistant;
      textarea.placeholder = human ? copy.personalSupportPlaceholder : copy.placeholder;
      textarea.setAttribute('aria-label', textarea.placeholder);
      const supportLabel = human ? copy.aiSupport : copy.personalSupport;
      support.querySelector('span').textContent = supportLabel;
      support.setAttribute('aria-label', supportLabel);
      support.title = supportLabel;
      try {
        localStorage.setItem(MODE_KEY, state.mode);
      } catch {
        // The in-memory mode still works for this page.
      }
      if (announce) setStatus(human ? copy.personalSupportActive : copy.aiSupportActive);
    }

    const emojiPicker = document.createElement('section');
    emojiPicker.className = 'hn-ai-emoji-picker';
    emojiPicker.hidden = true;
    emojiPicker.setAttribute('aria-label', copy.emoji);
    emojiPicker.setAttribute('role', 'dialog');
    const emojiSearch = document.createElement('input');
    emojiSearch.type = 'search';
    emojiSearch.className = 'hn-ai-emoji-search';
    emojiSearch.placeholder = copy.emojiSearch;
    emojiSearch.setAttribute('aria-label', copy.emojiSearch);
    const emojiTabs = document.createElement('div');
    emojiTabs.className = 'hn-ai-emoji-tabs';
    emojiTabs.setAttribute('role', 'tablist');
    const emojiGrid = document.createElement('div');
    emojiGrid.className = 'hn-ai-emoji-grid';
    emojiGrid.setAttribute('role', 'listbox');
    const emojiLoading = document.createElement('p');
    emojiLoading.className = 'hn-ai-emoji-loading';
    emojiLoading.textContent = copy.emojiLoading;
    emojiPicker.append(emojiSearch, emojiTabs, emojiGrid, emojiLoading);

    const gifPicker = document.createElement('section');
    gifPicker.className = 'hn-ai-gif-picker';
    gifPicker.hidden = true;
    gifPicker.setAttribute('aria-label', copy.gif);
    gifPicker.setAttribute('role', 'dialog');
    const gifSearch = document.createElement('input');
    gifSearch.type = 'search';
    gifSearch.className = 'hn-ai-gif-search';
    gifSearch.placeholder = copy.gifSearch;
    gifSearch.setAttribute('aria-label', copy.gifSearch);
    const gifGrid = document.createElement('div');
    gifGrid.className = 'hn-ai-gif-grid';
    gifGrid.setAttribute('role', 'listbox');
    const gifLoading = document.createElement('p');
    gifLoading.className = 'hn-ai-gif-loading';
    gifLoading.textContent = copy.gifLoading;
    const gifAttribution = document.createElement('a');
    gifAttribution.className = 'hn-ai-gif-attribution';
    gifAttribution.href = 'https://giphy.com/';
    gifAttribution.target = '_blank';
    gifAttribution.rel = 'noopener noreferrer';
    gifAttribution.textContent = 'Powered by GIPHY';
    gifPicker.append(gifSearch, gifGrid, gifLoading, gifAttribution);

    const transfer = document.createElement('section');
    transfer.className = 'hn-ai-transfer';
    transfer.hidden = true;
    transfer.setAttribute('aria-live', 'polite');
    const transferName = document.createElement('strong');
    const transferMeta = document.createElement('span');
    const transferTrack = document.createElement('span');
    transferTrack.className = 'hn-ai-transfer-track';
    const transferProgress = document.createElement('span');
    transferTrack.appendChild(transferProgress);
    const transferCancel = button({ className: 'hn-ai-transfer-cancel', label: copy.uploadCancel, iconName: 'close' });
    transfer.append(transferName, transferMeta, transferTrack, transferCancel);

    const recorderPanel = document.createElement('section');
    recorderPanel.className = 'hn-ai-recorder';
    recorderPanel.hidden = true;
    recorderPanel.setAttribute('aria-live', 'polite');
    const recorderPulse = document.createElement('span');
    recorderPulse.className = 'hn-ai-recorder-pulse';
    const recorderTime = document.createElement('strong');
    recorderTime.textContent = '00:00';
    const recorderText = document.createElement('span');
    recorderText.textContent = copy.listening;
    const recorderAudio = document.createElement('audio');
    recorderAudio.controls = true;
    recorderAudio.hidden = true;
    const recorderActions = document.createElement('div');
    const recorderCancel = button({ className: 'hn-ai-recorder-action', label: copy.voiceCancel, iconName: 'trash' });
    const recorderStop = button({ className: 'hn-ai-recorder-action is-primary', label: copy.voiceStop, iconName: 'stop' });
    const recorderSend = button({ className: 'hn-ai-recorder-action is-primary', label: copy.voiceSend, iconName: 'upload' });
    recorderSend.hidden = true;
    recorderActions.append(recorderCancel, recorderStop, recorderSend);
    recorderPanel.append(recorderPulse, recorderTime, recorderText, recorderAudio, recorderActions);

    const status = document.createElement('p');
    status.className = 'hn-ai-status';
    status.setAttribute('aria-live', 'polite');
    const privacy = document.createElement('a');
    privacy.className = 'hn-ai-privacy';
    privacy.href = `/${locale}/datenschutz.html`;
    privacy.textContent = copy.privacy;
    composer.append(inputWrap, composerBar, fileInput, emojiPicker, gifPicker, transfer, recorderPanel, status, privacy);

    panel.append(header, menu, registration, messages, typing, composer);
    root.append(panel, launcher);
    document.body.appendChild(root);

    function syncChatViewport() {
      window.cancelAnimationFrame(state.viewportFrame);
      state.viewportFrame = window.requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const viewportHeight = Math.max(1, Math.round(viewport?.height || window.innerHeight));
        const viewportWidth = Math.max(1, Math.round(viewport?.width || window.innerWidth));
        root.style.setProperty('--hn-ai-viewport-height', `${viewportHeight}px`);
        root.style.setProperty('--hn-ai-viewport-width', `${viewportWidth}px`);
        root.style.setProperty('--hn-ai-viewport-top', `${Math.max(0, Math.round(viewport?.offsetTop || 0))}px`);
        root.style.setProperty('--hn-ai-viewport-left', `${Math.max(0, Math.round(viewport?.offsetLeft || 0))}px`);
        root.style.setProperty(
          '--hn-ai-viewport-bottom',
          `${Math.max(0, Math.round(window.innerHeight - viewportHeight - (viewport?.offsetTop || 0)))}px`
        );
        if (root.dataset.open === 'true' && root.contains(document.activeElement)) scrollToLatest();
      });
    }

    function setStatus(message, timeout = 4200) {
      clearTimeout(status.__clearTimer);
      status.textContent = message;
      if (message && timeout > 0) {
        status.__clearTimer = setTimeout(() => {
          status.textContent = '';
        }, timeout);
      }
    }

    function applyRegisteredIdentity(result, profile = null) {
      state.sessionId = result.sessionId;
      state.sessionToken = result.sessionToken;
      state.replySequence = readReplyCursor(result.sessionId);
      saveIdentity(result);
      registration.hidden = true;
      composer.hidden = false;
      if (profile) {
        window.oSpP = {
          ...(window.oSpP && typeof window.oSpP === 'object' ? window.oSpP : {}),
          customer_name: `${profile.firstName} ${profile.lastName}`.trim(),
          email: profile.email,
          phone: profile.phone || '',
          chat_session_id: result.sessionId,
        };
      }
      textarea.focus({ preventScroll: true });
    }

    function requireRegistration() {
      state.sessionToken = '';
      try {
        localStorage.removeItem(REGISTRATION_KEY);
      } catch {
        // The in-memory session is already invalidated for this page.
      }
      registration.hidden = false;
      composer.hidden = true;
      registrationError.textContent = copy.registrationError;
      requestAnimationFrame(() => firstName.field.focus({ preventScroll: true }));
    }

    async function pollStaffReplies() {
      if (!state.sessionToken || document.hidden || state.replyPollPending) return;
      const modeRevision = state.modeRevision;
      state.replyPollPending = true;
      try {
        const response = await fetch(SESSION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'poll',
            sessionId: state.sessionId,
            sessionToken: state.sessionToken,
            afterSequence: state.replySequence,
          }),
        });
        if (response.status === 401) {
          requireRegistration();
          return;
        }
        if (!response.ok) return;
        const result = await response.json();
        if (modeRevision === state.modeRevision && result?.mode === 'human' && state.mode !== 'human') {
          updateConversationMode('human');
        }
        for (const reply of Array.isArray(result?.replies) ? result.replies : []) {
          if (typeof reply?.body === 'string' && reply.body.trim()) addMessage('assistant', reply.body.trim());
          state.replySequence = Math.max(state.replySequence, Number(reply?.sequence) || 0);
        }
        saveReplyCursor(state.sessionId, state.replySequence);
      } catch {
        /* the next poll retries transient failures */
      } finally {
        state.replyPollPending = false;
      }
    }

    async function registerCustomer() {
      registrationError.textContent = '';
      registrationSubmit.disabled = true;
      try {
        const profile = {
          firstName: firstName.field.value.trim(),
          lastName: lastName.field.value.trim(),
          email: email.field.value.trim(),
          phone: phone.field.value.trim(),
        };
        const response = await fetch(SESSION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'register',
            ...profile,
            locale,
            pagePath: location.pathname,
            privacyConsent: consent.checked,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.success) throw new Error('REGISTRATION_FAILED');
        applyRegisteredIdentity(result, profile);
      } catch {
        registrationError.textContent = copy.registrationError;
      } finally {
        registrationSubmit.disabled = false;
      }
    }

    function insertEmoji(value) {
      const start = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
      textarea.setRangeText(value, start, textarea.selectionEnd ?? start, 'end');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      try {
        const recents = JSON.parse(localStorage.getItem(EMOJI_RECENTS_KEY) || '[]');
        localStorage.setItem(
          EMOJI_RECENTS_KEY,
          JSON.stringify([value, ...(Array.isArray(recents) ? recents : []).filter(item => item !== value)].slice(0, 30))
        );
      } catch {
        // Emoji insertion remains available when local storage is blocked.
      }
      textarea.focus();
    }

    function renderEmoji(items) {
      const fragment = document.createDocumentFragment();
      for (const item of items) {
        const value = typeof item === 'string' ? item : item.value;
        const label = typeof item === 'string' ? item : item.name;
        const emojiButton = button({ className: 'hn-ai-emoji', label, text: value });
        emojiButton.setAttribute('role', 'option');
        emojiButton.addEventListener('click', () => insertEmoji(value));
        fragment.appendChild(emojiButton);
      }
      emojiGrid.replaceChildren(fragment);
    }

    function selectEmojiGroup(groupName) {
      const group = state.emojiGroups?.find(item => item.name === groupName) || state.emojiGroups?.[0];
      if (!group) return;
      state.activeEmojiGroup = group.name;
      for (const tab of emojiTabs.querySelectorAll('button')) {
        const selected = tab.dataset.group === group.name;
        tab.classList.toggle('is-active', selected);
        tab.setAttribute('aria-selected', String(selected));
      }
      emojiSearch.value = '';
      renderEmoji(group.emoji);
    }

    function mountEmojiGroups(groups) {
      state.emojiGroups = groups;
      emojiLoading.hidden = true;
      emojiTabs.replaceChildren();
      for (const group of groups) {
        const tab = button({
          className: 'hn-ai-emoji-tab',
          label: group.name,
          text: EMOJI_GROUP_ICONS[group.name] || '•',
        });
        tab.dataset.group = group.name;
        tab.setAttribute('role', 'tab');
        tab.addEventListener('click', () => selectEmojiGroup(group.name));
        emojiTabs.appendChild(tab);
      }
      selectEmojiGroup(groups[0]?.name);
    }

    async function ensureEmojiPicker() {
      if (state.emojiGroups) return;
      emojiLoading.hidden = false;
      try {
        mountEmojiGroups(await loadEmojiData());
      } catch {
        mountEmojiGroups([{ name: 'Smileys & Emotion', emoji: FALLBACK_EMOJIS }]);
      }
    }

    function renderGifs(items) {
      const fragment = document.createDocumentFragment();
      for (const rawItem of items) {
        const item = normalizeGif(rawItem);
        if (!item) continue;
        const option = button({ className: 'hn-ai-gif', label: item.title });
        option.setAttribute('role', 'option');
        const image = document.createElement('img');
        image.src = item.preview;
        image.alt = item.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        option.appendChild(image);
        option.addEventListener('click', () => {
          addMessage('user', item.title, { media: item });
          closePopovers();
          setStatus(copy.gifSent);
        });
        fragment.appendChild(option);
      }
      gifGrid.replaceChildren(fragment);
      if (!gifGrid.childElementCount) {
        gifLoading.hidden = false;
        gifLoading.textContent = copy.gifEmpty;
      }
    }

    async function loadGifs(query = '') {
      state.gifRequest?.abort();
      const controller = new window.AbortController();
      state.gifRequest = controller;
      gifLoading.hidden = false;
      gifLoading.textContent = copy.gifLoading;
      gifGrid.replaceChildren();
      try {
        const params = new URLSearchParams({ locale });
        if (query) params.set('q', query);
        const response = await fetch(`${GIF_ENDPOINT}?${params}`, { signal: controller.signal, credentials: 'same-origin' });
        if (!response.ok) throw new Error('GIF_REQUEST_FAILED');
        const result = await response.json();
        gifLoading.hidden = true;
        renderGifs(Array.isArray(result?.items) ? result.items : []);
      } catch (error) {
        if (error?.name === 'AbortError') return;
        gifGrid.replaceChildren();
        gifLoading.hidden = false;
        gifLoading.textContent = copy.gifUnavailable;
      } finally {
        if (state.gifRequest === controller) state.gifRequest = null;
      }
    }

    function updateTransfer(file, progress, message) {
      transfer.hidden = false;
      transferName.textContent = file.name;
      transferMeta.textContent = `${formatBytes(file.size, locale)} · ${message}`;
      transferProgress.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    }

    function cancelUpload() {
      if (!state.activeUpload) return;
      state.activeUpload.cancelled = true;
      state.activeUpload.xhr?.abort();
      state.activeUpload = null;
      transfer.hidden = true;
      attach.disabled = false;
      voice.disabled = false;
    }

    async function sendFile(file, kind = 'file') {
      if (!(file instanceof window.File) || state.activeUpload || !state.sessionToken) return;
      if (file.size < 1 || file.size > MAX_FILE_BYTES) {
        setStatus(copy.fileTooLarge);
        return;
      }

      const uploadState = { cancelled: false, xhr: null };
      const uploadSessionId = state.sessionId;
      const clientMessageId = window.crypto.randomUUID();
      state.activeUpload = uploadState;
      attach.disabled = true;
      voice.disabled = true;
      updateTransfer(file, 0, copy.uploadPreparing);
      setStatus(copy.attachHint, 0);

      let contentSha256 = '';
      const completeStoredFile = async (fileId, reused) => {
        let completion = null;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const response = await fetch(UPLOAD_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'complete',
                fileId,
                fileName: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                kind,
                locale,
                sessionId: uploadSessionId,
                sessionToken: state.sessionToken,
                clientMessageId,
                contentSha256,
                mode: state.mode,
              }),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result?.success) throw new Error('UPLOAD_VERIFICATION_FAILED');
            completion = result;
            if (!result.retryable || attempt > 0) break;
          } catch (error) {
            if (uploadState.cancelled) throw error;
            if (attempt > 0) {
              if (completion) break;
              throw error;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        if (!completion) throw new Error('UPLOAD_VERIFICATION_FAILED');
        if (reused && completion.completionClaimed === false) {
          updateTransfer(file, 100, copy.uploadDuplicate);
          setStatus(copy.uploadDuplicate);
          transfer.hidden = true;
          return;
        }

        const delivered = completion.notified === true;
        const deliveryMessage = delivered ? copy.uploadComplete : copy.uploadStored;
        updateTransfer(file, 100, deliveryMessage);
        addMessage('user', file.name, {
          attachment: {
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            kind,
            delivered,
          },
        });
        transfer.hidden = true;
        setStatus(deliveryMessage);
      };
      try {
        contentSha256 = await sha256Hex(file);
        if (uploadState.cancelled) throw new window.DOMException('Upload cancelled', 'AbortError');
        const startPayload = {
          action: 'start',
          fileName: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          kind,
          locale,
          pagePath: location.pathname,
          sessionId: uploadSessionId,
          sessionToken: state.sessionToken,
          clientMessageId,
          contentSha256,
          mode: state.mode,
        };
        const sessionResponse = await fetch(UPLOAD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(startPayload),
        });
        const session = await sessionResponse.json().catch(() => ({}));
        if (!sessionResponse.ok || !session?.success) throw new Error(session?.message || 'UPLOAD_SESSION_FAILED');
        if (session.deduplicated === true) {
          if (!session.fileId) throw new Error('UPLOAD_SESSION_INVALID');
          await completeStoredFile(session.fileId, true);
          return;
        }
        if (!session.uploadUrl) throw new Error(session?.message || 'UPLOAD_SESSION_FAILED');

        if (!session.uploadSignature) throw new Error('UPLOAD_SESSION_INVALID');
        const chunkSize = Math.max(320 * 1024, Number(session.chunkSize) || 10 * 1024 * 1024);
        let completedFile = null;
        for (let start = 0; start < file.size; start += chunkSize) {
          if (uploadState.cancelled) throw new window.DOMException('Upload cancelled', 'AbortError');
          const chunk = file.slice(start, Math.min(file.size, start + chunkSize));
          let lastError;
          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              completedFile = await uploadChunk({
                uploadUrl: session.uploadUrl,
                uploadSignature: session.uploadSignature,
                blob: chunk,
                start,
                total: file.size,
                mimeType: session.mimeType || 'application/octet-stream',
                onProgress: (loaded, total) => updateTransfer(file, (loaded / total) * 100, `${Math.round((loaded / total) * 100)}%`),
                registerRequest: xhr => {
                  uploadState.xhr = xhr;
                },
              });
              lastError = null;
              break;
            } catch (error) {
              lastError = error;
              if (error?.name === 'AbortError' || uploadState.cancelled) throw error;
              if (error?.status === 409) throw error;
              if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * 2 ** attempt));
            }
          }
          if (lastError) throw lastError;
        }
        if (!completedFile?.id) throw new Error('UPLOAD_DID_NOT_COMPLETE');

        await completeStoredFile(completedFile.id, false);
      } catch (error) {
        if (error?.status === 409 && !uploadState.cancelled) {
          try {
            const reconciliationResponse = await fetch(UPLOAD_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'start',
                fileName: file.name,
                size: file.size,
                mimeType: file.type || 'application/octet-stream',
                kind,
                locale,
                pagePath: location.pathname,
                sessionId: uploadSessionId,
                sessionToken: state.sessionToken,
                clientMessageId,
                contentSha256,
              }),
            });
            const reconciliation = await reconciliationResponse.json().catch(() => ({}));
            if (reconciliationResponse.ok && reconciliation?.deduplicated === true && reconciliation.fileId) {
              await completeStoredFile(reconciliation.fileId, true);
              return;
            }
          } catch {
            /* fall through to the normal upload error */
          }
        }
        if (error?.name !== 'AbortError' && !uploadState.cancelled) {
          updateTransfer(file, 0, copy.uploadFailed);
          setStatus(copy.uploadFailed);
        }
      } finally {
        if (state.activeUpload === uploadState) state.activeUpload = null;
        attach.disabled = false;
        voice.disabled = false;
        fileInput.value = '';
      }
    }

    function resetRecorderPanel() {
      if (state.recordingUrl) URL.revokeObjectURL(state.recordingUrl);
      state.recordingUrl = '';
      state.recordedFile = null;
      recorderPanel.hidden = true;
      recorderAudio.hidden = true;
      recorderAudio.removeAttribute('src');
      recorderSend.hidden = true;
      recorderStop.hidden = false;
      recorderPulse.hidden = false;
      recorderTime.textContent = '00:00';
      recorderText.textContent = copy.listening;
    }

    function stopVoiceRecording(cancelled = false) {
      const recording = state.recorder;
      if (!recording) {
        if (cancelled) resetRecorderPanel();
        return;
      }
      recording.cancelled = cancelled;
      clearInterval(recording.timer);
      clearTimeout(recording.maxTimer);
      recording.stream.getTracks().forEach(track => track.stop());
      if (recording.instance.state !== 'inactive') recording.instance.stop();
      voice.classList.remove('is-listening');
      voice.setAttribute('aria-label', copy.voice);
      voice.title = copy.voice;
    }

    async function startVoiceRecording() {
      if (state.activeUpload) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setStatus(copy.voiceUnsupported);
        return;
      }
      if (state.recorder) {
        stopVoiceRecording(false);
        return;
      }

      resetRecorderPanel();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = recorderMimeType();
        const instance = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const recording = { instance, stream, chunks: [], startedAt: Date.now(), timer: null, maxTimer: null, cancelled: false };
        state.recorder = recording;
        instance.addEventListener('dataavailable', event => {
          if (event.data?.size) recording.chunks.push(event.data);
        });
        instance.addEventListener('stop', () => {
          state.recorder = null;
          if (recording.cancelled || !recording.chunks.length) {
            resetRecorderPanel();
            return;
          }
          const type = instance.mimeType || recording.chunks[0].type || 'audio/webm';
          const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
          const blob = new window.Blob(recording.chunks, { type });
          state.recordedFile = new window.File(
            [blob],
            `voice-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
            { type }
          );
          state.recordingUrl = URL.createObjectURL(blob);
          recorderAudio.src = state.recordingUrl;
          recorderAudio.hidden = false;
          recorderStop.hidden = true;
          recorderSend.hidden = false;
          recorderPulse.hidden = true;
          recorderText.textContent = copy.voiceReady;
          setStatus(copy.voiceReady);
        });
        instance.start(1000);
        recorderPanel.hidden = false;
        voice.classList.add('is-listening');
        voice.setAttribute('aria-label', copy.voiceStop);
        voice.title = copy.voiceStop;
        setStatus(copy.listening, 0);
        recording.timer = setInterval(() => {
          recorderTime.textContent = formatDuration(Date.now() - recording.startedAt);
        }, 250);
        recording.maxTimer = setTimeout(() => stopVoiceRecording(false), MAX_VOICE_DURATION_MS);
      } catch {
        setStatus(copy.voiceError);
        resetRecorderPanel();
      }
    }

    const menuBackgroundSections = [registration, messages, typing, composer];

    function setMenuOpen(open, { focus = false } = {}) {
      menu.hidden = !open;
      menuToggle.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('has-open-menu', open);
      menuBackgroundSections.forEach(section => {
        section.toggleAttribute('inert', open);
      });
      if (open && focus) requestAnimationFrame(() => closeMenu.focus({ preventScroll: true }));
    }

    function closePopovers() {
      setMenuOpen(false);
      emojiPicker.hidden = true;
      emojiToggle.setAttribute('aria-expanded', 'false');
      gifPicker.hidden = true;
      gifToggle.setAttribute('aria-expanded', 'false');
    }

    function setOpen(open) {
      if (!open && state.recorder) stopVoiceRecording(true);
      root.dataset.open = String(open);
      launcher.setAttribute('aria-expanded', String(open));
      closePopovers();
      if (open) {
        markNativeChatReady();
        syncChatViewport();
        requestAnimationFrame(() =>
          (state.sessionToken ? textarea : firstName.field).focus({ preventScroll: true })
        );
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

    function setTextSizeLevel(level) {
      const normalized = Math.max(0, Math.min(TEXT_SIZE_ADJUSTMENTS.length - 1, Number(level) || 0));
      state.textSizeLevel = normalized;
      root.dataset.textSize = String(normalized);
      root.style.setProperty('--hn-ai-font-adjust', TEXT_SIZE_ADJUSTMENTS[normalized]);
      decreaseFont.disabled = normalized === 0;
      increaseFont.disabled = normalized === TEXT_SIZE_ADJUSTMENTS.length - 1;
      try {
        localStorage.setItem(TEXT_SIZE_KEY, String(normalized));
      } catch {
        // The selected size remains active for the current page.
      }
    }

    function scrollToLatest() {
      requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
      });
    }

    function transcriptPayload(sessionId, transcriptMessages, revision) {
      return {
        action: 'transcript',
        sessionId,
        sessionToken: state.sessionToken,
        revision,
        locale,
        pagePath: location.pathname,
        messages: transcriptMessages,
      };
    }

    async function syncTranscript(payload, { keepalive = true, retries = 2 } = {}) {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const response = await fetch(UPLOAD_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive,
          });
          if (response.ok) return true;
          if (response.status < 500 && response.status !== 429) return false;
        } catch {
          /* retry transient network failures below */
        }
        if (attempt < retries) await new Promise(resolve => setTimeout(resolve, 500 * 3 ** attempt));
      }
      return false;
    }

    function queueTranscriptSync(sessionId, transcriptMessages, revision) {
      if (!state.sessionToken) return;
      const payload = transcriptPayload(sessionId, transcriptMessages, revision);
      state.transcriptSyncPromise = state.transcriptSyncPromise
        .catch(() => {})
        .then(async () => {
          if (!(await syncTranscript(payload))) console.error('[ai-chat] transcript sync failed');
        })
        .catch(() => {});
    }

    function scheduleTranscriptSync() {
      if (!state.sessionToken) return;
      window.clearTimeout(state.transcriptTimer);
      state.transcriptTimer = window.setTimeout(() => {
        queueTranscriptSync(state.sessionId, state.messages.slice(), state.transcriptRevision);
      }, 750);
    }

    function addMessage(role, content, { handoff = false, persist = true, media = null, attachment = null } = {}) {
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
      const safeMedia = normalizeGif(media);
      const safeAttachment =
        attachment && typeof attachment === 'object'
          ? {
              name: String(attachment.name || content || '').slice(0, 180),
              size: Number.isSafeInteger(Number(attachment.size)) ? Number(attachment.size) : 0,
              mimeType: String(attachment.mimeType || 'application/octet-stream').slice(0, 120),
              kind: attachment.kind === 'voice' ? 'voice' : 'file',
              delivered: attachment.delivered === true,
            }
          : null;
      if (safeAttachment?.name) {
        bubble.classList.add('hn-ai-bubble-attachment');
        const attachmentIcon = icon(safeAttachment.kind === 'voice' ? 'voice' : 'attach');
        attachmentIcon.classList.add('hn-ai-message-attachment-icon');
        const details = document.createElement('span');
        details.className = 'hn-ai-message-attachment-details';
        const name = document.createElement('strong');
        name.textContent = safeAttachment.name;
        const meta = document.createElement('span');
        meta.textContent = `${safeAttachment.size ? formatBytes(safeAttachment.size, locale) : safeAttachment.mimeType} · ${
          safeAttachment.delivered ? copy.uploadComplete : copy.uploadStored
        }`;
        details.append(name, meta);
        bubble.append(attachmentIcon, details);
      } else if (safeMedia) {
        const image = document.createElement('img');
        image.className = 'hn-ai-message-gif';
        image.src = safeMedia.url;
        image.alt = safeMedia.title;
        image.loading = 'lazy';
        image.decoding = 'async';
        bubble.appendChild(image);
        const caption = document.createElement('span');
        caption.className = 'hn-ai-message-gif-caption';
        caption.textContent = safeMedia.title;
        bubble.appendChild(caption);
      } else {
        appendSafeAnswer(bubble, content);
      }
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
        state.messages.push({
          role,
          content,
          ...(safeMedia ? { media: safeMedia } : {}),
          ...(safeAttachment?.name ? { attachment: safeAttachment } : {}),
        });
        state.messages = state.messages.slice(-MAX_STORED_MESSAGES);
        writeStoredMessages(locale, state.messages);
        state.transcriptRevision += 1;
        writeTranscriptRevision(locale, state.sessionId, state.transcriptRevision);
        scheduleTranscriptSync();
      }
      scrollToLatest();
    }

    for (const item of state.messages) {
      addMessage(item.role, item.content, { persist: false, media: item.media, attachment: item.attachment });
    }
    if (state.messages.length) queueTranscriptSync(state.sessionId, state.messages.slice(), state.transcriptRevision);
    window.addEventListener('pagehide', () => {
      window.clearTimeout(state.transcriptTimer);
      if (!state.messages.length) return;
      void syncTranscript(transcriptPayload(state.sessionId, state.messages.slice(), state.transcriptRevision), {
        keepalive: true,
        retries: 0,
      });
    });

    function setBusy(busy, showTyping = true) {
      state.busy = busy;
      textarea.disabled = busy;
      send.disabled = busy;
      typing.hidden = !busy || !showTyping;
      if (busy) scrollToLatest();
    }

    function markNativeChatReady() {
      const host = document.querySelector('sp-live-chat');
      if (!host) return false;
      host.setAttribute('data-hundesalon-ai-ready', 'true');
      host.style.setProperty('display', 'none', 'important');
      host.style.setProperty('pointer-events', 'none', 'important');
      return Boolean(host.shadowRoot);
    }

    async function openHumanChat() {
      if (!state.sessionToken) {
        updateConversationMode('human', { announce: false });
        requireRegistration();
        return;
      }
      if (state.modeChangePending) return;
      const previousMode = state.mode;
      const requestedMode = previousMode === 'human' ? 'ai' : 'human';
      state.modeChangePending = true;
      state.modeRevision += 1;
      support.disabled = true;
      updateConversationMode(requestedMode, { announce: false });
      closePopovers();
      try {
        const response = await fetch(SESSION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set-mode',
            mode: requestedMode,
            sessionId: state.sessionId,
            sessionToken: state.sessionToken,
          }),
        });
        if (response.status === 401) {
          requireRegistration();
          return;
        }
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.success || result?.mode !== requestedMode) {
          throw new Error('CHAT_MODE_UPDATE_FAILED');
        }
        updateConversationMode(requestedMode);
      } catch {
        updateConversationMode(previousMode, { announce: false });
        setStatus(copy.unavailable);
      } finally {
        state.modeChangePending = false;
        support.disabled = false;
        textarea.focus({ preventScroll: true });
      }
    }

    function autoGrow() {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }

    function retryAfterMilliseconds(response) {
      const value = response.headers.get('Retry-After');
      const seconds = Number.parseInt(value || '', 10);
      if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 60) * 1000;
      if (value) {
        const retryAt = Date.parse(value);
        if (Number.isFinite(retryAt)) return Math.min(Math.max(retryAt - Date.now(), 1000), 60_000);
      }
      return 10_000;
    }

    async function submitMessage() {
      if (state.busy) return;
      if (!state.sessionToken) {
        requireRegistration();
        return;
      }
      const content = textarea.value.trim();
      if (!content) {
        setStatus(copy.empty);
        return;
      }
      if (content.length > MAX_MESSAGE_LENGTH) {
        setStatus(copy.tooLong);
        return;
      }

      const history = state.messages.slice(-8).map(({ role, content }) => ({ role, content }));
      const clientMessageId = window.crypto.randomUUID();
      textarea.value = '';
      autoGrow();
      addMessage('user', content);
      const humanMode = state.mode === 'human';
      setBusy(true, !humanMode);
      setStatus('');

      try {
        const request = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            locale,
            message: content,
            history,
            pagePath: location.pathname,
            sessionId: state.sessionId,
            sessionToken: state.sessionToken,
            clientMessageId,
            mode: state.mode,
          }),
        };
        let response = await fetch('/api/ai-chat', request);
        if (response.status === 429) {
          const waitMilliseconds = retryAfterMilliseconds(response);
          setStatus(copy.rateLimitedRetry(Math.ceil(waitMilliseconds / 1000)), 0);
          await new Promise(resolve => setTimeout(resolve, waitMilliseconds));
          setStatus('');
          response = await fetch('/api/ai-chat', request);
        }
        if (response.status === 429) {
          addMessage('assistant', copy.rateLimited, { handoff: true });
          return;
        }
        if (response.status === 401) {
          requireRegistration();
          return;
        }
        if (!response.ok) throw new Error('AI_CHAT_REQUEST_FAILED');
        const result = await response.json();
        const personalMode = humanMode || result?.mode === 'human';
        if (personalMode && state.mode !== 'human') updateConversationMode('human', { announce: false });
        if (personalMode && result?.waitingForStaff === true) {
          setStatus(copy.personalSupportSent);
          void pollStaffReplies();
        } else {
          const answer =
            typeof result?.answer === 'string' && result.answer.trim() ? result.answer.trim() : copy.unavailable;
          addMessage('assistant', answer, { handoff: Boolean(result?.handoff || result?.available === false) });
        }
      } catch {
        if (humanMode) setStatus(copy.unavailable);
        else addMessage('assistant', copy.unavailable, { handoff: true });
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

    async function clearChat() {
      // eslint-disable-next-line no-alert
      if (!window.confirm(copy.clearChatConfirm)) return;
      window.clearTimeout(state.transcriptTimer);
      if (state.messages.length) {
        queueTranscriptSync(state.sessionId, state.messages.slice(), state.transcriptRevision);
      }
      try {
        const response = await fetch(SESSION_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'renew',
            sessionId: state.sessionId,
            sessionToken: state.sessionToken,
            pagePath: location.pathname,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.success) throw new Error('SESSION_RENEW_FAILED');
        applyRegisteredIdentity(result);
      } catch {
        requireRegistration();
      }
      state.transcriptRevision = 0;
      state.messages = [];
      updateConversationMode('ai', { announce: false });
      writeStoredMessages(locale, []);
      messages.querySelectorAll('.hn-ai-message').forEach(node => node.remove());
      closePopovers();
      textarea.focus();
    }

    setTextSizeLevel(state.textSizeLevel);
    launcher.addEventListener('click', () => setOpen(root.dataset.open !== 'true'));
    registrationForm.addEventListener('submit', event => {
      event.preventDefault();
      void registerCustomer();
    });
    minimize.addEventListener('click', () => setOpen(false));
    decreaseFont.addEventListener('click', () => setTextSizeLevel(state.textSizeLevel - 1));
    increaseFont.addEventListener('click', () => setTextSizeLevel(state.textSizeLevel + 1));
    closeMenu.addEventListener('click', () => setOpen(false));
    menuToggle.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closePopovers();
      setMenuOpen(willOpen, { focus: willOpen });
    });
    expand.addEventListener('click', () => setExpanded(!state.expanded));
    download.addEventListener('click', downloadTranscript);
    reset.addEventListener('click', () => void clearChat());
    support.addEventListener('click', () => void openHumanChat());
    attach.addEventListener('click', () => {
      if (!state.sessionToken) requireRegistration();
      else fileInput.click();
    });
    fileInput.addEventListener('change', () => {
      const [file] = fileInput.files || [];
      if (file) void sendFile(file, 'file');
    });
    transferCancel.addEventListener('click', cancelUpload);
    voice.addEventListener('click', () => void startVoiceRecording());
    recorderStop.addEventListener('click', () => stopVoiceRecording(false));
    recorderCancel.addEventListener('click', () => stopVoiceRecording(true));
    recorderSend.addEventListener('click', () => {
      const file = state.recordedFile;
      if (!file) return;
      resetRecorderPanel();
      void sendFile(file, 'voice');
    });
    emojiToggle.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = emojiPicker.hidden;
      closePopovers();
      emojiPicker.hidden = !willOpen;
      emojiToggle.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        void ensureEmojiPicker();
        requestAnimationFrame(() => emojiSearch.focus({ preventScroll: true }));
      }
    });
    emojiSearch.addEventListener('input', () => {
      const query = emojiSearch.value.trim().toLocaleLowerCase();
      if (!query) {
        selectEmojiGroup(state.activeEmojiGroup);
        return;
      }
      const matches = (state.emojiGroups || [])
        .flatMap(group => group.emoji)
        .filter(item => item.name.toLocaleLowerCase().includes(query) || item.value === query)
        .slice(0, 500);
      renderEmoji(matches);
    });
    gifToggle.addEventListener('click', event => {
      event.stopPropagation();
      const willOpen = gifPicker.hidden;
      closePopovers();
      gifPicker.hidden = !willOpen;
      gifToggle.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) {
        void loadGifs(gifSearch.value.trim());
        requestAnimationFrame(() => gifSearch.focus({ preventScroll: true }));
      }
    });
    gifSearch.addEventListener('input', () => {
      clearTimeout(state.gifSearchTimer);
      state.gifSearchTimer = setTimeout(() => void loadGifs(gifSearch.value.trim()), 350);
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
      if (!event.target.closest('.hn-ai-menu, .hn-ai-header-actions, .hn-ai-emoji-picker, .hn-ai-gif-picker, .hn-ai-tools')) {
        closePopovers();
      }
    });
    const visualViewport = window.visualViewport;
    window.addEventListener('resize', syncChatViewport, { passive: true });
    visualViewport?.addEventListener('resize', syncChatViewport, { passive: true });
    visualViewport?.addEventListener('scroll', syncChatViewport, { passive: true });
    root.addEventListener('focusin', syncChatViewport);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || root.dataset.open !== 'true') return;
      if (!menu.hidden || !emojiPicker.hidden || !gifPicker.hidden) {
        const restoreMenuFocus = !menu.hidden;
        closePopovers();
        if (restoreMenuFocus) menuToggle.focus({ preventScroll: true });
        return;
      }
      if (state.expanded) {
        setExpanded(false);
        return;
      }
      setOpen(false);
      launcher.focus();
    });
    window.addEventListener('pagehide', () => {
      window.cancelAnimationFrame(state.viewportFrame);
      window.removeEventListener('resize', syncChatViewport);
      visualViewport?.removeEventListener('resize', syncChatViewport);
      visualViewport?.removeEventListener('scroll', syncChatViewport);
      cancelUpload();
      stopVoiceRecording(true);
      resetRecorderPanel();
      clearTimeout(state.gifSearchTimer);
      state.gifRequest?.abort();
    });

    const replyPollTimer = window.setInterval(() => void pollStaffReplies(), 5000);
    if (state.sessionToken) void pollStaffReplies();
    window.addEventListener('pagehide', () => window.clearInterval(replyPollTimer), { once: true });

    launcher.setAttribute('aria-expanded', 'false');
    syncChatViewport();
    updateConversationMode(state.mode, { announce: false });
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
