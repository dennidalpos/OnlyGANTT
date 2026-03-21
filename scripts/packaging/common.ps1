Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot '..\helpers\common.ps1')

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)

  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required for MSI lifecycle tests.'
  }
}

function Get-PackagingPaths {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ScriptRoot
  )

  $repoRoot = (Resolve-Path (Join-Path $ScriptRoot '..\..')).Path
  Ensure-ArtifactsLayout -RepoRoot $repoRoot

  return [pscustomobject]@{
    RepoRoot = $repoRoot
    LogsRoot = Join-Path $repoRoot 'artifacts\logs'
    PackagesRoot = Join-Path $repoRoot 'artifacts\packages\msi'
    BuildMsiScript = Join-Path $repoRoot 'scripts\packaging\build-msi.ps1'
    DefaultInstallRoot = Join-Path ${env:ProgramFiles} 'OnlyGANTT'
  }
}

function Resolve-MsiPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PackagesRoot,
    [string]$Path,
    [string]$Version
  )

  if ($Path) {
    return (Resolve-Path $Path).Path
  }

  if ($Version) {
    $candidate = Join-Path $PackagesRoot "OnlyGantt-$Version-x64.msi"
    if (-not (Test-Path $candidate)) {
      throw "MSI not found for version ${Version}: $candidate"
    }

    return (Resolve-Path $candidate).Path
  }

  $msi = Get-ChildItem -Path $PackagesRoot -Filter 'OnlyGantt-*-x64.msi' -File -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1

  if ($null -eq $msi) {
    throw "No MSI package found under $PackagesRoot"
  }

  return $msi.FullName
}

function Get-OnlyGanttUninstallEntry {
  $registryRoots = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
  )

  foreach ($root in $registryRoots) {
    if (-not (Test-Path $root)) {
      continue
    }

    $entry = Get-ChildItem -Path $root -ErrorAction SilentlyContinue | ForEach-Object {
      try {
        $properties = Get-ItemProperty -Path $_.PSPath -ErrorAction Stop
        if ($properties.DisplayName -eq 'OnlyGANTT') {
          [pscustomobject]@{
            KeyPath = $_.PSPath
            ProductCode = Split-Path -Path $_.PSChildName -Leaf
            DisplayVersion = [string]$properties.DisplayVersion
            InstallLocation = [string]$properties.InstallLocation
          }
        }
      } catch {
      }
    } | Select-Object -First 1

    if ($null -ne $entry) {
      return $entry
    }
  }

  return $null
}

function Get-OnlyGanttInstallRoot {
  $registryPath = 'HKLM:\SOFTWARE\Danny Perondi\OnlyGANTT\Installer'
  if (Test-Path $registryPath) {
    $installRoot = (Get-ItemProperty -Path $registryPath -ErrorAction SilentlyContinue).InstallRoot
    if ($installRoot) {
      return $installRoot.TrimEnd('\')
    }
  }

  return $null
}

function Get-ServiceSnapshot {
  param(
    [string]$ServiceName = 'OnlyGanttWeb'
  )

  return Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
}

function Wait-Until {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Condition,
    [int]$TimeoutSeconds = 30,
    [int]$PollMilliseconds = 500
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $result = & $Condition
    if ($result) {
      return $result
    }

    Start-Sleep -Milliseconds $PollMilliseconds
  } while ((Get-Date) -lt $deadline)

  return $null
}

function Wait-ForInstallerIdle {
  param(
    [int]$TimeoutSeconds = 60
  )

  $result = Wait-Until -TimeoutSeconds $TimeoutSeconds -Condition {
    $processes = Get-CimInstance Win32_Process -Filter "Name = 'msiexec.exe'" -ErrorAction SilentlyContinue
    if ($null -eq $processes) {
      return $true
    }

    $activeProcesses = @($processes | Where-Object {
      $commandLine = [string]$_.CommandLine
      $commandLine -and $commandLine -notmatch '^[A-Z]:\\WINDOWS\\system32\\msiexec\.exe\s+/V(\s+[A-Z]:\\WINDOWS\\system32\\msiexec\.exe)?$'
    })

    return ($activeProcesses.Count -eq 0)
  }

  if (-not $result) {
    throw 'Windows Installer is still busy after the expected timeout.'
  }
}

function Wait-ServiceState {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ServiceName,
    [Parameter(Mandatory = $true)]
    [ValidateSet('Running', 'Stopped')]
    [string]$Status,
    [int]$TimeoutSeconds = 30
  )

  $service = Get-ServiceSnapshot -ServiceName $ServiceName
  if ($null -eq $service) {
    throw "Service '$ServiceName' not found."
  }

  $service.WaitForStatus($Status, [TimeSpan]::FromSeconds($TimeoutSeconds))
}

function Invoke-MsiExec {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$LogPath
  )

  $allArguments = @($Arguments + '/qn' + '/norestart' + '/l*v' + $LogPath)
  Wait-ForInstallerIdle
  $global:LASTEXITCODE = 0
  & msiexec.exe @allArguments
  Wait-ForInstallerIdle

  if ($LASTEXITCODE -ne 0) {
    throw "msiexec failed with exit code $LASTEXITCODE. Log: $LogPath"
  }
}

