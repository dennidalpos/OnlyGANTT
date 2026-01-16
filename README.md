# OnlyGANTT

Applicazione Timeline Progetti interattiva con blocco multi‑utente, pensata per Windows Server con Node.js 18+.

## Funzionalità

- **Nessun bundler, nessun build step**: React 18 via CDN con Babel Standalone per la compilazione JSX nel browser
- **Timeline Progetti interattiva**: rendering Canvas 2D con viste 3 mesi (ridotta) e completa
- **Sistema di lock multi‑utente**: blocco a livello di reparto con timeout e heartbeat
- **Persistenza JSON**: archiviazione su file con scritture atomiche (compatibile Windows)
- **Gestione reparti**: reparti opzionalmente protetti da password con import/export reparto e import/export progetti
- **Tema scuro**: UI moderna solo dark
- **Festività italiane**: rilevamento automatico inclusi Pasqua e Pasquetta
- **Avvisi completi**: ritardi, conflitti, anomalie e dati mancanti
- **Screensaver**: salvaschermo automatico con timeout configurabile
- **Preset fasi**: inserimento rapido delle fasi con colori e opzione personalizzata
- **Impostazioni di sistema**: gestione LDAP/HTTPS, import/export moduli e stato server applicativo

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
│  ├─ schema.js           # Validazione schema JSON
│  ├─ ldapService.js      # Integrazione LDAP
│  ├─ httpsService.js     # Avvio HTTPS
│  ├─ lockStore.js        # Persistenza lock
│  ├─ serverService.js    # Operazioni di manutenzione server
│  ├─ userStore.js        # Utenti locali
│  └─ auditService.js     # Audit log
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
│  │     ├─ LoginScreen.jsx
│  │     ├─ GanttControls.jsx
│  │     ├─ GanttCanvas.jsx
│  │     ├─ ProjectForm.jsx
│  │     ├─ ProjectList.jsx
│  │     ├─ ProjectSidebar.jsx
│  │     ├─ SystemSettings.jsx
│  │     ├─ UserManagement.jsx
│  │     └─ AlertsPanel.jsx
│  └─ utils/
│     ├─ easter.js        # Calcolo Pasqua (gregoriano)
│     ├─ utils-date.js    # Utilità date + festività italiane
│     ├─ utils-logic.js   # Logica di business (ritardi, conflitti, ecc.)
│     └─ utils-gantt.js   # Rendering canvas
├─ Data/
│  ├─ reparti/            # Reparti JSON
│  │  └─ Demo.json        # Reparto demo con 15 progetti (2025-2030)
│  ├─ utenti/             # Utenti locali
│  │  └─ users.json
│  ├─ config/             # Configurazioni persistenti
│  │  └─ system-config.json
│  └─ log/                # Log di audit
│     └─ audit.log
├─ scripts/
│  ├─ install-service.ps1 # Installa servizio Windows OnlyGanttWeb
│  └─ uninstall-service.ps1 # Rimuove servizio Windows OnlyGanttWeb
└─ README.md
```

## Contesto progetto

Consulta [`context.md`](context.md) per l'ambiente di runtime, la struttura dei dati e le assunzioni di sviluppo locale usate in questo repository.

## Installazione

### Prerequisiti
- Node.js 18 o superiore
- Windows Server (o qualsiasi OS, ma ottimizzato per Windows)

### Installazione su Windows Server
1. **Installa Node.js 18+**  
   Scarica l'MSI da <https://nodejs.org> e completa l'installazione con i default.
2. **Verifica Node e npm**  
   ```powershell
   node -v
   npm -v
   ```
3. **Apri la porta 3000 (o quella scelta)**  
   Esegui come amministratore:
   ```powershell
   netsh advfirewall firewall add rule name="OnlyGANTT" dir=in action=allow protocol=TCP localport=3000
   ```
4. **Installa le dipendenze**  
   ```powershell
   npm install
   ```
5. **Avvia il server**  
   ```powershell
   npm start
   ```
6. **(Opzionale) Servizio Windows**  
   Puoi usare gli script PowerShell inclusi:
   ```powershell
   scripts\\install-service.ps1
   scripts\\uninstall-service.ps1
   ```
   Il servizio installato si chiama `OnlyGanttWeb` e punta a `node server/server.js`.

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
- **Reparto Demo**: nessuna password

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
  includeFestivi: boolean,
  note: "string"
}
```

