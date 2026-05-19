$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root 'assets/images/logo.png'
$imagesDir = Join-Path $root 'assets/images'
$faviconDir = Join-Path $imagesDir 'favicon'

Add-Type -AssemblyName System.Drawing

function New-Canvas {
  param([int]$Width, [int]$Height)

  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Png {
  param($Bitmap, [string]$Path)

  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Get-ImageAlphaBounds {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$AlphaThreshold = 8
  )

  $minX = $Bitmap.Width
  $minY = $Bitmap.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $Bitmap.Height; $y++) {
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
      if ($Bitmap.GetPixel($x, $y).A -gt $AlphaThreshold) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt 0 -or $maxY -lt 0) {
    return New-Object System.Drawing.Rectangle 0, 0, $Bitmap.Width, $Bitmap.Height
  }

  $bleed = [Math]::Max(4, [Math]::Round([Math]::Max($Bitmap.Width, $Bitmap.Height) * 0.012))
  $left = [Math]::Max(0, $minX - $bleed)
  $top = [Math]::Max(0, $minY - $bleed)
  $right = [Math]::Min($Bitmap.Width - 1, $maxX + $bleed)
  $bottom = [Math]::Min($Bitmap.Height - 1, $maxY + $bleed)

  return New-Object System.Drawing.Rectangle $left, $top, ($right - $left + 1), ($bottom - $top + 1)
}

function Get-FittedSquareRect {
  param(
    [System.Drawing.Rectangle]$SourceRect,
    [int]$Size,
    [int]$Padding
  )

  $fitSize = [Math]::Max(1, $Size - ($Padding * 2))
  $scale = [Math]::Min($fitSize / [double]$SourceRect.Width, $fitSize / [double]$SourceRect.Height)
  $drawWidth = [Math]::Max(1, [Math]::Round($SourceRect.Width * $scale))
  $drawHeight = [Math]::Max(1, [Math]::Round($SourceRect.Height * $scale))
  $x = [Math]::Round(($Size - $drawWidth) / 2)
  $y = [Math]::Round(($Size - $drawHeight) / 2)

  return New-Object System.Drawing.Rectangle $x, $y, $drawWidth, $drawHeight
}

function Get-EdgePaddingPx {
  param(
    [int]$Size,
    [double]$EdgeRatio
  )

  if ($EdgeRatio -le 0) {
    return 0
  }

  return [Math]::Max(1, [Math]::Round($Size * $EdgeRatio))
}

