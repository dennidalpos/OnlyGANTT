param(
  [string]$MsiPath,
  [string]$Version
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'common.ps1')

Assert-Administrator

$paths = Get-PackagingPaths -ScriptRoot $PSScriptRoot
$resolvedMsiPath = Resolve-MsiPath -PackagesRoot $paths.PackagesRoot -Path $MsiPath -Version $Version
$expectedVersion = [System.Text.RegularExpressions.Regex]::Match([System.IO.Path]::GetFileName($resolvedMsiPath), '^OnlyGantt-(.+)-x64\.msi$').Groups[1].Value

if (-not $expectedVersion) {
  throw "Unable to infer package version from MSI name: $resolvedMsiPath"
}

$installRoot = $paths.DefaultInstallRoot
$installLog = Join-Path $paths.LogsRoot 'msi-uninstall-test-install.log'
$uninstallLog = Join-Path $paths.LogsRoot 'msi-uninstall-test-uninstall.log'

try {
  Remove-OnlyGanttMachineState -LogsRoot $paths.LogsRoot -FallbackInstallRoot $installRoot

  Invoke-MsiExec -Arguments @('/i', $resolvedMsiPath) -LogPath $installLog
  Assert-OnlyGanttInstalled -ExpectedVersion $expectedVersion -InstallRoot $installRoot

  $entry = Get-OnlyGanttUninstallEntry
  if ($null -eq $entry) {
    throw 'OnlyGANTT uninstall entry not found before uninstall test.'
  }

  Invoke-MsiExec -Arguments @('/x', $entry.ProductCode) -LogPath $uninstallLog
  Assert-OnlyGanttRemoved -InstallRoot $installRoot

  Write-Host "MSI uninstall test passed for $resolvedMsiPath"
} finally {
  Remove-OnlyGanttMachineState -LogsRoot $paths.LogsRoot -FallbackInstallRoot $installRoot
}

$global:LASTEXITCODE = 0
