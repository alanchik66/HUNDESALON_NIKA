# Keep display/system awake while Cursor.exe is running.
# Started hidden via Startup; uses SetThreadExecutionState.
$ErrorActionPreference = 'SilentlyContinue'

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Awake {
  [DllImport("kernel32.dll")]
  public static extern uint SetThreadExecutionState(uint esFlags);
  public const uint ES_CONTINUOUS = 0x80000000;
  public const uint ES_SYSTEM_REQUIRED = 0x00000001;
  public const uint ES_DISPLAY_REQUIRED = 0x00000002;
  public static void KeepOn() {
    SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED);
  }
  public static void Clear() {
    SetThreadExecutionState(ES_CONTINUOUS);
  }
}
"@

$log = Join-Path $env:TEMP 'cursor-keep-awake.log'
function Log([string]$m) {
  ("{0:u} {1}" -f (Get-Date), $m) | Add-Content -Path $log -Encoding utf8
}

Log 'start'
$holding = $false
while ($true) {
  $running = @(Get-Process -Name 'Cursor' -ErrorAction SilentlyContinue)
  if ($running.Count -gt 0) {
    [Awake]::KeepOn()
    if (-not $holding) { Log "hold ON (Cursor PIDs=$($running.Count))"; $holding = $true }
  } else {
    if ($holding) {
      [Awake]::Clear()
      Log 'hold OFF (Cursor exited)'
      $holding = $false
    }
  }
  Start-Sleep -Seconds 15
}
