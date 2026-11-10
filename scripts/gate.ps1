Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-GateStep {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$ScriptPath
  )

  if (-not (Test-Path $ScriptPath)) {
    throw "Gate step '$Name' cannot run because the script was not found: $ScriptPath"
  }

  Write-Host "==> $Name"
  & $ScriptPath
  if ($LASTEXITCODE -ne 0) {
    throw "Gate step '$Name' failed with exit code $LASTEXITCODE. Re-run the step directly for full context: $ScriptPath"
  }
}

$steps = @(
  @{ Name = 'preflight'; ScriptPath = Join-Path $PSScriptRoot 'check-environment.ps1' },
  @{ Name = 'test'; ScriptPath = Join-Path $PSScriptRoot 'test-project.ps1' },
  @{ Name = 'package'; ScriptPath = Join-Path $PSScriptRoot 'package-project.ps1' }
)

foreach ($step in $steps) {
  Invoke-GateStep -Name $step.Name -ScriptPath $step.ScriptPath
}

Write-Host 'Gate completed.'
