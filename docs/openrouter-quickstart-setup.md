# OpenRouter Quickstart Setup (Project)

This setup follows OpenRouter Quickstart and is adapted for Cloudflare Pages Functions in this repository.

## What Was Added

- Secure proxy endpoint: `POST /openrouter`
- Function file: `functions/openrouter.js`
- OpenRouter key stays server-side in Cloudflare env variables.
- Contact forms now include an `AI draft` helper button that fills the message field via `/openrouter`.

## Cloudflare Configuration

Set these variables in Cloudflare Pages:

Required (Cloudflare Pages, Cursor Cloud Agents, or `.dev.vars`):

- `OPENROUTER_API_KEY` = **inference** API key from [OpenRouter Keys](https://openrouter.ai/keys) (not a management/provisioning key — those cannot call chat completions)

Optional — only if you need to override code defaults in `functions/openrouter.js` / `functions/seo-generate.js`:

- `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME` (attribution headers; defaults: request origin + `HUNDESALON NIKA`)
- `OPENROUTER_DEFAULT_MODEL` (default: `openai/gpt-5.5`)
- `OPENROUTER_FALLBACK_MODEL` (default: `openai/gpt-5.2`)
- `OPENROUTER_PROVIDER_ORDER`, `OPENROUTER_PROVIDER_SORT`, `OPENROUTER_ALLOW_FALLBACKS`, `OPENROUTER_ENABLE_RESPONSE_CACHE`, `OPENROUTER_CACHE_TTL_SECONDS`

Recommended model presets (optional):

- Fast draft: `deepseek/deepseek-chat-v4:free` (or your paid DeepSeek V4 Flash route)
- Higher-quality draft: `deepseek/deepseek-chat-v4`
- Low-latency multilingual: `google/gemini-2.5-flash`

Do not duplicate these in Cursor secrets unless you intentionally override defaults. See [cursor-cloud-secrets.md](./cursor-cloud-secrets.md) for what to keep in Cloud Agents.

## Request Format

Endpoint:

- `POST /openrouter`

Body (JSON):

```json
{
  "model": "openai/gpt-5.5",
  "messages": [{ "role": "user", "content": "Сделай краткое описание услуги тримминга на немецком" }]
}
```

Streaming is supported by passing:

```json
{
  "model": "openai/gpt-5.5",
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
    "model": "openai/gpt-5.5",
    "messages": [{"role":"user","content":"Напиши 3 варианта короткого CTA для записи на груминг"}]
  }'
```

## Integration Notes

- Do not expose `OPENROUTER_API_KEY` in frontend code.
- Frontend should call only `/openrouter`.
- Payload is OpenAI-compatible `chat/completions` format from OpenRouter Quickstart.
- Proxy applies safety limits for message count and message size.
- If OpenRouter returns `429` or `5xx`, proxy can auto-retry with `OPENROUTER_FALLBACK_MODEL`.

### Cost-Control Defaults

- The proxy can apply provider defaults from environment variables.
- You can still override provider routing per request via request body `provider`.

Example body:

```json
{
  "model": "openai/gpt-5.5",
  "provider": {
    "sort": "price",
    "allow_fallbacks": true
  },
  "messages": [{ "role": "user", "content": "Сделай короткий текст для карточки услуги" }]
}
```

### Proxy Response Caching

- Cache works only for non-streaming requests.
- Enable globally with `OPENROUTER_ENABLE_RESPONSE_CACHE=true`.
- You can force cache per request with `"cache": true`.
- Optional per-request TTL: `"cache_ttl_seconds": 120`.

Example cache-enabled body:

```json
{
  "model": "openai/gpt-5.5",
  "cache": true,
  "cache_ttl_seconds": 180,
  "messages": [{ "role": "user", "content": "Напиши 3 коротких CTA" }]
}
```

## LG Task Webhook (new)

For dashboard-driven flows you can call:

- `POST /lg-task`

Optional auth secret (recommended for external webhooks):

- `LG_TASK_WEBHOOK_SECRET` (send as `Authorization: Bearer <secret>`)

Supported tasks:

- `ping`
- `openrouter.chat` (forwards payload to `/openrouter`)
- `seo.generate` (forwards payload to `/seo-generate`)

Example:

```bash
curl -X POST http://localhost:5502/lg-task \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SECRET" \
  -d '{
    "task": "openrouter.chat",
    "payload": {
      "model": "openai/gpt-5.5",
      "messages": [{"role":"user","content":"Сделай 2 варианта краткого CTA"}]
    }
  }'
```

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
