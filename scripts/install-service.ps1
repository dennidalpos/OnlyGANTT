param(
  [string]$ServiceName = 'OnlyGanttWeb',
  [string]$DisplayName = 'OnlyGantt Web Server',
  [string]$Description = 'OnlyGANTT server service',
  [string]$StartType = 'Automatic'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$nodePath = (Get-Command node).Source
$serverPath = Join-Path $repoRoot 'server\server.js'

if (-not (Test-Path $serverPath)) {
  throw "Server entrypoint not found: $serverPath"
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($null -ne $existing) {
  throw "Service '$ServiceName' already exists. Uninstall it first."
}

$binPath = "`"$nodePath`" `"$serverPath`""

sc.exe create $ServiceName binPath= $binPath DisplayName= "`"$DisplayName`"" start= $StartType | Out-Null
sc.exe description $ServiceName "$Description" | Out-Null

Write-Host "Service '$ServiceName' created with binPath: $binPath"
