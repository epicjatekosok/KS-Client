# Optional genuine Authenticode signing for KS Client first-party binaries.
# Both KS_SIGNING_PFX_BASE64 and KS_SIGNING_PFX_PASSWORD must be protected Actions secrets.
[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('cef','native','setup')][string]$Stage)
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$encoded=$env:KS_SIGNING_PFX_BASE64
$password=$env:KS_SIGNING_PFX_PASSWORD
if([bool]$encoded -xor [bool]$password) { throw 'Both signing secrets must be configured together' }
if(-not $encoded) {
    Write-Host "AUTHENTICODE: No certificate configured; $Stage binaries remain unsigned. Windows warnings possible."
    return
}
$files=switch($Stage) {
    'cef' { @(Join-Path $repo 'runtime/CEF/KS.Cef.Client.exe') }
    'native' { @((Join-Path $repo 'KS-Client.exe'),(Join-Path $repo 'Uninstall-KS-Client.exe')) }
    'setup' { @(Join-Path $repo 'KS-Client-beta-1.0.8-Setup.exe') }
}
$exe=Get-Command signtool.exe -ErrorAction SilentlyContinue
if(-not $exe) {
    $kits=Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Windows Kits/10/bin'
    $exe=Get-ChildItem $kits -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
      Where-Object {$_.FullName -match 'x64'} | Sort-Object FullName -Descending | Select-Object -First 1
    if(-not $exe){throw 'Windows SDK signtool.exe unavailable'}
}
$signer=$exe.Source
if(-not $signer){$signer=$exe.FullName}
$temp=Join-Path $env:RUNNER_TEMP ('ks-publisher-'+[guid]::NewGuid().ToString('N')+'.pfx')
try {
    [System.IO.File]::WriteAllBytes($temp,[Convert]::FromBase64String($encoded))
    foreach($path in $files) {
        if(-not (Test-Path $path -PathType Leaf)){throw "Signing input missing: $path"}
        & $signer sign /fd SHA256 /f $temp /p $password /tr 'http://timestamp.digicert.com' /td SHA256 $path | Out-Null
        if($LASTEXITCODE -ne 0){throw "Authenticode signing failed: $([IO.Path]::GetFileName($path))"}
        $check=Get-AuthenticodeSignature -FilePath $path
        if($check.Status -ne 'Valid'){throw "Signature invalid for $path : $($check.Status)"}
        Write-Host "Authenticode valid: $([IO.Path]::GetFileName($path)) ($($check.SignerCertificate.Subject))"
    }
} finally {
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
}
