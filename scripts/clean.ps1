Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'helpers\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot
$serviceCleanupScript = Join-Path $PSScriptRoot 'windows\services-cleanup.ps1'

if (Test-Path $serviceCleanupScript) {
  & $serviceCleanupScript
}

$managedArtifactRoots = @(
  'artifacts\build',
  'artifacts\test-results',
  'artifacts\packages',
  'artifacts\publish',
  'artifacts\logs'
) | ForEach-Object { Join-Path $repoRoot $_ }

foreach ($path in $managedArtifactRoots) {
  Reset-ManagedDirectory -Path $path
}

$legacyPathsToClean = @(
  'build',
  'dist',
  'out',
  'publish',
  'tmp'
) | ForEach-Object { Join-Path $repoRoot $_ }

foreach ($path in $legacyPathsToClean) {
  if (Test-Path $path) {
    Remove-Item -Path $path -Recurse -Force
    Write-Host "Removed legacy output $path"
  }
}

$runtimeFilesToClean = @(
  'Data\config\locks.json',
  'Data\config\admin-auth.json',
  'Data\log\audit.log',
  'Data\log\service-stdout.log',
  'Data\log\service-stderr.log'
) | ForEach-Object { Join-Path $repoRoot $_ }

foreach ($path in $runtimeFilesToClean) {
  if (Test-Path $path) {
    Remove-Item -Path $path -Force
    Write-Host "Removed runtime file $path"
  }
}
