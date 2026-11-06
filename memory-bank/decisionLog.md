# Decision Log

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
