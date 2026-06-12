# Start go2rtc + Cloudflare Tunnel (HLS external access)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host 'Starting go2rtc in new window...'
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'scripts\start-go2rtc.ps1')

Start-Sleep -Seconds 3

Write-Host 'Starting Cloudflare Tunnel in new window...'
Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $root 'scripts\start-tunnel.ps1')

Write-Host ''
Write-Host 'Stream stack started.'
Write-Host 'HLS: https://stream.pawdomain.com/api/stream.m3u8?src=tapo'
