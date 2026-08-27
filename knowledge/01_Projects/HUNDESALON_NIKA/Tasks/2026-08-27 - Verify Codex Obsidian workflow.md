---
type: task
status: open
created: 2026-08-27
kind: live_coding
urgency: medium
risk: low
major_change: false
suggested_model: gpt-5.3-codex-spark
tags: [task, routing, test]
---

# Task - Verify Codex Obsidian workflow

## Objective
Confirm the live workflow from task intake to model choice, documentation, and verification inside Obsidian.

## Context
- Current behavior: routing rules, Templater automation, and the Control Center are configured.
- Relevant files or links: [[02_Areas/Codex_Control_Center]], [[02_Areas/Codex_Model_Routing]], [[Templates/task]].

## Acceptance criteria
- [x] This note opens correctly in Obsidian.
- [x] The suggested model is visible and matches the task type.
- [x] The Control Center checklist leads to the Task Queue.
- [ ] Creating another note in this folder starts the task template automatically.

## Constraints
- Preserve existing vault content and project files.
- Do not create a commit, push, or deployment.

## Suggested model
- `gpt-5.3-codex-spark`
- Reason: fast interactive verification with a short feedback loop and low risk.

## Scope
- In scope: Obsidian navigation, task template, routing suggestion, and visible rendering.
- Out of scope: website code, deployment, external accounts, and secrets.

## Plan
- [ ] Open [[02_Areas/Codex_Control_Center]].
- [ ] Follow the `Start here` checklist to this task.
- [ ] Review this note in reading mode.
- [ ] Create a temporary new task note and confirm that Templater prompts appear.

## Result
- Status: ready for live verification.
- Changed files: Control Center, task template, and this example task.
- User-visible change: one guided entry point and one filled working example.

## Verification
- Commands/checks: Markdown structure and Templater configuration inspected locally; live Obsidian navigation checked.
- Evidence: `Control Center -> Task Queue -> this task` opened successfully; Dataview listed this task; properties displayed `gpt-5.3-codex-spark`.

## Residual risks
- The Templater creation prompts still require a separate live smoke test when the next real task note is created.

## Notes
- This is a safe test task. Mark it `done` after the live smoke test succeeds.
