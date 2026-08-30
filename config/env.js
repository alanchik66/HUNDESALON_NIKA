export const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
/** Google Ads conversion ID (gtag config). */
export const GOOGLE_ADS_ID = 'AW-18333140047';
/** Primary lead conversion: Отправка формы для потенциальных клиентов */
export const GOOGLE_ADS_CONVERSION_SEND_TO = 'AW-18333140047/qNqJCKzYu9QcEM-I9qVE';
/** Microsoft Clarity project ID (Bing Webmaster Tools → Clarity). */
export const MS_CLARITY_ID = 'efbb2b19-7440-48bf-bc3a-166725c69d1b';

// Public analytics and advertising identifiers for local previews.
// Server-side configuration and secrets must be read from Cloudflare environment variables.
export const PUBLIC_ENV = Object.freeze({
  GA_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  GOOGLE_ADS_CONVERSION_SEND_TO,
  MS_CLARITY_ID,
});
