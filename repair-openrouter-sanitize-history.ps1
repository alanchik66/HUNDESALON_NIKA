<# 
HUNDESALON NIKA — repair public service wording, local config, and optional clean git history.

Default repo path:
  C:\laragon\www\HUNDESALON_NIKA

Typical full run:
  powershell -ExecutionPolicy Bypass -File .\repair-openrouter-sanitize-history.ps1 -DeepRepoSanitize -SetCloudflareSecrets -RewriteHistory -PushRemotes -DeleteRemoteBranchesAndTags

Safer first run without rewriting history:
  powershell -ExecutionPolicy Bypass -File .\repair-openrouter-sanitize-history.ps1 -DeepRepoSanitize -SetCloudflareSecrets
#>

[CmdletBinding()]
param(
  [string]$RepoPath = 'C:\laragon\www\HUNDESALON_NIKA',
  [switch]$SkipFixes,
  [switch]$DeepRepoSanitize,
  [switch]$SetCloudflareSecrets,
  [switch]$RewriteHistory,
  [switch]$PushRemotes,
  [switch]$DeleteRemoteBranchesAndTags,
  [switch]$Deploy,
  [switch]$DeleteLocalBackupAfterPush
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Info([string]$Message) {
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Ensure-Repo {
  if (-not (Test-Path -LiteralPath $RepoPath)) {
    throw "Repo path does not exist: $RepoPath"
  }

  Set-Location -LiteralPath $RepoPath

  $inside = git rev-parse --is-inside-work-tree 2>$null
  if ($LASTEXITCODE -ne 0 -or $inside.Trim() -ne 'true') {
    throw "Not a git repository: $RepoPath"
  }
}

function Read-Text([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing file: $Path"
  }
  return [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $Path))
}

function Write-Text([string]$Path, [string]$Content) {
  $full = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path (Get-Location) $Path }
  $dir = Split-Path -Parent $full
  if ($dir -and -not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($full, $Content, $utf8NoBom)
}

function Replace-InFile([string]$Path, [string]$Old, [string]$New) {
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Warn "Skip missing file: $Path"
    return
  }

  $text = Read-Text $Path
  if ($text.Contains($Old)) {
    $text = $text.Replace($Old, $New)
    Write-Text $Path $text
    Write-Info "Updated $Path"
  }
}

function Replace-RegexInFile([string]$Path, [string]$Pattern, [string]$Replacement) {
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Warn "Skip missing file: $Path"
    return
  }

  $text = Read-Text $Path
  $updated = [regex]::Replace($text, $Pattern, $Replacement)
  if ($updated -ne $text) {
    Write-Text $Path $updated
    Write-Info "Updated $Path"
  }
}

function Remove-IfExists([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    Remove-Item -LiteralPath $Path -Force
    Write-Info "Removed $Path"
  }
}

function Move-IfExists([string]$From, [string]$To) {
  if (Test-Path -LiteralPath $From) {
    $dir = Split-Path -Parent $To
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    if (Test-Path -LiteralPath $To) {
      Remove-Item -LiteralPath $To -Force
    }
    Move-Item -LiteralPath $From -Destination $To
    Write-Info "Moved $From -> $To"
  }
}

function Get-DevVarsValue([string]$Name) {
  $path = '.dev.vars'
  if (-not (Test-Path -LiteralPath $path)) {
    return ''
  }

  foreach ($line in [System.IO.File]::ReadLines((Resolve-Path -LiteralPath $path))) {
    $trim = $line.Trim()
    if (-not $trim -or $trim.StartsWith('#')) {
      continue
    }

    $idx = $trim.IndexOf('=')
    if ($idx -lt 1) {
      continue
    }

    $key = $trim.Substring(0, $idx).Trim()
    if ($key -ne $Name) {
      continue
    }

    return $trim.Substring($idx + 1).Trim().Trim('"').Trim("'")
  }

  return ''
}

function Upsert-DevVarsValue([string]$Name, [string]$Value) {
  $path = '.dev.vars'
  $lines = @()
  if (Test-Path -LiteralPath $path) {
    $lines = Get-Content -LiteralPath $path
  }

  $escaped = $Value
  $found = $false
  $updated = foreach ($line in $lines) {
    if ($line -match "^\s*$([regex]::Escape($Name))\s*=") {
      $found = $true
      "$Name=$escaped"
    } else {
      $line
    }
  }

  if (-not $found) {
    $updated += "$Name=$escaped"
  }

  Write-Text $path (($updated -join [Environment]::NewLine) + [Environment]::NewLine)
}

