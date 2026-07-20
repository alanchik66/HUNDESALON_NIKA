# Restart HUNDESALON Playwright (:8931) + Graphify (:8932) MCP servers.
# File-based launcher — avoid pwsh -c with kill/hidden/CIM heuristics (Defender FP).
#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Root = 'D:\HUNDESALON_NIKA',
  [switch]$SkipStart
)

$ErrorActionPreference = 'Continue'
$node = Join-Path ${env:ProgramFiles} 'nodejs\node.exe'
$playwright = Join-Path $Root 'tools\playwright-mcp-serve.mjs'
$graphify = Join-Path $Root 'tools\graphify-mcp-serve.mjs'

function Stop-ListenersOnPort([int]$Port) {
  $pids = @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  )
  foreach ($procId in $pids) {
    if ($procId -and $procId -gt 0) {
      Stop-Process -Id $procId -ErrorAction SilentlyContinue
      Write-Host "Stopped PID $procId on :$Port"
    }
  }
}

function Test-PortOpen([int]$Port) {
  return [bool](
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  )
}

if (-not (Test-Path -LiteralPath $node)) { throw "node.exe not found: $node" }
if (-not (Test-Path -LiteralPath $playwright)) { throw "Missing $playwright" }
if (-not (Test-Path -LiteralPath $graphify)) { throw "Missing $graphify" }

Write-Host 'Stopping MCP listeners on 8931/8932...'
Stop-ListenersOnPort 8931
Stop-ListenersOnPort 8932
Start-Sleep -Seconds 1

if ($SkipStart) {
  Write-Host 'SkipStart set — done.'
  exit 0
}

Write-Host 'Starting MCP serve scripts...'
# Direct start only (no -WindowStyle Hidden). Logon tasks remain for boot; this script is for manual restart.
Start-Process -FilePath $node -ArgumentList "`"$playwright`"" -WorkingDirectory $Root
Start-Process -FilePath $node -ArgumentList "`"$graphify`"" -WorkingDirectory $Root

$deadline = (Get-Date).AddSeconds(12)
do {
  Start-Sleep -Milliseconds 800
  $p8931 = Test-PortOpen 8931
  $p8932 = Test-PortOpen 8932
} while ((-not ($p8931 -and $p8932)) -and (Get-Date) -lt $deadline)

Write-Host "port 8931 = $p8931"
Write-Host "port 8932 = $p8932"
if (-not ($p8931 -and $p8932)) { exit 1 }
