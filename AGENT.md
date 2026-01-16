# AGENT - OnlyGANTT Development Guidelines

Questo documento descrive gli standard di sviluppo, code review, UI e quality gates per il progetto OnlyGANTT.

## 1. Standard di Code Review

### 1.1 Checklist Pre-Review

Prima di sottoporre codice a review, verificare:

- [ ] **Nessun errore di linting** - Il codice rispetta le convenzioni JavaScript/JSX
- [ ] **Nessun `console.log` di debug** - Rimuovere log temporanei
- [ ] **Gestione errori** - Tutti i blocchi async hanno try/catch appropriati
- [ ] **AbortController** - Le chiamate API lunghe supportano cancellazione
- [ ] **Dipendenze useCallback/useEffect** - Array di dipendenze completi e corretti
- [ ] **Nessun memory leak** - Cleanup in useEffect per interval/timeout/listener

### 1.2 Criteri di Accettazione

| Categoria | Requisito |
|-----------|-----------|
| **Funzionalità** | La feature funziona come specificato |
| **Regressioni** | Non introduce bug in funzionalità esistenti |
| **Performance** | Non degrada performance rendering Gantt |
| **Sicurezza** | Nessuna vulnerabilità XSS/injection |
| **UX** | Coerenza con design system esistente |

### 1.3 Pattern da Evitare

```javascript
// BAD: Dipendenza mancante
useEffect(() => {
  fetchData(id);
}, []); // id manca nelle dipendenze

// GOOD: Dipendenze complete
useEffect(() => {
  fetchData(id);
}, [id]);

// BAD: onKeyPress deprecato
<input onKeyPress={(e) => ...} />

// GOOD: onKeyDown
<input onKeyDown={(e) => ...} />

// BAD: Mutazione stato diretto
project.fasi.push(newPhase);

// GOOD: Copia immutabile
setProject({ ...project, fasi: [...project.fasi, newPhase] });
```

---

## 2. Workflow di Sviluppo

### 2.1 Branching Strategy

```
main
├── feature/nome-feature    # Nuove funzionalità
├── bugfix/descrizione-bug  # Correzioni bug
└── refactor/area-codice    # Refactoring
```

### 2.2 Commit Convention

Formato: `<tipo>: <descrizione breve>`

| Tipo | Uso |
|------|-----|
| `feat` | Nuova funzionalità |
| `fix` | Correzione bug |
| `refactor` | Refactoring senza cambio funzionalità |
| `style` | Modifiche CSS/styling |
| `docs` | Documentazione |
| `perf` | Ottimizzazioni performance |

Esempi:
```
feat: add milestone filtering in Gantt options
fix: resolve scroll position reset on view change
style: compact Gantt options panel layout
```

### 2.3 File Modificati - Ordine di Caricamento

**CRITICO**: Modifiche ai file devono rispettare l'ordine di caricamento in `public/index.html`:

```
1. src/app-config.js          (configurazione)
2. src/utils/easter.js        (calcolo Pasqua)
3. src/utils/utils-date.js    (utility date)
4. src/utils/utils-logic.js   (logica business)
5. src/utils/utils-gantt.js   (rendering Gantt)
6. src/client/api.js          (client API)
7. src/client/storage.js      (localStorage)
8. src/client/hooks/*.js      (hook React)
9. src/client/components/*.jsx (componenti)
10. src/client/app.jsx         (entry point)
```

### 2.4 Test Manuale Pre-Commit

1. **Avvia server**: `npm start`
2. **Verifica console browser**: nessun errore JavaScript
3. **Test lock**: login con due browser/tab
4. **Test Gantt**: scroll, tooltip, export PNG
5. **Test form**: creazione/modifica progetto e fasi

### 2.5 Documentazione

- Aggiorna `README.md` e `context.md` quando cambiano API, struttura progetto o funzionalità admin.
- Usa la capitalizzazione corretta della directory dati (`Data/`) in tutta la documentazione.

---

## 3. Regole UI e Design System

### 3.1 Colori (CSS Variables)

```css
/* Sfondi */
--bg-primary: #0f172a;    /* Sfondo principale */
--bg-secondary: #1e293b;  /* Card, header */
--bg-tertiary: #334155;   /* Input, hover state */

/* Testo */
--text-primary: #f8fafc;   /* Testo principale */
--text-secondary: #cbd5e1; /* Label, descrizioni */
--text-muted: #94a3b8;     /* Testo disabilitato */

/* Accent */
--accent-primary: #3b82f6; /* Blu primario */
--success: #10b981;        /* Verde successo */
--warning: #f59e0b;        /* Arancione warning */
--error: #ef4444;          /* Rosso errore */
--info: #06b6d4;           /* Ciano info */
```

