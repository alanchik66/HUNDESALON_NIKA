# AI Mail Intake - 2026-05-12

## Source Emails Reviewed

- OpenRouter Team: data policies, feature updates, pricing levers, monthly recap.
- Linear: welcome/onboarding email.
- Ollama: Gemma 4 acceleration with MTP.

## What Is Useful For HUNDESALON_NIKA

### 1) OpenRouter data policy controls (high priority)

Why useful:
- Any future AI-assisted content or support workflow must protect customer and business data.

Applied decision:
- Use only providers with acceptable retention/training policies before sending non-public text.
- Treat OpenRouter provider choice as a privacy control, not only a performance choice.

Project action:
- Before enabling AI-driven workflows in production, create an allowlist of providers with acceptable policies.

### 2) OpenRouter cost levers (high priority)

Why useful:
- Reduces token cost for content generation tasks.

Applied decision:
- Prefer provider preferences and prompt caching where possible.
- Avoid spreading traffic across too many equivalent models if volume pricing is needed.

Project action:
- When adding AI utilities, include configurable provider preference and caching flags from day one.

### 3) OpenRouter features: streaming + structured outputs (medium priority)

Why useful:
- Structured outputs reduce post-processing errors in generated content.
- Streaming improves UX for long generations in admin tools.

Applied decision:
- For future internal tools, prefer schema-based responses over free-form text.

Project action:
- If an internal AI helper is added, design API wrappers around structured JSON outputs.

### 4) Ollama Gemma 4 acceleration (medium priority)

Why useful:
- Local/offline generation path can be faster and cheaper for drafts.

Applied decision:
- Keep Ollama as optional local fallback for drafting tasks, not as primary production dependency.

Project action:
- Evaluate only when there is a concrete local-generation workload.

### 5) Linear welcome email (low priority)

Why useful:
- Potential project tracking option, but no immediate operational need.

Applied decision:
- No immediate integration into current workflow.

Project action:
- Revisit only if task/issue volume grows and current planning process becomes a bottleneck.

## Mailbox Actions Applied

- Inbox was cleaned from these newsletters to keep operational mail visible.
- Relevant insights were captured in this document for implementation planning.
