# Publish the two independent Windows downloads after every required build gate
# passes. Publishing to GitHub Releases is more accessible than a nested Actions
# artifact; it does not bypass Chrome Safe Browsing or SmartScreen.
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
$tag='v1.0.1-beta'
$paths=@(
  'KS-Client-beta-1.0.1-Portable.zip',
  'KS-Client-beta-1.0.1-Setup.exe',
  'SHA256SUMS.txt','RELEASE-MANIFEST.json',
  'CI-TEST-RESULT.txt','SIGNING-STATUS.txt'
)
foreach($path in $paths){if(-not (Test-Path $path -PathType Leaf)){throw "Cannot publish missing file $path"}}
& gh release view $tag --repo $repo *> $null
if($LASTEXITCODE -eq 0){
    # Preserve previously validated release binaries.
    & gh release edit $tag --repo $repo --notes-file 'RELEASE_BETA_101_HU.md'
    if($LASTEXITCODE -ne 0){throw "Could not refresh $tag release notes"}
    Write-Host "Private release already exists; verified assets preserved."
} else {
    & gh release create $tag @paths --repo $repo --target $env:GITHUB_SHA --title 'KS Client Beta 1.0.1' --prerelease --notes-file 'RELEASE_BETA_101_HU.md'
    if($LASTEXITCODE -ne 0){throw "GitHub private release $tag publishing failed"}
}
Write-Host "Verified source release: https://github.com/$repo/releases/tag/$tag"

# Optional public BINARY-ONLY update channel. Do not expose the source repository
# or embed a GitHub token in the Windows client. This requires the user to create
# a separate PUBLIC epicjatekosok/KS-Client-Updates repository and configure a
# fine-grained KS_PUBLIC_RELEASE_TOKEN with Contents read/write on that repo.
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
        & gh release create $tag @paths --repo $publicRepo --target main --title 'KS Client Beta 1.0.1 (Windows binaries)' --prerelease --notes-file 'RELEASE_BETA_101_HU.md'
        if($LASTEXITCODE -ne 0){throw "Could not publish verified update assets to $publicRepo"}
        Write-Host "Public auto-update feed: https://github.com/$publicRepo/releases/tag/$tag"
    }
    # Do not claim an auto-update feed is ready until every required binary is
    # present in a PUBLIC GitHub release and anonymous clients can read its API.
    $publicAssets=@(& gh api "repos/$publicRepo/releases/tags/$tag" --jq '.assets[] | select(.state == "uploaded") | .name')
    if($LASTEXITCODE -ne 0){throw "Public release metadata could not be queried"}
    foreach($required in $paths){
        if($publicAssets -notcontains $required){throw "Public release missing uploaded asset: $required"}
    }
    $anonHeaders=@{'User-Agent'='KS-Client-Public-Feed-Verification';'Accept'='application/vnd.github+json'}
    $anonymous=Invoke-RestMethod -Uri "https://api.github.com/repos/$publicRepo/releases/tags/$tag" -Method Get -Headers $anonHeaders -TimeoutSec 20
    if($anonymous.tag_name -ne $tag){throw "Public GitHub API returned a different release"}
    $setupName='KS-Client-beta-1.0.1-Setup.exe'
    $assets=@($anonymous.assets | Where-Object { $_.name -eq $setupName -and $_.state -eq 'uploaded' })
    if($assets.Count -ne 1 -or $assets[0].digest -notmatch '^sha256:[0-9a-f]{64}$'){
        throw "Anonymous API missing a fully uploaded, SHA256-digested Setup.exe"
    }
    Write-Host "PASS: public feed anonymously readable; all release files and Setup SHA256 confirmed"

    # This existing bridge was published for Beta 1.0.0. Never replace its
    # hash-verified setup with Beta 1.0.1 (older Alpha users keep their bridge).
    if($tag -eq 'v1.0.0-beta') {
    # Legacy Alpha 1.1.23 clients have an updater that only recognizes -alpha
    # release tags. Their normal automatic/manual checks cannot parse -beta,
    # regardless of current GitHub permissions. Publish a ONE-TIME, clearly
    # labelled COMPATIBILITY BRIDGE that offers the exact verified Beta setup
    # binary under the legacy Alpha name for that OLD updater. New Beta clients
    # rank Alpha below Beta and will never treat this bridge as an update.
    $bridgeTag='v1.1.24-alpha'
    $bridgeSetup='KS-Client-alpha-1.1.24-Setup.exe'
    $mainHash=(Get-FileHash -Algorithm SHA256 -LiteralPath $setupName).Hash.ToLowerInvariant()
    Copy-Item -LiteralPath $setupName -Destination $bridgeSetup -Force
    if((Get-FileHash -Algorithm SHA256 -LiteralPath $bridgeSetup).Hash.ToLowerInvariant() -ne $mainHash){
        throw 'Legacy updater bridge copy failed SHA256 verification'
    }
    & gh release view $bridgeTag --repo $publicRepo *> $null
    if($LASTEXITCODE -ne 0) {
        & gh release create $bridgeTag $bridgeSetup --repo $publicRepo --target main --title 'Alpha update bridge: installs KS Client Beta 1.0.0' --prerelease --notes-file 'ALPHA_TO_BETA_BRIDGE_HU.md'
        if($LASTEXITCODE -ne 0){throw "Cannot publish Alpha-to-Beta compatibility bridge"}
    }
    $bridgeAnon=Invoke-RestMethod -Uri "https://api.github.com/repos/$publicRepo/releases/tags/$bridgeTag" -Method Get -Headers $anonHeaders -TimeoutSec 20
    $bridgeAssets=@($bridgeAnon.assets | Where-Object { $_.name -eq $bridgeSetup -and $_.state -eq 'uploaded' })
    if($bridgeAssets.Count -ne 1 -or $bridgeAssets[0].digest -ne ('sha256:'+$mainHash)){
        throw 'Legacy Alpha client bridge asset missing or differs from verified Beta Setup'
    }
    Write-Host 'PASS: Alpha 1.1.23 can discover and securely install Beta 1.0.0 via v1.1.24-alpha compatibility bridge'

    }

} finally {
    $env:GH_TOKEN=$privateToken
}
