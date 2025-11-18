````markdown
# Only GANTT – Installazione e utilizzo con Node.js

Questo documento spiega come installare, configurare ed eseguire Only GANTT in locale tramite Node.js.

---

## Requisiti

- **Node.js** installato (consigliata una versione LTS recente)
- **npm** (incluso in Node)
- Un browser moderno (Chrome, Edge, Firefox, Safari…)

Non è previsto alcun build complesso: la parte frontend usa **React** da CDN e **Babel** lato client, quindi è sufficiente avviare il server Node.

---

## Installazione

1. Clona il repository o scarica i sorgenti:

   ```bash
   git clone <URL_DEL_REPOSITORY>
   cd only-gantt
````

(Sostituisci `<URL_DEL_REPOSITORY>` con l’URL reale del tuo repo GitHub.)

2. Installa le dipendenze Node.js:

   ```bash
   npm install
   ```

   Questo comando installa i pacchetti definiti in `package.json`:

   * `express` – server HTTP
   * `multer` – gestione upload file JSON

---

## Avvio del server

Il file di ingresso è `server.js`. Nel `package.json` è definito lo script:

```json
"scripts": {
  "start": "node server.js"
}
```

Per avviare il server:

```bash
npm start
```

oppure, in alternativa:

```bash
node server.js
```

Per impostazione predefinita il server si avvia su:

```text
http://localhost:3000
```

Nel log di console vedrai messaggi simili:

* `Server Only GANTT avviato su http://localhost:3000`
* cartella corrente
* cartella dati persistenti (`/data`)

Per interrompere il server premi **CTRL + C** nel terminale.

---

## Struttura del progetto

Struttura principale dei file:

* `server.js`
  Server Node.js con:

  * Express
  * static serving della cartella del progetto
  * API REST per reparti, progetti, lock e upload JSON
  * persistenza su file in `data/`

* `package.json`
  Metadati del progetto Node e dipendenze.

* `index.html`
  Pagina HTML principale che:

  * include React e ReactDOM da CDN
  * carica `config.js`, `utils-date.js`, `utils-logic.js`, `utils-gantt.js`
  * carica `app.jsx` come script `type="text/babel"`.

* `app.jsx`
  Componente React principale dell’applicazione (UI del Gantt, form, alert, ecc.).

* `styles.css`
  Stile dell’interfaccia (tema chiaro/scuro, layout, cards, tooltip, screensaver).

* `config.js`
  Costanti globali:

  * `DEFAULT_DEPARTMENT`
  * `IDLE_TIMEOUT`
  * dimensioni del canvas
  * palette colori, stati, preset percentuali, ecc.

* `utils-date.js`
  Funzioni di utilità per date (formattazione, differenze in giorni, aggiunta giorni…).

* `utils-logic.js`
  Logica di business:

  * normalizzazione percentuali
  * calcolo stato in ritardo
  * calcolo percentuale progetto da fasi
  * rilevamento festività italiane
  * applicazione automatismi sugli stati.

* `utils-gantt.js`
  Logica di disegno del diagramma di Gantt su `<canvas>`.

* `data/` *(creata automaticamente)*
  Contiene file JSON di persistenza:

  * un file per ogni reparto, es. `Home.json`, `Produzione.json`, ecc.

* `uploads/` *(creata al primo upload)*
  Cartella temporanea usata da Multer per i file JSON importati (poi rimossi).

---

## Persistenza dei dati

Il server salva i progetti in formato JSON nella cartella:

```text
data/
```

Per ogni reparto esiste un file `NOME_REPARTO.json`:

* all’avvio, `server.js` carica tutti i `.json` trovati
* se non esiste nessun file per *Home*, ne crea uno vuoto.

Per effettuare un backup dei dati è sufficiente copiare l’intera cartella `data/`.

---

## Configurazione base

Le principali opzioni sono in `config.js`:

```js
window.CONFIG = {
  DEFAULT_DEPARTMENT: 'Home',
  MS_PER_DAY: 24 * 60 * 60 * 1000,
  IDLE_TIMEOUT: 15000,
  MAX_PHASES_PER_PROJECT: 10,
  CANVAS_MIN_HEIGHT: 220,
  CANVAS_ROW_HEIGHT: 48,
  CANVAS_TOP_MARGIN: 70,
  CANVAS_BOTTOM_MARGIN: 60,
  CANVAS_LEFT_MARGIN: 260,
  CANVAS_RIGHT_MARGIN: 30,
};
```

Puoi personalizzare:

* `DEFAULT_DEPARTMENT` – nome del reparto predefinito.
* `IDLE_TIMEOUT` – millisecondi di inattività prima dello screensaver.
* `MAX_PHASES_PER_PROJECT` – limite di fasi per progetto.
* Parametri del canvas per adattare il Gantt a monitor diversi.

> **Nota:** Attualmente la porta (`PORT = 3000`) è definita direttamente in `server.js`. Per cambiarla modifica il valore della costante `PORT`.

---

## Comandi utili con Node.js

* Installazione dipendenze:

  ```bash
  npm install
  ```

* Avvio server:

  ```bash
  npm start
  # oppure
  node server.js
  ```

* (Opzionale) Avvio con `nodemon` per restart automatici durante lo sviluppo:

  ```bash
  npm install --save-dev nodemon
  npx nodemon server.js
  ```

---

## API di backend (overview)

L’app frontend usa le seguenti API REST:

* **Reparti**

  * `GET /api/departments`
    Restituisce un array di nomi reparto.

  * `POST /api/departments`
    Crea un nuovo reparto. Body JSON:

    ```json
    { "name": "Produzione" }
    ```

  * `DELETE /api/departments/:name`
    Elimina il reparto (tranne `Home`) e il relativo file JSON.

* **Progetti**

  * `GET /api/projects/:department`
    Restituisce l’array di progetti per il reparto.

  * `POST /api/projects/:department`
    Salva l’array di progetti per il reparto (sostituendo i dati esistenti).

* **Lock di reparto**

  * `POST /api/lock/:department/acquire`
    Body: `{ "userName": "Mario" }`
    Se il reparto è libero, assegna il lock all’utente.
    Se occupato, risponde con HTTP `423` e info su chi ha il lock.

  * `POST /api/lock/:department/release`
    Rilascia il lock se detenuto da `userName`.

* **Upload progetti**

  * `POST /api/upload/:department`
    Upload multipart con campo `file` (file JSON contenente un array di progetti).
    I dati vengono validati e salvati, sostituendo eventuali progetti esistenti.

Queste API sono già consumate dalla UI React e in genere non è necessario chiamarle manualmente, ma possono essere utili per integrazioni esterne o script di import/export.

---

## Note per produzione

Per un uso interno / intranet l’architettura attuale (React + Babel da CDN) è sufficiente.
Per un ambiente di produzione più strutturato si possono valutare:

* build precompilata dell’app React (es. Vite, Webpack…)
* reverse proxy (Nginx) davanti a Node
* backup automatici della cartella `data/`.

---