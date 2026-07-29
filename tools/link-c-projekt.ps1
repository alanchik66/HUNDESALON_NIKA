#Requires -Version 5.1
<#
.SYNOPSIS
  Canonical-root guard for the project.

  The project now lives at C:\PROJEKT\HUNDESALON_NIKA.
  This helper verifies the canonical root without creating junctions.
#>
$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\PROJEKT\HUNDESALON_NIKA'

if (-not (Test-Path "$projectRoot\package.json")) {
  throw "Real project missing: $projectRoot\package.json"
}

Write-Host "OK: canonical root is $projectRoot"
Write-Host 'The previous removable-drive root is retired.'
Write-Host "Do not recreate a removable-drive junction; use $projectRoot directly."
