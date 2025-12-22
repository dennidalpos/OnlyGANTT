# OnlyGANTT

Applicazione di diagramma di Gantt interattiva con blocco multi‑utente, pensata per Windows Server con Node.js 18+.

## Funzionalità

- **Nessun bundler, nessun build step**: React 18 via CDN con Babel Standalone per la compilazione JSX nel browser
- **Diagramma di Gantt interattivo**: rendering Canvas 2D con viste 4 mesi e completa
- **Sistema di lock multi‑utente**: blocco a livello di reparto con timeout e heartbeat
- **Persistenza JSON**: archiviazione su file con scritture atomiche (compatibile Windows)
- **Gestione reparti**: reparti opzionalmente protetti da password con import/export reparto e import/export progetti
- **Tema scuro**: UI moderna solo dark
- **Festività italiane**: rilevamento automatico inclusi Pasqua e Pasquetta
- **Avvisi completi**: ritardi, conflitti, anomalie e dati mancanti
- **Screensaver**: salvaschermo automatico con timeout configurabile
- **Preset fasi**: inserimento rapido delle fasi con colori e opzione personalizzata

## Architettura

### Nessun Bundler, Nessun ES Module
Tutti i file sono caricati tramite tag `<script>` in un ordine rigoroso. Nessun build step richiesto.

### Namespace
Tutti i moduli espongono funzioni sul namespace `window.OnlyGantt`:
- `window.OnlyGantt.api` - Client API
- `window.OnlyGantt.storage` - Utilità LocalStorage
- `window.OnlyGantt.dateUtils` - Utilità date
- `window.OnlyGantt.logic` - Logica di business
- `window.OnlyGantt.gantt` - Rendering Gantt
- `window.OnlyGantt.easter` - Calcolo Pasqua
- `window.OnlyGantt.hooks` - Hook React
- `window.OnlyGantt.components` - Componenti React

### Configurazione centralizzata
Tutte le costanti sono definite in `window.AppConfig` (vedi `src/app-config.js`).

## Struttura progetto

```
OnlyGANTT/
├─ package.json
├─ server/
│  ├─ server.js           # Server Express con API + lock + admin
│  └─ schema.js           # Validazione schema JSON
├─ public/
│  ├─ index.html          # HTML principale con script CDN
│  └─ styles.css          # CSS tema scuro
├─ src/
│  ├─ app-config.js       # Configurazione centralizzata
│  ├─ client/
│  │  ├─ app.jsx          # App React principale
│  │  ├─ api.js           # Client API con AbortController
│  │  ├─ storage.js       # Utilità LocalStorage
│  │  ├─ hooks/
│  │  │  ├─ useDepartmentLock.js
│  │  │  └─ useProjects.js
│  │  └─ components/
│  │     ├─ HeaderBar.jsx
│  │     ├─ DepartmentSelector.jsx
│  │     ├─ GanttControls.jsx
│  │     ├─ GanttCanvas.jsx
│  │     ├─ ProjectForm.jsx
│  │     ├─ ProjectList.jsx
│  │     └─ AlertsPanel.jsx
│  └─ utils/
│     ├─ easter.js        # Calcolo Pasqua (gregoriano)
│     ├─ utils-date.js    # Utilità date + festività italiane
│     ├─ utils-logic.js   # Logica di business (ritardi, conflitti, ecc.)
│     └─ utils-gantt.js   # Rendering canvas
├─ data/
│  ├─ TestCompleto.json   # Reparto con progetti corretti
│  └─ TestErrori.json     # Reparto con errori di validazione
└─ README.md
```

## Contesto progetto

Consulta [`context.md`](context.md) per l'ambiente di runtime, la struttura dei dati e le assunzioni di sviluppo locale usate in questo repository.

## Installazione

### Prerequisiti
- Node.js 18 o superiore
- Windows Server (o qualsiasi OS, ma ottimizzato per Windows)

### Installare le dipendenze
```bash
npm install
```

## Utilizzo

### Avvio server
```bash
npm start
```

Il server gira su `http://localhost:3000`

### Credenziali di default
- **ID Admin**: `admin` (modifica in `server/server.js`)
- **Password Admin**: `admin123` (modifica in `server/server.js`)
- **Password TestCompleto**: `test123`
- **Password TestErrori**: `test123`

## Modello dati

### Progetto
```javascript
{
  id: "uuid-v4",
  nome: "string",
  colore: "#hex",
  dataInizio: "YYYY-MM-DD" | null,
  dataFine: "YYYY-MM-DD" | null,
  stato: "da_iniziare" | "in_corso" | "in_ritardo" | "completato",
  percentualeCompletamento: number | null,  // null = auto (media delle fasi)
  fasi: [...]
}
```

