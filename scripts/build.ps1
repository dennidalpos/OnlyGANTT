Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$doctorScript = Join-Path $PSScriptRoot 'doctor.ps1'
$compileScript = Join-Path $PSScriptRoot 'compile.ps1'

& $doctorScript
& $compileScript

Write-Host 'Build completed.'
