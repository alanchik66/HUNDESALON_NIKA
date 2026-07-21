# Enable Cursor Agent "Run Everything" via Settings UI (in-memory must match DB).
# Requires Cursor window focused; uses SendKeys.
$ErrorActionPreference = 'Stop'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class YoloWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
Add-Type -AssemblyName System.Windows.Forms

$p = Get-Process Cursor -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle -match 'Cursor' } |
  Select-Object -First 1
if (-not $p) { throw 'Open Cursor first' }

$h = $p.MainWindowHandle
if ([YoloWin]::IsIconic($h)) { [void][YoloWin]::ShowWindow($h, 9) }
[void][YoloWin]::SetForegroundWindow($h)
Start-Sleep -Milliseconds 600

function K([string]$s, [int]$ms = 350) {
  [System.Windows.Forms.SendKeys]::SendWait($s)
  Start-Sleep -Milliseconds $ms
}

# Open Cursor Settings
K('^+p', 700)
K('Cursor Settings', 800)
K('{ENTER}', 1400)

# Agent / Auto-run section
foreach ($q in @('Auto-run', 'Run Everything', 'Auto-Run Mode', 'External-File Protection', 'MCP tools')) {
  K('^f', 250)
  K('^a', 150)
  $safe = $q -replace '([+\^%~(){}])', '{$1}'
  K($safe, 500)
  Write-Host "UI focus: $q"
}

# Leave search on Auto-run (primary)
K('^f', 250)
K('^a', 150)
K('Auto-run', 600)

Write-Host 'UI walk done. If Run Mode is not Run Everything, toggle it once — DB patch will stick after.'
Write-Host 'Then: Developer: Reload Window (Ctrl+Shift+P).'
