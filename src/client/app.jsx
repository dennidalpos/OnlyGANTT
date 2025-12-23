// Main App component
// This is the entry point for the React application

(function() {
  'use strict';

  const { useState, useEffect, useRef } = React;

  const config = window.AppConfig;
  const storage = window.OnlyGantt.storage;
  const gantt = window.OnlyGantt.gantt;
  const api = window.OnlyGantt.api;
  const logic = window.OnlyGantt.logic;

  // Components
  const HeaderBar = window.OnlyGantt.components.HeaderBar;
  const GanttControls = window.OnlyGantt.components.GanttControls;
  const GanttCanvas = window.OnlyGantt.components.GanttCanvas;
  const ProjectForm = window.OnlyGantt.components.ProjectForm;
  const ProjectList = window.OnlyGantt.components.ProjectList;
  const AlertsPanel = window.OnlyGantt.components.AlertsPanel;
  const DepartmentSelector = window.OnlyGantt.components.DepartmentSelector;

  // Hooks
  const useDepartmentLock = window.OnlyGantt.hooks.useDepartmentLock;
  const useProjects = window.OnlyGantt.hooks.useProjects;

  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, info) {
      console.error('OnlyGANTT error:', error, info);
    }

    render() {
      if (this.state.hasError) {
        return (
          <main className="main-container">
            <div className="card">
              <h2 className="card-title">Si è verificato un errore</h2>
              <p className="text-muted">Ricarica la pagina per riprovare.</p>
              {this.state.error?.message && (
                <div className="alert-item">Dettagli: {this.state.error.message}</div>
              )}
            </div>
          </main>
        );
      }

      return this.props.children;
    }
  }

  function App() {
    // User state
    const [userName, setUserName] = useState(storage.getCurrentUser() || '');
    const [pendingUserName, setPendingUserName] = useState(storage.getCurrentUser() || '');
    const [loginMode, setLoginMode] = useState('user');
    const [loginError, setLoginError] = useState('');
    const [adminCredentials, setAdminCredentials] = useState({ userId: '', password: '' });
    const [notifications, setNotifications] = useState([]);

    // Department state
    const [department, setDepartment] = useState(null);
    const [readOnlyDepartment, setReadOnlyDepartment] = useState(false);
    const [lockEnabled, setLockEnabled] = useState(false);

    // Screensaver state
    const [screensaverEnabled, setScreensaverEnabled] = useState(false);
    const [showScreensaver, setShowScreensaver] = useState(false);
    const lastActivityRef = useRef(Date.now());
    const [departmentValidationErrors, setDepartmentValidationErrors] = useState([]);

    // Gantt view state
    const [viewMode, setViewMode] = useState('4months');
    const [selectedProjectIds, setSelectedProjectIds] = useState(new Set());
    const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
    const [filters, setFilters] = useState({
      showDaySeparators: true,
      showWeekSeparators: true,
      showMonthSeparators: true,
      showYearSeparators: true,
      showDayLetters: true,
      showDayNumbers: true,
      showWeekNumbers: true,
      showMonthYearLabels: true,
      showYearLabels: true,
      showWeekends: false,
      showHolidays: true,
      showOnlyMilestones: false,
      highlightDelays: true
    });

    // Project editing state
    const [editingProject, setEditingProject] = useState(null);
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [projectDraft, setProjectDraft] = useState(null);
    const [isSavingProject, setIsSavingProject] = useState(false);
    const [hasDraftChanges, setHasDraftChanges] = useState(false);
    const [ganttRefreshTrigger, setGanttRefreshTrigger] = useState(0);
    const [focusedProjectId, setFocusedProjectId] = useState(null);

    // Admin state
    const [adminToken, setAdminToken] = useState(null);

    // Lock
    const effectiveUserName = adminToken ? (userName || 'admin') : userName;
    const shouldUseLock = !!department && lockEnabled;
    const { lockInfo, isLocked, error: lockError, releaseLock, refreshLock } = useDepartmentLock(
      department,
      effectiveUserName,
      shouldUseLock
    );

    // Determine if department is read-only
    useEffect(() => {
      if (department) {
        const isReadOnly = !lockEnabled || (shouldUseLock && !isLocked);
        setReadOnlyDepartment(isReadOnly);
      } else {
        setReadOnlyDepartment(false);
      }
    }, [department, shouldUseLock, isLocked, lockEnabled]);

    // Projects data
    const {
      projects,
      meta,
      isDirty,
      isLoading,
      validationErrors,
      error: projectsError,
      loadProjects,
      saveProjects,
      updateProjects,
      uploadJSON
    } = useProjects(department, readOnlyDepartment);

    const stripProjectIds = (project) => {
      if (!project) return null;
      return {
        ...project,
        id: undefined,
        fasi: Array.isArray(project.fasi)
          ? project.fasi.map(fase => ({
              ...fase,
              id: undefined
            }))
          : []
      };
    };

    const emptyProjectTemplateRef = useRef(stripProjectIds(logic.createNewProject()));

    const pushNotification = ({ type = 'info', message, title }) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setNotifications(prev => [...prev, { id, type, message, title }]);
      setTimeout(() => {
        setNotifications(prev => prev.filter(item => item.id !== id));
      }, 5000);
    };

    const isValidUserName = (name) => Boolean(name && name.trim().length >= 2);

    // Effect: save userName to localStorage
    useEffect(() => {
      storage.setCurrentUser(userName);
    }, [userName]);

    useEffect(() => {
      setPendingUserName(userName);
    }, [userName]);

    // Effect: select all projects in Gantt when department changes
    useEffect(() => {
      if (!department) return;

      const allIds = new Set(projects.map(p => p.id));
      setSelectedProjectIds(allIds);

      if (projects.length > 0) {
        // Trigger "Go to Today" automatically
        setTimeout(() => {
          setScrollToTodayTrigger(prev => prev + 1);
        }, 100);
      }
    }, [department, projects]);

    useEffect(() => {
      if (!projectDraft) {
        setHasDraftChanges(false);
        return;
      }

      const baseProject = editingProject
        ? stripProjectIds(editingProject)
        : emptyProjectTemplateRef.current;
      const currentProject = stripProjectIds(projectDraft);
      const hasChanges = JSON.stringify(baseProject) !== JSON.stringify(currentProject);
      setHasDraftChanges(hasChanges);
    }, [projectDraft, editingProject]);

    // Effect: screensaver activity tracking
    useEffect(() => {
      const handleActivity = () => {
        lastActivityRef.current = Date.now();
        setShowScreensaver(false);
      };

      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      events.forEach(event => {
        document.addEventListener(event, handleActivity, true);
      });

      return () => {
        events.forEach(event => {
          document.removeEventListener(event, handleActivity, true);
        });
      };
    }, []);

    // Effect: screensaver timer
    useEffect(() => {
      if (!screensaverEnabled) {
        setShowScreensaver(false);
        return;
      }

      const interval = setInterval(() => {
        const idle = Date.now() - lastActivityRef.current;
        if (idle > config.screensaver.idleMs) {
          setShowScreensaver(true);
        }
      }, 1000);

      return () => clearInterval(interval);
    }, [screensaverEnabled]);

    // Effect: invalidate Gantt cache when filters change
    useEffect(() => {
      gantt.invalidateCache();
    }, [filters, viewMode]);

    const hasUnsavedChanges = isDirty || hasDraftChanges;
    const showProjectUnsavedBadge = showProjectForm && hasUnsavedChanges;

    useEffect(() => {
      const handleBeforeUnload = (event) => {
        if (!hasUnsavedChanges) return;
        event.preventDefault();
        event.returnValue = '';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    const refreshGantt = () => {
      gantt.invalidateCache();
      setGanttRefreshTrigger(prev => prev + 1);
    };

    useEffect(() => {
      if (!department) return;
      refreshGantt();
    }, [department, projects]);

    // Handlers
    const confirmPendingChanges = async (actionLabel) => {
      if (!hasUnsavedChanges) return true;

      const shouldSave = confirm(`Hai modifiche non salvate. Vuoi salvarle prima di ${actionLabel}?`);
      if (shouldSave) {
        if (!effectiveUserName) {
          alert('Inserisci il tuo nome');
          return false;
        }

        if (showProjectForm && hasDraftChanges && projectDraft) {
          const saved = await handleSaveProject(projectDraft);
          return saved;
        }

        try {
          await saveProjects(effectiveUserName, projects);
          refreshGantt();
          return true;
        } catch (err) {
          pushNotification({ type: 'error', message: `Errore durante il salvataggio: ${err.message}` });
          return false;
        }
      }

      const shouldDiscard = confirm('Vuoi annullare le modifiche non salvate?');
      if (!shouldDiscard) {
        return false;
      }

      setShowProjectForm(false);
      setEditingProject(null);
      setProjectDraft(null);
      return true;
    };

    const handleDepartmentChange = async (newDepartment) => {
      if (newDepartment === department) return;

      const canProceed = await confirmPendingChanges('cambiare reparto');
      if (!canProceed) return;

      if (department) {
        await releaseLock();
      }

      setDepartment(newDepartment);
      setLockEnabled(false);
      setEditingProject(null);
      setShowProjectForm(false);
      setSelectedProjectIds(new Set());
      setDepartmentValidationErrors([]);
      setFocusedProjectId(null);
    };

    const getGridFilterDefaults = (mode) => {
      if (mode === 'full') {
        return {
          showDaySeparators: false,
          showWeekSeparators: false,
          showMonthSeparators: true,
          showYearSeparators: true,
          showDayLetters: false,
          showDayNumbers: false,
          showWeekNumbers: false,
          showMonthYearLabels: false,
          showYearLabels: true,
          showWeekends: false,
          showHolidays: false,
          showOnlyMilestones: false,
          highlightDelays: true
        };
      }

      return {
        showDaySeparators: true,
        showWeekSeparators: true,
        showMonthSeparators: true,
        showYearSeparators: true,
        showDayLetters: true,
        showDayNumbers: true,
        showWeekNumbers: true,
        showMonthYearLabels: true,
        showYearLabels: true,
        showHolidays: true,
        highlightDelays: true
      };
    };

    const handleViewModeChange = (mode) => {
      setViewMode(mode);
      setFilters(prev => ({
        ...prev,
        ...getGridFilterDefaults(mode)
      }));
    };

    const handleGoToToday = () => {
      setScrollToTodayTrigger(prev => prev + 1);
    };

    const resetSessionState = async ({ nextUserName = '', nextAdminToken = null } = {}) => {
      try {
        await releaseLock();
      } catch (err) {
        // Ignore release errors
      }

      setDepartment(null);
      setLockEnabled(false);
      setEditingProject(null);
      setShowProjectForm(false);
      setProjectDraft(null);
      setSelectedProjectIds(new Set());
      setDepartmentValidationErrors([]);
      setFocusedProjectId(null);
      setAdminToken(nextAdminToken);
      setUserName(nextUserName);
      setLoginError('');
    };

    const handleUserNameChange = async (nextUserName) => {
      if (nextUserName === userName) return true;

      const canProceed = await confirmPendingChanges('cambiare utente');
      if (!canProceed) return false;

      await resetSessionState({ nextUserName, nextAdminToken: null });
      return true;
    };

    const handleAdminLogin = async (adminId, password) => {
      const canProceed = await confirmPendingChanges('passare ad admin');
      if (!canProceed) return;

      await resetSessionState({ nextUserName: '', nextAdminToken: null });

      try {
        const result = await api.adminLogin(adminId, password);
        setAdminToken(result.token);
        setUserName(adminId);
        setLoginMode('user');
        setAdminCredentials({ userId: '', password: '' });
        setLoginError('');
        pushNotification({ type: 'success', message: 'Accesso admin effettuato' });
      } catch (err) {
        setLoginError(err.message || 'Credenziali admin non valide');
        pushNotification({ type: 'error', message: err.message || 'Credenziali admin non valide' });
      }
    };

    const handleAdminLoginSubmit = async () => {
      if (!adminCredentials.userId.trim() || !adminCredentials.password) {
        setLoginError('Inserisci credenziali admin valide');
        return;
      }
      await handleAdminLogin(adminCredentials.userId.trim(), adminCredentials.password);
    };

    const handleAdminReleaseLock = async () => {
      if (!adminToken || !department) return;
      try {
        await api.adminReleaseLock(department, adminToken);
        refreshLock();
        pushNotification({ type: 'success', message: 'Lock rilasciato' });
      } catch (err) {
        pushNotification({ type: 'error', message: `Errore durante lo sblocco: ${err.message}` });
      }
    };

    const handleAdminCreateDepartment = async ({ name, password }) => {
      if (!adminToken) return;
      try {
        await api.createDepartment(name, adminToken);
        if (password) {
          await api.resetPassword(name, password, adminToken);
        }
        pushNotification({ type: 'success', message: 'Reparto creato con successo' });
      } catch (err) {
        pushNotification({ type: 'error', message: err.message || 'Creazione reparto fallita' });
      }
    };

    const handleAdminDeleteDepartment = async ({ department: targetDepartment }) => {
      if (!adminToken || !targetDepartment) return;
      try {
        await api.deleteDepartment(targetDepartment, adminToken);
        if (department === targetDepartment) {
          await handleDepartmentChange(null);
        }
        pushNotification({ type: 'success', message: 'Reparto eliminato' });
      } catch (err) {
        pushNotification({ type: 'error', message: err.message || 'Eliminazione reparto fallita' });
      }
    };

    const handleAdminResetPassword = async ({ department: targetDepartment, newPassword }) => {
      if (!adminToken || !targetDepartment) return;
      try {
        await api.resetPassword(targetDepartment, newPassword, adminToken);
        pushNotification({ type: 'success', message: 'Password reparto aggiornata' });
      } catch (err) {
        pushNotification({ type: 'error', message: err.message || 'Reset password fallito' });
      }
    };

    const handleUserNameCommit = async () => {
      if (pendingUserName === userName) return;
      const ok = await handleUserNameChange(pendingUserName);
      if (!ok) {
        setPendingUserName(userName);
      }
    };

    const handleChangePassword = async ({ oldPassword, newPassword }) => {
      if (!department) return false;

      try {
        await api.changePassword(department, oldPassword, newPassword);
        if (userName) {
          storage.removePassword(userName, department);
        }
        pushNotification({ type: 'success', message: 'Password aggiornata. Effettua nuovamente l’accesso al reparto.' });
        await handleDepartmentChange(null);
        return true;
      } catch (err) {
        pushNotification({ type: 'error', message: err.message || 'Cambio password fallito' });
        return false;
      }
    };

    const handleEnableLock = () => {
      if (!department) return;
      if (!effectiveUserName) {
        pushNotification({ type: 'warning', message: 'Inserisci il tuo nome' });
        return;
      }
      setLockEnabled(true);
    };

    const handleDisableLock = async () => {
      try {
        await releaseLock();
      } finally {
        setLockEnabled(false);
      }
    };

    const handleGanttPhaseContextMenu = (project) => {
      if (!project) return;
      setFocusedProjectId(project.id);
    };

    const handleProjectFocusHandled = () => {
      setFocusedProjectId(null);
    };

    const handleExportPNG = () => {
      // Switch to full view temporarily
      const previousViewMode = viewMode;
      setViewMode('full');

      // Wait for render, then export
      setTimeout(() => {
        const canvas = document.querySelector('.gantt-canvas');
        if (canvas) {
          const dataURL = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataURL;
          a.download = `gantt_${department}_${new Date().toISOString().split('T')[0]}.png`;
          a.click();
        }

        // Restore previous view mode
        setViewMode(previousViewMode);
      }, 100);
    };

    const handleNewProject = () => {
      if (readOnlyDepartment) return;
      if (projectDraft && hasDraftChanges && !showProjectForm) {
        const shouldDiscard = confirm('Hai una modifica in sospeso. Vuoi scartarla e creare un nuovo progetto?');
        if (!shouldDiscard) {
          setShowProjectForm(true);
          return;
        }
      }
      const draft = logic.createNewProject();
      setEditingProject(null);
      setProjectDraft(draft);
      setShowProjectForm(true);
    };

    const handleEditProject = (project) => {
      if (readOnlyDepartment) return;
      if (projectDraft && hasDraftChanges && !showProjectForm && editingProject?.id !== project.id) {
        const shouldDiscard = confirm('Hai una modifica in sospeso. Vuoi scartarla per modificarne un altro?');
        if (!shouldDiscard) {
          setShowProjectForm(true);
          return;
        }
      }
      setEditingProject(project);
      setProjectDraft(project);
      setShowProjectForm(true);
    };

    const handleSaveProject = async (projectData, { keepEditing } = {}) => {
      if (readOnlyDepartment || isSavingProject) return false;

      if (!effectiveUserName) {
        pushNotification({ type: 'warning', message: 'Inserisci il tuo nome' });
        return false;
      }

      let newProjects;

      if (editingProject) {
        // Update existing
        newProjects = projects.map(p => p.id === projectData.id ? projectData : p);
      } else {
        // Add new
        newProjects = [...projects, projectData];
      }

      updateProjects(newProjects);
      refreshGantt();

      if (keepEditing) {
        setEditingProject(projectData);
        setProjectDraft(projectData);
        return true;
      }

      setIsSavingProject(true);

      let saveOk = false;
      try {
        await saveProjects(effectiveUserName, newProjects);
        saveOk = true;
      } catch (err) {
        pushNotification({ type: 'error', message: `Errore durante il salvataggio: ${err.message}` });
      } finally {
        setIsSavingProject(false);
      }

      if (saveOk) {
        if (keepEditing) {
          setShowProjectForm(true);
          setEditingProject(projectData);
          setProjectDraft(projectData);
        } else {
          setShowProjectForm(false);
          setEditingProject(null);
          setProjectDraft(null);
        }
      }

      return saveOk;
    };

    const handleCancelProjectForm = () => {
      setShowProjectForm(false);
    };

    const handleResumeProjectForm = () => {
      if (!projectDraft) return;
      setShowProjectForm(true);
    };

    const handleDiscardProjectDraft = () => {
      setShowProjectForm(false);
      setEditingProject(null);
      setProjectDraft(null);
      setHasDraftChanges(false);
    };

    const handleDeleteProject = async (projectId) => {
      if (readOnlyDepartment || isSavingProject) return;

      if (!effectiveUserName) {
        pushNotification({ type: 'warning', message: 'Inserisci il tuo nome' });
        return;
      }

      if (!confirm('Eliminare questo progetto?')) {
        return;
      }

      const newProjects = projects.filter(p => p.id !== projectId);
      updateProjects(newProjects);
      refreshGantt();

      // Remove from selected
      const newSelected = new Set(selectedProjectIds);
      newSelected.delete(projectId);
      setSelectedProjectIds(newSelected);

      if (editingProject && editingProject.id === projectId) {
        setEditingProject(null);
        setShowProjectForm(false);
        setProjectDraft(null);
      }

      setIsSavingProject(true);
      try {
        await saveProjects(effectiveUserName, newProjects);
      } catch (err) {
        pushNotification({ type: 'error', message: `Errore durante l'eliminazione: ${err.message}` });
        await loadProjects();
      } finally {
        setIsSavingProject(false);
      }
    };

    const handleSaveAll = async () => {
      if (readOnlyDepartment || isSavingProject) return;

      if (!effectiveUserName) {
        pushNotification({ type: 'warning', message: 'Inserisci il tuo nome' });
        return;
      }

      try {
        setIsSavingProject(true);
        await saveProjects(effectiveUserName, projects);
        refreshGantt();
        pushNotification({ type: 'success', message: 'Progetti salvati con successo' });
      } catch (err) {
        pushNotification({ type: 'error', message: `Errore durante il salvataggio: ${err.message}` });
      } finally {
        setIsSavingProject(false);
      }
    };

    const handleUserLogout = async () => {
      const canProceed = await confirmPendingChanges('uscire');
      if (!canProceed) return;

      if (adminToken) {
        try {
          await api.adminLogout(adminToken);
        } catch (err) {
          // Ignore admin logout errors
        }
      }

      await resetSessionState({ nextUserName: '', nextAdminToken: null });
    };

    const handleImportJSON = async (file) => {
      if (readOnlyDepartment) return;

      if (!effectiveUserName) {
        pushNotification({ type: 'warning', message: 'Inserisci il tuo nome' });
        return;
      }

      try {
        if (!file || (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json')) {
          pushNotification({ type: 'error', message: 'Formato file non valido. Carica un file .json' });
          return;
        }
        await uploadJSON(file, effectiveUserName);
        setDepartmentValidationErrors([]);
        pushNotification({ type: 'success', message: 'Import completato con successo' });
      } catch (err) {
        if (err.details?.errors) {
          setDepartmentValidationErrors(err.details.errors);
        }
        pushNotification({ type: 'error', message: `Errore durante l'import: ${err.message}` });
      }
    };

    const handleExportProjects = () => {
      if (!department) return;
      const dataStr = JSON.stringify({ projects }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progetti_${department}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      pushNotification({ type: 'success', message: 'Export progetti completato' });
    };

    const readFileAsText = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossibile leggere il file'));
      reader.readAsText(file);
    });

    const handleExportDepartment = async () => {
      if (!department) return;
      try {
        const result = await api.exportDepartment(department);
        const payload = result.data;
        if (result.validationErrors?.length) {
          setDepartmentValidationErrors(result.validationErrors);
        }
        const dataStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reparto_${department}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        pushNotification({ type: 'success', message: 'Export reparto completato' });
      } catch (err) {
        pushNotification({ type: 'error', message: `Errore durante l'export reparto: ${err.message}` });
      }
    };

    const handleImportDepartment = async (file) => {
      if (readOnlyDepartment || !department) return;
      if (!effectiveUserName) {
        pushNotification({ type: 'warning', message: 'Inserisci il tuo nome' });
        return;
      }

      try {
        if (!file || (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json')) {
          pushNotification({ type: 'error', message: 'Formato file non valido. Carica un file .json' });
          return;
        }
        const rawText = await readFileAsText(file);
        const parsed = JSON.parse(rawText);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.projects)) {
          pushNotification({ type: 'error', message: 'Struttura file non valida: manca la lista progetti' });
          return;
        }
        const { errors, projects: fixedProjects } = logic.validateAndFixProjects(parsed.projects || []);

        if (errors.length > 0) {
          const confirmFix = confirm(
            `Import reparto: rilevati ${errors.length} errori nei dati. Vuoi applicare il fix automatico per continuare?`
          );
          if (!confirmFix) {
            pushNotification({ type: 'warning', message: 'Import annullato: dati non corretti.' });
            return;
          }
        }

        const payload = {
          ...parsed,
          projects: fixedProjects
        };

        await api.importDepartment(department, payload, effectiveUserName);
        setDepartmentValidationErrors([]);
        await loadProjects();
        pushNotification({ type: 'success', message: 'Import reparto completato con successo' });
      } catch (err) {
        if (err.details?.errors) {
          setDepartmentValidationErrors(err.details.errors);
        }
        pushNotification({ type: 'error', message: `Errore durante l'import reparto: ${err.message}` });
      }
    };

    // Filter projects for Gantt display
    const visibleProjects = projects.filter(p => selectedProjectIds.has(p.id));

    // Apply "only milestones" filter
    const ganttProjects = filters.showOnlyMilestones
      ? visibleProjects.map(p => ({
          ...p,
          fasi: p.fasi.filter(f => f.milestone)
        }))
      : visibleProjects;

    return (
      <div>
        <HeaderBar
          userName={userName}
          department={department}
          onDepartmentChange={handleDepartmentChange}
          lockInfo={lockInfo}
          isLocked={isLocked}
          lockEnabled={lockEnabled}
          onEnableLock={handleEnableLock}
          onReleaseLock={handleDisableLock}
          onUserLogout={handleUserLogout}
          onExportDepartment={handleExportDepartment}
          onImportDepartment={handleImportDepartment}
          canImportExport={!!department && (!!adminToken || !readOnlyDepartment)}
          readOnlyDepartment={readOnlyDepartment}
          adminToken={adminToken}
          onChangePassword={handleChangePassword}
          onAdminCreateDepartment={handleAdminCreateDepartment}
          onAdminDeleteDepartment={handleAdminDeleteDepartment}
          onAdminResetPassword={handleAdminResetPassword}
        />

        {lockError && lockError.lockedBy && (
          <div className="lock-banner">
            Reparto bloccato da {lockError.lockedBy} dal{' '}
            {new Date(lockError.lockedAt).toLocaleString('it-IT')}
            {' '}fino a{' '}
            {new Date(lockError.expiresAt).toLocaleString('it-IT')}
          </div>
        )}

        <main className="main-container">
          {!department ? (
            <div className="card auth-card" style={{ maxWidth: '560px', margin: '0 auto' }}>
              <h2 className="card-title">Accesso reparto</h2>
              <div className="auth-tabs">
                <button
                  type="button"
                  className={`auth-tab ${loginMode === 'user' ? 'active' : ''}`}
                  onClick={() => {
                    setLoginMode('user');
                    setLoginError('');
                  }}
                >
                  Login utente
                </button>
                <button
                  type="button"
                  className={`auth-tab ${loginMode === 'admin' ? 'active' : ''}`}
                  onClick={() => {
                    setLoginMode('admin');
                    setLoginError('');
                  }}
                >
                  Login admin
                </button>
              </div>

              {loginError && (
                <div className="alert-item" style={{ marginBottom: '1rem' }}>
                  {loginError}
                </div>
              )}

              {loginMode === 'user' && (
                <div className="card-section">
                  <div className="form-group">
                    <label htmlFor="userNameAccess">Nome utente</label>
                    <input
                      id="userNameAccess"
                      type="text"
                      value={pendingUserName}
                      onChange={(e) => setPendingUserName(e.target.value)}
                      onBlur={handleUserNameCommit}
                      onKeyDown={(e) => e.key === 'Enter' && handleUserNameCommit()}
                      placeholder="Inserisci nome"
                    />
                    {!isValidUserName(pendingUserName) && pendingUserName && (
                      <div className="text-muted text-small" style={{ marginTop: '0.25rem' }}>
                        Inserisci almeno 2 caratteri.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loginMode === 'admin' && !adminToken && (
                <div className="card-section">
                  <div className="form-group">
                    <label htmlFor="adminId">ID Admin</label>
                    <input
                      id="adminId"
                      type="text"
                      value={adminCredentials.userId}
                      onChange={(e) => setAdminCredentials(prev => ({ ...prev, userId: e.target.value }))}
                      placeholder="Inserisci ID admin"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="adminPassword">Password Admin</label>
                    <input
                      id="adminPassword"
                      type="password"
                      value={adminCredentials.password}
                      onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAdminLoginSubmit()}
                      placeholder="Inserisci password"
                    />
                  </div>
                  <div className="button-group">
                    <button
                      type="button"
                      className="btn-success"
                      onClick={handleAdminLoginSubmit}
                    >
                      Accedi come admin
                    </button>
                  </div>
                </div>
              )}

              {adminToken && (
                <div className="card-section">
                  <div className="alert-item info">
                    Admin autenticato. Seleziona un reparto per procedere.
                  </div>
                </div>
              )}

              {DepartmentSelector && (
                <DepartmentSelector
                  userName={userName}
                  department={department}
                  onDepartmentChange={handleDepartmentChange}
                  adminToken={adminToken}
                  lockInfo={lockInfo}
                  onAdminReleaseLock={handleAdminReleaseLock}
                />
              )}
            </div>
          ) : (
            <>
              {departmentValidationErrors.length > 0 && (
                <div className="card" style={{ marginBottom: '1rem' }}>
                  <h2 className="card-title">Errori dati reparto</h2>
                  <div className="alert-item warning">
                    Sono stati rilevati errori nei dati del reparto:
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1rem' }}>
                      {departmentValidationErrors.map((err, index) => (
                        <li key={index}>{err}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="gantt-section">
                <div className="card">
                  <h2 className="card-title">Diagramma di Gantt</h2>

          <GanttControls
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onGoToToday={handleGoToToday}
            onExportPNG={handleExportPNG}
            filters={filters}
            onFiltersChange={setFilters}
          />

                  <div className="card-section">
                    {isLoading ? (
                      <div className="text-center">
                        <div className="loading"></div> Caricamento...
                      </div>
                    ) : projectsError ? (
                      <div className="alert-item">Errore: {projectsError}</div>
                    ) : (
                      <GanttCanvas
                        viewMode={viewMode}
                        projects={ganttProjects}
                        filters={filters}
                        scrollToTodayTrigger={scrollToTodayTrigger}
                        refreshTrigger={ganttRefreshTrigger}
                        onPhaseContextMenu={handleGanttPhaseContextMenu}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="bottom-layout">
                {/* Left: Project Form */}
                <div>
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h2 className="card-title">Gestione Progetto</h2>
                      {showProjectForm && (
                        <div>
                          {showProjectUnsavedBadge ? (
                            <span className="badge badge-warning">Modifiche non salvate</span>
                          ) : (
                            <span className="badge badge-success">Salvato</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="button-group">
                      <button
                        onClick={handleNewProject}
                        className="btn-success"
                        disabled={readOnlyDepartment || isSavingProject}
                      >
                        Nuovo Progetto
                      </button>
                      {!showProjectForm && projectDraft && (
                        <button
                          onClick={handleResumeProjectForm}
                          className="btn-secondary"
                          disabled={readOnlyDepartment || isSavingProject}
                        >
                          Riprendi modifica
                        </button>
                      )}
                      {!showProjectForm && projectDraft && (
                        <button
                          onClick={handleDiscardProjectDraft}
                          className="btn-secondary"
                          disabled={readOnlyDepartment || isSavingProject}
                        >
                          Scarta bozza
                        </button>
                      )}
                      {showProjectForm && (
                        <button
                          onClick={() => projectDraft && handleSaveProject(projectDraft)}
                          className="btn-success"
                          disabled={readOnlyDepartment || isSavingProject || !projectDraft}
                        >
                          {isSavingProject ? 'Salvataggio...' : 'Salva progetto e chiudi'}
                        </button>
                      )}
                      {showProjectForm && (
                        <button
                          onClick={() => projectDraft?.id && handleDeleteProject(projectDraft.id)}
                          className="btn-danger"
                          disabled={readOnlyDepartment || isSavingProject || !projectDraft?.id}
                        >
                          Elimina progetto
                        </button>
                      )}
                      {showProjectForm && (
                        <button
                          onClick={handleCancelProjectForm}
                          className="btn-secondary"
                          disabled={isSavingProject}
                        >
                          Torna indietro
                        </button>
                      )}
                    </div>
                  </div>

                  {showProjectForm && (
                    <div style={{ marginTop: '1rem' }}>
                      <ProjectForm
                        project={projectDraft}
                        onSave={handleSaveProject}
                        onDelete={handleDeleteProject}
                        onCancel={handleCancelProjectForm}
                        readOnly={readOnlyDepartment}
                        isSaving={isSavingProject}
                        onDraftChange={setProjectDraft}
                      />
                    </div>
                  )}
                </div>

                {/* Center: Project List */}
                <div>
                      <ProjectList
                        projects={projects}
                        selectedProjectIds={selectedProjectIds}
                        onSelectedProjectIdsChange={setSelectedProjectIds}
                        onEditProject={handleEditProject}
                        onDeleteProject={handleDeleteProject}
                        onExportJSON={handleExportProjects}
                        onImportJSON={handleImportJSON}
                        validationErrors={validationErrors}
                        readOnly={readOnlyDepartment}
                        isSaving={isSavingProject}
                        focusedProjectId={focusedProjectId}
                        onFocusHandled={handleProjectFocusHandled}
                      />
                </div>

                {/* Right: Alerts */}
                <div>
                  <AlertsPanel projects={projects} />
                </div>
              </div>
            </>
          )}
        </main>

        {notifications.length > 0 && (
          <div className="notification-container" role="status" aria-live="polite">
            {notifications.map(item => (
              <div key={item.id} className={`notification notification-${item.type}`}>
                {item.title && <div className="notification-title">{item.title}</div>}
                <div>{item.message}</div>
                <button
                  type="button"
                  className="notification-close"
                  onClick={() => setNotifications(prev => prev.filter(entry => entry.id !== item.id))}
                  aria-label="Chiudi notifica"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {showScreensaver && (
          <div className="screensaver-overlay">
            <div className="screensaver-card">
              <h1 className="screensaver-title">OnlyGANTT</h1>
              <p className="screensaver-subtitle">Premi un tasto per continuare</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mount app
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
})();
