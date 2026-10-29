# Generates PixelCut launcher mipmaps from assets/icon.png.
# Adaptive foreground is inset so the scissors stay inside the circular mask.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $root 'assets\icon.png'
if (-not (Test-Path -LiteralPath $srcPath)) { throw "Missing $srcPath" }

$src = [System.Drawing.Image]::FromFile($srcPath)
$res = Join-Path $root 'android\app\src\main\res'
$bg = [System.Drawing.ColorTranslator]::FromHtml('#071525')

function Save-Png([System.Drawing.Bitmap]$bmp, [string]$path) {
  $dir = Split-Path -Parent $path
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-Scaled([int]$size, [double]$inset = 0) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $pad = [int][math]::Round($size * $inset)
  $dest = $size - (2 * $pad)
  $g.DrawImage($src, $pad, $pad, $dest, $dest)
  $g.Dispose()
  return $bmp
}

function New-Round([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($bg)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse(0, 0, $size - 1, $size - 1)
  $g.SetClip($path)
  $g.DrawImage($src, 0, 0, $size, $size)
  $g.Dispose()
  $path.Dispose()
  return $bmp
}

$densities = @{
  'mipmap-mdpi'    = 48
  'mipmap-hdpi'    = 72
  'mipmap-xhdpi'   = 96
  'mipmap-xxhdpi'  = 144
  'mipmap-xxxhdpi' = 192
}

$fg = @{
  'mipmap-mdpi'    = 108
  'mipmap-hdpi'    = 162
  'mipmap-xhdpi'   = 216
  'mipmap-xxhdpi'  = 324
  'mipmap-xxxhdpi' = 432
}

foreach ($folder in $densities.Keys) {
  $size = $densities[$folder]
  $dir = Join-Path $res $folder
  $legacy = New-Scaled $size 0
  Save-Png $legacy (Join-Path $dir 'ic_launcher.png')
  $legacy.Dispose()
  $round = New-Round $size
  Save-Png $round (Join-Path $dir 'ic_launcher_round.png')
  $round.Dispose()
}

foreach ($folder in $fg.Keys) {
  $size = $fg[$folder]
  $dir = Join-Path $res $folder
  $fore = New-Scaled $size 0.16
  Save-Png $fore (Join-Path $dir 'ic_launcher_foreground.png')
  $fore.Dispose()
}

$src.Dispose()
Write-Host 'ANDROID ICONS OK'
