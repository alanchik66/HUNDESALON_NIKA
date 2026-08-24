# Dashboard

## Today
- [[Daily/2026-08-24|Open today's daily note]]

## Project surface
- [[01_Projects/HUNDESALON_NIKA]]
- [[05_Code_Map]]
- [[06_QA]]
- [[07_Release]]

## Quick context
- Brand and public contact live in [[03_Resources/Brand_Assets]].
- Decision history lives in [[04_Decisions/README]].
- Workflow rules live in [[02_Areas/Operations]].

## Open tasks
```dataview
TASK
FROM "01_Projects" OR "02_Areas" OR "04_Decisions" OR "06_QA" OR "07_Release"
WHERE !completed
SORT file.mtime DESC
```

## Recent changes
```dataview
LIST
FROM "01_Projects" OR "02_Areas" OR "03_Resources" OR "04_Decisions" OR "05_Code_Map" OR "06_QA" OR "07_Release"
SORT file.mtime DESC
LIMIT 10
```

