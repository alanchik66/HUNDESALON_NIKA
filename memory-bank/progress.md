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
- [x] 2026-07-20: AI Routing Kernel integrated across all agent hosts + `check:agents-routing` in validate (#26 / #27)
- [x] 2026-07-20: Routing finalize — #26 architecture locked; git-workflow § refs fixed; Memory Bank merge noise cleared
- [x] 2026-07-20: production deploy to Cloudflare Pages + CDN purge + live checks (`20260720-prod-v2` live on hundesalon-nika.com)
- [x] 2026-07-20: GitHub `main` synced — Ads draft MP4s local-only (gitignore); LFS push unblocked without buying quota
- [x] 2026-07-20: graphify-out + RooFlow (`.roo`) repaired vs upstream — absolute root/python, wrappers, MCP inject into Flow prompts
- [x] 2026-07-20: Cursor Flow bridge (`.agents/skills/flow-*`) + Graphify MCP + wiki — Flow modes work in Cursor without Roo XML
- [x] 2026-07-20: Token economy for all Cursor agents — always-on ~898 tok, Graphify HTTP MCP, global user rule, `tokens:calibrate`
- [x] 2026-07-20: Cloud Agent diffs applied via git pull (#26–#30); Cursor commit-provider reset script ready

## Current Tasks

- [ ] Stripe onboarding **Zustimmen und absenden** — Incomplete на Unternehmensinformationen (USt пусто; Dashboard flaky). Payments на сайте OFF
- [ ] GBP video verification after salon opens (`…/verify/l/09116836504441086909`)
- [ ] Owner: USt-IdNr → Impressum (4 locales) + Stripe company
- [ ] After GBP public: `config/brand-profiles.mjs` → Maps place URL

## Next Steps

- Optional: GitHub Billing → Budgets → allow small LFS overage if weather/media LFS uploads are needed before monthly reset.
- When salon opens: provision `PAYMENT_EVENTS` KV binding, set `PAYMENTS_ONLINE_ENABLED=true`, restore online radio UI, optionally switch to `sk_live_…`, redeploy.
- Webhook (already configured): `https://hundesalon-nika.com/payment-webhook`
- Flow-* modes in Cursor: say `Flow-Code` / `Flow-Architect` / … (skills under `.agents/skills/flow-*`); in Roo Code use `.roomodes`. Memory Bank + Graphify + Ponytail always available.