### Fase
```javascript
{
  id: "uuid-v4",
  nome: "string",
  dataInizio: "YYYY-MM-DD" | null,
  dataFine: "YYYY-MM-DD" | null,
  stato: "da_iniziare" | "in_corso" | "in_ritardo" | "completato",
  percentualeCompletamento: number | null,  // null = auto
  milestone: boolean,
  note: "string"
}
```

### File reparto (data/<Reparto>.json)
```javascript
{
  "password": "string" | null,
  "projects": [...],
  "meta": {
    "updatedAt": "ISO-8601",
    "updatedBy": "userName",
    "revision": number
  }
}
```

## Endpoint API

### Reparti
- `GET /api/departments` - Elenco di tutti i reparti
- `POST /api/departments` - Crea un reparto (solo admin)
- `DELETE /api/departments/:name` - Elimina un reparto (solo admin)

### Password
- `POST /api/departments/:name/verify` - Verifica password
- `POST /api/departments/:name/change-password` - Cambia/imposta password
- `POST /api/departments/:name/reset-password` - Reset password (solo admin)

### Progetti
- `GET /api/projects/:department` - Recupera i progetti
- `POST /api/projects/:department` - Salva progetti (richiede lock)
- `POST /api/upload/:department` - Upload JSON (richiede lock)

### Lock
- `POST /api/lock/:department/acquire` - Acquisisci lock
- `POST /api/lock/:department/release` - Rilascia lock
- `GET /api/lock/:department/status` - Stato lock
- `POST /api/lock/:department/heartbeat` - Refresh lock

### Admin
- `POST /api/admin/login` - Login (restituisce Bearer token)
- `POST /api/admin/logout` - Logout
- `GET /api/admin/departments` - Elenco reparti con dettagli

## Dettaglio funzionalità

### Lock multi‑utente
- Lock a livello reparto (un utente per volta)
- Timeout configurabile (default: 60 minuti)
- Heartbeat automatico ogni 5 minuti
- `sendBeacon` allo scaricamento della pagina per rilasciare il lock (chiusura, refresh, cambio pagina)
- Cambio reparto: rilascio del lock prima dell’accesso al nuovo reparto
- Pulsante logout che libera lock e stato di modifica
- Stato lock mostrato in header (utente)

### Diagramma di Gantt
- **Vista 4 mesi**: scorrevole, 25px al giorno, tooltip attivi
- **Vista completa**: adatta a tutti i dati, senza scroll, tooltip attivi (per export PNG)
- **Auto "Vai a Oggi"**: centratura automatica su oggi all'apertura del reparto
- **Filtri separatori**: giorni, settimane, mesi, anni
- **Filtri dettaglio**: lettere/numeri giorni, numeri settimane, etichette mesi/anni
- **Default vista ridotta**: festivi attivi, separatori e dettagli completi
- **Default vista completa**: separatori mesi/anni, dettaglio anni + ritardi
- **Toggle globale**: attiva/disattiva tutti i filtri
- **Default viste**: 4 mesi con tutti i filtri separatori/dettaglio attivi, vista completa con soli separatori mesi/anni
- **Altri filtri**: weekend, festività, solo milestone, evidenzia ritardi

### Gestione Progetto
- **Salva (nelle fasi)**: salva il progetto corrente senza chiuderlo e forza il refresh del Gantt ad ogni click.
- **Salva progetto e chiudi**: salva e chiude la scheda progetto; in caso di errore, il progetto rimane aperto.
- **Elimina progetto**: rimuove il progetto dopo conferma, aggiorna lista e Gantt e non lascia selezioni residue.
- **Modifiche non salvate**: prima di cambiare reparto viene richiesto se salvare o annullare le modifiche.

### Password reparto
- **Reparti senza password**: accesso diretto.
- **Cambio password**: dopo l’aggiornamento è richiesto un nuovo accesso con la nuova password.
- **Rimozione password**: un reparto protetto può tornare senza password (utente o admin).

### Accesso admin
- **Operazioni reparto**: creazione, modifica e cancellazione reparti senza inserire il nome utente.
- **Sblocco lock**: pulsante admin per rimuovere lock attivi su un reparto.
- **Import/Export reparto**: visibili e utilizzabili solo con accesso admin (sezione "Reparto corrente").

## Troubleshooting

### File reparto JSON non valido
Se un file `data/<Reparto>.json` è corrotto o contiene JSON invalido, le API che leggono quel reparto rispondono con errore `INVALID_JSON`.
Controlla il file indicato nel payload di errore, correggi il JSON o ripristina un backup `.bak` valido, quindi riavvia il server se necessario.

