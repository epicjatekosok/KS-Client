# Exercise an actual CEF renderer -> native JavascriptMessageReceived event.
# The static offline HTML probe posts a known message, and must exit with 0.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repo = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $repo 'runtime\CEF'
$exe = Join-Path $dir 'KS.Cef.Client.exe'
if(-not (Test-Path $exe)){throw "CEF bridge test EXE missing: $exe"}
$dotnet = Join-Path $dir 'dotnet'
if(-not (Test-Path (Join-Path $dotnet 'dotnet.exe'))){throw 'Local CEF .NET host missing'}
$psi=[System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName=$exe
$psi.Arguments='--ks-bridge-probe'
$psi.WorkingDirectory=$dir
$psi.UseShellExecute=$false
$psi.CreateNoWindow=$true
$psi.Environment['DOTNET_ROOT']=$dotnet
$psi.Environment['DOTNET_ROOT_X64']=$dotnet
$psi.Environment['DOTNET_MULTILEVEL_LOOKUP']='0'
$process=[System.Diagnostics.Process]::Start($psi)
if($null -eq $process){throw 'Could not start CEF renderer->native bridge probe'}
try {
  if(-not $process.WaitForExit(35000)){
    try{$process.Kill()}catch{}
    throw 'CEF renderer->native bridge probe timed out; packaging blocked'
  }
  if($process.ExitCode -ne 0){
    $log=Join-Path $env:LOCALAPPDATA 'KSClient\cef-1.1.14.log'
    if(Test-Path $log){Get-Content $log -Tail 15 | ForEach-Object {Write-Host $_}}
    throw "CEF JavascriptMessageReceived failed, exit $($process.ExitCode); packaging blocked"
  }
  Write-Host 'PASS: actual CEF JavaScript PostMessage received by native C# event handler'
}finally{$process.Dispose()}
