# Apply professional Cursor Settings: files/DB + UI walk
# Requires: Cursor window open; sqlite3.exe in %TEMP%
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host '[1/3] Apply reactive storage + privacy keys'
node "$Root\tools\cursor-settings-apply.mjs"

Write-Host '[2/3] Ensure cmd+, opens Cursor Settings'
$settings = Join-Path $env:APPDATA 'Cursor\User\settings.json'
$raw = [IO.File]::ReadAllText($settings)
if ($raw -notmatch 'cursor\.cmdCommaOpensCursorSettings') {
  $raw = $raw -replace '("cursor\.composer\.shouldChime")', "`"cursor.cmdCommaOpensCursorSettings`": true,`r`n  `$1"
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [IO.File]::WriteAllText($settings, $raw, $utf8)
}

Write-Host '[3/3] UI: open Cursor Settings and walk sections'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win2 {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
Add-Type -AssemblyName System.Windows.Forms

$p = Get-Process Cursor | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'Cursor' } | Select-Object -First 1
if (-not $p) { throw 'Open Cursor first' }
$h = $p.MainWindowHandle
if ([Win2]::IsIconic($h)) { [void][Win2]::ShowWindow($h, 9) }
[void][Win2]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 500

function K([string]$s) {
  [System.Windows.Forms.SendKeys]::SendWait($s)
  Start-Sleep -Milliseconds 350
}

K('^+p'); Start-Sleep -Milliseconds 600
K('Cursor Settings'); Start-Sleep -Milliseconds 700
K('{ENTER}'); Start-Sleep -Milliseconds 1000

foreach ($q in @('Privacy Mode','Indexing','Semantic Search','Cursor Tab','Run Mode','Auto-run','Bugbot','Attribution','Models','MCP')) {
  K('^f'); Start-Sleep -Milliseconds 200; K('^a')
  $safe = $q -replace '([+\^%~(){}])', '{$1}'
  K($safe); Start-Sleep -Milliseconds 450
  Write-Host "  UI: $q"
}

K('^f'); Start-Sleep -Milliseconds 200; K('^a'); K('Privacy Mode')
Write-Host 'Done. Reload Window if toggles look stale, then npm run cursor:settings'
