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
  const LIVE_CHAT_SUPPORTED_LANGUAGES = new Set(['en', 'ru', 'uk']);
  const LIVE_CHAT_THEME_CSS = `
    :host {
      --hundesalon-chat-emerald: 3, 76, 53;
      --hundesalon-chat-emerald-deep: 1, 24, 17;
      --hundesalon-chat-gold: 226, 186, 94;
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
      border-bottom: 1px solid rgba(var(--hundesalon-chat-gold), 0.3) !important;
      background:
        linear-gradient(110deg, rgba(2, 65, 45, 0.96), rgba(7, 111, 77, 0.9)),
        rgba(var(--hundesalon-chat-emerald-deep), 0.92) !important;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.24) !important;
      color: rgb(255, 239, 196) !important;
    }

    .widget-wrapper .widget-header h5 {
      color: rgb(255, 239, 196) !important;
      font-family: Georgia, 'Times New Roman', serif !important;
      font-weight: 700 !important;
      letter-spacing: 0.045em !important;
      text-shadow: 0 2px 14px rgba(var(--hundesalon-chat-gold), 0.34) !important;
    }

    .widget-wrapper .button-close-widget {
      border: 1px solid rgba(255, 239, 196, 0.3) !important;
      background: rgba(255, 255, 255, 0.1) !important;
      box-shadow: inset 0 0 14px rgba(255, 255, 255, 0.06) !important;
      color: rgb(255, 239, 196) !important;
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

    .widget-wrapper .terms-link,
    .widget-wrapper .terms-link a {
      color: rgb(244, 211, 132) !important;
      text-decoration-color: rgba(var(--hundesalon-chat-gold), 0.58) !important;
      text-underline-offset: 0.16em !important;
    }

    .widget-wrapper .widget-footer {
      border-top: 1px solid rgba(var(--hundesalon-chat-gold), 0.24) !important;
      background: rgba(0, 25, 18, 0.7) !important;
      box-shadow: 0 -12px 28px rgba(0, 0, 0, 0.18) !important;
      backdrop-filter: blur(12px) !important;
    }

    .widget-wrapper .widget-footer-container,
    .widget-wrapper .widget-footer-inapp {
      background: transparent !important;
    }

    .widget-wrapper .form-control {
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

    @media (max-width: 560px) {
      .widget-wrapper .widget {
        border-radius: 1.25rem !important;
        box-shadow:
          0 18px 42px rgba(0, 0, 0, 0.48),
          0 0 24px rgba(13, 128, 88, 0.22) !important;
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

  const applyLiveChatTheme = () => {
    const root = document.querySelector('sp-live-chat')?.shadowRoot;
    if (!root || root.getElementById(LIVE_CHAT_THEME_STYLE_ID)) {
      return Boolean(root);
    }

    const style = document.createElement('style');
    style.id = LIVE_CHAT_THEME_STYLE_ID;
    style.textContent = LIVE_CHAT_THEME_CSS;
    root.appendChild(style);
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
