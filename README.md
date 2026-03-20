# OnlyGANTT

OnlyGANTT è un'applicazione web per la gestione di diagrammi di Gantt con supporto multi-utente e blocco dei dati per reparto. Il progetto include un server Node.js/Express e una UI statica che comunica tramite API REST.

## Indice
- [Panoramica](#panoramica)
- [Requisiti](#requisiti)
- [Setup](#setup)
- [Build](#build)
- [Run](#run)
- [Test](#test)
- [Publish e packaging](#publish-e-packaging)
- [Clean](#clean)
- [Configurazione](#configurazione)
- [Struttura dati](#struttura-dati)
- [Struttura essenziale](#struttura-essenziale)
- [API principali](#api-principali)
- [Backup e import/export](#backup-e-importexport)
- [Autenticazione e utenti](#autenticazione-e-utenti)
- [Lock e concorrenza](#lock-e-concorrenza)
- [HTTPS](#https)
- [Licenza](#licenza)
- [Troubleshooting](#troubleshooting)

## Panoramica
- **Frontend**: UI statica servita da Express (cartella `public`, stili modulari in `public/styles` e assets in `src`).
- **Backend**: server Node.js/Express (`server/server.js`) con API REST per reparti, progetti e amministrazione.
- **Persistenza**: file JSON su disco sotto la cartella dati configurata (`Data/` di default).
- **Concorrenza**: lock per reparto per evitare modifiche concorrenti.

## Requisiti
- **Node.js >= 18** (vedi `package.json`).
- Ambiente con accesso al filesystem per salvare i dati.

## Setup
1. Installa le dipendenze:
   ```powershell
   npm install
   ```

## Build
Non esiste un build step frontend dedicato. Il server Express serve direttamente i file statici da `public/` e `src/`, e i componenti React/JSX vengono caricati lato browser.

Per il packaging Windows è disponibile un build step MSI:

```powershell
npm run build:msi
```

Il comando esegue uno staging dei file runtime, genera il fragment WiX e produce un installer MSI x64 in `dist/msi/`.
Se il toolchain WiX 3.14.1 non è ancora presente nella cache locale `tools/wix314-binaries/`, lo script lo scarica automaticamente dalla release ufficiale `wixtoolset/wix3`.

## Run
1. Avvia il server:
   ```powershell
   npm start
   ```
2. Apri il browser su:
   ```
   http://localhost:3000
   ```

## Test
Il repository non include una suite completa di test automatizzati, ma fornisce uno smoke check riproducibile del runtime:

```powershell
npm run smoke
```

Lo smoke check avvia il server su una cartella dati temporanea e verifica i flussi minimi di login admin, lock, logout e migrazione delle password reparto legacy.

## Publish e packaging
Il repository include una pipeline MSI per Windows e gli script operativi per il servizio:
- `scripts/build-msi.ps1`
- `scripts/install-service.ps1`
- `scripts/uninstall-service.ps1`

Prima di generare o installare il pacchetto Windows, eseguire almeno:

```powershell
npm install
npm run smoke
```

Per creare l'MSI:

```powershell
npm run build:msi
```

Per preprovisionare o rigenerare esplicitamente il toolchain WiX locale:

```powershell
npm run wix:provision
```

La directory `tools/wix314-binaries/` è una cache locale ignorata da Git. Lo script di provisioning scarica `wix314-binaries.zip` dalla release ufficiale WiX Toolset `v3.14.1` e la ricrea in modo ripetibile quando manca o quando viene richiesto un refresh.

L'installer MSI:
- installa l'app in `C:\Program Files\OnlyGANTT`;
- crea il servizio Windows `OnlyGanttWeb` tramite `nssm.exe`;
- usa la cartella dati `C:\Program Files\OnlyGANTT\Data`;
- supporta major upgrade futuri mantenendo lo stesso `UpgradeCode`;
- in disinstallazione rimuove servizio, chiavi di configurazione NSSM e file residui nelle directory dati note dell'app.

L'MSI richiede Node.js gia' installato nel sistema e legge il path da `HKLM\SOFTWARE\Node.js\InstallPath`.

Gli script di installazione/rimozione del servizio richiedono una sessione PowerShell avviata come amministratore.
In caso di servizio gia' esistente o installazione NSSM rimasta parziale, usare `scripts/install-service.ps1 -ForceReinstall` dopo aver aperto PowerShell come amministratore.
Per rimuovere un servizio registrato ma non piu' gestibile via NSSM, usare `scripts/uninstall-service.ps1 -ForceDelete`.

Lo script di installazione verifica la presenza delle dipendenze e configura il riavvio automatico del servizio in caso di errore.
L'installazione del servizio usa `tools/nssm/win64/nssm.exe` oppure `tools/nssm/win32/nssm.exe` in base all'architettura del sistema, imposta la working directory del repository e scrive i log del servizio in `Data/log/service-stdout.log` e `Data/log/service-stderr.log`.

## Clean
E' disponibile uno script `clean` dedicato:

```powershell
npm run clean
```

Lo script rimuove gli artefatti locali sotto `build/`, `dist/`, `out/`, `publish/` e `tmp/`. Non elimina `tools/wix314-binaries/`, che è la cache locale del toolchain WiX usata dal packaging MSI.

## Configurazione
Le configurazioni principali sono gestite tramite variabili d'ambiente:

| Variabile | Descrizione | Default |
| --- | --- | --- |
| `PORT` | Porta HTTP/HTTPS | `3000` |
| `ONLYGANTT_DATA_DIR` | Cartella dati (reparti, utenti, config) | `Data` |
| `ONLYGANTT_ENABLE_BAK` | Abilita backup `.bak` dei file JSON | `true` |
| `ONLYGANTT_LOCK_TIMEOUT_MINUTES` | Timeout lock reparto | `60` |
| `ONLYGANTT_USER_SESSION_TTL_HOURS` | Durata sessione utente con rinnovo ad attivita' | `8` |
| `ONLYGANTT_ADMIN_TTL_HOURS` | Durata sessione admin | `8` |
| `ONLYGANTT_MAX_UPLOAD_BYTES` | Dimensione massima upload JSON | `2000000` |
| `ONLYGANTT_ADMIN_USER` | Username admin | `admin` |
| `ONLYGANTT_ADMIN_PASSWORD` | Password admin esplicita; se assente non esiste alcun default insicuro | non impostata |
| `ONLYGANTT_ADMIN_RESET_CODE` | Codice reset admin (opzionale) | `null` |
| `LDAP_ENABLED` | Abilita autenticazione LDAP | `false` |
| `LDAP_URL` | URL server LDAP | `""` |
| `LDAP_BIND_DN` | DN account di bind | `""` |
| `LDAP_BIND_PASSWORD` | Password account di bind | `""` |
| `LDAP_BASE_DN` | Base DN di ricerca | `""` |
| `LDAP_USER_FILTER` | Filtro utente LDAP | `(sAMAccountName={{username}})` |
| `LDAP_REQUIRED_GROUP` | Gruppo richiesto (DN o nome) | `""` |
| `LDAP_GROUP_SEARCH_BASE` | Base DN per gruppi | `""` |
| `LDAP_LOCAL_FALLBACK` | Fallback utenti locali se LDAP fallisce | `false` |
| `HTTPS_ENABLED` | Abilita HTTPS | `false` |
| `HTTPS_KEY_PATH` | Path chiave TLS | `""` |
| `HTTPS_CERT_PATH` | Path certificato TLS | `""` |

### Configurazione da UI
Alcune impostazioni (LDAP/HTTPS) possono essere lette e aggiornate tramite le API admin e sono persistite in `Data/config/system-config.json`.
Le credenziali admin persistite fuori dalle variabili d'ambiente sono salvate in `Data/config/admin-auth.json` con password hashata. Se `ONLYGANTT_ADMIN_PASSWORD` e' impostata, la password admin e' gestita dall'ambiente e la UI non puo' sovrascriverla.
`system-config.json` puo' includere anche i parametri runtime del server (timeout lock, TTL sessioni, limite upload, `enableBak`), che vengono riapplicati al bootstrap e inclusi nei backup impostazioni.

## Struttura dati
La cartella dati (di default `Data/`) contiene:

```
Data/
  config/
    admin-auth.json
    system-config.json
    locks.json
  log/
  reparti/
    <reparto>.json
  utenti/
    users.json
    <user>.json
```

`users.json` e' il formato legacy importato automaticamente verso file utente separati (`<user>.json`) quando contiene dati validi.
Nel repository e' presente `Data/utenti/users.json.migrated` come artefatto di migrazione legacy.
Le password reparto persistite nei file `reparti/*.json` non sono mantenute in chiaro: i file aggiornati usano un record hashato compatibile con la migrazione automatica dei formati legacy.

### Reparto (`reparti/<nome>.json`)
Esempio minimale:
```json
{
  "password": null,
  "projects": [],
  "meta": {
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "updatedBy": "admin",
    "revision": 1
  }
}
```

### Progetto e fasi
Ogni progetto include fasi (`fasi`) con campi come `dataInizio`, `dataFine`, `stato`, `percentualeCompletamento` e flag `milestone`/`includeFestivi`.

## API principali
Esempi di endpoint (prefisso `/api`):

### Reparti
- `GET /departments` - Elenco reparti.
- `POST /departments` - Crea reparto (richiede token admin).
- `DELETE /departments/:name` - Elimina reparto (richiede token admin).
- `POST /departments/:name/verify` - Verifica password reparto.
- `POST /departments/:name/change-password` - Cambia password reparto.
- `POST /departments/:name/reset-password` - Reset password reparto (admin).
- `GET /departments/:name/export` - Esporta dati reparto.
- `POST /departments/:name/import` - Importa dati reparto (richiede lock).

### Progetti
- `GET /projects/:department` - Ottiene i progetti di un reparto.
- `POST /projects/:department` - Salva progetti (richiede lock + revision).

### Lock
- `POST /lock/:department/acquire` - Acquisisce lock.
- `POST /lock/:department/release` - Rilascia lock.
- `POST /lock/:department/heartbeat` - Estende lock.
- `GET /lock/:department/status` - Stato lock.

### Auth
- `POST /auth/login` - Login utente (LDAP o locale).
- `GET /auth/config` - Configurazione auth attiva.

### Admin
- `POST /admin/login` - Login admin.
- `POST /admin/logout` - Logout admin.
- `GET /admin/departments` - Lista reparti (admin).
- `GET /admin/users` - Lista utenti (admin).
- `GET /admin/system-config` - Configurazione di sistema (admin).
- `POST /admin/system-config` - Aggiorna configurazione (admin).
- `POST /admin/ldap/test` - Test LDAP (admin).
- `GET /admin/system-status` - Stato server (admin).
- `POST /admin/server-restart` - Riavvio server (admin).

## Backup e import/export
- **Legacy backup**: esporta reparti e configurazioni base.
- **Modular backup**: esporta reparti, utenti e impostazioni selezionate, incluse le configurazioni persistite LDAP/HTTPS/runtime presenti in `system-config.json`.

L'endpoint di export reparto non include il segreto della password reparto: l'import di un export applicativo mantiene la password gia' esistente se il payload non ne contiene una nuova.

Dal pannello admin è possibile:
- esportare i dati in formato JSON;
- importare backup con opzione di sovrascrittura.

## Autenticazione e utenti
- **Admin**: credenziali configurate via `ONLYGANTT_ADMIN_PASSWORD` oppure persistite in `Data/config/admin-auth.json`; nessuna password di default hardcoded. Se la password e' gestita da env, il cambio/reset da UI viene rifiutato per evitare drift.
- **Utenti locali**: salvati in `Data/utenti/*.json`.
- **Provisioning utenti locali**: disponibile da UI admin nella sezione Gestione utenti, con creazione, aggiornamento metadati/password ed eliminazione senza editing manuale dei file JSON.
- **LDAP**: supporto a bind, filtri personalizzabili e gruppo richiesto.
- **Fallback locale**: opzionale se LDAP non disponibile.
- **Sessioni utente**: token con TTL configurabile (`ONLYGANTT_USER_SESSION_TTL_HOURS`), rinnovo all'attivita' e logout esplicito tramite API.

## Lock e concorrenza
Le modifiche ai progetti richiedono un lock sul reparto:
1. Acquisire lock.
2. Salvare con `expectedRevision`.
3. Rilasciare lock quando finito.

Il server rimuove lock scaduti automaticamente.
Il rilascio lock richiede la stessa sessione utente valida usata per acquire/heartbeat; heartbeat e release falliti vengono ora riportati al client.

## HTTPS
Per abilitare HTTPS:
1. Impostare `HTTPS_ENABLED=true`.
2. Configurare `HTTPS_KEY_PATH` e `HTTPS_CERT_PATH`.
3. Riavviare il server.

## Struttura essenziale
- `server/` contiene backend Express, API REST e servizi di supporto.
- `src/` contiene configurazione client, componenti React/JSX, hook e utility.
- `public/` contiene shell HTML e fogli di stile serviti staticamente.
- `scripts/` contiene script PowerShell operativi per Windows.
- `Data/` contiene dati runtime e file di configurazione locale.

## Script operativi
- `scripts/build-msi.ps1` crea un installer MSI x64 dell'applicazione e, se necessario, bootstrapa automaticamente il toolchain WiX locale.
- `scripts/provision-wix.ps1` scarica la release ufficiale WiX Toolset 3.14.1 (`wix314-binaries.zip`) nella cache locale `tools/wix314-binaries/`.
- `scripts/install-service.ps1` crea un servizio Windows per `server/server.js` tramite NSSM presente in `tools/nssm/` e configura il restart automatico del processo.
- `scripts/uninstall-service.ps1` rimuove il servizio Windows creato per l'applicazione tramite NSSM; con `-ForceDelete` effettua fallback a `sc.exe delete` se NSSM non e' disponibile o la configurazione e' corrotta.

## Documentation
- `PROJECT_SPEC.md`
- `PROJECT_STATUS.json`
- `AGENTS.md`

## Tools
- `tools/nssm/` contiene `nssm.exe` per `win32` e `win64`, usato dagli script di installazione/rimozione del servizio Windows.
- `tools/wix/` contiene il sorgente WiX dell'installer MSI.
- `tools/wix314-binaries/` è una cache locale non versionata dei binari WiX 3.14.1, rigenerabile tramite `npm run wix:provision`.

## Licenza
Il progetto e' distribuito con licenza proprietaria. I dettagli sono definiti nel file `LICENSE`.

## Troubleshooting
- **Errore LDAP_CONFIG_ERROR**: verificare URL e BASE_DN.
- **LOCK_REQUIRED**: acquisire lock prima di modificare i dati.
- **REVISION_MISMATCH**: ricaricare i dati e riprovare il salvataggio.

---

Per ulteriori dettagli, consultare il codice in `server/` e `src/`.
