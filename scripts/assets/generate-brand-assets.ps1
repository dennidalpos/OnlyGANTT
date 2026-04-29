Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$brandRoot = Join-Path $repoRoot 'src\public\brand'
New-Item -ItemType Directory -Force -Path $brandRoot | Out-Null

$colors = @{
  Background = [System.Drawing.ColorTranslator]::FromHtml('#0f172a')
  Surface = [System.Drawing.ColorTranslator]::FromHtml('#1e293b')
  SurfaceLight = [System.Drawing.ColorTranslator]::FromHtml('#334155')
  Text = [System.Drawing.ColorTranslator]::FromHtml('#f8fafc')
  Muted = [System.Drawing.ColorTranslator]::FromHtml('#cbd5e1')
  Blue = [System.Drawing.ColorTranslator]::FromHtml('#38bdf8')
  Green = [System.Drawing.ColorTranslator]::FromHtml('#22c55e')
  Amber = [System.Drawing.ColorTranslator]::FromHtml('#f59e0b')
}

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Brush {
  param([System.Drawing.Color]$Color)
  return [System.Drawing.SolidBrush]::new($Color)
}

function Draw-Mark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size
  )

  $cardPath = New-RoundedRectanglePath -X $X -Y $Y -Width $Size -Height $Size -Radius ($Size * 0.22)
  $surfaceBrush = New-Brush $colors.Surface
  $Graphics.FillPath($surfaceBrush, $cardPath)
  $surfaceBrush.Dispose()

  $linePen = [System.Drawing.Pen]::new($colors.Text, [Math]::Max(2, $Size * 0.055))
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Graphics.DrawLine($linePen, $X + $Size * 0.22, $Y + $Size * 0.70, $X + $Size * 0.78, $Y + $Size * 0.70)
  $linePen.Dispose()

  $barWidth = [Math]::Max(3, $Size * 0.095)
  $bars = @(
    @{ Color = $colors.Blue; X = 0.30; Top = 0.32 },
    @{ Color = $colors.Green; X = 0.50; Top = 0.22 },
    @{ Color = $colors.Amber; X = 0.70; Top = 0.42 }
  )

  foreach ($bar in $bars) {
    $pen = [System.Drawing.Pen]::new($bar.Color, $barWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $Graphics.DrawLine(
      $pen,
      $X + $Size * $bar.X,
      $Y + $Size * 0.62,
      $X + $Size * $bar.X,
      $Y + $Size * $bar.Top
    )
    $pen.Dispose()
  }
}

function Draw-Timeline {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Width
  )

  $trackPen = [System.Drawing.Pen]::new($colors.SurfaceLight, 6)
  $trackPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trackPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Graphics.DrawLine($trackPen, $X, $Y, $X + $Width, $Y)
  $Graphics.DrawLine($trackPen, $X, $Y + 42, $X + $Width * 0.86, $Y + 42)
  $trackPen.Dispose()

  $segments = @(
    @{ Color = $colors.Blue; Offset = 0; Length = 0.30; Row = 0 },
    @{ Color = $colors.Green; Offset = 0.22; Length = 0.38; Row = 42 },
    @{ Color = $colors.Amber; Offset = 0.62; Length = 0.24; Row = 0 }
  )

  foreach ($segment in $segments) {
    $pen = [System.Drawing.Pen]::new($segment.Color, 12)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $Graphics.DrawLine(
      $pen,
      $X + $Width * $segment.Offset,
      $Y + $segment.Row,
      $X + $Width * ($segment.Offset + $segment.Length),
      $Y + $segment.Row
    )
    $pen.Dispose()
  }
}

function Save-Png {
  param(
    [string]$Path,
    [int]$Width,
    [int]$Height,
    [scriptblock]$Draw
  )

  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  try {
    & $Draw $graphics $Width $Height
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Draw-Background {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height
  )

  $rect = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $colors.Background, $colors.Surface, 35)
  $Graphics.FillRectangle($brush, $rect)
  $brush.Dispose()
}

