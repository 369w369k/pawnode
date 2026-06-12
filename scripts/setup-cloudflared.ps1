# Download latest cloudflared Windows amd64 into pawnode/cloudflare/cloudflared.exe
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cfDir = Join-Path $root 'cloudflare'
$exePath = Join-Path $cfDir 'cloudflared.exe'
$assetName = 'cloudflared-windows-amd64.exe'

if (-not (Test-Path $cfDir)) {
    New-Item -ItemType Directory -Path $cfDir -Force | Out-Null
}

Write-Host 'Fetching latest cloudflared release from GitHub...'
$release = Invoke-RestMethod -Uri 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest'
$tag = $release.tag_name
$asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1

if (-not $asset) {
    Write-Error "Asset not found: $assetName (release $tag)"
    exit 1
}

Write-Host "Downloading $tag ($assetName)..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $exePath -UseBasicParsing

if (-not (Test-Path $exePath)) {
    Write-Error "cloudflared.exe not found after download: $exePath"
    exit 1
}

Write-Host "Installed: $exePath"
Write-Host ''
& $exePath --version
