# Project Specification

## Goal
Fornire un'applicazione web per la pianificazione e gestione di diagrammi di Gantt con accesso multi-utente, autenticazione amministrativa e blocco concorrente dei dati per reparto.

## Scope
- Server Node.js/Express che espone API REST per reparti, progetti, lock, utenti e configurazione di sistema.
- Frontend React servito come UI statica dal server Express senza build step dedicato.
- Persistenza file-based nella cartella `Data/` per reparti, utenti, lock, log e configurazione.
- Autenticazione admin locale e supporto autenticazione LDAP con provisioning utenti.
- Import/export dati, script PowerShell per installazione come servizio Windows tramite NSSM e packaging MSI per deploy Windows.
- Sessioni utente con TTL e logout esplicito; password reparto e credenziali admin persistite senza segreti in chiaro.

## Non Scope
- Database relazionali o NoSQL.
- Build frontend con bundler o pipeline di compilazione.
- Deploy self-contained o packaging desktop non-Windows.
- Gestione multi-tenant oltre al modello per reparto gia' implementato.

## Architecture
- `server/`: backend Express e servizi di supporto per lock, utenti, LDAP, HTTPS, audit e restart.
- `public/`: shell HTML e entrypoint CSS, con stylesheet modularizzati in `public/styles/`.
- `src/`: configurazione client, utility e componenti React/JSX caricati nel browser tramite Babel standalone.
- `Data/`: storage runtime su filesystem per reparti, utenti, configurazione e log.
- `scripts/`: script PowerShell operativi per registrazione/rimozione del servizio Windows tramite NSSM, packaging MSI e provisioning del toolchain WiX locale.
- `tools/wix/`: sorgenti WiX per l'installer MSI Windows dell'applicazione.

## Constraints
- Ambiente operativo di riferimento Windows.
- Node.js `>=18.0.0`.
- Avvio applicativo tramite `npm start`, con entrypoint `server/server.js`.
- Installazione del servizio Windows tramite `tools/nssm/<arch>/nssm.exe`, con restart del processo delegato al service manager quando l'app gira come servizio.
- Installer MSI Windows x64 basato su WiX 3.14.1, con `UpgradeCode` stabile per major upgrade futuri.
- I binari WiX non fanno parte del contenuto versionato del repository: il provisioning locale avviene tramite `scripts/provision-wix.ps1` in `tools/wix314-binaries/`.
- Persistenza locale su filesystem; il repository non definisce un database esterno.
- Concorrenza gestita tramite lock per reparto e controllo di revisione sui salvataggi.
- Nessuna password admin di default hardcoded: le credenziali admin devono essere fornite via variabili d'ambiente oppure inizializzate nella configurazione persistita del repository.
