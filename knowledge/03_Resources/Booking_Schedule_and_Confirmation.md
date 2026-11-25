---
type: resource
status: verified
updated: 2026-11-26
tags: [booking, calendar, regression]
---

# Booking schedule and preserved confirmations

Project: [[01_Projects/HUNDESALON_NIKA]]. Verified from the local release candidate on 2026-11-22; this records implementation contracts, not new business policy or evidence of live Calendar/account setup.

## New booking requests

The four localized contact pages publish Monday–Friday 09:00–21:00, Saturday 10:00–16:00, Sunday closed. The frontend classic PriceBookingCatalog and the server validate the same calendar-date policy. A booking's complete safe block (estimated duration plus buffer) must fit before closing; an appointment ending exactly at closing is allowed.

A date is a Europe/Berlin salon wall-clock date. Weekday selection uses validated calendar components, not the visitor's time zone. Conversion of starts/busy intervals to actual instants still uses the Berlin offset, including DST. Spring/fall DST Sundays remain closed. A missing Calendar integration uses conservative non-overlapping starts, rounded up to the server's 30-minute grid; a missing booking catalog exposes no guessed slots.

The browser and Worker retain separate synchronous implementations to preserve existing classic-script entry points. Parity tests bind both implementations to the published contact-page policy; there is no added runtime dependency or promise that either implementation alone is a shared external configuration service.

## Saved paid orders and signed confirmations

New-slot validation does not rewrite previously saved bookings. Checkout resumes use the stored order and capability, paid fulfillment uses the verified D1 order, and signed staff confirmation uses the saved Calendar interval. A newly closed Sunday must not invalidate those previously valid records. Regression fixtures cover stored Sunday fulfillment/resume and signed Sunday confirmation without making real bookings or payments.

## Primary local sources and verification

- [Contact policy, RU](../../ru/kontakty.html), with matching DE/EN/UK contact pages.
- [Classic catalog](../../assets/js/price-booking.js): getBookingWorkingHours/getAvailableStartTimes, duration/buffer end-fit.
- [Server submission](../../functions/sendmail.js): getBookingWorkingHours/isValidBookingWindow; trusted paid fulfillment bypasses new-slot validation.
- [Checkout](../../functions/payment.js): existing-order resume before new-booking preparation.
- [Calendar confirmation](../../functions/_lib/booking-calendar.js): validates the stored interval and conflicts, without reapplying new opening-hour policy.
- [Policy/DST/fallback tests](../../tools/booking-catalog-parity.test.mjs), [payment regression](../../functions/payment-flow.test.js), [signed confirmation regression](../../functions/api/booking-confirm.test.js).

The earlier fixed 09:00–18:00 everyday implementation is historical and contradicted the published contact policy. No Calendar events, stored paid orders, account settings, or public contact hours were changed by this correction. Exceptional closures/holidays are outside this weekly policy and still require real Calendar availability or a future separately authorized policy.

## Published policy recheck, 2026-11-26

Four ordinary canonical HTTPS contact-page GETs returned HTTP 200 and the same effective published policy in DE/EN/RU/UK: weekdays 09:00–21:00, Saturday 10:00–16:00, Sunday closed. This checks the served HTML, including any published page-copy layer, separately from repository text. Receipt: `output/release-2026-11-22/published-hours-before-release-20261126.json`.

The existing foreign-visitor DST regression now uses working days before and after the March/October transitions, retaining occupied 09:00–10:00 interval exclusion in Berlin, New York and Tokyo visitor time zones. Both DST Sundays explicitly produce no slots. This prevents a newly closed Sunday fixture from silently replacing the actual time-zone/busy-interval contract. Source: `tools/frontend-regressions.test.mjs`.