function New-BrandIconPng {
  param(
    [System.Drawing.Bitmap]$Source,
    [int]$Size,
    [string]$OutputPath,
    [double]$EdgeRatio = 0.02
  )

  $canvas = New-Canvas -Width $Size -Height $Size
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $srcRect = Get-ImageAlphaBounds -Bitmap $Source
    $padding = Get-EdgePaddingPx -Size $Size -EdgeRatio $EdgeRatio
    $dstRect = Get-FittedSquareRect -SourceRect $srcRect -Size $Size -Padding $padding
    $graphics.DrawImage($Source, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    Save-Png -Bitmap $bitmap -Path $OutputPath
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

# Trim only transparent "air" via Get-ImageAlphaBounds; keep a tiny anti-clip edge for OS chrome.
$standardEdgeRatio = 0.02
$touchEdgeRatio = 0.03
# Maskable safe zone (~80% diameter) without the old 38% empty frame.
$maskableEdgeRatio = 0.10

function New-LogoPng {
  param([System.Drawing.Image]$Source, [int]$Size, [string]$OutputPath)

  $canvas = New-Canvas -Width $Size -Height $Size
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics

  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $dstRect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    $srcRect = New-Object System.Drawing.Rectangle 0, 0, $Source.Width, $Source.Height
    $graphics.DrawImage($Source, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    Save-Png -Bitmap $bitmap -Path $OutputPath
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function New-SocialPreview {
  param([System.Drawing.Image]$Source, [string]$OutputPath)

  $width = 1200
  $height = 630
  $canvas = New-Canvas -Width $width -Height $height
  $bitmap = $canvas.Bitmap
  $graphics = $canvas.Graphics

  try {
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Object System.Drawing.Rectangle 0, 0, $width, $height),
      [System.Drawing.Color]::FromArgb(255, 4, 52, 47),
      [System.Drawing.Color]::FromArgb(255, 6, 6, 5),
      18
    )
    $graphics.FillRectangle($bg, 0, 0, $width, $height)
    $bg.Dispose()

    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse(610, 40, 420, 420)
    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(110, 221, 171, 49)
    $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 221, 171, 49))
    $graphics.FillEllipse($glowBrush, 610, 40, 420, 420)
    $glowBrush.Dispose()
    $glowPath.Dispose()

    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 221, 171, 49), 3)
    $graphics.DrawRectangle($pen, 34, 34, $width - 68, $height - 68)
    $pen.Dispose()

    $logoSize = 430
    $logoRect = New-Object System.Drawing.Rectangle 700, 98, $logoSize, $logoSize
    $srcRect = New-Object System.Drawing.Rectangle 0, 0, $Source.Width, $Source.Height
    $graphics.DrawImage($Source, $logoRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $titleFont = New-Object System.Drawing.Font('Segoe UI Semibold', 56, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subtitleFont = New-Object System.Drawing.Font('Segoe UI', 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $noteFont = New-Object System.Drawing.Font('Segoe UI', 24, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 238, 198, 79))
    $warm = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 245, 222))
    $soft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 222, 214, 197))

    $graphics.DrawString('HUNDESALON NIKA', $titleFont, $gold, 76, 170)
    $graphics.DrawString('Premium grooming in Leipzig', $subtitleFont, $warm, 80, 250)
    $graphics.DrawString('Dogs, cats, coat care and online booking', $noteFont, $soft, 82, 304)

    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 221, 171, 49), 2)
    $graphics.DrawLine($linePen, 82, 374, 500, 374)
    $linePen.Dispose()

    $titleFont.Dispose()
    $subtitleFont.Dispose()
    $noteFont.Dispose()
    $gold.Dispose()
    $warm.Dispose()
    $soft.Dispose()

    Save-Png -Bitmap $bitmap -Path $OutputPath
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function New-Ico {
  param([array]$Images, [string]$OutputPath)

  $files = @()
  foreach ($item in $Images) {
    $files += [PSCustomObject]@{
      Size = [int]$item.Size
      Bytes = [System.IO.File]::ReadAllBytes($item.Path)
    }
  }

  $stream = [System.IO.File]::Create($OutputPath)
  $writer = New-Object System.IO.BinaryWriter($stream)

  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$files.Count)

    $offset = 6 + (16 * $files.Count)
    foreach ($file in $files) {
      $sizeByte = if ($file.Size -ge 256) { 0 } else { $file.Size }
      $writer.Write([Byte]$sizeByte)
      $writer.Write([Byte]$sizeByte)
      $writer.Write([Byte]0)
      $writer.Write([Byte]0)
      $writer.Write([UInt16]1)
      $writer.Write([UInt16]32)
      $writer.Write([UInt32]$file.Bytes.Length)
      $writer.Write([UInt32]$offset)
      $offset += $file.Bytes.Length
    }

    foreach ($file in $files) {
      $writer.Write($file.Bytes)
    }
  }
  finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

if (-not (Test-Path $faviconDir)) {
  New-Item -ItemType Directory -Path $faviconDir -Force | Out-Null
}

$source = New-Object System.Drawing.Bitmap $sourcePath

