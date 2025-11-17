````md
# Only GANTT – Pubblicazione con Node.js

Questo README spiega come:

1. preparare l’ambiente **Node.js**,
2. servire la parte front-end dell’app (il tuo `index.html`),
3. esporre le **API** utilizzate dall’interfaccia (`/api/...`) per gestire reparti, progetti e lock.

---

## 1. Prerequisiti

- **Node.js** installato (consigliato ≥ 18)
- **npm** (incluso con Node)
- Permessi per installare pacchetti npm

Verifica:

```bash
node -v
npm -v
````

---

## 2. Struttura del progetto

Esempio di struttura consigliata:

```text
only-gantt/
├─ public/
│  └─ index.html         # il file HTML della web app (Only GANTT)
├─ data/                 # verrà creata se non esiste, contiene i JSON con i dati
├─ server.js             # server Node/Express
└─ package.json          # configurazione npm
```

* Metti il tuo `index.html` **così com’è** dentro la cartella `public/`.
* Il server Node:

  * servirà i file statici da `public/`,
  * salverà i dati (reparti, progetti) sotto `data/`.

---

## 3. Inizializzazione del progetto Node

Dentro la cartella principale del progetto (`only-gantt/`):

```bash
npm init -y
```

Questo genera un `package.json` base.

Installa le dipendenze necessarie:

```bash
npm install express cors multer
```

* **express** – server HTTP
* **cors** – utile se in futuro servirai il front-end da un altro dominio
* **multer** – per gestire l’upload del file JSON (import progetti)

Modifica il `package.json` per aggiungere uno script `start`:

```json
{
  "name": "only-gantt",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  }
}
```

---

## 4. API richieste dal front-end

Dal codice della UI (già scritto nel tuo `index.html`), vengono chiamati i seguenti endpoint:

* **Reparti**

  * `GET  /api/departments`
    → restituisce un array di reparti (stringhe).
  * `POST /api/departments`
    body: `{ name: string }` → crea un reparto.
  * `DELETE /api/departments/:department`
    → elimina il reparto indicato e i suoi progetti.

* **Progetti**

  * `GET  /api/projects/:department`
    → restituisce la lista di progetti del reparto.
  * `POST /api/projects/:department`
    body: `Array` di progetti → salva tutti i progetti del reparto.

* **Lock (blocco reparto)**

  * `POST /api/lock/:department/acquire`
    body: `{ userName: string }`

    * se ok: `{ success: true }`
    * se già occupato: HTTP `423 Locked` + `{ lockedBy: "altro utente" }`
  * `POST /api/lock/:department/release`
    body: `{ userName: string }`
    → rilascia il lock se detenuto da quell’utente.

* **Upload JSON (import progetti)**

  * `POST /api/upload/:department`
    upload multipart con campo file `file` (un JSON con array di progetti)

    * se ok: `{ ok: true }`
    * altrimenti: `{ ok: false, error: "..." }`

Il server di esempio sotto implementa esattamente queste rotte.

---

## 5. Esempio completo di `server.js`

Crea un file `server.js` nella root del progetto con questo contenuto:

```js
// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cartella dati
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Multer per upload (import JSON)
const UPLOAD_DIR = path.join(DATA_DIR, 'tmp');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const upload = multer({ dest: UPLOAD_DIR });

// Middleware
app.use(cors());
app.use(express.json());

// Statici (front-end)
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// Helpers JSON
function readJson(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Errore lettura', filePath, err.message);
    return defaultValue;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// --------------------- REPARTI ------------------------
const DEPARTMENTS_FILE = path.join(DATA_DIR, 'departments.json');

app.get('/api/departments', (req, res) => {
  const deps = readJson(DEPARTMENTS_FILE, ['Home']);
  // garantiamo che "Home" esista sempre e sia la prima
  const set = new Set(deps);
  set.add('Home');
  const ordered = ['Home', ...Array.from(set).filter(d => d !== 'Home')];
  res.json(ordered);
});

app.post('/api/departments', (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Nome reparto mancante' });
  }
  const deps = readJson(DEPARTMENTS_FILE, ['Home']);
  if (!deps.includes(name)) {
    deps.push(name);
    writeJson(DEPARTMENTS_FILE, deps);
  }
  res.json({ ok: true, departments: deps });
});

app.delete('/api/departments/:department', (req, res) => {
  const department = req.params.department;
  if (!department || department === 'Home') {
    return res.status(400).json({ ok: false, error: 'Non puoi eliminare il reparto Home' });
  }
  let deps = readJson(DEPARTMENTS_FILE, ['Home']);
  deps = deps.filter(d => d !== department);
  writeJson(DEPARTMENTS_FILE, deps);

  // Elimina il file progetti associato (se esiste)
  const safeName = encodeURIComponent(department);
  const projFile = path.join(DATA_DIR, `projects_${safeName}.json`);
  if (fs.existsSync(projFile)) fs.unlinkSync(projFile);

  res.json({ ok: true });
});

