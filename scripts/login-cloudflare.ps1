# Open browser to authenticate cloudflared with Cloudflare (one-time).
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$setupScript = Join-Path $scriptsDir 'setup-cloudflared.ps1'
$exePath = Join-Path $root 'cloudflare\cloudflared.exe'

if (-not (Test-Path $exePath)) {
    Write-Host 'cloudflared.exe not found. Running setup-cloudflared.ps1...'
    & $setupScript
}

Write-Host 'Opening browser for Cloudflare login...'
Write-Host 'Select the zone that contains your stream subdomain (e.g. pawdomain.com).'
Write-Host ''
& $exePath tunnel login

$certPath = Join-Path $env:USERPROFILE '.cloudflared\cert.pem'
if (Test-Path $certPath) {
    Write-Host ''
    Write-Host "Login OK: $certPath"
} else {
    Write-Error 'Login failed — cert.pem not found.'
    exit 1
}
