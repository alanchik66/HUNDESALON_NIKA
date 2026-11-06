# Active Context

## Current Focus

- Diagnose missing solar rays on the physical iPhone before changing rendering again.
- Keep RooFlow, Graphify, lean-ctx, and VS Code agent integrations compatible.
- Preserve existing user changes in the working tree.
- Avoid duplicate or contradictory MCP registrations.

## Current State

- On 2026-11-06, release `4699df0` shows service glass on the user's iPhone, but the Sun still appears without rays. The signed-Gaussian GLSL fix alone did not resolve the reported device issue.
- Windows WebKit/Chromium render the effects; this is not proof of the physical Apple GPU result. The opt-in `solar-check=1` module measures the existing renderer without sending reports or reading location, storage, or chat data.
- RooFlow uses upstream Roo Code modes in `.roomodes` and `.roo/system-prompt-flow-*`.
- VS Code/Copilot uses the adapted skills in `.agents/skills/flow-*`.
- Project-specific Roo rules and commands remain in `.roo/rules/` and `.roo/commands/`.

## Open Questions

- Capture the specific initialization failure on the physical iPhone. Do not assume a cause from the screenshot or treat `sunScene=ready` alone as render proof.

## 2026-11-06 11:03:28 UTC — physical device evidence

- The user's `02bf393` report confirms `sunScene=failed`, no retained scene or shader programs, original texture ready, and the unresized canvas backing `300x150`. The visible white disc is the recovery image, not the working 3D Sun.
- This localizes the failure before the first resize: import/evaluation, constructor, WebGL creation, texture load/decode/upload, or scene setup. Ancestor clipping and the `site-perf-lite` class do not explain this result. Windows WebKit/Chromium cannot reproduce the initialization failure.
- The first diagnostic omitted the caught exception. Add stage and safe failure details before changing rendering. The prior Netlify 404 was reported for the correct URL but was not reproduced; current canonical asset/locale checks passed, and the subsequent physical report proves the diagnostic page loaded.
