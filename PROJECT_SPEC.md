# Project Specification

## Goal
Fornire un'applicazione web per la pianificazione e gestione di diagrammi di Gantt con accesso multi-utente, autenticazione amministrativa e lock concorrente dei dati per reparto.

## Scope
- Server Node.js/Express che espone API REST per reparti, progetti, lock, utenti e configurazione di sistema.
- Frontend React servito come UI statica dal server Express senza build step dedicato.
- Persistenza file-based nella cartella `Data/` per reparti, utenti, lock, configurazione e log applicativi.
- Autenticazione admin locale e supporto autenticazione LDAP con provisioning utenti.
- Packaging Windows tramite MSI e gestione opzionale del servizio Windows.

## Non Scope
- Database relazionali o NoSQL.
- Build frontend con bundler o pipeline dedicate.
- Packaging desktop non-Windows.
- Gestione multi-tenant oltre al modello per reparto.

## Architecture
- `server/`: backend Express e servizi di supporto.
- `public/`: shell HTML e CSS statici.
- `src/`: componenti client, hook e utility caricati nel browser.
- `Data/`: seed e runtime filesystem per reparti, utenti e configurazione locale.
- `tests/`: smoke test automatico del runtime.
- `scripts/`: wrapper PowerShell canonici (`bootstrap`, `doctor`, `compile`, `build`, `test`, `pack`, `publish`, `clean`) e sottocartelle `helpers/`, `packaging/`, `windows/`.
- `artifacts/`: root unica degli output persistenti locali e CI.
- `tools/wix/`: sorgenti WiX per l'installer MSI.
- `tools/nssm/`: binari NSSM usati come fallback/host di servizio per il processo Node.js.

## Expected Behavior
- L'app si avvia tramite `server/server.js` e serve `public/` e `src/`.
- I dati reparto sono protetti da lock con persistenza su filesystem.
- Le credenziali admin non hanno default hardcoded insicuri.
- Gli entrypoint operativi canonici sono esposti in `scripts/` e richiamabili in modo uniforme anche da `npm run`.
- Gli output di compile, test, pack e publish sono confinati sotto `artifacts/`.

## Constraints
- Ambiente operativo di riferimento Windows.
- Node.js `>=18.0.0`.
- Runtime applicativo senza build frontend separato.
- Packaging MSI x64 basato su WiX 3.14.1 con `UpgradeCode` stabile.
- Toolchain WiX locale in `tools/wix314-binaries/`, non versionata.
- Gestione servizio Windows tramite script dedicati in `scripts/windows/`, con NSSM come host del processo Node.js.
- Persistenza locale su filesystem; nessun database esterno definito dal repository.
