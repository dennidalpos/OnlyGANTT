Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..\common.ps1')

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot

$clientBundle = Join-Path $repoRoot 'artifacts\build\client\app.bundle.js'
$serviceExe = Join-Path $repoRoot 'artifacts\build\service\OnlyGantt.Service.exe'

Assert-PathExists -Path $clientBundle -Label 'Client bundle'
Assert-PathExists -Path $serviceExe -Label 'Windows service host'

$makensisCmd = Get-Command 'makensis' -ErrorAction SilentlyContinue
$makensisExe = if ($makensisCmd) {
  $makensisCmd.Source
} elseif (Test-Path 'C:\Program Files (x86)\NSIS\makensis.exe') {
  'C:\Program Files (x86)\NSIS\makensis.exe'
} elseif (Test-Path 'C:\Program Files\NSIS\makensis.exe') {
  'C:\Program Files\NSIS\makensis.exe'
} else {
  $null
}

if (-not $makensisExe) {
  throw 'NSIS executable (makensis.exe) not found. Please install NSIS.'
}

$nsiScript = Join-Path $repoRoot 'tools\nsis\installer.nsi'
Assert-PathExists -Path $nsiScript -Label 'NSIS script'

$outputDir = Join-Path $repoRoot 'artifacts\packages'
Ensure-Directory -Path $outputDir

Write-Host "Compiling NSIS installer using $makensisExe..."
& $makensisExe $nsiScript
if ($LASTEXITCODE -ne 0) {
  throw "NSIS compilation failed with exit code $LASTEXITCODE."
}

$setupExe = Join-Path $outputDir 'OnlyGANTT-Setup-x64.exe'
Assert-PathExists -Path $setupExe -Label 'Generated Setup executable'

Write-Host "NSIS packaging completed: $setupExe"
