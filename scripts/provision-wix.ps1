param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$wixVersion = '3.14.1'
$wixReleaseTag = 'wix3141rtm'
$wixArchiveName = 'wix314-binaries.zip'
$downloadUri = "https://github.com/wixtoolset/wix3/releases/download/$wixReleaseTag/$wixArchiveName"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$installRoot = Join-Path $repoRoot 'tools\wix314-binaries'
$tmpRoot = Join-Path $repoRoot 'tmp\wix314'
$archivePath = Join-Path $tmpRoot $wixArchiveName
$metadataPath = Join-Path $installRoot '.source.json'

function Test-WixToolRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $wixDllPath = Join-Path $Path 'wix.dll'
  $detectedVersion = $null
  if (Test-Path $wixDllPath) {
    $detectedVersion = [string](Get-Item $wixDllPath).VersionInfo.ProductVersion
  }

  return (
    (Test-Path (Join-Path $Path 'candle.exe')) -and
    (Test-Path (Join-Path $Path 'light.exe')) -and
    (Test-Path $wixDllPath) -and
    ($detectedVersion -like "$wixVersion*")
  )
}

if ((-not $Force) -and (Test-WixToolRoot -Path $installRoot)) {
  Write-Host "WiX $wixVersion is already available in $installRoot"
  return
}

if ($Force -and (Test-Path $installRoot)) {
  Remove-Item -Path $installRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $tmpRoot | Out-Null

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Write-Host "Downloading WiX Toolset $wixVersion binaries from $downloadUri"
Invoke-WebRequest -Uri $downloadUri -OutFile $archivePath

if (Test-Path $installRoot) {
  Remove-Item -Path $installRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
Expand-Archive -Path $archivePath -DestinationPath $installRoot -Force

if (-not (Test-WixToolRoot -Path $installRoot)) {
  throw "Provisioned WiX tool cache is incomplete: $installRoot"
}

$metadata = [pscustomobject]@{
  version = $wixVersion
  releaseTag = $wixReleaseTag
  archive = $wixArchiveName
  source = $downloadUri
  provisionedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
}
$metadata | ConvertTo-Json | Set-Content -Path $metadataPath -Encoding utf8

Remove-Item -Path $archivePath -Force
if ((Test-Path $tmpRoot) -and -not (Get-ChildItem -Path $tmpRoot -Force)) {
  Remove-Item -Path $tmpRoot -Force
}

Write-Host "WiX $wixVersion provisioned in $installRoot"
