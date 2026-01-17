(function() {
  'use strict';

  const { useState, useEffect, useRef, useMemo } = React;

  const config = window.AppConfig;
  const storage = window.OnlyGantt.storage;
  const gantt = window.OnlyGantt.gantt;
  const api = window.OnlyGantt.api;
  const logic = window.OnlyGantt.logic;

  const HeaderBar = window.OnlyGantt.components.HeaderBar;
  const GanttControls = window.OnlyGantt.components.GanttControls;
  const GanttCanvas = window.OnlyGantt.components.GanttCanvas;
  const ProjectForm = window.OnlyGantt.components.ProjectForm;
  const ProjectList = window.OnlyGantt.components.ProjectList;
  const ProjectSidebar = window.OnlyGantt.components.ProjectSidebar;
  const AlertsPanel = window.OnlyGantt.components.AlertsPanel;
  const LoginScreen = window.OnlyGantt.components.LoginScreen;
  const SystemSettings = window.OnlyGantt.components.SystemSettings;
  const UserManagement = window.OnlyGantt.components.UserManagement;

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
    const [userName, setUserName] = useState(storage.getCurrentUser() || '');
    const [userToken, setUserToken] = useState(null);
    const [notifications, setNotifications] = useState([]);

    const [department, setDepartment] = useState(null);
    const [readOnlyDepartment, setReadOnlyDepartment] = useState(false);
    const [lockEnabled, setLockEnabled] = useState(false);
    const [isDepartmentProtected, setIsDepartmentProtected] = useState(false);

    const [screensaverEnabled, setScreensaverEnabled] = useState(false);
    const [showScreensaver, setShowScreensaver] = useState(false);
    const lastActivityRef = useRef(Date.now());
    const isVerifyingPasswordRef = useRef(false);
    const [departmentValidationErrors, setDepartmentValidationErrors] = useState([]);

    const [viewMode, setViewMode] = useState('4months');
    const [activeView, setActiveView] = useState('gantt');
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
      highlightDelays: true,
      showPhaseLabels: true,
      showPhasePercentages: true
    });

    const [editingProject, setEditingProject] = useState(null);
    const [showProjectForm, setShowProjectForm] = useState(false);
    const [projectDraft, setProjectDraft] = useState(null);
    const [isSavingProject, setIsSavingProject] = useState(false);
    const [hasDraftChanges, setHasDraftChanges] = useState(false);
    const [ganttRefreshTrigger, setGanttRefreshTrigger] = useState(0);
    const [focusedProjectId, setFocusedProjectId] = useState(null);

    const [hoveredProjectId, setHoveredProjectId] = useState(null);
    const [verticalScrollTop, setVerticalScrollTop] = useState(0);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
      try {
        return localStorage.getItem('onlygantt_sidebar_collapsed') === 'true';
      } catch {
        return false;
      }
    });

    const [adminToken, setAdminToken] = useState(null);
    const [loginError, setLoginError] = useState('');

    const effectiveUserName = adminToken ? (userName || 'admin') : userName;
    const shouldUseLock = !!department && lockEnabled;
    const { lockInfo, isLocked, error: lockError, releaseLock, refreshLock } = useDepartmentLock(
      department,
      effectiveUserName,
      shouldUseLock
    );

    useEffect(() => {
      if (department) {
        const isReadOnly = !lockEnabled || (shouldUseLock && !isLocked);
        setReadOnlyDepartment(isReadOnly);
      } else {
        setReadOnlyDepartment(false);
      }
    }, [department, shouldUseLock, isLocked, lockEnabled]);

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

    useEffect(() => {
      storage.setCurrentUser(userName);
    }, [userName]);

    useEffect(() => {
      api.setUserToken(userToken);
    }, [userToken]);

    const initialScrollDoneRef = useRef(null);

    useEffect(() => {
      if (!department || projects.length === 0) return;
      const allIds = new Set(projects.map(p => p.id));
      setSelectedProjectIds(allIds);
    }, [department, projects]);

    useEffect(() => {
      if (!department) {
        initialScrollDoneRef.current = null;
        return;
      }

      if (initialScrollDoneRef.current !== department && projects.length > 0) {
        initialScrollDoneRef.current = department;
        setTimeout(() => {
          setScrollToTodayTrigger(prev => prev + 1);
        }, 150);
      }
    }, [department, projects.length]);

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

    useEffect(() => {
      const handleActivity = async (event) => {
        lastActivityRef.current = Date.now();

        if (showScreensaver && isDepartmentProtected && department && !adminToken) {
          if (isVerifyingPasswordRef.current) {
            return;
          }

          isVerifyingPasswordRef.current = true;
          event?.preventDefault?.();
          event?.stopPropagation?.();

          const password = prompt('Inserisci la password del reparto per continuare:');

          if (password === null || password === '') {
            isVerifyingPasswordRef.current = false;
            return;
          }

          try {
            const result = await api.verifyPassword(department, password);
            if (!result.ok) {
              alert('Password errata');
              isVerifyingPasswordRef.current = false;
              return;
            }
            storage.setPassword(userName, department, password);
            setShowScreensaver(false);
          } catch (err) {
            alert('Errore durante la verifica della password');
          } finally {
            isVerifyingPasswordRef.current = false;
          }
          return;
        }

        setShowScreensaver(false);
      };

      const handleNonPasswordActivity = (event) => {
        if (!showScreensaver) {
          lastActivityRef.current = Date.now();
        }
      };

      const passwordEvents = ['mousedown', 'keydown', 'touchstart'];
      const activityOnlyEvents = ['mousemove', 'scroll'];

      passwordEvents.forEach(event => {
        document.addEventListener(event, handleActivity, true);
      });

      activityOnlyEvents.forEach(event => {
        document.addEventListener(event, handleNonPasswordActivity, true);
      });

      return () => {
        passwordEvents.forEach(event => {
          document.removeEventListener(event, handleActivity, true);
        });
        activityOnlyEvents.forEach(event => {
          document.removeEventListener(event, handleNonPasswordActivity, true);
        });
      };
    }, [showScreensaver, isDepartmentProtected, department, adminToken, userName]);

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

    useEffect(() => {
      gantt.invalidateCache();
    }, [filters, viewMode]);

    useEffect(() => {
      if ((activeView === 'systemSettings' || activeView === 'userManagement') && !adminToken) {
        setActiveView('gantt');
      }
    }, [activeView, adminToken]);

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

    const viewActionLabels = {
      systemSettings: 'aprire le impostazioni di sistema',
      userManagement: 'aprire la gestione utenti'
    };

    const handleViewChange = async (nextView) => {
      if (nextView === activeView) return;
      if (nextView !== 'gantt') {
        const actionLabel = viewActionLabels[nextView] || 'cambiare schermata';
        const canProceed = await confirmPendingChanges(actionLabel);
        if (!canProceed) return;
      }
      setActiveView(nextView);
    };

    const handleDepartmentChange = async (newDepartment) => {
      if (newDepartment === department) return;

      const canProceed = await confirmPendingChanges('cambiare reparto');
      if (!canProceed) return;

      if (department) {
        await releaseLock();
      }

      setDepartment(newDepartment);
      setActiveView('gantt');
      setLockEnabled(false);
      setEditingProject(null);
      setShowProjectForm(false);
      setSelectedProjectIds(new Set());
      setDepartmentValidationErrors([]);
      setFocusedProjectId(null);

      if (newDepartment && !adminToken) {
        try {
          const depts = await api.getDepartments();
          const deptInfo = depts.departments?.find(d => d.name === newDepartment);
          setIsDepartmentProtected(deptInfo?.protected || false);
        } catch (err) {
          setIsDepartmentProtected(false);
        }
      } else {
        setIsDepartmentProtected(false);
      }
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
          highlightDelays: true,
          showPhaseLabels: false,
          showPhasePercentages: true
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
        highlightDelays: true,
        showPhaseLabels: true,
        showPhasePercentages: true
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
      } catch (err) {}

      setDepartment(null);
      setActiveView('gantt');
      setLockEnabled(false);
      setEditingProject(null);
      setShowProjectForm(false);
      setProjectDraft(null);
      setSelectedProjectIds(new Set());
      setDepartmentValidationErrors([]);
      setFocusedProjectId(null);
      setAdminToken(nextAdminToken);
      setUserName(nextUserName);
      setUserToken(null);
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
      if (!canProceed) throw new Error('Operazione annullata');

      await resetSessionState({ nextUserName: '', nextAdminToken: null });

      const result = await api.adminLogin(adminId, password);
      setAdminToken(result.token);
      setUserToken(result.userToken || null);
      setUserName(adminId);
      pushNotification({ type: 'success', message: 'Accesso admin effettuato' });
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

    const handleAdminChangePassword = async ({ oldPassword, newPassword }) => {
      if (!adminToken) return;
      try {
        await api.adminChangePassword(oldPassword, newPassword, adminToken);
        pushNotification({ type: 'success', message: 'Password admin aggiornata' });
      } catch (err) {
        pushNotification({ type: 'error', message: err.message || 'Reset password fallito' });
      }
    };

    const getSelectedModuleLabels = (modules) => {
      const labels = {
        departments: 'Reparti',
        users: 'Utenti',
        settings: 'Impostazioni'
      };
      return Object.keys(labels).filter((key) => modules?.[key]).map((key) => labels[key]);
    };

    const formatExportTimestamp = () => {
      const now = new Date();
      const pad = (value) => String(value).padStart(2, '0');
      return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
    };

    const buildExportFileName = () => `OnlyGANTT-${formatExportTimestamp()}.json`;

    const isOnlyDepartmentsModule = (modules) => modules?.departments && !modules?.users && !modules?.settings;

    const handleAdminModularExport = async (modules) => {
      if (!adminToken) return;
      try {
        const backup = await api.adminExportModules(modules, adminToken);
        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = buildExportFileName();
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const moduleSummary = getSelectedModuleLabels(modules).join(', ') || 'Nessun modulo';
        pushNotification({
          type: 'success',
          message: `Export impostazioni completato: ${moduleSummary}`
        });
      } catch (err) {
        pushNotification({ type: 'error', message: err.message || 'Export impostazioni fallito' });
      }
    };

    const handleAdminModularImport = async ({ backup, modules, overwriteExisting }) => {
      if (!adminToken) return;
      try {
        const result = await api.adminImportModules(backup, modules, overwriteExisting, adminToken);
        const { summary } = result;
        const moduleSummary = getSelectedModuleLabels(modules).join(', ') || 'Nessun modulo';

        let message = `Import impostazioni completato:\n` +
          `Moduli: ${moduleSummary}\n` +
          `- Importati: ${summary.imported}\n` +
          `- Saltati: ${summary.skipped}\n` +
          `- Errori: ${summary.errors}`;

        if (summary.errors > 0 && result.results?.departments?.errors?.length > 0) {
          message += `\n\nErrori:\n${result.results.departments.errors.map(e => `- ${e.department}: ${e.error}`).join('\n')}`;
        }

        alert(message);

        if (summary.imported > 0) {
          pushNotification({
            type: 'success',
            message: `Import impostazioni completato: ${summary.imported} reparti importati`
          });

          if (department) {
            await handleDepartmentChange(null);
          }
        }
      } catch (err) {
        pushNotification({ type: 'error', message: err.message || 'Import impostazioni fallito' });
      }
    };

    const handleChangePassword = async ({ oldPassword, newPassword }) => {
      if (!department) return false;

      try {
        await api.changePassword(department, oldPassword, newPassword);
        if (userName) {
          storage.removePassword(userName, department);
        }
        pushNotification({ type: 'success', message: 'Password aggiornata. Effettua nuovamente l\'accesso al reparto.' });
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
      const previousViewMode = viewMode;
      setViewMode('full');

      setTimeout(() => {
        const canvas = document.querySelector('.gantt-canvas');
        if (canvas) {
          const dataURL = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = dataURL;
          a.download = `gantt_${department}_${new Date().toISOString().split('T')[0]}.png`;
          a.click();
        }

        setViewMode(previousViewMode);
      }, 100);
    };

    const handleNewProject = () => {
      if (readOnlyDepartment) return;
      if (projectDraft && hasDraftChanges && !showProjectForm) {
        setEditingProject(null);
        setProjectDraft(null);
        setHasDraftChanges(false);
      }
      const draft = logic.createNewProject();
      setEditingProject(null);
      setProjectDraft(draft);
      setShowProjectForm(true);
    };

    const handleEditProject = (project) => {
      if (readOnlyDepartment) return;
      if (projectDraft && hasDraftChanges && !showProjectForm && editingProject?.id !== project.id) {
        setEditingProject(null);
        setProjectDraft(null);
        setHasDraftChanges(false);
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
        newProjects = projects.map(p => p.id === projectData.id ? projectData : p);
      } else {
        newProjects = [...projects, projectData];
      }

      updateProjects(newProjects);
      refreshGantt();

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
          setHasDraftChanges(false);
        } else {
          setShowProjectForm(false);
          setEditingProject(null);
          setProjectDraft(null);
          setHasDraftChanges(false);
        }
      }

      return saveOk;
    };

    const handleCancelProjectForm = () => {
      if (hasDraftChanges) {
        const shouldDiscard = confirm('Vuoi annullare le modifiche apportate?');
        if (!shouldDiscard) {
          return;
        }
      }
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
        } catch (err) {}
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
      a.download = buildExportFileName();
      a.click();
      URL.revokeObjectURL(url);
      pushNotification({ type: 'success', message: 'Export progetti completato' });
    };

    const handleExportJSON = handleExportProjects;

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
        a.download = buildExportFileName();
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

      const readFileAsText = (f) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Impossibile leggere il file'));
        reader.readAsText(f);
      });

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

    const visibleProjects = useMemo(
      () => projects.filter(p => selectedProjectIds.has(p.id)),
      [projects, selectedProjectIds]
    );

    const ganttProjects = useMemo(
      () => (filters.showOnlyMilestones
        ? visibleProjects.map(p => ({
            ...p,
            fasi: p.fasi.filter(f => f.milestone)
          }))
        : visibleProjects),
      [filters.showOnlyMilestones, visibleProjects]
    );

    return (
      <div>
        <HeaderBar
          userName={userName}
          department={department}
          onDepartmentChange={handleDepartmentChange}
          lockInfo={lockInfo}
          isLocked={isLocked}
          lockEnabled={lockEnabled}
          onRefreshLock={refreshLock}
          onEnableLock={handleEnableLock}
          onReleaseLock={handleDisableLock}
          onUserLogout={handleUserLogout}
          readOnlyDepartment={readOnlyDepartment}
          adminToken={adminToken}
          onChangePassword={handleChangePassword}
          onAdminCreateDepartment={handleAdminCreateDepartment}
          onAdminDeleteDepartment={handleAdminDeleteDepartment}
          onAdminResetPassword={handleAdminResetPassword}
          onAdminChangePassword={handleAdminChangePassword}
          onAdminReleaseLock={handleAdminReleaseLock}
          screensaverEnabled={screensaverEnabled}
          onToggleScreensaver={() => setScreensaverEnabled(!screensaverEnabled)}
          onNavigateSystemSettings={() => handleViewChange('systemSettings')}
          onNavigateUserManagement={() => handleViewChange('userManagement')}
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
          {activeView === 'systemSettings' && adminToken ? (
            <SystemSettings
              onBack={() => handleViewChange('gantt')}
              onAdminModularExport={handleAdminModularExport}
              onAdminModularImport={handleAdminModularImport}
              adminToken={adminToken}
            />
          ) : activeView === 'userManagement' && adminToken ? (
            <UserManagement
              adminToken={adminToken}
              onBack={() => handleViewChange('gantt')}
            />
          ) : !department ? (
            <LoginScreen
              userName={userName}
              onUserNameChange={handleUserNameChange}
              onDepartmentChange={handleDepartmentChange}
              adminToken={adminToken}
              onAdminLogin={handleAdminLogin}
              onAdminLogout={handleUserLogout}
              onUserTokenChange={setUserToken}
              loginError={loginError}
              setLoginError={setLoginError}
            />
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
                  <h2 className="card-title">Timeline Progetti</h2>

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
                      <div className={`gantt-with-sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
                        <ProjectSidebar
                          projects={ganttProjects}
                          selectedProjectIds={selectedProjectIds}
                          onSelectedProjectIdsChange={setSelectedProjectIds}
                          onEditProject={handleEditProject}
                          onDeleteProject={handleDeleteProject}
                          readOnly={readOnlyDepartment}
                          isSaving={isSavingProject}
                          hoveredProjectId={hoveredProjectId}
                          onProjectHover={setHoveredProjectId}
                          scrollTop={verticalScrollTop}
                          onScrollChange={setVerticalScrollTop}
                          ganttHeaderHeight={config.gantt.CANVAS_TOP_MARGIN}
                          onCollapsedChange={setSidebarCollapsed}
                          viewMode={viewMode}
                        />
                        <div className="gantt-main-area">
                          <GanttCanvas
                            viewMode={viewMode}
                            projects={ganttProjects}
                            filters={filters}
                            scrollToTodayTrigger={scrollToTodayTrigger}
                            refreshTrigger={ganttRefreshTrigger}
                            onPhaseContextMenu={handleGanttPhaseContextMenu}
                            hoveredProjectId={hoveredProjectId}
                            onProjectHover={setHoveredProjectId}
                            verticalScrollTop={verticalScrollTop}
                            onVerticalScrollChange={setVerticalScrollTop}
                            sidebarCollapsed={sidebarCollapsed}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bottom-layout">
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
                      {showProjectForm && hasDraftChanges && (
                        <button
                          onClick={handleCancelProjectForm}
                          className="btn-secondary"
                          disabled={isSavingProject}
                        >
                          Annulla modifiche
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

                <div>
                      <ProjectList
                        projects={projects}
                        selectedProjectIds={selectedProjectIds}
                        onSelectedProjectIdsChange={setSelectedProjectIds}
                        onEditProject={handleEditProject}
                        onDeleteProject={handleDeleteProject}
                        onExportJSON={handleExportJSON}
                        onImportJSON={handleImportJSON}
                        validationErrors={validationErrors}
                        readOnly={readOnlyDepartment}
                        isSaving={isSavingProject}
                        focusedProjectId={focusedProjectId}
                        onFocusHandled={handleProjectFocusHandled}
                      />
                </div>

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

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
})();
