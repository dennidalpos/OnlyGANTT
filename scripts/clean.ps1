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

$artifactsRoot = Join-Path $repoRoot 'artifacts'
$managedArtifactNames = @('build', 'test-results', 'packages', 'publish', 'logs')

Get-ChildItem -Path $artifactsRoot -Force -ErrorAction SilentlyContinue |
  Sort-Object Name |
  ForEach-Object {
    if ($_.Name -eq '.gitkeep') {
      return
    }

    if ($managedArtifactNames -contains $_.Name) {
      return
    }

    Remove-Item -Path $_.FullName -Recurse -Force
    Write-Host "Removed extra artifact path $($_.FullName)"
  }

$stalePathsToClean = @(
  '.playwright-cli',
  'build',
  'dist',
  'out',
  'output',
  'playwright-report',
  'publish',
  'tmp'
) | ForEach-Object { Join-Path $repoRoot $_ }

foreach ($path in $stalePathsToClean) {
  if (Test-Path $path) {
    Remove-Item -Path $path -Recurse -Force
    Write-Host "Removed stale output $path"
  }
}

$runtimeFilesToClean = @(
  'Data\config\locks.json',
  'Data\config\admin-auth.json',
  'Data\config\system-config.local.json',
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

$runtimePatternsToClean = @(
  'Data\config\*.bak',
  'Data\config\*.tmp',
  'Data\reparti\*.bak',
  'Data\reparti\*.tmp',
  'Data\utenti\*.json',
  'Data\utenti\*.bak',
  'Data\utenti\*.tmp'
) | ForEach-Object { Join-Path $repoRoot $_ }

foreach ($pattern in $runtimePatternsToClean) {
  Get-ChildItem -Path $pattern -File -Force -ErrorAction SilentlyContinue |
    Sort-Object FullName |
    ForEach-Object {
      Remove-Item -Path $_.FullName -Force
      Write-Host "Removed runtime file $($_.FullName)"
    }
}
