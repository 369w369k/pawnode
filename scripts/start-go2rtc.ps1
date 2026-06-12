# Generate go2rtc.yaml from .env RTSP_URL, then start go2rtc.
param(
    [switch]$GenerateOnly
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root '.env'
$go2rtcDir = Join-Path $root 'go2rtc'
$exePath = Join-Path $go2rtcDir 'go2rtc.exe'
$yamlPath = Join-Path $go2rtcDir 'go2rtc.yaml'
$setupScript = Join-Path $scriptsDir 'setup-go2rtc.ps1'

if (-not (Test-Path $envFile)) {
    Write-Error '.env not found. Copy .env.example to .env first.'
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim().Trim('"')
        Set-Item -Path "env:$name" -Value $value
    }
}

if (-not $env:RTSP_URL) {
    Write-Error 'RTSP_URL is not set in .env'
    exit 1
}

$yaml = @"
# Auto-generated from .env — Tapo C120 RTSP input
api:
  listen: ":1984"

rtsp:
  listen: ":8554"

streams:
  tapo:
    - $($env:RTSP_URL)

log:
  level: info
"@

Set-Content -Path $yamlPath -Value $yaml -Encoding UTF8
Write-Host "Generated $yamlPath"

if ($GenerateOnly) {
    exit 0
}

if (-not (Test-Path $exePath)) {
    Write-Host 'go2rtc.exe not found. Running setup-go2rtc.ps1...'
    & $setupScript
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

if (-not (Test-Path $exePath)) {
    Write-Error "go2rtc.exe still missing: $exePath"
    exit 1
}

Write-Host "Starting go2rtc ($exePath)..."
& $exePath -config $yamlPath
