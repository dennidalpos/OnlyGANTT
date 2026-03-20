Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'helpers\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot

$manifest = [ordered]@{
  app = 'OnlyGANTT'
  runtime = [ordered]@{
    server = 'server/server.js'
    public = 'public/index.html'
    client = 'src/client/app.jsx'
    data = 'Data'
  }
  tests = @('tests/smoke-check.js')
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
