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
$tag='v1.1.21-alpha'
$paths=@(
  'KS-Client-alpha-1.1.21-Portable.zip',
  'KS-Client-alpha-1.1.21-Setup.exe',
  'SHA256SUMS.txt','RELEASE-MANIFEST.json',
  'CI-TEST-RESULT.txt','SIGNING-STATUS.txt'
)
foreach($path in $paths){if(-not (Test-Path $path -PathType Leaf)){throw "Cannot publish missing file $path"}}
& gh release view $tag --repo $repo *> $null
if($LASTEXITCODE -eq 0){
    # Preserve previously validated release binaries.
    & gh release edit $tag --repo $repo --notes-file 'RELEASE_121_HU.md'
    if($LASTEXITCODE -ne 0){throw "Could not refresh $tag release notes"}
    Write-Host "Private release already exists; verified assets preserved."
} else {
    & gh release create $tag @paths --repo $repo --target $env:GITHUB_SHA --title 'KS Client alpha 1.1.21' --prerelease --notes-file 'RELEASE_121_HU.md'
    if($LASTEXITCODE -ne 0){throw "GitHub private release $tag publishing failed"}
}
Write-Host "Verified source release: https://github.com/$repo/releases/tag/$tag"

# Optional public BINARY-ONLY update channel. Do not expose the source repository
# or embed a GitHub token in the Windows client. This requires the user to create
# a separate PUBLIC epicjatekosok/KS-Client-Updates repository and configure a
# fine-grained KS_PUBLIC_RELEASE_TOKEN with Contents read/write on that repo.
if(-not $env:KS_PUBLIC_RELEASE_TOKEN){
    Write-Host 'PUBLIC AUTO-UPDATES NOT YET CONFIGURED: missing KS_PUBLIC_RELEASE_TOKEN.'
    Write-Host 'The private release remains available; automatic checks will report that the public feed is unavailable.'
    return
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
        & gh release create $tag @paths --repo $publicRepo --target main --title 'KS Client alpha 1.1.21 (Windows binaries)' --prerelease --notes-file 'RELEASE_121_HU.md'
        if($LASTEXITCODE -ne 0){throw "Could not publish verified update assets to $publicRepo"}
        Write-Host "Public auto-update feed: https://github.com/$publicRepo/releases/tag/$tag"
    }
} finally {
    $env:GH_TOKEN=$privateToken
}
