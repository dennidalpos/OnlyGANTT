---
name: onlygantt
description: Use this skill when developing, testing, packaging, or modifying the OnlyGANTT web application, Windows service, or WiX installer.
---

# OnlyGANTT Development Skill

This skill serves as the primary developer guide and runtime instructions for agents working on the [OnlyGANTT](file:///d:/GITHUB/OnlyGANTT) repository. It ensures that all modifications preserve architectural boundaries, follow security and credential protocols, maintain department lock integrity, and utilize official scripting pathways.

## Documentation Reference Map

- **Script Inventory**: Deep-dive on script names, execution purposes, and inputs in [script.md](file:///d:/GITHUB/OnlyGANTT/scripts/script.md).
- **Brand Assets**: Logos, colors, and asset generation rules in [brand-assets.md](file:///d:/GITHUB/OnlyGANTT/docs/brand-assets.md).

---

## Critical Development Rules

### 1. Windows-First Scope
- The repository targets Windows environments for development, testing, and service hosting.
- Ensure all paths use cross-platform APIs or PowerShell-compatible syntax. Do not write Unix-specific shell scripts or hardcode `/tmp` or `/home`.
- Administrator elevation is required only for Windows service installation/control and MSI validation.

### 2. Component Boundaries
- **[Client React UI](file:///d:/GITHUB/OnlyGANTT/src/client)**: React 19 application built via `esbuild`. The compiled bundle is outputted to `artifacts/build/client/app.bundle.js` and served by the Express server.
- **[Express Server](file:///d:/GITHUB/OnlyGANTT/src/server)**: Node.js web server serving the frontend, managing authentication, department authorization, LDAP bindings, and JSON file-based storage.
- **[OnlyGantt.Service](file:///d:/GITHUB/OnlyGANTT/src/service/OnlyGantt.Service)**: A C# .NET 10 (target framework `net10.0-windows`) Windows service host. It compiles to a single-file, self-contained executable.
- **[Installer Packaging](file:///d:/GITHUB/OnlyGANTT/tools/wix)**: WiX 3.14.1 based packaging that generates MSI installer and setup bootstrapper executable (bundling Node.js 24 LTS).

### 3. Data & Multi-User Locking
- **Department Files**: JSON project files are stored under `Data/reparti/<department_name>.json`.
- **Lock Management**: PERSISTED locks are maintained under `Data/config/locks.json`.
- **Lock Timeout**: Default lock timeout is 60 minutes.
- **Lock Operations**: Ensure all write operations verify lock ownership before modifying project files.

### 4. Authentication & Security
- **Local Fallback**: Local user sessions fallback to LDAP if enabled.
- **LDAP Configuration**: LDAP bind password and other sensitive sidecar settings should never be written to versioned system configurations. Keep them in ignored sidecar configs.
- **Admin Password Reset**: An administrative password reset flow can be enabled via `ONLYGANTT_ADMIN_RESET_CODE`.

---

## Workspace & CI Operations

Always run the official PowerShell scripts in the `scripts/` directory to manage build/test workflows. Do not run ad-hoc esbuild or dotnet commands unless wrapping them in a verified script structure.

### Recommended Development Flow:

1. **Restore dependencies**:
   ```powershell
   npm run bootstrap
   ```
2. **Validate environment constraints**:
   ```powershell
   npm run doctor
   ```
3. **Compile Browser Bundle & Service Host**:
   ```powershell
   npm run compile
   ```
4. **Build & Package (Bundles doctor and compile)**:
   ```powershell
   npm run build
   ```
5. **Run test suite**:
   ```powershell
   npm run test
   ```
6. **Preflight Quality Gate**:
   ```powershell
   npm run gate
   ```
7. **Build MSI Installer Packages**:
   ```powershell
   npm run pack
   ```

### Windows Service Management:
- **Install Service**: `npm run service:install`
- **Start Service**: `npm run service:start`
- **Stop Service**: `npm run service:stop`
- **Uninstall Service**: `npm run service:uninstall`
- **Clean Service Artifacts**: `npm run service:cleanup`

---

## Environment Variables Configuration

The server reads the following environment variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | Web application port | `3000` |
| `ONLYGANTT_DATA_DIR` | Custom data directory path | `Data` |
| `ONLYGANTT_ADMIN_USER` | Admin username | `admin` |
| `ONLYGANTT_ADMIN_PASSWORD` | Admin password | (Stored locally) |
| `ONLYGANTT_LOCK_TIMEOUT` | Lock timeout in minutes | `60` |
| `LDAP_ENABLED` | Toggle LDAP authentication | `false` |
