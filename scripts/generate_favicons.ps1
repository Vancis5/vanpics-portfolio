Add-Type -AssemblyName System.Drawing

function Draw-ApertureIcon {
    param (
        [int]$size,
        [string]$outputPath,
        [bool]$isCircleBg = $true
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Background - sleek dark square with rounded corners or circle
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 13, 12, 12))
    if ($isCircleBg) {
        $g.FillEllipse($bgBrush, 0, 0, $size, $size)
    } else {
        $cornerRad = [int]($size * 0.2)
        $rectPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $rectPath.AddArc(0, 0, $cornerRad*2, $cornerRad*2, 180, 90)
        $rectPath.AddArc($size - $cornerRad*2, 0, $cornerRad*2, $cornerRad*2, 270, 90)
        $rectPath.AddArc($size - $cornerRad*2, $size - $cornerRad*2, $cornerRad*2, $cornerRad*2, 0, 90)
        $rectPath.AddArc(0, $size - $cornerRad*2, $cornerRad*2, $cornerRad*2, 90, 90)
        $rectPath.CloseFigure()
        $g.FillPath($bgBrush, $rectPath)
        $rectPath.Dispose()
    }
    $bgBrush.Dispose()

    # Scale factor from 24x24 SVG
    $scale = $size / 24.0
    $penWidth = [Math]::Max(1.5 * $scale, 1.5)
    
    # White pen for aperture lines and circle
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $penWidth)

    # Circle (cx=12, cy=12, r=9.5)
    $r = 9.5 * $scale
    $cx = 12.0 * $scale
    $cy = 12.0 * $scale
    $g.DrawEllipse($whitePen, ($cx - $r), ($cy - $r), ($r * 2), ($r * 2))

    # Aperture lines
    $lines = @(
        @(14.31, 8.5, 20.05, 18.44),
        @(9.69, 8.5, 21.17, 8.5),
        @(7.38, 12.5, 13.12, 2.56),
        @(9.69, 16.5, 3.95, 6.56),
        @(14.31, 16.5, 2.83, 16.5),
        @(16.62, 12.5, 10.88, 22.44)
    )

    foreach ($l in $lines) {
        $x1 = $l[0] * $scale
        $y1 = $l[1] * $scale
        $x2 = $l[2] * $scale
        $y2 = $l[3] * $scale
        $g.DrawLine($whitePen, $x1, $y1, $x2, $y2)
    }

    $whitePen.Dispose()
    $g.Dispose()

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved $outputPath"
}

# Create output dirs if not exist
if (-not (Test-Path -Path "public")) { New-Item -ItemType Directory -Path "public" }
if (-not (Test-Path -Path "icons")) { New-Item -ItemType Directory -Path "icons" }

# Generate favicons
Draw-ApertureIcon -size 48 -outputPath "public/favicon-48x48.png" -isCircleBg $false
Draw-ApertureIcon -size 192 -outputPath "public/favicon-192x192.png" -isCircleBg $false
Draw-ApertureIcon -size 512 -outputPath "public/favicon-512x512.png" -isCircleBg $false
Draw-ApertureIcon -size 180 -outputPath "public/apple-touch-icon.png" -isCircleBg $false
Draw-ApertureIcon -size 32 -outputPath "public/favicon.png" -isCircleBg $false

# Copy 32x32 to favicon.ico (PNG payload inside ICO container or rename for basic favicon fallback)
Draw-ApertureIcon -size 48 -outputPath "public/favicon.ico" -isCircleBg $false
Draw-ApertureIcon -size 48 -outputPath "favicon.ico" -isCircleBg $false

# Copy into icons/ folder too
Copy-Item "public/favicon-48x48.png" "icons/favicon-48x48.png" -Force
Copy-Item "public/favicon-192x192.png" "icons/favicon-192x192.png" -Force
Copy-Item "public/apple-touch-icon.png" "icons/apple-touch-icon.png" -Force
