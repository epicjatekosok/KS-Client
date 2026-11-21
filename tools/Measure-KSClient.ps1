# Run in Windows PowerShell while KS Client is running. PresentMon is optional.
[CmdletBinding()]
param([ValidateRange(10,300)][int]$Seconds=60,
      [string]$Label='match-180', [string]$OutputDirectory='.',
      [string]$PresentMon)
$ErrorActionPreference='Stop'
if ($Label -notmatch '^[a-zA-Z0-9_-]{1,60}$') {throw 'Invalid capture label'}
$dest=(New-Item -ItemType Directory -Force -Path $OutputDirectory).FullName
$base=Join-Path $dest ($Label+'-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
$processes=@(Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*\runtime\Electron\electron.exe' })
$paths=@($processes | Select-Object -ExpandProperty Path -Unique)
if($paths.Count -ne 1){throw 'Start one installed or portable KS Client before recording.'}
$gpu=Get-Command nvidia-smi.exe -ErrorAction SilentlyContinue
$pm=$null
if($PresentMon){
  $pm=Start-Process -FilePath $PresentMon -ArgumentList @('--process_name','electron.exe','--timed',"$Seconds",'--terminate_after_timed','--output_file',('"'+$base+'-presents.csv"')) -PassThru
}
$clock=[Diagnostics.Stopwatch]::StartNew()
$last=@{};$prevTime=$null;$rows=@()
while($clock.Elapsed.TotalSeconds -lt $Seconds){
  $procs=@(Get-Process electron -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $paths[0]})
  $t=$clock.Elapsed.TotalSeconds;$sum=0.0;$rss=0L;$current=@{}
  foreach($p in $procs){$current[$p.Id]=$p.CPU;$rss+=$p.WorkingSet64;if($last.ContainsKey($p.Id)){$sum+=[Math]::Max(0,$p.CPU-$last[$p.Id])}}
  $cpu=if($null -ne $prevTime){100*$sum/(($t-$prevTime)*[Environment]::ProcessorCount)}
  $rows+=[pscustomobject]@{utc=[DateTime]::UtcNow.ToString('o');seconds=$t;cpu_percent_all_cores=$cpu;summed_working_set_MiB=$rss/1MB;process_ids=($current.Keys -join ' ')}
  if($gpu){& $gpu.Source '--query-gpu=timestamp,uuid,utilization.gpu,power.draw' '--format=csv,noheader,nounits' 2>$null | Add-Content -LiteralPath ($base+'-gpu.csv')}
  $last=$current;$prevTime=$t;Start-Sleep -Milliseconds 950
}
$rows | Export-Csv -NoTypeInformation -LiteralPath ($base+'-host.csv')
if($pm){if(!$pm.WaitForExit(15000)){throw 'PresentMon did not finish the capture'};if($pm.ExitCode -ne 0){throw "PresentMon exit code $($pm.ExitCode)"}}
Write-Output $base