function Assert-OnlyGanttInstalled {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedVersion,
    [string]$InstallRoot,
    [string]$ServiceName = 'OnlyGanttWeb'
  )

  $entry = Wait-Until -Condition { Get-OnlyGanttUninstallEntry }
  if ($null -eq $entry) {
    throw 'OnlyGANTT uninstall entry not found after installation.'
  }

  if ($entry.DisplayVersion -ne $ExpectedVersion) {
    throw "Expected installed version $ExpectedVersion, found $($entry.DisplayVersion)."
  }

  $resolvedInstallRoot = if ($InstallRoot) {
    $InstallRoot
  } elseif ($entry.InstallLocation) {
    $entry.InstallLocation.TrimEnd('\')
  } else {
    Get-OnlyGanttInstallRoot
  }

  if (-not $resolvedInstallRoot -or -not (Test-Path $resolvedInstallRoot)) {
    throw 'OnlyGANTT install directory not found after installation.'
  }

  foreach ($relativePath in @(
    'src\server\server.js',
    'src\public\index.html',
    'tools\nssm\win64\nssm.exe'
  )) {
    $targetPath = Join-Path $resolvedInstallRoot $relativePath
    if (-not (Test-Path $targetPath)) {
      throw "Installed file not found: $targetPath"
    }
  }

  $service = Wait-Until -Condition { Get-ServiceSnapshot -ServiceName $ServiceName }
  if ($null -eq $service) {
    throw "Service '$ServiceName' not found after installation."
  }

  if ($service.Status -ne 'Running') {
    Wait-ServiceState -ServiceName $ServiceName -Status 'Running'
  }
}

function Assert-OnlyGanttRemoved {
  param(
    [string]$ServiceName = 'OnlyGanttWeb',
    [string]$InstallRoot
  )

  $entryStillPresent = Wait-Until -Condition { Get-OnlyGanttUninstallEntry } -TimeoutSeconds 30
  if ($entryStillPresent) {
    throw 'OnlyGANTT uninstall entry still present after removal.'
  }

  $serviceStillPresent = Wait-Until -Condition { Get-ServiceSnapshot -ServiceName $ServiceName } -TimeoutSeconds 30
  if ($serviceStillPresent) {
    throw "Service '$ServiceName' still present after removal."
  }

  $resolvedInstallRoot = if ($InstallRoot) { $InstallRoot } else { Get-OnlyGanttInstallRoot }
  if ($resolvedInstallRoot -and (Test-Path $resolvedInstallRoot)) {
    throw "Install directory still present after removal: $resolvedInstallRoot"
  }

  $registryPath = 'HKLM:\SOFTWARE\Danny Perondi\OnlyGANTT'
  if (Test-Path $registryPath) {
    throw "Installer registry key still present after removal: $registryPath"
  }
}

function Remove-OnlyGanttMachineState {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LogsRoot,
    [string]$ServiceName = 'OnlyGanttWeb',
    [string]$FallbackInstallRoot
  )

  $entry = Get-OnlyGanttUninstallEntry
  if ($null -ne $entry) {
    $cleanupLog = Join-Path $LogsRoot 'msi-cleanup.log'
    Invoke-MsiExec -Arguments @('/x', $entry.ProductCode) -LogPath $cleanupLog
  }

  $service = Get-ServiceSnapshot -ServiceName $ServiceName
  if ($null -ne $service) {
    if ($service.Status -ne 'Stopped') {
      Stop-Service -Name $ServiceName -Force
    }

    sc.exe delete $ServiceName | Out-Null
    if ($LASTEXITCODE -notin @(0, 1060, 1072)) {
      throw "sc.exe delete failed with exit code $LASTEXITCODE for service '$ServiceName'."
    }

    $global:LASTEXITCODE = 0
    Start-Sleep -Seconds 2
  }

  $installRoot = Get-OnlyGanttInstallRoot
  if (-not $installRoot) {
    $installRoot = $FallbackInstallRoot
  }

  if ($installRoot -and (Test-Path $installRoot)) {
    $lastRemovalError = $null

    foreach ($attempt in 1..10) {
      try {
        if (Test-Path $installRoot) {
          Remove-Item -Path $installRoot -Recurse -Force
        }
      } catch {
        $lastRemovalError = $_
      }

      if (-not (Test-Path $installRoot)) {
        break
      }

      cmd.exe /c "rmdir /s /q `"$installRoot`"" 2>$null | Out-Null
      if (-not (Test-Path $installRoot)) {
        $global:LASTEXITCODE = 0
        break
      }

      Start-Sleep -Seconds 1
    }

    if (Test-Path $installRoot) {
      if ($lastRemovalError) {
        throw $lastRemovalError
      }

      throw "Unable to remove install directory after retries: $installRoot"
    }
  }

  $registryRoot = 'HKLM:\SOFTWARE\Danny Perondi\OnlyGANTT'
  if (Test-Path $registryRoot) {
    Remove-Item -Path $registryRoot -Recurse -Force
  }

  $global:LASTEXITCODE = 0
}
