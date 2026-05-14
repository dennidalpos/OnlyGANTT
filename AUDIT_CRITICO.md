# AUDIT_CRITICO.md

Audit tecnico severo di OnlyGANTT, eseguito su Windows il 2026-05-14.

## Executive summary

Il progetto compila, passa i test custom e genera MSI/setup con il gate locale. Questo non basta a considerarlo solido: il backend espone lettura/export dei dati reparto senza autenticazione e permette, in configurazione iniziale, sessioni username-only capaci di acquisire lock e salvare dati. La protezione reparto e' in larga parte una convenzione UI, non un vincolo backend.

Il rischio principale e' sicurezza/autorizzazione, seguito da integrita' dati della persistenza JSON file-based e da assenza di lint/typecheck/CI. L'app e' utilizzabile, ma non e' affidabile come sistema multiutente con dati sensibili finche' i controlli server-side non vengono chiusi.

## Stack rilevato

- OS target: Windows.
- Backend: Node.js >=20, Express 4.
- Frontend: React 19, ReactDOM, bundle browser IIFE con esbuild.
- Persistenza: JSON file store sotto `Data/`.
- Auth: sessioni in memoria, local users, admin locale, LDAP opzionale con `ldapts`.
- Lock: Map in memoria + snapshot `Data/config/locks.json`.
- Packaging: PowerShell, WiX 3.14.1, MSI x64, setup bootstrapper, Node.js prerequisite.
- Servizio: host .NET `net10.0-windows` self-contained che avvia `node src/server/server.js`.
- Test: script custom Node/PowerShell, nessun framework test standard.
- Lint/typecheck: assenti.
- CI/CD: nessun workflow versionato.

## Comandi eseguiti

| Comando | Risultato |
| --- | --- |
| `git status --short` | Pulito inizialmente; poi modifiche solo a `PROJECT_STATUS.json` e artefatti audit. |
| `npm run doctor` | Passed. Environment checks passed. |
| `npm run build` | Passed. Bundle client e publish servizio completati. Primo avvio .NET ha emesso banner/telemetria. |
| `npm run test` | Passed. Smoke, security regression, admin flow, client logic, prerequisite e Windows service lifecycle passati. |
| `npm audit --omit=dev --json` | Passed. 0 vulnerabilita' note. |
| `npm audit --json` | Passed. 0 vulnerabilita' note. |
| `npm run gate` | Passed. Preflight, test e package MSI/setup completati. |

Non eseguiti perche' non disponibili:

- `npm run lint`: script assente.
- `npm run typecheck`: script assente.
- CI: workflow assente.

## Problemi ordinati per gravita

### AUD-001 Critical - Security - Dati reparto leggibili/exportabili senza auth

File: `src/server/server.js:1114-1124`, `src/server/server.js:1130-1141`, `src/client/components/LoginScreen.jsx:287-292`

Le API `GET /api/projects/:department` e `GET /api/departments/:name/export` restituiscono dati e metadati senza token, sessione, admin o password reparto. La UI chiama `verifyPassword`, ma il backend di lettura non lo impone.

Scenario: un client HTTP chiama direttamente `/api/projects/Demo` o `/api/departments/Demo/export` e ottiene i progetti. Se il reparto e' protetto, la protezione e' aggirata.

Impatto: esposizione dati progettuali. Prima correzione: autorizzazione server-side per lettura/export e legame tra sessione e accesso reparto.

### AUD-002 Critical - Auth/Authz - Username-only login abilita editing in installazione iniziale

File: `src/server/server.js:1490-1500`, `src/server/server.js:1307-1331`, `src/server/server.js:1188-1233`

Se LDAP e' disabilitato e non esistono utenti locali, `/api/auth/login` rilascia token standard con solo username. Quel token puo' acquisire lock e salvare progetti. La password reparto non viene ricontrollata nel salvataggio.

Scenario: installazione pulita, nessun utente locale. Un chiamante invia username arbitrario, acquisisce lock e invia `POST /api/projects/Demo`.

Impatto: modifica non autorizzata dei dati. Prima correzione: disabilitare la modalita' username-only in produzione e richiedere authz per reparto.

### AUD-003 High - Security - Prima password reparto impostabile senza autenticazione

File: `src/server/server.js:1069-1088`

`POST /api/departments/:name/change-password` non richiede sessione. In setup mode, se il reparto non ha password, salta `oldPassword`.

