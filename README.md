
```markdown
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
