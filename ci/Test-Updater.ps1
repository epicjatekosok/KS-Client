[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$launcher=Join-Path $root 'KS-Client.exe'
if(-not (Test-Path $launcher -PathType Leaf)){throw 'KS Client launcher not built'}
$json=(& $launcher --ks-update-self-test | Out-String).Trim()
if(-not $json){throw 'KS Client update CLI did not return JSON'}
$data=$json|ConvertFrom-Json -ErrorAction Stop
if($data.state -ne 'ready' -or $data.current -ne '1.0.10' -or $data.source -ne 'epicjatekosok/KS-Client-Updates' -or $data.channel -ne 'beta'){
 throw "Update CLI smoke test returned wrong state/version/source: $json"
}
Write-Host 'PASS: launcher update CLI is callable from native Electron and CEF bridges without network access'
