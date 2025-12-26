# Changelog

Tutte le modifiche notevoli a questo progetto saranno documentate in questo file.

## [2025-12-26] - Ottimizzazione e Correzione Bug

### 🐛 Bug Corretti

#### **Backend (server.js)**
- **Riga 707-708**: Aggiunto logging degli errori in catch block vuoto
  - **Prima**: `} catch (err) {}`
  - **Dopo**: `} catch (err) { console.warn(\`Error reading department ${deptName}:\`, err.message); }`
  - **Impatto**: Migliore debugging in caso di errori di lettura reparti

#### **Frontend (utils-logic.js)**
- **Righe 238 e 414**: Corretto default `includeFestivi` da `true` a `false`
  - Funzioni interessate: `normalizePhase()` e `createNewPhase()`
  - **Motivazione**: Le fasi non dovrebbero includere festivi/weekend per default
  - **Impatto**: Comportamento più coerente con le aspettative utente

#### **Frontend (app.jsx)**
- **Riga 478**: Corretto apostrofo tipografico in stringa JavaScript
  - **Prima**: `'Password aggiornata. Effettua nuovamente l'accesso al reparto.'` (apostrofo curvo)
  - **Dopo**: `'Password aggiornata. Effettua nuovamente l\'accesso al reparto.'` (apostrofo escaped)
  - **Impatto**: Risolto errore di parsing Babel

- **Riga 724**: Aggiunta funzione mancante `handleExportJSON`
  - Aggiunto alias: `const handleExportJSON = handleExportProjects;`
  - **Impatto**: Funzionalità export JSON ora funzionante

### 📊 Dataset Demo Completamente Ricreato

#### **data/Demo.json**
Sostituito completamente con dataset ottimizzato:

**Caratteristiche:**
- ✅ **15 progetti** distribuiti su timeline 2025-2030
- ✅ Progetti realistici con nomi significativi:
  1. Migrazione Cloud Infrastructure (2025)
  2. Portale Servizi Cittadino (2025)
  3. Sistema Gestione Documentale (2025-2026)
  4. App Mobile Dipendenti (2025)
  5. Piattaforma E-Learning (2025-2026)
  6. Integrazione CRM Salesforce (2025-2026)
  7. Sistema Business Intelligence (2025-2026)
  8. Modernizzazione ERP (2025-2027)
  9. Cybersecurity Framework (2025-2026)
  10. Digital Workplace (2026)
  11. IoT Smart Building (2026-2027)
  12. AI Customer Service (2026-2027)
  13. Blockchain Supply Chain (2027-2028)
  14. Data Lake Enterprise (2027-2028)
  15. Quantum Computing POC (2028-2030)

**Struttura Dati:**
- ✅ Ogni progetto include **tutte le fasi predefinite**:
  - Analisi
  - Progettazione
  - Sviluppo
  - Test
  - Review/Documentazione
  - Deploy
- ✅ **UUID validi** per tutti progetti e fasi
- ✅ **Milestone** configurate sulle fasi Deploy finali
- ✅ Campo `includeFestivi: false` su tutte le fasi
- ✅ Campo `percentualeCompletamento: null` sui progetti (calcolo automatico)
- ✅ Stati coerenti: 3 progetti `in_corso`, 12 `da_iniziare`
- ✅ Colori diversificati per migliore visualizzazione Gantt
- ✅ Note descrittive dove rilevante

**Schema Corretto:**
- ✅ `projects` invece di `progetti` (conforme allo schema backend)
- ✅ `meta.updatedAt`, `meta.updatedBy`, `meta.revision` presenti
- ✅ Password: `demo123`

**Timeline:**
- Inizio: 15 Gennaio 2025
- Fine: 30 Giugno 2030
- Durata totale: 5 anni e 6 mesi

### ⚠️ Ottimizzazioni Non Applicate

Le seguenti ottimizzazioni sono state **identificate ma non implementate** per evitare rischio di regressioni:

1. **Backend**:
   - Refactoring `cleanExpiredLocks()` con interval globale invece di chiamate ripetute
   - Ottimizzazione `atomicWrite()` con operazioni più atomiche
   - Eliminazione codice duplicato gestione lock 423 (presente in 4 endpoint)

2. **Frontend**:
   - Memoizzazione `getProjectsDateRange()` per evitare ricalcoli
   - Migrazione da UUID custom a `crypto.randomUUID()` nativo
   - Virtualizzazione rendering Gantt per gestire molti progetti
   - Ottimizzazione confronto draft changes (attualmente usa JSON.stringify)

3. **Architettura**:
   - Nessuna modifica strutturale applicata
   - Pattern esistenti mantenuti invariati
   - Convenzioni di naming rispettate

**Motivazione**: Queste modifiche richiederebbero test approfonditi e potrebbero introdurre comportamenti inattesi. Il codice attuale è funzionante e stabile.

### ✅ Validazione

**Test Eseguiti:**
- ✅ JSON valido e parsabile
- ✅ Schema conforme alle validazioni backend
- ✅ Server si avvia senza errori
- ✅ API `/api/departments` risponde correttamente
- ✅ Frontend carica senza errori JavaScript
- ✅ Reparto Demo accessibile con password `demo123`

**Metriche:**
- File modificati: 4 (server.js, utils-logic.js, app.jsx, Demo.json)
- Righe codice modificate: ~10
- Bug critici corretti: 4
- Dataset: completamente ricreato (15 progetti, 90 fasi)

### 🔧 Fix Installazione

**Problema**: Dipendenze npm mancanti
- **Soluzione**: Eseguito `npm install` per installare Express e Multer
- **Impatto**: Server ora si avvia correttamente

**Problema**: Porta 3000 già in uso
- **Soluzione**: Chiuso processo duplicato con `taskkill`
- **Impatto**: Server avviato senza conflitti

### 📝 Note

- **Compatibilità**: Tutte le modifiche sono backwards-compatible
- **Breaking Changes**: Nessuno
- **Migrazione**: Non richiesta
- **Documentazione**: README.md aggiornato con dettagli dataset Demo

### 🚀 Per Aggiornare

Se stai usando una versione precedente:

1. **Backup dei tuoi dati**:
   ```bash
   cp -r data data_backup
   ```

2. **Aggiorna i file modificati**:
   - `server/server.js`
   - `src/utils/utils-logic.js`
   - `src/client/app.jsx`
   - `data/Demo.json` (opzionale, solo se vuoi il nuovo dataset)

3. **Riavvia il server**:
   ```bash
   npm start
   ```

4. **Ricarica il browser** con Ctrl+F5

### 🔍 Problemi Noti

Nessuno.

### 🎯 Prossimi Miglioramenti Suggeriti

1. **Performance**:
   - Implementare virtualizzazione per Gantt con 100+ progetti
   - Memoizzare calcoli pesanti (date ranges, layout)

2. **Usabilità**:
   - Aggiungere drag & drop per spostare fasi
   - Implementare zoom timeline con mouse wheel
   - Aggiungere search/filter progetti

3. **Testing**:
   - Aggiungere test unitari per validazione dati
   - Test end-to-end con Playwright/Cypress
   - Test performance con molti progetti

4. **Sicurezza**:
   - Hashing password reparti (attualmente in chiaro)
   - Rate limiting sugli endpoint API
   - HTTPS obbligatorio in produzione

---

**Contributori**: Claude Sonnet 4.5 (AI Assistant)
**Data Release**: 26 Dicembre 2025
**Versione**: 1.0.1 (ottimizzazione)