### HeaderBar (UI)
- Pulsanti e controlli con **dimensioni, padding e radius uniformi**.
- Spaziature coerenti per allineare elementi e badge in tutte le viste.

### Import/Export
- **Elenco progetti**: import/export progetti per trasferirli tra reparti diversi
- **Topbar**: import/export reparto completo (configurazione + progetti)
- Validazione dati lato server e client con elenco errori mostrato in UI

### Percentuale completamento
- Valore `null` = calcolo automatico (media delle fasi)
- Checkbox "Auto" su progetti e fasi (default per i nuovi progetti)

### Reparti senza password
- La creazione dei reparti non richiede una password obbligatoria
- È possibile impostare una password in un secondo momento dalla sezione reparto

### Festività italiane
Festività fisse:
- Capodanno (1 Jan)
- Epifania (6 Jan)
- Festa della Liberazione (25 Apr)
- Festa del Lavoro (1 May)
- Festa della Repubblica (2 Jun)
- Ferragosto (15 Aug)
- Ognissanti (1 Nov)
- Immacolata Concezione (8 Dec)
- Natale (25 Dec)
- Santo Stefano (26 Dec)

Festività calcolate:
- Pasqua (domenica) - calcolata con algoritmo Meeus/Jones/Butcher
- Pasquetta (lunedì)

### Avvisi
L'applicazione rileva e mostra:
- **Progetti in ritardo**: data fine superata, non completati
- **Fasi in ritardo**: data fine superata, non completate
- **Fasi fuori intervallo progetto**: date fase fuori date progetto
- **Milestone fuori intervallo progetto**: milestone fuori date progetto
- **Fasi in festività/weekend**: fasi pianificate in giorni festivi o nel weekend (quando non si includono festivi/weekend)
- **Fasi senza date**: fasi senza data inizio/fine
- **Progetti senza fasi**: progetti vuoti
- **Progetti senza date**: progetti senza data inizio/fine
- **Progetti al 100% non completati**: progetti al 100% ma stato ≠ completato

### Screensaver
- Toggle in header
- Attivazione dopo 15 secondi di inattività (configurabile in `app-config.js`)
- Qualsiasi input chiude l'overlay

### Export/Import
- **Export JSON**: download progetti come file JSON
- **Import JSON**: upload file JSON (sostituisce i progetti, mantiene la password)
- **Export PNG**: esporta il Gantt come immagine PNG (forza vista completa)

### Festività/Weekend nelle fasi
Ogni fase ha la checkbox **"Include festività e weekend"**:
- **Attiva**: la fase può includere giorni festivi o weekend e non genera alert.
- **Disattiva**: vengono segnalate le fasi che attraversano festività o weekend.

## Configurazione

Modifica `src/app-config.js` per personalizzare:
- Impostazioni server (porta, timeout, ecc.)
- Rendering Gantt (margini, colori, pixel per giorno)
- Timeout inattività screensaver
- Impostazioni lock (intervallo heartbeat, debounce)
- Funzionalità logiche (auto-fix)
- Festività italiane

## LocalStorage

L'app usa localStorage per salvare:
- `currentUser`: nome utente corrente
- `passwords_<userName>_<hostname>`: mappa reparto → password

Le password sono memorizzate per utente e per hostname (inclusa la porta).

## Note di sviluppo

### Ordine di caricamento file (critico!)
I file devono essere caricati in questo ordine esatto (vedi `public/index.html`):
1. app-config.js
2. easter.js
3. utils-date.js
4. utils-logic.js
5. utils-gantt.js
6. api.js
7. storage.js
8. useDepartmentLock.js
9. useProjects.js
10. Tutti i componenti React (JSX)
11. app.jsx

### Performance
- Cache layout: il layout del Gantt è cache‑ato e ricalcolato solo quando necessario
- AbortController: tutte le chiamate API sensibili supportano l'aborto
- Debounce: l'acquisizione lock è debounced (300ms)

### Scritture atomiche Windows‑safe
Il server usa scritture atomiche per compatibilità Windows:
1. Scrive un file `.tmp`
2. Backup dell'originale su `.bak` (se esiste)
3. Elimina l'originale
4. Rinomina `.tmp` in originale

### Controllo revisioni
Le operazioni di salvataggio richiedono `expectedRevision` per evitare conflitti di modifica.
In caso di mismatch (409), il client ricarica i dati e avvisa l'utente.

## Dati di test

