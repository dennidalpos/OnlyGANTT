
## Struttura principale del progetto

```text
only-gantt/
├─ server.js           # Server Node.js/Express e logica di persistenza JSON
├─ package.json        # Dipendenze e script npm
├─ index.html          # Pagina principale, mount React, inclusione script
├─ app.jsx             # Componente React principale (UI Gantt, form, alert)
├─ styles.css          # Stili (tema chiaro/scuro, layout, tooltip, screensaver)
├─ config.js           # Costanti globali (canvas, timeout, stati, palette…)
├─ utils-date.js       # Utilità per date
├─ utils-logic.js      # Logica di business (percentuali, ritardi, festività…)
├─ utils-gantt.js      # Disegno del Gantt su canvas
├─ data/               # File JSON di persistenza (creati/run-time)
└─ uploads/            # Cartella temporanea per import JSON (run-time)
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
