# Download latest go2rtc Windows amd64 release into pawnode/go2rtc/go2rtc.exe
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$go2rtcDir = Join-Path $root 'go2rtc'
$exePath = Join-Path $go2rtcDir 'go2rtc.exe'
$zipPath = Join-Path $env:TEMP 'go2rtc_win64.zip'
$assetName = 'go2rtc_win64.zip'

if (-not (Test-Path $go2rtcDir)) {
    New-Item -ItemType Directory -Path $go2rtcDir -Force | Out-Null
}

Write-Host 'Fetching latest go2rtc release from GitHub...'
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/AlexxIT/go2rtc/releases/latest'
$tag = $release.tag_name
$asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1

if (-not $asset) {
    Write-Error "Asset not found: $assetName (release $tag)"
    exit 1
}

Write-Host "Downloading $tag ($assetName)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -UseBasicParsing

Write-Host 'Extracting...'
if (Test-Path $exePath) {
    Remove-Item $exePath -Force
}

Expand-Archive -Path $zipPath -DestinationPath $go2rtcDir -Force
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $exePath)) {
    $found = Get-ChildItem -Path $go2rtcDir -Filter 'go2rtc.exe' -Recurse | Select-Object -First 1
    if ($found) {
        Move-Item $found.FullName $exePath -Force
    }
}

if (-not (Test-Path $exePath)) {
    Write-Error "go2rtc.exe not found after extraction"
    exit 1
}

Write-Host "Installed: $exePath"
Write-Host ''
& $exePath -version