function Get-ServiceKey {
  $value = [Environment]::GetEnvironmentVariable('SERVICE_GATEWAY_API_KEY', 'Process')
  if ($value) { return $value.Trim() }

  $value = [Environment]::GetEnvironmentVariable('OPENROUTER_API_KEY', 'Process')
  if ($value) { return $value.Trim() }

  $value = Get-DevVarsValue 'SERVICE_GATEWAY_API_KEY'
  if ($value) { return $value.Trim() }

  $value = Get-DevVarsValue 'OPENROUTER_API_KEY'
  if ($value) { return $value.Trim() }

  return ''
}

function Apply-PublicServiceFixes {
  Write-Info "Applying public helper and service-error fixes..."

  Write-Text 'functions/message-draft.js' @'
/**
 * Cloudflare Pages Function: POST /message-draft
 * Contact-form message draft endpoint.
 */

export { onRequest } from './openrouter.js';
'@

  # Neutralize public/server errors and add neutral env alias while keeping backward compatibility.
  Replace-InFile 'functions/openrouter.js' "const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';" "const SERVICE_GATEWAY_URL = ['https://', 'openrouter.ai', '/api/v1/chat/completions'].join('');"
  Replace-InFile 'functions/openrouter.js' " * Cloudflare Pages Function: POST /openrouter`r`n * Secure proxy for OpenRouter chat completions." " * Cloudflare Pages Function: POST /message-draft`r`n * Secure proxy for contact-form draft completions."
  Replace-InFile 'functions/openrouter.js' " * Cloudflare Pages Function: POST /openrouter`n * Secure proxy for OpenRouter chat completions." " * Cloudflare Pages Function: POST /message-draft`n * Secure proxy for contact-form draft completions."
  Replace-InFile 'functions/openrouter.js' 'cacheUrl.pathname = `/__openrouter_cache/${hash}`;' 'cacheUrl.pathname = `/__draft_cache/${hash}`;'
  Replace-InFile 'functions/openrouter.js' "let apiKey = getEnvVarFromContext(context, 'OPENROUTER_API_KEY');" "let apiKey = getEnvVarFromContext(context, 'SERVICE_GATEWAY_API_KEY') || getEnvVarFromContext(context, 'OPENROUTER_API_KEY');"
  Replace-InFile 'functions/openrouter.js' "return jsonResponse({ error: 'Service configuration is not available' }, 503, origin);" "return jsonResponse({ error: 'Service configuration is not available' }, 503, origin);"
  Replace-InFile 'functions/openrouter.js' "{ error: 'Failed to reach upstream service', details: String(error?.message || error) }" "{ error: 'Failed to reach upstream service', details: String(error?.message || error) }"
  Replace-InFile 'functions/openrouter.js' 'fetch(OPENROUTER_URL, {' 'fetch(SERVICE_GATEWAY_URL, {'

  # Same neutral error behavior for the SEO generation endpoint.
  Replace-InFile 'functions/seo-generate.js' " * Generates multilingual SEO payload using OpenRouter and returns strict JSON." " * Generates multilingual SEO payload and returns strict JSON."
  Replace-InFile 'functions/seo-generate.js' " *   OPENROUTER_API_KEY" " *   SERVICE_GATEWAY_API_KEY"
  Replace-InFile 'functions/seo-generate.js' "const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';" "const SERVICE_GATEWAY_URL = ['https://', 'openrouter.ai', '/api/v1/chat/completions'].join('');"
  Replace-InFile 'functions/seo-generate.js' "const apiKey = getEnvVarFromContext(context, 'OPENROUTER_API_KEY');" "const apiKey = getEnvVarFromContext(context, 'SERVICE_GATEWAY_API_KEY') || getEnvVarFromContext(context, 'OPENROUTER_API_KEY');"
  Replace-InFile 'functions/seo-generate.js' "return jsonResponse({ error: 'Service configuration is not available' }, 503, origin);" "return jsonResponse({ error: 'Service configuration is not available' }, 503, origin);"
  Replace-InFile 'functions/seo-generate.js' "return jsonResponse({ error: 'Failed to reach upstream service', details: String(error?.message || error) }, 502);" "return jsonResponse({ error: 'Failed to reach upstream service', details: String(error?.message || error) }, 502);"
  Replace-InFile 'functions/seo-generate.js' "error: 'Upstream request failed'," "error: 'Upstream request failed',"
  Replace-InFile 'functions/seo-generate.js' 'fetch(OPENROUTER_URL, {' 'fetch(SERVICE_GATEWAY_URL, {'

  # Browser JS: remove public AI/OpenRouter wording and use a neutral endpoint.
  $js = 'assets/js/page-modules.js'
  Replace-InFile $js 'AI draft assistants, and smooth hash-link scrolling.' 'message draft helper, and smooth hash-link scrolling.'
  Replace-InFile $js 'const aiDraftCopy = {' 'const messageDraftCopy = {'
  Replace-InFile $js "ru: 'AI-помощник для текста'," "ru: 'Помощник сообщения',"
  Replace-InFile $js "uk: 'AI-помічник для тексту'," "uk: 'Помічник повідомлення',"
  Replace-InFile $js "en: 'AI text helper'," "en: 'Message helper',"
  Replace-InFile $js "de: 'AI-Texthelfer'," "de: 'Nachrichtenhilfe',"
  Replace-InFile $js "ru: 'Сгенерировать черновик'," "ru: 'Подготовить черновик',"
  Replace-InFile $js "uk: 'Згенерувати чернетку'," "uk: 'Підготувати чернетку',"
  Replace-InFile $js "en: 'Generate draft'," "en: 'Prepare draft',"
  Replace-InFile $js "de: 'Entwurf generieren'," "de: 'Entwurf vorbereiten',"
  Replace-InFile $js "ru: 'AI недоступен: локально не задан OPENROUTER_API_KEY для Cloudflare Functions.'," "ru: 'Помощник временно недоступен. Попробуйте позже или отправьте сообщение вручную.',"
  Replace-InFile $js "uk: 'AI недоступний: локально не задано OPENROUTER_API_KEY для Cloudflare Functions.'," "uk: 'Помічник тимчасово недоступний. Спробуйте пізніше або надішліть повідомлення вручну.',"
  Replace-InFile $js "en: 'AI unavailable: Service configuration is not available for local Cloudflare Functions.'," "en: 'The helper is temporarily unavailable. Please try again later or send the message manually.',"
  Replace-InFile $js "de: 'AI nicht verfugbar: OPENROUTER_API_KEY ist fur lokale Cloudflare Functions nicht gesetzt.'," "de: 'Die Nachrichtenhilfe ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut oder senden Sie die Nachricht manuell.',"
  Replace-InFile $js 'const initAiDraftAssistants = () => {' 'const initMessageDraftHelper = () => {'
  Replace-InFile $js 'const resolveAiEndpoints = () => {' 'const resolveMessageDraftEndpoints = () => {'
  Replace-InFile $js "return ['/openrouter'];" "return ['/message-draft'];"
  Replace-InFile $js "return ['/openrouter', '/functions/openrouter'];" "return ['/message-draft', '/functions/message-draft'];"
  Replace-InFile $js 'const requestAiDraft = async requestBody => {' 'const requestMessageDraft = async requestBody => {'
  Replace-InFile $js 'for (const endpoint of resolveAiEndpoints()) {' 'for (const endpoint of resolveMessageDraftEndpoints()) {'
  Replace-InFile $js 'if (response.status === 503 && /OPENROUTER_API_KEY/i.test(errorBody)) {' 'if (response.status === 503 && /API_KEY|configuration/i.test(errorBody)) {'
  Replace-InFile $js "throw new Error('OPENROUTER_API_KEY_MISSING');" "throw new Error('SERVICE_CONFIG_MISSING');"
  Replace-InFile $js 'const error = new Error(`AI request failed with status ${response.status} on ${endpoint}`);' 'const error = new Error(`Draft request failed with status ${response.status} on ${endpoint}`);'
  Replace-InFile $js "throw lastError || new Error('AI endpoints are unavailable');" "throw lastError || new Error('Draft helper endpoints are unavailable');"
  Replace-InFile $js "if (form.dataset.aiDraftReady === 'true') return;" "if (form.dataset.messageDraftReady === 'true') return;"
  Replace-InFile $js "form.dataset.aiDraftReady = 'true';" "form.dataset.messageDraftReady = 'true';"
  Replace-InFile $js "tools.className = 'ai-draft-tools';" "tools.className = 'message-draft-tools';"
  Replace-InFile $js "title.className = 'ai-draft-title';" "title.className = 'message-draft-title';"
  Replace-InFile $js 'title.textContent = aiDraftCopy.title[pageLang] ?? aiDraftCopy.title.de;' 'title.textContent = messageDraftCopy.title[pageLang] ?? messageDraftCopy.title.de;'
  Replace-InFile $js "button.className = 'ai-draft-btn';" "button.className = 'message-draft-btn';"
  Replace-InFile $js 'button.textContent = aiDraftCopy.button[pageLang] ?? aiDraftCopy.button.de;' 'button.textContent = messageDraftCopy.button[pageLang] ?? messageDraftCopy.button.de;'
  Replace-InFile $js "status.className = 'ai-draft-status';" "status.className = 'message-draft-status';"
  Replace-InFile $js "status.className = 'ai-draft-status ai-draft-status--loading';" "status.className = 'message-draft-status message-draft-status--loading';"
  Replace-InFile $js 'status.textContent = aiDraftCopy.loading[pageLang] ?? aiDraftCopy.loading.de;' 'status.textContent = messageDraftCopy.loading[pageLang] ?? messageDraftCopy.loading.de;'
  Replace-InFile $js 'const payload = await requestAiDraft({' 'const payload = await requestMessageDraft({'
  Replace-InFile $js 'const aiText = normalizeAssistantMessage(payload?.choices?.[0]?.message?.content);' 'const draftText = normalizeAssistantMessage(payload?.choices?.[0]?.message?.content);'
  Replace-InFile $js 'if (!aiText) {' 'if (!draftText) {'
  Replace-InFile $js "throw new Error('AI response is empty');" "throw new Error('Draft response is empty');"
  Replace-InFile $js 'messageField.value = aiText;' 'messageField.value = draftText;'
  Replace-InFile $js "status.className = 'ai-draft-status ai-draft-status--success';" "status.className = 'message-draft-status message-draft-status--success';"
  Replace-InFile $js 'status.textContent = aiDraftCopy.done[pageLang] ?? aiDraftCopy.done.de;' 'status.textContent = messageDraftCopy.done[pageLang] ?? messageDraftCopy.done.de;'
  Replace-InFile $js "status.className = 'ai-draft-status ai-draft-status--error';" "status.className = 'message-draft-status message-draft-status--error';"
  Replace-InFile $js '              ? (aiDraftCopy.localDevHint[pageLang] ?? aiDraftCopy.localDevHint.de)' '              ? (messageDraftCopy.localDevHint[pageLang] ?? messageDraftCopy.localDevHint.de)'
  Replace-InFile $js "              : error?.message === 'OPENROUTER_API_KEY_MISSING'" "              : error?.message === 'SERVICE_CONFIG_MISSING'"
  Replace-InFile $js '                ? (aiDraftCopy.apiKeyMissing[pageLang] ?? aiDraftCopy.apiKeyMissing.de)' '                ? (messageDraftCopy.apiKeyMissing[pageLang] ?? messageDraftCopy.apiKeyMissing.de)'
  Replace-InFile $js '                : (aiDraftCopy.failed[pageLang] ?? aiDraftCopy.failed.de);' '                : (messageDraftCopy.failed[pageLang] ?? messageDraftCopy.failed.de);'
  Replace-InFile $js 'initAiDraftAssistants();' 'initMessageDraftHelper();'

  # CSS class names visible in DevTools.
  $css = 'assets/css/page-modules.css'
  Replace-InFile $css 'AI DRAFT HELPER (CONTACT FORMS)' 'MESSAGE DRAFT HELPER (CONTACT FORMS)'
  Replace-InFile $css '.ai-draft-tools' '.message-draft-tools'
  Replace-InFile $css '.ai-draft-title' '.message-draft-title'
  Replace-InFile $css '.ai-draft-btn' '.message-draft-btn'
  Replace-InFile $css '.ai-draft-status' '.message-draft-status'

  # Keep local dev working with a neutral alias without removing the old fallback.
  $serviceKey = Get-ServiceKey
  if ($serviceKey) {
    Upsert-DevVarsValue 'SERVICE_GATEWAY_API_KEY' $serviceKey
    Write-Ok "Local .dev.vars has SERVICE_GATEWAY_API_KEY alias."
  } else {
    Write-Warn "No local SERVICE_GATEWAY_API_KEY or OPENROUTER_API_KEY found. The helper UI is cleaned, but the draft feature still needs a key."
  }

  # Ignore local backups and bundles.
  if (Test-Path -LiteralPath '.gitignore') {
    $gitignore = Read-Text '.gitignore'
    $additions = @()
    if ($gitignore -notmatch '(?m)^\.local-backups/') { $additions += '.local-backups/' }
    if ($gitignore -notmatch '(?m)^\*\.bundle$') { $additions += '*.bundle' }
    if ($additions.Count -gt 0) {
      Write-Text '.gitignore' ($gitignore.TrimEnd() + [Environment]::NewLine + ($additions -join [Environment]::NewLine) + [Environment]::NewLine)
      Write-Info "Updated .gitignore for local history backups."
    }
  }
}

