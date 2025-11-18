```markdown
# Only GANTT – Guida rapida all’utilizzo

Only GANTT è un’applicazione web per pianificare e monitorare progetti tramite diagrammi di Gantt.

Ogni progetto appartiene a un **reparto** e viene suddiviso in **fasi** con date, percentuali di avanzamento e milestone.  
L’interfaccia è pensata per l’uso quotidiano in azienda, con un colpo d’occhio sullo stato dei progetti.

---

## Accesso all’applicazione

1. Avvia il server Node.js (vedi README di installazione).
2. Apri il browser all’indirizzo:

```

[http://localhost:3000](http://localhost:3000)

```

3. Vedrai l’app “Only GANTT” con:
- barra superiore (nome utente, reparto, tema, screensaver, zoom)
- area principale con il **diagramma di Gantt**
- parte bassa con:
  - **form di gestione progetto**
  - **elenco progetti**
  - **pannello Alert**

---

## Concetti chiave

- **Reparto**
- È un “contenitore” di progetti (es. *Home*, *Produzione*, *IT*, *Marketing*).
- Ogni reparto ha i propri progetti salvati in un file JSON separato.
- Il reparto predefinito è **Home** (non si può eliminare).

- **Progetto**
- Ha nome, colore, date di inizio/fine, stato e percentuale di completamento.
- Può contenere più **fasi** operative.

- **Fase**
- Porzione di lavoro all’interno del progetto (es. *Analisi*, *Sviluppo*, *Test*…).
- Ha data di inizio/fine, stato, percentuale e note.
- Può essere marcata come **Milestone** (visualizzata come rombo sul Gantt).

- **Alert**
- Segnalano progetti e fasi in ritardo, conflitti di date e automatismi applicati allo stato.

---

## Primo utilizzo – passo passo

### 1. Inserire il nome utente

Nella barra in alto, a destra, trovi il campo:

- **“Inserisci Utente”**

Compila con il tuo nome.  
Il nome utente serve anche per la gestione dei **lock** (blocco di reparto) quando più persone lavorano sullo stesso reparto.

> Senza nome utente non puoi selezionare un reparto diverso da *Home* né salvare progetti.

---

### 2. Selezionare o creare un reparto

Sempre nella barra in alto:

- Menu **“Reparto”**: scegli il reparto su cui vuoi lavorare.
- Pulsante **“+”**: crea un nuovo reparto.
- Pulsante **“Elimina”**: elimina il reparto corrente (non è possibile eliminare *Home*).

Per lavorare su un reparto diverso da *Home*:

1. Inserisci il nome utente.
2. Seleziona il reparto dal menu.

Se un altro utente sta già modificando lo stesso reparto, vedrai un **banner rosso** che indica chi lo sta usando e da quando: in quel caso lavora solo in lettura per evitare conflitti.

---

### 3. Creare un nuovo progetto

Nella colonna di sinistra (card **“Gestione Progetto”**):

1. Compila i campi:
- **Nome progetto** (obbligatorio)
- **Colore progetto** (opzionale, aiuta a distinguere i progetti sul Gantt)
- **Data inizio** e **Data fine** (obbligatorie)
- **Stato progetto**: *Da iniziare*, *In corso*, *In ritardo*, *Completato*
- **% completamento**:
  - vuoto → calcolata automaticamente in base alle fasi
  - selezionata → imposta manualmente un intervallo (0–25, 25–50, 50–75, 75–100, 100%)

2. Premi **“Salva progetto”** per creare o aggiornare il progetto.
3. Il progetto comparirà nella colonna centrale “Elenco Progetti”.

> Il pulsante **“Nuovo progetto”** pulisce il form per inserire rapidamente un nuovo progetto.

---

### 4. Aggiungere e gestire le fasi

Nella card **“Fasi del Progetto”**:

1. Scegli un **template** dal menu (Analisi, Avvio lavori, Sviluppo, Test, Collaudo, Produzione, Rilascio finale)  
oppure seleziona **“Personalizzata”** per scrivere il nome fase a mano.
2. Clicca su **“Aggiungi fase”** per creare una riga.
3. Per ogni fase compila:
- Nome (o lascia il template)
- **Data inizio** e **Data fine**
- Eventuale flag **Milestone**
- **Stato** (Da iniziare, In corso, In ritardo, Completato)
- **% completamento** (disabilitata se lo stato è “Da iniziare”; a 100% la fase viene automaticamente marcata come completata)
- **Note** (campo libero per commenti)

Puoi:

- Aggiungere più fasi per progetto (fino a un massimo configurato).
- Premere **“Rimuovi”** per eliminare la fase selezionata.

Quando salvi il progetto:

- Le fasi vengono salvate insieme al progetto.
- La percentuale del progetto può essere **ricalcolata in automatico** in base alle percentuali delle fasi.

---

### 5. Usare l’elenco progetti

Nella colonna centrale **“Elenco Progetti”**:

Per ogni progetto vedi:

- Nome e colore
- Date inizio/fine
- Stato e percentuale completamento (con badge colorato)
- Checkbox **“In Gantt”** per includerlo nel diagramma

Azioni disponibili:

- Clic sul progetto → **espande/comprime** il dettaglio con elenco fasi e note.
- **Check “In Gantt”** → include/esclude il progetto dal diagramma.
- Pulsante **“Modifica”** → carica il progetto nel form a sinistra per modificarlo.
- Pulsante **“Elimina”** → cancella il progetto (dopo conferma).

Nella box **“Strumenti”** trovi:

- **“Tutti in Gantt”**: seleziona/deseleziona tutti i progetti.
- **“Esporta JSON”**: scarica un file JSON con i progetti del reparto.
- **“Importa JSON”**: carica un file JSON di progetti (sovrascrivendo quelli esistenti).
- **“Esporta PNG”**: salva un’immagine PNG dell’attuale diagramma di Gantt.

---

### 6. Navigare il diagramma di Gantt

La parte alta della pagina mostra il **diagramma di Gantt**:

- Barra temporale per mesi, settimane o giorni.
- Colonne verticali per i giorni/settimane.
- Una linea rossa **“Oggi”** che segna la data corrente.
- Ogni progetto appare come barra colorata.
- Le fasi sono segmenti più sottili (o rombi per le milestone).

Funzionalità:

- Pulsanti **Giorni / Settimane / Mesi** per lo **zoom**.
- Passando il mouse sopra una fase o una milestone appare un **tooltip** con:
- nome fase
- progetto di appartenenza
- intervallo date
- stato
- percentuale di completamento
- Passando il mouse nello spazio del grafico (non sulle barre) appare un tooltip con la data corrispondente.

---

### 7. Tema, screensaver e accessibilità

Nella barra superiore:

- **Tema chiaro/scuro**  
Usa l’interruttore per passare da tema chiaro a scuro in base alle preferenze.

- **Screensaver**  
Se abilitato, dopo un periodo di inattività (circa 15 secondi) l’app mostra uno screensaver con il logo Only GANTT.  
Muovi il mouse o premi un tasto per tornare alla schermata principale.

Accessibilità:

- Link **“Salta al contenuto principale”** per chi usa la tastiera.
- Attributi `aria-*` e `role` per facilitare screen reader e navigazione da tastiera.

---

### 8. Sezione “Alert”

Nella colonna destra la card **“Alert”** mostra 4 blocchi:

1. **Progetti in ritardo**  
Progetti con data di fine passata che non sono completati.

2. **Fasi in ritardo o da completare**  
Fasi scadute ma non completate.

3. **Conflitti di date tra fasi e progetto**  
Fasi che iniziano prima o finiscono dopo l’intervallo del progetto.

4. **Automatismi e attività anomale**  
Messaggi generati dalla logica interna quando:
- un progetto o una fase viene impostato automaticamente su “Completato”
- uno stato viene aggiornato in “In ritardo”
- la data di inizio/fine cade in un giorno festivo nazionale (calendario italiano).

Usa questa sezione come **dashboard di controllo** per capire rapidamente dove intervenire.

---

Buon lavoro con Only GANTT! 🎯
```