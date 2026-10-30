param([switch]$Foreground)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$runtimeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($runtimeCommand) {
  $nodePath = $runtimeCommand.Source
} else {
  $nodePath = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
}
if (-not (Test-Path -LiteralPath $nodePath)) {
  throw 'Node.js 24 or newer is required.'
}
$previewPort = 4173
if (Test-Path -LiteralPath '.env') {
  $portLine = Get-Content -LiteralPath '.env' | Where-Object { $_ -match '^PORT=\d+$' } | Select-Object -Last 1
  if ($portLine) { $previewPort = [int]($portLine -replace '^PORT=', '') }
}
$previewUrl = "http://127.0.0.1:$previewPort"
try {
  $health = Invoke-RestMethod -Uri "$previewUrl/api/health" -TimeoutSec 3
  if ($health.service -eq 'anikind' -or ($health.status -eq 'ok' -and $health.version -eq '0.1.0')) { Write-Host "AniKind is already running: $previewUrl/#explore"; exit 0 }
} catch { }
if ($Foreground) { & $nodePath --env-file-if-exists=.env server/index.mjs; exit $LASTEXITCODE }
$logDirectory = Join-Path $PSScriptRoot 'data/logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$serverProcess = Start-Process -FilePath $nodePath -ArgumentList @('--env-file-if-exists=.env', 'server/index.mjs') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'server.out.log') -RedirectStandardError (Join-Path $logDirectory 'server.err.log') -PassThru
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 300
  if ($serverProcess.HasExited) { throw "AniKind could not start. See $logDirectory/server.err.log" }
  try {
    $health = Invoke-RestMethod -Uri "$previewUrl/api/health" -TimeoutSec 2
    if ($health.service -eq 'anikind') {
      $serverProcess.Id | Set-Content -LiteralPath (Join-Path $logDirectory 'server.pid')
      Write-Host "AniKind is running in the background (PID $($serverProcess.Id)): $previewUrl/#explore"
      exit 0
    }
  } catch { }
}
throw "Startup timed out. See $logDirectory/server.err.log"
