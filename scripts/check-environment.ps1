Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'support\common.ps1')
. (Join-Path $PSScriptRoot 'support\prerequisites.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot
Assert-CommandExists -Name 'npm'
Assert-CommandExists -Name 'dotnet'

$nodeStatus = Assert-NodeRuntime -Reason 'OnlyGANTT build, test and local runtime scripts execute the Node.js server and browser bundler.'

$requiredPaths = @(
  @{ Path = (Join-Path $repoRoot 'package.json'); Label = 'package.json' },
  @{ Path = (Join-Path $repoRoot 'package-lock.json'); Label = 'package-lock.json' },
  @{ Path = (Join-Path $repoRoot 'src\server\server.js'); Label = 'server entrypoint' },
  @{ Path = (Join-Path $repoRoot 'src\public\index.html'); Label = 'public shell' },
  @{ Path = (Join-Path $repoRoot 'src\public\brand\onlygantt-logo.svg'); Label = 'brand logo' },
  @{ Path = (Join-Path $repoRoot 'src\public\brand\onlygantt-mark.svg'); Label = 'brand compact mark' },
  @{ Path = (Join-Path $repoRoot 'src\public\brand\onlygantt.ico'); Label = 'Windows brand icon' },
  @{ Path = (Join-Path $repoRoot 'src\public\favicon.svg'); Label = 'browser favicon' },
  @{ Path = (Join-Path $repoRoot 'src\public\site.webmanifest'); Label = 'web app manifest' },
  @{ Path = (Join-Path $repoRoot 'src\client\bundle-entry.jsx'); Label = 'client bundle entrypoint' },
  @{ Path = (Join-Path $repoRoot 'scripts\support\build-client-bundle.mjs'); Label = 'client bundler helper' },
  @{ Path = (Join-Path $repoRoot 'scripts\support\prerequisites.ps1'); Label = 'prerequisite helper' },
  @{ Path = (Join-Path $repoRoot 'tests\smoke-check.js'); Label = 'smoke test' },
  @{ Path = (Join-Path $repoRoot 'tests\prerequisite-regression-check.ps1'); Label = 'prerequisite regression check' },
  @{ Path = (Join-Path $repoRoot 'tools\wix\Product.wxs'); Label = 'WiX source' },
  @{ Path = (Join-Path $repoRoot 'tools\wix\Bundle.wxs'); Label = 'WiX bootstrapper source' },
  @{ Path = (Join-Path $repoRoot 'src\service\OnlyGantt.Service\OnlyGantt.Service.csproj'); Label = 'Windows service host project' },
  @{ Path = (Join-Path $repoRoot 'scripts\manage-service.ps1'); Label = 'Windows service management script' },
  @{ Path = (Join-Path $repoRoot 'scripts\support\packaging\provision-node.ps1'); Label = 'Node.js prerequisite provisioning script' }
)

foreach ($item in $requiredPaths) {
  Assert-PathExists -Path $item.Path -Label $item.Label
}

$nodeModulesPath = Join-Path $repoRoot 'node_modules'
if (-not (Test-Path $nodeModulesPath)) {
  throw "Dependencies are not installed. Run npm run bootstrap or scripts/install-dependencies.ps1 first."
}

$doctorReport = @(
  "node=$($nodeStatus.RawVersion)",
  "npm=$((& npm --version).Trim())",
  "dotnet=$((& dotnet --version).Trim())",
  'dependencies=installed',
  'tests=tests/smoke-check.js',
  'packaging=scripts/package-project.ps1'
) -join "`r`n"

Write-Utf8File -Path (Join-Path $repoRoot 'artifacts\logs\doctor.txt') -Content $doctorReport
Write-Host 'Environment checks passed.'
