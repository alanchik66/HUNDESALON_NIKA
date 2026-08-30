(function () {
  'use strict';

  const LIVE_CHAT_ID = '6a89e797b7f95e2b6c0cf199';
  const POPUP_WIDGET_ID = '49f098e8-81bf-4efa-9842-8f2012257c7b';
  const PUBLIC_HOST_RE = /(^|\.)hundesalon-nika\.com$/i;
  const PUBLIC_PREVIEW_RE = /(^|\.)pages\.dev$/i;
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
  const LIVE_CHAT_THEME_STYLE_ID = 'hundesalon-live-chat-theme';
  const LIVE_CHAT_CONFIG_STYLE = Object.freeze({
    primaryColor: '#034c35',
    colorScheme: 'dark',
  });
  const LIVE_CHAT_BRAND_LOGO_URL = '/assets/images/brand/logo.png';
  const LIVE_CHAT_ROOT_OBSERVER_KEY = '__hundesalonLiveChatObserver';
  const LIVE_CHAT_DOCUMENT_EVENTS_KEY = '__hundesalonLiveChatDocumentEvents';
  const LIVE_CHAT_BRAND_NAME = 'HUNDESALON_NIKA';
  const LIVE_CHAT_EMOJIS = Object.freeze([
    '\uD83D\uDE0A',
    '\uD83D\uDC36',
    '\uD83D\uDC31',
    '\u2764\uFE0F',
    '\uD83D\uDC4D',
    '\uD83D\uDE0D',
    '\uD83C\uDF89',
    '\u2728',
    '\uD83D\uDC3E',
    '\uD83D\uDE4F',
    '\uD83D\uDE0C',
    '\uD83D\uDE04',
  ]);
  const LIVE_CHAT_ICON_PATHS = Object.freeze({
    menu: 'M12 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2m0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
    minimize: 'M5 12h14',
    expand: 'M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5',
    download: 'M12 3v12m0 0 5-5m-5 5-5-5M5 21h14',
    newConversation: 'M12 5v14M5 12h14',
    emoji: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 10h.01M15 10h.01M8.5 14a4.5 4.5 0 0 0 7 0',
    voice: 'M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0m6 6v3m-4 0h8',
  });
  const LIVE_CHAT_COPY = Object.freeze({
    de: Object.freeze({
      quickActions: 'Schnellaktionen',
      minimize: 'Chat minimieren',
      expand: 'Ansicht vergr\u00f6\u00dfern',
      collapse: 'Normale Ansicht',
      download: 'Chatverlauf herunterladen',
      newConversation: 'Neues Gespr\u00e4ch',
      newConversationConfirm:
        'Ein neues Gespr\u00e4ch trennt diesen Browser vom bisherigen Verlauf. Der alte Verlauf bleibt bei HUNDESALON_NIKA gespeichert. Fortfahren?',
      salon: 'HUNDESALON_NIKA',
      visitor: 'Kunde',
      noMessages: 'Noch keine Nachrichten zum Herunterladen.',
      transcriptReady: 'Der Chatverlauf wurde heruntergeladen.',
      emoji: 'Emoji einf\u00fcgen',
      voice: 'Spracheingabe',
      voiceUnsupported: 'Die Spracheingabe wird von diesem Browser nicht unterst\u00fctzt.',
      listening: 'Ich h\u00f6re zu ...',
      voiceError: 'Die Spracheingabe konnte nicht gestartet werden.',
      attach: 'Datei anh\u00e4ngen',
    }),
    en: Object.freeze({
      quickActions: 'Quick actions',
      minimize: 'Minimize chat',
      expand: 'Expand view',
      collapse: 'Normal view',
      download: 'Download transcript',
      newConversation: 'New conversation',
      newConversationConfirm:
        'A new conversation disconnects this browser from the current history. The previous history remains stored by HUNDESALON_NIKA. Continue?',
      salon: 'HUNDESALON_NIKA',
      visitor: 'Customer',
      noMessages: 'There are no messages to download yet.',
      transcriptReady: 'The transcript has been downloaded.',
      emoji: 'Insert emoji',
      voice: 'Voice input',
      voiceUnsupported: 'Voice input is not supported by this browser.',
      listening: 'Listening ...',
      voiceError: 'Voice input could not be started.',
      attach: 'Attach a file',
    }),
    ru: Object.freeze({
      quickActions: '\u0411\u044b\u0441\u0442\u0440\u044b\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f',
      minimize: '\u041c\u0438\u043d\u0438\u043c\u0438\u0437\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0447\u0430\u0442',
      expand: '\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440',
      collapse: '\u041e\u0431\u044b\u0447\u043d\u044b\u0439 \u0432\u0438\u0434',
      download: '\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u0442\u0440\u0430\u043d\u0441\u043a\u0440\u0438\u043f\u0442',
      newConversation: '\u041d\u043e\u0432\u044b\u0439 \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440',
      newConversationConfirm:
        '\u041d\u043e\u0432\u044b\u0439 \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440 \u043e\u0442\u043a\u043b\u044e\u0447\u0438\u0442 \u044d\u0442\u043e\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u043e\u0442 \u0442\u0435\u043a\u0443\u0449\u0435\u0439 \u0438\u0441\u0442\u043e\u0440\u0438\u0438. \u041f\u0440\u0435\u0436\u043d\u044f\u044f \u0438\u0441\u0442\u043e\u0440\u0438\u044f \u043e\u0441\u0442\u0430\u043d\u0435\u0442\u0441\u044f \u0432 HUNDESALON_NIKA. \u041f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c?',
      salon: 'HUNDESALON_NIKA',
      visitor: '\u041a\u043b\u0438\u0435\u043d\u0442',
      noMessages: '\u0412 \u0447\u0430\u0442\u0435 \u0435\u0449\u0451 \u043d\u0435\u0442 \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0434\u043b\u044f \u0441\u043a\u0430\u0447\u0438\u0432\u0430\u043d\u0438\u044f.',
      transcriptReady: '\u0422\u0440\u0430\u043d\u0441\u043a\u0440\u0438\u043f\u0442 \u0441\u043a\u0430\u0447\u0430\u043d.',
      emoji: '\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u044c emoji',
      voice: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0432\u0432\u043e\u0434',
      voiceUnsupported: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0432\u0432\u043e\u0434 \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u044d\u0442\u0438\u043c \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043e\u043c.',
      listening: '\u0421\u043b\u0443\u0448\u0430\u044e ...',
      voiceError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u043e\u0439 \u0432\u0432\u043e\u0434.',
      attach: '\u041f\u0440\u0438\u043a\u0440\u0435\u043f\u0438\u0442\u044c \u0444\u0430\u0439\u043b',
    }),
    uk: Object.freeze({
      quickActions: '\u0428\u0432\u0438\u0434\u043a\u0456 \u0434\u0456\u0457',
      minimize: '\u0417\u0433\u043e\u0440\u043d\u0443\u0442\u0438 \u0447\u0430\u0442',
      expand: '\u0420\u043e\u0437\u0433\u043e\u0440\u043d\u0443\u0442\u0438 \u043f\u0435\u0440\u0435\u0433\u043b\u044f\u0434',
      collapse: '\u0417\u0432\u0438\u0447\u0430\u0439\u043d\u0438\u0439 \u0432\u0438\u0433\u043b\u044f\u0434',
      download: '\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0438\u0442\u0438 \u0442\u0440\u0430\u043d\u0441\u043a\u0440\u0438\u043f\u0442',
      newConversation: '\u041d\u043e\u0432\u0430 \u0440\u043e\u0437\u043c\u043e\u0432\u0430',
      newConversationConfirm:
        '\u041d\u043e\u0432\u0430 \u0440\u043e\u0437\u043c\u043e\u0432\u0430 \u0432\u0456\u0434\u2019\u0454\u0434\u043d\u0430\u0454 \u0446\u0435\u0439 \u0431\u0440\u0430\u0443\u0437\u0435\u0440 \u0432\u0456\u0434 \u043f\u043e\u0442\u043e\u0447\u043d\u043e\u0457 \u0456\u0441\u0442\u043e\u0440\u0456\u0457. \u041f\u043e\u043f\u0435\u0440\u0435\u0434\u043d\u044f \u0456\u0441\u0442\u043e\u0440\u0456\u044f \u0437\u0430\u043b\u0438\u0448\u0438\u0442\u044c\u0441\u044f \u0432 HUNDESALON_NIKA. \u041f\u0440\u043e\u0434\u043e\u0432\u0436\u0438\u0442\u0438?',
      salon: 'HUNDESALON_NIKA',
      visitor: '\u041a\u043b\u0456\u0454\u043d\u0442',
      noMessages: '\u0423 \u0447\u0430\u0442\u0456 \u0449\u0435 \u043d\u0435\u043c\u0430\u0454 \u043f\u043e\u0432\u0456\u0434\u043e\u043c\u043b\u0435\u043d\u044c \u0434\u043b\u044f \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f.',
      transcriptReady: '\u0422\u0440\u0430\u043d\u0441\u043a\u0440\u0438\u043f\u0442 \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043e.',
      emoji: '\u0412\u0441\u0442\u0430\u0432\u0438\u0442\u0438 emoji',
      voice: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u0435 \u0432\u0432\u0435\u0434\u0435\u043d\u043d\u044f',
      voiceUnsupported: '\u0413\u043e\u043b\u043e\u0441\u043e\u0432\u0435 \u0432\u0432\u0435\u0434\u0435\u043d\u043d\u044f \u043d\u0435 \u043f\u0456\u0434\u0442\u0440\u0438\u043c\u0443\u0454\u0442\u044c\u0441\u044f \u0446\u0438\u043c \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u043e\u043c.',
      listening: '\u0421\u043b\u0443\u0445\u0430\u044e ...',
      voiceError: '\u041d\u0435 \u0432\u0434\u0430\u043b\u043e\u0441\u044f \u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0438 \u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0435 \u0432\u0432\u0435\u0434\u0435\u043d\u043d\u044f.',
      attach: '\u041f\u0440\u0438\u043a\u0440\u0456\u043f\u0438\u0442\u0438 \u0444\u0430\u0439\u043b',
    }),
  });
  const LIVE_CHAT_SUPPORTED_LANGUAGES = new Set(['en', 'ru', 'uk']);
  const LIVE_CHAT_THEME_CSS = `
    :host {
      --hundesalon-chat-emerald: 3, 76, 53;
      --hundesalon-chat-emerald-deep: 1, 24, 17;
      --hundesalon-chat-gold: 226, 186, 94;
    }

    :host([data-hundesalon-ai-ready='true']) .widget-fab {
      display: none !important;
    }

    .widget-wrapper .widget {
      overflow: hidden !important;
      border: 1px solid rgba(var(--hundesalon-chat-gold), 0.38) !important;
      border-radius: 1.5rem !important;
      background:
        radial-gradient(circle at 18% 0%, rgba(13, 128, 88, 0.34), transparent 42%),
        linear-gradient(155deg, rgba(var(--hundesalon-chat-emerald), 0.88), rgba(var(--hundesalon-chat-emerald-deep), 0.84)) !important;
      box-shadow:
        0 26px 64px rgba(0, 0, 0, 0.52),
        0 0 34px rgba(13, 128, 88, 0.28),
        inset 0 1px 0 rgba(255, 244, 210, 0.12) !important;
      backdrop-filter: blur(18px) saturate(1.18) !important;
    }

    .widget-wrapper .widget-header {
      position: relative !important;
      z-index: 20 !important;
      min-height: 3.6rem !important;
      border-bottom: 1px solid rgba(var(--hundesalon-chat-gold), 0.3) !important;
      background:
        linear-gradient(110deg, rgba(2, 65, 45, 0.96), rgba(7, 111, 77, 0.9)),
        rgba(var(--hundesalon-chat-emerald-deep), 0.92) !important;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24) !important;
      color: rgb(255, 239, 196) !important;
    }

    .widget-wrapper .widget-header-content-body {
      position: relative !important;
      display: flex !important;
      width: 100% !important;
      min-height: 3.6rem !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 0 3rem !important;
      box-sizing: border-box !important;
    }

    .widget-wrapper .widget-header h5 {
      width: 100% !important;
      margin: 0 !important;
      overflow: hidden !important;
      color: rgb(255, 239, 196) !important;
      font-family: 'Cinzel', 'Forum', 'Cormorant Garamond', Georgia, serif !important;
      max-width: 100% !important;
      font-size: 0.7rem !important;
      font-weight: 600 !important;
      letter-spacing: 0.03em !important;
      line-height: 1.25 !important;
      text-align: center !important;
      text-shadow: 0 2px 14px rgba(var(--hundesalon-chat-gold), 0.34) !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    .widget-wrapper .button-close-widget {
      display: none !important;
    }

    .hundesalon-chat-brand-logo {
      position: absolute !important;
      left: 0.7rem !important;
      width: 2.35rem !important;
      height: 2.35rem !important;
      padding: 0.12rem !important;
      border: 1px solid rgba(var(--hundesalon-chat-gold), 0.5) !important;
      border-radius: 50% !important;
      background: rgba(0, 20, 14, 0.72) !important;
      box-shadow: 0 0 18px rgba(var(--hundesalon-chat-gold), 0.22) !important;
      box-sizing: border-box !important;
      object-fit: contain !important;
    }

    .hundesalon-chat-actions {
      position: absolute !important;
      right: 0.65rem !important;
      display: flex !important;
      align-items: center !important;
    }

    .hundesalon-chat-icon-button {
      display: inline-flex !important;
      width: 2.25rem !important;
      height: 2.25rem !important;
      align-items: center !important;
      justify-content: center !important;
      border: 1px solid rgba(255, 239, 196, 0.3) !important;
      border-radius: 0.72rem !important;
      background: rgba(255, 255, 255, 0.08) !important;
      color: rgb(255, 239, 196) !important;
      box-shadow: inset 0 0 14px rgba(255, 255, 255, 0.05) !important;
      cursor: pointer !important;
      transition: border-color 160ms ease, background-color 160ms ease, transform 160ms ease !important;
    }

    .hundesalon-chat-icon-button:hover,
    .hundesalon-chat-icon-button:focus-visible,
    .hundesalon-chat-icon-button[aria-expanded='true'] {
      border-color: rgba(var(--hundesalon-chat-gold), 0.72) !important;
      background: rgba(var(--hundesalon-chat-gold), 0.14) !important;
      outline: none !important;
      transform: translateY(-1px) !important;
    }

    .hundesalon-chat-icon-button:disabled {
      opacity: 0.42 !important;
      cursor: not-allowed !important;
      transform: none !important;
    }

    .hundesalon-chat-icon {
      width: 1.15rem !important;
      height: 1.15rem !important;
      fill: none !important;
      stroke: currentColor !important;
      stroke-linecap: round !important;
      stroke-linejoin: round !important;
      stroke-width: 1.7 !important;
    }

    .hundesalon-chat-actions-menu {
      position: absolute !important;
      top: calc(100% + 0.5rem) !important;
      right: 0 !important;
      display: grid !important;
      width: min(17.5rem, calc(100vw - 2.5rem)) !important;
      padding: 0.55rem !important;
      border: 1px solid rgba(var(--hundesalon-chat-gold), 0.34) !important;
      border-radius: 1rem !important;
      background: rgba(2, 31, 22, 0.97) !important;
      box-shadow: 0 18px 45px rgba(0, 0, 0, 0.48) !important;
      box-sizing: border-box !important;
      color: rgb(255, 247, 224) !important;
      gap: 0.12rem !important;
      backdrop-filter: blur(18px) !important;
    }

    .hundesalon-chat-actions-menu[hidden] {
      display: none !important;
    }

    .hundesalon-chat-actions-title {
      margin: 0 !important;
      padding: 0.45rem 0.55rem 0.5rem !important;
      color: rgba(255, 239, 196, 0.72) !important;
      font-family: 'Cinzel', Georgia, serif !important;
      font-size: 0.72rem !important;
      font-weight: 600 !important;
      letter-spacing: 0.055em !important;
      text-transform: uppercase !important;
    }

    .hundesalon-chat-action {
      display: grid !important;
      grid-template-columns: 1.4rem 1fr !important;
      min-height: 2.45rem !important;
      align-items: center !important;
      padding: 0.42rem 0.55rem !important;
      border: 0 !important;
      border-radius: 0.7rem !important;
      background: transparent !important;
      color: rgba(255, 247, 224, 0.92) !important;
      cursor: pointer !important;
      font: 500 0.87rem/1.25 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      gap: 0.5rem !important;
      text-align: left !important;
    }

    .hundesalon-chat-action:hover,
    .hundesalon-chat-action:focus-visible {
      background: rgba(var(--hundesalon-chat-gold), 0.12) !important;
      color: rgb(255, 239, 196) !important;
      outline: none !important;
    }

    .hundesalon-chat-action .hundesalon-chat-icon {
      width: 1rem !important;
      height: 1rem !important;
    }

    .hundesalon-chat-action-status {
      min-height: 1rem !important;
      margin: 0 !important;
      padding: 0.35rem 0.55rem 0.2rem !important;
      color: rgba(255, 239, 196, 0.7) !important;
      font-size: 0.75rem !important;
      line-height: 1.3 !important;
    }

    .widget-wrapper .widget-body,
    .widget-wrapper .widget-body-content {
      background: transparent !important;
      color: rgba(255, 247, 224, 0.9) !important;
    }

    .widget-wrapper .widget-greeting {
      color: rgba(255, 247, 224, 0.86) !important;
      font-size: 0.98rem !important;
      line-height: 1.55 !important;
      text-shadow: 0 1px 12px rgba(0, 0, 0, 0.38) !important;
    }

    .widget-wrapper .widget-chat-message-owner {
      position: relative !important;
      min-height: 2rem !important;
      padding-left: 2.55rem !important;
      box-sizing: border-box !important;
    }

    .widget-wrapper .widget-chat-message-owner::before {
      position: absolute !important;
      bottom: 0.15rem !important;
      left: 0 !important;
      width: 1.9rem !important;
      height: 1.9rem !important;
      border: 1px solid rgba(var(--hundesalon-chat-gold), 0.5) !important;
      border-radius: 50% !important;
      background: rgba(0, 20, 14, 0.88) url('/assets/images/brand/logo.png') center / contain no-repeat !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.32) !important;
      content: '' !important;
    }

    .widget-wrapper .terms-link,
    .widget-wrapper .terms-link a {
      color: rgb(244, 211, 132) !important;
      text-decoration-color: rgba(var(--hundesalon-chat-gold), 0.58) !important;
      text-underline-offset: 0.16em !important;
    }

    .widget-wrapper .widget-footer {
      min-height: 5.3rem !important;
      border-top: 1px solid rgba(var(--hundesalon-chat-gold), 0.24) !important;
      background: rgba(0, 25, 18, 0.7) !important;
      box-shadow: 0 -12px 28px rgba(0, 0, 0, 0.18) !important;
      backdrop-filter: blur(12px) !important;
    }

    .widget-wrapper .widget-footer-container,
    .widget-wrapper .widget-footer-inapp {
      background: transparent !important;
      box-sizing: border-box !important;
    }

    .widget-wrapper .widget-footer-container {
      min-height: 5.25rem !important;
    }

    .widget-wrapper .widget-footer-inapp {
      min-height: 4.65rem !important;
    }

    .widget-wrapper .form-control {
      min-height: 4.65rem !important;
      padding: 0.7rem 3rem 2.25rem 0.8rem !important;
      border: 1px solid transparent !important;
      border-radius: 0.9rem !important;
      background: rgba(255, 255, 255, 0.055) !important;
      color: rgb(255, 247, 224) !important;
      caret-color: rgb(244, 211, 132) !important;
      transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease !important;
    }

    .widget-wrapper .form-control:focus {
      border-color: rgba(var(--hundesalon-chat-gold), 0.5) !important;
      background: rgba(255, 255, 255, 0.085) !important;
      box-shadow: 0 0 0 3px rgba(var(--hundesalon-chat-gold), 0.1) !important;
      outline: none !important;
    }

    .widget-wrapper .form-control::placeholder {
      color: rgba(255, 247, 224, 0.58) !important;
    }

    .widget-wrapper .widget-upload-button {
      right: auto !important;
      top: auto !important;
      bottom: 0.72rem !important;
      left: 2.72rem !important;
      opacity: 0.82 !important;
      filter: sepia(0.35) saturate(0.7) brightness(1.7) !important;
    }

    .widget-wrapper .input-group-btn {
      top: auto !important;
      right: 0.75rem !important;
      bottom: 0.75rem !important;
    }

    .hundesalon-chat-composer-tools {
      position: absolute !important;
      bottom: 0.62rem !important;
      left: 0.6rem !important;
      z-index: 2 !important;
      display: flex !important;
      align-items: center !important;
      gap: 2.35rem !important;
      pointer-events: none !important;
    }

    .hundesalon-chat-composer-tools .hundesalon-chat-icon-button {
      width: 1.8rem !important;
      height: 1.8rem !important;
      border: 0 !important;
      border-radius: 0.55rem !important;
      background: transparent !important;
      box-shadow: none !important;
      color: rgba(255, 239, 196, 0.8) !important;
      pointer-events: auto !important;
    }

    .hundesalon-chat-composer-tools .hundesalon-chat-icon-button:hover,
    .hundesalon-chat-composer-tools .hundesalon-chat-icon-button:focus-visible,
    .hundesalon-chat-composer-tools .hundesalon-chat-icon-button[aria-expanded='true'] {
      background: rgba(var(--hundesalon-chat-gold), 0.14) !important;
      color: rgb(255, 239, 196) !important;
      transform: none !important;
    }

    .hundesalon-chat-composer-tools .hundesalon-chat-icon-button.is-listening {
      color: rgb(255, 215, 128) !important;
      animation: hundesalon-chat-listening 1.15s ease-in-out infinite alternate !important;
    }

    .hundesalon-chat-emoji-picker {
      position: absolute !important;
      right: 0.65rem !important;
      bottom: calc(100% + 0.55rem) !important;
      z-index: 22 !important;
      display: grid !important;
      width: 13.8rem !important;
      padding: 0.6rem !important;
      border: 1px solid rgba(var(--hundesalon-chat-gold), 0.34) !important;
      border-radius: 0.95rem !important;
      background: rgba(2, 31, 22, 0.98) !important;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45) !important;
      box-sizing: border-box !important;
      grid-template-columns: repeat(6, 1fr) !important;
      gap: 0.25rem !important;
    }

    .hundesalon-chat-emoji-picker[hidden] {
      display: none !important;
    }

    .hundesalon-chat-emoji {
      display: inline-flex !important;
      width: 1.85rem !important;
      height: 1.85rem !important;
      align-items: center !important;
      justify-content: center !important;
      border: 0 !important;
      border-radius: 0.48rem !important;
      background: transparent !important;
      cursor: pointer !important;
      font-size: 1.05rem !important;
    }

    .hundesalon-chat-emoji:hover,
    .hundesalon-chat-emoji:focus-visible {
      background: rgba(var(--hundesalon-chat-gold), 0.16) !important;
      outline: none !important;
    }

    .hundesalon-chat-composer-status {
      position: absolute !important;
      right: 3.1rem !important;
      bottom: 0.93rem !important;
      max-width: 10rem !important;
      overflow: hidden !important;
      color: rgba(255, 239, 196, 0.72) !important;
      font-size: 0.7rem !important;
      line-height: 1.1 !important;
      pointer-events: none !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }

    main.root.hundesalon-chat-expanded .widget-wrapper {
      position: fixed !important;
      z-index: 2147483000 !important;
      inset: 0 !important;
      display: flex !important;
      width: 100vw !important;
      height: 100dvh !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(0, 12, 8, 0.78) !important;
      backdrop-filter: blur(10px) !important;
    }

    main.root.hundesalon-chat-expanded .widget-wrapper .widget {
      position: relative !important;
      inset: auto !important;
      width: min(42rem, calc(100vw - 2rem)) !important;
      height: min(45rem, calc(100dvh - 2rem)) !important;
      max-width: none !important;
      max-height: none !important;
    }

    main.root.hundesalon-chat-expanded .widget-wrapper .widget-body {
      flex: 1 1 auto !important;
      height: auto !important;
      min-height: 0 !important;
    }

    @keyframes hundesalon-chat-listening {
      from { opacity: 0.58; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1.08); }
    }

    @media (max-width: 560px) {
      .widget-wrapper .widget {
        border-radius: 1.25rem !important;
        box-shadow:
          0 18px 42px rgba(0, 0, 0, 0.48),
          0 0 24px rgba(13, 128, 88, 0.22) !important;
      }

      .widget-wrapper .widget-header-content-body {
        padding-right: 2.8rem !important;
        padding-left: 2.8rem !important;
      }

      .widget-wrapper .widget-header h5 {
        font-size: 0.72rem !important;
        letter-spacing: 0.035em !important;
      }

      .hundesalon-chat-brand-logo {
        left: 0.55rem !important;
        width: 2.05rem !important;
        height: 2.05rem !important;
      }

      .hundesalon-chat-actions {
        right: 0.5rem !important;
      }

      .hundesalon-chat-actions-menu {
        position: fixed !important;
        top: 4.35rem !important;
        right: 0.75rem !important;
        left: 0.75rem !important;
        width: auto !important;
      }

      main.root.hundesalon-chat-expanded .widget-wrapper .widget {
        width: 100vw !important;
        height: 100dvh !important;
        border-radius: 0 !important;
      }

      .widget-toast {
        pointer-events: none !important;
      }

      .widget-toast .button-close {
        pointer-events: auto !important;
      }
    }
  `;

  const isPublicHost = () => {
    const host = String(window.location.hostname || '')
      .trim()
      .toLowerCase();
    if (!host || LOCAL_HOSTS.has(host)) {
      return false;
    }
    return PUBLIC_HOST_RE.test(host) || PUBLIC_PREVIEW_RE.test(host);
  };

  const loadScript = (src, attributes = {}) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    for (const [name, value] of Object.entries(attributes)) {
      if (value === false || value === null || value === undefined) continue;
      if (value === true) {
        script.setAttribute(name, '');
      } else {
        script.setAttribute(name, String(value));
      }
    }
    document.head.appendChild(script);
  };

  const getPageLanguage = () => {
    const pageLang = String(document.documentElement.lang || '')
      .trim()
      .toLowerCase()
      .slice(0, 2);
    return pageLang || 'en';
  };

  const resolveLiveChatLanguage = pageLang => {
    if (LIVE_CHAT_SUPPORTED_LANGUAGES.has(pageLang)) {
      return pageLang;
    }

    return 'en';
  };

  const setLiveChatAudienceContext = () => {
    const pageLang = getPageLanguage();
    const currentVariables = window.oSpP && typeof window.oSpP === 'object' ? window.oSpP : {};

    window.oSpP = {
      ...currentVariables,
      language: pageLang,
      page_path: window.location.pathname,
      site_origin: window.location.origin,
      source_url: window.location.href,
    };
  };

  const configureLiveChat = () => {
    const liveChat = window.sp?.liveChat;
    if (!liveChat || typeof liveChat.config !== 'function') {
      return false;
    }

    setLiveChatAudienceContext();

    liveChat.config({
      ...LIVE_CHAT_CONFIG_STYLE,
      language: resolveLiveChatLanguage(getPageLanguage()),
    });

    return true;
  };

  const getLiveChatCopy = () => LIVE_CHAT_COPY[getPageLanguage()] || LIVE_CHAT_COPY.en;

  const createLiveChatIcon = name => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.classList.add('hundesalon-chat-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    path.setAttribute('d', LIVE_CHAT_ICON_PATHS[name]);
    svg.appendChild(path);
    return svg;
  };

  const createLiveChatIconButton = ({ className = '', icon, label }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hundesalon-chat-icon-button ${className}`.trim();
    button.setAttribute('aria-label', label);
    button.title = label;
    button.appendChild(createLiveChatIcon(icon));
    return button;
  };

  const createLiveChatMenuAction = ({ action, icon, label }) => {
    const button = document.createElement('button');
    const text = document.createElement('span');
    button.type = 'button';
    button.className = 'hundesalon-chat-action';
    button.dataset.action = action;
    button.setAttribute('role', 'menuitem');
    text.className = 'hundesalon-chat-action-label';
    text.textContent = label;
    button.append(createLiveChatIcon(icon), text);
    return button;
  };

  const setLiveChatStatus = (node, message, timeout = 3800) => {
    if (!node) return;
    window.clearTimeout(node.__hundesalonStatusTimer);
    node.textContent = message;
    if (!message || timeout <= 0) return;
    node.__hundesalonStatusTimer = window.setTimeout(() => {
      node.textContent = '';
    }, timeout);
  };

  const closeLiveChatPopovers = root => {
    const actionsMenu = root.querySelector('.hundesalon-chat-actions-menu');
    const actionsToggle = root.querySelector('.hundesalon-chat-actions-toggle');
    const emojiPicker = root.querySelector('.hundesalon-chat-emoji-picker');
    const emojiToggle = root.querySelector('.hundesalon-chat-emoji-toggle');
    if (actionsMenu) actionsMenu.hidden = true;
    if (actionsToggle) actionsToggle.setAttribute('aria-expanded', 'false');
    if (emojiPicker) emojiPicker.hidden = true;
    if (emojiToggle) emojiToggle.setAttribute('aria-expanded', 'false');
  };

  const toggleLiveChatPopover = (popover, toggle) => {
    const willOpen = popover.hidden;
    closeLiveChatPopovers(popover.getRootNode());
    popover.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      popover.querySelector('button')?.focus({ preventScroll: true });
    }
  };

  const insertLiveChatText = (textarea, text) => {
    const start = Number.isInteger(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
    const end = Number.isInteger(textarea.selectionEnd) ? textarea.selectionEnd : start;
    textarea.setRangeText(text, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    textarea.focus({ preventScroll: true });
  };

  const buildLiveChatTranscript = (root, copy) => {
    const messages = [...root.querySelectorAll('.widget-chat-message')];
    const rows = messages.flatMap(message => {
      const content = [...message.querySelectorAll('.widget-content-message')]
        .map(node => String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' ');
      if (!content) return [];
      const author = message.classList.contains('widget-chat-message-owner') ? copy.salon : copy.visitor;
      const time = String(message.querySelector('.widget-message-time')?.textContent || '').trim();
      return [`${time ? `[${time}] ` : ''}${author}: ${content}`];
    });
    if (!rows.length) return '';
    return [
      LIVE_CHAT_BRAND_NAME,
      window.location.href,
      new Date().toLocaleString(),
      '',
      ...rows,
      '',
    ].join('\n');
  };

  const downloadLiveChatTranscript = (root, copy, statusNode) => {
    const transcript = buildLiveChatTranscript(root, copy);
    if (!transcript) {
      setLiveChatStatus(statusNode, copy.noMessages);
      return;
    }

    const blob = new window.Blob([`\uFEFF${transcript}`], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `${LIVE_CHAT_BRAND_NAME}-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    setLiveChatStatus(statusNode, copy.transcriptReady);
  };

  const resetLiveChatConversation = copy => {
    // The visitor must explicitly confirm before the local conversation identifier is replaced.
    // eslint-disable-next-line no-alert
    if (!window.confirm(copy.newConversationConfirm)) return;
    try {
      window.localStorage.removeItem('spSubscriberId');
      window.localStorage.removeItem('spLiveChatOpened');
    } catch {
      // Storage can be unavailable in hardened browser modes; reload still leaves the current conversation intact.
    }
    window.location.reload();
  };

  const setLiveChatExpanded = (root, action, copy) => {
    const main = root.querySelector('main.root');
    if (!main) return;
    const expanded = main.classList.toggle('hundesalon-chat-expanded');
    const label = expanded ? copy.collapse : copy.expand;
    action.querySelector('.hundesalon-chat-action-label').textContent = label;
    action.setAttribute('aria-label', label);
  };

  const enhanceLiveChatHeader = root => {
    const header = root.querySelector('.widget-header-content-body');
    const heading = header?.querySelector('h5');
    if (!header || !heading) return;

    const copy = getLiveChatCopy();
    heading.textContent = LIVE_CHAT_BRAND_NAME;

    if (!header.querySelector('.hundesalon-chat-brand-logo')) {
      const logo = document.createElement('img');
      logo.className = 'hundesalon-chat-brand-logo';
      logo.src = LIVE_CHAT_BRAND_LOGO_URL;
      logo.alt = '';
      logo.width = 38;
      logo.height = 38;
      logo.decoding = 'async';
      header.insertBefore(logo, heading);
    }

    if (header.querySelector('.hundesalon-chat-actions')) return;

    const actions = document.createElement('div');
    const toggle = createLiveChatIconButton({
      className: 'hundesalon-chat-actions-toggle',
      icon: 'menu',
      label: copy.quickActions,
    });
    const menu = document.createElement('div');
    const title = document.createElement('p');
    const status = document.createElement('p');
    const minimize = createLiveChatMenuAction({
      action: 'minimize',
      icon: 'minimize',
      label: copy.minimize,
    });
    const expand = createLiveChatMenuAction({
      action: 'expand',
      icon: 'expand',
      label: copy.expand,
    });
    const download = createLiveChatMenuAction({
      action: 'download',
      icon: 'download',
      label: copy.download,
    });
    const newConversation = createLiveChatMenuAction({
      action: 'new-conversation',
      icon: 'newConversation',
      label: copy.newConversation,
    });

    actions.className = 'hundesalon-chat-actions';
    menu.id = 'hundesalon-chat-actions-menu';
    menu.className = 'hundesalon-chat-actions-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    title.className = 'hundesalon-chat-actions-title';
    title.textContent = copy.quickActions;
    status.className = 'hundesalon-chat-action-status';
    status.setAttribute('aria-live', 'polite');
    toggle.setAttribute('aria-controls', menu.id);
    toggle.setAttribute('aria-expanded', 'false');

    toggle.addEventListener('click', event => {
      event.stopPropagation();
      toggleLiveChatPopover(menu, toggle);
    });
    minimize.addEventListener('click', () => {
      closeLiveChatPopovers(root);
      root.querySelector('.button-close-widget')?.click();
    });
    expand.addEventListener('click', () => {
      setLiveChatExpanded(root, expand, copy);
      closeLiveChatPopovers(root);
    });
    download.addEventListener('click', () => {
      downloadLiveChatTranscript(root, copy, status);
    });
    newConversation.addEventListener('click', () => resetLiveChatConversation(copy));

    menu.append(title, minimize, expand, download, newConversation, status);
    actions.append(toggle, menu);
    header.appendChild(actions);
  };

  const startLiveChatVoiceInput = ({ button, status, textarea, copy }) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setLiveChatStatus(status, copy.voiceUnsupported);
      return;
    }

    const languageMap = { de: 'de-DE', en: 'en-US', ru: 'ru-RU', uk: 'uk-UA' };
    const recognition = new SpeechRecognition();
    recognition.lang = languageMap[getPageLanguage()] || 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      button.classList.add('is-listening');
      setLiveChatStatus(status, copy.listening, 0);
    };
    recognition.onresult = event => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) insertLiveChatText(textarea, `${textarea.value.trim() ? ' ' : ''}${transcript}`);
    };
    recognition.onerror = () => setLiveChatStatus(status, copy.voiceError);
    recognition.onend = () => {
      button.classList.remove('is-listening');
      if (status.textContent === copy.listening) setLiveChatStatus(status, '');
    };

    try {
      recognition.start();
    } catch {
      setLiveChatStatus(status, copy.voiceError);
    }
  };

  const enhanceLiveChatComposer = root => {
    const container = root.querySelector('.widget-footer-container');
    const textarea = container?.querySelector('textarea.form-control');
    if (!container || !textarea) return;

    const copy = getLiveChatCopy();
    const upload = container.querySelector('.widget-upload-button input[type="file"]');
    if (upload) {
      upload.setAttribute('aria-label', copy.attach);
      upload.title = copy.attach;
    }

    if (container.querySelector('.hundesalon-chat-composer-tools')) return;

    const tools = document.createElement('div');
    const emojiToggle = createLiveChatIconButton({
      className: 'hundesalon-chat-emoji-toggle',
      icon: 'emoji',
      label: copy.emoji,
    });
    const voice = createLiveChatIconButton({
      className: 'hundesalon-chat-voice-toggle',
      icon: 'voice',
      label: copy.voice,
    });
    const picker = document.createElement('div');
    const status = document.createElement('div');

    tools.className = 'hundesalon-chat-composer-tools';
    picker.id = 'hundesalon-chat-emoji-picker';
    picker.className = 'hundesalon-chat-emoji-picker';
    picker.setAttribute('role', 'listbox');
    picker.setAttribute('aria-label', copy.emoji);
    picker.hidden = true;
    status.className = 'hundesalon-chat-composer-status';
    status.setAttribute('aria-live', 'polite');
    emojiToggle.setAttribute('aria-controls', picker.id);
    emojiToggle.setAttribute('aria-expanded', 'false');

    for (const emoji of LIVE_CHAT_EMOJIS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hundesalon-chat-emoji';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-label', emoji);
      button.textContent = emoji;
      button.addEventListener('click', () => {
        insertLiveChatText(textarea, emoji);
        closeLiveChatPopovers(root);
      });
      picker.appendChild(button);
    }

    emojiToggle.addEventListener('click', event => {
      event.stopPropagation();
      toggleLiveChatPopover(picker, emojiToggle);
    });
    voice.addEventListener('click', () => {
      startLiveChatVoiceInput({ button: voice, status, textarea, copy });
    });

    tools.append(emojiToggle, voice);
    container.append(tools, picker, status);
  };

  const installLiveChatRootEvents = root => {
    if (root.__hundesalonLiveChatEventsInstalled) return;
    root.__hundesalonLiveChatEventsInstalled = true;
    root.addEventListener('click', event => {
      if (!event.target.closest('.hundesalon-chat-actions, .hundesalon-chat-emoji-picker, .hundesalon-chat-emoji-toggle')) {
        closeLiveChatPopovers(root);
      }
    });
    root.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const main = root.querySelector('main.root');
      if (main?.classList.contains('hundesalon-chat-expanded')) {
        main.classList.remove('hundesalon-chat-expanded');
        const copy = getLiveChatCopy();
        const action = root.querySelector('[data-action="expand"]');
        const label = action?.querySelector('.hundesalon-chat-action-label');
        if (label) label.textContent = copy.expand;
      }
      closeLiveChatPopovers(root);
    });

    if (!document[LIVE_CHAT_DOCUMENT_EVENTS_KEY]) {
      document[LIVE_CHAT_DOCUMENT_EVENTS_KEY] = true;
      document.addEventListener('pointerdown', event => {
        const activeRoot = document.querySelector('sp-live-chat')?.shadowRoot;
        if (!activeRoot || event.composedPath().includes(activeRoot.host)) return;
        closeLiveChatPopovers(activeRoot);
      });
    }
  };

  const enhanceLiveChatDom = root => {
    enhanceLiveChatHeader(root);
    enhanceLiveChatComposer(root);
    installLiveChatRootEvents(root);
  };

  const watchLiveChatDom = root => {
    if (root[LIVE_CHAT_ROOT_OBSERVER_KEY]) return;
    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enhanceLiveChatDom(root);
      });
    });
    observer.observe(root, { childList: true, subtree: true });
    root[LIVE_CHAT_ROOT_OBSERVER_KEY] = observer;
  };

  const applyLiveChatTheme = () => {
    const root = document.querySelector('sp-live-chat')?.shadowRoot;
    if (!root) return false;

    if (!root.getElementById(LIVE_CHAT_THEME_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = LIVE_CHAT_THEME_STYLE_ID;
      style.textContent = LIVE_CHAT_THEME_CSS;
      root.appendChild(style);
    }
    enhanceLiveChatDom(root);
    watchLiveChatDom(root);
    return true;
  };

  const watchLiveChatTheme = () => {
    if (applyLiveChatTheme()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (applyLiveChatTheme()) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.setTimeout(() => observer.disconnect(), 15000);
  };

  const loadIntegrations = () => {
    if (!isPublicHost() || window.__hundesalonSendPulseLoaded) {
      return;
    }

    window.__hundesalonSendPulseLoaded = true;
    setLiveChatAudienceContext();

    window.addEventListener('spLiveChatLoaded', configureLiveChat, { once: true, passive: true });

    loadScript('https://cdn.pulse.is/livechat/loader.js', {
      'data-live-chat-id': LIVE_CHAT_ID,
    });
    watchLiveChatTheme();

    loadScript('https://static.sppopups.com/assets/loader.js', {
      'data-chats-widget-id': POPUP_WIDGET_ID,
    });
  };

  const runWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadIntegrations, { timeout: 2000 });
      return;
    }

    window.setTimeout(loadIntegrations, 300);
  };

  if (document.readyState === 'complete') {
    runWhenIdle();
  } else {
    window.addEventListener('load', runWhenIdle, { once: true, passive: true });
  }
})();
