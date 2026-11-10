Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
. (Join-Path $repoRoot 'scripts\support\prerequisites.ps1')

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

Assert-True -Condition (Test-VersionAtLeast -Actual ([version]'20.0.0') -Minimum ([version]'20.0.0')) -Message 'Node.js 20.0.0 should satisfy the minimum version.'
Assert-True -Condition (Test-VersionAtLeast -Actual ([version]'24.15.0') -Minimum ([version]'20.0.0')) -Message 'Node.js 24.15.0 should satisfy the minimum version.'
Assert-True -Condition (-not (Test-VersionAtLeast -Actual ([version]'18.19.1') -Minimum ([version]'20.0.0'))) -Message 'Node.js 18.19.1 should not satisfy the minimum version.'

$nodeStatus = Assert-NodeRuntime -Reason 'Prerequisite regression check verifies the local supported runtime path.'
Assert-True -Condition $nodeStatus.Found -Message 'Expected local Node.js runtime to be present for the success prerequisite path.'

$missingPath = Join-Path $env:TEMP 'OnlyGANTT-missing-node.exe'
try {
  Assert-NodeRuntime -NodePath $missingPath -Reason 'Prerequisite regression check verifies the missing-runtime message.' | Out-Null
  throw 'Expected missing Node.js prerequisite check to fail.'
} catch {
  $message = $_.Exception.Message
  foreach ($expected in @(
    'Missing prerequisite: Node.js.',
    'Required version: Node.js 20 or newer',
    'Why it is required:',
    'Install action:',
    'Verification: run `node --version`'
  )) {
    Assert-True -Condition $message.Contains($expected) -Message "Missing expected prerequisite message fragment: $expected"
  }
}

Write-Host 'Prerequisite regression check passed'
