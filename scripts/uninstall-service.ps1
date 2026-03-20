param(
  [string]$ServiceName = 'OnlyGanttWeb',
  [string]$NssmPath,
  [switch]$ForceDelete
)

$ErrorActionPreference = 'Stop'

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)

  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required to remove the Windows service. Re-run PowerShell as Administrator.'
  }
}

function TryResolve-NssmExecutable {
  param(
    [string]$RepoRoot,
    [string]$ExplicitPath
  )

  if ($ExplicitPath) {
    if (-not (Test-Path $ExplicitPath)) {
      throw "nssm.exe not found in $ExplicitPath"
    }

    return (Resolve-Path $ExplicitPath).Path
  }

  $archFolder = if ([Environment]::Is64BitOperatingSystem) { 'win64' } else { 'win32' }
  $candidate = Join-Path $RepoRoot "tools\nssm\$archFolder\nssm.exe"

  if (-not (Test-Path $candidate)) {
    return $null
  }

  return (Resolve-Path $candidate).Path
}

function Invoke-Nssm {
  param(
    [string]$Executable,
    [string[]]$Arguments
  )

  & $Executable @Arguments | Out-Null

  if ($LASTEXITCODE -ne 0) {
    $joinedArguments = $Arguments -join ' '
    throw "nssm command failed with exit code ${LASTEXITCODE}: $Executable $joinedArguments"
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$nssmExe = TryResolve-NssmExecutable -RepoRoot $repoRoot -ExplicitPath $NssmPath

Assert-Administrator

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -eq $service) {
  Write-Host "Service '$ServiceName' not found."
  exit 0
}

if ($service.Status -ne 'Stopped') {
  Stop-Service -Name $ServiceName -Force
}

try {
  if ($nssmExe) {
    Invoke-Nssm -Executable $nssmExe -Arguments @('remove', $ServiceName, 'confirm')
    Write-Host "Service '$ServiceName' removed via NSSM: $nssmExe"
    exit 0
  }

  if (-not $ForceDelete) {
    throw "NSSM executable not found under tools\\nssm. Re-run with -ForceDelete to remove the service via sc.exe."
  }
} catch {
  if (-not $ForceDelete) {
    throw
  }

  Write-Warning "NSSM removal failed for '$ServiceName': $($_.Exception.Message)"
  Write-Warning "Falling back to sc.exe delete."
}

sc.exe delete $ServiceName | Out-Null

if ($LASTEXITCODE -ne 0) {
  throw "sc.exe delete failed with exit code ${LASTEXITCODE} for service '$ServiceName'."
}

Write-Host "Service '$ServiceName' removed via sc.exe delete."
