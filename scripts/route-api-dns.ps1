# Route api.chonkpaw.com DNS to the existing PawNode Cloudflare Tunnel
param(
    [string]$ApiHostname = 'api.chonkpaw.com',
    [string]$TunnelId = 'b0b14858-a0cb-48c2-b6a1-edf5a88a300d'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$cfDir = Join-Path $root 'cloudflare'
$exePath = Join-Path $cfDir 'cloudflared.exe'
$configPath = Join-Path $cfDir 'config.yml'

if (-not (Test-Path $exePath)) {
    Write-Error "cloudflared.exe not found. Run: scripts/setup-cloudflared.ps1"
    exit 1
}

Write-Host "Routing DNS: $ApiHostname -> tunnel $TunnelId"
$dnsOut = & $exePath tunnel route dns $TunnelId $ApiHostname 2>&1 | Out-String
Write-Host $dnsOut.Trim()

Write-Host ''
Write-Host 'Verify after tunnel restart:'
Write-Host "  https://$ApiHostname/health"
Write-Host "  https://$ApiHostname/api/feed-status?streamer=beemo"
Write-Host ''
Write-Host 'Restart tunnel:'
Write-Host '  powershell -ExecutionPolicy Bypass -File scripts/start-tunnel.ps1'
Write-Host ''
Write-Host "Ensure $configPath includes ingress for $ApiHostname -> http://127.0.0.1:3000"
