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

`npm start` esegue prima `prestart` con `scripts/compile.ps1` e poi avvia il server applicativo su `src/server/server.js`.

## Build e run

Il client React e' compilato localmente con `esbuild` in un bundle deterministico servito dal server Express da `artifacts/build/client/`.

`npm run compile` genera:

- `artifacts/build/client/app.bundle.js` come bundle client locale senza dipendenze runtime da CDN o Babel standalone;
- `artifacts/build/runtime-manifest.json` con gli entrypoint runtime, packaging e i test automatici supportati dal repository.

`npm run build` esegue `doctor` e `compile`.

`npm start` ricompila il bundle client e avvia l'applicazione. Per default il server espone `http://localhost:3000`.

## Test

`npm run test` esegue lo smoke test in [`tests/smoke-check.js`](/D:/GITHUB/OnlyGANTT/tests/smoke-check.js), il controllo di regressione sicurezza in [`tests/security-regression-check.js`](/D:/GITHUB/OnlyGANTT/tests/security-regression-check.js), il controllo dei flussi admin/locali in [`tests/admin-flow-regression-check.js`](/D:/GITHUB/OnlyGANTT/tests/admin-flow-regression-check.js), la regressione di logica client pura in [`tests/client-logic-regression-check.js`](/D:/GITHUB/OnlyGANTT/tests/client-logic-regression-check.js), la validazione lifecycle del servizio Windows in [`tests/windows-service-lifecycle-check.ps1`](/D:/GITHUB/OnlyGANTT/tests/windows-service-lifecycle-check.ps1) e salva report in `artifacts/test-results/`.

Lo smoke test verifica almeno:

- presenza del bundle client locale servito su `/assets/app.bundle.js`;
- assenza di dipendenze runtime da `unpkg.com` o Babel standalone nella landing page;
- bootstrap del server su una cartella dati temporanea;
- login admin;
- acquire/release dei lock;
- logout;
- migrazione della password reparto legacy.

Il controllo di regressione sicurezza verifica almeno:

- mancata esposizione della bind password LDAP in `/api/admin/system-config`;
- mancata inclusione della bind password LDAP negli export impostazioni;
- persistenza della bind password LDAP solo nel sidecar locale ignorato `Data/config/system-config.local.json`;
- coerenza del backup completo legacy (`/api/admin/server-backup` e `/api/admin/server-restore`) anche sul ripristino impostazioni;
- migrazione automatica degli hash legacy degli utenti locali dopo login riuscito.

Il controllo flussi admin/locali verifica almeno:

- login admin;
- lifecycle utente locale via API admin (create, list, delete, restore via import modulare);
- login locale standard;
- fallback locale quando LDAP e' attivo ma non raggiungibile;
- reset e cambio password reparto;
- import/export modulare del modulo utenti.

Nel pannello admin `Impostazioni di sistema` sono esposti sia il backup modulare consigliato sia il flusso `Compatibilita' legacy` per export/import completi storici lato server.

Il controllo logica client verifica almeno:

- calendario festivi e Pasqua/Pasquetta;
- parsing e confronto date;
- normalizzazione e sanificazione progetti e fasi;
- percentuali e alert di ritardo;
- layout e hit-test Gantt puri senza browser;
- assenza di dialog nativi browser (`alert`, `confirm`, `prompt`) nei sorgenti client.

La validazione lifecycle del servizio Windows verifica almeno:

- cleanup preventiva del servizio di test;
- installazione tramite [`scripts/windows/install-service.ps1`](/D:/GITHUB/OnlyGANTT/scripts/windows/install-service.ps1);
- start/stop tramite wrapper dedicati;
- raggiungibilita' dell'endpoint applicativo;
- uninstall e cleanup finale senza residui.

Quando il contesto non consente la prova reale, il controllo esce in skip esplicito invece di simulare l'esecuzione.

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
- rimuove eventuali sottocartelle extra sotto `artifacts/` lasciate da test o tooling locale;
- esegue la cleanup del servizio Windows `OnlyGanttWeb` se presente;
- rimuove eventuali output legacy in `build/`, `dist/`, `out/`, `publish/`, `tmp/`;
- elimina i file runtime locali non versionabili come `Data/config/locks.json`, `Data/config/admin-auth.json`, `Data/config/system-config.local.json`, gli store utenti locali in `Data/utenti/*.json` e i log in `Data/log/`.

## Struttura essenziale

```text
/
├── artifacts/
├── scripts/
├── tests/
├── tools/
├── src/
├── Data/
├── PROJECT_SPEC.md
├── PROJECT_STATUS.json
└── AGENTS.md
```

Note di layout:

- `scripts/` contiene gli entrypoint canonici e le sottocartelle `helpers/`, `packaging/`, `windows/`.
- `artifacts/` e' l'unica root prevista per output persistenti locali e CI.
- `artifacts/build/client/` contiene il bundle client locale generato da `compile`, `build`, `test` e `prestart`.
- `src/server/` contiene il backend Express e i servizi di runtime.
- `src/public/` contiene la shell statica HTML/CSS servita dal backend.
- `src/client/` contiene il codice React browser compilato nel bundle locale.

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

`Data/` contiene oggi sia seed versionati sia file runtime locali. I residui locali come lock, log, file `.bak`, `.tmp`, store legacy migrati e store utenti locali `Data/utenti/*.json` non fanno parte del seed sorgente, sono ignorati da Git quando pertinente e vengono rimossi da `npm run clean`.

La bind password LDAP non viene piu' salvata nel seed versionato `Data/config/system-config.json`: quando impostata via pannello admin viene persistita solo nel sidecar locale ignorato `Data/config/system-config.local.json`.

## Licenza

Il repository include il file `LICENSE`. Verificare la policy di distribuzione effettiva prima di pubblicare artefatti.