Scenario: un anonimo imposta password su un reparto non protetto e blocca gli utenti legittimi.

Impatto: lockout funzionale. Correzione: setup password admin-only o utente autorizzato con lock.

### AUD-004 High - Security - Nessun rate limit e scrypt sincrono

File: `src/server/server.js:373-382`, `src/server/server.js:1556-1567`, `src/server/server.js:1598-1616`, `src/server/userStore.js:44-55`

Login, reset e verifica password non hanno throttling. Le verifiche usano `crypto.scryptSync`, quindi caricano l'event loop.

Scenario: molti tentativi password in parallelo bloccano richieste legittime.

Impatto: bruteforce e DoS applicativo. Correzione: rate limit, backoff, audit fallimenti, hashing asincrono o worker pool.

### AUD-005 High - Security - Reset code admin negli argomenti servizio Windows

File: `tools/wix/Product.wxs:33`, `tools/wix/Product.wxs:148-158`, `src/service/OnlyGantt.Service/Program.cs:242-244`

Il reset code admin e' Hidden/Secure nel dialog MSI, ma viene passato come `--admin-reset-code` negli argomenti del servizio.

Scenario: inventory, configurazione servizio o tool amministrativi leggono la command line persistita.

Impatto: esposizione segreto di recupero admin. Correzione: storage protetto ACL/DPAPI o token monouso post-install.

### AUD-006 High - Robustness - Numeri config critici senza range

File: `src/server/server.js:35-37`, `src/server/server.js:462-465`, `src/server/server.js:1731-1734`, `src/client/components/SystemSettings.jsx:183-214`

`parseNumber` accetta ogni numero finito. TTL sessioni, lock timeout e upload limit possono diventare 0, negativi o enormi.

Scenario: import settings o admin UI invia `lockTimeoutMinutes=-1`; i lock scadono subito o il comportamento diventa incoerente.

Impatto: app inutilizzabile o instabile. Correzione: validazione server-side con range espliciti.

### AUD-007 High - Data Integrity - Persistenza JSON fragile e non cross-process safe

File: `src/server/server.js:145-158`, `src/server/lockStore.js:13-18`, `src/server/userStore.js:121-132`

Le scritture eliminano il file target prima del rename. Non ci sono fsync, lock di file o prevenzione di due processi sullo stesso `Data`.

Scenario: crash tra unlink e rename, disco pieno, antivirus o avvio manuale mentre il servizio e' attivo.

Impatto: perdita/corruzione dati e lock incoerenti. Correzione: file lock robusto o database embedded.

### AUD-008 Medium - API - Body JSON limit non allineato a maxUploadBytes

File: `src/server/server.js:73`, `src/server/server.js:1958-1997`

`express.json()` usa il default; `ONLYGANTT_MAX_UPLOAD_BYTES` copre solo multer. Import admin modulari grandi falliscono prima della logica applicativa.

Correzione: `express.json({ limit })` con limite validato e test su backup grandi.

### AUD-009 Medium - Security - Dettagli interni esposti in error response

File: `src/server/server.js:1024-1025`, `src/server/server.js:1234-1235`, `src/server/server.js:1764-1765`, `src/server/httpsService.js:4-12`

Molti catch ritornano `err.message`; alcuni messaggi includono path locali.

Correzione: messaggi pubblici stabili e dettagli solo nei log.

### AUD-010 Medium - Data Integrity - Import admin non transazionale

File: `src/server/server.js:1958-2048`, `src/server/server.js:898-966`

Importa reparti, utenti e settings in sequenza senza validazione completa prima della scrittura e senza rollback.

Correzione: validate-plan-apply o import parziale esplicito con conferma.

### AUD-011 Medium - Robustness - Client assume JSON sempre valido

File: `src/client/api.js:42-57`, `src/client/api.js:181-206`, `src/client/api.js:213-241`

`JSON.parse` e `response.json()` non sono protetti. Errori HTML/proxy/413 rompono la UX con eccezioni generiche.

Correzione: parser centralizzato content-type aware con fallback testo.

### AUD-012 Medium - UX/Data Loss - Conflitto revision scarta modifiche locali

File: `src/client/hooks/useProjects.js:101-108`

Su 409 il client chiama `loadProjects()` prima di lanciare errore, sostituendo lo stato locale.

Correzione: conservare draft locale e mostrare merge/diff.

