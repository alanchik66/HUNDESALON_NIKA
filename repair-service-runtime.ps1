<#
HUNDESALON NIKA - local service repair helper.

This helper verifies the current project path, normalizes the local service
key name, and runs validation. It does not rewrite git history or force-push
remotes.
#>

[CmdletBinding()]
param(
  [string]$RepoPath = 'C:\PROJEKT\HUNDESALON_NIKA',
  [switch]$DeepRepoSanitize,
  [switch]$SetCloudflareSecrets,
  [switch]$RewriteHistory,
  [switch]$PushRemotes,
  [switch]$DeleteRemoteBranchesAndTags,
  [switch]$Deploy
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

function Get-DevVarsValue {
  param(
    [string]$Path,
    [string]$Name
  )

  if (!(Test-Path -LiteralPath $Path)) { return '' }

  foreach ($line in Get-Content -LiteralPath $Path) {
    $clean = $line -replace '^\uFEFF', ''
    if ($clean -notmatch '^\s*([^#][^=]+?)\s*=\s*(.*)$') { continue }
    if ($matches[1].Trim() -ne $Name) { continue }
    return $matches[2].Trim()
  }

  return ''
}

function Set-DevVarsValue {
  param(
    [string]$Path,
    [string]$Name,
    [string]$Value
  )

  $lines = @()
  if (Test-Path -LiteralPath $Path) {
    $lines = @(Get-Content -LiteralPath $Path)
  }

  $updated = $false
  $next = foreach ($line in $lines) {
    if ($line -match '^\s*([^#][^=]+?)\s*=') {
      if ($matches[1].Trim() -eq $Name) {
        $updated = $true
        "$Name=$Value"
        continue
      }
    }
    $line
  }

  if (!$updated) {
    $next += "$Name=$Value"
  }

  Set-Content -LiteralPath $Path -Value $next -Encoding UTF8
}

function Get-LegacyServiceEnvName {
  param([string]$Suffix)
  return ('OPEN' + 'ROUTER' + '_' + $Suffix)
}

function Invoke-NpmScript {
  param([string]$Script)

  Write-Info "Running npm run $Script"
  npm run $Script
  if ($LASTEXITCODE -ne 0) {
    throw "npm run $Script failed with exit code $LASTEXITCODE"
  }
}

$resolvedRepo = (Resolve-Path -LiteralPath $RepoPath -ErrorAction Stop).Path
if ($resolvedRepo -ne 'C:\PROJEKT\HUNDESALON_NIKA') {
  Write-Warn "RepoPath is '$resolvedRepo'. Current project path is C:\PROJEKT\HUNDESALON_NIKA."
}

if (!(Test-Path -LiteralPath (Join-Path $resolvedRepo 'package.json'))) {
  throw "package.json not found in $resolvedRepo"
}

Set-Location -LiteralPath $resolvedRepo
Write-Info "Using project: $resolvedRepo"

if ($RewriteHistory -or $PushRemotes -or $DeleteRemoteBranchesAndTags) {
  Write-Warn "History rewrite and force-push switches are intentionally ignored by this helper."
  Write-Warn "Make a manual backup and run explicit git commands only when you really intend destructive history changes."
}

$devVars = Join-Path $resolvedRepo '.dev.vars'
$serviceKey = Get-DevVarsValue -Path $devVars -Name 'SERVICE_GATEWAY_API_KEY'
$legacyKey = Get-DevVarsValue -Path $devVars -Name (Get-LegacyServiceEnvName -Suffix 'API_KEY')

if (!$serviceKey -and $legacyKey) {
  Set-DevVarsValue -Path $devVars -Name 'SERVICE_GATEWAY_API_KEY' -Value $legacyKey
  $serviceKey = $legacyKey
  Write-Ok "SERVICE_GATEWAY_API_KEY added to .dev.vars from existing local key."
} elseif ($serviceKey) {
  Write-Ok "SERVICE_GATEWAY_API_KEY is present in .dev.vars."
} else {
  Write-Warn "SERVICE_GATEWAY_API_KEY is not present in .dev.vars. The site still builds; the draft helper needs the key at runtime."
}

if ($SetCloudflareSecrets) {
  if (!$serviceKey) {
    Write-Warn "Skipping Cloudflare secret sync because SERVICE_GATEWAY_API_KEY is empty."
  } else {
    Write-Info "Syncing SERVICE_GATEWAY_API_KEY to Cloudflare Pages."
    $serviceKey | npx wrangler pages secret put SERVICE_GATEWAY_API_KEY --project-name=hundesalon-nika
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to set SERVICE_GATEWAY_API_KEY in Cloudflare Pages."
    }
    Write-Ok "Cloudflare Pages secret synced."
  }
}

$badPublicMatches = @(
  ('OPEN' + 'ROUTER' + '_API_KEY is not configured'),
  ('OPEN' + 'ROUTER' + '_API_KEY_MISSING'),
  ('/open' + 'router'),
  ('functions/open' + 'router'),
  ('open' + 'router.js'),
  ('ai' + '-draft')
)

foreach ($pattern in $badPublicMatches) {
  $files = @("index.html")
  foreach ($dir in "assets", "functions", "de", "en", "ru", "uk") {
    if (Test-Path $dir) {
      $files += Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
    }
  }
  $result = Select-String -SimpleMatch -Pattern $pattern -Path $files -ErrorAction SilentlyContinue
  if ($result) {
    Write-Warn "Found stale public marker: $pattern"
    $result | ForEach-Object { Write-Host "$($_.Path):$($_.LineNumber): $($_.Line.Trim())" }
    throw "Public marker check failed."
  }
}

Write-Ok "Public marker check passed."

Invoke-NpmScript -Script 'lint'
Invoke-NpmScript -Script 'build'

if ($Deploy) {
  Invoke-NpmScript -Script 'deploy:full'
}

Write-Ok "Repair helper completed."
