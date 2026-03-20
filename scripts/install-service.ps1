param(
  [string]$ServiceName = 'OnlyGanttWeb',
  [string]$DisplayName = 'OnlyGantt Web Server',
  [string]$Description = 'OnlyGANTT server service',
  [ValidateSet('SERVICE_AUTO_START', 'SERVICE_DEMAND_START', 'SERVICE_DISABLED')]
  [string]$StartType = 'SERVICE_AUTO_START',
  [string]$NssmPath,
  [switch]$ForceReinstall
)

$ErrorActionPreference = 'Stop'

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)

  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required to install the Windows service. Re-run PowerShell as Administrator.'
  }
}

function Resolve-NssmExecutable {
  param(
    [string]$RepoRoot,
    [string]$ExplicitPath
  )

  if ($ExplicitPath) {
    return (Resolve-Path $ExplicitPath).Path
  }

  $archFolder = if ([Environment]::Is64BitOperatingSystem) { 'win64' } else { 'win32' }
  $candidate = Join-Path $RepoRoot "tools\nssm\$archFolder\nssm.exe"

  if (-not (Test-Path $candidate)) {
    throw "nssm.exe not found in $candidate"
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

function Remove-NssmService {
  param(
    [string]$Executable,
    [string]$Name
  )

  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if ($null -eq $service) {
    return
  }

  if ($service.Status -ne 'Stopped') {
    Stop-Service -Name $Name -Force
  }

  Invoke-Nssm -Executable $Executable -Arguments @('remove', $Name, 'confirm')
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$nodePath = (Get-Command node).Source
$serverPath = Join-Path $repoRoot 'server\server.js'
$logDir = Join-Path $repoRoot 'Data\log'
$stdoutLog = Join-Path $logDir 'service-stdout.log'
$stderrLog = Join-Path $logDir 'service-stderr.log'
$nssmExe = Resolve-NssmExecutable -RepoRoot $repoRoot -ExplicitPath $NssmPath

Assert-Administrator

if (-not (Test-Path $serverPath)) {
  throw "Server entrypoint not found: $serverPath"
}

$packageJsonPath = Join-Path $repoRoot 'package.json'
if (-not (Test-Path $packageJsonPath)) {
  throw "package.json not found: $packageJsonPath"
}

$nodeModulesPath = Join-Path $repoRoot 'node_modules'
if (-not (Test-Path $nodeModulesPath)) {
  throw "Dependencies not installed. Run 'npm install' in $repoRoot before installing the service."
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -ne $existing) {
  if (-not $ForceReinstall) {
    throw "Service '$ServiceName' already exists. Uninstall it first or rerun with -ForceReinstall."
  }

  Remove-NssmService -Executable $nssmExe -Name $ServiceName
}

$serviceCreated = $false

try {
  Invoke-Nssm -Executable $nssmExe -Arguments @('install', $ServiceName, $nodePath, $serverPath)
  $serviceCreated = $true

  $created = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($null -eq $created) {
    throw "NSSM did not create service '$ServiceName'."
  }

  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'DisplayName', $DisplayName)
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'Description', $Description)
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppDirectory', $repoRoot)
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'Start', $StartType)
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppExit', 'Default', 'Restart')
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppThrottle', '1500')
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppStdout', $stdoutLog)
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppStderr', $stderrLog)
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppRotateFiles', '1')
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppRotateOnline', '1')
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppRotateBytes', '10485760')
  Invoke-Nssm -Executable $nssmExe -Arguments @('set', $ServiceName, 'AppEnvironmentExtra', 'ONLYGANTT_SERVICE_MANAGER=nssm')
} catch {
  if ($serviceCreated) {
    try {
      Remove-NssmService -Executable $nssmExe -Name $ServiceName
    } catch {
      Write-Warning "Automatic rollback failed for service '$ServiceName': $($_.Exception.Message)"
    }
  }

  throw
}

Write-Host "Service '$ServiceName' created via NSSM: $nssmExe"
Write-Host "Application: $nodePath $serverPath"
Write-Host "Startup type: $StartType"
Write-Host "Logs: $stdoutLog ; $stderrLog"
