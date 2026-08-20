export const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
/** Google Ads conversion ID (gtag config). */
export const GOOGLE_ADS_ID = 'AW-18333140047';
/** Primary lead conversion: Отправка формы для потенциальных клиентов */
export const GOOGLE_ADS_CONVERSION_SEND_TO = 'AW-18333140047/qNqJCKzYu9QcEM-I9qVE';
export const GOOGLE_CALENDAR_ID = 'primary';
export const SHEET_ID = 'ВАШ_GOOGLE_SHEETS_ID';
export const TEAM_CHANNEL_ID = 'ВАШ_TEAMS_CHANNEL';
export const DRIVE_UPLOAD_FOLDER = 'ВАШ_GOOGLE_DRIVE_FOLDER_ID';
export const PAYMENT_PROVIDER_KEY = 'YOUR_PAYMENT_API_KEY'; // TODO: set through server-side environment variables only.
/** Microsoft Clarity project ID (Bing Webmaster Tools → Clarity). */
export const MS_CLARITY_ID = 'efbb2b19-7440-48bf-bc3a-166725c69d1b';

// Public defaults for local previews. Production secrets must be read from Cloudflare environment variables.
export const PUBLIC_ENV = Object.freeze({
  GA_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  GOOGLE_ADS_CONVERSION_SEND_TO,
  GOOGLE_CALENDAR_ID,
  SHEET_ID,
  TEAM_CHANNEL_ID,
  DRIVE_UPLOAD_FOLDER,
  PAYMENT_PROVIDER_KEY,
  MS_CLARITY_ID,
});