### File reparto (Data/reparti/<Reparto>.json)
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
- `POST /api/admin/change-password` - Cambio password admin
- `POST /api/admin/reset-password` - Reset password admin via reset code
- `GET /api/admin/departments` - Elenco reparti con dettagli
- `GET /api/admin/users` - Elenco utenti locali e LDAP (se abilitato)
- `GET /api/admin/system-config` - Configurazioni persistenti (LDAP/HTTPS)
- `POST /api/admin/system-config` - Salva configurazioni persistenti
- `GET /api/admin/system-status` - Stato server applicativo e ambiente
- `POST /api/admin/ldap/test` - Test di connessione LDAP
- `POST /api/admin/server-restart` - Riavvio server applicativo
- `GET /api/admin/server-backup` - Backup completo del server (tutti i reparti + configurazione)
- `POST /api/admin/server-restore` - Ripristino completo del server da file backup
- `POST /api/admin/export` - Export modulare (reparti, utenti, impostazioni, integrazioni)
- `POST /api/admin/import` - Import modulare con sovrascrittura opzionale

## Dettaglio funzionalità

### Lock multi‑utente
- Lock a livello reparto (un utente per volta)
- Timeout configurabile (default: 60 minuti)
- Heartbeat automatico ogni 5 minuti
- `sendBeacon` allo scaricamento della pagina per rilasciare il lock (chiusura, refresh, cambio pagina)
- Cambio reparto: rilascio del lock prima dell’accesso al nuovo reparto
- Cambio nome utente: rilascio del lock precedente e ri‑acquisizione con il nuovo utente
- Logout utente o admin: rilascio automatico del lock
- Admin può rilasciare lock attivi dal pannello strumenti
- Stato lock mostrato nella topbar

### Topbar
- **Layout essenziale**: titolo "OnlyGANTT" a sinistra, stato lock/admin e menu hamburger a destra
- **Contesto visibile**: reparto attivo e utente loggato mostrati accanto al titolo
- **Menu hamburger**: azioni secondarie (cambio reparto, lock, password, import/export, admin, logout)
- **Responsive**: su schermi piccoli mostra solo icone stato e menu

### Timeline Progetti
- **Vista 3 mesi (ridotta)**: scorrevole, ~25px al giorno, tooltip attivi
- **Vista completa**: adatta a tutti i dati, senza scroll, tooltip attivi (per export PNG)
- **Auto "Vai a Oggi"**: centratura automatica su oggi all'apertura/cambio reparto o tramite pulsante dedicato
- **Scroll persistente**: la posizione di scroll viene mantenuta durante apertura/chiusura sidebar e modifiche progetti
- **Pannello filtri organizzato in gruppi**:
  - **Timeline**: separatori e etichette per anni, mesi, settimane, giorni
  - **Contenuti**: nomi fasi, percentuali, solo milestone
  - **Evidenziazioni**: weekend, festivi, ritardi
- **Toggle gruppo**: attiva/disattiva tutti i filtri di un gruppo con un click
- **Toggle globale**: attiva/disattiva tutti i filtri
- **Reset defaults**: ripristina i filtri predefiniti per la vista corrente
- **Layout responsivo**: 3 colonne su schermi ≥1200px, 2 colonne su tablet, 1 colonna su mobile
- **Default vista ridotta**: tutti i filtri attivi
- **Default vista completa**: separatori mesi/anni, dettaglio anni, ritardi, percentuali
- **Header e footer speculari**: tutte le informazioni della timeline (anni, mesi, settimane, giorni, "Oggi", milestone) sono visualizzate sia sopra che sotto il diagramma
- **Linee milestone attraversanti**: le linee tratteggiate delle milestone attraversano verticalmente tutto il diagramma da header a footer, sempre visibili sopra le fasi