### AUD-013 Medium - Logic - Cache Gantt ignora campi fase

File: `src/utils/utils-gantt.js:236-249`

La chiave cache usa solo id/date progetto e numero fasi. Date, nomi, milestone e colori delle fasi non entrano nella chiave.

Correzione: includere campi fase o usare revision esplicita.

### AUD-014 Medium - Data Integrity - ID client con Math.random e duplicati non rilevati

File: `src/utils/utils-logic.js:346-350`, `src/server/schema.js:167-179`

Il client genera UUID-like con `Math.random`; il server non rileva duplicati validi.

Correzione: `crypto.randomUUID()` e vincolo unicita' server-side.

### AUD-015 Medium - Logic - Schema senza invarianti temporali/semantiche

File: `src/server/schema.js:83-136`, `src/server/schema.js:139-165`

Il backend valida formato ma non relazioni: inizio <= fine, fase dentro progetto, colori, percentuale/stato coerenti.

Correzione: definire invarianti server-side e distinguere errori da warning.

### AUD-016 Medium - Performance - LDAP users list non paginata e scrive durante request

File: `src/server/ldapService.js:427-486`, `src/server/server.js:1769-1810`

`GET /api/admin/users` puo' enumerare tutta la directory e upsertare ogni utente.

Correzione: paging, ricerca filtrata, limiti e sync asincrona.

### AUD-017 Medium - DevEx/Test - Mancano lint, typecheck e CI

File: `package.json:5-28`, `.github:n/a`

Il gate custom passa, ma non c'e' analisi statica ne' workflow versionato.

Correzione: ESLint/TypeScript o check JS statici e CI Windows.

### AUD-018 Medium - Supply Chain - WiX scaricato senza hash

File: `scripts/support/packaging/provision-wix.ps1:52-63`, `scripts/support/packaging/provision-node.ps1:11-49`

Node MSI e' hashato, WiX no. La toolchain MSI e' una dipendenza critica.

Correzione: SHA256 pinning o verifica firma.

### AUD-019 Medium - UX/Accessibility - Gantt canvas mouse-centrico

File: `src/client/components/GanttCanvas.jsx:456-557`, `src/client/components/GanttCanvas.jsx:602-610`, `src/client/components/GanttCanvas.jsx:665-676`

Il canvas ha label generica ma tooltip/context menu sono basati su coordinate mouse.

Correzione: layer DOM o tabella sincronizzata accessibile con tastiera.

### AUD-020 Low - Maintenance - Artefatti generati rumorosi nel workspace

File: `.gitignore:1-23`, `src/service/OnlyGantt.Service/bin`, `src/service/OnlyGantt.Service/obj`, `tools/wix314-binaries`

Non sono tracciati, ma presenti localmente in massa. Confondono audit e tooling.

Correzione: usare `npm run clean` prima di audit/release o spostare cache fuori repo.

## Dubbi e perplessita

- Dubbio: la password reparto e' intesa come protezione dati o solo come screensaver/UX? Il codice non la applica al backend di lettura.
- Dubbio: la modalita' username-only e' un requisito produttivo o una scorciatoia bootstrap.
- Dubbio: il dataDir e' sempre usato da un solo processo? Il progetto non lo garantisce.
- Perplessita: admin token e user token vivono solo in memoria; restart invalida sessioni ma lock snapshot sopravvive.
- Perplessita: settings HTTPS possono essere salvati, ma il server corrente non cambia protocollo finche' non viene riavviato.
- Perplessita: LDAP list utenti e' progettata come elenco completo, ma una directory reale puo' essere grande.

## Gap analysis

### Aree non coperte

- Test e2e browser reali.
- Test accessibilita'.
- Test concorrenza multiutente/multiprocesso.
- Test recovery da crash durante scrittura JSON.
- Test LDAP con server reale e directory grande.
- CI Windows versionata.
- Clean-machine installer validation completa.

### Aree coperte male

- Security regression copre segreti LDAP e alcuni import, ma non autorizzazione lettura reparto.
- Smoke/admin flow coprono happy path, non avversarial API direct.
- Client logic test copre utility, non rendering browser reale o keyboard UX.
- Packaging passa localmente, ma non prova ambiente Windows pulito senza runtime.

### Aree ambigue

