# Register periodic SEO watch (Bing Site Scan + Google Search Console).
# Run once: npm run seo:watch:install
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$taskName = 'HUNDESALON-SEO-Search-Watch'
$intervalMinutes = [int]($env:SEO_WATCH_INTERVAL_MINUTES ?? '30')

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue)?.Source
if (-not $npm) {
  $npm = (Get-Command npm -ErrorAction SilentlyContinue)?.Source
}
if (-not $npm) {
  throw 'npm not found in PATH'
}

$action = New-ScheduledTaskAction -Execute $npm -Argument 'run seo:watch' -WorkingDirectory $root
$start = (Get-Date).AddMinutes(2)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
  -RepetitionInterval (New-TimeSpan -Minutes $intervalMinutes) `
  -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Scheduled task '$taskName' every $intervalMinutes min."
Write-Host "WorkingDirectory: $root"
Write-Host "Manual run: npm run seo:watch"
Write-Host "Until Bing scan completes: npm run seo:watch:until-done"
