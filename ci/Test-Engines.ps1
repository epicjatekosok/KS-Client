# Meaningful smoke tests: actually start each engine on a Windows runner.
[CmdletBinding()]
param([ValidateSet('Electron','CEF','Both')][string]$Engine='Both')
$ErrorActionPreference='Stop'
$repo = Split-Path -Parent $PSScriptRoot
$releaseVersion = '1.0.20'
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
    if ($process.ExitCode -ne 0) {
      $hex=[System.BitConverter]::ToUInt32([System.BitConverter]::GetBytes([int]$process.ExitCode),0).ToString('X8')
      if($hex -eq 'C0000005'){
        # Debug a native crash without ignoring the release-safety gate.
        if($name -eq 'CEF'){
          $clientLogs=Join-Path $env:LOCALAPPDATA 'KSClient'
          foreach($logName in @('cef-1.0.20.log','cef-native-debug.log')){
            $logFile=Join-Path $clientLogs $logName
            if(Test-Path -LiteralPath $logFile -PathType Leaf){
              Write-Host "CEF crash diagnostics: $logName"
              Get-Content -LiteralPath $logFile -Tail 100 | ForEach-Object { Write-Host $_ }
            }else{Write-Host "CEF crash diagnostics unavailable: $logName"}
          }
          try{
            Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000;StartTime=(Get-Date).AddMinutes(-10)} -MaxEvents 3 -ErrorAction Stop |
              ForEach-Object { Write-Host ('Windows application crash event: '+($_.Message -replace '\r|\n',' ')) }
          }catch{Write-Host 'Windows crash event not accessible'}
        }
        throw "$name 0xC0000005 native access violation. Offline packaging blocked."
      }
      throw "$name self-test failed: exit=$($process.ExitCode) hex=$hex"
    }
  } finally { $process.Dispose() }
  $passMarker = [ordered]@{version=$releaseVersion;engine=$name;exeName=[IO.Path]::GetFileName($exe);exeSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $exe).Hash.ToLowerInvariant();runner='windows';result='PASS'}
  $passMarker | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $working 'ks-smoke-pass.json') -Encoding utf8
  Write-Host "PASS: $name runtime startup and EXE hash recorded."
}
if ($Engine -eq 'Electron' -or $Engine -eq 'Both') {
  $dir=Join-Path $repo 'runtime\Electron'
  Test-Executable (Join-Path $dir 'electron.exe') $dir 'Electron' @{}
}
if ($Engine -eq 'CEF' -or $Engine -eq 'Both') {
  $dir=Join-Path $repo 'runtime\CEF'
  $dotnet=Join-Path $dir 'dotnet'
  foreach ($required in @('dotnet.exe','host\fxr','shared\Microsoft.NETCore.App','shared\Microsoft.WindowsDesktop.App')) {
    if (-not (Test-Path (Join-Path $dotnet $required))) { throw "CEF bundled .NET runtime is incomplete: missing $required" }
  }
  Test-Executable (Join-Path $dir 'KS.Cef.Client.exe') $dir 'CEF' @{DOTNET_ROOT=$dotnet; DOTNET_ROOT_X64=$dotnet; DOTNET_MULTILEVEL_LOOKUP='0'}
}
