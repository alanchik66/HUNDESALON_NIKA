(function () {
  'use strict';

  const LIVE_CHAT_ID = '6a89e797b7f95e2b6c0cf199';
  const POPUP_WIDGET_ID = '49f098e8-81bf-4efa-9842-8f2012257c7b';
  const PUBLIC_HOST_RE = /(^|\.)hundesalon-nika\.com$/i;
  const PUBLIC_PREVIEW_RE = /(^|\.)pages\.dev$/i;
  const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

  const isPublicHost = () => {
    const host = String(window.location.hostname || '').trim().toLowerCase();
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

  const loadIntegrations = () => {
    if (!isPublicHost() || window.__hundesalonSendPulseLoaded) {
      return;
    }

    window.__hundesalonSendPulseLoaded = true;

    loadScript('https://cdn.pulse.is/livechat/loader.js', {
      'data-live-chat-id': LIVE_CHAT_ID,
    });

    loadScript('https://static.sppopups.com/assets/loader.js', {
      'data-chats-widget-id': POPUP_WIDGET_ID,
    });
    loadScript('https://static.sppopups.com/bundle.js.gz');
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
