# Convert PNG to ICO format
# Note: This requires .NET/Windows to work

$sourcePng = "build\logo.png"
$targetIco = "build\icon.ico"

if (-not (Test-Path $sourcePng)) {
    Write-Error "Source PNG not found: $sourcePng"
    exit 1
}

Write-Host "Converting $sourcePng to $targetIco..."

Add-Type -AssemblyName System.Drawing

# Load the PNG image
$image = [System.Drawing.Image]::FromFile((Resolve-Path $sourcePng))

# Create icon sizes (Windows typically uses 256x256, 128x128, 64x64, 48x48, 32x32, 16x16)
$sizes = @(256, 128, 64, 48, 32, 16)

# Create a temporary directory for icon generation
$tempDir = New-Item -ItemType Directory -Path "$env:TEMP\icon-gen-$(Get-Random)" -Force

try {
    # Save each size as a separate PNG
    $pngFiles = @()
    foreach ($size in $sizes) {
        $resized = New-Object System.Drawing.Bitmap $size, $size
        $graphics = [System.Drawing.Graphics]::FromImage($resized)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($image, 0, 0, $size, $size)
        $graphics.Dispose()
        
        $tempPngPath = Join-Path $tempDir "$size.png"
        $resized.Save($tempPngPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $resized.Dispose()
        $pngFiles += $tempPngPath
    }
    
    $image.Dispose()
    
    # Note: This script creates PNGs but converting to ICO requires additional tools
    # You'll need to use an online converter or install imagemagick
    
    Write-Host "PNG resized successfully. To complete the conversion:"
    Write-Host "1. Use an online converter like https://convertio.co/png-ico/"
    Write-Host "2. Or install ImageMagick and run: magick convert $sourcePng -define icon:auto-resize=256,128,64,48,32,16 $targetIco"
    Write-Host "3. Or use the simplified approach below..."
    
} finally {
    # Clean up
    Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
