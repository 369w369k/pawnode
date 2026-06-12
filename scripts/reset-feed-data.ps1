# Reset PawNode local feed logs, ranking events, and cooldown meta.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dataDir = Join-Path $root 'data'

if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
}

$meta = @'
{
  "next_id": 1,
  "streamers": {}
}
'@

Set-Content -Path (Join-Path $dataDir 'feed-meta.json') -Value $meta -Encoding UTF8
Set-Content -Path (Join-Path $dataDir 'feed-logs.jsonl') -Value '' -Encoding UTF8
Set-Content -Path (Join-Path $dataDir 'ranking-events.jsonl') -Value '' -Encoding UTF8

Write-Host 'PawNode feed data reset:'
Write-Host "  feed-meta.json"
Write-Host "  feed-logs.jsonl"
Write-Host "  ranking-events.jsonl"
Write-Host ''
Write-Host 'Restart PawNode if it is running.'
