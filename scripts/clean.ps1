Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pathsToClean = @(
  'build',
  'dist',
  'out',
  'publish',
  'tmp'
) | ForEach-Object { Join-Path $repoRoot $_ }

foreach ($path in $pathsToClean) {
  if (Test-Path $path) {
    Remove-Item -Path $path -Recurse -Force
    Write-Host "Removed $path"
  }
}
