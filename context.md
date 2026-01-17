# Contesto ambiente progetto

Questo progetto è pensato per un'esecuzione "no build": React 18 viene caricato via CDN e il JSX viene compilato nel browser tramite Babel Standalone. L'applicazione è servita da un server Express che espone API e file statici.

## Runtime e strumenti

- **Node.js**: 18+ (richiesto da `package.json`).
- **Avvio**: `npm start`.
- **Server**: Express in `server/server.js`.
- **Client**: file statici in `public/` e sorgenti JS/JSX in `src/`.

## Porte e rete

- **Porta di default**: `3000` (configurata in `server/server.js` e riflessa in `src/app-config.js`).
- **Accesso locale**: `http://localhost:3000`.

## Persistenza dati

- **Directory dati**: `Data/`.
- **Formato**: un file JSON per reparto (es. `Data/reparti/TestCompleto.json`).
- **Scritture atomiche**: gestione `.tmp` e `.bak` per compatibilità Windows.

## Configurazione applicativa

- **Configurazione centrale**: `src/app-config.js` esposto su `window.AppConfig`.
- **Componenti client**: esposti su `window.OnlyGantt.components`.
- **Utility e hook**: esposti su `window.OnlyGantt` (vedi `README.md`).
- **Impostazioni di sistema**: le configurazioni persistenti (LDAP/HTTPS) sono gestite via API admin e salvate in `Data/config/system-config.json`.

## Stato server (admin)

- **Endpoint**: `GET /api/admin/system-status` (richiede Bearer token admin).
- **Uso**: alimenta la sezione "Stato server e ambiente" nelle impostazioni di sistema.

## Note operative

- **Caricamento script**: ordine rigoroso definito in `public/index.html` (nessun bundler).
- **Dati di esempio**: `Data/reparti/Demo.json` contiene 15 progetti di esempio (timeline 2025-2030).
- **Credenziali demo**: admin `admin` / `admin123`, reparto `Demo` senza password.
- **Windows Server (NSSM)**: puoi installare il server come servizio configurando `node.exe` e `server\\server.js` con NSSM (vedi README).

---

## Scelte Architetturali

### Perché "No Build"

1. **Semplicità di deploy**: Nessun webpack, nessun bundler, nessun build step
2. **Compatibilità Windows Server**: Funziona senza tool di build complessi
3. **Debug facile**: Codice sorgente leggibile direttamente nel browser
4. **Aggiornamenti rapidi**: Modifica un file e ricarica la pagina

### Perché Window Namespace

```javascript
window.OnlyGantt.api
window.OnlyGantt.components
window.OnlyGantt.hooks
```

- **Ordine di caricamento esplicito**: Dipendenze chiare tra moduli
- **No conflitti**: Namespace isolato dal resto della pagina
- **Debugging**: Accesso diretto da console browser

### Perché Canvas per il Gantt

- **Performance**: Rendering veloce anche con centinaia di elementi
- **DPI-aware**: Scaling automatico per display ad alta risoluzione
- **Export PNG**: Generazione immagine nativa

### Perché Lock a Livello Reparto

- **Semplicità**: Un utente per reparto evita conflitti di merge
- **Heartbeat**: Mantiene il lock attivo senza timeout improvvisi
- **Graceful release**: `sendBeacon` su chiusura tab

---

## Struttura Cartelle

```
OnlyGANTT/
├── Data/                    # Dati persistenti (JSON per reparto)
├── public/                  # File statici serviti direttamente
│   ├── index.html          # Entry point HTML
│   └── styles.css          # CSS tema scuro
├── server/                  # Backend Express
│   ├── server.js           # API + lock + admin
│   ├── schema.js           # Validazione JSON
│   ├── ldapService.js      # Integrazione LDAP
│   ├── httpsService.js     # Avvio HTTPS
│   ├── lockStore.js        # Persistenza lock
│   ├── serverService.js    # Operazioni di manutenzione server
│   ├── userStore.js        # Utenti locali
│   └── auditService.js     # Audit log
├── src/                     # Codice sorgente client
│   ├── app-config.js       # Configurazione centralizzata
│   ├── client/             # React app
│   │   ├── api.js          # Client HTTP
│   │   ├── storage.js      # LocalStorage wrapper
│   │   ├── app.jsx         # Entry point React
│   │   ├── hooks/          # Custom hooks (useDepartmentLock, useProjects)
│   │   └── components/     # Componenti React:
│   │       ├── HeaderBar.jsx      # Topbar essenziale con menu hamburger
│   │       ├── LoginScreen.jsx    # Schermata login unificata
│   │       ├── GanttControls.jsx  # Toolbar + pannello filtri
│   │       ├── GanttCanvas.jsx    # Canvas Gantt interattivo
│   │       ├── ProjectForm.jsx    # Form creazione/modifica progetto
│   │       ├── ProjectList.jsx    # Lista progetti selezionabili
│   │       ├── ProjectSidebar.jsx # Sidebar dettagli progetto
│   │       ├── SystemSettings.jsx # Impostazioni di sistema (admin)
│   │       ├── UserManagement.jsx # Gestione utenti (admin)
│   │       └── AlertsPanel.jsx    # Pannello avvisi e anomalie
│   └── utils/              # Utility pure (no React)
├── README.md               # Documentazione principale
├── context.md              # Questo file
└── AGENT.md                # Guidelines sviluppo
```

