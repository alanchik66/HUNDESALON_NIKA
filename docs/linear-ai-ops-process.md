# Linear AI Ops Process

## Goal
A single operational flow for AI updates and production adoption decisions.

## Team Cadence
- Intake window: daily.
- Prioritization: 2 times per week.
- Implementation review: weekly.

## Workflow
1. Intake
- Source: AI vendor emails, changelog posts, docs updates.
- Rule: each relevant update gets one Linear issue.

2. Triage
- Labels: ai-update, ai-cost, ai-reliability, ai-experiment.
- Severity:
  - P1: direct production impact (security, cost spike, outage risk).
  - P2: measurable improvement in quality/cost/latency.
  - P3: exploratory or long-term opportunity.

3. Decision
- Decision fields in issue:
  - Adopt now
  - Pilot first
  - Park
- Required notes:
  - expected business value
  - risk profile
  - rollback condition

4. Delivery
- Branch naming: feat/ai-<topic>
- PR must include:
  - implementation details
  - test evidence
  - observability notes
  - fallback strategy

5. Post-implementation Review
- SLA check after release (24-72h):
  - errors
  - latency
  - token cost
  - user-facing quality

## Issue Template (Recommended)
- Summary
- Source link/email
- Impact area (site, API, content pipeline)
- Benefit estimate
- Risk estimate
- Decision (Adopt now | Pilot first | Park)
- Validation plan
- Rollback plan

## Definition of Done
- Linear issue has clear decision and owner.
- Change merged with verification evidence.
- Post-release metrics recorded in issue comments.
