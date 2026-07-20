# Detached: kill Cursor → reset commit-provider state → reopen project.
# Launched by agent so it survives after Cursor exits.
$ErrorActionPreference = "Continue"
$log = Join-Path $env:TEMP "hundesalon-cursor-commit-fix.log"
function Log($m) { "$(Get-Date -Format o) $m" | Tee-Object -FilePath $log -Append }

Log "START fix+restart"

# Give the agent a moment to finish the reply
Start-Sleep -Seconds 3

$cursorExe = @(
  "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe",
  "$env:LOCALAPPDATA\Programs\Cursor\Cursor.exe",
  "${env:ProgramFiles}\Cursor\Cursor.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $cursorExe) {
  Log "Cursor.exe not found"
  exit 1
}
Log "Cursor exe: $cursorExe"

Log "Stopping Cursor processes..."
Get-Process -Name "Cursor","Cursor Helper*" -ErrorAction SilentlyContinue | ForEach-Object {
  try { $_.CloseMainWindow() | Out-Null } catch {}
}
Start-Sleep -Seconds 2
Get-Process -Name "Cursor*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Wait until gone (max 30s)
$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
  $left = @(Get-Process -Name "Cursor*" -ErrorAction SilentlyContinue)
  if (-not $left.Count) { break }
  Log "Still running: $($left.Count)"
  $left | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
}

$fix = "D:\HUNDESALON_NIKA\tools\fix-cursor-commit-provider.ps1"
Log "Running $fix"
& powershell -NoProfile -ExecutionPolicy Bypass -File $fix
Log "fix exit=$LASTEXITCODE"

Start-Sleep -Seconds 1
Log "Reopening project"
Start-Process -FilePath $cursorExe -ArgumentList @("D:\HUNDESALON_NIKA")
Log "DONE"
