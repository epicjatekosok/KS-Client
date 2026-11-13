$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
  foreach($part in @('launcher','installer','uninstaller')) {
    python tools/make_windows_icon_resource.py $part
    if ($LASTEXITCODE -ne 0) { throw "Icon generation failed for $part" }
  }
  Push-Location launcher
  try { go build -trimpath -ldflags '-s -w -H windowsgui' -o ../KS-Client.exe .; if ($LASTEXITCODE -ne 0) {throw 'Launcher build failed'} }
  finally {Pop-Location}
  Push-Location uninstaller
  try { go build -trimpath -ldflags '-s -w -H windowsgui' -o ../Uninstall-KS-Client.exe .; if($LASTEXITCODE -ne 0) {throw 'Uninstaller build failed'} }
  finally {Pop-Location}
} finally { Pop-Location }
