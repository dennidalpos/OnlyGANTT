# Only GANTT

Sistema di gestione progetti con **diagrammi di Gantt**, pensato per team che vogliono uno strumento leggero, installabile in locale e orientato alla pianificazione operativa.

---

## Caratteristiche principali

- ✅ Gestione di **reparti** (es. Home, Produzione, IT…) con dati separati
- ✅ Creazione e modifica di **progetti** con:
  - nome, colore, date di inizio/fine
  - stato (da iniziare, in corso, in ritardo, completato)
  - percentuale di avanzamento
- ✅ Gestione **fasi di progetto** con:
  - template standard (Analisi, Sviluppo, Test, …) o nomi personalizzati
  - date di inizio/fine, stato, percentuale e note
  - flag **Milestone** per evidenziare i punti chiave
- ✅ **Diagramma di Gantt interattivo** su canvas:
  - zoom per Giorni / Settimane / Mesi
  - linea “Oggi”
  - tooltip con dettagli di fase e data
- ✅ **Alert automatici**:
  - progetti e fasi in ritardo
  - conflitti tra date di fasi e progetto
  - stati aggiornati automaticamente
  - segnalazione di date che cadono in festività nazionali italiane
- ✅ **Esportazione/Importazione**:
  - esporta i progetti di un reparto in JSON
  - importa da file JSON
  - esporta il Gantt come immagine PNG
- ✅ Tema **chiaro/scuro** e **screensaver** integrato
- ✅ Supporto base ad accessibilità (skip link, ruoli ARIA, navigazione a tastiera)

---

## Stack tecnologico

- **Backend**
  - [Node.js](https://nodejs.org/)
  - [Express](https://expressjs.com/) per le API REST
  - [Multer](https://github.com/expressjs/multer) per upload di file JSON
  - Persistenza su file JSON in `data/` (un file per reparto)

- **Frontend**
  - [React 18](https://react.dev/) + ReactDOM (da CDN)
  - [Babel standalone](https://babeljs.io/docs/babel-standalone) lato client per compilare `app.jsx`
  - CSS custom in `styles.css`
  - Canvas HTML5 per il rendering del diagramma di Gantt

Nessun build tool obbligatorio: basta avviare il server Node e aprire il browser.

---

## Screenshot

*(Sostituisci con tue immagini)*

```md
![Screenshot principale](docs/screenshot-main.png)
![Dettaglio fasi e alert](docs/screenshot-alerts.png)
````

---

## Come iniziare

1. Clona il repository:

   ```bash
   git clone <URL_DEL_REPOSITORY>
   cd only-gantt
   ```

2. Installa le dipendenze:

   ```bash
   npm install
   ```

3. Avvia il server:

   ```bash
   npm start
   ```

4. Apri il browser su:

   ```text
   http://localhost:3000
   ```

5. Nell’app:

   * inserisci il **nome utente** nella barra in alto
   * scegli un **reparto** (Home o createne uno nuovo)
   * compila il form per creare il primo **progetto** e le sue **fasi**
   * marca i progetti con **“In Gantt”** per visualizzarli nel diagramma.

---

## Installazione come Servizio Windows

Per eseguire OnlyGANTT automaticamente all'avvio di Windows, puoi installarlo come servizio di sistema.

### Prerequisiti

1. **Node.js** installato e disponibile nel PATH
2. **NSSM** (Non-Sucking Service Manager) - necessario perche' Node.js non puo' essere eseguito direttamente come servizio Windows

### Installare NSSM

1. Scarica NSSM da [nssm.cc/download](https://nssm.cc/download)
2. Estrai l'archivio
3. Copia `nssm.exe` (dalla cartella `win64` o `win32`) in una di queste posizioni:
   - Nella cartella `tools\` del progetto
   - In una cartella presente nel PATH di sistema (es. `C:\Windows\System32`)

### Installare il servizio

1. Apri **PowerShell come Amministratore**
2. Naviga nella cartella del progetto:

   ```powershell
   cd C:\percorso\OnlyGANTT
   ```

3. Esegui lo script di installazione:

   ```powershell
   .\scripts\register_webserver_service.ps1
   ```

4. (Opzionale) Personalizza nome del servizio:

   ```powershell
   .\scripts\register_webserver_service.ps1 -ServiceName "MioGantt" -DisplayName "Il mio Gantt"
   ```

### Gestire il servizio

Dopo l'installazione, puoi gestire il servizio con i comandi standard di Windows:

```powershell
# Verificare lo stato
Get-Service -Name "OnlyGanttWeb"

# Avviare
Start-Service -Name "OnlyGanttWeb"

# Fermare
Stop-Service -Name "OnlyGanttWeb"

# Riavviare
Restart-Service -Name "OnlyGanttWeb"
```

Oppure usa il pannello **Servizi** di Windows (`services.msc`).

### Disinstallare il servizio

```powershell
.\scripts\uninstall_service.ps1
```

### Log del servizio

I log del servizio vengono salvati in `logs/`:
- `service-stdout.log` - Output standard
- `service-stderr.log` - Errori

I file di log vengono ruotati automaticamente quando superano 1 MB.

---

## Struttura principale del progetto

```text
only-gantt/
├─ server/
│  └─ server.js            # Server Node.js/Express e logica di persistenza JSON
├─ src/
│  ├─ client/
│  │  └─ app.jsx           # Componente React principale (UI Gantt, form, alert)
│  └─ utils/
│     ├─ config.js         # Costanti globali (canvas, timeout, stati, palette)
│     ├─ utils-date.js     # Utilita' per date
│     ├─ utils-logic.js    # Logica di business (percentuali, ritardi, festivita')
│     └─ utils-gantt.js    # Disegno del Gantt su canvas
├─ public/
│  ├─ index.html           # Pagina principale, mount React
│  └─ styles.css           # Stili (tema chiaro/scuro, layout, tooltip)
├─ scripts/
│  ├─ register_webserver_service.ps1  # Installa servizio Windows
│  └─ uninstall_service.ps1           # Rimuove servizio Windows
├─ data/                   # File JSON di persistenza (creati a runtime)
├─ logs/                   # Log del servizio Windows (creati a runtime)
├─ uploads/                # Cartella temporanea per import JSON (runtime)
└─ package.json            # Dipendenze e script npm
```

---

## Perché Only GANTT?

* Installazione semplice (solo Node.js)
* Nessun database obbligatorio (JSON su disco)
* Focalizzato sulla **pianificazione operativa**, non su mille funzionalità generiche
* Pensato per team che vogliono:

  * vedere subito i propri progetti su un Gantt
  * avere alert automatici su ritardi e anomalie
  * condividere una vista comune per reparto

---

## Contributi

Contributi, segnalazioni di bug e proposte sono benvenuti.

* Apri una **Issue** per problemi o richieste di nuove funzionalità.
* Invia una **Pull Request** per:

  * miglioramenti UI/UX
  * nuove regole di alert
  * integrazioni con altri sistemi

---
