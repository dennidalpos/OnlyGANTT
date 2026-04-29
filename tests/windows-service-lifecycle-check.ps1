param(
  [string]$ServiceName = 'OnlyGanttWebValidation',
  [int]$ExpectedPort = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serviceScript = Join-Path $repoRoot 'scripts\windows\service.ps1'

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Wait-ForServiceEndpoint {
  param(
    [int]$Port
  )

  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/api/auth/config" -TimeoutSec 3
      if ($response.StatusCode -eq 200) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Service endpoint on port $Port did not become ready within 30 seconds."
}

if ($env:OS -ne 'Windows_NT') {
  Write-Host 'SKIPPED: Windows service lifecycle validation is only available on Windows.'
  exit 0
}

if (-not (Test-IsAdministrator)) {
  Write-Host 'SKIPPED: Windows service lifecycle validation requires administrator privileges.'
  exit 0
}

$portInUse = Get-NetTCPConnection -LocalPort $ExpectedPort -State Listen -ErrorAction SilentlyContinue
if ($null -ne $portInUse) {
  Write-Host "SKIPPED: TCP port $ExpectedPort is already in use."
  exit 0
}

try {
  & $serviceScript -Action Cleanup -ServiceName $ServiceName
  & $serviceScript -Action Install -ServiceName $ServiceName -DisplayName 'OnlyGantt Validation Service' -Description 'OnlyGANTT validation service lifecycle check' -StartType 'demand' -ForceReinstall
  & $serviceScript -Action Start -ServiceName $ServiceName
  Wait-ForServiceEndpoint -Port $ExpectedPort
  & $serviceScript -Action Stop -ServiceName $ServiceName
  & $serviceScript -Action Uninstall -ServiceName $ServiceName
  & $serviceScript -Action Cleanup -ServiceName $ServiceName

  $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($null -ne $service) {
    throw "Service '$ServiceName' still exists after cleanup."
  }

  Write-Host 'Windows service lifecycle check passed'
} finally {
  try {
    & $serviceScript -Action Stop -ServiceName $ServiceName | Out-Null
  } catch {
  }

  try {
    & $serviceScript -Action Cleanup -ServiceName $ServiceName | Out-Null
  } catch {
  }
}
