# Memory Bank protocol (all Flow modes)

Persistent context: `memory-bank/` (RooFlow). Upstream: [GreatScottyMac/RooFlow](https://github.com/GreatScottyMac/RooFlow).

| File | Role |
|------|------|
| `productContext.md` | Product goals, features, architecture |
| `activeContext.md` | Current focus, recent changes, open questions |
| `progress.md` | Completed / current / next |
| `decisionLog.md` | Architecture decisions + rationale |
| `systemPatterns.md` | Coding / arch / test patterns |

## Session start (non-trivial work)

1. If `memory-bank/` is missing, offer to create stubs (Architect owns init) — do not invent product facts.
2. Otherwise read at least `activeContext.md` + `productContext.md` (and patterns/decisions when relevant).
3. Prefix the **first** reply of a Flow session with `[MEMORY BANK: ACTIVE]` or `[MEMORY BANK: INACTIVE]`.

## Updates (UMB)

When the user says **Update Memory Bank**, **UMB**, or after a meaningful decision/milestone:

1. Append a timestamped note (`YYYY-MM-DD HH:MM:SS`) — do not rewrite whole files.
2. Route: decisions → `decisionLog.md`; focus → `activeContext.md`; tasks → `progress.md`; patterns → `systemPatterns.md`.

Do not contradict `AGENTS.md` or `memory-bank/productContext.md`.
