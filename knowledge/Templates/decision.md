<%*
const raw = tp.file.content ?? "";
if (raw.includes("auto_generated: true")) {
  tR = raw;
} else {
  const date = tp.date.now("YYYY-MM-DD");
  const title = tp.file.title;
  tR = `---
type: decision
status: draft
created: ${date}
linked_task:
suggested_model:
tags: [decision, log]
---

# Decision - ${title}

## Context
-

## Options
-

## Decision
-

## Consequences
-

## Follow-up
- [ ]
`;
}
%>
