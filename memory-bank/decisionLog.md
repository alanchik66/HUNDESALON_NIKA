# Decision Log

## 2026-11-06 - Service-page glass coverage and portable solar arithmetic

- The four localized service pages lacked the glass stylesheet, script and opt-in grid attribute that were present on the homepages. Connect the existing material to all eight service cards per locale; preserve content, prices, links and layout. Include these exact pages in integration and browser coverage.
- The solar flare shader evaluated three signed Gaussian distances with `pow(distance, 2.0)`. GLSL ES defines negative bases as undefined even for this exponent. Use explicit multiplication for the Gaussian square; preserve the original texture, light strength, geometry and colour calibration. Regression references must follow GLSL domains rather than JavaScript `Math.pow` behaviour.
- Windows Playwright WebKit and Chromium measurements are separate from physical iPhone/Safari verification. A successful shader link alone does not prove finite fragment arithmetic or visible optical effects; retain source hashes, ordinary DOM screenshots and separately labelled GPU diagnostics.

## 2026-11-06 - Dispatch scheduled weather before geolocation preflight

- The published e895685 trace showed a 314.05-second controller interval: a five-minute heartbeat awaited approximately 14 seconds of location/metadata work before starting the full weather request. The current and forecast request must start immediately after lifecycle validity checks, independently of that preflight.
- Use the existing weather refresh helper so duplicate requests remain coalesced and responses for replaced coordinates, widget instances or lifecycle generations are ignored. Retain the forced request Promise through the preflight so a fast success or failure does not trigger another request in the same heartbeat.
- Reuse the already downloaded CI receipt for unchanged-release control checks. Repeat the required release gate only after this confirmed source correction; verify automatic request dispatch and network responses on the resulting publication.

## 2026-11-06 - Verify weather cadence through real network events

- A periodic five-minute heartbeat must request full current/forecast data even when the initial asynchronous response completed after timer setup. Keep the age guard for incidental visibility/resume checks, not as a reason to skip the scheduled heartbeat.
- Coalesce an existing data request; if geolocation metadata is still pending, retain the heartbeat signal on that native operation until its post-await freshness check. Recheck connection, mount, exact coordinate selection, lifecycle generation, visibility and online state before requesting weather.
- Preserve the observed failing network trace and require a new published controller-request interval before declaring the repair verified. Revision58e4632 restored the sky/timestamps but was superseded for this scheduler correction.
- The next live pass on a89c3ee confirmed a timely full request but exposed the service worker's generic stale-while-revalidate response for `/api/weather` (HTTP 200 marked fromServiceWorker/fromDiskCache). Exclude that dynamic endpoint from static offline caching so its request cache policy reaches the network. Preserve this failing trace separately and verify the next published response, not only request timing.

## 2026-11-05 22:39:33 - Weather freshness and sky share explicit time semantics

- Poll the site API and expire local weather cache after five minutes; preserve the actual provider observation/validity timestamp and upstream forecast cache policy.
- Keep current UI time, time of retrieval, provider observation time, and forecast appearance time separate. Never refresh the observation label from a live clock or invent an absent timestamp.
- Apply star visibility to both CSS and native WebGL layers, using the same solar phase and cloud transmission. Share the shell clock/presentation with the maintained 3D scene; retain an explicit local-noon projection for forecast previews.
- Original Moon/Sun media, source attribution and unrelated glass/button effects are outside this repair.

## 2026-11-05 - Scoped web glass for homepage service tiles

- Apply the material only to the four homepage cards marked by `data-service-glass` in de/en/ru/uk. Keep weather, booking and breed controls outside this change.
- Use native backdrop blur, a thin masked rim, and a slightly magnified copy of the known CSS background at the bevel. This is a web adaptation, not arbitrary DOM refraction or the native Apple compositor.
- Reuse existing pointer coordinates; update from the actual site scroll root. Pause offscreen/hidden and respect reduced motion/transparency/contrast. No sensors, permissions, dependencies or whole-card transforms.
- Preserve sharp text; use solid dark gold on light glass where the shared pale gradient loses contrast. Track the two isolated assets with their own gzip budgets.

## 2026-08-28 - Separate Roo Code and VS Code Flow Layers

### Decision

Use `.roomodes` and `.roo/system-prompt-flow-*` as the upstream Roo Code layer. Use `.agents/skills/flow-*` as the VS Code/Copilot adaptation layer.

### Rationale

The upstream prompts contain Roo Code-specific XML tool contracts, while the adapted skills use native VS Code tools. Keeping the layers separate prevents contradictory tool instructions.

### Constraints

- Do not overwrite `.roo/rules/` or `.roo/commands/` during RooFlow updates.
- Pin and verify the upstream commit before synchronizing RooFlow files.
- Never inject secrets or raw credentials into system prompts or Memory Bank files.

