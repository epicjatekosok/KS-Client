$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $repo 'installer')
try {
  go build -trimpath -ldflags '-s -w -H windowsgui' -o '../KS-Client-beta-1.0.30-Setup.exe' .
  if ($LASTEXITCODE -ne 0) { throw 'Offline setup build failed' }
} finally { Pop-Location }
if (-not (Test-Path (Join-Path $repo 'KS-Client-beta-1.0.30-Setup.exe'))) { throw 'Setup EXE missing' }