### Gestione Progetto
- **Salva (nelle fasi)**: salva il progetto corrente senza chiuderlo e forza il refresh del Gantt ad ogni click.
- **Salva progetto e chiudi**: salva e chiude la scheda progetto; in caso di errore, il progetto rimane aperto.
- **Elimina progetto**: rimuove il progetto dopo conferma, aggiorna lista e Gantt e non lascia selezioni residue.
- **Modifiche non salvate**: prima di cambiare reparto viene richiesto se salvare o annullare le modifiche.

### Password reparto
- **Reparti senza password**: accesso diretto.
- **Cambio password**: dopo l’aggiornamento è richiesto un nuovo accesso con la nuova password.
- **Rimozione password**: un reparto protetto può tornare senza password (utente o admin).

### Schermata di Login
- **Schermata unificata**: login utente e admin in una sola interfaccia con tab dedicati
- **Tab Reparto**: inserimento nome utente, selezione reparto, password (se richiesta)
- **Tab Admin**: login con credenziali amministratore
- **Auto-focus**: focus automatico sui campi input per inserimento rapido
- **Validazione in tempo reale**: feedback visivo su campi validi/invalidi
- **Gestione errori chiara**: messaggi di errore dettagliati e visibili
- **Stati di caricamento**: indicatori visivi durante le operazioni

### Accesso admin
- **Operazioni reparto**: creazione, modifica e cancellazione reparti senza inserire il nome utente.
- **Sblocco lock**: pulsante admin per rimuovere lock attivi su un reparto.
- **Import/Export reparto**: visibili e utilizzabili solo con accesso admin (sezione "Reparto corrente").
- **Backup/Ripristino server**: funzionalità per esportare e ripristinare l'intero server inclusi tutti i reparti, credenziali admin e configurazione.
- **Login separato**: tab dedicata nella schermata di accesso per distinguere chiaramente login utente e login admin.

## Troubleshooting

### File reparto JSON non valido
Se un file `Data/reparti/<Reparto>.json` è corrotto o contiene JSON invalido, le API che leggono quel reparto rispondono con errore `INVALID_JSON`.
Controlla il file indicato nel payload di errore, correggi il JSON o ripristina un backup `.bak` valido, quindi riavvia il server se necessario.


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

### Backup/Ripristino Server (Solo Admin)
- **Backup completo server**: esporta tutti i reparti, configurazione server e credenziali admin in un unico file JSON
  - Accessibile dal menu hamburger → Backup Server → "Esporta backup completo"
  - Il file include:
    - Tutti i reparti con progetti e password
    - Configurazione server (timeout lock, sessioni admin, limiti upload, etc.)
    - Username admin (la password non viene esportata per sicurezza)
    - Metadata con versione backup e timestamp export
- **Ripristino server**: ripristina l'intero server da file backup
  - Accessibile dal menu hamburger → Backup Server → "Ripristina backup"
  - Richiede conferma con riepilogo reparti da importare
  - Modalità sovrascrittura: i reparti esistenti vengono sovrascritti
  - Report dettagliato: mostra reparti importati, saltati ed errori eventuali
  - Validazione automatica dei dati prima dell'import
  - Lock automaticamente rilasciati sui reparti importati

### Festività/Weekend nelle fasi
Ogni fase ha la checkbox **"Include festività e weekend"**:
- **Attiva**: la fase può includere giorni festivi o weekend e non genera alert.
- **Disattiva**: vengono segnalate le fasi che attraversano festività o weekend.

## Configurazione

