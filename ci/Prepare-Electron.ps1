# Runs ONLY on the Windows GitHub Actions build machine.
[CmdletBinding()]
param([string]$Version = '45.3.2')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $repo 'runtime\Electron'
$temp = Join-Path $env:RUNNER_TEMP 'ks-electron-download'
New-Item -ItemType Directory -Force -Path $temp | Out-Null
if (Test-Path $dest) { Remove-Item $dest -Force -Recurse }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$file = "electron-v$Version-win32-x64.zip"
$base = "https://github.com/electron/electron/releases/download/v$Version/"
$zip = Join-Path $temp $file
$checksums = Join-Path $temp 'SHASUMS256.txt'
Write-Host "Downloading pinned official Electron $Version"
Invoke-WebRequest -Uri ($base + 'SHASUMS256.txt') -OutFile $checksums -MaximumRedirection 5
Invoke-WebRequest -Uri ($base + $file) -OutFile $zip -MaximumRedirection 5
$line = Get-Content $checksums | Where-Object { $_.TrimEnd().EndsWith($file) } | Select-Object -First 1
if (-not $line -or $line -notmatch '^\s*([0-9a-fA-F]{64})\s+') { throw 'Official Electron SHA256 entry missing' }
$expected = $Matches[1].ToLowerInvariant()
$actual = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Electron ZIP SHA256 mismatch: $actual" }
Write-Host "Official Electron SHA256 verified: $actual"
Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force
$app = Join-Path $dest 'resources\app'
New-Item -ItemType Directory -Force -Path $app | Out-Null
Copy-Item (Join-Path $repo 'electron-app\*') $app -Recurse -Force
# Never require libEGL.dll: optional in some Electron distributions.
foreach ($relative in @('electron.exe','resources\app\package.json','resources\app\main.cjs','resources\app\preload.cjs','resources\app\overlay\overlay.js','resources\app\assets\loading.html','resources\app\assets\ks-logo.png','resources\app\overlay\game_extras.js','resources\app\overlay\workshop.js','resources\app\overlay\webgl_cosmetics.js','resources\app\overlay\game_runtime.js','resources\app\overlay\render_telemetry.js','resources\app\overlay\advanced_integration.js','resources\app\overlay\freeze_guard.js','resources\app\swapper.cjs')) {
  if (-not (Test-Path (Join-Path $dest $relative))) { throw "Electron package is missing $relative" }
}
Write-Host 'Electron runtime and KS Client assets are assembled.'
