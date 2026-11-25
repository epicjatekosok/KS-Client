# Run in Windows PowerShell while KS Client is running. PresentMon is optional.
[CmdletBinding()]
param([ValidateRange(10,7200)][int]$Seconds=60,
      [string]$Label='match-180', [string]$OutputDirectory='.',
      [string]$PresentMon, [ValidateSet(0,1000,2000,4000,8000)][int]$MouseHz=0,
      [string]$Resolution, [double]$DisplayHz, [string]$Scene, [string]$WindowMode,
      [switch]$GpuEngineCounters, [ValidateRange(0,120)][int]$StartDelay=5)
$ErrorActionPreference='Stop'
if ($Label -notmatch '^[a-zA-Z0-9_-]{1,60}$') {throw 'Invalid capture label'}
$dest=(New-Item -ItemType Directory -Force -Path $OutputDirectory).FullName
$base=Join-Path $dest ($Label+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$processes=@(Get-Process KSClientGame -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*\runtime\Electron\KSClientGame.exe' })
$paths=@($processes | Select-Object -ExpandProperty Path -Unique)
if($paths.Count -ne 1){throw 'Start one installed or portable KS Client before recording.'}
$adapters=@(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue | Select-Object Name,PNPDeviceID,DriverVersion,CurrentRefreshRate,CurrentHorizontalResolution,CurrentVerticalResolution)
@{label=$Label; scene=$Scene; duration=$Seconds; mouseHzDeclared=$MouseHz; resolutionDeclared=$Resolution;
  refreshHzDeclared=$DisplayHz; windowModeDeclared=$WindowMode; adapters=$adapters;
  version=(Get-Content -Raw (Join-Path (Split-Path $paths[0]) 'resources/app/package.json')|ConvertFrom-Json).version
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath ($base+'-metadata.json') -Encoding UTF8
$gpu=Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
if($StartDelay -gt 0){
  Write-Host "Capture starts in $StartDelay seconds. Switch to the intended KS Client window state."
  Start-Sleep -Seconds $StartDelay
}
$pm=$null
if($PresentMon){
  $pm=Start-Process -FilePath $PresentMon -ArgumentList @('--v1_metrics','--process_name','KSClientGame.exe','--timed',"$Seconds",'--terminate_after_timed','--output_file',('"'+$base+'-presents.csv"')) -PassThru
}
$clock=[Diagnostics.Stopwatch]::StartNew()
$last=@{};$prevTime=$null;$rows=@()
while($clock.Elapsed.TotalSeconds -lt $Seconds){
  $procs=@(Get-Process KSClientGame -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $paths[0]})
  $t=$clock.Elapsed.TotalSeconds;$sum=0.0;$rss=0L;$current=@{}
  foreach($p in $procs){$current[$p.Id]=$p.CPU;$rss+=$p.WorkingSet64;if($last.ContainsKey($p.Id)){$sum+=[Math]::Max(0,$p.CPU-$last[$p.Id])}}
  $cpu=if($null -ne $prevTime){100*$sum/(($t-$prevTime)*[Environment]::ProcessorCount)}
  $rows+=[pscustomobject]@{utc=[DateTime]::UtcNow.ToString('o');seconds=$t;cpu_percent_all_cores=$cpu;summed_working_set_MiB=$rss/1MB;process_ids=($current.Keys -join ' ')}
  if($GpuEngineCounters -and $rows.Count % 5 -eq 1){
    # WDDM per-engine utilization can overlap; preserve individual engine rows.
    Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match '^pid_(\d+)_' -and $current.ContainsKey([int]$Matches[1]) } |
      Select-Object @{Name='seconds';Expression={$t}},Name,UtilizationPercentage |
      Export-Csv -Append -NoTypeInformation -LiteralPath ($base+'-gpu-engines.csv')
  }
  if($gpu){& $gpu.Source '--query-gpu=timestamp,uuid,utilization.gpu,power.draw,temperature.gpu,memory.used' '--format=csv,noheader,nounits' 2>$null | Add-Content -LiteralPath ($base+'-gpu.csv')}
  $last=$current;$prevTime=$t;Start-Sleep -Milliseconds 950
}
$rows | Export-Csv -NoTypeInformation -LiteralPath ($base+'-host.csv')
if($pm){if(!$pm.WaitForExit(15000)){throw 'PresentMon did not finish the capture'};if($pm.ExitCode -ne 0){throw "PresentMon exit code $($pm.ExitCode)"}}
Write-Output $base
