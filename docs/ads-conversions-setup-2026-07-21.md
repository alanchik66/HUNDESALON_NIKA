# Google Ads — website conversions (2026-07-21)

Account: HUNDESALON NIKA · `ocid=8415382946` · login `ryndenko1982@gmail.com`

## Actions in Google Ads

| Action | Role | Notes |
|--------|------|--------|
| Отправка формы для потенциальных клиентов | **Primary** | Website · count One · data-driven |
| Звонки по объявлениям | Existing | Phone from ads |
| Покупка / Регистрация | Existing | Left as-is |

Sources enabled: website + phone. App and Zapier offline unchecked.

## Tag IDs

- Google tag: `AW-16333140047`
- Lead conversion `send_to`: `AW-16333140047/qNqJCkzYu8QcEM-I9qvE`

## Site wiring

- `config/env.js` — `GOOGLE_ADS_ID`, `GOOGLE_ADS_CONVERSION_SEND_TO`
- `assets/js/analytics.js` — loads AW tag after cookie accept; `ad_storage` granted with analytics consent; exposes `hundesalonTrackAdsConversion()`
- `assets/js/page-modules.js` — fires conversion after successful `/sendmail` (booking + contact forms)
- Cookie banner copy mentions Google Ads measurement

## Deploy note

After merge: `npm run deploy:full` (or deploy + purge) so live HTML/JS pick up the tag. Conversions appear in Ads within ~24h after real consented submits.
