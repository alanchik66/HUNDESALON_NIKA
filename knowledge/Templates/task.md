<%*
const title = tp.file.title;
const created = tp.date.now("YYYY-MM-DD");
const createdStamp = tp.date.now("YYYY-MM-DD_HHmmss");
const kindLabels = [
  "Live coding / UI",
  "Complex analysis",
  "Daily work",
  "Repetitive / structured",
];
const kindValues = [
  "live_coding",
  "complex_analysis",
  "daily_work",
  "repetitive_structured",
];
const kind = await tp.system.suggester(kindLabels, kindValues);
const urgency = await tp.system.suggester(["Low", "Medium", "High"], ["low", "medium", "high"]);
const risk = await tp.system.suggester(["Low", "Medium", "High"], ["low", "medium", "high"]);
const major = await tp.system.suggester(["No", "Yes"], [false, true]);
const objective = (await tp.system.prompt("One-line objective", "")) || "";

const routeModel = () => {
  if (major || risk === "high" || kind === "complex_analysis") {
    return "gpt-5.6-sol";
  }
  if (kind === "live_coding" || urgency === "high") {
    return "gpt-5.3-codex-spark";
  }
  if (kind === "repetitive_structured") {
    return "gpt-5.6-luna";
  }
  return "gpt-5.6-terra";
};

const suggestedModel = routeModel();
const safeTitle = title.replace(/[\\/:*?"<>|]/g, "").trim() || "untitled-task";
const decisionFileStem = `${createdStamp} - ${safeTitle}`;
const decisionPath = `04_Decisions/${decisionFileStem}.md`;
let decisionLink = "";

if (major) {
  const decisionContent = `---
type: decision
status: draft
created: ${created}
auto_generated: true
linked_task: "[[${title}]]"
suggested_model: "${suggestedModel}"
tags: [decision, routing]
---

# Decision - ${title}

## Context
${objective ? `- ${objective}` : "-"}

## Options
- Manual model choice
- Routing policy
- Auto-generated decision note

## Decision
-

## Consequences
-

## Follow-up
- [ ]
`;

  if (!app.vault.getAbstractFileByPath(decisionPath)) {
    await tp.file.create_new(decisionContent, decisionFileStem, false, "04_Decisions");
  }

  decisionLink = `[[04_Decisions/${decisionFileStem}]]`;
}

tR = `---
type: task
status: open
created: ${created}
kind: ${kind}
urgency: ${urgency}
risk: ${risk}
major_change: ${major}
suggested_model: ${suggestedModel}
${decisionLink ? `decision_note: "${decisionLink}"\n` : ""}tags: [task, routing]
---

# Task - ${title}

## Objective
${objective || "-"}

## Context
- Current behavior:
- Relevant files or links:

## Acceptance criteria
- [ ] Requested behavior is implemented.
- [ ] Relevant checks pass.
- [ ] User-visible behavior is verified when applicable.

## Constraints
- Preserve unrelated changes.
- No commit, push, dependency, or deployment changes unless explicitly requested.

## Suggested model
- ${suggestedModel}

## Scope
- In scope:
- Out of scope:

## Plan
- [ ] Inspect the smallest relevant context.
- [ ] Implement the minimal complete change.
- [ ] Run focused verification.

## Result
- Status:
- Changed files:
- User-visible change:

## Verification
- Commands/checks:
- Evidence:

## Residual risks
- None known.

## Notes
-
`;
%>