### 3.1b Font (app-config.js)

Il Gantt canvas usa configurazioni centralizzate in `window.AppConfig.gantt`:

```javascript
FONT_FAMILY: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
PHASE_FONT_SIZE: 12,        // Dimensione testo nelle barre fasi
PHASE_FONT_WEIGHT: '600',   // Peso font fasi (semibold)
PHASE_TEXT_PADDING: 6,      // Padding testo nelle barre
HEADER_FONT_SIZE: 14,       // Mesi e titoli header
HEADER_SMALL_FONT_SIZE: 10, // Numeri settimana e MS
HEADER_TINY_FONT_SIZE: 9    // Numeri e lettere giorni
```

**Note rendering testo fasi**:
- Il testo usa ombreggiatura per migliorare la leggibilità su sfondi colorati
- Il testo viene troncato automaticamente con ellipsis se non entra nella barra
- La percentuale viene sempre mostrata se c'è spazio sufficiente

### 3.2 Spaziature

```css
--spacing-xs: 0.25rem;  /* 4px */
--spacing-sm: 0.5rem;   /* 8px */
--spacing-md: 1rem;     /* 16px */
--spacing-lg: 1.5rem;   /* 24px */
--spacing-xl: 2rem;     /* 32px */
```

### 3.3 Border Radius

```css
--radius-sm: 0.25rem;  /* 4px - badge, chip */
--radius-md: 0.5rem;   /* 8px - input, button */
--radius-lg: 0.75rem;  /* 12px - card */
```

### 3.4 Componenti Standard

| Componente | Classe |
|------------|--------|
| Card container | `.card` |
| Titolo card | `.card-title` |
| Bottone primario | `.btn-success` |
| Bottone secondario | `.btn-secondary` |
| Bottone pericolo | `.btn-danger` |
| Badge | `.badge` + `.badge-{success|warning|error|info}` |
| Form group | `.form-group` |
| Checkbox | `.checkbox-label` |

### 3.5 Regole Topbar

La topbar (HeaderBar.jsx) segue un design essenziale:

**Layout**:
- **Sinistra**: titolo "OnlyGANTT" + contesto (reparto, utente)
- **Destra**: indicatori stato (lock, admin) + menu hamburger

**Classi CSS** (BEM):
- `.topbar` - Container principale sticky
- `.topbar__left` / `.topbar__right` - Sezioni
- `.topbar__title` - Titolo applicazione
- `.topbar__context` - Reparto e utente
- `.topbar__status` / `.topbar__status-item` - Indicatori stato
- `.topbar__menu-btn` - Pulsante hamburger
- `.topbar__dropdown` - Menu dropdown
- `.topbar__dropdown-section` / `.topbar__dropdown-item` - Sezioni e voci menu

**Responsive**:
- < 768px: solo titolo + icone stato + menu
- 769-1024px: titolo + valori contesto + stato completo
- > 1024px: layout completo con etichette

### 3.6 Regole LoginScreen

La schermata di login (LoginScreen.jsx) segue questi principi:

**Struttura**:
- Card centrata con max-width 420px
- Header con titolo e sottotitolo
- Tab bar per switch Reparto/Admin
- Form con sezioni numerate
- Footer con info applicazione

**UX**:
- Auto-focus sul primo campo vuoto
- Validazione in tempo reale con hint colorati
- Stati disabled durante caricamento
- Messaggi errore prominenti con icona

**Classi CSS**:
- `.login-screen` - Container fullscreen centrato
- `.login-card` - Card principale
- `.login-tabs` / `.login-tab` - Tab bar
- `.login-form` - Form container
- `.login-section` / `.login-section-header` - Sezioni numerate
- `.login-error` - Box errore
- `.input-hint` - Hint sotto input (`.warning`, `.success`)

### 3.7 Regole Pannello Filtri

Il pannello filtri (GanttControls) è organizzato in gruppi logici:

| Gruppo | Icona | Filtri |
|--------|-------|--------|
| **Timeline** | 📅 | Anni, Sep. anni, Mesi, Sep. mesi, N° sett., Sep. sett., N° giorni, Lett. giorni, Sep. giorni |
| **Contenuti** | 📋 | Nomi fasi, Percentuali, Solo milestone |
| **Evidenziazioni** | 🎨 | Weekend, Festivi, Ritardi |

**Componenti UI**:
- **Toolbar**: bottone "Filtri" con badge contatore attivi/totali
- **Azioni globali**: "Attiva/Disattiva tutti", "Default vista"
- **Toggle gruppo**: ogni gruppo ha un bottone per attivare/disattivare tutti i suoi filtri
- **Layout responsivo**: 3 colonne (≥1200px), 2 colonne (768-1199px), 1 colonna (<768px)