function Draw-Lockup {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height,
    [string]$Mode
  )

  Draw-Background -Graphics $Graphics -Width $Width -Height $Height

  if ($Mode -eq 'wide') {
    Draw-Mark -Graphics $Graphics -X 92 -Y 128 -Size 168
    $titleFont = [System.Drawing.Font]::new('Segoe UI', 76, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = [System.Drawing.Font]::new('Segoe UI', 30, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Brush $colors.Text
    $mutedBrush = New-Brush $colors.Muted
    $Graphics.DrawString('OnlyGANTT', $titleFont, $textBrush, 300, 142)
    $Graphics.DrawString('Pianificazione, lock reparto e packaging Windows', $bodyFont, $mutedBrush, 306, 232)
    Draw-Timeline -Graphics $Graphics -X 308 -Y 352 -Width 720
    $titleFont.Dispose()
    $bodyFont.Dispose()
    $textBrush.Dispose()
    $mutedBrush.Dispose()
    return
  }

  if ($Mode -eq 'square') {
    Draw-Mark -Graphics $Graphics -X 408 -Y 170 -Size 264
    $titleFont = [System.Drawing.Font]::new('Segoe UI', 82, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = [System.Drawing.Font]::new('Segoe UI', 32, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Brush $colors.Text
    $mutedBrush = New-Brush $colors.Muted
    $Graphics.DrawString('OnlyGANTT', $titleFont, $textBrush, 310, 482)
    $Graphics.DrawString('Gantt operativo per team Windows', $bodyFont, $mutedBrush, 310, 585)
    Draw-Timeline -Graphics $Graphics -X 250 -Y 725 -Width 580
    $titleFont.Dispose()
    $bodyFont.Dispose()
    $textBrush.Dispose()
    $mutedBrush.Dispose()
    return
  }

  if ($Mode -eq 'portrait') {
    Draw-Mark -Graphics $Graphics -X 390 -Y 210 -Size 300
    $titleFont = [System.Drawing.Font]::new('Segoe UI', 88, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = [System.Drawing.Font]::new('Segoe UI', 36, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Brush $colors.Text
    $mutedBrush = New-Brush $colors.Muted
    $Graphics.DrawString('OnlyGANTT', $titleFont, $textBrush, 275, 590)
    $Graphics.DrawString('Controllo progetti, scadenze e reparti', $bodyFont, $mutedBrush, 205, 710)
    Draw-Timeline -Graphics $Graphics -X 225 -Y 900 -Width 630
    $titleFont.Dispose()
    $bodyFont.Dispose()
    $textBrush.Dispose()
    $mutedBrush.Dispose()
    return
  }

  if ($Mode -eq 'setup-banner') {
    Draw-Background -Graphics $Graphics -Width $Width -Height $Height
    Draw-Mark -Graphics $Graphics -X 18 -Y 8 -Size 42
    $titleFont = [System.Drawing.Font]::new('Segoe UI', 20, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = [System.Drawing.Font]::new('Segoe UI', 11, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Brush $colors.Text
    $mutedBrush = New-Brush $colors.Muted
    $Graphics.DrawString('OnlyGANTT', $titleFont, $textBrush, 76, 10)
    $Graphics.DrawString('Windows server installer', $bodyFont, $mutedBrush, 78, 35)
    $titleFont.Dispose()
    $bodyFont.Dispose()
    $textBrush.Dispose()
    $mutedBrush.Dispose()
    return
  }

  if ($Mode -eq 'setup-dialog') {
    Draw-Background -Graphics $Graphics -Width $Width -Height $Height
    Draw-Mark -Graphics $Graphics -X 54 -Y 52 -Size 120
    $titleFont = [System.Drawing.Font]::new('Segoe UI', 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = [System.Drawing.Font]::new('Segoe UI', 16, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Brush $colors.Text
    $mutedBrush = New-Brush $colors.Muted
    $Graphics.DrawString('OnlyGANTT', $titleFont, $textBrush, 204, 70)
    $Graphics.DrawString('Interactive Gantt scheduling', $bodyFont, $mutedBrush, 208, 118)
    $Graphics.DrawString('MSI setup asset', $bodyFont, $mutedBrush, 208, 146)
    Draw-Timeline -Graphics $Graphics -X 84 -Y 224 -Width 326
    $titleFont.Dispose()
    $bodyFont.Dispose()
    $textBrush.Dispose()
    $mutedBrush.Dispose()
  }
}

function Save-IconPng {
  param(
    [int]$Size
  )

  Save-Png -Path (Join-Path $brandRoot "icon-$Size.png") -Width $Size -Height $Size -Draw {
    param($graphics, $width, $height)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    Draw-Mark -Graphics $graphics -X 0 -Y 0 -Size $width
  }
}

function Write-Ico {
  param(
    [string[]]$PngPaths,
    [string]$Path
  )

  $entries = @()
  foreach ($pngPath in $PngPaths) {
    $image = [System.Drawing.Image]::FromFile($pngPath)
    try {
      $entries += [pscustomobject]@{
        Width = $image.Width
        Height = $image.Height
        Bytes = [System.IO.File]::ReadAllBytes($pngPath)
      }
    } finally {
      $image.Dispose()
    }
  }

  $stream = [System.IO.File]::Create($Path)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$entries.Count)

    $offset = 6 + (16 * $entries.Count)
    foreach ($entry in $entries) {
      $iconWidth = if ($entry.Width -eq 256) { 0 } else { $entry.Width }
      $iconHeight = if ($entry.Height -eq 256) { 0 } else { $entry.Height }
      $writer.Write([byte]$iconWidth)
      $writer.Write([byte]$iconHeight)
      $writer.Write([byte]0)
      $writer.Write([byte]0)
      $writer.Write([uint16]1)
      $writer.Write([uint16]32)
      $writer.Write([uint32]$entry.Bytes.Length)
      $writer.Write([uint32]$offset)
      $offset += $entry.Bytes.Length
    }

    foreach ($entry in $entries) {
      $writer.Write($entry.Bytes)
    }
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

$logoSvg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 140" role="img" aria-labelledby="title desc">
  <title id="title">OnlyGANTT</title>
  <desc id="desc">OnlyGANTT logo with a compact Gantt chart mark.</desc>
  <rect x="0" y="0" width="140" height="140" rx="30" fill="#1e293b"/>
  <path d="M31 96h78" stroke="#f8fafc" stroke-width="9" stroke-linecap="round"/>
  <path d="M42 83V43" stroke="#38bdf8" stroke-width="13" stroke-linecap="round"/>
  <path d="M70 83V29" stroke="#22c55e" stroke-width="13" stroke-linecap="round"/>
  <path d="M98 83V55" stroke="#f59e0b" stroke-width="13" stroke-linecap="round"/>
  <text x="170" y="83" fill="#f8fafc" font-family="Segoe UI, Arial, sans-serif" font-size="54" font-weight="700">OnlyGANTT</text>
  <text x="173" y="116" fill="#cbd5e1" font-family="Segoe UI, Arial, sans-serif" font-size="18">Interactive Gantt scheduling for Windows teams</text>
</svg>
'@

[System.IO.File]::WriteAllText((Join-Path $brandRoot 'onlygantt-logo.svg'), $logoSvg, [System.Text.UTF8Encoding]::new($false))

foreach ($size in @(16, 24, 32, 48, 256)) {
  Save-IconPng -Size $size
}

Write-Ico -PngPaths @(
  (Join-Path $brandRoot 'icon-16.png'),
  (Join-Path $brandRoot 'icon-24.png'),
  (Join-Path $brandRoot 'icon-32.png'),
  (Join-Path $brandRoot 'icon-48.png'),
  (Join-Path $brandRoot 'icon-256.png')
) -Path (Join-Path $brandRoot 'onlygantt.ico')

Save-Png -Path (Join-Path $brandRoot 'social-og-1200x630.png') -Width 1200 -Height 630 -Draw {
  param($graphics, $width, $height)
  Draw-Lockup -Graphics $graphics -Width $width -Height $height -Mode 'wide'
}

Save-Png -Path (Join-Path $brandRoot 'social-x-large-1200x600.png') -Width 1200 -Height 600 -Draw {
  param($graphics, $width, $height)
  Draw-Lockup -Graphics $graphics -Width $width -Height $height -Mode 'wide'
}

Save-Png -Path (Join-Path $brandRoot 'social-linkedin-1200x627.png') -Width 1200 -Height 627 -Draw {
  param($graphics, $width, $height)
  Draw-Lockup -Graphics $graphics -Width $width -Height $height -Mode 'wide'
}

Save-Png -Path (Join-Path $brandRoot 'post-square-1080x1080.png') -Width 1080 -Height 1080 -Draw {
  param($graphics, $width, $height)
  Draw-Lockup -Graphics $graphics -Width $width -Height $height -Mode 'square'
}

Save-Png -Path (Join-Path $brandRoot 'post-portrait-1080x1350.png') -Width 1080 -Height 1350 -Draw {
  param($graphics, $width, $height)
  Draw-Lockup -Graphics $graphics -Width $width -Height $height -Mode 'portrait'
}

Save-Png -Path (Join-Path $brandRoot 'setup-banner-493x58.png') -Width 493 -Height 58 -Draw {
  param($graphics, $width, $height)
  Draw-Lockup -Graphics $graphics -Width $width -Height $height -Mode 'setup-banner'
}

Save-Png -Path (Join-Path $brandRoot 'setup-dialog-493x312.png') -Width 493 -Height 312 -Draw {
  param($graphics, $width, $height)
  Draw-Lockup -Graphics $graphics -Width $width -Height $height -Mode 'setup-dialog'
}

Write-Host "Brand assets generated in $brandRoot"
