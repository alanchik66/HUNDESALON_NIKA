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
    const envUrl = new URL('../../config/env.js', baseUrl);
    envUrl.searchParams.set('v', '20260721-ads-label');
    try {
      return await import(envUrl.toString());
    } catch {
      return { GA_MEASUREMENT_ID: FALLBACK_GA_ID, GOOGLE_ADS_ID: '', GOOGLE_ADS_CONVERSION_LABEL: '' };
    }
  };

  const ensureGtag = () => {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
    }
  };

  /**
   * Load gtag early with Consent Mode defaults denied so Google Ads can detect
   * the site tag; grant storage only after cookie accept.
   */
  const injectGtag = (gaId, adsId, consented) => {
    const hasGa = !isPlaceholder(gaId);
    const hasAds = Boolean(adsId && /^AW-\d+$/i.test(adsId));
    const primaryId = hasGa ? gaId : hasAds ? adsId : '';
    if (!primaryId) {
      return;
    }

    ensureGtag();

    if (!window.__hundesalonGtagScript) {
      window.__hundesalonGtagScript = true;
      window.gtag('consent', 'default', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        functionality_storage: 'granted',
        security_storage: 'granted',
        wait_for_update: 500,
      });
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryId)}`;
      document.head.appendChild(script);
      window.gtag('js', new Date());
    }

    if (consented) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: hasAds ? 'granted' : 'denied',
        ad_user_data: hasAds ? 'granted' : 'denied',
        ad_personalization: hasAds ? 'granted' : 'denied',
        functionality_storage: 'granted',
        security_storage: 'granted',
      });
    }

    if (!window.__hundesalonAnalyticsConfigured) {
      window.__hundesalonAnalyticsConfigured = true;
      if (hasGa) {
        window.gtag('config', gaId, { anonymize_ip: true });
      }
      if (hasAds) {
        window.gtag('config', adsId);
      }
    }
  };

  const bootAnalytics = async () => {
    const env = await loadEnv();
    const adsId = env.GOOGLE_ADS_ID || '';
    const gaId = env.GA_MEASUREMENT_ID || FALLBACK_GA_ID;
    const hasAds = Boolean(adsId && /^AW-\d+$/i.test(adsId));
    const consented = getConsent();

    // Always load Ads tag (consent-denied until accept) so Ads UI can verify install.
    if (hasAds || consented) {
      injectGtag(gaId, adsId, consented);
    }

    window.__hundesalonAdsConversionLabel = env.GOOGLE_ADS_CONVERSION_LABEL || '';
    window.__hundesalonAdsId = adsId;
  };

  /** Fire Ads conversion after booking/form success (no-op without label + consent). */
  window.hundesalonTrackConversion = (opts = {}) => {
    if (!getConsent()) return;
    ensureGtag();
    const adsId = window.__hundesalonAdsId || '';
    const label = opts.label || window.__hundesalonAdsConversionLabel || '';
    if (!adsId || !label || typeof window.gtag !== 'function') return;
    const sendTo = label.includes('/') ? label : `${adsId}/${label}`;
    window.gtag('event', 'conversion', {
      send_to: sendTo,
      value: opts.value,
      currency: opts.currency || 'EUR',
      transaction_id: opts.transactionId,
    });
  };

  window.addEventListener('hundesalon:cookie-consent', event => {
    if (event.detail?.analytics === true) {
      void bootAnalytics();
    }
  });

  void bootAnalytics();
})();
