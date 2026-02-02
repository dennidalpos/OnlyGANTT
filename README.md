# OnlyGANTT

OnlyGANTT è un'applicazione web per la gestione di diagrammi di Gantt con supporto multi-utente e blocco dei dati per reparto. Il progetto include un server Node.js/Express e una UI statica che comunica tramite API REST.

## Indice
- [Panoramica](#panoramica)
- [Requisiti](#requisiti)
- [Avvio rapido](#avvio-rapido)
- [Configurazione](#configurazione)
- [Struttura dati](#struttura-dati)
- [API principali](#api-principali)
- [Backup e import/export](#backup-e-importexport)
- [Autenticazione e utenti](#autenticazione-e-utenti)
- [Lock e concorrenza](#lock-e-concorrenza)
- [HTTPS](#https)
- [Troubleshooting](#troubleshooting)

## Panoramica
- **Frontend**: UI statica servita da Express (cartella `public` e assets in `src`).
- **Backend**: server Node.js/Express (`server/server.js`) con API REST per reparti, progetti e amministrazione.
- **Persistenza**: file JSON su disco sotto la cartella dati configurata (`Data/` di default).
- **Concorrenza**: lock per reparto per evitare modifiche concorrenti.

## Requisiti
- **Node.js >= 18** (vedi `package.json`).
- Ambiente con accesso al filesystem per salvare i dati.

## Avvio rapido
1. Installa le dipendenze:
   ```bash
   npm install
   ```
2. Avvia il server:
   ```bash
   npm start
   ```
3. Apri il browser su:
   ```
   http://localhost:3000
   ```

> Il server serve automaticamente i file statici da `public/` e `src/`.

## Configurazione
Le configurazioni principali sono gestite tramite variabili d'ambiente:

| Variabile | Descrizione | Default |
| --- | --- | --- |
| `PORT` | Porta HTTP/HTTPS | `3000` |
| `ONLYGANTT_DATA_DIR` | Cartella dati (reparti, utenti, config) | `Data` |
| `ONLYGANTT_ENABLE_BAK` | Abilita backup `.bak` dei file JSON | `true` |
| `ONLYGANTT_LOCK_TIMEOUT_MINUTES` | Timeout lock reparto | `60` |
| `ONLYGANTT_ADMIN_TTL_HOURS` | Durata sessione admin | `8` |
| `ONLYGANTT_MAX_UPLOAD_BYTES` | Dimensione massima upload JSON | `2000000` |
| `ONLYGANTT_ADMIN_USER` | Username admin | `admin` |
| `ONLYGANTT_ADMIN_PASSWORD` | Password admin | `admin123` |
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

## Struttura dati
La cartella dati (di default `Data/`) contiene:

```
Data/
  config/
    system-config.json
    locks.json
  log/
  reparti/
    <reparto>.json
  utenti/
    <user>.json
```

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
- **Modular backup**: esporta reparti, utenti e impostazioni selezionate.

Dal pannello admin è possibile:
- esportare i dati in formato JSON;
- importare backup con opzione di sovrascrittura.

## Autenticazione e utenti
- **Admin**: credenziali configurate via env; accesso tramite `/api/admin/login`.
- **Utenti locali**: salvati in `Data/utenti/*.json`.
- **LDAP**: supporto a bind, filtri personalizzabili e gruppo richiesto.
- **Fallback locale**: opzionale se LDAP non disponibile.

## Lock e concorrenza
Le modifiche ai progetti richiedono un lock sul reparto:
1. Acquisire lock.
2. Salvare con `expectedRevision`.
3. Rilasciare lock quando finito.

Il server rimuove lock scaduti automaticamente.

## HTTPS
Per abilitare HTTPS:
1. Impostare `HTTPS_ENABLED=true`.
2. Configurare `HTTPS_KEY_PATH` e `HTTPS_CERT_PATH`.
3. Riavviare il server.

## Troubleshooting
- **Errore LDAP_CONFIG_ERROR**: verificare URL e BASE_DN.
- **LOCK_REQUIRED**: acquisire lock prima di modificare i dati.
- **REVISION_MISMATCH**: ricaricare i dati e riprovare il salvataggio.

---

Per ulteriori dettagli, consultare il codice in `server/` e `src/`.
