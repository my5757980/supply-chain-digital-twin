<#
  Stitches the captured frames in demo/frames into an MP4 for LinkedIn.

  Each frame is held for a few seconds with a caption burned in, so the
  video reads correctly on a muted autoplay feed.

  Requires ffmpeg on PATH (winget install Gyan.FFmpeg).

  Usage:
      pwsh demo/build-video.ps1
#>

param(
    [string]$OutFile = "demo/supplytwin-demo.mp4",
    [int]$Fps = 30
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpeg) {
    $candidate = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe" -ErrorAction SilentlyContinue |
                 Select-Object -First 1
    if ($candidate) { $ffmpeg = $candidate.FullName } else { throw "ffmpeg not found on PATH." }
} else { $ffmpeg = $ffmpeg.Source }

# Frame, seconds on screen, caption. Order is the story order.
$shots = @(
    @{ file = "01-landing.png";    secs = 4; caption = "Most UAE small businesses find out their supplier is late on delivery day." },
    @{ file = "08-onboarding.png"; secs = 4; caption = "Setup takes two minutes. No IT team, no integration project." },
    @{ file = "02-twin.png";       secs = 6; caption = "One live view: stock, suppliers, orders. 'Low' is computed, not typed." },
    @{ file = "03-alerts.png";     secs = 5; caption = "A warning 48 hours before the delay lands - in plain language." },
    @{ file = "04-plan.png";       secs = 7; caption = "The AI picked their OWN backup supplier, and wrote the steps." },
    @{ file = "05-accepted.png";   secs = 4; caption = "The owner decides. Nothing is actioned without them." },
    @{ file = "06-history.png";    secs = 5; caption = "We show the predictions we got wrong, too." },
    @{ file = "07-settings.png";   secs = 4; caption = "Automatic action is opt-in, per supplier, owner-only." }
)

$framesDir = Join-Path $repoRoot "demo/frames"
$workDir = Join-Path $repoRoot "demo/.build"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
Get-ChildItem $workDir -Filter *.mp4 | Remove-Item -Force -ErrorAction SilentlyContinue

# A font ffmpeg's drawtext can resolve on Windows.
$fontPath = "C\:/Windows/Fonts/segoeui.ttf"

$segments = @()
$index = 0
foreach ($shot in $shots) {
    $src = Join-Path $framesDir $shot.file
    if (-not (Test-Path $src)) { Write-Warning "missing frame: $($shot.file) - skipped"; continue }

    $index++
    $segment = Join-Path $workDir ("seg{0:d2}.mp4" -f $index)

    # Escape characters that are special inside a drawtext filter value.
    $text = $shot.caption -replace "'", "" -replace ":", "\:"

    $filter = @(
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xF6F8FB",
        "drawbox=x=0:y=ih-150:w=iw:h=150:color=0x111827@0.92:t=fill",
        "drawtext=fontfile='$fontPath':text='$text':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h-95",
        "format=yuv420p"
    ) -join ","

    Write-Host ("[{0}/{1}] {2}  ({3}s)" -f $index, $shots.Count, $shot.file, $shot.secs)
    & $ffmpeg -y -loglevel error -loop 1 -t $shot.secs -i $src -vf $filter -r $Fps -c:v libx264 -preset medium -crf 20 $segment
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed on $($shot.file)" }
    $segments += $segment
}

if ($segments.Count -eq 0) { throw "No frames found in demo/frames." }

$listFile = Join-Path $workDir "segments.txt"
($segments | ForEach-Object { "file '$($_ -replace '\\','/')'" }) | Set-Content $listFile -Encoding ascii

$outPath = Join-Path $repoRoot $OutFile
Write-Host "`nConcatenating..." -ForegroundColor Cyan
& $ffmpeg -y -loglevel error -f concat -safe 0 -i $listFile -c copy $outPath
if ($LASTEXITCODE -ne 0) { throw "ffmpeg concat failed" }

Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue

$sizeMb = [math]::Round((Get-Item $outPath).Length / 1MB, 1)
# Windows PowerShell 5.1's Measure-Object can't read keys off hashtables,
# so sum them directly.
$duration = 0
foreach ($shot in $shots) { $duration += $shot.secs }

$rule = "=" * 60
Write-Host "`n$rule" -ForegroundColor Green
Write-Host " Video ready" -ForegroundColor Green
Write-Host $rule -ForegroundColor Green
Write-Host " File     : $outPath"
Write-Host " Duration : ${duration}s"
Write-Host " Size     : ${sizeMb} MB"
Write-Host " Format   : 1920x1080, H.264 - uploads directly to LinkedIn"
Write-Host $rule -ForegroundColor Green