**Classi CSS**:
- `.filters-panel` - Container principale
- `.filters-actions` - Riga azioni globali
- `.filters-grid` - Griglia gruppi (responsive)
- `.filter-group` - Singolo gruppo
- `.filter-group-header` - Header con icona, titolo e toggle
- `.filter-item` - Singolo checkbox filtro
- `.filter-count` - Badge contatore nel bottone toolbar

---

## 4. Test Strategy e Quality Gates

### 4.1 Livelli di Test

| Livello | Tipo | Copertura |
|---------|------|-----------|
| 1 | Manuale | Tutte le user story |
| 2 | Console | Zero errori JavaScript |
| 3 | Network | API risponde correttamente |
| 4 | Visual | UI coerente su Chrome/Firefox/Edge |

### 4.2 Quality Gates per Merge

```
[ ] Server avvia senza errori
[ ] Nessun errore in console browser
[ ] Lock funziona correttamente
[ ] Gantt rendering OK (entrambe le viste)
[ ] Export PNG funziona
[ ] Form progetto/fasi funziona
[ ] Alert panel mostra avvisi corretti
[ ] Screensaver attiva/disattiva
[ ] Password reparto funziona
```

### 4.3 Performance Benchmarks

| Metrica | Target |
|---------|--------|
| First Paint | < 1s |
| Gantt render (100 fasi) | < 500ms |
| API response | < 200ms |
| Lock acquire | < 300ms |

### 4.4 Browser Support

| Browser | Versione Minima |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Edge | 90+ |
| Safari | 14+ |

---

## 5. Sicurezza

### 5.1 Checklist Sicurezza

- [ ] **Input validation**: Tutti gli input utente validati lato server
- [ ] **Path traversal**: Nomi reparto sanitizzati (no `..`, `/`, `\`)
- [ ] **XSS**: Nessun `dangerouslySetInnerHTML`
- [ ] **CSRF**: Token admin con scadenza
- [ ] **Rate limiting**: Da implementare per endpoint login

### 5.2 Gestione Password

- Password reparti memorizzate in file JSON
- Password admin hardcoded (da spostare in env variable in produzione)
- Token admin con TTL (8 ore default)

### 5.3 Nomi Riservati Windows

Il server rifiuta nomi reparto riservati Windows:
`CON, PRN, AUX, NUL, COM1-9, LPT1-9`

---

## 6. Convenzioni Codice

### 6.1 Naming

| Tipo | Convenzione | Esempio |
|------|-------------|---------|
| Componenti React | PascalCase | `GanttCanvas` |
| Funzioni | camelCase | `handleSaveProject` |
| Costanti | UPPER_SNAKE | `CANVAS_TOP_MARGIN` |
| CSS classes | kebab-case | `gantt-options-panel` |
| File JSX | PascalCase | `ProjectForm.jsx` |
| File JS | camelCase | `useDepartmentLock.js` |

### 6.2 Struttura Componenti

```javascript
(function() {
  'use strict';

  const { useState, useEffect } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function ComponentName({ prop1, prop2 }) {
    // 1. State
    const [state, setState] = useState(null);

    // 2. Refs
    const ref = React.useRef(null);

    // 3. Effects
    useEffect(() => { ... }, [deps]);

    // 4. Handlers
    const handleAction = () => { ... };

    // 5. Render
    return (
      <div>...</div>
    );
  }

  window.OnlyGantt.components.ComponentName = ComponentName;
})();
```

### 6.3 Commenti

```javascript
// Commento singola riga per spiegazioni brevi

/**
 * Descrizione funzione
 * @param {Object} param - Descrizione parametro
 * @returns {boolean} Descrizione ritorno
 */
function exampleFunction(param) { ... }
```

---

## 7. Troubleshooting Comune

| Problema | Causa | Soluzione |
|----------|-------|-----------|
| Schermo bianco | Errore JS | Controlla console browser |
| Lock non funziona | Server non risponde | Riavvia server |
| Gantt non renderizza | Canvas width 0 | Verifica container visibile |
| Password non salvata | localStorage | Verifica stesso hostname:port |
| Export PNG vuoto | Vista non 'full' | Forza viewMode='full' prima di export |

---

## 8. Roadmap Miglioramenti Suggeriti

### Alta Priorità
- [ ] Rate limiting su endpoint login
- [ ] Hashing password reparti (bcrypt)
- [ ] Password admin da environment variable

### Media Priorità
- [ ] Test automatici (Jest)
- [ ] Timeout configurabile per richieste API
- [ ] Logging server strutturato

### Bassa Priorità
- [ ] PWA support
- [ ] Tema chiaro opzionale
- [ ] Internazionalizzazione (i18n)