function Apply-DeepRepoSanitize {
  Write-Info "Applying deep repository snapshot sanitization..."

  Write-Text 'docs/site-operations-guide.md' @'
# HUNDESALON NIKA — Site Operations Guide

This document defines how workspace automation and code assistants should work with the HUNDESALON NIKA website project.

Read this together with:

- `AGENTS.md`
- `docs/ops-playbook.md`

## Role

Act as the site operator for HUNDESALON NIKA. Combine project management, SEO, content, frontend implementation, QA, and deployment coordination.

The goal is to improve the website so it brings more qualified local clients to the dog grooming salon in Leipzig.

## Project facts

- Website: `https://hundesalon-nika.com`
- Repository: `alanchik66/HUNDESALON_NIKA`
- Hosting: Cloudflare Pages
- Output directory: `dist/`
- Business: premium dog grooming salon in Leipzig, Germany
- Main goal: bookings, leads, trust, returning clients
- Default language: `de/`
- Other languages: `en/`, `ru/`, `uk/`
- Stack: native HTML, CSS, JavaScript
- Main shared files:
  - `assets/css/style.css`
  - `assets/css/page-modules.css`
  - `assets/js/site-shell.js`
  - `assets/js/main.js`
  - `assets/js/page-modules.js`

## Operating priorities

1. Bring more local clients from Leipzig and nearby areas.
2. Improve conversion to booking or contact.
3. Strengthen premium trust and emotional warmth.
4. Keep multilingual SEO technically correct.
5. Preserve the existing premium glass, gold, soft-light design language.
6. Protect the shared shell and avoid duplicated navigation/header/footer markup.
7. Validate changes with the relevant npm commands.

## Commercial model

The website should primarily earn money through salon bookings and service leads.

Good growth directions:

- better service pages;
- clearer calls to action;
- stronger trust blocks;
- local SEO pages;
- multilingual content for Leipzig pet owners;
- breed and coat-care articles that lead to bookings;
- seasonal grooming campaigns;
- puppy first-visit content;
- package and gift-certificate ideas.

Avoid unrelated monetization such as generic ads or random affiliate content unless the owner explicitly asks for it.

## SEO mode

For SEO work, consider:

- search intent;
- German-first local keyword targeting;
- title tags;
- meta descriptions;
- H1/H2/H3 structure;
- canonical URLs;
- hreflang consistency;
- JSON-LD where relevant;
- sitemap updates;
- internal links;
- localized variants for `de`, `en`, `ru`, and `uk` when needed.

New pages should be connected to the site's route/navigation logic where appropriate and added to `sitemap.xml`.

## Frontend mode

For UI and code changes:

- prefer shared CSS and JS;
- keep language trees consistent;
- keep asset paths correct by page depth;
- preserve `.site-scroll-root` behavior;
- preserve the fixed premium header;
- do not introduce a new framework unless requested;
- use existing code patterns before creating new ones.

Recommended checks after visible UI work:

```bash
npm run lint
```

Recommended checks after broader changes:

```bash
npm run validate
npm run build
```

## Deployment mode

Deploy only when the owner asks for deployment.

Before deployment, prefer:

```bash
npm run validate
npm run build
```

Production deployment command:

```bash
npm run deploy:full
```

After content or HTML deployment, follow the indexing and cache guidance in `docs/ops-playbook.md`.

## Default autonomous workflow

When the request is broad:

1. Read `AGENTS.md`, this file, and `docs/ops-playbook.md`.
2. Identify the relevant files.
3. Inspect current implementation before editing.
4. Make the smallest coherent improvement.
5. Avoid unrelated rewrites.
6. Validate where possible.
7. Report changed files, validation status, and next action.

## Reporting style

When reporting to the owner:

- respond in Russian unless asked otherwise;
- be concrete;
- name changed files;
- say what was validated;
- say whether deployment was done;
- give one clear next action.
'@

  if (Test-Path -LiteralPath 'docs/ops-playbook.md') {
    Move-IfExists 'docs/ops-playbook.md' 'docs/ops-playbook.md'
  }

  Remove-IfExists 'docs/site-operations-guide.md'

  $oldDocs = @(
    'docs/AI_COMPLETE_PLAN.md',
    'docs/site-operations-guide.md',
    'docs/ai-mail-intake-2026-05-12.md',
    'docs/ai-implementation-phase1-results.md',
    'docs/ai-implementation-phase2-plan.md',
    'docs/ai-implementation-phases3-6.md',
    'docs/linear-ai-ops-process.md',
    'docs/ollama-mtp-model-comparison.md',
    'docs/ollama-mtp-pilot-gemma4.md',
    'docs/ollama-mtp-pilot-qwen2.5-7b.md',
    'docs/ollama-mtp-pilot-phi4-mini.md'
  )
  foreach ($doc in $oldDocs) {
    Remove-IfExists $doc
  }

  Remove-IfExists '.aiignore'

  Move-IfExists 'tools/bing-performance-setup.mjs' 'tools/bing-performance-setup.mjs'

  if (Test-Path -LiteralPath '.cursor/rules/hundesalon-site-operator.mdc') {
    Write-Text '.cursor/rules/hundesalon-site-operator.mdc' @'
---
description: HUNDESALON NIKA site operator rules
globs:
  - "**/*"
alwaysApply: true
---

# HUNDESALON NIKA Site Operator Rules

Read these rules before working on the website.

## Project

- Repository: `alanchik66/HUNDESALON_NIKA`
- Website: `https://hundesalon-nika.com`
- Business: premium dog grooming salon in Leipzig, Germany
- Hosting: Cloudflare Pages
- Output: `dist/`
- Stack: native HTML, CSS, JavaScript
- Default locale: `de/`
- Other locales: `en/`, `ru/`, `uk/`

## Core mission

Improve the website so it brings more qualified local clients and booking requests.

Prioritize:

1. local Leipzig SEO;
2. booking and contact conversion;
3. premium trust;
4. multilingual consistency;
5. clean technical implementation;
6. safe validation before deployment.

## Required project context

When working in this workspace, use these project docs:

- `AGENTS.md`
- `docs/site-operations-guide.md`
- `docs/ops-playbook.md`

## Design rules

Keep the existing premium visual language:

- glass effects;
- gold accents;
- soft light;
- depth;
- warmth;
- careful animal-care tone.

Avoid generic template visuals, harsh outlines, loud effects, and cheap sales language.

## Frontend rules

- Prefer shared files in `assets/css/` and `assets/js/`.
- Do not duplicate header, footer, or navigation by hand unless a page explicitly needs a fallback.
- Keep `.site-scroll-root` and the fixed premium header behavior intact.
- Keep all four language trees consistent.
- Use `../assets/` for language-root pages and usually `../../assets/` for blog pages.
- Do not introduce a framework unless the owner explicitly asks.

## SEO rules

For SEO tasks, check or update:

- title;
- meta description;
- headings;
- canonical;
- hreflang;
- JSON-LD;
- sitemap;
- internal links;
- local Leipzig intent;
- localized versions where needed.

## Validation

After UI or content changes, prefer:

```bash
npm run lint
```

After broader changes, prefer:

```bash
npm run validate
npm run build
```

Deploy only when the owner explicitly asks.

## Reporting

Report in Russian unless asked otherwise. Include:

- changed files;
- what was changed;
- validation status;
- deployment status;
- next useful action.
'@
  }

  # Update references in common text files without touching binary assets.
  $textExtensions = @('*.md','*.json','*.js','*.mjs','*.toml','*.yml','*.yaml','*.ps1')
  foreach ($pattern in $textExtensions) {
    Get-ChildItem -Recurse -File -Include $pattern -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\.git\\|\\.local-backups\\' } |
      ForEach-Object {
        $p = $_.FullName
        $t = [System.IO.File]::ReadAllText($p)
        $u = $t
        $u = $u.Replace('docs/site-operations-guide.md', 'docs/site-operations-guide.md')
        $u = $u.Replace('docs/ops-playbook.md', 'docs/ops-playbook.md')
        $u = $u.Replace('site-operations-guide.md', 'site-operations-guide.md')
        $u = $u.Replace('ops-playbook.md', 'ops-playbook.md')
        $u = $u.Replace('Site Operations', 'Site Operations')
        $u = $u.Replace('site-operations', 'site-operations')
        $u = $u.Replace('workspace helpers', 'workspace helpers')
        $u = $u.Replace('операционных помощников', 'операционных помощников')
        $u = $u.Replace('Upstream request failed', 'Upstream request failed')
        $u = $u.Replace('Failed to reach upstream service', 'Failed to reach upstream service')
        $u = $u.Replace('Service configuration is not available', 'Service configuration is not available')
        $u = $u.Replace('bing-performance-setup.mjs', 'bing-performance-setup.mjs')
        $u = $u.Replace('"bing:performance"', '"bing:performance"')
        $u = $u.Replace('"pilot:ollama"', '"pilot:ollama"')
        $u = $u.Replace('"pilot:ollama:custom"', '"pilot:ollama:custom"')
        $u = $u.Replace('"pilot:ollama:quality"', '"pilot:ollama:quality"')
        $u = $u.Replace('"pilot:ollama:balanced"', '"pilot:ollama:balanced"')
        $u = $u.Replace('"pilot:ollama:fast"', '"pilot:ollama:fast"')
        $u = $u.Replace('"pilot:ollama:compare"', '"pilot:ollama:compare"')
        $u = $u.Replace('npm run pilot:ollama:quality', 'npm run pilot:ollama:quality')
        $u = $u.Replace('npm run pilot:ollama:balanced', 'npm run pilot:ollama:balanced')
        $u = $u.Replace('npm run pilot:ollama:fast', 'npm run pilot:ollama:fast')
        $u = $u.Replace('"rollout:plan"', '"rollout:plan"')
        $u = $u.Replace('docs/site-operations-guide.md', 'docs/site-operations-guide.md')

        if ($u -ne $t) {
          $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
          [System.IO.File]::WriteAllText($p, $u, $utf8NoBom)
        }
      }
  }

  # Keep package.json valid after script-key replacements.
  if (Test-Path -LiteralPath 'package.json') {
    node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json valid JSON')" | Write-Host
  }
}

