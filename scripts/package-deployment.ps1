$ErrorActionPreference = 'Stop'
$projectDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputDirectory = Join-Path $projectDirectory 'output/deploy'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$archivePath = Join-Path $outputDirectory ('anikind-singapore-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
$relativePaths = [Collections.Generic.List[string]]::new()
foreach ($file in @('package.json','Dockerfile','compose.yaml','.dockerignore','.env.example','README.md','Start-AniKind.ps1','deploy/Caddyfile','deploy/.env.example','scripts/role.mjs','scripts/check.mjs','scripts/package-deployment.ps1')) {
  $relativePaths.Add($file)
}
foreach ($directory in @('server','public','docs','tests')) {
  Get-ChildItem -LiteralPath (Join-Path $projectDirectory $directory) -File -Recurse | ForEach-Object {
    $relativePaths.Add([IO.Path]::GetRelativePath($projectDirectory, $_.FullName).Replace('\','/'))
  }
}
$archive = [IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($relativePath in $relativePaths) {
    $sourcePath = [IO.Path]::GetFullPath((Join-Path $projectDirectory $relativePath))
    if (-not $sourcePath.StartsWith($projectDirectory + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Archive input is outside the project.' }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$sourcePath,'anikind/' + $relativePath,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }
$checksum = Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
($checksum.Hash + '  ' + [IO.Path]::GetFileName($archivePath)) | Set-Content -LiteralPath ($archivePath + '.sha256') -Encoding utf8
Write-Host "Deployment archive: $archivePath"
Write-Host "Files: $($relativePaths.Count); SHA256: $($checksum.Hash)"
