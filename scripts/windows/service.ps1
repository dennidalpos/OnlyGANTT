param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Install', 'Start', 'Stop', 'Uninstall', 'Cleanup')]
  [string]$Action,
  [string]$ServiceName = 'OnlyGanttWeb',
  [string]$DisplayName = 'OnlyGantt Web Server',
  [string]$Description = 'OnlyGANTT server service',
  [ValidateSet('auto', 'demand', 'disabled')]
  [string]$StartType = 'auto',
  [int]$Port = 3000,
  [string]$AdminResetCode = '',
  [string]$ServiceHostPath,
  [string]$NodePath,
  [switch]$ForceReinstall,
  [switch]$RemoveLogs
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)

  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required to manage the Windows service. Re-run PowerShell as Administrator.'
  }
}

function Resolve-ServiceHost {
  param(
    [string]$RepoRoot,
    [string]$ExplicitPath
  )

  if ($ExplicitPath) {
    return (Resolve-Path $ExplicitPath).Path
  }

  foreach ($candidate in @(
    (Join-Path $RepoRoot 'service\OnlyGantt.Service.exe'),
    (Join-Path $RepoRoot 'artifacts\build\service\OnlyGantt.Service.exe')
  )) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  throw "OnlyGANTT service host not found. Run 'npm run build' or pass -ServiceHostPath."
}

function Resolve-Node {
  param(
    [string]$ExplicitPath
  )

  if ($ExplicitPath) {
    return (Resolve-Path $ExplicitPath).Path
  }

  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $programFilesNode = Join-Path ${env:ProgramFiles} 'nodejs\node.exe'
  if (Test-Path $programFilesNode) {
    return (Resolve-Path $programFilesNode).Path
  }

  throw 'Node.js was not found. Install Node.js 24 LTS or pass -NodePath.'
}

function Wait-ServiceStatus {
  param(
    [string]$Name,
    [ValidateSet('Running', 'Stopped')]
    [string]$Status
  )

  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if ($null -eq $service) {
    throw "Service '$Name' not found."
  }

  $service.WaitForStatus($Status, [TimeSpan]::FromSeconds(30))
}

function Remove-ServiceIfPresent {
  param(
    [string]$Name
  )

  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if ($null -eq $service) {
    return
  }

  if ($service.Status -ne 'Stopped') {
    Stop-Service -Name $Name -Force
    Wait-ServiceStatus -Name $Name -Status 'Stopped'
  }

  sc.exe delete $Name | Out-Null
  if ($LASTEXITCODE -notin @(0, 1060, 1072)) {
    throw "sc.exe delete failed with exit code $LASTEXITCODE for service '$Name'."
  }
  $global:LASTEXITCODE = 0
}

function Install-Service {
  Assert-Administrator

  if ($Port -lt 1 -or $Port -gt 65535) {
    throw 'Port must be between 1 and 65535.'
  }

  $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($existing) {
    if (-not $ForceReinstall) {
      throw "Service '$ServiceName' already exists. Use -ForceReinstall to replace it."
    }

    Remove-ServiceIfPresent -Name $ServiceName
  }

  $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
  $serviceHost = Resolve-ServiceHost -RepoRoot $repoRoot -ExplicitPath $ServiceHostPath
  $node = Resolve-Node -ExplicitPath $NodePath
  $serverPath = Join-Path $repoRoot 'src\server\server.js'
  $dataDir = Join-Path $repoRoot 'Data'
  $logDir = Join-Path $dataDir 'log'

  foreach ($required in @($serverPath, $serviceHost, $node)) {
    if (-not (Test-Path $required)) {
      throw "Required service input not found: $required"
    }
  }

  New-Item -ItemType Directory -Force -Path $logDir | Out-Null

  $arguments = @(
    '--app-dir', $repoRoot,
    '--node-path', $node,
    '--server-js', $serverPath,
    '--data-dir', $dataDir,
    '--port', [string]$Port,
    '--log-dir', $logDir
  )

  if ($AdminResetCode) {
    $arguments += @('--admin-reset-code', $AdminResetCode)
  }

  $quotedArguments = @($arguments | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' })
  $binPath = '"' + $serviceHost + '" ' + ($quotedArguments -join ' ')

  sc.exe create $ServiceName binPath= $binPath start= $StartType DisplayName= $DisplayName | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "sc.exe create failed with exit code $LASTEXITCODE for service '$ServiceName'."
  }

  sc.exe description $ServiceName $Description | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "sc.exe description failed with exit code $LASTEXITCODE for service '$ServiceName'."
  }

  sc.exe failure $ServiceName reset= 86400 actions= restart/30000/restart/30000/restart/30000 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "sc.exe failure failed with exit code $LASTEXITCODE for service '$ServiceName'."
  }

  $global:LASTEXITCODE = 0
  Write-Host "Service '$ServiceName' installed with native Windows service management."
}

function Start-NativeService {
  Assert-Administrator

  $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($null -eq $service) {
    throw "Service '$ServiceName' not found."
  }

  if ($service.Status -ne 'Running') {
    Start-Service -Name $ServiceName
    Wait-ServiceStatus -Name $ServiceName -Status 'Running'
  }

  Write-Host "Service '$ServiceName' is running."
}

function Stop-NativeService {
  Assert-Administrator

  $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($null -eq $service) {
    Write-Host "Service '$ServiceName' not found."
    return
  }

  if ($service.Status -ne 'Stopped') {
    Stop-Service -Name $ServiceName -Force
    Wait-ServiceStatus -Name $ServiceName -Status 'Stopped'
  }

  Write-Host "Service '$ServiceName' is stopped."
}

function Cleanup-Service {
  Assert-Administrator
  Remove-ServiceIfPresent -Name $ServiceName

  if ($RemoveLogs) {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    foreach ($relativePath in @(
      'Data\log\service-stdout.log',
      'Data\log\service-stderr.log',
      'Data\log\service-stdout.log.1',
      'Data\log\service-stderr.log.1'
    )) {
      $targetPath = Join-Path $repoRoot $relativePath
      if (Test-Path $targetPath) {
        Remove-Item -Path $targetPath -Force
      }
    }
  }

  Write-Host "Cleanup completed for service '$ServiceName'."
}

switch ($Action) {
  'Install' { Install-Service }
  'Start' { Start-NativeService }
  'Stop' { Stop-NativeService }
  'Uninstall' {
    Assert-Administrator
    Remove-ServiceIfPresent -Name $ServiceName
    Write-Host "Service '$ServiceName' removed."
  }
  'Cleanup' { Cleanup-Service }
}
