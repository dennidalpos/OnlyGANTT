Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'helpers\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot
Assert-CommandExists -Name 'node'

$clientBuildRoot = Join-Path $repoRoot 'artifacts\build\client'
Reset-ManagedDirectory -Path $clientBuildRoot

$clientBuildScript = Join-Path $PSScriptRoot 'helpers\build-client-bundle.mjs'
& node $clientBuildScript
if ($LASTEXITCODE -ne 0) {
  throw "Client bundling failed with exit code $LASTEXITCODE"
}

$manifest = [ordered]@{
  app = 'OnlyGANTT'
  runtime = [ordered]@{
    server = 'src/server/server.js'
    public = 'src/public/index.html'
    clientBundle = 'artifacts/build/client/app.bundle.js'
    clientSource = 'src/client/bundle-entry.jsx'
    data = 'Data'
  }
  tests = @(
    'tests/smoke-check.js',
    'tests/security-regression-check.js',
    'tests/admin-flow-regression-check.js',
    'tests/client-logic-regression-check.js',
    'tests/windows-service-lifecycle-check.ps1'
  )
  packaging = [ordered]@{
    pack = 'scripts/pack.ps1'
    buildMsi = 'scripts/packaging/build-msi.ps1'
    provisionWix = 'scripts/packaging/provision-wix.ps1'
  }
  windows = [ordered]@{
    installService = 'scripts/windows/install-service.ps1'
    uninstallService = 'scripts/windows/uninstall-service.ps1'
    startService = 'scripts/windows/start-service.ps1'
    stopService = 'scripts/windows/stop-service.ps1'
    cleanupService = 'scripts/windows/services-cleanup.ps1'
  }
}

$manifestJson = $manifest | ConvertTo-Json -Depth 5
Write-Utf8File -Path (Join-Path $repoRoot 'artifacts\build\runtime-manifest.json') -Content $manifestJson
Write-Host 'Compile completed (runtime manifest generated).'
