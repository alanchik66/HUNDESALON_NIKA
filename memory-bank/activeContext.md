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

- Await the physical iPhone report: fallback state, shader compilation/linking, exterior light pixels, and ancestor clipping. Do not assume a cause from the screenshot or treat `sunScene=ready` alone as render proof.