Sono disponibili due reparti di test:
1. **TestErrori**: include progetti con errori (ritardi, date mancanti, milestone fuori intervallo, fasi in festività, ecc.).
2. **TestCompleto**: include 10 progetti corretti con fasi prefatte e colori di default dal 2024 al 2030.

## Troubleshooting

### Problemi Comuni

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| Schermo bianco all'avvio | Errore JavaScript | Apri DevTools (F12) e controlla la console |
| Lock non acquisito | Server non raggiungibile | Verifica che il server sia avviato con `npm start` |
| Gantt vuoto | Nessun progetto selezionato | Seleziona almeno un progetto dalla lista |
| Password non riconosciuta | LocalStorage per hostname diverso | La password è salvata per hostname:porta |
| Export PNG vuoto | Vista non completa | L'export forza automaticamente la vista completa |
| Tooltip non appare | Vista completa attiva | I tooltip funzionano solo in vista 4 mesi |
| Modifiche non salvate | Lock mancante | Verifica di avere il lock attivo (badge verde) |
| Dati persi dopo refresh | Non salvato | Clicca "Salva Tutto" prima di uscire |

### Verifica Stato Server

```bash
# Verifica che il server sia in esecuzione
curl http://localhost:3000/api/departments

# Risposta attesa (JSON con lista reparti)
{"departments":[...]}
```

### Reset Completo

Se riscontri problemi persistenti:

```bash
# 1. Ferma il server (Ctrl+C)

# 2. Pulisci node_modules e reinstalla
rm -rf node_modules
npm install

# 3. Riavvia
npm start
```

### Log di Debug

Per abilitare log dettagliati, apri la console del browser (F12) e osserva:
- Errori di caricamento script
- Errori di rete (API)
- Errori React (rendering)

## Linting e Formattazione

Il progetto non utilizza un linter formale, ma segue queste convenzioni:

- **Indentazione**: 2 spazi
- **Virgolette**: singole per JS, doppie per JSX attributi
- **Semicolons**: sì
- **Trailing commas**: no

Per verificare manualmente la sintassi:

```bash
# Installa eslint globalmente (opzionale)
npm install -g eslint

# Controlla un file
eslint src/client/app.jsx --no-eslintrc --parser-options=ecmaVersion:2020
```

## Build e Deploy

### Sviluppo Locale

```bash
npm start
# Server disponibile su http://localhost:3000
```

### Produzione

1. **Modifica credenziali admin** in `server/server.js`:
   ```javascript
   adminUser: process.env.ONLYGANTT_ADMIN_USER || 'admin',
   adminPassword: process.env.ONLYGANTT_ADMIN_PASSWORD || 'changeme'
   ```

2. **Configura variabili ambiente**:
   ```bash
   export ONLYGANTT_ADMIN_USER=mio_admin
   export ONLYGANTT_ADMIN_PASSWORD=password_sicura
   ```

3. **Avvia in produzione** (esempio con PM2):
   ```bash
   npm install -g pm2
   pm2 start server/server.js --name onlygantt
   pm2 save
   ```

### Windows Server con NSSM

Per eseguire OnlyGANTT come servizio su Windows Server:

1. **Installa NSSM** (Non-Sucking Service Manager) e aggiungilo al `PATH`.
2. **Crea il servizio**:
   ```powershell
   nssm install OnlyGANTT
   ```
3. **Configura i parametri principali**:
   - **Application**: `C:\Program Files\nodejs\node.exe`
   - **Startup directory**: cartella del progetto (es. `C:\OnlyGANTT`)
   - **Arguments**: `server\server.js`
4. **Imposta le variabili d'ambiente del servizio**:
   ```powershell
   nssm set OnlyGANTT AppEnvironmentExtra ONLYGANTT_ADMIN_USER=admin
   nssm set OnlyGANTT AppEnvironmentExtra ONLYGANTT_ADMIN_PASSWORD=admin123
   ```
   > Per aggiungere più variabili usa righe separate oppure un'unica stringa con `;`.
5. **Avvia il servizio**:
   ```powershell
   nssm start OnlyGANTT
   ```

Per log e rotazione, usa la sezione **I/O** di NSSM (stdout/stderr) per salvare i file log in una directory dedicata.

### Dietro Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name gantt.esempio.it;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Guide di Sviluppo

Consulta i seguenti documenti per approfondimenti:

- [`context.md`](context.md) - Contesto ambiente di runtime
- [`AGENT.md`](AGENT.md) - Standard di code review, workflow, UI guidelines e quality gates

## Licenza

MIT

## Supporto

Per problemi e domande:
1. Consulta la sezione Troubleshooting sopra
2. Leggi i commenti nel codice sorgente
3. Verifica la configurazione in `src/app-config.js`
