param(
  [switch]$RunMsiLifecycleValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-TruthyValue {
  param(
    [string]$Value
  )

  if (-not $Value) {
    return $false
  }

  return @('1', 'true', 'yes', 'on') -contains $Value.ToLowerInvariant()
}

$shouldRunMsiLifecycleValidation = $RunMsiLifecycleValidation.IsPresent -or (Test-TruthyValue -Value $env:ONLYGANTT_RUN_MSI_TESTS)
$buildScript = Join-Path $PSScriptRoot 'build.ps1'
$packagingScript = Join-Path $PSScriptRoot 'packaging\build-msi.ps1'
$msiInstallTestScript = Join-Path $PSScriptRoot 'packaging\msi-install-test.ps1'
$msiUpgradeTestScript = Join-Path $PSScriptRoot 'packaging\msi-upgrade-test.ps1'
$msiUninstallTestScript = Join-Path $PSScriptRoot 'packaging\msi-uninstall-test.ps1'

& $buildScript
& $packagingScript

if ($shouldRunMsiLifecycleValidation) {
  & $msiInstallTestScript
  & $msiUpgradeTestScript
  & $msiUninstallTestScript
}

Write-Host 'Pack completed.'
