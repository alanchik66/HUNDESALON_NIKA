# Decision Log

## 2026-11-17 - Remove the vulnerable lint parser chain

- Replace CLI2/globby/micromatch/braces with the official Markdownlint 0.41.1 API and native discovery while retaining the same configuration and file scopes. Upgrade Stylelint to 18.0.0 with standard config 41.0.0.
- The `picomatch` dependency resolves to an explicitly named, private project adapter backed only by official Minimatch 11.0.4. It supports the inspected pinned Stylelint/tinyglobby calls, rejects unsupported syntax/options, and contains no legacy parser. This is an owned compatibility layer, not a claimed upstream patch or an advisory suppression.
- Preserve strict full dependency audits. Verify installed consumer resolution, ordinary glob semantics, actual CSS/Markdown coverage and clean lockfile installation; future consumer upgrades require contract review. The previous unaccepted patch candidate and rejected adversarial verification are not used.
- Refresh ordinary booking selects after dynamic insertion through the existing shared enhancement API. Keep a readable native fallback. The maintained Chromium/WebKit regression runs sequentially with the browser gate; CI installs both browser engines.

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


## 2026-11-17 — Restore the map in the static local preview

- Port5502 returned403 for /api/maps-config because it serves public files without Pages Functions. Reuse the already configured official keyless Google share embed through an explicit mapsEmbedUrl option in the development server.
- Keep the exception exact and GET/HEAD-only; default static helpers and private API/source paths remain denied. Do not copy production API keys or change Google/Cloudflare settings.
- Live Google iframe and street/address pixels verified at desktop1280 and mobile390; six preview regression/security tests, scoped lint and diff-check pass. Evidence: output/maps-local-2026-11-17/. Local correction only; no commit/push/deploy.


## 2026-11-17 — Compact transparent burger tiles and the original promotion icon

- Keep the existing two-column link structure and destinations; reduce equal-height tiles64→48px, gaps8→6px and drawer padding12→10px. Use translucent green glass with a warm promotion accent.
- Restore the original clash-royale.png gold shield/crown as a decorative26px image. Preserve localized social.html#promotions and equal tile geometry; suppress the old perpetual icon animation in the drawer.
- Dim only the underlying main/section/footer while the menu is open so backdrop paint differences do not compromise label readability. Keep scroll locking, native links and focus handling intact. Final evidence and bounded image-readiness tests: output/burger-glass-2026-11-17/. No commit/push/deploy requested for this local review.

## 2026-11-17 — Full-width central promotion and compact grouped navigation

- Supersede the prior equal-width promotion with one centered full-width link between six service/result links and salon/community/business information. Keep every localized destination and the original PNG icon; ordinary tiles remain equal at44px, with smaller inline padding/tracking only on narrow screens.
- Use short menu-specific social labels: RU «Наши соцсети», UK «Наші соцмережі», DE «Social Media», EN «Our Social Media». Keep other site headings unchanged.
- Refine the web glass material with a bright multi-layer rim and translucent highlights. A minimal Windows WebKit test reproduces unsupported actual backdrop painting despite positive CSS support; blur the underlying page only during nav-open, without UA-specific rules. Full animation is the default per the user's clarification; reduced decoration belongs only to the unsupported-backdrop fallback. Existing scroll/focus controls and unrelated performance policies stay unchanged. Evidence: output/burger-glass-2026-11-17/wide-visual.json and diag-webkit-compositing.json. Local work only.

## 2026-11-17 — User-specified lower rows across every locale

- Latest requested pairs supersede the earlier lower-group order: About/Introduction, Socials/Blog, Documents/Partnership, Rating/LocalSEO. Keep the upper six links and the central full-width promotion unchanged.
- Existing DE/EN/UK introduction pages contain localized content and correct lang/canonical; expose them in the menu as well so all four locales have15 tiles and identical pairs without empty slots. No new pages or destinations outside this site.
- Consolidate today's local map/contact/menu checks in output/today-final-2026-11-17/. Keep prior map changes and already verified glass/focus/scroll treatment intact; no commit/push/deploy requested in this task.
- Final local QA:123/123 frontend+static-preview tests,18/18 browser scenarios and56unique menu targets PASS;7visual profiles, live desktop/mobile Google iframe and native write-us clicks verified. Scoped lint, build, budgets, graphify and diff-check pass. Delivery of forms/faxes and physical iPhone behavior are outside these browser proofs; evidence and limits are in the final report.

## 2026-11-17 — Latest menu rows and reused RGB perimeter

- Latest user order supersedes the preceding pairs: About/Introduction, Socials/Rating, Blog/LocalSEO, Partnership/Documents. Keep Services/Price and the full-width promotion unchanged in every locale.
- Remove permanent tile outlines and the white panel rim. Morph only decorative tile surfaces while link/text hit geometry stays fixed; retain the keyboard-only focus marker.
- Reuse the existing menu-contour canvas palette/cycle/ribbons for the rounded rectangle with optional radius and scoped panel styling. Start at bottom center, branch along both sides, meet at top center. Pause nav painting while closed/hidden/offscreen and clean target observers on disposal; capsule behavior stays unchanged.
- Remove the panel's transparent1px border because its overflow clip cut most of the contour centerline. No new runtime dependency or WebGL renderer. Evidence/verification: output/menu-rgb-morph-2026-11-17/. Changes remain local.

