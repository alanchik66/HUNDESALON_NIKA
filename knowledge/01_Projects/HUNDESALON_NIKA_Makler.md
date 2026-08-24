---
project: HUNDESALON_NIKA
system: n8n-makler
status: active
owner_language: ru
landlord_language: de
---

# HUNDESALON_NIKA Makler

## Purpose

AI-assisted search for a suitable commercial rental in Leipzig-Stötteritz and relevant neighbouring districts. Operational state remains in n8n Data Tables. This note stores stable rules and decisions so prompts do not need to repeat the same context.

## Hard search gates

- Complete monthly rent: at most 800 EUR.
- Effective usable area: at most 70 m².
- Unknown complete rent or area: never shortlist automatically.
- Geography: Stötteritz first, then explicitly accepted neighbouring districts and postal codes.
- Suitability must cover water and wastewater feasibility, WC, ventilation, noise tolerance, commercial use permission, visibility, access and parking.

## Communication contract

- Owner conversation: Russian.
- Landlord conversation: concise, individualized German.
- Primary objective: obtain a viewing appointment and create a calm, credible business impression.
- Tone: tactful and moderately polite; no inflated courtesy and no long marketing text.
- Do not deliberately introduce grammar mistakes and do not claim to be a human.
- Every landlord message, including each follow-up, needs owner approval for the exact recipient and exact text.
- A personal inbound landlord reply is reported immediately in Telegram before any draft or reply.
- After exact approval, n8n waits a random 2-15 minutes before sending, then reloads and revalidates the approval and message hash.

## Model and cost routing

- Deterministic n8n code: schedules, hard criteria, deduplication, hashing, approval gates, delays, CRM and audit.
- Kilo free: public listing synthesis, scoring assistance and non-confidential owner summaries after strict redaction.
- Never send personal email bodies, private contact data, secrets or confidential documents to a free Kilo model.
- OpenAI `gpt-5.6-luna`: cost-capped fallback only for ambiguous or high-stakes personal landlord replies after data minimization.
- If AI output is missing, malformed or uncited, fail closed and do not write it to CRM or correspondence.

## Operational source of truth

- n8n Data Tables: listings, outreach, thread state, approvals and audit events.
- Obsidian: stable policies, criteria, reusable phrasing principles and human decisions.
- No API keys, passwords, OTP codes or full private correspondence in this vault.

## Related

- [[HUNDESALON_NIKA]]
- [[../../Templates/makler-listing]]
- [[../../Templates/makler-conversation]]
