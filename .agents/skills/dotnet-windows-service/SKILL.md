---
name: dotnet-windows-service
description: Development, single-file compilation, and Windows service lifecycle management for the .NET 10 host using official Microsoft documentation standards.
---

# .NET 10 Windows Service Skill

This skill provides guidelines and official technical references for developing, compiling, and managing the native Windows Service host (`OnlyGantt.Service`) in the OnlyGANTT repository.

## Official Microsoft References

- **Microsoft Learn: Windows Services in .NET**: [Create Windows Services using BackgroundService](https://learn.microsoft.com/en-us/dotnet/core/extensions/windows-service)
- **Microsoft Learn: Single-File Application Deployment**: [Single-file deployment and executable](https://learn.microsoft.com/en-us/dotnet/core/deploying/single-file)
- **Microsoft Learn: System.ServiceProcess**: [ServiceController Class](https://learn.microsoft.com/en-us/dotnet/api/system.serviceprocess.servicecontroller)

---

## Project Service Configuration (`src/service/OnlyGantt.Service/OnlyGantt.Service.csproj`)

The service host is configured with the following properties:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0-windows</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <SelfContained>true</SelfContained>
    <PublishSingleFile>true</PublishSingleFile>
    <EnableCompressionInSingleFile>false</EnableCompressionInSingleFile>
    <InvariantGlobalization>true</InvariantGlobalization>
    <AssemblyName>OnlyGantt.Service</AssemblyName>
    <RootNamespace>OnlyGantt.Service</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="System.ServiceProcess.ServiceController" Version="10.0.10" />
  </ItemGroup>
</Project>
```

---

## Architecture & Implementation Principles

1. **Host Integration**:
   - Host configuration utilizes `Host.CreateDefaultBuilder(args)` with `.UseWindowsService()` to seamlessly run both as an interactive CLI application and as a Windows Service.
2. **Background Execution**:
   - Long-running logic extends `BackgroundService`. The `ExecuteAsync(CancellationToken stoppingToken)` method controls execution lifecycle and responds gracefully to stop/shutdown signals.
3. **Single-File Publishing**:
   - Target RID: `win-x64`.
   - Publish flags: `PublishSingleFile=true`, `SelfContained=true`, `EnableCompressionInSingleFile=false`.
   - Ensures zero external .NET runtime dependency on target machines.

---

## Compilation Commands

To compile the service host binary explicitly via standard .NET CLI commands:

```powershell
dotnet publish src/service/OnlyGantt.Service/OnlyGantt.Service.csproj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true /p:EnableCompressionInSingleFile=false
```

To compile via official repository scripts:

```powershell
pwsh scripts/build-runtime.ps1
# or
npm run compile
```

Target Output Location: `artifacts/build/service/OnlyGantt.Service.exe`.

---

## Windows Service Operations (PowerShell / `sc.exe`)

### Standard Repository Management Script:
- **Install**: `npm run service:install`
- **Start**: `npm run service:start`
- **Stop**: `npm run service:stop`
- **Uninstall**: `npm run service:uninstall`
- **Cleanup**: `npm run service:cleanup`

### Native PowerShell Service Commands:
```powershell
# Create Service (requires Elevated Administrator prompt)
New-Service -Name "OnlyGanttService" -BinaryPathName "C:\Path\To\OnlyGantt.Service.exe" -DisplayName "OnlyGANTT Service Host" -StartupType Automatic

# Control Service
Start-Service -Name "OnlyGanttService"
Stop-Service -Name "OnlyGanttService"
Get-Service -Name "OnlyGanttService"

# Remove Service
Remove-Service -Name "OnlyGanttService"
```

---

## Testing & Lifecycle Verification

Validate service lifecycle using the automated script:
```powershell
pwsh scripts/support/test-windows-service-lifecycle.ps1
```
*(Note: Requires Windows Administrator elevation).*
