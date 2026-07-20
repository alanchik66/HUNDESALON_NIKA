# Applies MCP profile, stores GitHub token, and restarts AI clients.
[CmdletBinding()]
param(
  [string]$ProjectPath = 'D:\HUNDESALON_NIKA'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "[mcp] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "[ok] $Message" -ForegroundColor Green
}

function Write-WarnLine([string]$Message) {
  Write-Host "[warn] $Message" -ForegroundColor Yellow
}

function Stop-AppProcesses {
  param(
    [string[]]$Names
  )
  foreach ($name in $Names) {
    Get-Process -Name $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  }
}

function Start-App {
  param(
    [string]$Label,
    [string]$Path,
    [string]$Arguments = '',
    [string]$WorkingDirectory = $ProjectPath
  )
  if ([string]::IsNullOrWhiteSpace($Path) -or !(Test-Path -LiteralPath $Path)) {
    Write-WarnLine "$Label not found: $Path"
    return $false
  }
  $startParams = @{
    FilePath = $Path
    WorkingDirectory = $WorkingDirectory
  }
  if (-not [string]::IsNullOrWhiteSpace($Arguments)) {
    $startParams.ArgumentList = $Arguments
  }
  Start-Process @startParams | Out-Null
  Write-Ok "$Label started"
  return $true
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$webstormOptions = Join-Path $env:APPDATA 'JetBrains\WebStorm2026.1\options\mcpServer.xml'

Write-Step 'Ensuring WebStorm MCP Server is enabled'
if (Test-Path -LiteralPath $webstormOptions) {
  $xml = Get-Content -LiteralPath $webstormOptions -Raw
  if ($xml -notmatch 'enableMcpServer" value="true"') {
    $xml = $xml -replace 'enableMcpServer" value="false"', 'enableMcpServer" value="true"'
    Set-Content -LiteralPath $webstormOptions -Value $xml -Encoding UTF8
  }
  if ($xml -notmatch 'mcpServerPort" value="63343"') {
    $xml = $xml -replace 'mcpServerPort" value="\d+"', 'mcpServerPort" value="63343"'
    Set-Content -LiteralPath $webstormOptions -Value $xml -Encoding UTF8
  }
  Write-Ok 'WebStorm MCP settings verified'
} else {
  Write-WarnLine "WebStorm MCP options missing: $webstormOptions"
}

Write-Step 'Resolving GitHub token from gh CLI'
$githubToken = ''
try {
  $githubToken = (& gh auth token 2>$null | Out-String).Trim()
} catch {
  $githubToken = ''
}
if ([string]::IsNullOrWhiteSpace($githubToken)) {
  Write-WarnLine 'GitHub token not found in gh CLI. GitHub MCP stays disabled.'
} else {
  [Environment]::SetEnvironmentVariable('GITHUB_PERSONAL_ACCESS_TOKEN', $githubToken, 'User')
  $env:GITHUB_PERSONAL_ACCESS_TOKEN = $githubToken
  Write-Ok 'GitHub token saved to user environment'
}

Write-Step 'Applying MCP profile'
$env:MCP_PROJECT_PATH = $ProjectPath
$env:WEBSTORM_SSE_URL = 'http://127.0.0.1:63343/sse'
Push-Location $repoRoot
& node (Join-Path $repoRoot 'tools\configure-mcp-clients.mjs')
if ($LASTEXITCODE -ne 0) {
  throw "configure-mcp-clients.mjs failed with exit code $LASTEXITCODE"
}
Pop-Location
Write-Ok 'MCP profile applied'

Write-Step 'Restarting clients'
Stop-AppProcesses -Names @('Codex', 'codex')
Start-Sleep -Seconds 2

$codexExe = (Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | ForEach-Object {
  Join-Path $_.InstallLocation 'app\Codex.exe'
}) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $codexExe) {
  $codexExe = 'C:\Program Files\WindowsApps\OpenAI.Codex_26.623.13972.0_x64__2p2nqsd0c76g0\app\Codex.exe'
}
Start-App -Label 'Codex' -Path $codexExe | Out-Null

$webstormExe = 'C:\Program Files\JetBrains\WebStorm 2026.1.4\bin\webstorm64.exe'
if (Get-Process -Name webstorm64 -ErrorAction SilentlyContinue) {
  Stop-AppProcesses -Names @('webstorm64')
  Start-Sleep -Seconds 3
}
Start-App -Label 'WebStorm' -Path $webstormExe -Arguments "`"$ProjectPath`"" | Out-Null

Stop-AppProcesses -Names @('Code')
Start-Sleep -Seconds 1
Start-App -Label 'VS Code' -Path 'C:\Program Files\Microsoft VS Code\Code.exe' -Arguments "`"$ProjectPath`"" | Out-Null

Stop-AppProcesses -Names @('Devin')
Start-Sleep -Seconds 1
Start-App -Label 'Devin' -Path "$env:LOCALAPPDATA\Programs\Devin\Devin.exe" -Arguments "`"$ProjectPath`"" | Out-Null

$claudeExe = (Get-AppxPackage -Name 'Claude' -ErrorAction SilentlyContinue | ForEach-Object {
  Get-ChildItem $_.InstallLocation -Filter 'Claude.exe' -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}) | Where-Object { $_ } | Select-Object -First 1
if ($claudeExe) {
  Stop-AppProcesses -Names @('Claude')
  Start-Sleep -Seconds 1
  Start-App -Label 'Claude App' -Path $claudeExe | Out-Null
} else {
  Write-WarnLine 'Claude Desktop executable not found'
}

$windsurfExe = @(
  "$env:LOCALAPPDATA\Programs\Windsurf\Windsurf.exe",
  "$env:LOCALAPPDATA\Programs\Windsurf\windsurf.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($windsurfExe) {
  Stop-AppProcesses -Names @('Windsurf')
  Start-Sleep -Seconds 1
  Start-App -Label 'Windsurf' -Path $windsurfExe -Arguments "`"$ProjectPath`"" | Out-Null
} else {
  Write-WarnLine 'Windsurf executable not found. MCP config is ready when Windsurf is installed.'
}

if (Get-Process -Name Cursor -ErrorAction SilentlyContinue) {
  Write-Step 'Restarting Cursor'
  Stop-AppProcesses -Names @('Cursor')
  Start-Sleep -Seconds 2
  Start-App -Label 'Cursor' -Path "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe" -Arguments "`"$ProjectPath`"" | Out-Null
} else {
  Start-App -Label 'Cursor' -Path "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe" -Arguments "`"$ProjectPath`"" | Out-Null
}

Write-Step 'Waiting for WebStorm MCP endpoint'
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect('127.0.0.1', 63343, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(2000) -and $client.Connected) {
      $ready = $true
      $client.Close()
      break
    }
    $client.Close()
  } catch {
    # WebStorm may still be starting.
  }
  Start-Sleep -Seconds 2
}
if ($ready) {
  Write-Ok 'WebStorm MCP SSE endpoint is reachable on :63343'
} else {
  Write-WarnLine 'WebStorm MCP endpoint not reachable yet. Open WebStorm and confirm MCP Server is enabled.'
}

Write-Host ''
Write-Ok 'MCP rollout complete. Clients were restarted with the HUNDESALON profile.'
