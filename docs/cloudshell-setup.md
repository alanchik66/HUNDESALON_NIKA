# Google Cloud Shell Setup Guide – HUNDESALON_NIKA

## 🚀 Quick Start in Cloud Shell

This guide provides step-by-step commands to set up, validate, and deploy the HUNDESALON_NIKA project from Google Cloud Shell.

### Prerequisites

- Google Cloud Shell access (already available at https://shell.cloud.google.com)
- GitHub repository access: https://github.com/alanchik66/HUNDESALON_NIKA.git
- Cloudflare Pages project configured (hundesalon-nika)
- Cloudflare Pages API token ready

---

## Step 1: Clone the Repository

```bash
cd ~ && git clone https://github.com/alanchik66/HUNDESALON_NIKA.git
cd HUNDESALON_NIKA
```

**Expected output:**

```
Cloning into 'HUNDESALON_NIKA'...
remote: Enumerating objects: ...
remote: Counting objects: 100% ...
Resolving deltas: 100% ...
```

---

## Step 2: Install Dependencies

```bash
npm install
```

**Expected output:**

```
added X packages, and audited Y packages in Zs
packages found with no vulnerabilities
```

> **Note:** This may take 2-3 minutes. Cloud Shell instances have plenty of disk space, so no worries about storage.

---

## Step 3: Validate Project

```bash
npm run validate
```

**Expected output:**

```
> npm run lint
> npm run lint:html && npm run lint:css && npm run lint:js
...
Scanned 62 files, no errors found.
...
> npm run check:links
Local links and asset references are valid.

> npm run check:project
Project configuration checks passed.
```

> All 3 sub-tasks should pass (HTML lint, CSS lint, JS lint, links, project config).

---

## Step 4: Build Production Bundle

```bash
npm run build
```

**Expected output:**

```
> npm run validate (runs again as part of build)
> npm run build:production
Building production bundle...
dist/ directory created with optimized assets
```

> Build typically takes 10-20 seconds.

---

## Step 5: Authenticate with Cloudflare

```bash
npx wrangler login
```

**Expected output:**

```
 ⛅ wrangler 4.87.0
✔ Enter your email: [your-email@example.com]
✔ Enter your password: [hidden]
✨ Authenticated successfully!
```

> You will need your Cloudflare account credentials.

---

## Step 6: Deploy to Cloudflare Pages

```bash
npm run deploy
```

**Expected output:**

```
> npm run build && wrangler pages deploy dist --project-name=hundesalon-nika
(validation and build output)
✨ Successfully deployed to: https://hundesalon-nika.com
Deployment ID: xxxxx-xxxxx-xxxxx-xxxxx
```

> Deployment typically takes 1-2 minutes.

---

## Step 7: Verify Deployment

```bash
npx wrangler pages deployments list --project-name=hundesalon-nika
```

**Expected output:**

```
┌────────┬─────────────────────────────────────┬─────────────────┐
│ Status │ Deployment ID                       │ Created on      │
├────────┼─────────────────────────────────────┼─────────────────┤
│ Active │ xxxxx-xxxxx-xxxxx-xxxxx (latest)   │ 2 minutes ago   │
└────────┴─────────────────────────────────────┴─────────────────┘
```

---

## Post-Deployment Verification

### Test 1: Check Main Site

```bash
curl -s https://hundesalon-nika.com/ru/index.html | head -20
```

Should return HTML with site structure.

### Test 2: Check OpenRouter Endpoint

```bash
curl -X POST https://hundesalon-nika.com/openrouter \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-4","messages":[{"role":"user","content":"test"}]}' \
  | head
```

Expected response:

```json
{
  "error": "OPENROUTER_API_KEY is not configured"
}
```

> This is expected — the API key is a secret in Cloudflare env. The endpoint is working if it responds (not a network error).

### Test 3: Check SEO Endpoint

```bash
curl -X POST https://hundesalon-nika.com/seo-generate \
  -H "Content-Type: application/json" \
  -d '{"pageType":"service","service":"test"}' \
  | head
```

Expected response:

```json
{
  "error": "OPENROUTER_API_KEY is not configured"
}
```

> Same as above — endpoint is working if it responds.

---

## Troubleshooting

### Issue: `npm: command not found`

**Solution:**

```bash
# Cloud Shell should have Node.js pre-installed. Try:
node --version
npm --version

# If not found, install:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
```

### Issue: `wrangler: command not found`

**Solution:**

```bash
# Use npx instead:
npx wrangler --version
npx wrangler login
npm run deploy
```

### Issue: Build fails with "dist/ already exists"

**Solution:**

```bash
rm -rf dist/
npm run build
```

### Issue: Authentication fails

**Solution:**

```bash
# Clear stored credentials
rm ~/.wrangler/config.json

# Try again
npx wrangler login
```

### Issue: Deployment says "Project not found"

**Solution:**
Verify project name in `wrangler.toml`:

```bash
grep project_name wrangler.toml
```

Should show:

```
project_name = "hundesalon-nika"
```

---

## All-in-One Command

To run everything in one go (after cloning):

```bash
cd HUNDESALON_NIKA && \
npm install && \
npm run validate && \
npm run build && \
npx wrangler login && \
npm run deploy && \
echo "✅ Deployment complete!"
```

---

## Useful Commands Reference

| Command                                                              | Purpose                        |
| -------------------------------------------------------------------- | ------------------------------ |
| `npm run dev`                                                        | Local preview (port 5502)      |
| `npm run lint`                                                       | Check HTML, CSS, JS for errors |
| `npm run validate`                                                   | Full project validation        |
| `npm run build`                                                      | Create production bundle       |
| `npm run deploy`                                                     | Deploy to Cloudflare Pages     |
| `npx wrangler pages deployments list --project-name=hundesalon-nika` | View deployment history        |

---

## Environment Variables (Already Set in Cloudflare)

These are configured in Cloudflare Pages secrets:

- `OPENROUTER_API_KEY` – OpenRouter API authentication
- `OPENROUTER_SITE_URL` – Site URL for attribution
- `OPENROUTER_SITE_NAME` – Site name for attribution
- `OPENROUTER_DEFAULT_MODEL` – Primary model (openai/gpt-5.2)
- `OPENROUTER_FALLBACK_MODEL` – Fallback model (openai/gpt-4.1-mini)

> No need to set these manually in Cloud Shell — they're baked into Cloudflare.

---

## Support

If you encounter any issues:

1. Check the error message carefully
2. Run `npm run validate` to catch configuration issues
3. Review [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md)
4. Check [docs/openrouter-quickstart-setup.md](../docs/openrouter-quickstart-setup.md)

---

**Created:** 2026-05-12
**Status:** Ready for production deployment
