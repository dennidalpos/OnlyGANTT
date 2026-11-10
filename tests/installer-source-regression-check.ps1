Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$nsisSourcePath = Join-Path $repoRoot 'tools\nsis\installer.nsi'

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

Assert-True -Condition (Test-Path $nsisSourcePath) -Message "NSIS source not found: $nsisSourcePath"

$nsisContent = Get-Content $nsisSourcePath -Raw

Assert-True -Condition ($nsisContent -match 'PROGRAMFILES64\\OnlyGANTT') -Message 'NSIS script should install to 64-bit Program Files.'
Assert-True -Condition ($nsisContent -match 'RunningX64') -Message 'NSIS script should verify 64-bit Windows architecture.'
Assert-True -Condition ($nsisContent -match 'sc\.exe create OnlyGanttWeb') -Message 'NSIS script should create OnlyGanttWeb service.'
Assert-True -Condition ($nsisContent -match 'sc\.exe delete OnlyGanttWeb') -Message 'NSIS script should delete OnlyGanttWeb service.'
Assert-True -Condition ($nsisContent -match 'OnlyGANTT\.url') -Message 'NSIS script should create desktop URL shortcut.'
Assert-True -Condition ($nsisContent -match 'OnlyGANTT Admin\.url') -Message 'NSIS script should create admin desktop URL shortcut.'
Assert-True -Condition ($nsisContent -match 'Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\OnlyGANTT') -Message 'NSIS script should register uninstall info in Windows Registry.'
Assert-True -Condition ($nsisContent -match 'SOFTWARE\\Danny Perondi\\OnlyGANTT\\Installer') -Message 'NSIS script should register InstallRoot in Windows Registry.'

Write-Host 'Installer source regression check passed (NSIS x64).'
