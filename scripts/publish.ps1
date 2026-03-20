Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'helpers\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot

$sourceRoot = Join-Path $repoRoot 'artifacts\packages'
$publishRoot = Join-Path $repoRoot 'artifacts\publish\local'

if (-not (Test-Path $sourceRoot)) {
  throw "Package artifacts not found: $sourceRoot. Run scripts/pack.ps1 first."
}

$packageFiles = @(Get-ChildItem -Path $sourceRoot -Recurse -File | Sort-Object FullName)
if ($packageFiles.Count -eq 0) {
  throw "No package artifacts found under $sourceRoot. Run scripts/pack.ps1 first."
}

if (Test-Path $publishRoot) {
  Remove-Item -Path $publishRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $publishRoot | Out-Null

foreach ($file in $packageFiles) {
  $relativePath = $file.FullName.Substring($sourceRoot.Length).TrimStart('\')
  $destinationPath = Join-Path $publishRoot $relativePath
  $destinationParent = Split-Path -Path $destinationPath -Parent
  if ($destinationParent) {
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
  }

  Copy-Item -Path $file.FullName -Destination $destinationPath -Force
}

$manifest = [ordered]@{
  source = 'artifacts/packages'
  destination = 'artifacts/publish/local'
  files = @($packageFiles | ForEach-Object {
    $_.FullName.Substring($sourceRoot.Length).TrimStart('\').Replace('\', '/')
  })
}

Write-Utf8File -Path (Join-Path $repoRoot 'artifacts\publish\local\publish-manifest.json') -Content ($manifest | ConvertTo-Json -Depth 4)
Write-Host 'Publish completed.'
