param(
  [string]$Version
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot '..\helpers\common.ps1')

function Get-SemVerCore {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputVersion
  )

  if ($InputVersion -notmatch '^\s*(\d+)\.(\d+)\.(\d+)') {
    throw "Unsupported package version '$InputVersion'. Expected semantic version format like 1.2.3."
  }

  return "$($Matches[1]).$($Matches[2]).$($Matches[3])"
}

function ConvertTo-RtfText {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  $escaped = $Text.Replace('\', '\\').Replace('{', '\{').Replace('}', '\}')
  $escaped = $escaped -replace "`r`n|`n|`r", "\par`r`n"
  return "{\rtf1\ansi`r`n$escaped`r`n}"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Ensure-ArtifactsLayout -RepoRoot $repoRoot

$packageJsonPath = Join-Path $repoRoot 'package.json'
$wixProvisionScriptPath = Join-Path $repoRoot 'scripts\packaging\provision-wix.ps1'
$nodeProvisionScriptPath = Join-Path $repoRoot 'scripts\packaging\provision-node.ps1'
$bundleSourcePath = Join-Path $repoRoot 'tools\wix\Bundle.wxs'
$wixToolRoot = Join-Path $repoRoot 'tools\wix314-binaries'
$brandIconPath = Join-Path $repoRoot 'src\public\brand\onlygantt.ico'
$licensePath = Join-Path $repoRoot 'LICENSE'

foreach ($required in @(
  @{ Path = $packageJsonPath; Label = 'package.json' },
  @{ Path = $wixProvisionScriptPath; Label = 'WiX provisioning script' },
  @{ Path = $nodeProvisionScriptPath; Label = 'Node.js provisioning script' },
  @{ Path = $bundleSourcePath; Label = 'WiX bundle source' },
  @{ Path = $brandIconPath; Label = 'Windows brand icon' },
  @{ Path = $licensePath; Label = 'license file' }
)) {
  Assert-PathExists -Path $required.Path -Label $required.Label
}

& $wixProvisionScriptPath
& $nodeProvisionScriptPath

foreach ($toolName in 'candle.exe', 'light.exe') {
  $toolPath = Join-Path $wixToolRoot $toolName
  Assert-PathExists -Path $toolPath -Label $toolName
}

$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$packageVersion = if ($Version) { $Version } else { [string]$packageJson.version }
$productVersion = Get-SemVerCore -InputVersion $packageVersion

$msiPath = Join-Path $repoRoot "artifacts\packages\msi\OnlyGantt-$productVersion-x64.msi"
Assert-PathExists -Path $msiPath -Label 'OnlyGANTT MSI package'

$nodeMsiPath = Join-Path $repoRoot 'artifacts\build\prerequisites\node-v24.15.0-x64.msi'
Assert-PathExists -Path $nodeMsiPath -Label 'Node.js LTS prerequisite MSI'

$buildRoot = Join-Path $repoRoot 'artifacts\build\setup'
$objRoot = Join-Path $buildRoot 'obj'
$distRoot = Join-Path $repoRoot 'artifacts\packages\setup'
$licenseRtfPath = Join-Path $buildRoot 'LICENSE.rtf'
$setupOutputPath = Join-Path $distRoot "OnlyGantt-Setup-$productVersion-x64.exe"

if (Test-Path $buildRoot) {
  Remove-Item -Path $buildRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $objRoot, $distRoot | Out-Null
ConvertTo-RtfText -Text (Get-Content $licensePath -Raw) | Set-Content -Path $licenseRtfPath -Encoding ascii

$candlePath = Join-Path $wixToolRoot 'candle.exe'
$lightPath = Join-Path $wixToolRoot 'light.exe'
$bundleObject = Join-Path $objRoot 'Bundle.wixobj'

$candleArguments = @(
  '-nologo'
  '-arch', 'x64'
  '-out', "$objRoot\"
  "-dProductVersion=$productVersion"
  "-dProductMsiSource=$msiPath"
  "-dNodeMsiSource=$nodeMsiPath"
  "-dBrandIcon=$brandIconPath"
  "-dLicenseRtf=$licenseRtfPath"
  '-ext', 'WixBalExtension'
  '-ext', 'WixUtilExtension'
  $bundleSourcePath
)

& $candlePath @candleArguments
if ($LASTEXITCODE -ne 0) {
  throw "candle.exe failed with exit code $LASTEXITCODE"
}

$lightArguments = @(
  '-nologo'
  '-out', $setupOutputPath
  '-ext', 'WixBalExtension'
  '-ext', 'WixUtilExtension'
  $bundleObject
)

& $lightPath @lightArguments
if ($LASTEXITCODE -ne 0) {
  throw "light.exe failed with exit code $LASTEXITCODE"
}

Write-Host "Setup bootstrapper created: $setupOutputPath"
