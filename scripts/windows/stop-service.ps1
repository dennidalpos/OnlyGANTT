param(
  [string]$ServiceName = 'OnlyGanttWeb'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -eq $service) {
  Write-Host "Service '$ServiceName' not found."
  exit 0
}

if ($service.Status -ne 'Stopped') {
  Stop-Service -Name $ServiceName -Force
  $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(30))
}

Write-Host "Service '$ServiceName' is stopped."
