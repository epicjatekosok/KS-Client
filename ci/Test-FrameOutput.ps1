# Exercise the shipped pacer in a visible window, with native Windows ETW capture.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$env:KS_CAPTURE_DIRECTORY = Join-Path $env:RUNNER_TEMP ('ks-frames-' + [guid]::NewGuid())
New-Item -ItemType Directory $env:KS_CAPTURE_DIRECTORY | Out-Null
$env:KS_PRESENTMON = Join-Path $env:KS_CAPTURE_DIRECTORY 'PresentMon.exe'
Invoke-WebRequest 'https://github.com/GameTechDev/PresentMon/releases/download/v2.3.1/PresentMon-2.3.1-x64.exe' -OutFile $env:KS_PRESENTMON
if ((Get-FileHash $env:KS_PRESENTMON).Hash -ne '364e5d98d4d134bd54dd25c22ed2ca2f4883f8bc3ed6502bee0c151e3436d30c') { throw 'PresentMon checksum mismatch' }
$runtime = Join-Path $repo 'runtime/Electron'
$appDir = Join-Path $runtime 'resources/app'
$backup = Join-Path $env:KS_CAPTURE_DIRECTORY 'original-app'
Move-Item $appDir $backup
try {
    New-Item -ItemType Directory $appDir | Out-Null
    '{"name":"ks-frame-test","version":"1.0.0","main":"frame-output-windows.cjs"}' | Set-Content "$appDir/package.json" -Encoding utf8NoBOM
    Copy-Item "$backup/overlay/frame_pacer.js","$repo/tests/frame-output-windows.cjs" $appDir
    foreach ($mode in 'normal','unlocked') {
        $process = Start-Process "$runtime/KSClientGame.exe" -ArgumentList "--ks-benchmark-$mode" -PassThru
        if (!$process.WaitForExit(200000)) { $process.Kill(); throw "Timed out in $mode" }
        $result = Get-Content "$env:KS_CAPTURE_DIRECTORY/$mode.json" -Raw
        Write-Host $result
        if ($process.ExitCode) { throw "Benchmark failed in $mode" }
        foreach ($case in ($result | ConvertFrom-Json)) {
            $csv = Join-Path $env:KS_CAPTURE_DIRECTORY $case.file
            if (!(Test-Path $csv)) { Write-Host "ETW unavailable for $($case.file)"; continue }
            python "$repo/tools/analyze_presentmon.py" $csv --all-chains
            if ($LASTEXITCODE) { throw 'Invalid PresentMon capture' }
        }
    }
} finally {
    Remove-Item $appDir -Recurse -Force
    Move-Item $backup $appDir
}
