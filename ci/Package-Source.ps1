# Create a public *source snapshot* without .git history, credentials,
# build output, user profiles or any GitHub Actions secret values.
[CmdletBinding()]
param([string]$Version='1.0.3')
$ErrorActionPreference='Stop'
if($Version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$'){throw 'Invalid source snapshot version'}
$root=Split-Path -Parent $PSScriptRoot
$filename="KS-Client-beta-$Version-Source.zip"
$checksum="KS-Client-beta-$Version-Source.sha256.txt"
Push-Location $root
try {
    $tracked=@(& git ls-files)
    if($LASTEXITCODE -ne 0 -or $tracked.Count -lt 35){throw 'Could not enumerate tracked source files'}
    foreach($file in $tracked){
        if($file -match '(^|/)(\.env($|\.)|\.git($|/)|secrets?\.|id_rsa|credentials?\.)' -or
            $file -match '(?i)\.(pfx|p12|pem|key|jks|keystore)$'){
            throw "Refusing to publish a potentially confidential source file: $file"
        }
    }
    $patterns=@(
      '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
      'ghp_[a-zA-Z0-9]{36}',
      'github_pat_[a-zA-Z0-9_]{30,}',
      'AIza[a-zA-Z0-9_-]{35}',
      'sk-[a-zA-Z0-9_-]{32,}'
    )
    foreach($file in $tracked){
        if($file -notmatch '(?i)\.(go|cjs|js|cs|py|ps1|json|md|txt|yml|yaml|html|csproj|xml)$'){continue}
        $source=Get-Content -LiteralPath $file -Raw -ErrorAction Stop
        foreach($pattern in $patterns){
            if($source -match $pattern){throw "Potential secret in tracked file $file; source archive blocked"}
        }
    }
    $out=Join-Path $root $filename
    if(Test-Path $out){Remove-Item $out -Force}
    & git archive --format=zip --output="$out" HEAD
    if($LASTEXITCODE -ne 0 -or -not (Test-Path $out)){throw 'Cannot generate clean source snapshot'}
    $hash=(Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath (Join-Path $root $checksum) -Value "$hash  $filename" -Encoding ascii
    Write-Host "PASS: $filename (tracked files only; no .git history), SHA256=$hash"
} finally {Pop-Location}
