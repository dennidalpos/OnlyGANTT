Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'helpers\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot
Assert-CommandExists -Name 'npm'

$nodeVersion = Get-NodeVersionInfo
if ($nodeVersion.Major -lt 18) {
  throw "Node.js >= 18 is required. Detected: $($nodeVersion.Raw)"
}

$requiredPaths = @(
  @{ Path = (Join-Path $repoRoot 'package.json'); Label = 'package.json' },
  @{ Path = (Join-Path $repoRoot 'package-lock.json'); Label = 'package-lock.json' },
  @{ Path = (Join-Path $repoRoot 'src\server\server.js'); Label = 'server entrypoint' },
  @{ Path = (Join-Path $repoRoot 'src\public\index.html'); Label = 'public shell' },
  @{ Path = (Join-Path $repoRoot 'src\public\brand\onlygantt-logo.svg'); Label = 'brand logo' },
  @{ Path = (Join-Path $repoRoot 'src\public\brand\onlygantt.ico'); Label = 'Windows brand icon' },
  @{ Path = (Join-Path $repoRoot 'src\client\bundle-entry.jsx'); Label = 'client bundle entrypoint' },
  @{ Path = (Join-Path $repoRoot 'scripts\helpers\build-client-bundle.mjs'); Label = 'client bundler helper' },
  @{ Path = (Join-Path $repoRoot 'tests\smoke-check.js'); Label = 'smoke test' },
  @{ Path = (Join-Path $repoRoot 'tools\wix\Product.wxs'); Label = 'WiX source' },
  @{ Path = (Join-Path $repoRoot 'tools\nssm\win64\nssm.exe'); Label = 'NSSM x64 binary' }
)

foreach ($item in $requiredPaths) {
  Assert-PathExists -Path $item.Path -Label $item.Label
}

$nodeModulesPath = Join-Path $repoRoot 'node_modules'
if (-not (Test-Path $nodeModulesPath)) {
  throw "Dependencies are not installed. Run scripts/bootstrap.ps1 first."
}

$doctorReport = @(
  "node=$($nodeVersion.Raw)",
  "npm=$((& npm --version).Trim())",
  'dependencies=installed',
  'tests=tests/smoke-check.js',
  'packaging=scripts/packaging/build-msi.ps1'
) -join "`r`n"

Write-Utf8File -Path (Join-Path $repoRoot 'artifacts\logs\doctor.txt') -Content $doctorReport
Write-Host 'Environment checks passed.'
