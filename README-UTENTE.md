<!-- README-UTENTE.md -->

# Only GANTT – Guida all’utilizzo

Only GANTT è una piccola web-app per gestire progetti con diagrammi di Gantt, fasi, milestone, alert automatici e salvataggio per reparto.

---

## 1. Come aprire l’app

1. Posiziona il file `index.html` in una cartella (es. `public/`).
2. Aprilo con un browser moderno (Chrome, Edge, Firefox, Safari).
3. In alternativa, se usi un server Node (vedi install.md), apri l’URL del server, es.  
   `http://localhost:3000`

> **Nota:** il reparto di default **Home** è locale e non viene salvato sul server.  
> Per lavorare in multi-utente e salvare i dati devi usare/creare un reparto diverso da Home.

---

## 2. Concetti principali

- **Reparto**  
  Contenitore logico dei progetti (es. “Marketing”, “IT”, “Produzione”).  
  Tutti i progetti appartengono a un reparto.

- **Progetto**  
  Ha nome, colore, data inizio/fine, stato, percentuale di completamento e una lista di fasi.

- **Fase di progetto**  
  Sotto-attività del progetto con proprie date, stato, percentuale, note e flag “Milestone”.

- **Diagramma di Gantt**  
  Visualizza i progetti selezionati e le loro fasi in una timeline (giorni, settimane o mesi).

- **Alert / Anomalie**  
  Pannello di destra che segnala:
  - progetti in ritardo
  - fasi in ritardo
  - fasi fuori dall’intervallo del progetto
  - automatismi (es. progetto/fase marcata automaticamente come completata o in ritardo)
  - fasi con date che cadono in un giorno festivo italiano

- **Lock per reparto (blocco concorrente)**  
  Un reparto alla volta può essere “in modifica” da un utente (nome utente).  
  Se un altro utente apre lo stesso reparto, vede il banner di avviso che non dovrebbe modificare.

---

## 3. Flusso tipico di lavoro

### 3.1 Inserire nome utente e scegliere il reparto

1. In alto a destra, nel campo **“Inserisci Utente”**, digita il tuo nome (es. `m.rossi`).
2. Nel menu **“Reparto”**:
   - scegli un reparto esistente, **oppure**
   - clicca sul pulsante **“+”** per creare un nuovo reparto, inserisci un nome e conferma.

Quando scegli un reparto (diverso da Home) con un utente impostato:

- l’app tenta di **acquisire un lock** sul reparto;
- se qualcun altro lo sta modificando, compare un banner rosso che ti avvisa:
  > “Il reparto X è in modifica da Y. Non apportare modifiche per evitare conflitti.”

Solo chi possiede il lock (o è nel reparto `Home`) può modificare/salvare.

---

### 3.2 Creare o modificare un progetto

Nella colonna di sinistra **“Gestione Progetto”**:

1. **Nome progetto**  
   Campo obbligatorio (es. “Sito web aziendale”).

2. **Colore progetto**  
   Usa il selettore colore per scegliere il colore di sfondo del progetto nel Gantt.

3. **Date progetto**
   - **Data inizio** (obbligatoria)
   - **Data fine** (obbligatoria, non può essere precedente alla data inizio)

4. **Stato progetto**
   - *Da iniziare*
   - *In corso*
   - *In ritardo*
   - *Completato*

5. **% completamento**
   - Vuoto (**Calcolo automatico**): il valore viene stimato dalla media delle fasi.
   - Oppure seleziona una fascia (0–25, 25–50, 50–75, 75–100, 100%).

6. Premi **“Salva progetto”**:
   - Se è un nuovo progetto, viene aggiunto.
   - Se stai modificando un progetto esistente, viene aggiornato.

7. Il pulsante **“Nuovo progetto”** pulisce il form per inserirne uno nuovo.

> Se tutte le fasi sono completate (100%), il progetto viene automaticamente marcato come **completato (100%)**.

---

### 3.3 Gestire le fasi del progetto

Nella sezione **“Fasi del Progetto”**:

1. Seleziona un **template** dal menu:
   - Analisi, Avvio lavori, Sviluppo, Test, Collaudo, Produzione, Rilascio finale
   - oppure **Personalizzata** per un nome libero.
2. Clicca **“Aggiungi fase”**:
   - viene aggiunta una riga con il nome della fase e date precompilate (se presenti).
