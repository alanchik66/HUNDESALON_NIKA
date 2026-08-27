# Model Routing and Obsidian Workflow

## Context

The task was to define a practical model-selection policy, make it reusable, and keep it aligned with the Obsidian vault so the workflow stays consistent over time.

## Options

- Manual model choice per task.
- Static written routing rules only.
- A reusable router plus vault notes that document the policy.

## Decision

- Use a simple routing policy:
  - `gpt-5.3-codex-spark` for live coding and rapid UI iteration.
  - `gpt-5.6-sol` for complex, risky, or ambiguous tasks.
  - `gpt-5.6-terra` as the default for normal work.
  - `gpt-5.6-luna` for repeatable structured tasks.
- Keep the policy in Obsidian as an operational note and a decision note.
- Keep the reusable router in the deliverables area so it can be linked from the vault.

## Consequences

- The selection logic is documented in one place and reusable in code.
- Obsidian stays the source of truth for the workflow decision.
- Future changes can be made by updating the decision note and the routing note together.

## Follow-up

- Keep `02_Areas/Codex_Model_Routing.md` aligned with the router logic.
- Keep `Index.md` and `Operations.md` linked to the routing note.
- Mirror any future policy change into the deliverables if the code changes.

