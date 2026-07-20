#Requires -Version 5.1
<#
.SYNOPSIS
  Optional: point C:\PROJEKT\HUNDESALON_NIKA -> D:\HUNDESALON_NIKA (junction).

  Canonical project content lives on D:\HUNDESALON_NIKA.
  Creating C:\PROJEKT is allowed — this only links the HUNDESALON folder if you want it.
#>
$ErrorActionPreference = 'Stop'
$c = 'C:\PROJEKT\HUNDESALON_NIKA'
$d = 'D:\HUNDESALON_NIKA'

if (-not (Test-Path "$d\package.json")) {
  throw "Real project missing: $d\package.json"
}

New-Item -ItemType Directory -Path 'C:\PROJEKT' -Force | Out-Null

if (Test-Path $c) {
  $item = Get-Item $c -Force
  if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    Write-Host "Already linked:" $c
    cmd /c "dir `"$c\package.json`""
    exit 0
  }
  $n = @(Get-ChildItem $c -Force -ErrorAction SilentlyContinue).Count
  if ($n -gt 0) {
    throw "C path is not empty ($n items). Move/backup first: $c"
  }
  Remove-Item $c -Force
}

cmd /c "mklink /J `"$c`" `"$d`""
if (-not (Test-Path "$c\package.json")) {
  throw 'Junction created but package.json not visible'
}
Write-Host "OK: $c  =>  $d"
cmd /c "dir `"$c\package.json`""
