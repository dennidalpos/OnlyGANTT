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

function Get-PackageMsiVersion {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PackageJsonPath
  )

  $packageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
  $packageVersion = [string]$packageJson.version

  if ($packageVersion -notmatch '^\s*(\d+)\.(\d+)\.(\d+)') {
    throw "Unsupported package version '$packageVersion'. Expected semantic version format like 1.2.3."
  }

  return "$($Matches[1]).$($Matches[2]).$($Matches[3])"
}

$shouldRunMsiLifecycleValidation = $RunMsiLifecycleValidation.IsPresent -or (Test-TruthyValue -Value $env:ONLYGANTT_RUN_MSI_TESTS)
$packageMsiVersion = Get-PackageMsiVersion -PackageJsonPath (Join-Path $PSScriptRoot '..\package.json')
$buildScript = Join-Path $PSScriptRoot 'build.ps1'
$packagingScript = Join-Path $PSScriptRoot 'packaging\build-msi.ps1'
$setupPackagingScript = Join-Path $PSScriptRoot 'packaging\build-setup.ps1'
$msiInstallTestScript = Join-Path $PSScriptRoot 'packaging\msi-install-test.ps1'
$msiUpgradeTestScript = Join-Path $PSScriptRoot 'packaging\msi-upgrade-test.ps1'
$msiUninstallTestScript = Join-Path $PSScriptRoot 'packaging\msi-uninstall-test.ps1'

& $buildScript
& $packagingScript
& $setupPackagingScript

if ($shouldRunMsiLifecycleValidation) {
  & $msiInstallTestScript -Version $packageMsiVersion
  & $msiUpgradeTestScript
  & $msiUninstallTestScript -Version $packageMsiVersion
}

Write-Host 'Pack completed.'
