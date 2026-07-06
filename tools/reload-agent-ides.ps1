# Reload open IDE windows so terminal.integrated.env and MCP configs apply.
$ErrorActionPreference = 'SilentlyContinue'

$project = 'C:\PROJEKT\HUNDESALON_NIKA'
$reloads = @(
  @{ Name = 'Cursor'; Cmd = 'cursor.cmd' },
  @{ Name = 'VS Code'; Cmd = 'code.cmd' }
)

Write-Host '== Reloading IDE windows ==' -ForegroundColor Cyan

foreach ($item in $reloads) {
  $cmd = Get-Command $item.Cmd -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Write-Host "  skip $($item.Name) (CLI not found)" -ForegroundColor DarkGray
    continue
  }

  $proc = Get-Process ($item.Name -replace ' ', '') -ErrorAction SilentlyContinue
  if (-not $proc) {
    $alt = if ($item.Name -eq 'VS Code') { Get-Process Code -ErrorAction SilentlyContinue } else { $null }
    $proc = $alt
  }

  if ($proc) {
    & $cmd.Source --command workbench.action.reloadWindow $project 2>$null
    Write-Host "  reloaded $($item.Name)" -ForegroundColor Green
  } else {
    Write-Host "  $($item.Name) not running (env vars apply on next launch)" -ForegroundColor DarkGray
  }
}

$ws = Get-Process webstorm64 -ErrorAction SilentlyContinue
if ($ws) {
  Write-Host '  WebStorm: restart File -> Invalidate Caches or reopen project for new env' -ForegroundColor Yellow
} else {
  Write-Host '  WebStorm not running' -ForegroundColor DarkGray
}

Write-Host 'Done.' -ForegroundColor Green
