# Add Windows Defender exclusions for HUNDESALON MCP tooling (admin via gsudo).
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$paths = @(
  'D:\HUNDESALON_NIKA\tools',
  'D:\HUNDESALON_NIKA\tools\restart-hundesalon-mcp.ps1',
  'D:\HUNDESALON_NIKA\tools\restart-hundesalon-mcp.cmd'
)
$processes = @(
  'D:\HUNDESALON_NIKA\tools\restart-hundesalon-mcp.ps1'
)

foreach ($p in $paths) {
  if (Test-Path -LiteralPath $p) {
    Add-MpPreference -ExclusionPath $p -ErrorAction Stop
    Write-Host "ExclusionPath: $p"
  }
}
foreach ($p in $processes) {
  Add-MpPreference -ExclusionProcess $p -ErrorAction SilentlyContinue
  Write-Host "ExclusionProcess: $p"
}
Write-Host 'Defender exclusions applied.'
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath | Where-Object { $_ -like '*HUNDESALON*' }
