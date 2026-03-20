param(
  [string]$ServiceName = 'OnlyGanttWeb'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -eq $service) {
  throw "Service '$ServiceName' not found."
}

if ($service.Status -ne 'Running') {
  Start-Service -Name $ServiceName
  $service.WaitForStatus('Running', [TimeSpan]::FromSeconds(30))
}

Write-Host "Service '$ServiceName' is running."
