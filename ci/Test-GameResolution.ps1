param([ValidateSet('resolution','gallery')][string]$Test = 'resolution')
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$runtime=Join-Path $repo 'runtime/Electron'
$appFolder=Join-Path $runtime 'resources/app'
$tempRoot = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$original=Join-Path $tempRoot 'ks-original-app'
$env:KS_RESOLUTION_RESULT=Join-Path $tempRoot "ks-test-$Test-$([guid]::NewGuid()).txt"
Move-Item $appFolder $original
try {
    New-Item -ItemType Directory $appFolder | Out-Null
    if ($Test -eq 'gallery') {
        '{"name":"ks-gallery-test","version":"1.0.0","main":"tests/gallery-windows.cjs"}' | Set-Content "$appFolder/package.json" -Encoding utf8NoBOM
        New-Item -ItemType Directory "$appFolder/tests" | Out-Null
        Copy-Item "$repo/tests/gallery-windows.cjs" "$appFolder/tests"
        Copy-Item $original "$appFolder/electron-app" -Recurse
    } else {
        '{"name":"ks-resolution-test","version":"1.0.0","main":"render-resolution.cjs"}' | Set-Content "$appFolder/package.json" -Encoding utf8NoBOM
        Copy-Item "$original/game-resolution.cjs","$repo/tests/render-resolution.cjs" $appFolder
    }
    $process=Start-Process "$runtime/electron.exe" -PassThru
    if(-not $process.WaitForExit(90000)){
        $process.Kill()
        if (Test-Path $env:KS_RESOLUTION_RESULT) { Get-Content $env:KS_RESOLUTION_RESULT }
        throw "Windows Electron $Test test timed out"
    }
    Get-Content $env:KS_RESOLUTION_RESULT
    if($process.ExitCode -ne 0){throw "Windows Electron $Test test failed"}
} finally {
    Remove-Item $appFolder -Recurse -Force
    Move-Item $original $appFolder
}