- Scopo della password reparto.
- Ruoli e permessi per utenti locali vs LDAP.
- Politica di primo avvio e bootstrap admin.
- Semantica di import parziale.
- Requisiti di accessibilita'.
- Politica di retention log/audit.

### Assunzioni pericolose

- Client affidabile per decidere accesso reparto.
- Un solo processo Node sul dataDir.
- Admin inserisce sempre valori config validi.
- Response HTTP sempre JSON.
- Directory LDAP piccola.
- Rete locale fidata.

### Domande aperte

- I dati progetto sono confidenziali?
- Un utente standard deve poter vedere tutti i reparti?
- Un utente standard deve poter modificare qualunque reparto se conosce il nome?
- La password reparto deve essere per lettura, scrittura o solo screensaver?
- Il reset admin deve restare attivo dopo installazione?
- Chi crea il primo admin/utente locale?
- Sono previsti audit log per login falliti e modifiche dati?
- Sono previsti backup/restore atomici?
- Il deploy usa reverse proxy/TLS o HTTP diretto?
- La distribuzione e' solo LAN o anche remota?

### Cose da verificare manualmente

- Installazione setup su Windows pulito senza Node.
- Uninstall/upgrade con dati esistenti.
- Doppio avvio servizio + `npm start` sullo stesso dataDir.
- Comportamento con backup >100 KB su admin import.
- LDAP con paging/limiti reali.
- Accessibilita' tastiera/screen reader del Gantt.
- Recovery dopo kill del processo durante save.
- Permessi ACL su `Data/` in installazione MSI.

### Funzionalita apparentemente previste ma incomplete

- Autorizzazione reparto reale server-side.
- Merge o gestione non distruttiva dei conflitti revision.
- Audit completo degli eventi sicurezza.
- CI/CD versionata.
- Validazione forte schema dati.
- Accessibilita' completa del Gantt.

## Raccomandazioni prioritarie

1. Chiudere authz backend su lettura/export/save/import/upload.
2. Rimuovere username-only da produzione.
3. Proteggere setup password reparto.
4. Aggiungere rate limiting e logging sicurezza.
5. Validare range config e schema dati.
6. Rendere persistenza robusta o migrare a database embedded.
7. Rendere import atomico o esplicitamente parziale.
8. Migliorare parsing/error handling client.
9. Aggiungere lint/typecheck/CI.
10. Verificare clean-machine installer.

## Quick wins

- `express.json({ limit: CONFIG.maxUploadBytes })` con range validato.
- `crypto.randomUUID()` nel client.
- Hash pinning WiX.
- Test diretti su API non autorizzate.
- Middleware centralizzato authz.
- Error response pubbliche standard.
- ESLint base e workflow Windows.

## Rischi sistemici

- Sicurezza disegnata come flusso UI invece che contratto backend.
- File store sincrono cresciuto oltre il suo perimetro naturale.
- Multiutente basato su lock applicativo fragile.
- Test locali buoni ma troppo focalizzati su regressioni gia' note.
- Packaging validato localmente ma non ancora in ambiente pulito reale.

## Classificazione finale

Stato progetto: **Rischioso**.

Motivazione sintetica: build/test/package passano, ma le vulnerabilita' di autorizzazione sono strutturali. Un sistema che espone dati reparto e consente sessioni standard username-only non puo' essere considerato solido in produzione, anche se il gate tecnico locale e' verde.

## Top 10 problemi da risolvere prima

1. Lettura/export reparto senza auth.
2. Login username-only con potere di editing.
3. Password reparto non applicata lato backend.
4. Change-password reparto senza auth in setup mode.
5. Assenza rate limit su password/admin reset.
6. Reset code admin negli argomenti servizio.
7. Config numeriche senza range.
8. Persistenza JSON non cross-process safe.
9. Import admin non transazionale.
10. Nessun lint/typecheck/CI.

## Top 10 domande da chiarire col proprietario

1. Quali dati sono confidenziali e per chi?
2. Che cosa deve proteggere la password reparto?
3. La login username-only e' ammessa in produzione?
4. Quale modello ruoli/reparti e' desiderato?
5. Come si effettua bootstrap sicuro del primo admin?
6. Il server sara' esposto oltre localhost/LAN?
7. Il dataDir puo' essere condiviso da piu' processi o macchine?
8. L'import parziale e' accettabile?
9. Quali requisiti WCAG/accessibilita' esistono?
10. Quale livello di audit log e retention e' richiesto?
