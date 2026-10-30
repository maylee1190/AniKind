param([switch]$Refresh)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$cachePath=Join-Path $projectRoot 'tmp/wildlife-photo-candidates.json'
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'tmp') | Out-Null
function Get-PublicJson([string]$Url){
  Invoke-RestMethod -Uri $Url -TimeoutSec 60 -UserAgent 'AniKind/0.1 educational wildlife photo reference'
}
function Plain([string]$Html){[System.Net.WebUtility]::HtmlDecode(($Html -replace '<[^>]+>',' ' -replace '\s+',' ').Trim())}
if((Test-Path -LiteralPath $cachePath) -and -not $Refresh){Write-Host 'Candidate cache already exists.';exit}
$species=Get-Content -LiteralPath (Join-Path $projectRoot 'server/globe-species.json') -Raw | ConvertFrom-Json | Where-Object {$_.design.icon -and -not $_.design.emptyInFigma}
$titles=($species.scientific -join '|')
$wiki=Get-PublicJson ('https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=pageimages%7Cinfo&piprop=name%7Coriginal&inprop=url&titles='+[uri]::EscapeDataString($titles))
$result=@()
foreach($animal in $species){
  $title=$animal.scientific
  foreach($mapping in @($wiki.query.normalized)+@($wiki.query.redirects)){if($mapping.from -eq $title){$title=$mapping.to}}
  $page=$wiki.query.pages | Where-Object {$_.title -eq $title} | Select-Object -First 1
  $result += [ordered]@{recordId=$animal.id;name=$animal.name;scientificName=$animal.scientific;articleTitle=$title;articleUrl=$page.fullurl;fileName=$page.pageimage;original=$page.original.source}
}
$files=($result | Where-Object {$_.fileName} | ForEach-Object {'File:'+$_.fileName}) -join '|'
$commons=Get-PublicJson ('https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=1000&titles='+[uri]::EscapeDataString($files))
foreach($item in $result){
  $file=$commons.query.pages | Where-Object {$_.title -eq ('File:'+$item.fileName -replace '_',' ')} | Select-Object -First 1
  $info=$file.imageinfo | Select-Object -First 1
  $item.sourceUrl=$info.descriptionurl;$item.downloadUrl=if($info.thumburl){$info.thumburl}else{$info.url}
  $item.width=$info.width;$item.height=$info.height
  $item.author=Plain $info.extmetadata.Artist.value
  $item.license=$info.extmetadata.LicenseShortName.value;$item.licenseUrl=$info.extmetadata.LicenseUrl.value
  $item.description=Plain $info.extmetadata.ImageDescription.value
  $item.categories=$info.extmetadata.Categories.value
}
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $cachePath -Encoding utf8
Write-Host ('Saved '+$result.Count+' photo candidates to '+$cachePath)
$result | ForEach-Object {Write-Host ($_.recordId.ToString()+' | '+$_.name+' | '+$_.fileName+' | '+$_.license)}
