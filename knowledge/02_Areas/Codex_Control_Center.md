# Codex Control Center

## Purpose

Single operational entry point for model routing, task intake, decisions, and verification.

## Start here

- [ ] Open this note first: `Codex Control Center`.
- [ ] Open [[01_Projects/HUNDESALON_NIKA/Tasks/README|Task Queue]] and choose the top open task.
- [ ] Confirm the task objective, acceptance criteria, constraints, risk, and suggested model.
- [ ] Perform the work and record changed files plus verification evidence in the task note.
- [ ] For major or high-risk work, complete the linked decision note in [[04_Decisions/Decisions|Decision Log]].
- [ ] Set `status: done` only after acceptance criteria and verification are complete.

Quick links: [[Dashboard]] | [[01_Projects/HUNDESALON_NIKA/Tasks/README|Task Queue]] | [[02_Areas/Codex_Model_Routing|Model Routing]] | [[04_Decisions/Decisions|Decision Log]]

## Current workflow

- Create new actionable work in the task queue.
- Let the task template suggest the model from task shape.
- Mark durable or high-risk work as major so it creates a decision note.
- Verify the result before closing the task.

## Model defaults

- `gpt-5.3-codex-spark` for live coding and rapid UI iteration.
- `gpt-5.6-sol` for complex or risky work.
- `gpt-5.6-terra` for standard work.
- `gpt-5.6-luna` for repetitive structured tasks.

## Safety checks

- Keep private browser state out of the vault.
- Keep decisions short and factual.
- Record verification next to the change.

## Status

- Task routing: ready
- Decision auto-generation: ready
- Vault navigation: ready
- Direct GUI control: available when `computer-use` is active; verified 2026-08-27