// --------------------- PROGETTI ------------------------
function getProjectsFile(department) {
  const safeName = encodeURIComponent(department);
  return path.join(DATA_DIR, `projects_${safeName}.json`);
}

app.get('/api/projects/:department', (req, res) => {
  const department = req.params.department;
  const file = getProjectsFile(department);
  const projects = readJson(file, []);
  res.json(projects);
});

app.post('/api/projects/:department', (req, res) => {
  const department = req.params.department;
  const projects = Array.isArray(req.body) ? req.body : [];
  const file = getProjectsFile(department);
  writeJson(file, projects);
  res.json({ ok: true });
});

// --------------------- LOCK REPARTO ------------------------
const locks = {}; // { [department]: { userName, acquiredAt } }

app.post('/api/lock/:department/acquire', (req, res) => {
  const department = req.params.department;
  const { userName } = req.body || {};
  if (!userName || !userName.trim()) {
    return res.status(400).json({ success: false, error: 'userName mancante' });
  }

  const current = locks[department];
  if (!current || current.userName === userName) {
    locks[department] = { userName, acquiredAt: Date.now() };
    return res.json({ success: true });
  }

  // Già lockato da qualcun altro
  return res.status(423).json({ success: false, lockedBy: current.userName });
});

app.post('/api/lock/:department/release', (req, res) => {
  const department = req.params.department;
  const { userName } = req.body || {};
  const current = locks[department];

  if (current && (!userName || current.userName === userName)) {
    delete locks[department];
  }

  res.json({ success: true });
});

// --------------------- IMPORT PROGETTI (UPLOAD JSON) ------------------------
app.post('/api/upload/:department', upload.single('file'), (req, res) => {
  const department = req.params.department;

  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'File mancante' });
  }

  const tempPath = req.file.path;
  fs.readFile(tempPath, 'utf8', (err, content) => {
    // Elimina sempre il file temporaneo
    fs.unlink(tempPath, () => {});

    if (err) {
      console.error('Errore lettura file upload:', err);
      return res.status(500).json({ ok: false, error: 'Errore lettura file' });
    }

    let json;
    try {
      json = JSON.parse(content);
    } catch (e) {
      return res.status(400).json({ ok: false, error: 'Il file non è un JSON valido' });
    }

    if (!Array.isArray(json)) {
      return res.status(400).json({ ok: false, error: 'Il JSON deve essere un array di progetti' });
    }

    const file = getProjectsFile(department);
    try {
      writeJson(file, json);
      return res.json({ ok: true });
    } catch (e) {
      console.error('Errore salvataggio progetti importati:', e);
      return res.status(500).json({ ok: false, error: 'Errore salvataggio progetti importati' });
    }
  });
});

// --------------------- FALLBACK SPA ------------------------
// Qualsiasi altra route restituisce index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --------------------- AVVIO SERVER ------------------------
app.listen(PORT, () => {
  console.log(`Only GANTT in esecuzione su http://localhost:${PORT}`);
});
```

---

## 6. Avvio in sviluppo

Dalla root del progetto (`only-gantt/`):

```bash
npm start
```

Vedrai in console:

```text
Only GANTT in esecuzione su http://localhost:3000
```

Apri il browser su:

```text
http://localhost:3000
```

e utilizza l’app normalmente.

---

## 7. Deploy in produzione (cenni)

Per pubblicare l’app su un server (Linux, VM, container, ecc.):

1. **Copia il progetto** sul server:

   * `public/`
   * `server.js`
   * `package.json`
   * (eventuale cartella `data/` se vuoi migrare dati esistenti)

2. Installa le dipendenze:

   ```bash
   npm install --production
   ```

3. Avvia il server, specificando eventualmente porta e ambiente:

   ```bash
   NODE_ENV=production PORT=8080 node server.js
   ```

4. (Consigliato) usa un process manager come **PM2**:

   ```bash
   npm install -g pm2
   pm2 start server.js --name "only-gantt"
   pm2 save
   pm2 startup      # per avvio automatico al reboot
   ```

5. (Opzionale) Metti davanti un reverse proxy (Nginx, Apache…) per:

   * terminare **HTTPS**,
   * inoltrare richieste da `https://tuodominio` al Node che gira su `localhost:3000`/`8080`.

---

## 8. Personalizzazioni possibili

* **Persistenza dati**
  Attualmente viene usato il file system (`data/*.json`).
  Puoi sostituire `readJson/writeJson` con accesso a database (MySQL, PostgreSQL, MongoDB, ecc.).

* **Autenticazione e sicurezza**
  Il “nome utente” è solo un identificatore testuale usato per i lock.
  Puoi integrare un sistema di login e collegare il lock all’utente autenticato.

* **Hosting statico separato**
  Puoi servire il contenuto di `public/` da un server statico (CDN, Nginx, S3, ecc.)
  e usare il server Node solo come API, aggiornando gli URL delle `fetch` nel front-end.

---

```
```
