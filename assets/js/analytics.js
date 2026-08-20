(function () {
  const CONSENT_KEY = 'hundesalon_cookie_consent';
  const FALLBACK_GA_ID = 'G-XXXXXXXXXX';
  const FALLBACK_ADS_ID = 'AW-18333140047';
  const FALLBACK_ADS_SEND_TO = 'AW-18333140047/qNqJCKzYu9QcEM-I9qVE';

  const isPlaceholder = value => !value || value === 'G-XXXXXXXXXX' || String(value).includes('XXXXXXXX');
  const isAdsId = value => /^AW-\d+$/.test(String(value || ''));

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
      return {
        GA_MEASUREMENT_ID: FALLBACK_GA_ID,
        GOOGLE_ADS_ID: FALLBACK_ADS_ID,
        GOOGLE_ADS_CONVERSION_SEND_TO: FALLBACK_ADS_SEND_TO,
      };
    }
  };

  const injectGtag = ({ gaId, adsId, adsSendTo }) => {
    if (window.__hundesalonAnalyticsReady) {
      return;
    }

    const hasGa = !isPlaceholder(gaId);
    const hasAds = isAdsId(adsId);
    if (!hasGa && !hasAds) {
      return;
    }

    window.__hundesalonAnalyticsReady = true;
    window.__hundesalonAdsSendTo = adsSendTo || FALLBACK_ADS_SEND_TO;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };

    const bootId = hasGa ? gaId : adsId;
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(bootId)}`;
    document.head.appendChild(script);

    window.gtag('js', new Date());
    // Accept cookie banner covers analytics + ads measurement (Consent Mode).
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      functionality_storage: 'granted',
      security_storage: 'granted',
    });

    if (hasGa) {
      window.gtag('config', gaId, { anonymize_ip: true });
    }
    if (hasAds) {
      window.gtag('config', adsId);
    }
  };

  const injectClarity = (projectId) => {
    const id = String(projectId || '').trim();
    if (!id || window.__hundesalonClarityReady) {
      return;
    }

    window.__hundesalonClarityReady = true;
    window.clarity = function clarity() {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  };

  window.hundesalonTrackAdsConversion = (options = {}) => {
    if (typeof window.gtag !== 'function') {
      return false;
    }
    const sendTo = options.send_to || window.__hundesalonAdsSendTo || FALLBACK_ADS_SEND_TO;
    if (!sendTo) {
      return false;
    }
    window.gtag('event', 'conversion', {
      send_to: sendTo,
      value: typeof options.value === 'number' ? options.value : 1.0,
      currency: options.currency || 'EUR',
    });
    return true;
  };

  const bootAnalytics = async () => {
    if (!getConsent()) {
      return;
    }

    const env = await loadEnv();
    injectGtag({
      gaId: env.GA_MEASUREMENT_ID || FALLBACK_GA_ID,
      adsId: env.GOOGLE_ADS_ID || FALLBACK_ADS_ID,
      adsSendTo: env.GOOGLE_ADS_CONVERSION_SEND_TO || FALLBACK_ADS_SEND_TO,
    });
    injectClarity(env.MS_CLARITY_ID);
  };

  window.addEventListener('hundesalon:cookie-consent', event => {
    if (event.detail?.analytics === true) {
      void bootAnalytics();
    }
  });

  void bootAnalytics();
})();
