---
name: wix-installer
description: Windows MSI installer and Setup Bootstrapper packaging with WiX Toolset 3.14 using official WiX Toolset documentation and repository build pipelines.
---

# WiX 3.14 Installer & Setup Bootstrapper Skill

This skill provides authoring guidelines, technical references, and build instructions for the WiX 3.14 installer and bootstrapper setup in the OnlyGANTT repository.

## Official WiX Toolset References

- **WiX Toolset v3 Manual**: [WiX Toolset v3 Documentation (FireGiant)](https://wixtoolset.org/docs/v3/)
- **WiX Standard Bootstrapper**: [wixstdba - WiX Standard Bootstrapper Application](https://wixtoolset.org/docs/v3/wixstdba/)
- **Windows Installer XML Schema**: [Wix Element Reference](https://wixtoolset.org/docs/v3/xsd/wix/)

---

## Repository WiX Source Files (`tools/wix/`)

### 1. `Product.wxs` (Main MSI Installer Definition)
- **Target Platform**: `x64`.
- **Product & Package Elements**: Configures Product Code, Upgrade Code, Manufacturer (`OnlyGANTT`), Version, and Installation Scope (`perMachine`).
- **Directory Structure**: Maps `ProgramFiles64Folder`, installation directory (`OnlyGANTT`), subdirectories for server, client, service, node_modules, and data templates.
- **Service Installation**: Utilizes `<ServiceInstall>` and `<ServiceControl>` to install, configure auto-start, start on install, and stop/delete on uninstall for `OnlyGanttService`.
- **Registry & Shortcuts**: Configures environment variables, program group shortcuts, and registry keys for uninstall management.

### 2. `Bundle.wxs` (Burn Setup Bootstrapper Manifest)
- **Bootstrapper UI**: `WixStandardBootstrapperApplication.RtfLicense` (`wixstdba`).
- **Chained Package Pipeline (`<Chain>`)**:
  1. **Node.js Prerequisite Package**: `<MsiPackage>` targeting official Node.js 24 LTS x64 MSI installer (`node-v24.15.0-x64.msi`).
  2. **Application Package**: `<MsiPackage>` targeting the main `OnlyGantt.msi` installer.

---

## Toolset Binaries & Cache Management

- **WiX Tools Directory**: `tools/wix314-binaries/`
- **Provisioning Script**: `scripts/support/packaging/provision-wix.ps1`
- **Node.js Prerequisite Provisioning**: `scripts/support/packaging/provision-node.ps1`
- **Core Binaries**:
  - `candle.exe`: WiX Compiler (compiles `.wxs` to `.wixobj`).
  - `light.exe`: WiX Linker (links `.wixobj` to `.msi` or `.exe`).
  - `insignia.exe`: Inscribes digital signatures and bootstrapper payloads.

---

## Packaging Commands & Output Paths

### Build Packages via Repository Command:
```powershell
pwsh scripts/package-project.ps1
# or
npm run pack
```

### Generated Output Artifacts:
- **MSI Installer**: `artifacts/packages/OnlyGantt-1.0.1-x64.msi`
- **Setup Executable**: `artifacts/packages/OnlyGantt-Setup-1.0.1.exe`
- **Manifest**: `artifacts/packages/package-manifest.json`

---

## Elevated MSI Lifecycle Testing

Validate installer functionality using elevated lifecycle scripts:

```powershell
# Silent Install Validation
pwsh scripts/support/packaging/test-msi-install.ps1

# Upgrade Validation
pwsh scripts/support/packaging/test-msi-upgrade.ps1

# Silent Uninstall & Cleanup Validation
pwsh scripts/support/packaging/test-msi-uninstall.ps1
```
*(Note: Requires Windows Administrator elevation).*
