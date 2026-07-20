# WebStorm memory optimization for HUNDESALON_NIKA.
# Fixes AI Assistant heap pressure: VM options, AI session cache cleanup, optional restart.
#
# Usage:
#   .\tools\optimize-webstorm-memory.ps1              # apply settings + clean disk caches
#   .\tools\optimize-webstorm-memory.ps1 -Restart     # also restart WebStorm
#   .\tools\optimize-webstorm-memory.ps1 -Restart -OpenProject

[CmdletBinding()]
param(
  [switch]$Restart,
  [switch]$OpenProject,
  [string]$ProjectPath = 'D:\HUNDESALON_NIKA',
  [string]$WebStormVersion = 'WebStorm2026.1',
  [string]$WebStormHome = 'C:\Program Files\JetBrains\WebStorm 2026.1.4',
  [int]$GracefulShutdownSeconds = 20
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "[webstorm] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "[ok] $Message" -ForegroundColor Green
}

function Write-WarnLine([string]$Message) {
  Write-Host "[warn] $Message" -ForegroundColor Yellow
}

function Get-DirSizeMb([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { return 0 }
  $sum = (Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum
  if ($null -eq $sum) { return 0 }
  return [math]::Round($sum / 1MB, 2)
}

function Stop-WebStormGracefully([int]$TimeoutSeconds) {
  $proc = Get-Process -Name 'webstorm64' -ErrorAction SilentlyContinue
  if (-not $proc) {
    Write-Ok 'WebStorm is not running.'
    return
  }

  Write-Step "Closing WebStorm (PID $($proc.Id))..."
  $null = $proc.CloseMainWindow()
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 1
    $proc.Refresh()
    if ($proc.HasExited) {
      Write-Ok 'WebStorm closed gracefully.'
      return
    }
  }

  Write-WarnLine 'Graceful close timed out; forcing shutdown.'
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Write-Ok 'WebStorm process terminated.'
}

function Clear-AiAssistantCaches {
  $configRoot = Join-Path $env:APPDATA "JetBrains\$WebStormVersion"
  $localRoot = Join-Path $env:LOCALAPPDATA "JetBrains\$WebStormVersion"

  $targets = @(
    (Join-Path $configRoot 'aia-task-history'),
    (Join-Path $localRoot 'ai-assistant-log-data')
  )

  $freed = 0.0
  foreach ($target in $targets) {
    if (!(Test-Path -LiteralPath $target)) { continue }
    $before = Get-DirSizeMb $target
    Write-Step "Clearing $target ($before MB)..."
    Get-ChildItem -LiteralPath $target -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    $freed += $before
  }

  if ($freed -gt 0) {
    Write-Ok "Freed about $freed MB of AI Assistant disk caches."
  } else {
    Write-Ok 'No AI Assistant disk caches to clear.'
  }
}

function Ensure-VmOptions {
  $configRoot = Join-Path $env:APPDATA "JetBrains\$WebStormVersion"
  $vmOptionsPath = Join-Path $configRoot 'webstorm64.exe.vmoptions'
  $repoVmOptions = Join-Path $PSScriptRoot 'webstorm.vmoptions'

  if (Test-Path -LiteralPath $repoVmOptions) {
    $content = Get-Content -LiteralPath $repoVmOptions -Raw -Encoding UTF8
  } else {
    $bundled = Join-Path $WebStormHome 'bin\webstorm64.exe.vmoptions'
    if (!(Test-Path -LiteralPath $bundled)) {
      throw "Bundled vmoptions not found: $bundled"
    }
    $lines = Get-Content -LiteralPath $bundled -Encoding UTF8 |
      Where-Object { $_ -notmatch '^\s*#' -and $_ -notmatch '^\s*$' }
    $content = @(
      '# HUNDESALON_NIKA — custom WebStorm memory profile'
      '-Xms512m'
      '-Xmx4096m'
    ) + ($lines | Where-Object { $_ -notmatch '^-Xm[sx]' })
    $content = ($content -join "`n") + "`n"
  }

  if (Test-Path -LiteralPath $vmOptionsPath) {
    $backup = "$vmOptionsPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $vmOptionsPath -Destination $backup -Force
    Write-Ok "Backed up existing vmoptions to $backup"
  }

  Set-Content -LiteralPath $vmOptionsPath -Value $content -Encoding UTF8 -NoNewline
  Write-Ok "VM options written: $vmOptionsPath (Xmx4096m)"
}

function Start-WebStormProject([string]$Path) {
  $exe = Join-Path $WebStormHome 'bin\webstorm64.exe'
  if (!(Test-Path -LiteralPath $exe)) {
    throw "WebStorm executable not found: $exe"
  }

  Write-Step "Starting WebStorm with project: $Path"
  Start-Process -FilePath $exe -ArgumentList "`"$Path`""
  Write-Ok 'WebStorm launch requested.'
}

Write-Step 'Applying WebStorm memory profile for HUNDESALON_NIKA...'
Ensure-VmOptions

if ($Restart) {
  Stop-WebStormGracefully -TimeoutSeconds $GracefulShutdownSeconds
  Clear-AiAssistantCaches
  if ($OpenProject) {
    Start-WebStormProject -Path $ProjectPath
  } else {
    Write-WarnLine 'WebStorm stopped. Start it manually or rerun with -Restart -OpenProject.'
  }
} else {
  $running = [bool](Get-Process -Name 'webstorm64' -ErrorAction SilentlyContinue)
  if ($running) {
    Write-WarnLine 'WebStorm is running. Disk caches were not cleared (requires shutdown).'
    Write-WarnLine 'Restart WebStorm to apply new heap limit (Xmx4096m).'
    Write-WarnLine 'Run: .\tools\optimize-webstorm-memory.ps1 -Restart -OpenProject'
  } else {
    Clear-AiAssistantCaches
    if ($OpenProject) {
      Start-WebStormProject -Path $ProjectPath
    }
  }
}

Write-Ok 'Done.'