try {
  $iconSizes = 16, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512
  foreach ($size in $iconSizes) {
    $name = if ($size -eq 180) { 'apple-touch-icon.png' } elseif ($size -eq 192) { 'android-chrome-192x192.png' } elseif ($size -eq 512) { 'android-chrome-512x512.png' } else { "favicon-${size}x${size}.png" }
    $edgeRatio = if ($size -eq 180 -or $size -eq 192) { $touchEdgeRatio } else { $standardEdgeRatio }
    New-BrandIconPng -Source $source -Size $size -OutputPath (Join-Path $faviconDir $name) -EdgeRatio $edgeRatio
  }

  New-BrandIconPng -Source $source -Size 150 -OutputPath (Join-Path $faviconDir 'mstile-150x150.png') -EdgeRatio $touchEdgeRatio
  New-BrandIconPng -Source $source -Size 512 -OutputPath (Join-Path $faviconDir 'favicon-512x512.png') -EdgeRatio $standardEdgeRatio
  New-BrandIconPng -Source $source -Size 512 -OutputPath (Join-Path $faviconDir 'favicon-search-512.png') -EdgeRatio $standardEdgeRatio
  New-BrandIconPng -Source $source -Size 512 -OutputPath (Join-Path $faviconDir 'maskable-icon-512x512.png') -EdgeRatio $maskableEdgeRatio
  New-BrandIconPng -Source $source -Size 512 -OutputPath (Join-Path $faviconDir 'favicon.png') -EdgeRatio $standardEdgeRatio

  New-BrandIconPng -Source $source -Size 512 -OutputPath (Join-Path $imagesDir 'search-logo-512.png') -EdgeRatio $standardEdgeRatio
  New-BrandIconPng -Source $source -Size 512 -OutputPath (Join-Path $imagesDir 'search-logo-transparent-512.png') -EdgeRatio $standardEdgeRatio
  New-BrandIconPng -Source $source -Size 512 -OutputPath (Join-Path $imagesDir 'search-logo-clear-512.png') -EdgeRatio $standardEdgeRatio
  New-SocialPreview -Source $source -OutputPath (Join-Path $imagesDir 'social-preview-1200x630.png')

  $icoImages = @(
    @{ Size = 16; Path = Join-Path $faviconDir 'favicon-16x16.png' },
    @{ Size = 32; Path = Join-Path $faviconDir 'favicon-32x32.png' },
    @{ Size = 48; Path = Join-Path $faviconDir 'favicon-48x48.png' },
    @{ Size = 64; Path = Join-Path $faviconDir 'favicon-64x64.png' },
    @{ Size = 96; Path = Join-Path $faviconDir 'favicon-96x96.png' },
    @{ Size = 128; Path = Join-Path $faviconDir 'favicon-128x128.png' }
  )

  $icoRoot = Join-Path $root 'favicon.ico'
  $icoFavicon = Join-Path $faviconDir 'favicon.ico'
  New-Ico -Images $icoImages -OutputPath $icoRoot
  Copy-Item -Path $icoRoot -Destination $icoFavicon -Force

  $compatCopies = @(
    @{ From = 'favicon-48x48.png'; To = 'favicon-48x48.png' },
    @{ From = 'favicon-64x64.png'; To = 'favicon-64x64.png' },
    @{ From = 'favicon-128x128.png'; To = 'favicon-128x128.png' },
    @{ From = 'favicon-384x384.png'; To = 'favicon-384x384.png' },
    @{ From = 'favicon-512x512.png'; To = 'favicon-512x512.png' },
    @{ From = 'favicon-search-512.png'; To = 'favicon-search-512.png' },
    @{ From = 'android-chrome-512x512.png'; To = 'android-chrome-512x512.png' },
    @{ From = 'maskable-icon-512x512.png'; To = 'maskable-icon-512x512.png' },
    @{ From = 'mstile-150x150.png'; To = 'mstile-150x150.png' }
  )

  foreach ($item in $compatCopies) {
    Copy-Item -Path (Join-Path $faviconDir $item.From) -Destination (Join-Path $imagesDir $item.To) -Force
  }
}
finally {
  $source.Dispose()
}

Write-Output 'Brand search assets generated (air-trim, tight-fit favicons).'
