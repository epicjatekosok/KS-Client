[CmdletBinding()]
param([Parameter(Mandatory)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$revision = '51e5aae4bc40c3ccd3fb7d4dfd94256e7bfc496e'
$source = Join-Path (Split-Path $PSScriptRoot) 'tools/nvidia_frame_limit.cpp'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ks-nvapi-' + [guid]::NewGuid())
New-Item -Type Directory $temp | Out-Null
Push-Location $temp
try {
    git init --quiet
    if ($LASTEXITCODE) { throw 'Cannot initialize SDK checkout' }
    git fetch --quiet --depth=1 https://github.com/NVIDIA/nvapi.git $revision
    if ($LASTEXITCODE -or (git rev-parse FETCH_HEAD) -ne $revision) { throw 'NVAPI revision mismatch' }
    git checkout --quiet FETCH_HEAD -- '*.h' 'amd64/nvapi64.lib' 'License.txt'
    if ($LASTEXITCODE) { throw 'Missing NVIDIA SDK build inputs' }
    $locator = Join-Path ([Environment]::GetFolderPath('ProgramFilesX86')) 'Microsoft Visual Studio/Installer/vswhere.exe'
    $vs = & $locator -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if (!$vs) { throw 'Install Visual Studio C++ x64 build tools' }
    Import-Module (Join-Path $vs 'Common7/Tools/Microsoft.VisualStudio.DevShell.dll')
    Enter-VsDevShell -VsInstallPath $vs -SkipAutomaticLocation -DevCmdArguments '-arch=x64 -host_arch=x64' | Out-Null
    $exe = Join-Path $OutputDirectory 'KSDriverLimit.exe'
    & cl.exe /nologo /EHsc /O2 /MT /std:c++17 "/I$temp" $source (Join-Path $temp 'amd64/nvapi64.lib') "/Fe:$exe" /link /SUBSYSTEM:CONSOLE
    if ($LASTEXITCODE -or !(Test-Path $exe)) { throw 'Native driver limiter build failed' }
    & $exe invalid
    if ($LASTEXITCODE -ne 2) { throw 'Native limiter CLI validation failed' }
    $global:LASTEXITCODE = 0
} finally {
    Pop-Location
    Remove-Item -LiteralPath $temp -Recurse -Force
}
