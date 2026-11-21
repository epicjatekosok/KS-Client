# Meaningful smoke tests: actually start each engine on a Windows runner.
[CmdletBinding()]
param([ValidateSet('Electron')][string]$Engine='Electron')
$ErrorActionPreference='Stop'
$repo = Split-Path -Parent $PSScriptRoot
$releaseVersion = '1.0.25'
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
        throw "$name 0xC0000005 native access violation. Offline packaging blocked."
      }
      throw "$name self-test failed: exit=$($process.ExitCode) hex=$hex"
    }
  } finally { $process.Dispose() }
  $passMarker = [ordered]@{version=$releaseVersion;engine=$name;exeName=[IO.Path]::GetFileName($exe);exeSha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $exe).Hash.ToLowerInvariant();runner='windows';result='PASS'}
  $passMarker | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $working 'ks-smoke-pass.json') -Encoding utf8
  Write-Host "PASS: $name runtime startup and EXE hash recorded."
}

  $dir=Join-Path $repo 'runtime\Electron'
  Test-Executable (Join-Path $dir 'electron.exe') $dir 'Electron' @{}
