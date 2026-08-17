<#
  Turns the raw screen recording into the MP4 that gets posted.

  demo/record-demo.mjs drives the real app in a browser and writes a .webm
  plus a timeline.json of scene start times. This trims the lead-in, burns
  the captions in at those times (most people watch muted) and encodes
  H.264 for LinkedIn.

  Requires ffmpeg on PATH, or the winget Gyan.FFmpeg build.

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

$ffmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ffmpeg) {
    $candidate = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe" -ErrorAction SilentlyContinue |
                 Select-Object -First 1
    if ($candidate) { $ffmpeg = $candidate.FullName } else { throw "ffmpeg not found on PATH." }
}

$rawDir = Join-Path $repoRoot "demo/raw"
$source = Get-ChildItem "$rawDir/*.webm" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $source) { throw "No recording in demo/raw. Run demo/record-demo.mjs first." }

$timelinePath = Join-Path $rawDir "timeline.json"
if (-not (Test-Path $timelinePath)) { throw "demo/raw/timeline.json missing. Re-run demo/record-demo.mjs." }
$timeline = Get-Content $timelinePath -Raw | ConvertFrom-Json

$workDir = Join-Path $repoRoot "demo/.build"
New-Item -ItemType Directory -Force -Path $workDir | Out-Null
Get-ChildItem $workDir -File | Remove-Item -Force -ErrorAction SilentlyContinue

# Start just before the first caption so the video opens on the landing
# page rather than on a blank tab.
$leadIn = 1.2
$start = [math]::Max(0, $timeline.scenes[0].at - $leadIn)
$end = $timeline.totalSecs

# Captions go in as files rather than inline text: drawtext treats ':' and
# '\'' as syntax, and the copy is full of both.
$fontPath = "C\:/Windows/Fonts/segoeui.ttf"
$filters = @()
$index = 0

foreach ($sceneItem in $timeline.scenes) {
    $index++
    $from = [math]::Round($sceneItem.at - $start, 2)
    $to = if ($index -lt $timeline.scenes.Count) {
        [math]::Round($timeline.scenes[$index].at - $start, 2)
    } else {
        [math]::Round($end - $start, 2)
    }

    $capFile = Join-Path $workDir ("cap{0:d2}.txt" -f $index)
    # -Encoding utf8NoBOM keeps ffmpeg from drawing a stray glyph for the BOM.
    Set-Content -Path $capFile -Value $sceneItem.caption -Encoding utf8NoBOM -NoNewline
    $capRef = ($capFile -replace '\\', '/') -replace ':', '\:'

    # Sized for a 720p frame: large enough to read on a phone, small enough
    # that the caption bar doesn't sit on top of the UI it is describing.
    $filters += "drawtext=fontfile='$fontPath':textfile='$capRef':fontcolor=white:fontsize=26" +
                ":box=1:boxcolor=0x0F172A@0.9:boxborderw=18" +
                ":x=(w-text_w)/2:y=h-72:enable='between(t,$from,$to)'"

    Write-Host ("[{0}/{1}] {2:N1}s-{3:N1}s  {4}" -f $index, $timeline.scenes.Count, $from, $to, $sceneItem.caption)
}

$duration = [math]::Round($end - $start, 2)
$filters += "fade=t=in:st=0:d=0.6"
$filters += "fade=t=out:st=$([math]::Round($duration - 0.8, 2)):d=0.8"
$filters += "format=yuv420p"
$filterChain = $filters -join ","

$outPath = Join-Path $repoRoot $OutFile
Write-Host "`nEncoding..." -ForegroundColor Cyan

& $ffmpeg -y -loglevel error -ss $start -i $source.FullName `
    -t $duration -vf $filterChain -r $Fps `
    -c:v libx264 -preset medium -crf 21 -pix_fmt yuv420p -movflags +faststart $outPath
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed" }

Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue

$sizeMb = [math]::Round((Get-Item $outPath).Length / 1MB, 1)
$probe = & $ffmpeg -hide_banner -i $outPath 2>&1 | Select-String -Pattern "\d{3,4}x\d{3,4}" | Select-Object -First 1
$dimensions = if ($probe -match "(\d{3,4}x\d{3,4})") { $Matches[1] } else { "unknown" }
$rule = "=" * 60
Write-Host "`n$rule" -ForegroundColor Green
Write-Host " Video ready" -ForegroundColor Green
Write-Host $rule -ForegroundColor Green
Write-Host " File     : $outPath"
Write-Host " Duration : $([math]::Round($duration))s"
Write-Host " Size     : ${sizeMb} MB"
Write-Host " Format   : $dimensions H.264 - uploads directly to LinkedIn"
Write-Host $rule -ForegroundColor Green
