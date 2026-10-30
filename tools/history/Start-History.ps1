param([switch]$OpenBrowser,[switch]$VerifyAssets)
$ErrorActionPreference='Stop'
$historyRoot=$PSScriptRoot
$projectRoot=Split-Path (Split-Path $historyRoot -Parent) -Parent
$runtimeCommand=Get-Command node -ErrorAction SilentlyContinue
$nodePath=if($runtimeCommand){$runtimeCommand.Source}else{Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'}
if(-not(Test-Path -LiteralPath $nodePath)){throw 'Node.js 24 is required.'}
$releaseDirectory=Join-Path $historyRoot 'releases/2026-09-17/anikind'
if(-not(Test-Path -LiteralPath (Join-Path $releaseDirectory 'server/app.mjs'))){
 New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
 $snapshotZip=Join-Path $historyRoot 'releases/2026-09-17/source.zip'
 & git -C $projectRoot archive --format=zip --output=$snapshotZip snapshot-2026-09-17
 if($LASTEXITCODE -ne 0){throw 'Historical tag missing. Run git fetch --tags first.'}
 Expand-Archive -LiteralPath $snapshotZip -DestinationPath $releaseDirectory
}
$currentReady=$false
try{$h=Invoke-RestMethod 'http://127.0.0.1:4173/api/health' -TimeoutSec 3;$currentReady=$h.service -eq 'anikind'}catch{}
if(-not $currentReady){& (Join-Path $projectRoot 'Start-AniKind.ps1')}
$archiveReady=$false
try{$h=Invoke-RestMethod 'http://127.0.0.1:4180/health' -TimeoutSec 3;$archiveReady=$h.service -eq 'anikind-history'}catch{}
if(-not $archiveReady){
 $logs=Join-Path $historyRoot 'runtime/logs'
 New-Item -ItemType Directory -Force -Path $logs | Out-Null
 $p=Start-Process -FilePath $nodePath -ArgumentList 'history-server.mjs' -WorkingDirectory $historyRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'server.out.log') -RedirectStandardError (Join-Path $logs 'server.err.log') -PassThru
 for($attempt=0;$attempt -lt 25;$attempt++){
  Start-Sleep -Milliseconds 200
  if($p.HasExited){throw "History startup failed. See $logs/server.err.log"}
  try{$h=Invoke-RestMethod 'http://127.0.0.1:4180/health' -TimeoutSec 1;if($h.service -eq 'anikind-history'){$archiveReady=$true;break}}catch{}
 }
 if(-not $archiveReady){throw 'History startup timed out.'}
 $p.Id | Set-Content -LiteralPath (Join-Path $logs 'server.pid')
}
foreach($url in @('http://127.0.0.1:4180/','http://127.0.0.2:4174/api/health','http://127.0.0.1:4173/api/health')){
 $r=Invoke-WebRequest $url -TimeoutSec 5
 if($r.StatusCode -ne 200){throw "Page unavailable: $url"}
 Write-Output "Ready: $url"
}
if($VerifyAssets){
 $publicRoot=Join-Path $historyRoot 'releases/2026-09-17/anikind/public'
 $assetCount=0
 foreach($asset in Get-ChildItem -LiteralPath $publicRoot -File -Recurse){
  $relative=$asset.FullName.Substring($publicRoot.Length).Replace('\','/')
  $response=Invoke-WebRequest -Uri ('http://127.0.0.2:4174'+$relative) -TimeoutSec 5
  if($response.StatusCode -ne 200){throw "Archive asset unavailable: $relative"}
  $assetCount++
 }
 $old=Invoke-RestMethod 'http://127.0.0.2:4174/api/species?collection=figma' -TimeoutSec 5
 $current=Invoke-RestMethod 'http://127.0.0.1:4173/api/puzzles' -TimeoutSec 5
 [pscustomobject]@{archiveAssets=$assetCount;archiveSpecies=$old.total;currentPuzzles=$current.items.Count} | ConvertTo-Json
}
if($OpenBrowser){Start-Process 'http://127.0.0.1:4180/'}
