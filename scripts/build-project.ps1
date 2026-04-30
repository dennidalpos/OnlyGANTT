Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$doctorScript = Join-Path $PSScriptRoot 'check-environment.ps1'
$compileScript = Join-Path $PSScriptRoot 'build-runtime.ps1'

& $doctorScript
& $compileScript

Write-Host 'Build completed.'
