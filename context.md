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

- **Directory dati**: `data/`.
- **Formato**: un file JSON per reparto (es. `data/TestCompleto.json`).
- **Scritture atomiche**: gestione `.tmp` e `.bak` per compatibilità Windows.

## Configurazione applicativa

- **Configurazione centrale**: `src/app-config.js` esposto su `window.AppConfig`.
- **Componenti client**: esposti su `window.OnlyGantt.components`.
- **Utility e hook**: esposti su `window.OnlyGantt` (vedi `README.md`).

## Note operative

- **Caricamento script**: ordine rigoroso definito in `public/index.html` (nessun bundler).
- **Dati di esempio**: `data/TestErrori.json` e `data/TestCompleto.json` contengono progetti di test.
- **Credenziali demo**: admin `admin` / `admin123`, reparti `TestErrori` e `TestCompleto` con password `test123`.
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
OnlyGANTT-V2/
├── data/                    # Dati persistenti (JSON per reparto)
├── public/                  # File statici serviti direttamente
│   ├── index.html          # Entry point HTML
│   └── styles.css          # CSS tema scuro
├── server/                  # Backend Express
│   ├── server.js           # API + lock + admin
│   └── schema.js           # Validazione JSON
├── src/                     # Codice sorgente client
│   ├── app-config.js       # Configurazione centralizzata
│   ├── client/             # React app
│   │   ├── api.js          # Client HTTP
│   │   ├── storage.js      # LocalStorage wrapper
│   │   ├── app.jsx         # Entry point React
│   │   ├── hooks/          # Custom hooks
│   │   └── components/     # Componenti React
│   └── utils/              # Utility pure (no React)
├── README.md               # Documentazione principale
├── context.md              # Questo file
└── AGENT.md                # Guidelines sviluppo
```

---

## Flussi Principali

### 1. Login Reparto

```
Utente → Seleziona reparto → Inserisce password (se protetto)
      → Server verifica → Acquisisce lock → Carica progetti
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
| `ONLYGANTT_ADMIN_USER` | admin | Username admin |
| `ONLYGANTT_ADMIN_PASSWORD` | admin123 | Password admin |

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
