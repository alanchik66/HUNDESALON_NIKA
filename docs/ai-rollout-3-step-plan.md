# AI Rollout Plan (3 Steps)

## Step 1 - OpenRouter Cost-Control + Caching
Status: implemented in proxy.

### What is included
- Provider defaults from environment.
- Safe fallback model retry on 429/5xx.
- Optional proxy response cache for non-streaming requests.

### Success criteria
- Stable responses under rate-limit pressure.
- Reduced duplicate request cost.
- Controlled provider routing behavior.

## Step 2 - Ollama MTP Mini Pilot
Status: ready to run.

### What is included
- Automated pilot script with latency tracking.
- Markdown report generation for decision review.

### Run
```powershell
powershell -ExecutionPolicy Bypass -File tools/ollama-mtp-pilot.ps1
```

### Success criteria
- Pilot report generated.
- Median latency acceptable for internal draft tasks.
- Output quality acceptable for assisted content drafts.

## Step 3 - Linear Process for AI Updates
Status: process documentation added.

### What is included
- Formal triage and decision flow.
- Priority model and Definition of Done.

### Success criteria
- Each AI update logged as a Linear issue.
- Decision transparency: adopt now, pilot first, or park.
- Post-release review completed with metrics.

## Production Rollout Sequence
1. Enable OpenRouter cache and provider defaults in staging.
2. Execute Ollama pilot and review generated report.
3. Apply Linear process as mandatory gate for future AI changes.
