# Fix: "Failed to apply diffs from Cloud Agent: No full commit provider registered"
# Cursor bug: vscode.git / full commit provider never registers (wedged exthost / bad workspace state).
# Close Cursor completely first, then run:
#   powershell -ExecutionPolicy Bypass -File tools\fix-cursor-commit-provider.ps1

$ErrorActionPreference = "Stop"

$cursorProcs = Get-Process -Name "Cursor","Cursor Helper*" -ErrorAction SilentlyContinue
if ($cursorProcs) {
  Write-Host "Cursor is still running ($($cursorProcs.Count) processes). Quit Cursor fully (not just close window), then re-run."
  exit 2
}

$wsRoot = Join-Path $env:APPDATA "Cursor\User\workspaceStorage"
$backup = Join-Path $env:USERPROFILE ("Cursor-workspace-state-backup-" + (Get-Date -Format "yyyyMMddTHHmmss"))
New-Item -ItemType Directory -Path $backup -Force | Out-Null

$targets = @()
Get-ChildItem $wsRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
  $wj = Join-Path $_.FullName "workspace.json"
  if (-not (Test-Path $wj)) { return }
  $raw = Get-Content $wj -Raw
  if ($raw -match "HUNDESALON_NIKA") {
    $targets += $_.Name
  }
}

if (-not $targets.Count) {
  Write-Host "No HUNDESALON_NIKA workspaceStorage entries found."
} else {
  Write-Host "Resetting workspace state for: $($targets -join ', ')"
}

foreach ($id in $targets) {
  $base = Join-Path $wsRoot $id
  $dest = Join-Path $backup $id
  New-Item -ItemType Directory -Path $dest -Force | Out-Null
  foreach ($name in @("state.vscdb", "state.vscdb.backup", "state.vscdb-shm", "state.vscdb-wal")) {
    $src = Join-Path $base $name
    if (Test-Path $src) {
      Move-Item -LiteralPath $src -Destination (Join-Path $dest $name) -Force
      Write-Host "Moved $id\$name"
    }
  }
  Copy-Item (Join-Path $base "workspace.json") (Join-Path $dest "workspace.json") -Force -ErrorAction SilentlyContinue
}

foreach ($name in @("Cache", "CachedData", "Code Cache", "GPUCache")) {
  $path = Join-Path $env:APPDATA "Cursor\$name"
  if (Test-Path $path) {
    $dest = Join-Path $backup $name
    Move-Item -LiteralPath $path -Destination $dest -Force
    Write-Host "Moved Cursor\$name"
  }
}

Write-Host ""
Write-Host "BACKUP=$backup"
Write-Host "Reopen Cursor on D:\HUNDESALON_NIKA, then check Source Control shows the repo."
Write-Host "Cloud Agent apply should work again; or pull merged cloud PRs with git."
