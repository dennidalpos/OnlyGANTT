param(
  [string]$ServiceName = 'OnlyGanttWeb'
)

$ErrorActionPreference = 'Stop'

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -eq $service) {
  Write-Host "Service '$ServiceName' not found."
  exit 0
}

if ($service.Status -ne 'Stopped') {
  Stop-Service -Name $ServiceName -Force
}

sc.exe delete $ServiceName | Out-Null

Write-Host "Service '$ServiceName' removed."
