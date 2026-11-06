# Active Context

## Current Focus

- Fix the confirmed WebGL initialization failure and closed-menu renderer leak while preserving the 3D Sun and original texture.
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

- Confirm the compatibility retry on the user's physical iPhone after publication. Windows browser checks cannot establish the Apple GPU result.

## 2026-11-06 11:03:28 UTC — physical device evidence

- The user's `02bf393` report confirms `sunScene=failed`, no retained scene or shader programs, original texture ready, and the unresized canvas backing `300x150`. The visible white disc is the recovery image, not the working 3D Sun.
- This localizes the failure before the first resize: import/evaluation, constructor, WebGL creation, texture load/decode/upload, or scene setup. Ancestor clipping and the `site-perf-lite` class do not explain this result. Windows WebKit/Chromium cannot reproduce the initialization failure.
- The first diagnostic omitted the caught exception. Add stage and safe failure details before changing rendering. The prior Netlify 404 was reported for the correct URL but was not reproduced; current canonical asset/locale checks passed, and the subsequent physical report proves the diagnostic page loaded.

## 2026-11-06 — WebGL failure and resource lifecycle

- The physical `5dae581` report identifies `initializationStage=renderer-create` and `Error creating WebGL context.` in a separate Safari or Chrome app. Texture loading, shaders, clipping, and ray brightness are not the failing operation. The native refusal's underlying hardware/browser cause remains unproven.
- WebKit and Chromium reproduce an independent leak: each closed weather menu retains a detached running Sun renderer. Removal/unmount cleanup now disposes those resources; a detached pending Sun also releases its context before texture decoding completes.
- The Sun now tries the existing WebGL2 profile, then a bounded retry without MSAA using default GPU preference. The latter uses doubled backing resolution for smooth edges, the same 4096x2048 source texture and unchanged 3D effects. It is a compatibility fix to verify on the phone, not proof that every WebGL refusal is resolved.
