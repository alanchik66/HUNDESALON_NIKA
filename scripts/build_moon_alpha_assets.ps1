Param(
  [string]$srcDir = (Join-Path $PSScriptRoot "..\3d-weather-codrops-main\dist-widget\assets\Moon"),
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

function Build-Job {
  param(
    [string]$Exe,
    [string]$Source,
    [string]$AlphaMov,
    [string]$AlphaWebm,
    [string]$FallbackMp4,
    [int]$WebmScaleWidth,
    [int]$WebmBitrate
  )

  if (-not (Test-Path -LiteralPath $Source)) {
    throw "Missing source video: $Source"
  }

  $key = "format=rgba,colorkey=0x000000:0.085:0.055"
  $webmScale = "format=yuva420p"
  if ($WebmScaleWidth -gt 0) {
    $webmScale = "scale=${WebmScaleWidth}:-2,format=yuva420p"
  }

  $filter = "[0:v]$key,split=3[movsrc][webmsrc][mp4src];" +
    "[movsrc]format=argb[movout];" +
    "[webmsrc]$webmScale[webmout];" +
    "[mp4src]scale=1920:-2,format=yuv420p[mp4out]"

  $args = @(
    "-y",
    "-i", $Source,
    "-filter_complex", $filter,
    "-map", "[movout]",
    "-c:v", "qtrle",
    "-pix_fmt", "argb",
    "-an",
    $AlphaMov,
    "-map", "[webmout]",
    "-c:v", "libvpx-vp9",
    "-b:v", "$($WebmBitrate)k",
    "-pix_fmt", "yuva420p",
    "-auto-alt-ref", "0",
    "-deadline", "good",
    "-cpu-used", "4",
    "-row-mt", "1",
    "-tile-columns", "2",
    "-threads", "8",
    "-metadata:s:v:0", "alpha_mode=1",
    $AlphaWebm,
    "-map", "[mp4out]",
    "-c:v", "libx264",
    "-crf", "20",
    "-preset", "medium",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-an",
    $FallbackMp4
  )

  Invoke-Ffmpeg -Exe $Exe -Arguments $args
}

$resolvedSrc = (Resolve-Path -LiteralPath $srcDir -ErrorAction Stop).Path
$ffmpegPath = Resolve-Tool -Name $ffmpeg -LocalRelativePath "..\tools\ffmpeg\bin\ffmpeg.exe"

if (-not $ffmpegPath) {
  throw "ffmpeg was not found in PATH or tools\ffmpeg\bin."
}

$versionOutput = & $ffmpegPath -version 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "ffmpeg -version failed."
}

if (($versionOutput -join "`n") -notmatch "enable-libvpx") {
  throw "This ffmpeg build does not report --enable-libvpx."
}

Push-Location -LiteralPath $resolvedSrc
try {
  $jobs = @(
    [pscustomobject]@{
      Source         = "mission_2160p1.mp4"
      AlphaMov       = "mission_2160p1_alpha.mov"
      AlphaWebm      = "mission_2160p1_alpha_2160.webm"
      FallbackMp4    = "mission_2160p1_alpha_fallback_1080.mp4"
      WebmScaleWidth = 0
      WebmBitrate    = $bitrate4k
    },
    [pscustomobject]@{
      Source         = "mission_1080p30.mp4"
      AlphaMov       = "mission_1080p30_alpha.mov"
      AlphaWebm      = "mission_1080p30_alpha_1080.webm"
      FallbackMp4    = "mission_1080p30_alpha_fallback_1080.mp4"
      WebmScaleWidth = 1920
      WebmBitrate    = $bitrate1080
    }
  )

  foreach ($job in $jobs) {
    Build-Job `
      -Exe $ffmpegPath `
      -Source $job.Source `
      -AlphaMov $job.AlphaMov `
      -AlphaWebm $job.AlphaWebm `
      -FallbackMp4 $job.FallbackMp4 `
      -WebmScaleWidth $job.WebmScaleWidth `
      -WebmBitrate $job.WebmBitrate
  }

  Write-Host "Done. Moon alpha assets were written to $resolvedSrc"
}
finally {
  Pop-Location
}