## 2026-11-17 — 85 percent transparent panel and stable glass tiles

- Latest visual preference supersedes animated tile corners: fixed12px rounded rectangles,44px height, borderless low-alpha glass gradients and soft internal highlights. Remove morph keyframes and phase variables; preserve the RGB perimeter, full-width promotion and all menu destinations/order.
- Base panel alpha0.15 in dark/light themes; keep nav/text opacity1. Interpret requested5percent frosting as a light1px backdrop blur, an artistic setting rather than a physical coefficient. Remove dense panel gradients and the extra4px overlay blur.
- Actual Chromium/WebKit comparison selected source-page opacity.4/blur2 for legibility; .55/blur1 produced competing contact text. This is a separate background-focus treatment, not a change to the base panel alpha. Keep graceful unsupported-backdrop fallback.
- Current evidence: output/menu-clear-glass-2026-11-17/. CSS-only local work; prior map/contact and JavaScript renderer changes are preserved, with no commit/push/deploy.

## 2026-11-17 — Hairline RGB menu perimeter

- Latest preference: maximum practical thinness. Set only #mobile-nav contour half-width0.25px (solid core up to0.5CSSpx) and suppress its external canvas filter; leave other controls/palette/timing intact. Pixel checks pass in Chromium DPR1/3 and WebKit DPR2; evidence output/menu-hairline-2026-11-17/. Local CSS-only adjustment.

## 2026-11-17 — Matte gold tile surfaces at75percent transparency

- Replace tile surface gradients with opaque matte gold shades and composite only a::before atopacity.25, keeping linktext/icons opacity1. Preserve75percent base transparency for normal/hover/light/promotion states; retain panelalpha.15, hairlineRGB, dimensions and link order. Evidence: output/menu-gold-matte-2026-11-17/;9browserprofiles andCSSlint pass. LocalCSS-only change.

## 2026-11-17 — Phone preview combines current local files with public weather reads

- User requested an iPhone link away from the computer. Reuse the existing supervised Quick Tunnel/public-read-only preview with source origin5502. Keep local assets/keyless maps, bridge only weather/reverse GET/HEAD to the fixed production service; authenticated Pages preview still uses its own API. No account settings, secrets or production deployment changes.
- Remote/supervisor suites18/18PASS and scopedESLint pass. External HTTPS checks verified latestCSS SHA256, maps/weather200, privateHEAD403/POST405 and current gold-menu render in390/DPR3 with no pageerrors. Public test point was Leipzig, not user geolocation. Evidence output/iphone-preview-2026-11-17/; runtime preview remains intentionally running for the user.

## 2026-11-17 — Faint daytime Moon, readable sky lane and75percent panel transparency

- Apply the daylight exposure to the whole lunar portrait, including the boundary indicator; floor.06 is a visual setting, not physical radiance. Remove the boundary exception to solar glare, preventing compressed display coordinates from creating a false eclipse. Preserve astronomy/time/phases/terrain and original sizes.
- Share actual-reading bounds in weather-sky-frame.js between both body views and fog; avoid stretched info-panel and display:contents containers. Keep original star/Sun/Moon/cloud/fog/text/rain layering and the existing clock.
- Latest menu request supersedes85percent: dark/light panelalpha.25 with existingblur1px; goldtilesalpha.25/textopacity1 and hairlineRGB remain. Local preview only. Target36/36 and broader248/248 tests plus scopedESLint/CSSlint pass; visual/delivery evidence is kept in output/sky-readable-2026-11-17/.

- Final visual QA additionally exposed a React reuse defect: a former recovery-toggle DIV can become the full weather card while retaining the contour module's data attribute/canvas. Validate the live semantic target in bind/tick/scan and scope decoration CSS to those targets; release stale canvas/attributes/observers. Do not use a button-tag guard because the real weather toggle is a DIV. RED reproduced deterministically, contour18/18 and combined267/267 PASS. The final sky lane measures actual text-node ranges, releases empty metric-container space in WebKit, and caches its local coordinates for optical frames. Evidence and precise rerun limits remain in the task report.

## 2026-11-17 — Precipitation rate contract and aligned weather readings

- Preserve original precipitation amounts and report interval seconds plus comparable mean mm/h separately. Unknown periods stay unknown; daily totals cannot act as current rates. Use original WMO categories for daily intensity and explicit hail evidence, including localized hail labels. Keep provider/model limitations distinct from what happens at the user's window.
- Reuse the existing native foreground canvas and successful-readiness suppression of legacy rain. Short optical trails, small heads and separate hail pellets replace long rigid strokes and invented bottom-of-sky impacts. Integrate movement over time so wind updates retain positions; retain existing visibility, reduced-motion and disposal behavior.
- Share the dropdown temperature font context with its raised Celsius unit; align condition and update copy against the number's top and bottom, and keep pressure units unbroken. Evidence and actual browser limitations belong to output/weather-precip-2026-11-17. Local changes only; no release was requested for this adjustment.
