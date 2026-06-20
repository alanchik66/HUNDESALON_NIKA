(function () {
  const CONSENT_KEY = 'hundesalon_cookie_consent';
  const FALLBACK_GA_ID = 'G-XXXXXXXXXX';

  const isPlaceholder = value => !value || value === 'G-XXXXXXXXXX' || value.includes('XXXXXXXX');

  const getConsent = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}');
      return stored.analytics === true;
    } catch {
      return false;
    }
  };

  const loadEnv = async () => {
    const currentScript = document.currentScript;
    const baseUrl = currentScript?.src || new URL('/assets/js/analytics.js', window.location.origin).toString();
    const envUrl = new URL('../../config/env.js', baseUrl).toString();
    try {
      return await import(envUrl);
    } catch {
      return { GA_MEASUREMENT_ID: FALLBACK_GA_ID };
    }
  };

  const injectGtag = gaId => {
    if (isPlaceholder(gaId) || window.__hundesalonAnalyticsReady) {
      return;
    }

    window.__hundesalonAnalyticsReady = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
    });
    window.gtag('config', gaId, { anonymize_ip: true });
  };

  const bootAnalytics = async () => {
    if (!getConsent()) {
      return;
    }

    const env = await loadEnv();
    injectGtag(env.GA_MEASUREMENT_ID || FALLBACK_GA_ID);
  };

  window.addEventListener('hundesalon:cookie-consent', event => {
    if (event.detail?.analytics === true) {
      void bootAnalytics();
    }
  });

  void bootAnalytics();
})();
