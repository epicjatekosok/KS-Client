# Audit signatures; do not claim an unsigned binary is trusted.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
# The verification target must match the EXE compiled from this source.
$package=Get-Content -LiteralPath (Join-Path $repo 'electron-app/package.json') -Raw | ConvertFrom-Json
$packageVersion=[string]$package.version
if($packageVersion -notmatch '^[0-9]+[.][0-9]+[.][0-9]+-beta$'){
    throw "Invalid standalone Beta release metadata: $packageVersion"
}
$releaseNumber=$packageVersion -replace '-beta$',''
$setupName="KS-Client-beta-$releaseNumber-Setup.exe"
$files=@('KS-Client.exe','Uninstall-KS-Client.exe',
  'runtime/CEF/KS.Cef.Client.exe',$setupName)
$require=[bool]$env:KS_SIGNING_PFX_BASE64
$allValid=$true
$report=@('KS CLIENT BETA $releaseNumber CODE SIGNING STATUS',
  'Authenticode verification only; not a guarantee of browser or SmartScreen reputation.')
foreach($rel in $files) {
  $path=Join-Path $repo $rel
  if(-not (Test-Path $path -PathType Leaf)){throw "Cannot verify missing file: $rel"}
  $signature=Get-AuthenticodeSignature -FilePath $path
  $status=$signature.Status.ToString()
  $report+=($rel+': '+$status)
  if($status -ne 'Valid'){$allValid=$false}
  if($require -and $status -ne 'Valid'){throw "Configured certificate but $rel is not signed"}
}
$report+=('Fully Authenticode-signed: '+$allValid)
$report+=('No anti-virus bypass, no fake trusted publisher, no disabled system protection.')
$report | Set-Content -Path (Join-Path $repo 'SIGNING-STATUS.txt') -Encoding UTF8
$report | ForEach-Object {Write-Host $_}
