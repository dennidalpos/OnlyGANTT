---
name: onlygantt
description: Primary skill for developing, testing, building, packaging, and maintaining the OnlyGANTT application stack (Node.js/Express, React 19, .NET 10 Windows Service, WiX MSI).
---

# OnlyGANTT Core Development Skill

This skill serves as the primary developer guide and runtime instructions for agents working on the [OnlyGANTT](file:///d:/GITHUB/OnlyGANTT) repository. It ensures that all modifications preserve architectural boundaries, follow security and credential protocols, maintain department lock integrity, and utilize official scripting pathways.

## Documentation Reference Map

- **Script Inventory**: Deep-dive on script names, execution purposes, and inputs in [script.md](file:///d:/GITHUB/OnlyGANTT/scripts/script.md).
- **Brand Assets**: Logos, colors, and asset generation rules in [brand-assets.md](file:///d:/GITHUB/OnlyGANTT/docs/brand-assets.md).
- **Component Skills**:
  - [.NET 10 Windows Service Host](file:///d:/GITHUB/OnlyGANTT/skills/dotnet-windows-service/SKILL.md)
  - [Express 5 & React 19 Web App](file:///d:/GITHUB/OnlyGANTT/skills/express-react-app/SKILL.md)
  - [WiX 3.14 MSI Installer & Bootstrapper](file:///d:/GITHUB/OnlyGANTT/skills/wix-installer/SKILL.md)

---

## Critical Development Rules

### 1. Windows-First Scope
- The repository targets Windows environments for development, testing, and service hosting.
- Ensure all paths use cross-platform APIs or PowerShell-compatible syntax. Do not write Unix-specific shell scripts or hardcode `/tmp` or `/home`.
- Administrator elevation is required only for native Windows service installation/control and MSI lifecycle validation.

### 2. Component Boundaries
- **[Client React UI](file:///d:/GITHUB/OnlyGANTT/src/client)**: React 19 application built via `esbuild`. The compiled bundle is outputted to `artifacts/build/client/app.bundle.js` and served by the Express server.
- **[Express Server](file:///d:/GITHUB/OnlyGANTT/src/server)**: Node.js web server serving the frontend, managing authentication, department authorization, LDAP bindings, and 100% SQLite database persistence (`node:sqlite`).
- **[OnlyGantt.Service](file:///d:/GITHUB/OnlyGANTT/src/service/OnlyGantt.Service)**: A C# .NET 10 (target framework `net10.0-windows`) Windows service host. It compiles to a single-file, self-contained executable.
- **[Installer Packaging](file:///d:/GITHUB/OnlyGANTT/tools/wix)**: WiX 3.14.1 based packaging that generates an MSI installer and setup bootstrapper executable (bundling Node.js 24 LTS).

### 3. Data & Multi-User Locking
- **SQLite Database Persistence**: All runtime persistence uses native Node.js `node:sqlite` (`DatabaseSync`):
  - **Departments**: `Data/reparti.db` (`departments` table).
  - **User Accounts**: `Data/users/users.db` (`users` table).
  - **Lock Management**: `Data/config/locks.db` (`locks` table).
- **Lock Timeout**: Default lock timeout is 60 minutes.
- **Lock Operations**: Ensure all write operations verify lock ownership before modifying project data.

### 4. Authentication & Security
- **Local Fallback**: Local user sessions fallback to LDAP if enabled.
- **Admin Management**: Admins have full access to view, edit, protect, and delete departments.
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

## Skill Synchronization & Multi-PC Workflow

To ensure consistent AI agent guidance across different development machines:
1. Master skill definitions are maintained under `skills/` in the project root.
2. Workspace-active skill definitions are synced to `.agents/skills/`.
3. Global machine skill definitions are synced to `~/.gemini/config/skills/`.
4. Whenever build scripts, environment variables, dependencies, or architectural patterns change, update all copies of the skill files in `skills/`, `.agents/skills/`, and `~/.gemini/config/skills/`.
