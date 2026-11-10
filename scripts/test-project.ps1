Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'support\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot

$doctorScript = Join-Path $PSScriptRoot 'check-environment.ps1'
$compileScript = Join-Path $PSScriptRoot 'build-runtime.ps1'
& $doctorScript
& $compileScript

$logPath = Join-Path $repoRoot 'artifacts\test-results\smoke-check.log'
$securityLogPath = Join-Path $repoRoot 'artifacts\test-results\security-regression-check.log'
$adminFlowLogPath = Join-Path $repoRoot 'artifacts\test-results\admin-flow-regression-check.log'
$clientLogicLogPath = Join-Path $repoRoot 'artifacts\test-results\client-logic-regression-check.log'
$prerequisiteLogPath = Join-Path $repoRoot 'artifacts\test-results\prerequisite-regression-check.log'
$installerSourceLogPath = Join-Path $repoRoot 'artifacts\test-results\installer-source-regression-check.log'
$serviceLifecycleLogPath = Join-Path $repoRoot 'artifacts\test-results\windows-service-lifecycle-check.log'
$summaryPath = Join-Path $repoRoot 'artifacts\test-results\summary.json'
$smokeScript = Join-Path $repoRoot 'tests\smoke-check.js'
$securityScript = Join-Path $repoRoot 'tests\security-regression-check.js'
$adminFlowScript = Join-Path $repoRoot 'tests\admin-flow-regression-check.js'
$clientLogicScript = Join-Path $repoRoot 'tests\client-logic-regression-check.js'
$prerequisiteScript = Join-Path $repoRoot 'tests\prerequisite-regression-check.ps1'
$installerSourceScript = Join-Path $repoRoot 'tests\installer-source-regression-check.ps1'
$serviceLifecycleScript = Join-Path $repoRoot 'scripts\support\test-windows-service-lifecycle.ps1'

function Get-AvailableTcpPort {
  foreach ($port in 3324..3399) {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    try {
      $listener.Start()
      return $port
    } catch {
    } finally {
      $listener.Stop()
    }
  }

  throw 'No free TCP port found in validation range 3324-3399.'
}

$changeTrackerLogPath = Join-Path $repoRoot 'artifacts\test-results\change-tracker-check.log'
$changeTrackerScript = Join-Path $repoRoot 'tests\change-tracker-check.js'

& node $changeTrackerScript 2>&1 | Tee-Object -FilePath $changeTrackerLogPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  throw "Change tracker check failed with exit code $exitCode"
}

& node $smokeScript 2>&1 | Tee-Object -FilePath $logPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  throw "Smoke test failed with exit code $exitCode"
}

& node $securityScript 2>&1 | Tee-Object -FilePath $securityLogPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  throw "Security regression check failed with exit code $exitCode"
}

& node $adminFlowScript 2>&1 | Tee-Object -FilePath $adminFlowLogPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  throw "Admin flow regression check failed with exit code $exitCode"
}

& node $clientLogicScript 2>&1 | Tee-Object -FilePath $clientLogicLogPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  throw "Client logic regression check failed with exit code $exitCode"
}

& pwsh -NoProfile -ExecutionPolicy Bypass -File $prerequisiteScript 2>&1 | Tee-Object -FilePath $prerequisiteLogPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  throw "Prerequisite regression check failed with exit code $exitCode"
}

& pwsh -NoProfile -ExecutionPolicy Bypass -File $installerSourceScript 2>&1 | Tee-Object -FilePath $installerSourceLogPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  throw "Installer source regression check failed with exit code $exitCode"
}

$serviceLifecycleStatus = 'skipped'
$serviceLifecyclePort = Get-AvailableTcpPort
Write-Host "Windows service lifecycle check using TCP port $serviceLifecyclePort."
& pwsh -NoProfile -ExecutionPolicy Bypass -File $serviceLifecycleScript -ExpectedPort $serviceLifecyclePort 2>&1 | Tee-Object -FilePath $serviceLifecycleLogPath
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  throw "Windows service lifecycle check failed with exit code $exitCode"
}
if (Test-Path $serviceLifecycleLogPath) {
  $serviceLifecycleContent = Get-Content $serviceLifecycleLogPath -Raw
  if ($serviceLifecycleContent -match 'passed') {
    $serviceLifecycleStatus = 'passed'
  }
}

$summary = [ordered]@{
  smoke = 'passed'
  security = 'passed'
  adminFlows = 'passed'
  clientLogic = 'passed'
  prerequisites = 'passed'
  installerSource = 'passed'
  serviceLifecycle = $serviceLifecycleStatus
  serviceLifecyclePort = $serviceLifecyclePort
  entrypoint = 'tests/smoke-check.js'
  additionalChecks = @(
    'tests/security-regression-check.js',
    'tests/admin-flow-regression-check.js',
    'tests/client-logic-regression-check.js',
    'tests/prerequisite-regression-check.ps1',
    'tests/installer-source-regression-check.ps1',
    'scripts/support/test-windows-service-lifecycle.ps1'
  )
}

Write-Utf8File -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 3)
Write-Host 'Tests completed.'
