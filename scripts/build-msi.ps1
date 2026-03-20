param(
  [string]$Version,
  [switch]$KeepBuildArtifacts
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function New-StableGuid {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Seed
  )

  $md5 = [System.Security.Cryptography.MD5]::Create()
  try {
    $hash = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Seed))
  } finally {
    $md5.Dispose()
  }
  $hash[6] = ($hash[6] -band 0x0F) -bor 0x30
  $hash[8] = ($hash[8] -band 0x3F) -bor 0x80
  return (New-Object System.Guid (, $hash)).ToString().ToUpperInvariant()
}

function Get-RelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BasePath,
    [Parameter(Mandatory = $true)]
    [string]$TargetPath
  )

  $resolvedBasePath = [System.IO.Path]::GetFullPath($BasePath).TrimEnd('\')
  $resolvedTargetPath = [System.IO.Path]::GetFullPath($TargetPath).TrimEnd('\')

  if ($resolvedTargetPath.Equals($resolvedBasePath, [System.StringComparison]::OrdinalIgnoreCase)) {
    return '.'
  }

  if ($resolvedTargetPath.StartsWith($resolvedBasePath + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
    return $resolvedTargetPath.Substring($resolvedBasePath.Length + 1)
  }

  $baseUri = New-Object System.Uri($resolvedBasePath + '\')
  $targetUri = New-Object System.Uri($resolvedTargetPath)
  $relativeUri = $baseUri.MakeRelativeUri($targetUri)
  return [System.Uri]::UnescapeDataString($relativeUri.ToString()).Replace('/', '\')
}

function Get-SemVerCore {
  param(
    [Parameter(Mandatory = $true)]
    [string]$InputVersion
  )

  if ($InputVersion -notmatch '^\s*(\d+)\.(\d+)\.(\d+)') {
    throw "Unsupported package version '$InputVersion'. Expected semantic version format like 1.2.3."
  }

  return [pscustomobject]@{
    Major = [int]$Matches[1]
    Minor = [int]$Matches[2]
    Patch = [int]$Matches[3]
    WixVersion = "$($Matches[1]).$($Matches[2]).$($Matches[3])"
  }
}

function Get-WixId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prefix,
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  $sanitized = ($RelativePath -replace '[^A-Za-z0-9_]', '_')
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  try {
    $hashBytes = $sha1.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($RelativePath))
  } finally {
    $sha1.Dispose()
  }

  $hash = ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').Substring(0, 10)
  $maxBodyLength = 50

  if ($sanitized.Length -gt $maxBodyLength) {
    $sanitized = $sanitized.Substring(0, $maxBodyLength)
  }

  return "${Prefix}_${sanitized}_${hash}"
}

function Copy-RepoItem {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourcePath,
    [Parameter(Mandatory = $true)]
    [string]$DestinationPath
  )

  if (-not (Test-Path $SourcePath)) {
    throw "Required packaging input not found: $SourcePath"
  }

  $destinationParent = Split-Path -Path $DestinationPath -Parent
  if ($destinationParent) {
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
  }

  if ((Get-Item $SourcePath) -is [System.IO.DirectoryInfo]) {
    Copy-Item -Path $SourcePath -Destination $DestinationPath -Recurse -Force
  } else {
    Copy-Item -Path $SourcePath -Destination $DestinationPath -Force
  }
}

function New-DirectoryXml {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FullPath,
    [Parameter(Mandatory = $true)]
    [string]$BasePath,
    [Parameter(Mandatory = $true)]
    [xml]$Document,
    [Parameter(Mandatory = $true)]
    [System.Xml.XmlElement]$ParentNode
  )

  $relativePath = Get-RelativePath -BasePath $BasePath -TargetPath $FullPath
  if ([string]::IsNullOrWhiteSpace($relativePath) -or $relativePath -eq '.') {
    return $ParentNode
  }

  $segments = $relativePath -split '[\\/]'
  $currentPath = ''
  $currentParent = $ParentNode

  foreach ($segment in $segments) {
    $currentPath = if ([string]::IsNullOrEmpty($currentPath)) { $segment } else { "$currentPath\$segment" }
    $directoryId = Get-WixId -Prefix 'DIR' -RelativePath $currentPath
    $existing = $currentParent.SelectSingleNode("./wix:Directory[@Id='$directoryId']", $script:XmlNamespaceManager)

    if ($null -eq $existing) {
      $directoryNode = $Document.CreateElement('Directory', $script:WixNamespace)
      $directoryNode.SetAttribute('Id', $directoryId)
      $directoryNode.SetAttribute('Name', $segment)
      $currentParent.AppendChild($directoryNode) | Out-Null
      $currentParent = $directoryNode
    } else {
      $currentParent = [System.Xml.XmlElement]$existing
    }
  }

  return $currentParent
}

