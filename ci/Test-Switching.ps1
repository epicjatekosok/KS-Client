# Windows-native switch integration test: launcher -> Electron/CEF -> handshake.
# Game network is intentionally not a dependency of native engine readiness.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$exe=Join-Path $root 'KS-Client.exe'
if(-not (Test-Path $exe -PathType Leaf)){throw "Launcher missing: $exe"}
$folder=Join-Path $env:LOCALAPPDATA 'KSClient'
New-Item -ItemType Directory -Path $folder -Force|Out-Null
$selected=Join-Path $folder 'selected-engine.txt'
$prefs=Join-Path $folder 'browser-settings.json'
$selectedBackup=if(Test-Path $selected){[IO.File]::ReadAllBytes($selected)}else{$null}
$prefsBackup=if(Test-Path $prefs){[IO.File]::ReadAllBytes($prefs)}else{$null}
try {
  # Verify startup flags are requested, not that a GPU renders unlimited FPS.
  '{"gpu":"enabled","angle":"default","devTools":false,"contextMenu":false,"uncapFps":true}' | Set-Content -LiteralPath $prefs -Encoding utf8
  foreach($scenario in @(
    @{from='cef';to='electron'},
    @{from='electron';to='cef'})) {
    [IO.File]::WriteAllText($selected,$scenario.from+[Environment]::NewLine)
    $token=([Guid]::NewGuid().ToString('N')).ToLowerInvariant()
    $ok=Join-Path $folder ("engine-switch-"+$token+".ok")
    $fail=Join-Path $folder ("engine-switch-"+$token+".error")
    Write-Host "Testing native window: $($scenario.from) -> $($scenario.to)"
    $info=[Diagnostics.ProcessStartInfo]::new()
    $info.FileName=$exe
    $info.Arguments="--engine $($scenario.to) --ks-switch-probe --ks-switch-token=$token"
    $info.WorkingDirectory=$root
    $info.UseShellExecute=$false
    $info.CreateNoWindow=$true
    $p=[Diagnostics.Process]::Start($info)
    if($null -eq $p){throw "Could not run launcher"}
    try {
      if(-not $p.WaitForExit(80000)){
        try{$p.Kill()}catch{}
        throw "Timed out waiting for $($scenario.to) native engine"
      }
      if($p.ExitCode -ne 0){
        $reason=if(Test-Path $fail){Get-Content -Raw -LiteralPath $fail}else{"no error marker"}
        throw "Native $($scenario.to) launch failed: $reason"
      }
      if(-not (Test-Path $ok -PathType Leaf)){
        throw "Native $($scenario.to) did not confirm startup (.ok missing)"
      }
      $confirmed=(Get-Content -Raw $ok).Trim()
      if($confirmed -ne $scenario.to){throw "Wrong engine .ok marker: $confirmed"}
      $chosen=(Get-Content -Raw $selected).Trim()
      if($chosen -ne $scenario.to){throw "Engine selection was not committed after startup"}
      Write-Host "PASS: $($scenario.from) -> $($scenario.to) native startup acknowledged"
    }finally{
      $p.Dispose()
      foreach($ext in @('ready','ok','error')){
        Remove-Item -LiteralPath (Join-Path $folder ("engine-switch-"+$token+"."+$ext)) -Force -ErrorAction SilentlyContinue
      }
    }
  }
  foreach($source in @('electron-1.1.22.log','cef-1.1.22.log')){
    if(-not (Test-Path (Join-Path $folder $source) -PathType Leaf)){throw "Missing engine log: $source"}
  }
  # Probe windows can exit asynchronously after the supervising launcher has
  # finished. They must not remain alive when another CEF runtime test starts:
  # multiple native CEF instances can collide on the CI runner GPU/cache stack.
  Start-Sleep -Milliseconds 900
  foreach($name in @('KS.Cef.Client','electron','CefSharp.BrowserSubprocess')){
    Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
      try{$_.CloseMainWindow()|Out-Null}catch{}
      try{if(-not $_.WaitForExit(3500)){$_.Kill()}}catch{}
    }
  }
  Write-Host 'PASS: both native engine switch directions and local logs'
}finally{
  if($null -eq $selectedBackup){Remove-Item -LiteralPath $selected -ErrorAction SilentlyContinue}
  else{[IO.File]::WriteAllBytes($selected,$selectedBackup)}
  if($null -eq $prefsBackup){Remove-Item -LiteralPath $prefs -ErrorAction SilentlyContinue}
  else{[IO.File]::WriteAllBytes($prefs,$prefsBackup)}
}
