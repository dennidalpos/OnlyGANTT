/**
 * OnlyGANTT Landing Page & Privacy Policy JavaScript Engine
 * Bilingual (ITA/ENG) logic, Lightbox Controller & Download Links
 */

(function () {
  'use strict';

  // --- Translation Dictionary ---
  const i18n = {
    ita: {
      // Nav
      nav_features: 'Funzionalità',
      nav_gallery: 'Workflow & Galleria',
      nav_downloads: 'Download Pacchetti',
      nav_arch: 'Architettura',
      nav_privacy: 'Privacy & GDPR',

      // Hero
      hero_badge: '⚡ Web Application Windows-Native per Gantt',
      hero_title: 'Gestione Diagrammi di Gantt aziendali in ambiente Windows local-first.',
      hero_subtitle: 'OnlyGANTT offre un’interfaccia web responsive per la pianificazione di progetti per reparto, con blocco multi-utente persisto, supporto festivita italiane, auth LDAP facoltativa e Windows Service Host nativo.',
      btn_download_setup: 'Scarica Setup EXE (Node 24 Incluso)',
      btn_download_msi: 'Scarica Installer MSI',
      btn_explore_workflows: 'Esplora i Workflow',
      window_title: 'OnlyGANTT - Dashboard Gantt di Reparto',

      // Section Titles
      sec_features_tag: 'POTENZA E SEMPLICITÀ',
      sec_features_title: 'Funzionalità integrate per i team aziendali',
      sec_features_sub: 'Progettato per funzionare in locale o in rete aziendale Windows, con persistenza sicura senza dipendenze cloud terze.',

      sec_gallery_tag: 'GALLERIA WORKFLOW',
      sec_gallery_title: 'Esplora i flussi di lavoro principali',
      sec_gallery_sub: 'Clicca su ciascuna schedula per visualizzare l’anteprima interattiva ed i dettagli operativi.',

      sec_packages_tag: 'DOWNLOAD UFFICIALI',
      sec_packages_title: 'Scarica i pacchetti generati dal repository',
      sec_packages_sub: 'Scegli la modalità di installazione o l’archivio portabile più adatto al tuo ambiente Windows.',

      sec_arch_tag: 'STACK TECNOLOGICO',
      sec_arch_title: 'Architettura moderna e performante',
      sec_arch_sub: 'Costruito su tecnologie solide per garantire la massima stabilità in ambienti enterprise.',

      // Feature Cards
      feat1_title: 'Gantt Interattivo e Festività',
      feat1_desc: 'Cronoprogramma con fasi, percentuali, pietre miliari, avvisi di ritardo e calendario completo delle festività italiane.',
      feat2_title: 'Blocco Concorrenza Multi-Utente',
      feat2_desc: 'Gestione dei file `.json` per reparto con lock persistente (`locks.json`), timeout configurabile e prevenzione dei conflitti.',
      feat3_title: 'Autenticazione Enterprise & LDAP',
      feat3_desc: 'Accesso locale, password di reparto, supporto LDAP facoltativo con fallback locale e reset protetto per l’amministratore.',
      feat4_title: 'Windows Service Host (.NET 10)',
      feat4_desc: 'Servizio Windows autonomo eseguibile in background (`OnlyGantt.Service.exe`) compilato in single-file self-contained.',
      feat5_title: 'Export / Import e Backup',
      feat5_desc: 'Importazione ed esportazione immediata di progetti in formato JSON e gestione automatica dei file di backup `.bak`.',
      feat6_title: 'Installer WiX 3.14.1 Offline',
      feat6_desc: 'Pacchetti MSI ed EXE che includono Node.js 24 LTS x64 come prerequisito per un’installazione completa offline.',

      // Workflow Cards
      wf1_title: '1. Cronoprogramma & Gantt di Reparto',
      wf1_desc: 'Pianificazione visiva delle fasi di progetto con zoom dinamico (Giorno, 4-Mesi, Anno), indicatori di stato e milestone.',
      wf1_badge: 'Gantt timeline',
      wf1_detail: 'Interfaccia avanzata per la gestione visuale delle scadenze di progetto. Consente la personalizzazione delle barre di avanzamento, l’assegnazione delle fasi ai reparti aziendali e l’evidenziazione automatica dei giorni festivi italiani. Ogni modifica viene registrata nel file di reparto.',
      wf1_h1: 'Festività Italiane integrate automaticamente',
      wf1_h2: 'Visualizzazione flessibile: Giorni, 4 Mesi, Anno',
      wf1_h3: 'Calcolo automatico percentuali di completamento',

      wf2_title: '2. Gestione Lock Multi-Utente',
      wf2_desc: 'Controllo della concorrenza sui file JSON dei reparti con stato di blocco in tempo reale e rilascio automatico.',
      wf2_badge: 'Concurrency Control',
      wf2_detail: 'Sistema di blocco per prevenire sovrascritture accidentali. Quando un utente apre un progetto in modifica, OnlyGANTT registra il lock in locks.json per 60 minuti. Gli altri utenti possono consultare il progetto in sola lettura fino allo sblocco.',
      wf2_h1: 'Blocco automatico a tempo (default 60 min)',
      wf2_h2: 'Consultazione simultanea in sola lettura',
      wf2_h3: 'Persistenza dello stato tra i riavvii del server',

      wf3_title: '3. Autenticazione & Sicurezza LDAP',
      wf3_desc: 'Integrazione con Active Directory/LDAP aziendale o autenticazione locale con password criptata per reparto.',
      wf3_badge: 'Enterprise Security',
      wf3_detail: 'Supporto avanzato per la sicurezza dell’infrastruttura. L’amministratore può configurare il binding LDAP mantenendo la password in configurazioni locali non tracciate in Git. Fallback automatico su utenti locali in caso di indisponibilità del dominio.',
      wf3_h1: 'Integrazione Active Directory / LDAP',
      wf3_h2: 'Password di protezione per singolo reparto',
      wf3_h3: 'Credenziali LDAP isolate e protette',

      wf4_title: '4. Servizio Windows & Installer WiX',
      wf4_desc: 'Setup bootstrapper EXE standalone con prerequisito Node.js 24 LTS e servizio Windows nativo per l’avvio automatico.',
      wf4_badge: 'Windows Packaging',
      wf4_detail: 'Distribuzione semplificata per ambienti Windows Server e Client 10/11. Il pacchetto Setup EXE rileva o installa Node.js 24 LTS x64, configura il servizio Windows OnlyGanttWeb ed imposta le scorciatoie desktop per utenti ed amministratori.',
      wf4_h1: 'Installer Setup Bootstrapper EXE offline',
      wf4_h2: 'Servizio Windows a 64 bit self-contained',
      wf4_h3: 'Collegamento Desktop con avvio automatico',

      // Package Cards
      pkg1_title: 'Setup Bootstrapper EXE',
      pkg1_desc: 'Installatore completo raccomandato per Windows 10/11 e Windows Server. Include Node.js 24 LTS x64.',
      pkg1_tag: 'RACCOMANDATO',
      pkg1_f1: 'Installazione guidata completa',
      pkg1_f2: 'Include prerequisito Node.js 24 LTS x64',
      pkg1_f3: 'Configurazione automatica Servizio Windows',

      pkg2_title: 'Installer Standalone MSI',
      pkg2_desc: 'Pacchetto MSI per distribuzione centralizzata enterprise via GPO o Microsoft Intune (richiede Node.js già installato).',
      pkg2_tag: 'ENTERPRISE MSI',
      pkg2_f1: 'Installazione nativa Windows x64 per macchina',
      pkg2_f2: 'Pronto per deployment GPO / Active Directory',
      pkg2_f3: 'Richiede Node.js 20+ già presente sul sistema',

      pkg3_title: 'Pacchetto Sorgente / Portabile ZIP',
      pkg3_desc: 'Archivio portabile per esecuzione immediata senza installazione o per sviluppatori.',
      pkg3_tag: 'PORTABLE ZIP',
      pkg3_f1: 'Esecuzione diretta via `npm start`',
      pkg3_f2: 'Codice sorgente React 19 + Express',
      pkg3_f3: 'Nessuna modifica al registro di Windows',

      // Download Buttons
      btn_download_now: 'Scarica Ora (.exe)',
      btn_download_msi_action: 'Scarica MSI (.msi)',
      btn_download_zip_action: 'Scarica ZIP Sorgenti',

      // Architecture Items
      arch1_title: 'Node.js 24 LTS',
      arch1_sub: 'Web server Express 5 per la gestione delle API e delle risorse.',
      arch2_title: '.NET 10 C# Service',
      arch2_sub: 'Host di servizio Windows self-contained compilato native x64.',
      arch3_title: 'React 19 + esbuild',
      arch3_sub: 'Interfaccia utente ultra-veloce con bundling ottimizzato.',
      arch4_title: 'WiX Packaging 3.14',
      arch4_sub: 'Bootstrapper offline e MSI installer aziendale.',

      // Privacy Page Specific
      priv_title: 'Privacy Policy & Conformità GDPR',
      priv_updated: 'Ultimo aggiornamento: 20 Luglio 2026',
      priv_intro: 'La presente informativa descrive le modalità di gestione del software OnlyGANTT con riferimento al trattamento dei dati personali degli utenti in conformità al Regolamento Generale sulla Protezione dei Dati (GDPR - Regolamento UE 2016/679).',
      
      priv_h2_1: '1. Principio di Archiviazione Local-First e Telemetria Zero',
      priv_p_1: 'OnlyGANTT è un’applicazione web progettata per funzionare in ambiente locale o su server aziendali dedicati. **Nessun dato relativo ai progetti, agli utenti, alle password o all’utilizzo viene trasmesso a server esterni o terze parti**. Il software include zero sistemi di tracciamento o telemetria.',

      priv_h2_2: '2. Tipologia dei Dati Trattati e Finalità',
      priv_p_2: 'OnlyGANTT tratta esclusivamente i dati inseriti dall’amministratore locale dell’infrastruttura:',
      priv_li_2_1: 'Dati di autenticazione locale (username e password criptate con algoritmo di hash sicuro).',
      priv_li_2_2: 'Credenziali di binding LDAP (se abilitate, conservate esclusivamente in configurazioni locali riservate).',
      priv_li_2_3: 'Dati di progetto e diagrammi di Gantt salvati nei file di reparto (`Data/reparti/*.json`).',
      priv_li_2_4: 'Stato dei blocchi di concorrenza (`Data/config/locks.json`).',

      priv_h2_3: '3. Cookie e Sessioni di Navigazione',
      priv_p_3: 'Il software utilizza esclusivamente cookie tecnici di sessione strettamente necessari al funzionamento del sistema di autenticazione e mantenimento della sessione utente. Non vengono utilizzati cookie di profilazione o di terze parti.',

      priv_h2_4: '4. Diritti dell’Interessato ai sensi del GDPR (Art. 15-22)',
      priv_p_4: 'Gli utenti dell’infrastruttura aziendale su cui è installato OnlyGANTT possono esercitare in qualsiasi momento i diritti previsti dagli articoli 15 e seguenti del GDPR direttamente tramite l’amministratore di sistema locale (accesso, rettifica, cancellazione ed esportazione JSON dei propri progetti).',

      callout_gdpr_title: '🛡️ Garanzia di Riservatezza dei Dati Aziendali',
      callout_gdpr_desc: 'Tutti i dati di progetto e le credenziali rimangono sotto il controllo esclusivo dell’organizzazione che ospita l’istanza di OnlyGANTT.',

      // Footer
      footer_desc: 'OnlyGANTT è l’applicazione web Windows-native per la gestione moderna dei diagrammi di Gantt di reparto.',
      footer_copy: '© 2026 OnlyGANTT. Tutti i diritti riservati.'
    },

    eng: {
      // Nav
      nav_features: 'Features',
      nav_gallery: 'Workflows & Gallery',
      nav_downloads: 'Package Downloads',
      nav_arch: 'Architecture',
      nav_privacy: 'Privacy & GDPR',

      // Hero
      hero_badge: '⚡ Windows-Native Web Application for Gantt',
      hero_title: 'Enterprise local-first Gantt Chart Management for Windows.',
      hero_subtitle: 'OnlyGANTT delivers a responsive web interface for department project scheduling, featuring persisted multi-user file locking, Italian holiday calendars, optional LDAP auth, and a native Windows Service Host.',
      btn_download_setup: 'Download Setup EXE (Node 24 Bundled)',
      btn_download_msi: 'Download MSI Installer',
      btn_explore_workflows: 'Explore Workflows',
      window_title: 'OnlyGANTT - Department Gantt Dashboard',

      // Section Titles
      sec_features_tag: 'POWER & SIMPLICITY',
      sec_features_title: 'Built-in features for enterprise teams',
      sec_features_sub: 'Engineered for local execution or corporate Windows networks, with secure persistence and zero third-party cloud dependencies.',

      sec_gallery_tag: 'WORKFLOW GALLERY',
      sec_gallery_title: 'Explore key operational workflows',
      sec_gallery_sub: 'Click on any workflow card to view an interactive preview and operational details.',

      sec_packages_tag: 'OFFICIAL DOWNLOADS',
      sec_packages_title: 'Download repository-generated packages',
      sec_packages_sub: 'Select the setup installer or portable archive best suited for your Windows environment.',

      sec_arch_tag: 'TECH STACK',
      sec_arch_title: 'Modern and high-performance architecture',
      sec_arch_sub: 'Built on robust technologies ensuring maximum stability in enterprise environments.',

      // Feature Cards
      feat1_title: 'Interactive Gantt & Holidays',
      feat1_desc: 'Gantt timeline with project phases, percentage fills, milestone diamonds, delay highlights, and complete Italian holiday calendars.',
      feat2_title: 'Multi-User Concurrency Locks',
      feat2_desc: 'Department `.json` file management with persisted locks (`locks.json`), configurable timeout, and active conflict prevention.',
      feat3_title: 'Enterprise Auth & LDAP',
      feat3_desc: 'Local user access, department passwords, optional LDAP authentication with local fallback, and secure admin password reset.',
      feat4_title: 'Windows Service Host (.NET 10)',
      feat4_desc: 'Autonomous Windows background service (`OnlyGantt.Service.exe`) compiled as a self-contained single-file executable.',
      feat5_title: 'Export / Import & Backups',
      feat5_desc: 'Instant JSON project import and export for department scheduling, with automatic `.bak` backup file creation.',
      feat6_title: 'WiX 3.14.1 Offline Installers',
      feat6_desc: 'MSI and Setup EXE installers bundling Node.js 24 LTS x64 for seamless offline installation.',

      // Workflow Cards
      wf1_title: '1. Department Timeline & Gantt Chart',
      wf1_desc: 'Visual scheduling of project phases with dynamic zoom (Day, 4-Month, Year), status indicators, and milestones.',
      wf1_badge: 'Gantt timeline',
      wf1_detail: 'Advanced interface for visual project deadline management. Custom progress bars, department phase allocation, and automatic Italian holiday highlighting. All modifications are persisted directly to department files.',
      wf1_h1: 'Built-in Italian national holidays calendar',
      wf1_h2: 'Flexible views: Day, 4-Month, Year timeline',
      wf1_h3: 'Automatic completion percentage calculation',

      wf2_title: '2. Multi-User Lock Control',
      wf2_desc: 'Concurrency control on department JSON files with real-time lock status and automatic timeout release.',
      wf2_badge: 'Concurrency Control',
      wf2_detail: 'Locking system to prevent accidental file overwrites. When a user opens a project for editing, OnlyGANTT registers a lock in locks.json for 60 minutes. Other team members can view the project in read-only mode until unlocked.',
      wf2_h1: 'Automatic timed locking (60 min default)',
      wf2_h2: 'Simultaneous read-only viewing for team members',
      wf2_h3: 'State persistence across server restarts',

      wf3_title: '3. LDAP & Enterprise Security',
      wf3_desc: 'Integration with corporate Active Directory/LDAP or local password protection per department.',
      wf3_badge: 'Enterprise Security',
      wf3_detail: 'Advanced security for corporate infrastructure. System administrators can configure LDAP bind authentication while keeping secrets in ignored local sidecar files. Automatic fallback to local users ensures continuous access.',
      wf3_h1: 'Active Directory / LDAP integration',
      wf3_h2: 'Department-level password protection',
      wf3_h3: 'Isolated and secured LDAP credentials',

      wf4_title: '4. Windows Service & WiX Setup',
      wf4_desc: 'Standalone EXE setup bootstrapper bundling Node.js 24 LTS x64 prerequisite and native Windows Service.',
      wf4_badge: 'Windows Packaging',
      wf4_detail: 'Simplified deployment for Windows Server and Windows 10/11 environments. The Setup EXE detects or installs Node.js 24 LTS x64, configures the OnlyGanttWeb Windows service, and creates desktop shortcuts for users and admins.',
      wf4_h1: 'Offline Setup Bootstrapper EXE installer',
      wf4_h2: 'Self-contained 64-bit Windows Service Host',
      wf4_h3: 'Desktop URL shortcuts with automatic startup',

      // Package Cards
      pkg1_title: 'Setup Bootstrapper EXE',
      pkg1_desc: 'Recommended complete installer for Windows 10/11 and Windows Server. Bundles Node.js 24 LTS x64.',
      pkg1_tag: 'RECOMMENDED',
      pkg1_f1: 'Complete setup wizard',
      pkg1_f2: 'Bundles Node.js 24 LTS x64 prerequisite',
      pkg1_f3: 'Automatic Windows Service configuration',

      pkg2_title: 'Standalone MSI Installer',
      pkg2_desc: 'MSI package for centralized enterprise deployment via GPO or Microsoft Intune (requires pre-installed Node.js).',
      pkg2_tag: 'ENTERPRISE MSI',
      pkg2_f1: 'Native x64 per-machine Windows installer',
      pkg2_f2: 'GPO & Active Directory deployment ready',
      pkg2_f3: 'Requires Node.js 20+ on target machine',

      pkg3_title: 'Source Code / Portable ZIP',
      pkg3_desc: 'Portable archive for instant execution without installation or for developers.',
      pkg3_tag: 'PORTABLE ZIP',
      pkg3_f1: 'Direct execution via `npm start`',
      pkg3_f2: 'Full React 19 + Express source code',
      pkg3_f3: 'Zero registry modifications',

      // Download Buttons
      btn_download_now: 'Download Now (.exe)',
      btn_download_msi_action: 'Download MSI (.msi)',
      btn_download_zip_action: 'Download Source ZIP',

      // Architecture Items
      arch1_title: 'Node.js 24 LTS',
      arch1_sub: 'Express 5 web server managing REST APIs and static assets.',
      arch2_title: '.NET 10 C# Service',
      arch2_sub: 'Native x64 self-contained Windows service host.',
      arch3_title: 'React 19 + esbuild',
      arch3_sub: 'Ultra-fast browser client bundle and state engine.',
      arch4_title: 'WiX Packaging 3.14',
      arch4_sub: 'Offline bootstrapper and enterprise MSI installer.',

      // Privacy Page Specific
      priv_title: 'Privacy Policy & GDPR Compliance',
      priv_updated: 'Last Updated: July 20, 2026',
      priv_intro: 'This policy describes how OnlyGANTT handles personal data and information in compliance with the General Data Protection Regulation (GDPR - EU Regulation 2016/679).',

      priv_h2_1: '1. Local-First Architecture & Zero Telemetry',
      priv_p_1: 'OnlyGANTT is designed to run strictly on local machines or internal corporate servers. **No project data, user credentials, passwords, or usage metrics are ever sent to external servers or third parties**. The application contains zero tracking, analytics, or telemetry systems.',

      priv_h2_2: '2. Processed Data Categories & Purpose',
      priv_p_2: 'OnlyGANTT exclusively processes data stored by your local infrastructure administrator:',
      priv_li_2_1: 'Local authentication credentials (usernames and passwords hashed securely).',
      priv_li_2_2: 'LDAP binding configuration (when enabled, stored in ignored local sidecar config files).',
      priv_li_2_3: 'Department Gantt chart files saved under `Data/reparti/*.json`.',
      priv_li_2_4: 'Concurrency lock states under `Data/config/locks.json`.',

      priv_h2_3: '3. Cookies & Session Management',
      priv_p_3: 'The web application only uses essential technical session cookies required for authentication and active user session state. No marketing, tracking, or third-party cookies are used.',

      priv_h2_4: '4. Data Subject Rights Under GDPR (Art. 15-22)',
      priv_p_4: 'Users of an organization hosting an OnlyGANTT instance may exercise their rights under Articles 15-22 of the GDPR at any time directly through their local system administrator (access, correction, deletion, and JSON export of project data).',

      callout_gdpr_title: '🛡️ Corporate Data Privacy Guarantee',
      callout_gdpr_desc: 'All project timelines and access credentials remain under the exclusive control of the organization hosting the OnlyGANTT instance.',

      // Footer
      footer_desc: 'OnlyGANTT is the Windows-native web application for modern department Gantt project scheduling.',
      footer_copy: '© 2026 OnlyGANTT. All rights reserved.'
    }
  };

  // --- Workflow Gallery Data ---
  const workflowsData = {
    wf1: {
      img: 'assets/gallery/workflow-gantt-timeline.jpg',
      keyTitle: 'wf1_title',
      keyDesc: 'wf1_desc',
      keyDetail: 'wf1_detail',
      h1: 'wf1_h1',
      h2: 'wf1_h2',
      h3: 'wf1_h3'
    },
    wf2: {
      img: 'assets/gallery/workflow-user-locks.jpg',
      keyTitle: 'wf2_title',
      keyDesc: 'wf2_desc',
      keyDetail: 'wf2_detail',
      h1: 'wf2_h1',
      h2: 'wf2_h2',
      h3: 'wf2_h3'
    },
    wf3: {
      img: 'assets/gallery/workflow-enterprise-auth.jpg',
      keyTitle: 'wf3_title',
      keyDesc: 'wf3_desc',
      keyDetail: 'wf3_detail',
      h1: 'wf3_h1',
      h2: 'wf3_h2',
      h3: 'wf3_h3'
    },
    wf4: {
      img: 'assets/gallery/workflow-windows-service.jpg',
      keyTitle: 'wf4_title',
      keyDesc: 'wf4_desc',
      keyDetail: 'wf4_detail',
      h1: 'wf4_h1',
      h2: 'wf4_h2',
      h3: 'wf4_h3'
    }
  };

  // --- State Management ---
  let currentLang = localStorage.getItem('onlygantt_lang') || 'ita';

  function applyLanguage(lang) {
    if (!i18n[lang]) return;
    currentLang = lang;
    localStorage.setItem('onlygantt_lang', lang);

    // Update active class on language toggle buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      if (btn.dataset.lang === lang) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update all elements with data-i18n
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (i18n[lang][key]) {
        el.textContent = i18n[lang][key];
      }
    });

    // Update html lang attribute
    document.documentElement.lang = lang === 'ita' ? 'it' : 'en';
  }

  // --- Lightbox Controller ---
  function initLightbox() {
    const modal = document.getElementById('lightboxModal');
    if (!modal) return;

    const modalImg = modal.querySelector('.lightbox-img');
    const modalTitle = modal.querySelector('.lightbox-title');
    const modalDetail = modal.querySelector('.lightbox-detail');
    const h1El = modal.querySelector('.lh-1');
    const h2El = modal.querySelector('.lh-2');
    const h3El = modal.querySelector('.lh-3');
    const closeBtn = modal.querySelector('.lightbox-close');

    document.querySelectorAll('.gallery-card').forEach(card => {
      card.addEventListener('click', function () {
        const wfKey = this.dataset.workflow;
        const data = workflowsData[wfKey];
        if (!data) return;

        if (modalImg) modalImg.src = data.img;
        if (modalTitle) modalTitle.textContent = i18n[currentLang][data.keyTitle] || '';
        if (modalDetail) modalDetail.textContent = i18n[currentLang][data.keyDetail] || '';
        if (h1El) h1El.textContent = i18n[currentLang][data.h1] || '';
        if (h2El) h2El.textContent = i18n[currentLang][data.h2] || '';
        if (h3El) h3El.textContent = i18n[currentLang][data.h3] || '';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    });

    function closeModal() {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  // --- Copy Command Helper ---
  function initCopyButtons() {
    document.querySelectorAll('.btn-copy').forEach(btn => {
      btn.addEventListener('click', function () {
        const cmd = this.dataset.copy;
        if (cmd) {
          navigator.clipboard.writeText(cmd).then(() => {
            const originalText = this.textContent;
            this.textContent = 'Copied!';
            setTimeout(() => {
              this.textContent = originalText;
            }, 1500);
          });
        }
      });
    });
  }

  // --- DOM Initialization ---
  document.addEventListener('DOMContentLoaded', function () {
    // Attach language button handlers
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const selectedLang = this.dataset.lang;
        applyLanguage(selectedLang);
      });
    });

    // Apply saved or default language
    applyLanguage(currentLang);

    // Initialize modules
    initLightbox();
    initCopyButtons();
  });

})();