function Write-AppFilesFragment {
  param(
    [Parameter(Mandatory = $true)]
    [string]$StageRoot,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
  )

  $document = New-Object System.Xml.XmlDocument
  $document.AppendChild($document.CreateXmlDeclaration('1.0', 'utf-8', $null)) | Out-Null

  $wixNode = $document.CreateElement('Wix', $script:WixNamespace)
  $document.AppendChild($wixNode) | Out-Null

  $fragmentNode = $document.CreateElement('Fragment', $script:WixNamespace)
  $wixNode.AppendChild($fragmentNode) | Out-Null

  $directoryRefNode = $document.CreateElement('DirectoryRef', $script:WixNamespace)
  $directoryRefNode.SetAttribute('Id', 'INSTALLDIR')
  $fragmentNode.AppendChild($directoryRefNode) | Out-Null

  $componentGroupNode = $document.CreateElement('ComponentGroup', $script:WixNamespace)
  $componentGroupNode.SetAttribute('Id', 'AppFiles')
  $fragmentNode.AppendChild($componentGroupNode) | Out-Null

  Get-ChildItem -Path $StageRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
    $file = $_
    $relativePath = Get-RelativePath -BasePath $StageRoot -TargetPath $file.FullName
    $directoryPath = Split-Path -Path $file.FullName -Parent
    $directoryNode = New-DirectoryXml -FullPath $directoryPath -BasePath $StageRoot -Document $document -ParentNode $directoryRefNode

    $componentId = Get-WixId -Prefix 'CMP' -RelativePath $relativePath
    $fileId = Get-WixId -Prefix 'FIL' -RelativePath $relativePath
    $componentGuid = New-StableGuid -Seed "OnlyGantt|$relativePath"

    $componentNode = $document.CreateElement('Component', $script:WixNamespace)
    $componentNode.SetAttribute('Id', $componentId)
    $componentNode.SetAttribute('Guid', $componentGuid)
    $componentNode.SetAttribute('Win64', 'yes')

    $fileNode = $document.CreateElement('File', $script:WixNamespace)
    $fileNode.SetAttribute('Id', $fileId)
    $fileNode.SetAttribute('Source', ('$(var.SourceDir)\{0}' -f $relativePath))
    $fileNode.SetAttribute('KeyPath', 'yes')

    $componentNode.AppendChild($fileNode) | Out-Null
    $directoryNode.AppendChild($componentNode) | Out-Null

    $componentRefNode = $document.CreateElement('ComponentRef', $script:WixNamespace)
    $componentRefNode.SetAttribute('Id', $componentId)
    $componentGroupNode.AppendChild($componentRefNode) | Out-Null
  }

  $settings = New-Object System.Xml.XmlWriterSettings
  $settings.Indent = $true
  $settings.Encoding = New-Object System.Text.UTF8Encoding($false)
  $settings.NewLineChars = "`r`n"
  $settings.NewLineHandling = 'Replace'

  $writer = [System.Xml.XmlWriter]::Create($OutputPath, $settings)
  try {
    $document.Save($writer)
  } finally {
    $writer.Dispose()
  }
}

$script:WixNamespace = 'http://schemas.microsoft.com/wix/2006/wi'
$script:XmlNamespaceManager = New-Object System.Xml.XmlNamespaceManager((New-Object System.Xml.NameTable))
$script:XmlNamespaceManager.AddNamespace('wix', $script:WixNamespace)

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$packageJsonPath = Join-Path $repoRoot 'package.json'
$wixProvisionScriptPath = Join-Path $repoRoot 'scripts\provision-wix.ps1'
$wixSourcePath = Join-Path $repoRoot 'tools\wix\Product.wxs'
$wixToolRoot = Join-Path $repoRoot 'tools\wix314-binaries'
$nssmSourcePath = Join-Path $repoRoot 'tools\nssm\win64\nssm.exe'

