# HUNDESALON_NIKA — quiet WebStorm profile: MCP client acks, AI promo off, brave mode on.
# Usage:
#   .\tools\configure-webstorm-notifications.ps1
#   .\tools\configure-webstorm-notifications.ps1 -Restart

[CmdletBinding()]
param(
  [switch]$Restart,
  [string]$WebStormVersion = 'WebStorm2026.1',
  [string]$ProjectPath = 'D:\HUNDESALON_NIKA'
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

function Backup-File([string]$Path) {
  if (!(Test-Path -LiteralPath $Path)) { return }
  $backup = "$Path.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
  Copy-Item -LiteralPath $Path -Destination $backup -Force
  Write-Ok "Backup: $backup"
}

function Set-XmlOptionValue([string]$Path, [string]$ComponentName, [string]$OptionName, [string]$Value) {
  if (!(Test-Path -LiteralPath $Path)) {
    throw "Missing WebStorm options file: $Path"
  }

  [xml]$xml = Get-Content -LiteralPath $Path -Encoding UTF8
  $component = $xml.application.component | Where-Object { $_.name -eq $ComponentName } | Select-Object -First 1
  if (-not $component) {
    throw "Component '$ComponentName' not found in $Path"
  }

  $option = $component.option | Where-Object { $_.name -eq $OptionName } | Select-Object -First 1
  if ($option) {
    $option.value = $Value
  } else {
    $newOption = $xml.CreateElement('option')
    $newOption.SetAttribute('name', $OptionName)
    $newOption.SetAttribute('value', $Value)
    [void]$component.AppendChild($newOption)
  }

  $xml.Save($Path)
}

function Ensure-McpProcessedClients([string]$OptionsDir) {
  $path = Join-Path $OptionsDir 'mcpNotification.xml'
  if (!(Test-Path -LiteralPath $path)) {
    throw "Missing MCP notification settings: $path"
  }

  Backup-File $path

  $clients = @(
    'Claude App',
    'Codex',
    'Codex (Project)',
    'Cursor',
    'Devin',
    'Devin (alt)',
    'Grok Build',
    'VSCode',
    'VSCode (user)',
    'VSCode (workspace)',
    'Windsurf',
    'WebStorm import'
  ) | Sort-Object -Unique

  $entries = ($clients | ForEach-Object { "        <option value=`"$_`" />" }) -join "`n"
  $content = @"
<application>
  <component name="McpNotificationSettings">
    <option name="processedClients">
      <set>
$entries
      </set>
    </option>
  </component>
</application>
"@

  Set-Content -LiteralPath $path -Value $content -Encoding UTF8 -NoNewline
  Write-Ok "MCP client notifications suppressed ($($clients.Count) clients acknowledged)"
}

function Disable-AiOnboardingPromo([string]$OptionsDir) {
  $path = Join-Path $OptionsDir 'AIOnboardingPromoWindowAdvisor.xml'
  if (!(Test-Path -LiteralPath $path)) {
    Write-WarnLine 'AI onboarding promo file not found — skipped'
    return
  }

  Backup-File $path
  Set-XmlOptionValue $path 'AIOnboardingPromoWindowAdvisor' 'shouldShowNextTime' 'NO'
  Write-Ok 'AI onboarding promo disabled'
}

function Ensure-McpBraveMode([string]$OptionsDir) {
  $path = Join-Path $OptionsDir 'mcpServer.xml'
  if (!(Test-Path -LiteralPath $path)) {
    throw "Missing MCP server settings: $path"
  }

  Backup-File $path
  Set-XmlOptionValue $path 'McpServerSettings' 'enableBraveMode' 'true'
  Set-XmlOptionValue $path 'McpServerSettings' 'enableMcpServer' 'true'
  Set-XmlOptionValue $path 'McpServerSettings' 'mcpServerPort' '63343'
  Write-Ok 'MCP brave mode enabled (terminal/commands without confirmation)'
}

function Ensure-QuietNpmEnv {
  $vscodeSettings = Join-Path $ProjectPath '.vscode\settings.json'
  if (!(Test-Path -LiteralPath $vscodeSettings)) {
    Write-WarnLine 'VS Code settings not found — npm quiet env skipped'
    return
  }

  $raw = Get-Content -LiteralPath $vscodeSettings -Raw -Encoding UTF8
  if ($raw -match '"NPM_CONFIG_MIN_RELEASE_AGE"\s*:') {
    Write-Ok 'VS Code terminal already clears NPM_CONFIG_MIN_RELEASE_AGE'
    return
  }

  Backup-File $vscodeSettings

  $marker = '// ─── Quiet npm (no min-release-age warnings) ───'
  $block = @"
  $marker
  "terminal.integrated.env.windows": {
    "NPM_CONFIG_MIN_RELEASE_AGE": null
  },
"@

  if ($raw -match '"terminal\.integrated\.env\.windows"\s*:\s*\{') {
    if ($raw -notmatch '"NPM_CONFIG_MIN_RELEASE_AGE"') {
      $raw = $raw -replace '("terminal\.integrated\.env\.windows"\s*:\s*\{)', "`$1`n    `"NPM_CONFIG_MIN_RELEASE_AGE`": null,"
    }
  } else {
    $raw = $raw -replace '(\{)', "`$1`n$block"
  }

  Set-Content -LiteralPath $vscodeSettings -Value $raw -Encoding UTF8 -NoNewline
  Write-Ok 'VS Code/Cursor terminal: NPM_CONFIG_MIN_RELEASE_AGE cleared'
}

$optionsDir = Join-Path $env:APPDATA "JetBrains\$WebStormVersion\options"
if (!(Test-Path -LiteralPath $optionsDir)) {
  throw "WebStorm options directory not found: $optionsDir"
}

$running = [bool](Get-Process -Name 'webstorm64' -ErrorAction SilentlyContinue)
$optimizeScript = Join-Path $PSScriptRoot 'optimize-webstorm-memory.ps1'

if ($running -and -not $Restart) {
  Write-WarnLine 'WebStorm is running — config will be written after graceful shutdown.'
  Write-WarnLine 'Rerun with -Restart to apply now: npm run webstorm:restart'
}

if ($Restart -and $running -and (Test-Path -LiteralPath $optimizeScript)) {
  Write-Step 'Stopping WebStorm before writing notification settings...'
  & $optimizeScript -Restart -ProjectPath $ProjectPath
  $running = [bool](Get-Process -Name 'webstorm64' -ErrorAction SilentlyContinue)
  if ($running) {
    throw 'WebStorm is still running. Close it manually and rerun npm run webstorm:restart'
  }
}

Write-Step 'Applying quiet WebStorm profile for HUNDESALON_NIKA...'
Ensure-McpProcessedClients $optionsDir
Disable-AiOnboardingPromo $optionsDir
Ensure-McpBraveMode $optionsDir
Ensure-QuietNpmEnv

if (Test-Path -LiteralPath $optimizeScript) {
  if ($Restart) {
    Write-Step 'Starting WebStorm with optimized memory profile...'
    & $optimizeScript -OpenProject -ProjectPath $ProjectPath
  } else {
    & $optimizeScript -ProjectPath $ProjectPath
    if ($running) {
      Write-WarnLine 'Restart WebStorm once to apply notification + memory changes.'
    }
  }
}

Write-Ok 'Quiet WebStorm profile applied.'
