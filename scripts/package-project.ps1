param(
  [switch]$RunInstallerLifecycleValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$buildScript = Join-Path $PSScriptRoot 'build-project.ps1'
$packagingScript = Join-Path $PSScriptRoot 'support\packaging\build-installer.ps1'

& $buildScript
& $packagingScript

Write-Host 'Pack completed.'
