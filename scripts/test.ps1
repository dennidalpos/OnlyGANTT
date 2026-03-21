Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'helpers\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot

$doctorScript = Join-Path $PSScriptRoot 'doctor.ps1'
$compileScript = Join-Path $PSScriptRoot 'compile.ps1'
& $doctorScript
& $compileScript

$logPath = Join-Path $repoRoot 'artifacts\test-results\smoke-check.log'
$securityLogPath = Join-Path $repoRoot 'artifacts\test-results\security-regression-check.log'
$adminFlowLogPath = Join-Path $repoRoot 'artifacts\test-results\admin-flow-regression-check.log'
$clientLogicLogPath = Join-Path $repoRoot 'artifacts\test-results\client-logic-regression-check.log'
$serviceLifecycleLogPath = Join-Path $repoRoot 'artifacts\test-results\windows-service-lifecycle-check.log'
$summaryPath = Join-Path $repoRoot 'artifacts\test-results\summary.json'
$smokeScript = Join-Path $repoRoot 'tests\smoke-check.js'
$securityScript = Join-Path $repoRoot 'tests\security-regression-check.js'
$adminFlowScript = Join-Path $repoRoot 'tests\admin-flow-regression-check.js'
$clientLogicScript = Join-Path $repoRoot 'tests\client-logic-regression-check.js'
$serviceLifecycleScript = Join-Path $repoRoot 'tests\windows-service-lifecycle-check.ps1'

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

$serviceLifecycleStatus = 'skipped'
& powershell -NoProfile -ExecutionPolicy Bypass -File $serviceLifecycleScript 2>&1 | Tee-Object -FilePath $serviceLifecycleLogPath
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
  serviceLifecycle = $serviceLifecycleStatus
  entrypoint = 'tests/smoke-check.js'
  additionalChecks = @(
    'tests/security-regression-check.js',
    'tests/admin-flow-regression-check.js',
    'tests/client-logic-regression-check.js',
    'tests/windows-service-lifecycle-check.ps1'
  )
}

Write-Utf8File -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 3)
Write-Host 'Tests completed.'
