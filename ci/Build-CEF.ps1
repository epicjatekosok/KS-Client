# Framework-dependent CefSharp plus an *app-local* Windows Desktop runtime.
# The user PC must never need a compiler or SDK to launch the built app.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$repo = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $repo 'runtime\CEF'
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$project = Join-Path $repo 'cef\KS.Cef.Client.csproj'
Write-Host 'Publishing CefSharp WinForms Windows x64 with all native payload files...'
& dotnet publish $project --configuration Release --runtime win-x64 --self-contained false --output $dest -p:PublishSingleFile=false
if ($LASTEXITCODE -ne 0) { throw "CefSharp publish failed with exit code $LASTEXITCODE" }
if (-not (Test-Path (Join-Path $dest 'KS.Cef.Client.exe'))) { throw 'CefSharp application EXE missing' }
if (-not (Get-ChildItem $dest -Recurse -File -Filter libcef.dll | Select-Object -First 1)) { throw 'CEF native libcef.dll missing after publish' }
# This also works on clean Windows 10/11 machines with no global .NET 8 Desktop runtime.
$dotnetInstaller = Join-Path $env:RUNNER_TEMP 'dotnet-install.ps1'
Invoke-WebRequest -Uri 'https://dot.net/v1/dotnet-install.ps1' -OutFile $dotnetInstaller
$localRuntime = Join-Path $dest 'dotnet'
& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $dotnetInstaller -Runtime windowsdesktop -Channel 10.0 -Architecture x64 -InstallDir $localRuntime -NoPath
if ($LASTEXITCODE -ne 0) { throw "Downloading local Windows Desktop runtime failed: $LASTEXITCODE" }
if (-not (Test-Path (Join-Path $localRuntime 'dotnet.exe'))) { throw 'Local .NET host missing' }
if (-not (Get-ChildItem (Join-Path $localRuntime 'shared\Microsoft.WindowsDesktop.App') -Directory -ErrorAction SilentlyContinue)) { throw 'Local .NET Windows Desktop runtime missing' }
Write-Host 'CEF publish and app-local Windows Desktop runtime are assembled.'
