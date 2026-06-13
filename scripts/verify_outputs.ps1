Param(
  [string]$srcDir = (Join-Path $PSScriptRoot "..\3d-weather-codrops-main\dist-widget\assets\Moon"),
  [string]$ffmpeg = "ffmpeg",
  [string]$ffprobe = "ffprobe"
)

$ErrorActionPreference = "Stop"
$script:issues = @()

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

function Add-Issue {
  param([string]$Message)

  $script:issues += $Message
  Write-Warning $Message
}

function Format-SizeMb {
  param([long]$Bytes)

  return "{0:N2} MB" -f ($Bytes / 1MB)
}

function Inspect-Media {
  param(
    [string]$ProbeExe,
    [string]$FilePath
  )

  $json = & $ProbeExe `
    -v error `
    -select_streams v:0 `
    -show_entries "stream=codec_name,pix_fmt,width,height:stream_tags=alpha_mode" `
    -of json `
    $FilePath 2>$null

  if ($LASTEXITCODE -ne 0 -or -not $json) {
    Add-Issue "ffprobe failed for $FilePath"
    return
  }

  $data = $json | ConvertFrom-Json
  if (-not $data.streams -or $data.streams.Count -lt 1) {
    Add-Issue "No video stream found in $FilePath"
    return
  }

  $stream = $data.streams[0]
  $alphaMode = ""
  if ($stream.tags -and $stream.tags.alpha_mode) {
    $alphaMode = $stream.tags.alpha_mode
  }

  Write-Host ("{0}: codec={1}; pix_fmt={2}; alpha_mode={3}; size={4}x{5}" -f `
      ([System.IO.Path]::GetFileName($FilePath)), `
      $stream.codec_name, `
      $stream.pix_fmt, `
      $alphaMode, `
      $stream.width, `
      $stream.height)

  $ext = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()

  if ($ext -eq ".webm") {
    if ($stream.codec_name -ne "vp9") {
      Add-Issue "WebM must use VP9: $FilePath"
    }

    if (($stream.pix_fmt -notmatch "yuva|rgba|argb|bgra") -and $alphaMode -ne "1") {
      Add-Issue "WebM alpha was not detected by ffprobe: $FilePath"
    }
  }
  elseif ($ext -eq ".mov") {
    if (($stream.pix_fmt -notmatch "yuva|rgba|argb|bgra") -and ($stream.codec_name -notmatch "qtrle")) {
      Add-Issue "MOV alpha was not detected by ffprobe: $FilePath"
    }
  }
  elseif ($ext -eq ".mp4") {
    if ($stream.codec_name -ne "h264") {
      Add-Issue "MP4 fallback must use H.264: $FilePath"
    }

    if ($stream.pix_fmt -ne "yuv420p") {
      Add-Issue "MP4 fallback must use yuv420p: $FilePath"
    }
  }
}

$requiredFiles = @(
  "mission_2160p1_alpha.mov",
  "mission_2160p1_alpha_2160.webm",
  "mission_2160p1_alpha_fallback_1080.mp4",
  "mission_1080p30_alpha.mov",
  "mission_1080p30_alpha_1080.webm",
  "mission_1080p30_alpha_fallback_1080.mp4"
)

$resolvedSrc = (Resolve-Path -LiteralPath $srcDir -ErrorAction Stop).Path
Write-Host "Checking Moon assets in $resolvedSrc"

$existingFiles = @()
foreach ($file in $requiredFiles) {
  $fullPath = Join-Path -Path $resolvedSrc -ChildPath $file
  if (Test-Path -LiteralPath $fullPath) {
    $item = Get-Item -LiteralPath $fullPath
    $existingFiles += $fullPath
    Write-Host ("OK      {0} ({1})" -f $file, (Format-SizeMb -Bytes $item.Length))
  }
  else {
    Add-Issue "Missing required file: $file"
  }
}

$ffmpegPath = Resolve-Tool -Name $ffmpeg -LocalRelativePath "..\tools\ffmpeg\bin\ffmpeg.exe"
if (-not $ffmpegPath) {
  Add-Issue "ffmpeg was not found in PATH or tools\ffmpeg\bin."
}
else {
  $versionOutput = & $ffmpegPath -version 2>&1
  if ($LASTEXITCODE -ne 0 -or -not $versionOutput) {
    Add-Issue "ffmpeg -version failed."
  }
  else {
    Write-Host ("ffmpeg: {0}" -f $versionOutput[0])
    if (($versionOutput -join "`n") -notmatch "enable-libvpx") {
      Add-Issue "ffmpeg does not report --enable-libvpx."
    }
  }
}

$ffprobePath = Resolve-Tool -Name $ffprobe -LocalRelativePath "..\tools\ffmpeg\bin\ffprobe.exe"
if (-not $ffprobePath) {
  Add-Issue "ffprobe was not found in PATH or tools\ffmpeg\bin."
}
else {
  foreach ($filePath in $existingFiles) {
    Inspect-Media -ProbeExe $ffprobePath -FilePath $filePath
  }
}

if ($script:issues.Count -gt 0) {
  Write-Host ("Verification failed with {0} issue(s)." -f $script:issues.Count) -ForegroundColor Red
  exit 1
}

Write-Host "All required Moon alpha outputs are present and valid."