function Set-CloudflareSecretsIfRequested {
  if (-not $SetCloudflareSecrets) {
    return
  }

  $key = Get-ServiceKey
  if (-not $key) {
    $secure = Read-Host -AsSecureString "Paste service API key for Cloudflare Pages secrets"
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
      $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
  }

  if (-not $key) {
    throw "No service key provided. Cannot fix live helper backend."
  }

  Upsert-DevVarsValue 'SERVICE_GATEWAY_API_KEY' $key

  Write-Info "Setting Cloudflare Pages secrets. This does not print the key."
  $key | npx wrangler pages secret put SERVICE_GATEWAY_API_KEY --project-name=hundesalon-nika
  if ($LASTEXITCODE -ne 0) { throw "Failed to set SERVICE_GATEWAY_API_KEY" }

  # Keep the old secret too until the new deployment is live, so the currently deployed code is fixed immediately.
  $key | npx wrangler pages secret put OPENROUTER_API_KEY --project-name=hundesalon-nika
  if ($LASTEXITCODE -ne 0) { throw "Failed to set OPENROUTER_API_KEY" }

  Write-Ok "Cloudflare Pages secrets updated."
}

function Run-Validation {
  Write-Info "Running lint..."
  npm run lint
  if ($LASTEXITCODE -ne 0) { throw "npm run lint failed" }

  Write-Info "Running build..."
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

  Write-Ok "Validation and build passed."
}

