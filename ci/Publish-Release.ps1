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
$tag='v1.1.17-alpha'
$paths=@(
  'KS-Client-alpha-1.1.17-Portable.zip',
  'KS-Client-alpha-1.1.17-Setup.exe',
  'SHA256SUMS.txt','RELEASE-MANIFEST.json',
  'CI-TEST-RESULT.txt','SIGNING-STATUS.txt'
)
foreach($path in $paths){if(-not (Test-Path $path -PathType Leaf)){throw "Cannot publish missing file $path"}}
& gh release view $tag --repo $repo *> $null
if($LASTEXITCODE -eq 0){
    # Do not overwrite verified EXE/ZIP assets. Release notes are editable
    # metadata; update them to the correct version's QA notes and warnings.
    & gh release edit $tag --repo $repo --notes-file 'RELEASE_117_HU.md'
    if($LASTEXITCODE -ne 0){throw "Could not update the $tag release notes"}
    Write-Host "GitHub release $tag already exists; verified binaries preserved, notes refreshed."
    return
}
& gh release create $tag @paths --repo $repo --target $env:GITHUB_SHA --title 'KS Client alpha 1.1.17' --prerelease --notes-file 'RELEASE_117_HU.md'
if($LASTEXITCODE -ne 0){throw "GitHub release $tag publishing failed"}
Write-Host "Published immutable release at https://github.com/$repo/releases/tag/$tag"
