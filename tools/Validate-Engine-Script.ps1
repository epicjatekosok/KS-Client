# Execute with Windows PowerShell 5.1. This VALIDATES and does not run Install-Engines.ps1.
$ErrorActionPreference = 'Stop'
$path = Join-Path (Split-Path -Parent $PSScriptRoot) 'Install-Engines.ps1'
$tokens = $null
$parseErrors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) {
  foreach ($errorItem in $parseErrors) {
    Write-Host ('Line ' + $errorItem.Extent.StartLineNumber + ': ' + $errorItem.Message)
  }
  exit 1
}
Write-Host 'PASS: Install-Engines.ps1 syntax is valid for Windows PowerShell.'
exit 0
