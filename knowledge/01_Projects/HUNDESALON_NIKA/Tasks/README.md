# Task Queue

Use this folder for active task notes.

## Workflow

- Create a new note in this folder.
- Templater applies `Templates/task.md` automatically.
- The template suggests a model from task shape.
- Mark a task as major when it needs a durable decision.
- Major tasks auto-create a linked decision note in `04_Decisions`.
- The decision template preserves auto-generated decision content without re-templating it.

## Routing source

- [[02_Areas/Codex_Model_Routing]]

## Decision log

- [[04_Decisions/Decisions]]

## Open tasks

```dataview
LIST
FROM "01_Projects/HUNDESALON_NIKA/Tasks"
WHERE status = "open"
SORT file.mtime DESC
```
