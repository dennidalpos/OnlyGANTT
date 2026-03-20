Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'helpers\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot

$doctorScript = Join-Path $PSScriptRoot 'doctor.ps1'
& $doctorScript

$logPath = Join-Path $repoRoot 'artifacts\test-results\smoke-check.log'
$securityLogPath = Join-Path $repoRoot 'artifacts\test-results\security-regression-check.log'
$summaryPath = Join-Path $repoRoot 'artifacts\test-results\summary.json'
$smokeScript = Join-Path $repoRoot 'tests\smoke-check.js'
$securityScript = Join-Path $repoRoot 'tests\security-regression-check.js'

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

$summary = [ordered]@{
  smoke = 'passed'
  security = 'passed'
  entrypoint = 'tests/smoke-check.js'
  additionalChecks = @('tests/security-regression-check.js')
}

Write-Utf8File -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 3)
Write-Host 'Tests completed.'
