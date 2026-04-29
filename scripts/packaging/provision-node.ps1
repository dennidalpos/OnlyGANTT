param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$nodeVersion = '24.15.0'
$nodeMsiName = "node-v$nodeVersion-x64.msi"
$nodeMsiSha256 = 'FEFFB8E5CB5AC47F793666636D496EF3E975BE82C84C4DA5D20E6AA8FA4EB806'
$downloadUri = "https://nodejs.org/dist/v$nodeVersion/$nodeMsiName"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$cacheRoot = Join-Path $repoRoot 'artifacts\build\prerequisites'
$nodeMsiPath = Join-Path $cacheRoot $nodeMsiName
$metadataPath = Join-Path $cacheRoot 'node-lts.json'

function Test-NodeMsiHash {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    return $false
  }

  $actualHash = (Get-FileHash -Path $Path -Algorithm SHA256).Hash
  return $actualHash.Equals($nodeMsiSha256, [System.StringComparison]::OrdinalIgnoreCase)
}

if ((-not $Force) -and (Test-NodeMsiHash -Path $nodeMsiPath)) {
  Write-Host "Node.js $nodeVersion prerequisite is already available in $nodeMsiPath"
  return
}

New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null

if ($Force -and (Test-Path $nodeMsiPath)) {
  Remove-Item -Path $nodeMsiPath -Force
}

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Write-Host "Downloading Node.js $nodeVersion x64 MSI from $downloadUri"
Invoke-WebRequest -Uri $downloadUri -OutFile $nodeMsiPath

if (-not (Test-NodeMsiHash -Path $nodeMsiPath)) {
  $actualHash = (Get-FileHash -Path $nodeMsiPath -Algorithm SHA256).Hash
  Remove-Item -Path $nodeMsiPath -Force
  throw "Node.js MSI hash mismatch. Expected $nodeMsiSha256, got $actualHash."
}

$metadata = [pscustomobject]@{
  version = $nodeVersion
  architecture = 'x64'
  source = $downloadUri
  sha256 = $nodeMsiSha256
  path = $nodeMsiPath
}
$metadata | ConvertTo-Json | Set-Content -Path $metadataPath -Encoding utf8

Write-Host "Node.js $nodeVersion prerequisite cached in $nodeMsiPath"
