````markdown
# Creare un servizio Windows con NSSM (Non-Sucking Service Manager)

Questo documento spiega come creare e gestire un **servizio Windows** usando `nssm.exe`.  
L’esempio utilizza un’app Node.js, ma la procedura è identica per qualsiasi eseguibile.

---

## 1. Scaricare NSSM

1. Vai sul sito ufficiale di NSSM e scarica l’archivio `.zip` adatto alla tua architettura (32/64 bit).
2. Estrai il contenuto in una cartella, ad esempio:

   ```text
   C:\Tools\nssm\
````

Dentro troverai `nssm.exe` (eventualmente in sottocartelle come `win64` o `win32`).

> Suggerimento: aggiungi la cartella di NSSM al `PATH` di Windows per poter usare `nssm` da qualsiasi prompt.

---

## 2. Preparare l’applicazione da eseguire come servizio

Esempio: applicazione Node.js **OnlyGANTT**.

* Cartella progetto:

  ```text
  C:\WEB\OnlyGANTT\
  ```

* Comando per avviarla a mano:

  ```bash
  node server.js
  ```

Annota:

* il percorso di `node.exe` (es. `C:\Program Files\nodejs\node.exe`)
* il percorso del file che vuoi eseguire (es. `C:\WEB\OnlyGANTT\server.js`)

---

## 3. Creare il servizio con NSSM (interfaccia grafica)

1. Apri un **Prompt dei comandi** come **Amministratore**.

2. Vai nella cartella di NSSM, se non è nel PATH:

   ```bat
   cd C:\Tools\nssm
   ```

3. Lancia il comando:

   ```bat
   nssm install OnlyGANTT
   ```

   * `OnlyGANTT` è il nome del servizio Windows (puoi sceglierlo come preferisci).

4. Si aprirà la finestra di configurazione di NSSM.

### 3.1 Tab “Application”

Compila i campi principali:

* **Path**
  Il percorso dell’eseguibile da lanciare.
  Per Node.js:

  ```text
  C:\Program Files\nodejs\node.exe
  ```

* **Startup directory**
  La cartella dell’applicazione, es.:

  ```text
  C:\WEB\OnlyGANTT
  ```

* **Arguments**
  Argomenti da passare all’eseguibile. Per Node.js, il file server:

  ```text
  C:\WEB\OnlyGANTT\server.js
  ```

> Risultato: NSSM avvierà il comando
> `node C:\WEB\OnlyGANTT\server.js`
> nella cartella `C:\WEB\OnlyGANTT`.

---

### 3.2 Tab “Details” (facoltativo ma consigliato)

* **Display name**
  Nome leggibile in “Servizi” (es. `OnlyGANTT – Gantt Server`).
* **Description**
  Una breve descrizione del servizio.

---

### 3.3 Tab “Log on” (facoltativo)

Per la maggior parte dei casi può rimanere:

* **Log on as**: `Local System`

Se hai bisogno di accedere a share di rete o risorse particolari, puoi impostare un utente specifico di dominio.

---

### 3.4 Tab “I/O” (log output)

Per salvare log dell’applicazione:

1. Vai nella tab **I/O**.
2. Imposta i file di output, ad esempio:

   * **Output (stdout)**
     `C:\WEB\OnlyGANTT\logs\service-output.log`
   * **Error (stderr)**
     `C:\WEB\OnlyGANTT\logs\service-error.log`

Assicurati che la cartella `logs` esista (puoi crearla prima).

---

### 3.5 Confermare la creazione del servizio

Quando hai finito di configurare:

* Clicca su **Install service**.

Se tutto è corretto, NSSM ti confermerà che il servizio `OnlyGANTT` è stato installato.

---

## 4. Impostare l’avvio automatico

1. Apri **Servizi** (puoi cercare “services.msc” dal menu Start).

2. Trova il servizio creato (es. `OnlyGANTT`).

3. Doppio clic → nella sezione **Tipo di avvio** scegli:

   * `Automatico` (consigliato)
   * `Manuale` se preferisci avviarlo solo quando ti serve.

4. Premi **Applica** e **OK**.

---

## 5. Avviare, fermare e riavviare il servizio

### 5.1 Da interfaccia grafica

Da **Servizi** (`services.msc`):

* **Avvia** → tasto destro → *Avvia*
* **Arresta** → tasto destro → *Arresta*
* **Riavvia** → tasto destro → *Riavvia*

### 5.2 Da riga di comando

Sempre da Prompt **Amministratore**:

* Avvio:

  ```bat
  net start OnlyGANTT
  ```

* Arresto:

  ```bat
  net stop OnlyGANTT
  ```

---

## 6. Modificare un servizio esistente con NSSM

Se devi cambiare percorso, argomenti o log:

```bat
nssm edit OnlyGANTT
```

Si riaprirà la stessa finestra di configurazione.
Dopo aver modificato, conferma e **riavvia il servizio**.

---

## 7. Rimuovere il servizio

Per disinstallare il servizio:

```bat
nssm remove OnlyGANTT
```

NSSM ti chiederà se fermare automaticamente il servizio.

* Conferma → il servizio verrà fermato (se in esecuzione) e rimosso dal sistema.

---

## 8. Check rapido (troubleshooting base)

Se il servizio non parte:

1. Verifica che il percorso di `node.exe` sia corretto.
2. Verifica che il file `server.js` esista ed è raggiungibile.
3. Controlla i log configurati in tab **I/O**.
4. Controlla il **Visualizzatore eventi** di Windows (Registro applicazioni e sistema).
5. Assicurati che la porta (es. `3000`) non sia occupata da altri processi.

---

## 9. Esempio riassuntivo (OnlyGANTT + Node)

* Nome servizio: `OnlyGANTT`
* Path:
  `C:\Program Files\nodejs\node.exe`
* Startup directory:
  `C:\WEB\OnlyGANTT`
* Arguments:
  `C:\WEB\OnlyGANTT\server.js`
* Tipo di avvio: `Automatico`
* Log:

  * `C:\WEB\OnlyGANTT\logs\service-output.log`
  * `C:\WEB\OnlyGANTT\logs\service-error.log`

Con questa configurazione, ad ogni riavvio del server Windows il tuo applicativo OnlyGANTT partirà automaticamente come servizio.

---

```
::contentReference[oaicite:0]{index=0}
```