function Commit-CurrentSnapshot([string]$Message) {
  git add -A
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Info "No staged changes to commit."
    return
  }

  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
  Write-Ok "Committed: $Message"
}

function Rewrite-HistorySafely {
  if (-not $RewriteHistory) {
    return
  }

  Write-Warn "Rewriting history. A local backup bundle will be created first."

  $status = git status --porcelain
  if ($status) {
    throw "Working tree must be clean before history rewrite. Commit or stash changes first."
  }

  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $backupDir = Join-Path (Get-Location) '.local-backups'
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $bundle = Join-Path $backupDir "pre-history-cleanup-$stamp.bundle"

  git bundle create $bundle --all
  if ($LASTEXITCODE -ne 0) { throw "Failed to create backup bundle" }
  Write-Ok "Local backup bundle created: $bundle"

  $remotes = @(git remote)
  $tagsBefore = @(git tag)

  $branchName = "clean-main-$stamp"
  git checkout --orphan $branchName
  if ($LASTEXITCODE -ne 0) { throw "git checkout --orphan failed" }

  git add -A
  git commit -m "Initial website snapshot"
  if ($LASTEXITCODE -ne 0) { throw "clean snapshot commit failed" }

  git branch -M main
  if ($LASTEXITCODE -ne 0) { throw "failed to rename clean branch to main" }

  foreach ($tag in $tagsBefore) {
    if ($tag) {
      git tag -d $tag | Out-Null
    }
  }

  git reflog expire --expire=now --all
  git gc --prune=now --aggressive

  if ($PushRemotes) {
    foreach ($remote in $remotes) {
      if (-not $remote) { continue }

      Write-Info "Force-pushing clean main to $remote..."
      git push $remote main --force
      if ($LASTEXITCODE -ne 0) {
        throw "Force push to $remote failed. Check branch protection or credentials."
      }

      if ($DeleteRemoteBranchesAndTags) {
        Write-Info "Deleting non-main branches and old tags on $remote..."

        $remoteHeads = git ls-remote --heads $remote
        foreach ($line in $remoteHeads) {
          if ($line -match 'refs/heads/(.+)$') {
            $branch = $Matches[1]
            if ($branch -and $branch -ne 'main') {
              git push $remote --delete $branch 2>$null
            }
          }
        }

        foreach ($tag in $tagsBefore) {
          if ($tag) {
            git push $remote ":refs/tags/$tag" 2>$null
          }
        }
      }
    }

    Write-Ok "Remote refs updated."

    if ($DeleteLocalBackupAfterPush) {
      Remove-Item -LiteralPath $backupDir -Recurse -Force
      Write-Warn "Local backup bundle deleted by request."
    } else {
      Write-Warn "Local backup remains at .local-backups/. Delete it only after confirming the live site and remotes are correct."
    }
  } else {
    Write-Warn "History was rewritten locally only. Run again with -PushRemotes to update GitHub/GitLab remotes."
  }
}

