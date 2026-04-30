param(
  [string]$FromVersion = '1.0.0',
  [string]$ToVersion = '1.0.1'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'common.ps1')

Assert-Administrator

if ($FromVersion -eq $ToVersion) {
  throw 'FromVersion and ToVersion must be different.'
}

$paths = Get-PackagingPaths -ScriptRoot $PSScriptRoot
$installRoot = $paths.DefaultInstallRoot
$buildScript = $paths.BuildMsiScript

try {
  Remove-OnlyGanttMachineState -LogsRoot $paths.LogsRoot -FallbackInstallRoot $installRoot

  & $buildScript -Version $FromVersion
  if ($LASTEXITCODE -ne 0) {
    throw "MSI build failed for version $FromVersion"
  }

  & $buildScript -Version $ToVersion
  if ($LASTEXITCODE -ne 0) {
    throw "MSI build failed for version $ToVersion"
  }

  $fromMsi = Resolve-MsiPath -PackagesRoot $paths.PackagesRoot -Version $FromVersion
  $toMsi = Resolve-MsiPath -PackagesRoot $paths.PackagesRoot -Version $ToVersion

  $installLog = Join-Path $paths.LogsRoot 'msi-upgrade-test-install.log'
  $upgradeLog = Join-Path $paths.LogsRoot 'msi-upgrade-test-upgrade.log'
  $uninstallLog = Join-Path $paths.LogsRoot 'msi-upgrade-test-uninstall.log'

  Invoke-MsiExec -Arguments @('/i', $fromMsi) -LogPath $installLog
  Assert-OnlyGanttInstalled -ExpectedVersion $FromVersion -InstallRoot $installRoot

  Invoke-MsiExec -Arguments @('/i', $toMsi) -LogPath $upgradeLog
  Assert-OnlyGanttInstalled -ExpectedVersion $ToVersion -InstallRoot $installRoot

  $entry = Get-OnlyGanttUninstallEntry
  if ($null -eq $entry) {
    throw 'OnlyGANTT uninstall entry not found before upgrade cleanup.'
  }

  Invoke-MsiExec -Arguments @('/x', $entry.ProductCode) -LogPath $uninstallLog
  Assert-OnlyGanttRemoved -InstallRoot $installRoot

  Write-Host "MSI upgrade test passed from $FromVersion to $ToVersion"
} finally {
  Remove-OnlyGanttMachineState -LogsRoot $paths.LogsRoot -FallbackInstallRoot $installRoot
}

$global:LASTEXITCODE = 0
