# Framework-dependent CefSharp with an app-local .NET 10 Windows Desktop runtime.
# End users do not need to install the .NET SDK or a system-wide .NET runtime.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repo = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $repo 'runtime\CEF'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$project = Join-Path $repo 'cef\KS.Cef.Client.csproj'
Write-Host 'Publishing CefSharp WinForms Windows x64 with all native payload files...'

# .NET 9+ apphost: find the runtime in the sibling 'dotnet' directory,
# instead of depending on a globally installed copy of .NET.
& dotnet publish $project --configuration Release --runtime win-x64 --self-contained false --output $dest -p:PublishSingleFile=false -p:UseAppHost=true -p:AppHostDotNetSearch=AppRelative -p:AppHostRelativeDotNet=dotnet -p:AppHostDotNetSearch=AppRelative -p:AppHostRelativeDotNet=dotnet
if ($LASTEXITCODE -ne 0) { throw "CefSharp publish failed with exit code $LASTEXITCODE" }
if (-not (Test-Path (Join-Path $dest 'KS.Cef.Client.exe'))) { throw 'CefSharp application EXE missing' }
if (-not (Get-ChildItem $dest -Recurse -File -Filter libcef.dll | Select-Object -First 1)) { throw 'CEF native libcef.dll missing after publish' }

$dotnetInstaller = Join-Path $env:RUNNER_TEMP 'dotnet-install.ps1'
Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $dotnetInstaller
$localRuntime = Join-Path $dest 'dotnet'
New-Item -ItemType Directory -Force -Path $localRuntime | Out-Null
foreach($kind in @('dotnet','windowsdesktop')){
  Write-Host "Installing .NET 10 app-local runtime: $kind"
  & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $dotnetInstaller -Runtime $kind -Channel '10.0' -Architecture x64 -InstallDir $localRuntime -NoPath
  if($LASTEXITCODE -ne 0){throw "Local .NET runtime installation failed: $kind"}
}
$hostExe = Join-Path $localRuntime 'dotnet.exe'
if(-not (Test-Path $hostExe -PathType Leaf)){throw 'Local .NET host missing'}
if(-not (Test-Path (Join-Path $localRuntime 'host\fxr') -PathType Container)){throw 'Local .NET host/fxr missing'}
$runtimes = & $hostExe --list-runtimes
if($LASTEXITCODE -ne 0){throw 'Bundled dotnet.exe failed'}
foreach($framework in @('Microsoft.NETCore.App','Microsoft.WindowsDesktop.App')){
  if(-not ($runtimes | Where-Object { $_ -match ('^'+[regex]::Escape($framework)+' 10\.') })){throw "Missing local .NET 10 framework: $framework"}
}
foreach($nativeFile in @('libcef.dll','icudtl.dat','CefSharp.dll','CefSharp.BrowserSubprocess.exe','CefSharp.BrowserSubprocess.Core.dll','assets\ks-logo.png','overlay\overlay.js','overlay\workshop.js','overlay\game_extras.js','overlay\webgl_cosmetics.js','overlay\game_runtime.js','overlay\render_telemetry.js','overlay\advanced_integration.js','overlay\freeze_guard.js')){
  if(-not (Test-Path (Join-Path $dest $nativeFile) -PathType Leaf)){throw "Incomplete CEF package: $nativeFile"}
}
Write-Host 'CEF and .NET 10 base/Desktop runtimes are assembled.'
