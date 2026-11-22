# Archive one committed release tree, scan the actual contents and optionally
# extract the approved files into a fresh Windows build directory.
[CmdletBinding()]
param(
    [string]$Version,
    [string]$Commit = $env:GITHUB_SHA,
    [string]$OutputDirectory,
    [string]$RebuildDirectory
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
if (-not $Version) {
    $package = Get-Content -Raw -LiteralPath (Join-Path $repo 'electron-app/package.json') | ConvertFrom-Json
    $Version = $package.version -replace '-beta$', ''
}
if (-not $Commit) {
    $Commit = & git -C $repo rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot determine source commit' }
}
if (-not $OutputDirectory) { $OutputDirectory = $repo }
$arguments = @('package', '--repository', $repo, '--commit', $Commit, '--version', $Version, '--output', $OutputDirectory)
if ($RebuildDirectory) { $arguments += @('--rebuild-directory', $RebuildDirectory) }
& python (Join-Path $PSScriptRoot 'source_snapshot.py') @arguments
if ($LASTEXITCODE -ne 0) { throw 'Source archive verification failed' }