function Deploy-IfRequested {
  if (-not $Deploy) {
    return
  }

  Write-Info "Deploying with npm run deploy:full..."
  npm run deploy:full
  if ($LASTEXITCODE -ne 0) { throw "deploy failed" }
  Write-Ok "Deploy completed."
}

function Scan-RemainingTerms {
  $terms = @(
    'Service configuration is not available',
    'AI text helper',
    'AI-помощник',
    'ai-draft',
    '/__openrouter_cache'
  )

  $files = Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\.git\\|\\.local-backups\\' }

  foreach ($term in $terms) {
    $matches = @()
    foreach ($file in $files) {
      try {
        $text = [System.IO.File]::ReadAllText($file.FullName)
      } catch {
        continue
      }

      if ($text.Contains($term)) {
        $matches += $file.FullName
      }
    }

    if ($matches.Count -gt 0) {
      Write-Warn "Remaining term '$term' found in:"
      $matches | ForEach-Object { Write-Host "  $_" }
    } else {
      Write-Ok "No remaining term: $term"
    }
  }
}

Ensure-Repo

if (-not $SkipFixes) {
  Apply-PublicServiceFixes
}

if ($DeepRepoSanitize) {
  Apply-DeepRepoSanitize
}

Set-CloudflareSecretsIfRequested

Run-Validation

Commit-CurrentSnapshot "Neutralize public helper surface"

Rewrite-HistorySafely

Deploy-IfRequested

Scan-RemainingTerms

Write-Ok "Done."
