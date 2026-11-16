$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
Push-Location (Join-Path $repo 'installer')
try {
  go build -trimpath -ldflags '-s -w -H windowsgui' -o '../KS-Client-alpha-1.1.23-Setup.exe' .
  if ($LASTEXITCODE -ne 0) { throw 'Offline setup build failed' }
} finally { Pop-Location }
if (-not (Test-Path (Join-Path $repo 'KS-Client-alpha-1.1.23-Setup.exe'))) { throw 'Setup EXE missing' }
