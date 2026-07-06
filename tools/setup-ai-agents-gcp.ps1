# HUNDESALON_NIKA — GCP access for local AI agents (Cursor, VS Code, WebStorm, Grok)
# Uses service account impersonation (no JSON keys; org policy blocks key creation).

param(
  [switch]$SkipAdcLogin
)

$ErrorActionPreference = 'Stop'

$Project = 'hundesalon-nika-shell-2026'
$Region = 'europe-west3'
$Config = 'hundesalon-nika-google-shell'
$ServiceAccount = "ai-agents-admin@$Project.iam.gserviceaccount.com"

Write-Host "== HUNDESALON AI agents GCP setup ==" -ForegroundColor Cyan
Write-Host "Project: $Project"
Write-Host "Service account (impersonation): $ServiceAccount"
Write-Host ""

gcloud config configurations activate $Config | Out-Null
gcloud config set project $Project | Out-Null
gcloud config set run/region $Region | Out-Null
gcloud config set auth/impersonate_service_account $ServiceAccount | Out-Null
gcloud auth application-default set-quota-project $Project 2>$null | Out-Null

$envVars = @{
  GOOGLE_CLOUD_PROJECT                      = $Project
  GCP_PROJECT                               = $Project
  CLOUDSDK_CORE_PROJECT                     = $Project
  CLOUDSDK_COMPUTE_REGION                   = $Region
  GOOGLE_AUTH_IMPERSONATE_SERVICE_ACCOUNT   = $ServiceAccount
}

foreach ($name in $envVars.Keys) {
  [System.Environment]::SetEnvironmentVariable($name, $envVars[$name], 'User')
  Set-Item -Path "Env:$name" -Value $envVars[$name]
}

# Stale empty key file breaks Google client libraries.
$staleKey = Join-Path $env:USERPROFILE '.secrets\ai-agents-key.json'
if ((Test-Path $staleKey) -and ((Get-Item $staleKey).Length -eq 0)) {
  Remove-Item $staleKey -Force
  Write-Host "Removed empty stale key file: $staleKey" -ForegroundColor Yellow
}

if ([System.Environment]::GetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', 'User')) {
  [System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', $null, 'User')
  Remove-Item Env:GOOGLE_APPLICATION_CREDENTIALS -ErrorAction SilentlyContinue
  Write-Host 'Cleared GOOGLE_APPLICATION_CREDENTIALS (impersonation via gcloud ADC instead).' -ForegroundColor Yellow
}

if (-not $SkipAdcLogin) {
  Write-Host ""
  Write-Host 'Refreshing Application Default Credentials with impersonation...' -ForegroundColor Cyan
  Write-Host 'A browser window may open for Google sign-in.' -ForegroundColor DarkGray
  gcloud auth application-default login --impersonate-service-account=$ServiceAccount --project=$Project
} else {
  Write-Host 'Skipping ADC browser login (existing impersonated ADC kept).' -ForegroundColor DarkGray
}

Write-Host ""
Write-Host 'Verifying Cloud Run access...' -ForegroundColor Cyan
gcloud run services list --project=$Project --region=$Region --format='table(name,status.url)'

Write-Host ""
Write-Host 'Done. Restart terminals and IDEs to pick up user env vars.' -ForegroundColor Green
Write-Host 'Devin / remote agents: SA JSON keys are blocked by org policy.' -ForegroundColor Yellow
Write-Host 'Use Cloud Shell impersonation or Workload Identity Federation for remote tools.' -ForegroundColor Yellow
