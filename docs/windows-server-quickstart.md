# Guida rapida Windows

Questa guida serve per preparare OnlyGANTT da zero su Windows e impostare le prime credenziali senza passare subito da configurazioni avanzate.

Scenario consigliato:

- avvio manuale del server da PowerShell;
- cartella dati standard `Data/`;
- primo account admin inizializzato con reset code;
- primo reparto e primo utente locale creati dalla UI.

## 1. Requisiti

Servono:

- Windows;
- Node.js 18 o superiore;
- PowerShell;
- una cartella locale con il repository.

## 2. Preparazione iniziale

Apri PowerShell nella root del repository ed esegui:

```powershell
cd D:\GITHUB\OnlyGANTT
npm run bootstrap
npm run doctor
```

Se `doctor` termina con `Environment checks passed.`, il server puo' essere avviato.

## 3. Primo avvio consigliato

Per la prima configurazione conviene usare un reset code temporaneo. In questo modo la password admin finale viene salvata dal server in modo persistente e non resta legata a una variabile ambiente.

Nella stessa finestra PowerShell imposta:

```powershell
$env:ONLYGANTT_ADMIN_RESET_CODE = 'Scegli-un-codice-reset-lungo'
npm start
```

Opzionale: se vuoi cambiare il nome dell'account admin prima del primo accesso, imposta anche:

```powershell
$env:ONLYGANTT_ADMIN_USER = 'admin'
```

Se non imposti `ONLYGANTT_ADMIN_USER`, il nome admin predefinito resta `admin`.

Quando il server parte, apri:

```text
http://localhost:3000
```

## 4. Primo accesso admin

Nella schermata iniziale:

1. apri la scheda `Admin`;
2. usa come ID admin `admin`, oppure il valore scelto in `ONLYGANTT_ADMIN_USER`;
3. se la password non e' ancora configurata, clicca `Password dimenticata?`;
4. inserisci il `Codice Reset`;
5. inserisci la `Nuova Password Admin`;
6. clicca `Reimposta Password`;
7. torna al login admin ed entra con le nuove credenziali.

Regole pratiche:

- la password admin deve avere almeno 6 caratteri;
- il reset code serve solo per inizializzare o reimpostare la password;
- il reset code non sostituisce il login admin quotidiano.

## 5. Dove vengono salvate le credenziali iniziali

Dopo il reset iniziale:

- l'hash della password admin viene salvato in `Data/config/admin-auth.json`;
- il nome utente admin viene salvato insieme all'hash;
- il reset code non viene scritto in `Data/`, resta solo nella variabile ambiente della sessione corrente.

Quando chiudi PowerShell, le variabili `$env:...` impostate solo in quella finestra non restano attive.

## 6. Prime credenziali operative da creare

Dopo l'accesso admin conviene creare subito:

### Primo reparto

Dal menu admin:

1. apri `Crea reparto`;
2. inserisci il nome del reparto;
3. opzionalmente inserisci una `Password reparto iniziale`.

Se preferisci creare il reparto senza password e proteggerlo dopo, entra nel reparto e usa `Imposta password reparto` dal menu admin.

### Primo utente locale

Dal menu admin:

1. apri `Gestione utenti`;
2. clicca `Nuovo utente locale`;
3. compila almeno `Username` e `Password`;
4. salva con `Crea utente locale`.

Regole pratiche:

- per un nuovo utente locale la password minima e' di 6 caratteri;
- il campo `Reparto` puo' essere valorizzato subito se vuoi associare l'utente a un reparto;
- se LDAP non e' attivo, gli utenti normali accedono come utenti locali.

## 7. Come accede il primo utente

Nella scheda `Reparto` della login page:

1. inserisce il proprio nome utente;
2. inserisce la password utente se richiesta;
3. seleziona il reparto;
4. se il reparto e' protetto, inserisce anche la password reparto.

In pratica:

- password utente = identita' personale del singolo utente locale o LDAP;
- password reparto = protezione del reparto, separata dalla password utente.

## 8. Riavvio normale del server

Dopo che la password admin e' stata inizializzata in `Data/config/admin-auth.json`, per i riavvii successivi basta normalmente:

```powershell
cd D:\GITHUB\OnlyGANTT
npm start
```

Non serve piu' reimpostare il reset code, salvo quando vuoi abilitare di nuovo il reset password admin dalla schermata di login.

## 9. Metodo alternativo piu' rapido

Se vuoi partire subito senza reset code, puoi impostare la password admin via variabile ambiente:

```powershell
$env:ONLYGANTT_ADMIN_USER = 'admin'
$env:ONLYGANTT_ADMIN_PASSWORD = 'UnaPasswordProvvisoria'
npm start
```

Questo metodo e' utile per test veloci, ma ha un limite importante:

- finche' la password arriva da `ONLYGANTT_ADMIN_PASSWORD`, la UI considera la password admin gestita dall'ambiente e non la rende modificabile dalla schermata di reset/cambio password.

Per un server stabile e piu' facile da mantenere, il flusso con `ONLYGANTT_ADMIN_RESET_CODE` resta quello consigliato.

## 10. Problemi comuni

### Messaggio: "Password admin non configurata"

Significa che il server e' partito senza:

- `ONLYGANTT_ADMIN_PASSWORD`;
- una password admin gia' salvata in `Data/config/admin-auth.json`.

Soluzione: avvia il server con `ONLYGANTT_ADMIN_RESET_CODE` oppure con `ONLYGANTT_ADMIN_PASSWORD`.

### Porta 3000 occupata

Avvia il server su un'altra porta:

```powershell
$env:PORT = '3001'
npm start
```

Poi apri `http://localhost:3001`.

### Vuoi usare una cartella dati diversa da `Data/`

Imposta prima dell'avvio:

```powershell
$env:ONLYGANTT_DATA_DIR = 'D:\OnlyGanttData'
npm start
```

Usa questa opzione solo se vuoi separare i dati runtime dal repository.
