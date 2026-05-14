# AUDIT_ACTION_PLAN.md

Piano consigliato dopo audit tecnico del 2026-05-14.

## Priorita immediate

1. Bloccare lettura/export e mutazioni reparto senza autorizzazione server-side.
   - Sforzo: alto.
   - Rischio se non si interviene: esposizione e modifica non autorizzata dei dati.
   - Test dopo intervento: chiamate dirette a `/api/projects/:department`, export, save, import e upload senza token/password devono fallire.

2. Rimuovere o confinare la login username-only.
   - Sforzo: medio.
   - Rischio se non si interviene: qualunque utente di rete puo' ottenere token standard.
   - Test dopo intervento: installazione pulita richiede bootstrap admin/utente esplicito; modalita' demo deve essere opt-in.

3. Correggere setup/change password reparto.
   - Sforzo: medio.
   - Rischio se non si interviene: lockout reparto da chiamante anonimo.
   - Test dopo intervento: primo set password richiede admin o utente autorizzato con lock.

4. Introdurre rate limit e protezione DoS sugli endpoint password.
   - Sforzo: medio.
   - Rischio se non si interviene: bruteforce e blocco event loop.
   - Test dopo intervento: tentativi ripetuti producono 429/backoff e log audit.

5. Validare configurazioni numeriche server-side.
   - Sforzo: basso.
   - Rischio se non si interviene: sessioni e lock resi inutilizzabili da valori invalidi.
   - Test dopo intervento: valori 0, negativi, enormi e stringhe non numeriche su system-config/import generano 400.

## Interventi consigliati in ordine

1. Definire modello authz: ruoli, accesso reparto, lettura vs scrittura, admin.
2. Implementare middleware `requireUserSession`, `requireDepartmentRead`, `requireDepartmentWrite`.
3. Spostare la verifica password reparto nel backend e associare l'accesso al token/sessione.
4. Disabilitare username-only di default; aggiungere flag esplicito `ONLYGANTT_ALLOW_ANONYMOUS_STANDARD_LOGIN=false`.
5. Proteggere change-password reparto con admin o sessione autorizzata.
6. Aggiungere rate limiting in memoria o proxy-aware.
7. Rafforzare schema dati con invarianti temporali, colori, unicita' ID.
8. Rendere import admin validante/atomico o esplicitamente parziale con piano e conferma.
9. Sostituire persistenza file fragile con lock file robusto o database embedded.
10. Aggiungere lint/typecheck/CI Windows.

## Rischi se non si interviene

- Dati reparto leggibili da client non autenticati.
- Integrita' dati dipendente da UI e lock non sufficienti.
- Possibile corruzione dati con processi multipli o crash.
- Setup sicurezza ambiguo: modalita' standard aperta vs utenti locali/LDAP.
- Packaging e deploy passano localmente ma non sono coperti da clean-machine automation completa.
- UX multiutente rischia perdita di modifiche in caso di conflitto.

## Quick wins

- Aggiungere `express.json({ limit: CONFIG.maxUploadBytes })` dopo validazione range.
- Validare range per TTL, lock timeout, upload.
- Gestire parsing non JSON in `src/client/api.js`.
- Usare `crypto.randomUUID()` lato client con fallback.
- Aggiungere controllo unicita' ID in `schema.js`.
- Pin SHA256 dell'archivio WiX.
- Aggiungere script `lint` anche solo con ESLint base.
- Aggiungere workflow Windows che esegua `npm run doctor`, `npm run build`, `npm run test`.

## Cosa testare dopo ogni intervento

- Authz: test senza token, token scaduto, token di altro utente, admin token, reparto protetto/non protetto.
- Lock: acquire/release/heartbeat con userName diverso, sessione scaduta, doppio browser.
- Concorrenza: due salvataggi con stessa revision, import durante lock, restart durante scrittura.
- Import/export: backup piccolo, grande, parziale, malformato, con utenti e settings.
- Password: brute force, reset code errato, admin env-managed, cambio password invalida.
- LDAP: server down, credenziali errate, gruppo richiesto, directory grande.
- UI: conflitto revision, rete offline, 413, risposta non JSON, keyboard-only su Gantt.
- Packaging: installazione pulita Windows senza Node, standalone MSI senza prerequisito, uninstall e upgrade.