---

## Flussi Principali

### 1. Login Reparto

```
Utente → LoginScreen (Tab Reparto)
      → Inserisce nome utente → Seleziona reparto dal dropdown
      → Inserisce password (se richiesta)
      → Server verifica → Acquisisce lock → Carica progetti
```

### 1b. Login Admin

```
Utente → LoginScreen (Tab Admin)
      → Inserisce ID admin + Password
      → Server verifica → Rilascia token JWT
      → UI mostra badge "Admin attivo"
```

### 2. Modifica Progetto

```
Utente → Modifica progetto/fase → isDirty = true
      → Clicca "Salva Tutto" → Server verifica lock + revisione
      → Scrittura atomica → Risposta OK → isDirty = false
```

### 3. Export PNG

```
Utente → Clicca "Esporta PNG" → viewMode = 'full' (temporaneo)
      → Canvas ridisegna tutto → canvas.toDataURL() → Download
      → viewMode ripristinato
```

### 4. Heartbeat Lock

```
Ogni 5 minuti → POST /api/lock/:dept/heartbeat
              → Server estende scadenza lock
              → Se fallisce → lock perso → UI aggiornata
```

---

## Decisioni Chiave

| Decisione | Motivazione |
|-----------|-------------|
| React 18 CDN | No build step, compatibilità browser |
| Express puro | Leggero, facile da deployare |
| JSON file storage | Semplicità, no database required |
| Scritture atomiche | Sicurezza dati su Windows |
| Lock con heartbeat | Previene lock orfani |
| Tema scuro only | Coerenza UI, meno codice |
| Festività italiane | Target utenti italiano |
| Canvas 2D | Performance + export PNG |

---

## Variabili d'Ambiente (Produzione)

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `NODE_ENV` | production | Ambiente runtime |
| `PORT` | 3000 | Porta HTTP |
| `ONLYGANTT_DATA_DIR` | Data | Directory dati |
| `ONLYGANTT_ENABLE_BAK` | true | Abilita file `.bak` |
| `ONLYGANTT_LOCK_TIMEOUT_MINUTES` | 60 | Timeout lock reparto |
| `ONLYGANTT_ADMIN_TTL_HOURS` | 8 | Durata sessione admin |
| `ONLYGANTT_MAX_UPLOAD_BYTES` | 2000000 | Limite upload JSON |
| `ONLYGANTT_ADMIN_USER` | admin | Username admin |
| `ONLYGANTT_ADMIN_PASSWORD` | admin123 | Password admin |
| `ONLYGANTT_ADMIN_RESET_CODE` | null | Codice reset password admin |
| `LDAP_ENABLED` | false | Abilita integrazione LDAP |
| `LDAP_URL` | "" | URL server LDAP |
| `LDAP_BIND_DN` | "" | Bind DN |
| `LDAP_BIND_PASSWORD` | "" | Bind password |
| `LDAP_BASE_DN` | "" | Base DN |
| `LDAP_USER_FILTER` | `(sAMAccountName={{username}})` | Filtro utenti |
| `LDAP_REQUIRED_GROUP` | "" | Gruppo richiesto |
| `LDAP_GROUP_SEARCH_BASE` | "" | Base ricerca gruppi |
| `LDAP_LOCAL_FALLBACK` | false | Fallback utenti locali |
| `HTTPS_ENABLED` | false | Abilita HTTPS |
| `HTTPS_KEY_PATH` | "" | Percorso chiave TLS |
| `HTTPS_CERT_PATH` | "" | Percorso certificato TLS |

---

## Dipendenze NPM

```json
{
  "express": "^4.18.2",  // Server HTTP
  "multer": "^2.0.2"      // Upload file
}
```

Nessuna dipendenza dev. Nessun bundler. Nessun transpiler lato server.

---

## Browser Support

| Browser | Versione Minima | Note |
|---------|-----------------|------|
| Chrome | 90+ | Raccomandato |
| Firefox | 88+ | Supportato |
| Edge | 90+ | Supportato |
| Safari | 14+ | Supportato |
| IE | - | Non supportato |
