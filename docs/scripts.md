# Script reference

All supported operational entrypoints are exposed through `package.json` npm scripts. The PowerShell files under `scripts/` are implementation details or specialist entrypoints for Windows service and MSI validation.

## Canonical commands

| npm command | Script | Behavior |
| --- | --- | --- |
| `npm run bootstrap` | `scripts/bootstrap.ps1` | Runs `npm ci`. |
| `npm run doctor` | `scripts/doctor.ps1` | Checks Node.js >= 18, npm, required runtime files, brand icon, WiX source, NSSM x64 and `node_modules`. |
| `npm run compile` | `scripts/compile.ps1` | Builds `artifacts/build/client/app.bundle.js` and writes `artifacts/build/runtime-manifest.json`. |
| `npm run build` | `scripts/build.ps1` | Runs `doctor` and `compile`. |
| `npm run test` | `scripts/test.ps1` | Runs the canonical regression checks and writes `artifacts/test-results/summary.json`. |
| `npm run pack` | `scripts/pack.ps1` | Runs `build`, then creates the x64 MSI through `scripts/packaging/build-msi.ps1`. |
| `npm run publish` | `scripts/publish.ps1` | Copies existing files from `artifacts/packages/` to `artifacts/publish/local/` and writes a local publish manifest. |
| `npm run clean` | `scripts/clean.ps1` | Cleans managed artifacts, stale local output roots and runtime-only data files. |

## Runtime commands

| npm command | Behavior |
| --- | --- |
| `npm start` | Runs `prestart` (`scripts/compile.ps1`) and starts `src/server/server.js`. |
| `npm run service:install` | Installs the Windows service with NSSM. Requires administrator privileges. |
| `npm run service:uninstall` | Removes the Windows service. Requires administrator privileges. |
| `npm run service:start` | Starts `OnlyGanttWeb`. |
| `npm run service:stop` | Stops `OnlyGanttWeb`. |
| `npm run service:cleanup` | Removes the service if present and deletes service log files. |

## Tests

`npm run test` executes:

- `tests/smoke-check.js`
- `tests/security-regression-check.js`
- `tests/admin-flow-regression-check.js`
- `tests/client-logic-regression-check.js`
- `tests/windows-service-lifecycle-check.ps1`

The Windows service lifecycle check skips explicitly when it cannot run in the current environment.

## MSI packaging

`npm run pack` creates `artifacts/packages/msi/OnlyGantt-<version>-x64.msi`.

Full MSI lifecycle validation can be requested with:

```powershell
npm run pack -- -RunMsiLifecycleValidation
```

or by setting:

```powershell
$env:ONLYGANTT_RUN_MSI_TESTS = 'true'
npm run pack
```

The lifecycle path runs:

- `scripts/packaging/msi-install-test.ps1 -Version <package version>`
- `scripts/packaging/msi-upgrade-test.ps1`
- `scripts/packaging/msi-uninstall-test.ps1 -Version <package version>`

The upgrade test intentionally builds and validates `1.0.0 -> 1.0.1` unless called with explicit parameters.

## Internal helpers

| Script | Responsibility |
| --- | --- |
| `scripts/helpers/common.ps1` | Shared PowerShell helpers for paths, command checks, artifact layout and UTF-8 writes. |
| `scripts/helpers/build-client-bundle.mjs` | `esbuild` client bundler invoked by `compile.ps1`. |
| `scripts/assets/generate-brand-assets.ps1` | Deterministic generation for versioned brand assets. |
| `scripts/packaging/common.ps1` | Shared MSI lifecycle helper functions. |
| `scripts/packaging/provision-wix.ps1` | Provisions WiX 3.14.1 into `tools/wix314-binaries/` when missing. |

## CI

No GitHub Actions or other CI workflow is versioned in this repository. The canonical CI-equivalent local sequence is:

```powershell
npm run bootstrap
npm run build
npm run test
npm run pack
```