## 2026-11-04 07:25:53 - GitHub profile release command

- The user established `https://github.com/haraldalder-vibemogger` as a standing full release command for this project, unless the message explicitly limits the task to reading or another purpose.
- Keep `docs/RELEASE_GUIDE.md` as the procedure and `config/release-reference-methods.json` as the pinned method catalog. Discover the current public repositories and HEADs on every profile-triggered run; do not hard-code a permanent repository count.
- Adapt compatible methods through the existing stack, preserve explicit staging and required gates, deploy the exact tested artifact, and verify the publicly served commit and four locales.
- This rule does not authorize account permission changes, credential creation, messages to others, paid APIs, or bypassing failed checks. Preserve the user's separate dependency-change rule.

## 2026-11-15 21:23:18 Europe/Berlin — Public fax contact

- The owner provided the salon fax number `+49 341 24892905`; `config/brand-profiles.mjs` now keeps it as `NAP.fax`, separately from the voice phone and WhatsApp.
- Contact and Impressum pages expose a selectable, localized fax value in all four locales. Explicit voice telephone links remain unchanged; telephone autodetection is disabled on those pages so a fax is not offered as a voice call.
- Homepage/services Organization and LocalBusiness metadata use the dedicated [Schema.org faxNumber](https://schema.org/faxNumber) property, normalized to `+4934124892905`. The sync script preserves service-specific URLs/descriptions and updates visible marked values plus llms.txt from the same source.
- This is website contact configuration based on the owner's confirmation, not proof of fax-provider setup or actual fax delivery. No external account/profile update or release is included in this change.

## 2026-11-15 21:46:48 Europe/Berlin — Contact-card message action

- The owner requested that the contact-card message button lead to the existing on-page contact form. The four locales now use `#contact-form`, an envelope icon and localized write-to-us copy, without an external-tab target. Other Telegram/social links remain their own channels.
- Reuse `initSmoothHashLinks()` in page-modules.js; only the contact-form target additionally receives focus with preventScroll. The named target region has tabindex=-1 so keyboard users continue into its inputs without immediately focusing an input on phones. Reduced-motion users receive an instant contact-form transition.
- Validate scrolling, visibility and keyboard focus in local browsers without submitting the form or testing live message delivery.

## 2026-11-15 23:01:08 Europe/Berlin — Burger menu focus return

- Save the explicit burger opener rather than document.activeElement: Safari pointer clicks do not necessarily focus buttons, so Escape could close the inert menu with focus left on BODY. The sole menu opener is the burger click handler; link navigation still closes with restoreFocus=false.
- A regression executes the actual initialization and handlers for pointer/keyboard Escape and navigation closure. The pointer case fails before the one-line fix and all three cases pass after it. The prior local headless WebKit observation is recorded in Browser_Interaction_and_Overlay_QA; physical iPhone validation and the rebuilt-artifact browser check are separate.

## 2026-11-15 — Observe verifier timeout attempts at the client boundary

- Count fetch calls and actual aborted signals rather than requiring the localhost server handler to receive a request before its 80ms client timeout. An abort-aware admission-queue control reproduced the old assertion failure with two cancelled client calls and zero server arrivals; the original gate did not retain its actual counter or prove a CPU cause.
- Preserve 80ms request/240ms overall/1500ms elapsed expectations and two attempts; test both native fetch and closed admission, with exact URL checks, cancelled signals, bounded arrivals and no late attempt. Add a 2500ms test-owned watchdog so a broken abort cannot hang the harness. Production verifier code is unchanged.
- Both targeted cases and scoped lint/syntax checks pass. A separate ignored broken-signal negative control hit the 2500ms watchdog as expected. Full release QA remains a separate required run; evidence is in `output/release-2026-11-15-final/timeout-test-review.md`.

## 2026-11-16 — Preserve meteor bloom through the widget reset

- In the full shadow tree, the existing complex preview exclusion did not protect meteor pseudo-element backgrounds from the aggressive reset in the tested WebKit; Chromium preserved the radial head. CSS syntax/support and animation opacity alone passed and missed the defect. The exact CI scene plus a reset-only isolation established the cause; this is not a claim about every Safari version or a physical iPhone test.
- Add a simple explicit `:not(.weather-header-shooting-star)` immediately before `::before` and `::after` in those two reset branches. Keep the element reset, meteor geometry/material/timing, astronomy and layer order unchanged. The isolated candidate preserves the gradient in both engines; require actual candidate-build computed head/trail backgrounds and screenshots before release.
- Primary evidence and limits: `knowledge/03_Resources/Browser_Interaction_and_Overlay_QA.md`, `output/release-2026-11-15-final/weather-css-isolation/`, and the new `output/release-2026-11-16-meteor-fix/`. No account permissions/settings or external business data are changed by this fix.
