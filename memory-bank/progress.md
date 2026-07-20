# Progress

Task list for project / agent-tooling progress.
2026-07-18 13:20:00 - Initialized.

## Completed Tasks

- [x] Graphify CLI + project skill + graph built (`npm run graphify`)
- [x] Ponytail always-on Cursor rule + skills
- [x] RooFlow config (`.roo/`, `.roomodes`) + Memory Bank seed
- [x] 2026-07-19: Master `docs/agents-master.md` + booking/newsletter/SEO/legal hardening
- [x] AGB pages (de/en/ru/uk) + footer links + booking AGB consent
- [x] Stripe integration: `functions/payment.js` + webhook; CF secrets (`STRIPE_SECRET_KEY` test, `STRIPE_WEBHOOK_SECRET`, deposit, `SITE_ORIGIN`)
- [x] Online payments **paused** until salon opens (`PAYMENTS_ONLINE_ENABLED=false`; UI salon cash/card only)
- [x] Stripe bank payout prep: Sparkasse IBAN ••••1334 / WELADE8L + 2FA On + website (submit still open)
- [x] GBP HUNDESALON_NIKA on ryndenko: profile tabs, hours Mo–Fr 09–21 / Sa–So closed, salon payment attrs
- [x] GBP socials: Instagram + Facebook + TikTok (YouTube deferred)
- [x] 2026-07-19: session junk cleanup (temp/CDP/playwright dumps); Memory Bank trimmed
- [x] 2026-07-19: Eric Schumann прайс + правила салона (prays-list, AGB, услуги, галочка перед записью) — 4 языка
- [x] 2026-07-20: full DE/EN/RU/UK grammar pass, premium typography/layout system, navigation/photo/weather QA
- [x] 2026-07-20: payment trust boundaries hardened + automated `check:payments`; payments remain OFF
- [x] 2026-07-20: release cleanup (~2k lines obsolete migration/probe tooling removed), SEO metadata 160–170 chars, production build + 4-locale browser smoke passed
- [x] 2026-07-20: AI Routing Kernel integrated across all agent hosts + `check:agents-routing` in validate

## Current Tasks

- [ ] Stripe onboarding **Zustimmen und absenden** — Incomplete на Unternehmensinformationen (USt пусто; Dashboard flaky). Payments на сайте OFF
- [ ] GBP video verification after salon opens (`…/verify/l/09116836504441086909`)
- [ ] Owner: USt-IdNr → Impressum (4 locales) + Stripe company
- [ ] After GBP public: `config/brand-profiles.mjs` → Maps place URL

## Next Steps

- When salon opens: provision `PAYMENT_EVENTS` KV binding, set `PAYMENTS_ONLINE_ENABLED=true`, restore online radio UI, optionally switch to `sk_live_…`, redeploy.
- Webhook (already configured): `https://hundesalon-nika.com/payment-webhook`
- Flow-* modes in Roo Code when available; in Cursor use Memory Bank + Graphify + Ponytail.
