# Legacy wrapper. Applies the full HUNDESALON MCP profile via Node.js.
# Configures external MCP clients to connect to WebStorm's built-in MCP server.
# WebStorm auto-configure can fail when client apps lock their config files
# or when Codex TOML contains Windows paths with \U sequences.

[CmdletBinding()]
param(
  [string]$WebStormSseUrl = 'http://127.0.0.1:63343/sse',
  [string]$ProjectPath = 'C:\PROJEKT\HUNDESALON_NIKA'
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$env:MCP_PROJECT_PATH = $ProjectPath
$env:WEBSTORM_SSE_URL = $WebStormSseUrl
& node (Join-Path $repoRoot 'tools\configure-mcp-clients.mjs')
exit $LASTEXITCODE

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

function Read-JsonHashtable([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) {
    return [ordered]@{}
  }
  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return [ordered]@{}
  }
  $parsed = $raw | ConvertFrom-Json
  if ($null -eq $parsed) {
    return [ordered]@{}
  }
  return ConvertTo-Hashtable $parsed
}

function ConvertTo-Hashtable($InputObject) {
  if ($null -eq $InputObject) {
    return $null
  }

  if ($InputObject -is [System.Collections.IDictionary]) {
    $result = [ordered]@{}
    foreach ($key in $InputObject.Keys) {
      $result[$key] = ConvertTo-Hashtable $InputObject[$key]
    }
    return $result
  }

  if ($InputObject -is [System.Collections.IEnumerable] -and $InputObject -isnot [string]) {
    return @($InputObject | ForEach-Object { ConvertTo-Hashtable $_ })
  }

  if ($InputObject -is [pscustomobject]) {
    $result = [ordered]@{}
    foreach ($prop in $InputObject.PSObject.Properties) {
      $result[$prop.Name] = ConvertTo-Hashtable $prop.Value
    }
    return $result
  }

  return $InputObject
}

function Write-JsonFile([string]$Path, $Object) {
  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $json = $Object | ConvertTo-Json -Depth 20
  Set-Content -LiteralPath $Path -Value $json -Encoding UTF8
}

function Configure-JsonClient {
  param(
    [string]$Name,
    [string]$Path,
    [string]$ContainerKey,
    [hashtable]$ServerEntry
  )

  Write-Step "Configuring $Name at $Path"
  $data = Read-JsonHashtable $Path
  if (-not $data.Contains($ContainerKey) -or $null -eq $data[$ContainerKey]) {
    $data[$ContainerKey] = [ordered]@{}
  }

  foreach ($key in $ServerEntry.Keys) {
    $data[$ContainerKey][$key] = $ServerEntry[$key]
  }

  try {
    Write-JsonFile $Path $data
    Write-Ok "$Name configured"
    return $true
  } catch {
    Write-WarnLine "$Name failed: $($_.Exception.Message)"
    return $false
  }
}

function Ensure-CodexWebstormToml {
  param(
    [string]$Path
  )

  $block = @"

[mcp_servers.webstorm]
args = ["-y", "mcp-remote", "$WebStormSseUrl"]
command = "npx"
enabled = true
type = "stdio"
"@

  if (Test-Path -LiteralPath $Path) {
    $content = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ($content -match '(?ms)^\[mcp_servers\.webstorm\]') {
      Write-Ok "Codex config already contains webstorm: $Path"
      return $true
    }
    Add-Content -LiteralPath $Path -Value $block -Encoding UTF8
    Write-Ok "Codex config updated: $Path"
    return $true
  }

  $dir = Split-Path -Parent $Path
  if ($dir -and !(Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  Set-Content -LiteralPath $Path -Value $block.TrimStart() -Encoding UTF8
  Write-Ok "Codex config created: $Path"
  return $true
}

$webstormDir = 'C:\Program Files\JetBrains\WebStorm 2026.1.4'
$javaExe = Join-Path $webstormDir 'jbr\bin\java.exe'
$classpath = @(
  (Join-Path $webstormDir 'plugins\mcpserver\lib\mcpserver-frontend.jar')
  (Join-Path $webstormDir 'lib\util-8.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.kotlinx.coroutines.core.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.ktor.client.cio.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.ktor.client.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.ktor.network.tls.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.ktor.io.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.ktor.utils.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.kotlinx.io.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.kotlinx.serialization.core.jar')
  (Join-Path $webstormDir 'lib\intellij.libraries.kotlinx.serialization.json.jar')
) -join ';'

$results = [ordered]@{}

$results.VSCode = Configure-JsonClient `
  -Name 'VSCode' `
  -Path "$env:APPDATA\Code\User\mcp.json" `
  -ContainerKey 'servers' `
  -ServerEntry @{
    webstorm = @{
      url = $WebStormSseUrl
      type = 'sse'
    }
  }

$results.Cursor = Configure-JsonClient `
  -Name 'Cursor' `
  -Path "$env:USERPROFILE\.cursor\mcp.json" `
  -ContainerKey 'mcpServers' `
  -ServerEntry @{
    webstorm = @{
      url = $WebStormSseUrl
    }
  }

$results.'Claude App' = Configure-JsonClient `
  -Name 'Claude App' `
  -Path "$env:APPDATA\Claude\claude_desktop_config.json" `
  -ContainerKey 'mcpServers' `
  -ServerEntry @{
    webstorm = @{
      command = $javaExe
      args = @(
        '-classpath'
        $classpath
        'com.intellij.mcpserver.stdio.McpStdioRunnerKt'
      )
      env = @{
        IJ_MCP_SERVER_PORT = '63343'
      }
    }
  }

$results.Windsurf = Configure-JsonClient `
  -Name 'Windsurf' `
  -Path "$env:USERPROFILE\.codeium\windsurf\mcp_config.json" `
  -ContainerKey 'mcpServers' `
  -ServerEntry @{
    webstorm = @{
      serverUrl = $WebStormSseUrl
    }
  }

$results.Codex = Ensure-CodexWebstormToml -Path "$env:USERPROFILE\.codex\config.toml"
$results.'Codex (Project)' = Ensure-CodexWebstormToml -Path (Join-Path $ProjectPath '.codex\config.toml')

$tmpFiles = @(
  "$env:APPDATA\Code\User\mcp.json.tmp"
  "$env:USERPROFILE\.cursor\mcp.json.tmp"
  "$env:APPDATA\Claude\claude_desktop_config.json.tmp"
  "$env:USERPROFILE\.codeium\windsurf\mcp_config.json.tmp"
)
foreach ($tmp in $tmpFiles) {
  if (Test-Path -LiteralPath $tmp) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ''
Write-Host 'WebStorm MCP client configuration summary:' -ForegroundColor White
foreach ($entry in $results.GetEnumerator()) {
  $color = if ($entry.Value) { 'Green' } else { 'Yellow' }
  Write-Host ("  {0}: {1}" -f $entry.Key, ($(if ($entry.Value) { 'OK' } else { 'FAILED' }))) -ForegroundColor $color
}

$failed = @($results.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key })
if ($failed.Count -gt 0) {
  Write-Host ''
  Write-WarnLine "Some clients are still locked. Close VS Code, Cursor, Claude, Windsurf and rerun:"
  Write-Host "  npm run mcp:configure-clients" -ForegroundColor Gray
  exit 1
}

Write-Host ''
Write-Ok 'All MCP clients configured. Restart each client to apply changes.'
exit 0
