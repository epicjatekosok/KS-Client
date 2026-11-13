# Meaningful smoke tests: actually start each engine on a Windows runner.
[CmdletBinding()]
param([ValidateSet('Electron','CEF','Both')][string]$Engine='Both')
$ErrorActionPreference='Stop'
$repo = Split-Path -Parent $PSScriptRoot
function Test-Executable([string]$exe,[string]$working,[string]$name,[hashtable]$variables) {
  Write-Host "Starting $name self-test on this Windows runner: $exe"
  if (-not (Test-Path $exe)) { throw "$name EXE not found: $exe" }
  $info = [System.Diagnostics.ProcessStartInfo]::new()
  $info.FileName = $exe
  $info.Arguments = '--ks-self-test'
  $info.WorkingDirectory = $working
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  foreach($k in $variables.Keys) { $info.Environment[$k] = $variables[$k] }
  # The Electron environment should not run as a Node.js subprocess.
  if($info.Environment.ContainsKey('ELECTRON_RUN_AS_NODE')) { $info.Environment.Remove('ELECTRON_RUN_AS_NODE') }
  $process = [System.Diagnostics.Process]::Start($info)
  if ($null -eq $process) { throw "$name could not launch" }
  try {
    if (-not $process.WaitForExit(60000)) {
      try {$process.Kill()} catch {}
      throw "$name timed out during self-test (60 seconds)"
    }
    if ($process.ExitCode -ne 0) { throw "$name crashed or failed startup: exit code $($process.ExitCode)" }
  } finally { $process.Dispose() }
  Write-Host "PASS: $name runtime started and passed its self-test."
}
if ($Engine -eq 'Electron' -or $Engine -eq 'Both') {
  $dir=Join-Path $repo 'runtime\Electron'
  Test-Executable (Join-Path $dir 'electron.exe') $dir 'Electron' @{}
}
if ($Engine -eq 'CEF' -or $Engine -eq 'Both') {
  $dir=Join-Path $repo 'runtime\CEF'
  $dotnet=Join-Path $dir 'dotnet'
  if(-not (Test-Path (Join-Path $dotnet 'dotnet.exe'))) { throw 'Bundled .NET Desktop runtime is missing' }
  Test-Executable (Join-Path $dir 'KS.Cef.Client.exe') $dir 'CEF' @{DOTNET_ROOT=$dotnet; DOTNET_ROOT_X64=$dotnet; DOTNET_MULTILEVEL_LOOKUP='0'}
}
