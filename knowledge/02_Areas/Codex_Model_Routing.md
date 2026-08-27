# Codex Model Routing

## Purpose

Use the smallest model that can reliably complete the task, and escalate only when the task is complex, ambiguous, risky, or high-value.

## Routing rules

- `gpt-5.3-codex-spark` for live coding, quick UI fixes, and rapid iteration.
- `gpt-5.6-sol` for complex, ambiguous, multi-step, or high-risk work.
- `gpt-5.6-terra` for ordinary day-to-day implementation work.
- `gpt-5.6-luna` for repetitive, deterministic, structured tasks.

## Operating rule

- Start with `gpt-5.6-terra` when the task is not clearly simple or clearly hard.
- Escalate to `gpt-5.6-sol` when correctness depends on deeper reasoning.
- Downgrade to `gpt-5.6-luna` when the task is a known-format transformation.
- Use `gpt-5.3-codex-spark` only when the priority is the fastest possible iteration loop.

## Obsidian workflow

- Keep this note linked from the decision log and index.
- Create new task notes in [[01_Projects/HUNDESALON_NIKA/Tasks/README]].
- Record future changes to the routing policy as a decision note first.
- Keep code examples or reusable logic in `outputs/` and link them back here.
