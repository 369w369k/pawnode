# Start go2rtc + PawNode API (run each in separate window for production)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

Write-Host "Starting go2rtc in new window..."
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts\start-go2rtc.ps1")

Start-Sleep -Seconds 2

Write-Host "Starting PawNode API..."
Set-Location $root
npm start
