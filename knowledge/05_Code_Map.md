# Code Map

## Frontend data
- `assets/js/price-catalog.js` - canonical service and price catalog data.
- `assets/js/price-page-locales.js` - locale-specific copy and labels.

## Styling
- `assets/css/style.css` - shared tokens, typography, and global styling.
- `assets/css/page-modules.css` - page-level and module-specific styling.

## Workers
- `workers/pages-proxy.js` - proxy layer for Pages-related requests.
- `workers/wrangler.toml` - worker configuration.
- `workers/booking-email-router/` - booking email routing logic.
- `workers/info-auto-reply/` - automatic reply logic.

## Editing rules
- Update canonical data first.
- Then update locale text.
- Then verify UI on desktop and mobile.
- Then record the live result.

