# OnlyGANTT

![OnlyGANTT logo](src/public/brand/onlygantt-logo.svg)

Windows-hosted project scheduling for departments. A Node.js/Express server serves a React browser interface, stores project/user/lock state in SQLite, and can be hosted by an optional Windows service.

## Workflows

- Create departments and manage projects, phases, milestones, progress and calendar alerts.
- Authenticate local users or configure LDAP, with the configured local fallback policy.
- Protect departments with passwords and serialize editing with persisted locks.
- Import/export project JSON and manage server settings from the administrator interface.
- Bundle the browser UI locally with esbuild; build the native service host with .NET.

The interface and domain labels use Italian. Source checks and packaging scripts do not qualify an installation on a new machine.

## Requirements and quick start

Use Windows, PowerShell 7+ (`pwsh`), npm and a .NET SDK capable of building [the service project](src/service/OnlyGantt.Service/OnlyGantt.Service.csproj). Packaging also requires NSIS (`makensis.exe`). Service and installer operations require administrator privileges.

The server requires a Node.js runtime providing `node:sqlite`. The current manifest and prerequisite helper accept Node 20 too broadly; do not rely on that check alone. Verify the actual runtime before installing dependencies:

```powershell
node --version
node -e "require('node:sqlite')"
npm run bootstrap
npm run doctor
npm run build
npm run test
```

`bootstrap` runs `npm ci` and replaces the installed dependency tree. Run it in a fresh checkout or after reviewing local dependency changes. `doctor` checks tools and inputs and writes a local report; it does not start the web app or prove an installer works.

```powershell
npm start
```

`prestart` builds the browser bundle and service host before starting the server. The default URL is `http://localhost:3000`; the default mutable data root is `Data/`. Choose a dedicated data directory for tests and demonstrations. Do not start a second process against production data.

## Configuration

| Setting | Purpose |
| --- | --- |
| `PORT` | Listener port; default `3000`. |
| `ONLYGANTT_DATA_DIR` or `DATA_DIR` | Data root; default `Data/` relative to the application root. |
| `ONLYGANTT_ADMIN_USER`, `ONLYGANTT_ADMIN_PASSWORD`, `ONLYGANTT_ADMIN_RESET_CODE` | Administrator identity/password and optional reset flow. Supply real values through local configuration, never Git. |
| `ONLYGANTT_LOCK_TIMEOUT_MINUTES` | Editing-lock timeout; default `60`. |
| `ONLYGANTT_USER_SESSION_TTL_HOURS`, `ONLYGANTT_ADMIN_TTL_HOURS` | Session lifetimes; default `8` hours. |
| `ONLYGANTT_MAX_UPLOAD_BYTES` | JSON upload limit; default `2000000`. |
| `ONLYGANTT_ENABLE_BAK` | Backup-file writes; enabled by default. |
| `LDAP_ENABLED`, `LOG_LDAP`, `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`, `LDAP_USER_FILTER`, `LDAP_REQUIRED_GROUP`, `LDAP_GROUP_SEARCH_BASE`, `LDAP_LOCAL_FALLBACK` | Optional directory authentication settings. |
| `HTTPS_ENABLED`, `HTTPS_KEY_PATH`, `HTTPS_CERT_PATH` | Optional TLS listener and local key/certificate paths. |

[configService.js](src/server/services/configService.js) defines defaults and paths. Versioned seeds are in `Data/config/`; secrets and runtime databases belong in reviewed local storage. Department project endpoints require an active authorized session; password-protected departments also require department verification.

## Commands and verification

| Command | Effect |
| --- | --- |
| `npm run compile` | Build the browser bundle and publish the self-contained Windows service host. |
| `npm run build` | Run `doctor`, then `compile`. |
| `npm run test` | Build and run the canonical smoke, authorization, admin-flow, client, prerequisite and installer-source regressions. May also invoke service lifecycle validation; inspect elevation and side effects first. |
| `npm run pack` | Build and invoke NSIS for `artifacts/packages/OnlyGANTT-Setup-x64.exe`. |
| `npm run publish` | Copy existing package files into local `artifacts/publish/local/`; does not upload to GitHub. |
| `npm run gate` | Run preflight, tests and packaging. |
| `npm run service:install`, `service:start`, `service:stop`, `service:uninstall` | Manage the machine's `OnlyGanttWeb` service. Use only for an explicitly selected installation. |
| `npm run clean` | Remove selected generated/runtime outputs; review the script and recovery before using it. |

Outputs are normally relative to the checkout under `artifacts/` and service `bin/obj` folders. Use an isolated checkout and data/profile roots for verification; changing a cache variable alone does not relocate all outputs. No cleanup, service installation or package installation is necessary for a documentation-only check.

There are no npm lint/typecheck scripts or versioned GitHub Actions workflow in this checkout. See [the script inventory](scripts/script.md) for the actual entrypoints.

## Packaging and current limits

The current [NSIS source](tools/nsis/installer.nsi) creates an x64 setup EXE, copies the server, browser bundle, dependencies and service host, registers the service, and writes desktop URL shortcuts. The maintained packaging path does **not** build a WiX MSI or bundle a Node.js prerequisite. The old WiX-era instructions do not describe this source revision.

Installer qualification is still needed: the service EXE is copied into a `service/` subdirectory, while its default application root is its executable directory and NSIS does not pass `--app-dir`. Review and correct that contract before claiming a successful fresh installation. The `-RunInstallerLifecycleValidation` switch is declared by `package-project.ps1` but is not consumed by its current body; supplying it is not evidence that a lifecycle test ran. Machine-wide Node provisioning and service startup must be verified separately.

## Troubleshooting

- A missing `node:sqlite` import means the selected Node runtime is unsuitable even if the current preflight accepts its version.
- Missing dependencies: review the lockfile and run `npm run bootstrap` in the intended checkout.
- Missing `dotnet`: install/select the SDK required by the service project before build/test.
- Missing `makensis`: install/select NSIS before packaging.
- Busy port: select a free `PORT` for your own test instance; do not terminate an unrelated process.
- Service start failure: inspect the configured executable, `--app-dir`, Node path and data root before reinstalling anything.

## Help and license

Use [GitHub Issues](https://github.com/dennidalpos/OnlyGANTT/issues) for reproducible problems with sanitized diagnostics. Follow [SECURITY.md](SECURITY.md) for vulnerability reports. [Brand assets](docs/brand-assets.md) describes the checked-in artwork and current consumers.

Proprietary software, all rights reserved. See [LICENSE](LICENSE) and [CREDITS.md](CREDITS.md) for third-party components.