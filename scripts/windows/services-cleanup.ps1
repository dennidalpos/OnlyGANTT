param(
  [string]$ServiceName = 'OnlyGanttWeb',
  [string]$NssmPath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$uninstallScript = Join-Path $PSScriptRoot 'uninstall-service.ps1'

& $uninstallScript -ServiceName $ServiceName -NssmPath $NssmPath -ForceDelete

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
foreach ($relativePath in @(
  'Data\log\service-stdout.log',
  'Data\log\service-stderr.log'
)) {
  $targetPath = Join-Path $repoRoot $relativePath
  if (Test-Path $targetPath) {
    Remove-Item -Path $targetPath -Force
  }
}

Write-Host "Cleanup completed for service '$ServiceName'."
