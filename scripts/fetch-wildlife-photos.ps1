$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
$destination=Join-Path $projectRoot 'public/assets/wildlife-photos'
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$candidates=@(Get-Content -LiteralPath (Join-Path $projectRoot 'tmp/wildlife-photo-candidates.json') -Raw | ConvertFrom-Json -AsHashtable)
$previousManifest=Join-Path $projectRoot 'server/wildlife-photos.json'
$previous=if(Test-Path -LiteralPath $previousManifest){@(Get-Content -LiteralPath $previousManifest -Raw | ConvertFrom-Json -AsHashtable)}else{@()}
function Plain([string]$Html){[System.Net.WebUtility]::HtmlDecode(($Html -replace '<[^>]+>',' ' -replace '\s+',' ').Trim())}
function CommonsPhoto([string]$FileName){
  $url='https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url%7Csize%7Cextmetadata&iiurlwidth=1000&titles='+[uri]::EscapeDataString('File:'+$FileName)
  $result=Invoke-RestMethod -Uri $url -TimeoutSec 60
  $info=$result.query.pages[0].imageinfo[0]
  return @{fileName=$FileName;sourceUrl=$info.descriptionurl;downloadUrl=if($info.thumburl){$info.thumburl}else{$info.url};width=$info.width;height=$info.height;author=(Plain $info.extmetadata.Artist.value);license=$info.extmetadata.LicenseShortName.value;licenseUrl=$info.extmetadata.LicenseUrl.value;description=(Plain $info.extmetadata.ImageDescription.value)}
}
$vaquita=$candidates | Where-Object {$_.recordId -eq 20}
$replacement=CommonsPhoto 'Vaquita2 Olson NOAA crop2.jpg'
foreach($key in $replacement.Keys){$vaquita[$key]=$replacement[$key]}
$wombat=$candidates | Where-Object {$_.recordId -eq 31}
$wombat.sourceUrl='https://www.qld.gov.au/environment/plants-animals/conservation/threatened-species/featured-projects/northern-hairy-nosed-wombat/northern-hairy-nosed-wombat/monitoring-management'
$wombat.downloadUrl='https://www.qld.gov.au/__data/assets/image/0014/211802/Wombats-and-station-QLD-Gov.jpg'
$wombat.fileName='Wombats-and-station-QLD-Gov.jpg';$wombat.author='© The State of Queensland';$wombat.license='CC BY 4.0';$wombat.licenseUrl='https://creativecommons.org/licenses/by/4.0/';$wombat.licenseEvidence='https://www.qld.gov.au/legal/copyright'
$wombat.description='Northern hairy-nosed wombats (Lasiorhinus krefftii) using a food and water station. Queensland Government remote camera photograph.'
$wombat.width=0;$wombat.height=0
$fossil=CommonsPhoto 'Triceratops skeleton at National Science Museum in South Korea.jpg'
$fossil.recordId='triceratops';$fossil.name='三角龙';$fossil.scientificName='Triceratops';$fossil.imageKind='skeleton-photograph'
$candidates += $fossil
$manifest=@()
foreach($item in $candidates){
  if(-not $item.sourceUrl -or -not $item.author -or -not $item.license){throw ('Incomplete attribution: '+$item.name)}
  if($item.fileName -notmatch '\.jpe?g$'){throw ('Not a photograph candidate: '+$item.fileName)}
  $fileName=$item.recordId.ToString()+'.jpg'
  $path=Join-Path $destination $fileName
  $download=([uri]$item.downloadUrl).GetLeftPart([System.UriPartial]::Path)
  $prior=$previous | Where-Object {$_.recordId -eq $item.recordId} | Select-Object -First 1
  if(-not(Test-Path -LiteralPath $path) -or ($prior -and $prior.downloadUrl -ne $download)){
    for($attempt=0;$attempt -lt 3;$attempt++){
      try{Invoke-WebRequest -Uri $download -OutFile $path -TimeoutSec 60;break}catch{if($attempt -eq 2){throw}}
    }
  }
  $manifest += [ordered]@{recordId=$item.recordId;name=$item.name;scientificName=$item.scientificName;path=('/assets/wildlife-photos/'+$fileName);kind=if($item.imageKind){$item.imageKind}else{'photograph'};width=$item.width;height=$item.height;sourceUrl=$item.sourceUrl;downloadUrl=$download;author=$item.author;license=$item.license;licenseUrl=if($item.licenseUrl){$item.licenseUrl -replace '^http:','https:'}elseif($item.license -eq 'Public domain'){'https://creativecommons.org/publicdomain/mark/1.0/'}else{$item.sourceUrl};licenseEvidence=$item.licenseEvidence;description=$item.description;verifiedAt='2026-09-25';changes='页面按比例缩放并用拼块遮罩展示，未改变动物外形。'}
  Write-Host ($item.recordId.ToString()+' '+$item.name+' '+(Get-Item -LiteralPath $path).Length+' bytes')
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $projectRoot 'server/wildlife-photos.json') -Encoding utf8
Write-Host ('Saved '+$manifest.Count+' real photographs and attribution records.')
