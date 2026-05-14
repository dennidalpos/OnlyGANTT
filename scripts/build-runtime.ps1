Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'support\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot
Assert-CommandExists -Name 'node'
Assert-CommandExists -Name 'dotnet'

$clientBuildRoot = Join-Path $repoRoot 'artifacts\build\client'
$servicePublishRoot = Join-Path $repoRoot 'artifacts\build\service'
Reset-ManagedDirectory -Path $clientBuildRoot
Reset-ManagedDirectory -Path $servicePublishRoot

$clientBuildScript = Join-Path $PSScriptRoot 'support\build-client-bundle.mjs'
& node $clientBuildScript
if ($LASTEXITCODE -ne 0) {
  throw "Client bundling failed with exit code $LASTEXITCODE"
}

$serviceProject = Join-Path $repoRoot 'src\service\OnlyGantt.Service\OnlyGantt.Service.csproj'
Assert-PathExists -Path $serviceProject -Label 'Windows service host project'

& dotnet publish $serviceProject -c Release -r win-x64 --self-contained true -o $servicePublishRoot
if ($LASTEXITCODE -ne 0) {
  throw "Windows service host publish failed with exit code $LASTEXITCODE"
}

$serviceExe = Join-Path $servicePublishRoot 'OnlyGantt.Service.exe'
Assert-PathExists -Path $serviceExe -Label 'published Windows service host'

$manifest = [ordered]@{
  app = 'OnlyGANTT'
  runtime = [ordered]@{
    server = 'src/server/server.js'
    public = 'src/public/index.html'
    clientBundle = 'artifacts/build/client/app.bundle.js'
    serviceHost = 'artifacts/build/service/OnlyGantt.Service.exe'
    clientSource = 'src/client/bundle-entry.jsx'
    data = 'Data'
  }
  tests = @(
    'tests/smoke-check.js',
    'tests/security-regression-check.js',
    'tests/admin-flow-regression-check.js',
    'tests/client-logic-regression-check.js',
    'tests/prerequisite-regression-check.ps1',
    'tests/installer-source-regression-check.ps1',
    'scripts/support/test-windows-service-lifecycle.ps1'
  )
  packaging = [ordered]@{
    pack = 'scripts/package-project.ps1'
    buildMsi = 'scripts/support/packaging/build-msi.ps1'
    buildSetup = 'scripts/support/packaging/build-setup.ps1'
    provisionWix = 'scripts/support/packaging/provision-wix.ps1'
    provisionNode = 'scripts/support/packaging/provision-node.ps1'
  }
  windows = [ordered]@{
    service = 'scripts/manage-service.ps1'
  }
}

$manifestJson = $manifest | ConvertTo-Json -Depth 5
Write-Utf8File -Path (Join-Path $repoRoot 'artifacts\build\runtime-manifest.json') -Content $manifestJson
Write-Host 'Compile completed (runtime manifest generated).'
