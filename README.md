# OnlyGANTT

OnlyGANTT e' un'applicazione web per la gestione di diagrammi di Gantt con accesso multi-utente, lock per reparto e packaging Windows opzionale tramite MSI.

## Requisiti

- Windows come ambiente operativo di riferimento.
- Node.js 18 o superiore.
- PowerShell.

## Setup

```powershell
npm run bootstrap
npm run doctor
```

## Comandi principali

```powershell
npm run bootstrap
npm run doctor
npm run compile
npm run build
npm run test
npm run pack
npm run publish
npm run clean
```

`npm start` avvia il server applicativo su `server/server.js`.

## Build e run

Il progetto non ha un build frontend separato: Express serve direttamente `public/` e `src/`.

`npm run compile` genera un manifest runtime deterministico in `artifacts/build/runtime-manifest.json`.

`npm run build` esegue `doctor` e `compile`.

`npm start` avvia l'applicazione. Per default il server espone `http://localhost:3000`.

## Test

`npm run test` esegue lo smoke test in [`tests/smoke-check.js`](/D:/GITHUB/OnlyGANTT/tests/smoke-check.js), il controllo di regressione sicurezza in [`tests/security-regression-check.js`](/D:/GITHUB/OnlyGANTT/tests/security-regression-check.js) e salva report in `artifacts/test-results/`.

Lo smoke test verifica almeno:

- bootstrap del server su una cartella dati temporanea;
- login admin;
- acquire/release dei lock;
- logout;
- migrazione della password reparto legacy.

Il controllo di regressione sicurezza verifica almeno:

- mancata esposizione della bind password LDAP in `/api/admin/system-config`;
- mancata inclusione della bind password LDAP negli export impostazioni;
- migrazione automatica degli hash legacy degli utenti locali dopo login riuscito.

## Packaging e publish

`npm run pack` produce l'MSI Windows in `artifacts/packages/msi/`.

Per includere anche la validazione completa del ciclo MSI nello stesso entrypoint canonico:

```powershell
npm run pack -- -RunMsiLifecycleValidation
```

In CI e negli ambienti automatizzati e' supportata anche la variabile `ONLYGANTT_RUN_MSI_TESTS=true`.

Il packaging usa:

- [`scripts/packaging/build-msi.ps1`](/D:/GITHUB/OnlyGANTT/scripts/packaging/build-msi.ps1)
- [`scripts/packaging/common.ps1`](/D:/GITHUB/OnlyGANTT/scripts/packaging/common.ps1)
- [`scripts/packaging/msi-install-test.ps1`](/D:/GITHUB/OnlyGANTT/scripts/packaging/msi-install-test.ps1)
- [`scripts/packaging/msi-upgrade-test.ps1`](/D:/GITHUB/OnlyGANTT/scripts/packaging/msi-upgrade-test.ps1)
- [`scripts/packaging/msi-uninstall-test.ps1`](/D:/GITHUB/OnlyGANTT/scripts/packaging/msi-uninstall-test.ps1)
- [`scripts/packaging/provision-wix.ps1`](/D:/GITHUB/OnlyGANTT/scripts/packaging/provision-wix.ps1)
- [`tools/wix/Product.wxs`](/D:/GITHUB/OnlyGANTT/tools/wix/Product.wxs)

La cache locale di WiX resta in `tools/wix314-binaries/` ed e' ignorata da Git.

`npm run publish` copia i pacchetti gia' prodotti in `artifacts/publish/local/` e genera un manifest di publish locale.

La validazione MSI eseguita tramite `scripts/pack.ps1 -RunMsiLifecycleValidation` richiama i test specialistici:

- `powershell -File scripts/packaging/msi-install-test.ps1`
- `powershell -File scripts/packaging/msi-upgrade-test.ps1`
- `powershell -File scripts/packaging/msi-uninstall-test.ps1`

## Servizi Windows

Gli script specialistici sono in `scripts/windows/`:

- `install-service.ps1`
- `uninstall-service.ps1`
- `start-service.ps1`
- `stop-service.ps1`
- `services-cleanup.ps1`

La gestione del servizio usa `tools/nssm/` come host del processo Node.js.

## Clean

`npm run clean`:

- svuota `artifacts/build`, `artifacts/test-results`, `artifacts/packages`, `artifacts/publish` e `artifacts/logs`;
- esegue la cleanup del servizio Windows `OnlyGanttWeb` se presente;
- rimuove eventuali output legacy in `build/`, `dist/`, `out/`, `publish/`, `tmp/`;
- elimina i file runtime locali non versionabili come `Data/config/locks.json`, `Data/config/admin-auth.json` e i log in `Data/log/`.

## Struttura essenziale

```text
/
├── artifacts/
├── scripts/
├── tests/
├── tools/
├── public/
├── server/
├── src/
├── Data/
├── PROJECT_SPEC.md
├── PROJECT_STATUS.json
└── AGENTS.md
```

Note di layout:

- `scripts/` contiene gli entrypoint canonici e le sottocartelle `helpers/`, `packaging/`, `windows/`.
- `artifacts/` e' l'unica root prevista per output persistenti locali e CI.
- `server/`, `public/` e `Data/` restano in root per compatibilita' con il runtime attuale; l'eventuale normalizzazione completa e' tracciata in `PROJECT_STATUS.json`.

## Configurazione

Variabili principali:

- `PORT`
- `ONLYGANTT_DATA_DIR`
- `ONLYGANTT_ENABLE_BAK`
- `ONLYGANTT_LOCK_TIMEOUT_MINUTES`
- `ONLYGANTT_USER_SESSION_TTL_HOURS`
- `ONLYGANTT_ADMIN_TTL_HOURS`
- `ONLYGANTT_MAX_UPLOAD_BYTES`
- `ONLYGANTT_ADMIN_USER`
- `ONLYGANTT_ADMIN_PASSWORD`
- `ONLYGANTT_ADMIN_RESET_CODE`
- `LDAP_*`
- `HTTPS_*`

Il file dati locale di riferimento e' `Data/`.

## Licenza

Il repository include il file `LICENSE`. Verificare la policy di distribuzione effettiva prima di pubblicare artefatti.