if (-not (Test-Path $packageJsonPath)) {
  throw "package.json not found: $packageJsonPath"
}

if (-not (Test-Path $wixSourcePath)) {
  throw "WiX source not found: $wixSourcePath"
}

if (-not (Test-Path $wixProvisionScriptPath)) {
  throw "WiX provisioning script not found: $wixProvisionScriptPath"
}

Write-Host "Ensuring WiX tool cache in $wixToolRoot"
& $wixProvisionScriptPath

foreach ($toolName in 'candle.exe', 'light.exe') {
  $toolPath = Join-Path $wixToolRoot $toolName
  if (-not (Test-Path $toolPath)) {
    throw "WiX tool not found: $toolPath"
  }
}

if (-not (Test-Path $nssmSourcePath)) {
  throw "nssm.exe not found for MSI packaging: $nssmSourcePath"
}

$packageJson = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
$packageVersion = if ($Version) { $Version } else { [string]$packageJson.version }
$semVerCore = Get-SemVerCore -InputVersion $packageVersion
$productVersion = $semVerCore.WixVersion

$buildRoot = Join-Path $repoRoot 'build\msi'
$stageRoot = Join-Path $buildRoot 'stage'
$objRoot = Join-Path $buildRoot 'obj'
$distRoot = Join-Path $repoRoot 'dist\msi'
$appFilesWxs = Join-Path $buildRoot 'AppFiles.wxs'
$msiName = "OnlyGantt-$productVersion-x64.msi"
$msiOutputPath = Join-Path $distRoot $msiName

if (Test-Path $buildRoot) {
  Remove-Item -Path $buildRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stageRoot, $objRoot, $distRoot | Out-Null

$stageTargets = @(
  @{ Source = 'package.json'; Destination = 'package.json' },
  @{ Source = 'README.md'; Destination = 'README.md' },
  @{ Source = 'LICENSE'; Destination = 'LICENSE' },
  @{ Source = 'public'; Destination = 'public' },
  @{ Source = 'server'; Destination = 'server' },
  @{ Source = 'src'; Destination = 'src' },
  @{ Source = 'node_modules'; Destination = 'node_modules' },
  @{ Source = 'scripts\install-service.ps1'; Destination = 'scripts\install-service.ps1' },
  @{ Source = 'scripts\uninstall-service.ps1'; Destination = 'scripts\uninstall-service.ps1' }
)

foreach ($target in $stageTargets) {
  Copy-RepoItem -SourcePath (Join-Path $repoRoot $target.Source) -DestinationPath (Join-Path $stageRoot $target.Destination)
}

Write-AppFilesFragment -StageRoot $stageRoot -OutputPath $appFilesWxs

$candlePath = Join-Path $wixToolRoot 'candle.exe'
$lightPath = Join-Path $wixToolRoot 'light.exe'
$wixObjectFiles = @(
  Join-Path $objRoot 'Product.wixobj'
  Join-Path $objRoot 'AppFiles.wixobj'
)

$candleArguments = @(
  '-nologo'
  '-arch', 'x64'
  '-out', "$objRoot\"
  "-dProductVersion=$productVersion"
  "-dSourceDir=$stageRoot"
  "-dNssmSource=$nssmSourcePath"
  $wixSourcePath
  $appFilesWxs
)

& $candlePath @candleArguments
if ($LASTEXITCODE -ne 0) {
  throw "candle.exe failed with exit code $LASTEXITCODE"
}

$lightArguments = @(
  '-nologo'
  '-sice:ICE61'
  '-out', $msiOutputPath
  $wixObjectFiles
)

& $lightPath @lightArguments
if ($LASTEXITCODE -ne 0) {
  throw "light.exe failed with exit code $LASTEXITCODE"
}

Write-Host "MSI created: $msiOutputPath"

if (-not $KeepBuildArtifacts) {
  Remove-Item -Path $stageRoot, $objRoot -Recurse -Force
  Write-Host "Temporary build artifacts removed from $buildRoot"
}
