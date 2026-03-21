# Project Specification

## Goal
Fornire un'applicazione web per la pianificazione e gestione di diagrammi di Gantt con accesso multi-utente, autenticazione amministrativa e lock concorrente dei dati per reparto.

## Scope
- Server Node.js/Express che espone API REST per reparti, progetti, lock, utenti e configurazione di sistema.
- Frontend React compilato localmente con `esbuild` in un bundle browser servito dal server Express insieme alla shell statica in `src/public/`.
- Persistenza file-based nella cartella `Data/` per seed versionati e file runtime locali di reparti, utenti, lock, configurazione e log applicativi.
- Autenticazione admin locale e supporto autenticazione LDAP con provisioning utenti.
- Packaging Windows tramite MSI e gestione opzionale del servizio Windows.

## Non Scope
- Database relazionali o NoSQL.
- Pipeline frontend complesse o dipendenti da CDN esterni a runtime.
- Packaging desktop non-Windows.
- Gestione multi-tenant oltre al modello per reparto.

## Architecture
- `src/server/`: backend Express e servizi di supporto.
- `src/public/`: shell HTML e CSS statici.
- `src/client/`: sorgenti React browser compilati localmente nel bundle.
- `src/utils/` e `src/app-config.js`: utility e configurazione condivise dal runtime client.
- `Data/`: seed versionati per demo/configurazione minima e runtime filesystem locale per reparti, utenti e configurazione.
- `tests/`: smoke test runtime, controllo di regressione sicurezza, controllo dei flussi admin/locali, regressioni pure delle utility client e validazione lifecycle del servizio Windows quando eseguibile.
- `scripts/`: wrapper PowerShell canonici (`bootstrap`, `doctor`, `compile`, `build`, `test`, `pack`, `publish`, `clean`) e sottocartelle `helpers/`, `packaging/`, `windows/`.
- `artifacts/`: root unica degli output persistenti locali e CI.
- `tools/wix/`: sorgenti WiX per l'installer MSI.
- `tools/nssm/`: binari NSSM usati come fallback/host di servizio per il processo Node.js.

## Expected Behavior
- L'app si avvia tramite `src/server/server.js`, serve `src/public/` e il bundle client compilato in `artifacts/build/client/`.
- I dati reparto sono protetti da lock con persistenza su filesystem.
- Le credenziali admin non hanno default hardcoded insicuri.
- I flussi utente/admin che richiedono conferme o input contestuali devono usare dialog o form gestiti dalla UI React, non dialog nativi bloccanti del browser.
- Gli entrypoint operativi canonici sono esposti in `scripts/` e richiamabili in modo uniforme anche da `npm run`.
- Gli output di compile, test, pack e publish sono confinati sotto `artifacts/`.
- I residui runtime locali sotto `Data/` come lock, file `.bak`, `.tmp` e store legacy migrati non fanno parte del seed versionato e devono essere rimossi da `clean`.
- Gli store utenti locali sotto `Data/utenti/*.json` sono dati runtime locali e non fanno parte del seed versionato del repository.
- I secret LDAP persistiti localmente non devono essere versionati: `system-config.json` resta un seed senza bind password e l'eventuale secret runtime vive solo nel sidecar locale ignorato.

## Constraints
- Ambiente operativo di riferimento Windows.
- Node.js `>=18.0.0`.
- Build client locale deterministica con `esbuild`, senza dipendenze runtime da CDN o Babel standalone.
- Packaging MSI x64 basato su WiX 3.14.1 con `UpgradeCode` stabile.
- Toolchain WiX locale in `tools/wix314-binaries/`, non versionata.
- Gestione servizio Windows tramite script dedicati in `scripts/windows/`, con NSSM come host del processo Node.js.
- Persistenza locale su filesystem; nessun database esterno definito dal repository.
