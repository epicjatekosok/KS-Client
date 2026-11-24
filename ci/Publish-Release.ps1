# Publish the Windows downloads, source snapshot and checksums after all build gates pass.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
if($env:GITHUB_REF -ne 'refs/heads/main'){
    Write-Host 'Skipping release: not on the verified main branch'
    return
}
if(-not $env:GH_TOKEN){throw 'GITHUB_TOKEN is required to publish verified binaries'}
$repo=$env:GITHUB_REPOSITORY
if(-not $repo){throw 'GitHub repository not provided'}
# The Windows build has already run inside the verified Source ZIP's files.
# Validate the exact archive and rebuild inputs again before release credentials
# are used. A different checkout, archive, checksum or input fails closed.
$tag='v1.0.28-beta'
& python ci/source_snapshot.py verify --repository $env:GITHUB_WORKSPACE --commit $env:GITHUB_SHA --version '1.0.28' --output . --rebuild-directory .
if($LASTEXITCODE -ne 0){throw 'Source provenance verification failed'}
$paths=@(
  'KS-Client-beta-1.0.28-Portable.zip',
  'KS-Client-beta-1.0.28-Setup.exe',
  'KS-Client-beta-1.0.28-Source.zip','KS-Client-beta-1.0.28-Source.sha256.txt',
  'SHA256SUMS.txt','RELEASE-MANIFEST.json',
  'CI-TEST-RESULT.txt','SIGNING-STATUS.txt'
)
foreach($path in $paths){if(-not (Test-Path $path -PathType Leaf)){throw "Cannot publish missing file $path"}}
& gh release view $tag --repo $repo *> $null
if($LASTEXITCODE -eq 0){
    # Preserve previously validated release binaries.
    & gh release edit $tag --repo $repo --notes-file 'RELEASE_BETA_128_EN.md'
    if($LASTEXITCODE -ne 0){throw "Could not refresh $tag release notes"}
    Write-Host "Private release already exists; verified assets preserved."
} else {
    & gh release create $tag @paths --repo $repo --target $env:GITHUB_SHA --title 'KS Client Beta 1.0.28 (Audited source release)' --prerelease --notes-file 'RELEASE_BETA_128_EN.md'
    if($LASTEXITCODE -ne 0){throw "GitHub private release $tag publishing failed"}
}
Write-Host "Verified source release: https://github.com/$repo/releases/tag/$tag"

# Use explicit verified files. The public tag points to the public updates
# repository, and the source ZIP contains only the checked release tree.
$publicPaths=@($paths)
if(-not $env:KS_PUBLIC_RELEASE_TOKEN){
    throw 'Beta releases require KS_PUBLIC_RELEASE_TOKEN and the public KS-Client-Updates repo; refusing to report an auto-update-ready build without them.'
}
$privateToken=$env:GH_TOKEN
$publicRepo='epicjatekosok/KS-Client-Updates'
try{
    $env:GH_TOKEN=$env:KS_PUBLIC_RELEASE_TOKEN
    $state=(& gh api "repos/$publicRepo" --jq '.private' 2>$null)
    if($LASTEXITCODE -ne 0){throw "Public update repository does not exist or publishing token lacks permission: $publicRepo"}
    if(($state | Out-String).Trim() -ne 'false'){throw "Refusing to publish updates in a non-public repository"}
    & gh release view $tag --repo $publicRepo *> $null
    if($LASTEXITCODE -eq 0) {
        Write-Host "Public release $tag already exists; never overwrite verified downloadable assets."
    } else {
        # Public repo has its own main branch/commit, not the private source SHA.
        & gh release create $tag @publicPaths --repo $publicRepo --target main --title 'KS Client Beta 1.0.28 (Windows binaries)' --prerelease --notes-file 'RELEASE_BETA_128_EN.md'
        if($LASTEXITCODE -ne 0){throw "Could not publish verified update assets to $publicRepo"}
        Write-Host "Public auto-update feed: https://github.com/$publicRepo/releases/tag/$tag"
    }
    $anonHeaders=@{'User-Agent'='KS-Client-Public-Feed-Verification';'Accept'='application/vnd.github+json'}
    $anonymous=Invoke-RestMethod -Uri "https://api.github.com/repos/$publicRepo/releases/tags/$tag" -Method Get -Headers $anonHeaders -TimeoutSec 20
    if($anonymous.tag_name -ne $tag -or $anonymous.draft){throw "Public GitHub API returned a different or draft release"}
    foreach($required in $publicPaths){
        $assets=@($anonymous.assets | Where-Object { $_.name -eq $required -and $_.state -eq 'uploaded' })
        if($assets.Count -ne 1){throw "Public release missing uploaded asset: $required"}
        $sha=(Get-FileHash -Algorithm SHA256 -LiteralPath $required).Hash.ToLowerInvariant()
        if($assets[0].digest -ne ('sha256:'+$sha) -or $assets[0].size -ne (Get-Item -LiteralPath $required).Length){
            throw "Published asset differs from the verified CI build: $required"
        }
        if($required -match '(Setup\.exe|-Source\.zip)$'){
            $headers=Invoke-WebRequest -Method Head -Uri $assets[0].browser_download_url -TimeoutSec 60
            if($headers.StatusCode -ne 200){throw "Anonymous download check failed: $required"}
        }
        Write-Host "PASS: public $required verified. SHA256: $sha"
    }

    # Recreate the missing Alpha bridge from the historical public Beta 1.0.0
    # installer only. Pin its release digest and never replace existing assets.
    $bridgeTag='v1.1.24-alpha'
    $bridgeSetup='KS-Client-alpha-1.1.24-Setup.exe'
    $mainHash='1c1494d5e4777a0d1f696e15e76151b35f5342a73a491fbae7c126cc27132043'
    & gh release view $bridgeTag --repo $publicRepo *> $null
    if($LASTEXITCODE -ne 0){
        & gh release download v1.0.0-beta --repo $publicRepo --pattern 'KS-Client-beta-1.0.0-Setup.exe' --output $bridgeSetup
        if($LASTEXITCODE -ne 0 -or (Get-FileHash $bridgeSetup).Hash.ToLowerInvariant() -ne $mainHash){throw 'Historical setup verification failed'}
        & gh release create $bridgeTag $bridgeSetup --repo $publicRepo --target main --title 'Alpha update bridge: installs KS Client Beta 1.0.0' --prerelease --notes-file 'ALPHA_TO_BETA_BRIDGE_HU.md'
        if($LASTEXITCODE -ne 0){throw 'Alpha bridge publication failed'}
    }
    $bridgeAnon=Invoke-RestMethod -Uri "https://api.github.com/repos/$publicRepo/releases/tags/$bridgeTag" -Method Get -Headers $anonHeaders -TimeoutSec 20
    $bridgeAssets=@($bridgeAnon.assets | Where-Object { $_.name -eq $bridgeSetup -and $_.state -eq 'uploaded' })
    if($bridgeAssets.Count -ne 1 -or $bridgeAssets[0].digest -ne ('sha256:'+$mainHash)){
        throw 'Legacy Alpha client bridge asset missing or differs from verified Beta Setup'
    }
    Write-Host 'PASS: Alpha 1.1.23 can discover and securely install Beta 1.0.0 via v1.1.24-alpha compatibility bridge'

} finally {
    $env:GH_TOKEN=$privateToken
}
