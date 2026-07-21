Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$wixSourcePath = Join-Path $repoRoot 'tools\wix\Product.wxs'

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

Assert-True -Condition (Test-Path $wixSourcePath) -Message "WiX source not found: $wixSourcePath"

[xml]$document = Get-Content $wixSourcePath -Raw
$namespaceManager = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
$namespaceManager.AddNamespace('wix', 'http://schemas.microsoft.com/wix/2006/wi')
$namespaceManager.AddNamespace('util', 'http://schemas.microsoft.com/wix/UtilExtension')

$adminShortcutProperty = $document.SelectSingleNode('//wix:Property[@Id="CREATEADMINSHORTCUT"]', $namespaceManager)
Assert-True -Condition ($null -ne $adminShortcutProperty) -Message 'CREATEADMINSHORTCUT property is missing.'
Assert-True -Condition ($adminShortcutProperty.Value -eq '1') -Message 'CREATEADMINSHORTCUT should default to enabled.'

$adminShortcutCheckBox = $document.SelectSingleNode('//wix:Control[@Id="AdminShortcutCheckBox"]', $namespaceManager)
Assert-True -Condition ($null -ne $adminShortcutCheckBox) -Message 'Admin desktop shortcut checkbox is missing from the configuration dialog.'
Assert-True -Condition ($adminShortcutCheckBox.Property -eq 'CREATEADMINSHORTCUT') -Message 'Admin desktop shortcut checkbox should control CREATEADMINSHORTCUT.'

$adminComponentRef = $document.SelectSingleNode('//wix:Feature[@Id="MainFeature"]/wix:ComponentRef[@Id="CmpAdminDesktopShortcut"]', $namespaceManager)
Assert-True -Condition ($null -ne $adminComponentRef) -Message 'MainFeature should include CmpAdminDesktopShortcut.'

$adminShortcutComponent = $document.SelectSingleNode('//wix:Component[@Id="CmpAdminDesktopShortcut"]', $namespaceManager)
Assert-True -Condition ($null -ne $adminShortcutComponent) -Message 'CmpAdminDesktopShortcut component is missing.'

$adminShortcutCondition = $adminShortcutComponent.SelectSingleNode('wix:Condition', $namespaceManager)
Assert-True -Condition ($null -ne $adminShortcutCondition) -Message 'CmpAdminDesktopShortcut should be conditional.'
Assert-True -Condition ($adminShortcutCondition.InnerText.Trim() -eq 'CREATEADMINSHORTCUT = "1"') -Message 'CmpAdminDesktopShortcut should be controlled by CREATEADMINSHORTCUT.'

$mainShortcutComponent = $document.SelectSingleNode('//wix:Component[@Id="CmpDesktopShortcut"]', $namespaceManager)
Assert-True -Condition ($null -ne $mainShortcutComponent) -Message 'CmpDesktopShortcut component is missing.'

$mainUrl = $mainShortcutComponent.SelectSingleNode('util:InternetShortcut[@Id="DesktopShortcutUrl"]', $namespaceManager)
Assert-True -Condition ($null -ne $mainUrl) -Message 'Main desktop URL shortcut should use util:InternetShortcut.'
Assert-True -Condition ($mainUrl.Directory -eq 'DesktopFolder') -Message 'Main shortcut should target DesktopFolder.'
Assert-True -Condition ($mainUrl.Name -eq 'OnlyGANTT') -Message 'Main shortcut display name should be OnlyGANTT.'
Assert-True -Condition ($mainUrl.Target -eq '[SHORTCUTURL]') -Message 'Main shortcut should open the configured URL.'
Assert-True -Condition ($mainUrl.Type -eq 'url') -Message 'Main shortcut should create a URL shortcut.'

$adminUrl = $adminShortcutComponent.SelectSingleNode('util:InternetShortcut[@Id="AdminDesktopShortcutUrl"]', $namespaceManager)
Assert-True -Condition ($null -ne $adminUrl) -Message 'Admin desktop URL shortcut should use util:InternetShortcut.'
Assert-True -Condition ($adminUrl.Directory -eq 'DesktopFolder') -Message 'Admin shortcut should target DesktopFolder.'
Assert-True -Condition ($adminUrl.Name -eq 'OnlyGANTT Admin') -Message 'Admin shortcut display name should be OnlyGANTT Admin.'
Assert-True -Condition ($adminUrl.Target -eq '[SHORTCUTURL]#admin') -Message 'Admin shortcut should open the admin login deep link.'
Assert-True -Condition ($adminUrl.Type -eq 'url') -Message 'Admin shortcut should create a URL shortcut.'

$adminRemoveFile = $adminShortcutComponent.SelectSingleNode('wix:RemoveFile[@Id="RemoveAdminDesktopShortcut"]', $namespaceManager)
Assert-True -Condition ($null -ne $adminRemoveFile) -Message 'Admin desktop shortcut should be removed on uninstall.'
Assert-True -Condition ($adminRemoveFile.Name -eq 'OnlyGANTT Admin.url') -Message 'Admin shortcut remove entry should target OnlyGANTT Admin.url.'

$majorUpgrade = $document.SelectSingleNode('//wix:MajorUpgrade', $namespaceManager)
Assert-True -Condition ($null -ne $majorUpgrade) -Message 'MajorUpgrade element is missing.'
Assert-True -Condition ($majorUpgrade.Schedule -eq 'afterInstallInitialize') -Message 'MajorUpgrade should set Schedule="afterInstallInitialize".'

$wixBundlePath = Join-Path $repoRoot 'tools\wix\Bundle.wxs'
Assert-True -Condition (Test-Path $wixBundlePath) -Message "WiX bundle source not found: $wixBundlePath"

[xml]$bundleDoc = Get-Content $wixBundlePath -Raw
$bundleNsManager = [System.Xml.XmlNamespaceManager]::new($bundleDoc.NameTable)
$bundleNsManager.AddNamespace('wix', 'http://schemas.microsoft.com/wix/2006/wi')

$bundleElement = $bundleDoc.SelectSingleNode('//wix:Bundle', $bundleNsManager)
Assert-True -Condition ($null -ne $bundleElement) -Message 'Bundle element is missing.'
Assert-True -Condition ($bundleElement.Name -eq 'OnlyGANTT') -Message 'Bundle Name should be OnlyGANTT.'

$onlyGanttMsiPackage = $bundleDoc.SelectSingleNode('//wix:MsiPackage[@Id="OnlyGanttMsi"]', $bundleNsManager)
Assert-True -Condition ($null -ne $onlyGanttMsiPackage) -Message 'OnlyGanttMsi MsiPackage is missing from Bundle.wxs.'
Assert-True -Condition ($onlyGanttMsiPackage.Visible -eq 'no') -Message 'OnlyGanttMsi should set Visible="no" to hide the MSI package from ARP and prevent duplicate entries.'

Assert-True -Condition ($bundleElement.GetAttribute('DisableRemove') -ne 'yes') -Message 'Bundle should not set DisableRemove="yes" so the setup bootstrapper is the sole active ARP entry.'

Write-Host 'Installer source regression check passed'