Modifica `src/app-config.js` per personalizzare:
- Impostazioni server (porta, timeout, ecc.)
- Rendering Gantt (margini, colori, pixel per giorno)
  - **CANVAS_TOP_MARGIN**: 130px - spazio per header timeline (anni, mesi, milestone, settimane, giorni)
  - **CANVAS_BOTTOM_MARGIN**: 130px - spazio per footer timeline (speculare all'header)
  - **CANVAS_LEFT_MARGIN**: 20px
  - **CANVAS_RIGHT_MARGIN**: 30px
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
- Scroll sincrono Gantt: aggiornamento scroll e trasformazioni tramite `requestAnimationFrame`
- Scrollbar Gantt: riuso del contenuto per evitare ricreazioni DOM frequenti

### Scritture atomiche Windows‑safe
Il server usa scritture atomiche per compatibilità Windows:
1. Scrive un file `.tmp`
2. Backup dell'originale su `.bak` (se esiste)
3. Elimina l'originale
4. Rinomina `.tmp` in originale

### Controllo revisioni
Le operazioni di salvataggio richiedono `expectedRevision` per evitare conflitti di modifica.
In caso di mismatch (409), il client ricarica i dati e avvisa l'utente.

## Dati di demo

È disponibile un reparto demo completo:

### Reparto Demo
- **Nome**: Demo
- **Password**: `demo123`
- **Progetti**: 15 progetti enterprise realistici
- **Timeline**: 15 Gennaio 2025 → 30 Giugno 2030 (5.5 anni)
- **Fasi per progetto**: Tutte le fasi predefinite (Analisi, Progettazione, Sviluppo, Test, Review/Documentazione, Deploy)
- **Milestone**: Configurate sulle fasi Deploy finali
- **Stati**: 3 progetti in corso, 12 da iniziare

#### Progetti Inclusi:
1. **Migrazione Cloud Infrastructure** (2025) - Migrazione AWS/Azure
2. **Portale Servizi Cittadino** (2025) - Servizi digitali per cittadini
3. **Sistema Gestione Documentale** (2025-2026) - DMS per digitalizzazione archivi
4. **App Mobile Dipendenti** (2025) - Gestione presenze e ferie
5. **Piattaforma E-Learning** (2025-2026) - Sistema formazione online
6. **Integrazione CRM Salesforce** (2025-2026) - Integrazione CRM
7. **Sistema Business Intelligence** (2025-2026) - Dashboard analytics
8. **Modernizzazione ERP** (2025-2027) - Aggiornamento ERP SAP S/4HANA
9. **Cybersecurity Framework** (2025-2026) - Framework ISO 27001
10. **Digital Workplace** (2026) - Piattaforma Microsoft 365
11. **IoT Smart Building** (2026-2027) - Sensori IoT per edifici
12. **AI Customer Service** (2026-2027) - Chatbot AI assistenza
13. **Blockchain Supply Chain** (2027-2028) - Tracciabilità blockchain
14. **Data Lake Enterprise** (2027-2028) - Big data analytics
15. **Quantum Computing POC** (2028-2030) - Proof of concept quantum

Il dataset Demo è ideale per:
- ✅ Testing e demo dell'applicazione
- ✅ Formazione utenti
- ✅ Verifica funzionalità Gantt
- ✅ Template per nuovi progetti

## Troubleshooting

### Problemi Comuni

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| Schermo bianco all'avvio | Errore JavaScript | Apri DevTools (F12) e controlla la console |
| Lock non acquisito | Server non raggiungibile | Verifica che il server sia avviato con `npm start` |
| Gantt vuoto | Nessun progetto selezionato | Seleziona almeno un progetto dalla lista |
| Password non riconosciuta | LocalStorage per hostname diverso | La password è salvata per hostname:porta |
| Export PNG vuoto | Vista non completa | L'export forza automaticamente la vista completa |
| Tooltip non appare | Mouse fuori dalla barra | Posiziona il mouse sulle barre progetto o fase |
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
