# OpenRouter Quickstart Setup (Project)

This setup follows OpenRouter Quickstart and is adapted for Cloudflare Pages Functions in this repository.

## What Was Added

- Secure proxy endpoint: `POST /openrouter`
- Function file: `functions/openrouter.js`
- OpenRouter key stays server-side in Cloudflare env variables.
- Contact forms now include an `AI draft` helper button that fills the message field via `/openrouter`.

## Cloudflare Configuration

Set these variables in Cloudflare Pages:

Required:

- `OPENROUTER_API_KEY` = your OpenRouter API key

Recommended:

- `OPENROUTER_SITE_URL` = `https://hundesalon-nika.com`
- `OPENROUTER_SITE_NAME` = `HUNDESALON NIKA`

Future-ready (recommended):

- `OPENROUTER_DEFAULT_MODEL` = `openai/gpt-5.2`
- `OPENROUTER_FALLBACK_MODEL` = `openai/gpt-4.1-mini`

Why recommended:

- OpenRouter Quickstart marks `HTTP-Referer` and `X-OpenRouter-Title` as optional attribution headers.
- This function sends them automatically from the env values above.

## Request Format

Endpoint:

- `POST /openrouter`

Body (JSON):

```json
{
  "model": "openai/gpt-5.2",
  "messages": [{ "role": "user", "content": "Сделай краткое описание услуги тримминга на немецком" }]
}
```

Streaming is supported by passing:

```json
{
  "model": "openai/gpt-5.2",
  "messages": [{ "role": "user", "content": "..." }],
  "stream": true
}
```

## Local Test

Start local server:

```bash
npm run dev
```

Then call:

```bash
curl -X POST http://localhost:5502/openrouter \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-5.2",
    "messages": [{"role":"user","content":"Напиши 3 варианта короткого CTA для записи на груминг"}]
  }'
```

## Integration Notes

- Do not expose `OPENROUTER_API_KEY` in frontend code.
- Frontend should call only `/openrouter`.
- Payload is OpenAI-compatible `chat/completions` format from OpenRouter Quickstart.
- Proxy applies safety limits for message count and message size.
- If OpenRouter returns `429` or `5xx`, proxy can auto-retry with `OPENROUTER_FALLBACK_MODEL`.

## Included UX Feature

- On pages with `form[action="/sendmail"]` and a message textarea, users get a localized AI button:
  - RU: `Сгенерировать черновик`
  - UK: `Згенерувати чернетку`
  - EN: `Generate draft`
  - DE: `Entwurf generieren`

- The button creates a concise, polite message draft and inserts it into the form.

## Future-ready SEO Endpoint

A dedicated internal endpoint is now available for multilingual SEO generation with strict JSON output.

Endpoint:

- `POST /seo-generate`

Function file:

- `functions/seo-generate.js`

Input body example:

```json
{
  "pageType": "service page",
  "service": "Dog grooming",
  "topic": "Premium grooming and hygiene in Leipzig",
  "city": "Leipzig",
  "brand": "HUNDESALON NIKA",
  "usp": "Calm handling, transparent pricing, personal care"
}
```

Response shape:

- `locales.de|en|ru|uk.title`
- `locales.de|en|ru|uk.description`
- `locales.de|en|ru|uk.h1`
- `locales.de|en|ru|uk.shortBlock`
- `snippets.*` with ready HTML tags for direct insertion

Quick local test:

```bash
curl -X POST http://localhost:5502/seo-generate \
  -H "Content-Type: application/json" \
  -d '{
    "pageType":"service page",
    "service":"Cat grooming",
    "topic":"Safe cat grooming in Leipzig",
    "city":"Leipzig",
    "brand":"HUNDESALON NIKA"
  }'
```
