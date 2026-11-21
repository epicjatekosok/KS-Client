$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $repo 'runtime/Electron'
$appFolder=Join-Path $runtime 'resources/app'
$original=Join-Path $env:RUNNER_TEMP 'ks-original-app'
$env:KS_RESOLUTION_RESULT=Join-Path $env:RUNNER_TEMP 'ks-render-sizes.txt'
Move-Item $appFolder $original
try {
    New-Item -ItemType Directory $appFolder | Out-Null
    '{"name":"ks-resolution-test","version":"1.0.0","main":"render-resolution.cjs"}' | Set-Content "$appFolder/package.json" -Encoding utf8NoBOM
    Copy-Item "$original/game-resolution.cjs","$repo/tests/render-resolution.cjs" $appFolder
    $process=Start-Process "$runtime/electron.exe" -PassThru
    if(-not $process.WaitForExit(90000)){$process.Kill();throw 'Render test timed out'}
    Get-Content $env:KS_RESOLUTION_RESULT
    if($process.ExitCode -ne 0){throw 'Windows WebGL resolution test failed'}
} finally {
    Remove-Item $appFolder -Recurse -Force
    Move-Item $original $appFolder
}
