# Ollama Local Model Profiles (HUNDESALON_NIKA)

## Why this exists

This file defines a practical model policy for local Ollama generation tasks in this project.
The goal is to choose the right profile by task priority: quality, balanced speed, or fast draft.

## Recommended profiles

- Quality profile:
  - Model: `gemma4:latest`
  - Use for: final copy for pages, SEO text that goes to production
  - Tradeoff: best wording quality, but highest latency and occasional empty responses in latest run

- Balanced profile:
  - Model: `qwen2.5:7b`
  - Use for: first full drafts that will still be edited by human
  - Tradeoff: stable generation and good speed, quality is acceptable but still requires editor review

- Fast profile:
  - Model: `phi4-mini:latest`
  - Use for: idea generation, rough structure, quick smoke checks
  - Tradeoff: fastest but can produce weak domain language

## Latest benchmark snapshot (2026-05-15)

- `gemma4:latest`: avg 183.35s, Success 1/3 in current profile run (2 empty outputs)
- `qwen2.5:7b`: avg 101.13s, Success 3/3, best stability/speed ratio
- `phi4-mini:latest`: avg 44.5s, Success 3/3, but noticeably weaker content quality

## Default policy (active)

- Default npm command `ai:pilot:ollama` points to `balanced` profile (`qwen2.5:7b`).
- Use `quality` only when preparing near-final text for manual polishing.
- Use `fast` only for ideation and structure drafts.

## NPM commands

- `npm run ai:pilot:ollama:quality`
- `npm run ai:pilot:ollama:balanced`
- `npm run ai:pilot:ollama:fast`
- `npm run ai:pilot:ollama:compare`
- `npm run ai:pilot:ollama` (alias to `balanced`)
- `npm run ai:pilot:ollama:custom` (manual model/options)

## Output files

- `docs/ollama-mtp-pilot-gemma4.md`
- `docs/ollama-mtp-pilot-qwen2.5-7b.md`
- `docs/ollama-mtp-pilot-phi4-mini.md`

## Generation controls

The pilot script supports these controls:

- `NumPredict` limits response length and helps reduce runtime.
- `Temperature` keeps outputs stable for website content.
- `TopP` limits token spread for cleaner phrasing.

Default values in script are intentionally conservative for business content.