3. Per ogni fase:
   - **Nome** (direttamente da template o campo testo se “Personalizzata”)
   - **Data inizio / Data fine** (non puoi mettere una data fine precedente all’inizio)
   - **Milestone**: spunta per indicare che la fase è un punto chiave (mostrato come rombo nel Gantt)
   - **Stato**: da iniziare / in corso / in ritardo / completato
   - **%**: percentuale di completamento (0–25–50–75–100).  
     Se lo stato è “Da iniziare”, il campo è disabilitato (0%).
   - **Note**: testo libero per commenti.

4. Con il pulsante **“Rimuovi”** puoi eliminare una fase.

> Le fasi non complete con date oltre l’oggi vengono segnalate come in ritardo nel pannello Alert.

---

### 3.4 Lista progetti e Gantt

Nella colonna centrale **“Elenco Progetti”**:

- Ogni progetto ha:
  - riquadro informativo (nome, intervallo date, stato, % completamento)
  - spunta **“In Gantt”**: se attiva, il progetto viene visualizzato nel diagramma.
  - pulsante **“Modifica”**: ricarica i dati nel form a sinistra.
  - pulsante **“Elimina”**: rimuove il progetto (con conferma).

- Cliccando sul progetto (freccia ▶/▼) **espandi**:
  - elenco delle fasi con date, stato, % e note
  - indicazione se una fase è una Milestone.

In alto nella sezione strumenti:

- **“Tutti in Gantt”**: seleziona/deseleziona la spunta “In Gantt” per tutti i progetti.
- **“Esporta JSON”**: scarica un file `.json` con tutti i progetti del reparto (versione con automatismi già applicati).
- **“Importa JSON”**: carica un file `.json` di progetti nel reparto corrente (sovrascrivendo i progetti esistenti).
- **“Esporta PNG”**: scarica un’immagine PNG dell’attuale diagramma di Gantt.

---

### 3.5 Diagramma di Gantt

Nella parte alta centrale:

- Mostra le **timeline** con:
  - mesi (etichettati in alto)
  - giorni o settimane (in basso)
  - linea rossa verticale **“Oggi”**
- Ogni **progetto** è una barra colorata.
- Le **fasi** sono barre più sottili all’interno della riga del progetto:
  - la label mostra il nome + percentuale (se c’è spazio).
  - Milestone come rombo nero con etichetta “MS”.
  - Elementi in ritardo hanno bordo rosso tratteggiato.

**Zoom Gantt** (in alto a destra):

- **Giorni** – vista dettagliata
- **Settimane** – vista intermedia (linee ogni lunedì)
- **Mesi** – vista compatta

**Tooltip**: passando il mouse sopra una fase o sulla timeline:

- per una fase: nome, progetto, intervallo date e stato.
- per la timeline vuota: data precisa nel punto del cursore.

---

### 3.6 Pannello Alert (colonna destra)

Sezione **Alert**:

1. **Progetti in ritardo**  
   Elenca i progetti che hanno data fine passata e non sono completati al 100%.

2. **Fasi in ritardo o da completare**  
   Elenca le fasi con data fine passata e completamento < 100%.

3. **Conflitti di date tra fasi e progetto**  
   Fasi che:
   - iniziano prima della data inizio del progetto, o
   - finiscono dopo la data fine del progetto.

4. **Automatismi e attività anomale**  
   Messaggi che descrivono:
   - cambi automatici di stato (es. completato / in ritardo)
   - fasi con data inizio/fine in un **giorno festivo nazionale italiano**.

---

### 3.7 Tema, screensaver e accessibilità

- **Tema chiaro/scuro**: switch nell’header (“Tema chiaro / Tema scuro”).
- **Screensaver**:
  - attivo se la spunta è abilitata;
  - dopo ~5 secondi di inattività appare una schermata; muovi il mouse o premi un tasto per tornare.
- **Accessibilità**:
  - link “Salta al contenuto principale” in alto a sinistra (visibile al focus).
  - varie etichette ARIA e supporto per tastiera (Enter/Space sui progetti).
  - rispetto delle impostazioni di **riduzione animazioni** e **alto contrasto** del sistema operativo.

---

## 4. Suggerimenti operativi

- Usa **un reparto per team** (es. “IT”, “Marketing”) per sfruttare il lock ed evitare conflitti.
- Mantieni le **fasi brevi e significative**, così gli alert sono più utili.
- Usa **Esporta JSON** come backup veloce prima di fare grandi modifiche.
- Usa **Esporta PNG** per allegare il Gantt in report, email o presentazioni.
