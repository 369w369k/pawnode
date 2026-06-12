# Run Cloudflare Tunnel — exposes go2rtc :1984 as https://stream.pawdomain.com
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfDir = Join-Path $root 'cloudflare'
$exePath = Join-Path $cfDir 'cloudflared.exe'
$configPath = Join-Path $cfDir 'config.yml'
$setupScript = Join-Path $scriptsDir 'setup-cloudflared.ps1'

if (-not (Test-Path $exePath)) {
    Write-Host 'cloudflared.exe not found. Running setup-cloudflared.ps1...'
    & $setupScript
}

if (-not (Test-Path $configPath)) {
    Write-Error @"
config.yml not found: $configPath

Run tunnel setup first:
  powershell -ExecutionPolicy Bypass -File scripts/create-tunnel.ps1
"@
    exit 1
}

try {
    $probe = Invoke-WebRequest -Uri 'http://127.0.0.1:1984/api' -UseBasicParsing -TimeoutSec 3
    Write-Host "go2rtc OK (HTTP $($probe.StatusCode))"
} catch {
    Write-Warning 'go2rtc is not responding on http://127.0.0.1:1984 — start go2rtc before streaming.'
    Write-Warning '  powershell -ExecutionPolicy Bypass -File scripts/start-go2rtc.ps1'
}

try {
    $apiProbe = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 3
    Write-Host "PawNode API OK (HTTP $($apiProbe.StatusCode))"
} catch {
    Write-Warning 'PawNode API is not responding on http://127.0.0.1:3000 — start PawNode before feed API tunnel.'
    Write-Warning '  cd pawnode && npm start'
}

Write-Host ''
Write-Host "Starting Cloudflare Tunnel ($configPath)..."
Write-Host 'Press Ctrl+C to stop.'
Write-Host ''

& $exePath tunnel --config $configPath run
