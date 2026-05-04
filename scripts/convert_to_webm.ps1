Param(
  [string]$srcDir = "C:\laragon\www\HUNDESALON_NIKA\3d-weather-codrops-main\dist-widget\assets\Moon",
  [int]$bitrate4k = 8000,
  [int]$bitrate1080 = 4000,
  [string]$ffmpeg = "ffmpeg"
)

$ErrorActionPreference = "Stop"

function Resolve-Tool {
  param(
    [string]$Name,
    [string]$LocalRelativePath
  )

  if (Test-Path -LiteralPath $Name) {
    return (Resolve-Path -LiteralPath $Name).Path
  }

  $command = Get-Command -Name $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $localPath = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot $LocalRelativePath) -ErrorAction SilentlyContinue
  if ($localPath) {
    return $localPath.Path
  }

  return $null
}

function Format-CommandArgs {
  param([string[]]$ArgsList)

  return (($ArgsList | ForEach-Object {
        if ($_ -match "\s") { '"' + $_ + '"' } else { $_ }
      }) -join " ")
}

function Invoke-Ffmpeg {
  param(
    [string]$Exe,
    [string[]]$Arguments
  )

  Write-Host ("Running: {0} {1}" -f $Exe, (Format-CommandArgs -ArgsList $Arguments))
  & $Exe @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed with exit code $LASTEXITCODE."
  }
}

function Convert-WithAlpha {
  param(
    [string]$Exe,
    [string]$Mov,
    [string]$OutWebm,
    [int]$ScaleWidth,
    [int]$Bitrate
  )

  $args = @("-y", "-i", $Mov)

  if ($ScaleWidth -gt 0) {
    $args += @("-vf", "scale=${ScaleWidth}:-2")
  }

  $args += @(
    "-c:v", "libvpx-vp9",
    "-b:v", "$($Bitrate)k",
    "-pix_fmt", "yuva420p",
    "-auto-alt-ref", "0",
    $OutWebm
  )

  Invoke-Ffmpeg -Exe $Exe -Arguments $args
}

function Convert-FallbackMp4 {
  param(
    [string]$Exe,
    [string]$Mov,
    [string]$OutMp4
  )

  $args = @(
    "-y",
    "-i", $Mov,
    "-vf", "scale=1920:-2",
    "-c:v", "libx264",
    "-crf", "20",
    "-preset", "medium",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    $OutMp4
  )

  Invoke-Ffmpeg -Exe $Exe -Arguments $args
}

$resolvedSrc = (Resolve-Path -LiteralPath $srcDir -ErrorAction Stop).Path

$jobs = @(
  [pscustomobject]@{
    Mov        = "mission_2160p1_alpha.mov"
    Webm       = "mission_2160p1_alpha_2160.webm"
    ScaleWidth = 0
    Bitrate    = $bitrate4k
  },
  [pscustomobject]@{
    Mov        = "mission_1080p30_alpha.mov"
    Webm       = "mission_1080p30_alpha_1080.webm"
    ScaleWidth = 1920
    Bitrate    = $bitrate1080
  }
)

Push-Location -LiteralPath $resolvedSrc
try {
  $availableJobs = @()

  foreach ($job in $jobs) {
    if (Test-Path -LiteralPath $job.Mov) {
      $availableJobs += $job
    }
    else {
      Write-Warning "Missing alpha MOV: $($job.Mov). Export it from After Effects first."
    }
  }

  if ($availableJobs.Count -eq 0) {
    throw "No alpha MOV files were found in $resolvedSrc."
  }

  $ffmpegPath = Resolve-Tool -Name $ffmpeg -LocalRelativePath "..\tools\ffmpeg\bin\ffmpeg.exe"
  if (-not $ffmpegPath) {
    throw "ffmpeg was not found in PATH or tools\ffmpeg\bin. Install ffmpeg with libvpx support first."
  }

  $versionOutput = & $ffmpegPath -version 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg -version failed."
  }

  if (($versionOutput -join "`n") -notmatch "enable-libvpx") {
    throw "This ffmpeg build does not report --enable-libvpx. VP9 alpha WebM export is not safe with this build."
  }

  foreach ($job in $availableJobs) {
    Convert-WithAlpha `
      -Exe $ffmpegPath `
      -Mov $job.Mov `
      -OutWebm $job.Webm `
      -ScaleWidth $job.ScaleWidth `
      -Bitrate $job.Bitrate

    $fallback = ([System.IO.Path]::GetFileNameWithoutExtension($job.Mov)) + "_fallback_1080.mp4"

    Convert-FallbackMp4 `
      -Exe $ffmpegPath `
      -Mov $job.Mov `
      -OutMp4 $fallback
  }

  Write-Host "Done. Check files in $resolvedSrc"
}
finally {
  Pop-Location
}
