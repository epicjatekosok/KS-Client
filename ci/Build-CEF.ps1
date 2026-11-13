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
& dotnet publish $project --configuration Release --runtime win-x64 --self-contained false --output $dest -p:PublishSingleFile=false -p:AppHostDotNetSearch=AppRelative -p:AppHostRelativeDotNet=dotnet
if ($LASTEXITCODE -ne 0) { throw "CefSharp publish failed with exit code $LASTEXITCODE" }
if (-not (Test-Path (Join-Path $dest 'KS.Cef.Client.exe'))) { throw 'CefSharp application EXE missing' }
if (-not (Get-ChildItem $dest -Recurse -File -Filter libcef.dll | Select-Object -First 1)) { throw 'CEF native libcef.dll missing after publish' }

$dotnetInstaller = Join-Path $env:RUNNER_TEMP 'dotnet-install.ps1'
Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $dotnetInstaller
$localRuntime = Join-Path $dest 'dotnet'

# The Windows Desktop runtime alone does not guarantee the dotnet.exe host
# is present. Install the base .NET Runtime and then Windows Desktop Runtime.
Write-Host 'Installing app-local .NET 10 Runtime (host + Microsoft.NETCore.App)...'
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $dotnetInstaller -Runtime dotnet -Channel 10.0 -Architecture x64 -InstallDir $localRuntime -NoPath
if ($LASTEXITCODE -ne 0) { throw "Downloading local .NET Runtime failed: $LASTEXITCODE" }

Write-Host 'Installing app-local .NET 10 Windows Desktop Runtime...'
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $dotnetInstaller -Runtime windowsdesktop -Channel 10.0 -Architecture x64 -InstallDir $localRuntime -NoPath
if ($LASTEXITCODE -ne 0) { throw "Downloading local Windows Desktop Runtime failed: $LASTEXITCODE" }

$localDotnet = Join-Path $localRuntime 'dotnet.exe'
if (-not (Test-Path $localDotnet)) { throw 'Local .NET host missing' }
if (-not (Get-ChildItem (Join-Path $localRuntime 'host\fxr') -Directory -ErrorAction SilentlyContinue)) { throw 'Local .NET hostfxr missing' }
if (-not (Get-ChildItem (Join-Path $localRuntime 'shared\Microsoft.NETCore.App') -Directory -ErrorAction SilentlyContinue)) { throw 'Local .NET runtime missing' }
if (-not (Get-ChildItem (Join-Path $localRuntime 'shared\Microsoft.WindowsDesktop.App') -Directory -ErrorAction SilentlyContinue)) { throw 'Local .NET Windows Desktop runtime missing' }

Write-Host 'Installed local .NET runtimes:'
& $localDotnet --list-runtimes
if ($LASTEXITCODE -ne 0) { throw "Local dotnet.exe validation failed with exit code $LASTEXITCODE" }

Write-Host 'CEF publish and app-local Windows Desktop runtime are assembled.'
