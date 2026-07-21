import AppConfig from '../app-config.js';
import dateUtils from '../utils/dateUtils.js';
import logic from '../domain/projectLogic.js';
import gantt from '../domain/ganttCalculator.js';
import api from './api.js';
import storage from './storage.js';

import useAuth from './hooks/useAuth.js';
import useGanttFilters from './hooks/useGanttFilters.js';
import useProjectDraft from './hooks/useProjectDraft.js';
import useNotifications from './hooks/useNotifications.js';
import useDepartmentLock from './hooks/useDepartmentLock.js';
import useProjects from './hooks/useProjects.js';

import HeaderBar from './components/HeaderBar.jsx';
import GanttControls from './components/GanttControls.jsx';
import GanttCanvas from './components/GanttCanvas.jsx';
import ProjectForm from './components/ProjectForm.jsx';
import ProjectList from './components/ProjectList.jsx';
import ProjectSidebar from './components/ProjectSidebar.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import SystemSettings from './components/SystemSettings.jsx';
import UserManagement from './components/UserManagement.jsx';
import DialogHost from './components/DialogHost.jsx';

const { useState, useEffect, useRef, useMemo, useCallback } = React;

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

export function App() {
  const auth = useAuth();
  const filtersState = useGanttFilters();
  const draftState = useProjectDraft();
  const notify = useNotifications();

  const [departmentValidationErrors, setDepartmentValidationErrors] = useState([]);
  const [ganttRefreshTrigger, setGanttRefreshTrigger] = useState(0);
  const [hoveredProjectId, setHoveredProjectId] = useState(null);
  const [verticalScrollTop, setVerticalScrollTop] = useState(0);
  const [isGanttScrollable, setIsGanttScrollable] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('onlygantt_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [departmentsList, setDepartmentsList] = useState([]);

  const fetchDepartmentsList = useCallback(async (signal) => {
    try {
      const list = await api.getDepartments(signal);
      setDepartmentsList(list?.departments || []);
    } catch (err) {}
  }, []);

  useEffect(() => {
    fetchDepartmentsList();
  }, [fetchDepartmentsList, auth.department, auth.adminToken]);

  const shouldUseLock = !!auth.department && auth.lockEnabled;
  const { lockInfo, isLocked, error: lockError, releaseLock, refreshLock } = useDepartmentLock(
    auth.department,
    auth.effectiveUserName,
    shouldUseLock
  );

  useEffect(() => {
    if (auth.department) {
      if (auth.adminToken) {
        const isLockedByOther = shouldUseLock && !isLocked && lockInfo?.locked && lockInfo?.lockedBy && lockInfo.lockedBy !== auth.effectiveUserName;
        auth.setReadOnlyDepartment(!!isLockedByOther);
      } else {
        const isReadOnly = !auth.lockEnabled || (shouldUseLock && !isLocked);
        auth.setReadOnlyDepartment(isReadOnly);
      }
    } else {
      auth.setReadOnlyDepartment(false);
    }
  }, [auth.department, shouldUseLock, isLocked, auth.lockEnabled, auth.adminToken, lockInfo, auth.effectiveUserName]);

  const requestProjectFixConfirmation = useCallback(async ({ contextLabel, errors }) => {
    return notify.dialogApi.confirm({
      title: `Correzione automatica ${contextLabel}`,
      message: `Rilevati ${errors.length} errori nei dati:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? '\n...' : ''}\n\nVuoi applicare il fix automatico per continuare?`,
      confirmLabel: 'Applica fix',
      cancelLabel: 'Annulla',
      confirmTone: 'success'
    });
  }, [notify.dialogApi]);

  const {
    projects,
    meta: projectsMeta,
    isDirty: isProjectsDirty,
    isLoading,
    validationErrors,
    error: projectsError,
    loadProjects,
    saveProjects,
    updateProjects,
    uploadJSON
  } = useProjects(auth.department, auth.readOnlyDepartment, {
    requestProjectFixConfirmation
  });

  useEffect(() => {
    api.setUserToken(auth.userToken);
  }, [auth.userToken]);

  useEffect(() => {
    api.setAdminToken(auth.adminToken);
  }, [auth.adminToken]);

  const resetSessionState = useCallback(async ({ nextUserName, nextAdminToken, nextDepartment, nextUserToken } = {}) => {
    const resolvedUserName = nextUserName !== undefined ? nextUserName : auth.userName;
    const resolvedAdminToken = nextAdminToken !== undefined ? nextAdminToken : auth.adminToken;
    const resolvedDepartment = nextDepartment !== undefined ? nextDepartment : auth.department;
    const resolvedUserToken = nextUserToken !== undefined ? nextUserToken : auth.userToken;

    if (shouldUseLock && isLocked && auth.department && auth.effectiveUserName) {
      try {
        await releaseLock();
      } catch (err) {}
    }

    if (nextUserName !== undefined) {
      auth.setUserName(nextUserName);
      storage.setCurrentUser(nextUserName);
    }
    if (nextAdminToken !== undefined) {
      auth.setAdminToken(nextAdminToken);
      api.setAdminToken(nextAdminToken);
    }
    if (nextUserToken !== undefined) {
      auth.setUserToken(nextUserToken);
      api.setUserToken(nextUserToken);
    }
    if (nextDepartment !== undefined) {
      auth.setDepartment(nextDepartment);
      auth.setLockEnabled(false);
      auth.setReadOnlyDepartment(true);
      auth.setIsDepartmentProtected(false);
    }

    draftState.closeProjectForm();
    filtersState.setSelectedProjectIds(new Set());
    setDepartmentValidationErrors([]);
    setGanttRefreshTrigger(prev => prev + 1);

    storage.setActiveSession({
      userName: resolvedUserName,
      adminToken: resolvedAdminToken,
      department: resolvedDepartment,
      userToken: resolvedUserToken
    });
  }, [auth, shouldUseLock, isLocked, releaseLock, draftState, filtersState]);

  useEffect(() => {
    const handleUserSessionInvalid = (event) => {
      const message = event.detail?.message || 'Sessione scaduta. Effettua nuovamente l\'accesso.';
      notify.pushNotification({ type: 'warning', message });
      auth.setLoginError(message);
      resetSessionState({ nextUserToken: null, nextDepartment: null });
    };

    window.addEventListener('onlygantt:user-session-invalid', handleUserSessionInvalid);
    return () => {
      window.removeEventListener('onlygantt:user-session-invalid', handleUserSessionInvalid);
    };
  }, [notify, auth, resetSessionState]);

  const checkDepartmentProtection = useCallback(async (deptName) => {
    if (!deptName) return false;

    if (Array.isArray(departmentsList) && departmentsList.length > 0) {
      const match = departmentsList.find(d => (typeof d === 'string' ? d === deptName : d?.name === deptName));
      if (match && typeof match === 'object') {
        const isProt = !!match.protected;
        auth.setIsDepartmentProtected(isProt);
        return isProt;
      }
    }

    try {
      await api.verifyPassword(deptName, '');
      auth.setIsDepartmentProtected(false);
      return false;
    } catch (err) {
      if (err.status === 401 || err.code === 'INVALID_PASSWORD') {
        auth.setIsDepartmentProtected(true);
        return true;
      }
      auth.setIsDepartmentProtected(false);
      return false;
    }
  }, [auth, departmentsList]);

  const confirmPendingChanges = async (actionDescription = 'procedere') => {
    if (!draftState.hasDraftChanges) return true;
    return notify.dialogApi.confirm({
      title: 'Modifiche non salvate',
      message: `Ci sono modifiche non salvate nel progetto in corso. Vuoi scartarle per ${actionDescription}?`,
      confirmLabel: 'Scarta modifiche',
      cancelLabel: 'Rimani qui',
      confirmTone: 'danger'
    });
  };

  const handleDepartmentChange = async (rawDept) => {
    const newDept = typeof rawDept === 'string' ? rawDept : (rawDept?.name || null);
    if (newDept === auth.department) return;

    const canProceed = await confirmPendingChanges('cambiare reparto');
    if (!canProceed) return;

    if (!newDept) {
      await resetSessionState({ nextDepartment: null });
      return;
    }

    if (auth.adminToken) {
      auth.setDepartment(newDept);
      auth.setLockEnabled(true);
      auth.setReadOnlyDepartment(false);
      draftState.closeProjectForm();
      filtersState.setSelectedProjectIds(new Set());
      setDepartmentValidationErrors([]);
      storage.setActiveSession({ userName: auth.userName, adminToken: auth.adminToken, department: newDept, userToken: auth.userToken });
      return;
    }

    const isProtected = await checkDepartmentProtection(newDept);
    const userRole = auth.adminToken ? 'supervisor' : (auth.userPermissions?.[newDept] || 'editor');
    const isReadOnly = !auth.adminToken && userRole === 'viewer';

    if (isProtected && !auth.adminToken) {
      const storedPassword = storage.getPassword(auth.effectiveUserName, newDept);
      if (storedPassword) {
        try {
          const verifyResult = await api.verifyPassword(newDept, storedPassword);
          if (verifyResult && verifyResult.ok) {
            auth.setDepartment(newDept);
            auth.setLockEnabled(false);
            auth.setReadOnlyDepartment(isReadOnly);
            draftState.closeProjectForm();
            filtersState.setSelectedProjectIds(new Set());
            setDepartmentValidationErrors([]);
            storage.setActiveSession({ userName: auth.userName, adminToken: auth.adminToken, department: newDept, userToken: auth.userToken, userPermissions: auth.userPermissions });
            return;
          }
        } catch (err) {}
      }

      const values = await notify.dialogApi.form({
        title: `Password reparto ${newDept}`,
        message: 'Questo reparto è protetto da password. Inserisci la password per accedere.',
        submitLabel: 'Accedi al reparto',
        fields: [
          {
            name: 'password',
            label: 'Password reparto',
            type: 'password',
            required: true,
            autoFocus: true
          }
        ]
      });

      if (!values) return;

      try {
        const verifyResult = await api.verifyPassword(newDept, values.password.trim());
        if (verifyResult && verifyResult.ok) {
          storage.setPassword(auth.effectiveUserName, newDept, values.password.trim());
          auth.setDepartment(newDept);
          auth.setLockEnabled(false);
          auth.setReadOnlyDepartment(isReadOnly);
          draftState.closeProjectForm();
          filtersState.setSelectedProjectIds(new Set());
          setDepartmentValidationErrors([]);
          storage.setActiveSession({ userName: auth.userName, adminToken: auth.adminToken, department: newDept, userToken: auth.userToken, userPermissions: auth.userPermissions });
        }
      } catch (err) {
        notify.pushNotification({ type: 'error', message: err.message || 'Password reparto errata' });
      }
      return;
    }

    auth.setDepartment(newDept);
    auth.setLockEnabled(false);
    auth.setReadOnlyDepartment(isReadOnly);
    draftState.closeProjectForm();
    filtersState.setSelectedProjectIds(new Set());
    setDepartmentValidationErrors([]);
    storage.setActiveSession({ userName: auth.userName, adminToken: auth.adminToken, department: newDept, userToken: auth.userToken, userPermissions: auth.userPermissions });
  };

  const handleEnableLock = async () => {
    if (!auth.department) return;

    if (auth.isDepartmentProtected && !auth.adminToken) {
      const storedPassword = storage.getPassword(auth.effectiveUserName, auth.department);

      if (storedPassword) {
        try {
          const verifyResult = await api.verifyPassword(auth.department, storedPassword);
          if (verifyResult && verifyResult.ok) {
            auth.setLockEnabled(true);
            return;
          }
        } catch (err) {}
      }

      const values = await notify.dialogApi.form({
        title: `Abilita modifica reparto ${auth.department}`,
        message: 'Questo reparto è protetto da password. Inserisci la password per abilitare la modifica.',
        submitLabel: 'Abilita modifica',
        fields: [
          {
            name: 'password',
            label: 'Password reparto',
            type: 'password',
            required: true,
            autoFocus: true
          }
        ]
      });

      if (!values) return;

      try {
        const verifyResult = await api.verifyPassword(auth.department, values.password.trim());
        if (verifyResult && verifyResult.ok) {
          storage.setPassword(auth.effectiveUserName, auth.department, values.password.trim());
          auth.setLockEnabled(true);
        }
      } catch (err) {
        notify.pushNotification({ type: 'error', message: err.message || 'Password reparto errata' });
      }
      return;
    }

    auth.setLockEnabled(true);
  };

  const handleDisableLock = async () => {
    const canProceed = await confirmPendingChanges('rilasciare la modifica');
    if (!canProceed) return;

    auth.setLockEnabled(false);
    if (isLocked) {
      try {
        await releaseLock();
      } catch (err) {}
    }
  };

  const handleChangePassword = async ({ oldPassword, newPassword }) => {
    if (!auth.department) return;

    try {
      const result = await api.changePassword(auth.department, oldPassword, newPassword);
      if (result && result.ok) {
        if (newPassword) {
          storage.setPassword(auth.effectiveUserName, auth.department, newPassword);
          auth.setIsDepartmentProtected(true);
        } else {
          storage.removePassword(auth.effectiveUserName, auth.department);
          auth.setIsDepartmentProtected(false);
        }
        notify.pushNotification({ type: 'success', message: 'Password reparto aggiornata con successo' });
      }
    } catch (err) {
      notify.pushNotification({ type: 'error', message: err.message || 'Impossibile aggiornare la password reparto' });
    }
  };

  const handleAdminResetPassword = async ({ department: targetDept, newPassword }) => {
    if (!auth.adminToken || !targetDept) return;
    try {
      const result = await api.resetPassword(targetDept, newPassword, auth.adminToken);
      if (result && result.ok) {
        if (targetDept === auth.department) {
          auth.setIsDepartmentProtected(!!newPassword);
        }
        notify.pushNotification({ type: 'success', message: `Password reparto ${targetDept} aggiornata da admin` });
      }
    } catch (err) {
      notify.pushNotification({ type: 'error', message: err.message || 'Impossibile impostare la password reparto' });
    }
  };

  const handleAdminCreateDepartment = async ({ name, password }) => {
    if (!auth.adminToken || !name) return;
    try {
      const result = await api.createDepartment(name, auth.adminToken);
      if (result && result.ok) {
        if (password) {
          await api.resetPassword(name, password, auth.adminToken);
        }
        notify.pushNotification({ type: 'success', message: `Reparto ${name} creato con successo` });
        await handleDepartmentChange(name);
      }
    } catch (err) {
      notify.pushNotification({ type: 'error', message: err.message || 'Impossibile creare il reparto' });
    }
  };

  const handleAdminDeleteDepartment = async ({ department: targetDept }) => {
    if (!auth.adminToken || !targetDept) return;
    try {
      await api.deleteDepartment(targetDept, auth.adminToken);
      notify.pushNotification({ type: 'success', message: `Reparto ${targetDept} eliminato con successo` });
      if (targetDept === auth.department) {
        await resetSessionState({ nextDepartment: null });
      }
    } catch (err) {
      notify.pushNotification({ type: 'error', message: err.message || 'Impossibile eliminare il reparto' });
    }
  };

  const handleAdminChangePassword = async ({ oldPassword, newPassword }) => {
    if (!auth.adminToken) return;
    try {
      const result = await api.adminChangePassword(oldPassword, newPassword, auth.adminToken);
      if (result && result.ok) {
        notify.pushNotification({ type: 'success', message: 'Password amministratore aggiornata con successo' });
      }
    } catch (err) {
      notify.pushNotification({ type: 'error', message: err.message || 'Impossibile aggiornare la password amministratore' });
    }
  };

  const handleAdminReleaseLock = async () => {
    if (!auth.adminToken || !auth.department) return;
    try {
      await api.adminReleaseLock(auth.department, auth.adminToken);
      refreshLock();
      notify.pushNotification({ type: 'success', message: `Lock del reparto ${auth.department} sbloccato dall'amministratore` });
    } catch (err) {
      notify.pushNotification({ type: 'error', message: err.message || 'Impossibile sbloccare il reparto' });
    }
  };

  const handleAdminModularExport = async (modulesToExport) => {
    if (!auth.adminToken) return;
    try {
      const payload = await api.adminExportModules(modulesToExport, auth.adminToken);
      const dataStr = JSON.stringify(payload, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `OnlyGANTT-Modular-Backup-${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify.pushNotification({ type: 'success', message: 'Esportazione modulare completata con successo' });
    } catch (err) {
      notify.pushNotification({ type: 'error', message: err.message || 'Impossibile esportare i moduli selezionati' });
    }
  };

  const handleAdminModularImport = async (file, modulesToImport) => {
    if (!auth.adminToken || !file) return;

    const readFileAsText = (f) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossibile leggere il file'));
      reader.readAsText(f);
    });

    try {
      const text = await readFileAsText(file);
      const backup = JSON.parse(text);

      const overwriteExisting = await notify.dialogApi.confirm({
        title: 'Importazione Modulare Admin',
        message: 'Sovrascrivere i reparti o le configurazioni eventualmente già esistenti?',
        confirmLabel: 'Sovrascrivi esistenti',
        cancelLabel: 'Salta esistenti',
        confirmTone: 'warning'
      });

      await api.adminImportModules(backup, modulesToImport, overwriteExisting, auth.adminToken);
      notify.pushNotification({ type: 'success', message: 'Importazione modulare completata con successo' });

      if (auth.department) {
        await loadProjects();
      }
    } catch (err) {
      notify.pushNotification({ type: 'error', message: err.message || 'Errore durante l\'importazione modulare' });
    }
  };

  const handleUserNameChange = (newName) => {
    auth.setUserName(newName);
    storage.setCurrentUser(newName);
    storage.setActiveSession({ userName: newName, adminToken: auth.adminToken, department: auth.department, userToken: auth.userToken });
  };

  const handleUserTokenChange = (token) => {
    auth.setUserToken(token);
    api.setUserToken(token);
    storage.setActiveSession({ userName: auth.userName, adminToken: auth.adminToken, department: auth.department, userToken: token });
  };

  const handleAdminLogin = (token) => {
    auth.setAdminToken(token);
    storage.setActiveSession({ userName: auth.userName, adminToken: token, department: auth.department, userToken: auth.userToken });
  };

  const handleExportPNG = () => {
    const canvas = document.querySelector('.gantt-canvas');
    if (!canvas) {
      notify.pushNotification({ type: 'warning', message: 'Nessun grafico Gantt visibile' });
      return;
    }

    try {
      const link = document.createElement('a');
      link.download = `OnlyGANTT-${auth.department || 'export'}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      notify.pushNotification({ type: 'success', message: 'Esportazione PNG completata' });
    } catch (err) {
      notify.pushNotification({ type: 'error', message: 'Impossibile esportare in PNG' });
    }
  };

  const refreshGantt = () => {
    gantt.invalidateCache();
    setGanttRefreshTrigger(prev => prev + 1);
  };

  useEffect(() => {
    if (filtersState.selectedProjectIds.size === 0 && projects.length > 0) {
      filtersState.setSelectedProjectIds(new Set(projects.map(p => p.id)));
    }
  }, [projects, filtersState]);

  const showProjectUnsavedBadge = draftState.showProjectForm && draftState.hasDraftChanges;

  const buildExportFileName = () => {
    const name = auth.department || 'OnlyGANTT';
    const date = new Date().toISOString().slice(0, 10);
    return `${name}-${date}.json`;
  };

  const handleNewProject = async () => {
    if (auth.readOnlyDepartment) return;

    const canProceed = await confirmPendingChanges('creare un nuovo progetto');
    if (!canProceed) return;

    draftState.openNewProjectForm();
  };

  const handleEditProject = async (project) => {
    if (!project) {
      handleNewProject();
      return;
    }

    const canProceed = await confirmPendingChanges('modificare un altro progetto');
    if (!canProceed) return;

    draftState.openEditProjectForm(project);
  };

  const handleCancelProjectForm = async () => {
    const canProceed = await confirmPendingChanges('chiudere il modulo');
    if (!canProceed) return;

    draftState.closeProjectForm();
  };

  const handleProjectFocusHandled = useCallback((projectId) => {
    draftState.setFocusedProjectId((current) => (current === projectId ? null : current));
  }, [draftState]);

  const handleGanttPhaseContextMenu = useCallback(({ phase, project }) => {
    if (project?.id) {
      draftState.setFocusedProjectId(project.id);
    }
  }, [draftState]);

  const handleSaveProject = async (projectToSave, { keepEditing = false } = {}) => {
    if (auth.readOnlyDepartment || draftState.isSavingProject) return;

    if (!auth.effectiveUserName) {
      notify.pushNotification({ type: 'warning', message: 'Inserisci il tuo nome' });
      return;
    }

    if (!projectToSave.nome || !projectToSave.nome.trim()) {
      notify.pushNotification({ type: 'warning', message: 'Il nome del progetto è obbligatorio' });
      return;
    }

    const cleanProject = {
      ...projectToSave,
      nome: projectToSave.nome.trim(),
      fasi: Array.isArray(projectToSave.fasi)
        ? projectToSave.fasi.map(fase => ({
            ...fase,
            nome: (fase.nome || '').trim(),
            note: (fase.note || '').trim()
          }))
        : []
    };

    const isExisting = projects.some(p => p.id === cleanProject.id);
    const newProjects = isExisting
      ? projects.map(p => p.id === cleanProject.id ? cleanProject : p)
      : [...projects, cleanProject];

    draftState.setIsSavingProject(true);
    try {
      await saveProjects(auth.effectiveUserName, newProjects);
      refreshGantt();
      notify.pushNotification({ type: 'success', message: 'Progetto salvato con successo' });

      if (keepEditing) {
        draftState.setEditingProject(cleanProject);
        draftState.setProjectDraft(cleanProject);
        draftState.setHasDraftChanges(false);
      } else {
        draftState.closeProjectForm();
      }
    } catch (err) {
      notify.pushNotification({ type: 'error', message: `Errore durante il salvataggio: ${err.message}` });
      await loadProjects();
    } finally {
      draftState.setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (auth.readOnlyDepartment || draftState.isSavingProject) return;

    const shouldDelete = await notify.dialogApi.confirm({
      title: 'Elimina progetto',
      message: 'Eliminare questo progetto dal reparto corrente?',
      confirmLabel: 'Elimina progetto',
      cancelLabel: 'Mantieni progetto',
      confirmTone: 'danger'
    });
    if (!shouldDelete) {
      return;
    }

    const newProjects = projects.filter(p => p.id !== projectId);
    updateProjects(newProjects);
    refreshGantt();

    const newSelected = new Set(filtersState.selectedProjectIds);
    newSelected.delete(projectId);
    filtersState.setSelectedProjectIds(newSelected);

    if (draftState.editingProject && draftState.editingProject.id === projectId) {
      draftState.closeProjectForm();
    }

    draftState.setIsSavingProject(true);
    try {
      await saveProjects(auth.effectiveUserName, newProjects);
    } catch (err) {
      notify.pushNotification({ type: 'error', message: `Errore durante l'eliminazione: ${err.message}` });
      await loadProjects();
    } finally {
      draftState.setIsSavingProject(false);
    }
  };

  const handleUserLogout = async () => {
    const canProceed = await confirmPendingChanges('uscire');
    if (!canProceed) return;

    if (auth.adminToken) {
      try {
        await api.adminLogout(auth.adminToken);
      } catch (err) {}
    } else if (auth.userToken) {
      try {
        await api.authLogout();
      } catch (err) {}
    }

    auth.setLoginError('');
    await resetSessionState({
      nextUserName: '',
      nextAdminToken: null,
      nextDepartment: null,
      nextUserToken: null
    });
    storage.clearActiveSession();
  };

  const handleImportJSON = async (file) => {
    if (auth.readOnlyDepartment) return;

    if (!auth.effectiveUserName) {
      notify.pushNotification({ type: 'warning', message: 'Inserisci il tuo nome' });
      return;
    }

    try {
      if (!file || (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json')) {
        notify.pushNotification({ type: 'error', message: 'Formato file non valido. Carica un file .json' });
        return;
      }
      await uploadJSON(file, auth.effectiveUserName);
      setDepartmentValidationErrors([]);
      notify.pushNotification({ type: 'success', message: 'Import completato con successo' });
    } catch (err) {
      if (err.details?.errors) {
        setDepartmentValidationErrors(err.details.errors);
      }
      notify.pushNotification({ type: 'error', message: `Errore durante l'import: ${err.message}` });
    }
  };

  const handleExportProjects = () => {
    if (!auth.department) return;
    const dataStr = JSON.stringify({ projects }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildExportFileName();
    a.click();
    URL.revokeObjectURL(url);
    notify.pushNotification({ type: 'success', message: 'Export progetti completato' });
  };

  const visibleProjects = useMemo(
    () => projects.filter(p => filtersState.selectedProjectIds.has(p.id)),
    [projects, filtersState.selectedProjectIds]
  );

  const ganttProjects = useMemo(
    () => (filtersState.filters.showOnlyMilestones
      ? visibleProjects.map(p => ({
          ...p,
          fasi: p.fasi.filter(f => f.milestone)
        }))
      : visibleProjects),
    [filtersState.filters.showOnlyMilestones, visibleProjects]
  );

  return (
    <ErrorBoundary>
      <div>
        <HeaderBar
          userName={auth.userName}
          department={auth.department}
          departments={departmentsList}
          userToken={auth.userToken}
          onDepartmentChange={handleDepartmentChange}
          lockInfo={lockInfo}
          isLocked={isLocked}
          lockEnabled={auth.lockEnabled}
          onRefreshLock={refreshLock}
          onEnableLock={handleEnableLock}
          onReleaseLock={handleDisableLock}
          onUserLogout={handleUserLogout}
          readOnlyDepartment={auth.readOnlyDepartment}
          adminToken={auth.adminToken}
          onChangePassword={handleChangePassword}
          onAdminCreateDepartment={handleAdminCreateDepartment}
          onAdminDeleteDepartment={handleAdminDeleteDepartment}
          onAdminResetPassword={handleAdminResetPassword}
          onAdminChangePassword={handleAdminChangePassword}
          onAdminReleaseLock={handleAdminReleaseLock}
          onNavigateSystemSettings={() => filtersState.setActiveView('systemSettings')}
          onNavigateUserManagement={() => filtersState.setActiveView('userManagement')}
          dialogApi={notify.dialogApi}
          pushNotification={notify.pushNotification}
        />

        {lockError && lockError.lockedBy && (
          <div className="lock-banner">
            Reparto bloccato da {lockError.lockedBy} dal{' '}
            {new Date(lockError.lockedAt).toLocaleString('it-IT')}
            {' '}fino a{' '}
            {new Date(lockError.expiresAt).toLocaleString('it-IT')}
          </div>
        )}

        {lockError && !lockError.lockedBy && lockError.message && (
          <div className="lock-banner">
            {lockError.message}
          </div>
        )}

        <main className="main-container">
          {filtersState.activeView === 'systemSettings' && auth.adminToken ? (
            <SystemSettings
              onBack={() => filtersState.setActiveView('gantt')}
              onAdminModularExport={handleAdminModularExport}
              onAdminModularImport={handleAdminModularImport}
              adminToken={auth.adminToken}
              dialogApi={notify.dialogApi}
              pushNotification={notify.pushNotification}
            />
          ) : filtersState.activeView === 'userManagement' && auth.adminToken ? (
            <UserManagement
              adminToken={auth.adminToken}
              onBack={() => filtersState.setActiveView('gantt')}
              dialogApi={notify.dialogApi}
            />
          ) : !auth.department ? (
            <LoginScreen
              userName={auth.userName}
              onUserNameChange={handleUserNameChange}
              onDepartmentChange={handleDepartmentChange}
              userToken={auth.userToken}
              adminToken={auth.adminToken}
              onAdminLogin={handleAdminLogin}
              onAdminLogout={handleUserLogout}
              onUserTokenChange={handleUserTokenChange}
              loginError={auth.loginError}
              setLoginError={auth.setLoginError}
              pushNotification={notify.pushNotification}
              onNavigateSystemSettings={() => filtersState.setActiveView('systemSettings')}
              onNavigateUserManagement={() => filtersState.setActiveView('userManagement')}
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
                    viewMode={filtersState.viewMode}
                    onViewModeChange={filtersState.setViewMode}
                    onGoToToday={filtersState.triggerScrollToToday}
                    onExportPNG={handleExportPNG}
                    filters={filtersState.filters}
                    onFiltersChange={filtersState.setFilters}
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
                          selectedProjectIds={filtersState.selectedProjectIds}
                          onSelectedProjectIdsChange={filtersState.setSelectedProjectIds}
                          onEditProject={handleEditProject}
                          onDeleteProject={handleDeleteProject}
                          readOnly={auth.readOnlyDepartment}
                          isSaving={draftState.isSavingProject}
                          hoveredProjectId={hoveredProjectId}
                          onProjectHover={setHoveredProjectId}
                          verticalScrollTop={verticalScrollTop}
                          onVerticalScrollChange={setVerticalScrollTop}
                          ganttHeaderHeight={(AppConfig?.gantt?.CANVAS_TOP_MARGIN || AppConfig?.default?.gantt?.CANVAS_TOP_MARGIN || 156)}
                          onCollapsedChange={setSidebarCollapsed}
                          viewMode={filtersState.viewMode}
                          isScrollable={isGanttScrollable}
                        />
                        <div className="gantt-main-area">
                          <GanttCanvas
                            viewMode={filtersState.viewMode}
                            projects={ganttProjects}
                            filters={filtersState.filters}
                            scrollToTodayTrigger={filtersState.scrollToTodayTrigger}
                            refreshTrigger={ganttRefreshTrigger}
                            onPhaseContextMenu={handleGanttPhaseContextMenu}
                            hoveredProjectId={hoveredProjectId}
                            onProjectHover={setHoveredProjectId}
                            verticalScrollTop={verticalScrollTop}
                            onVerticalScrollChange={setVerticalScrollTop}
                            sidebarCollapsed={sidebarCollapsed}
                            onIsScrollableChange={setIsGanttScrollable}
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
                      {draftState.showProjectForm && (
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
                        disabled={auth.readOnlyDepartment || draftState.isSavingProject}
                      >
                        Nuovo Progetto
                      </button>
                      {draftState.showProjectForm && (
                        <button
                          onClick={() => draftState.projectDraft && handleSaveProject(draftState.projectDraft)}
                          className="btn-success"
                          disabled={auth.readOnlyDepartment || draftState.isSavingProject || !draftState.projectDraft}
                        >
                          {draftState.isSavingProject ? 'Salvataggio...' : 'Salva progetto e chiudi'}
                        </button>
                      )}
                      {draftState.showProjectForm && (
                        <button
                          onClick={() => draftState.projectDraft?.id && handleDeleteProject(draftState.projectDraft.id)}
                          className="btn-danger"
                          disabled={auth.readOnlyDepartment || draftState.isSavingProject || !draftState.projectDraft?.id}
                        >
                          Elimina progetto
                        </button>
                      )}
                      {draftState.showProjectForm && draftState.hasDraftChanges && (
                        <button
                          onClick={handleCancelProjectForm}
                          className="btn-secondary"
                          disabled={draftState.isSavingProject}
                        >
                          Annulla modifiche
                        </button>
                      )}
                    </div>
                  </div>

                  {draftState.showProjectForm && (
                    <div style={{ marginTop: '1rem' }}>
                      <ProjectForm
                        project={draftState.editingProject}
                        onSave={handleSaveProject}
                        onDelete={handleDeleteProject}
                        onCancel={handleCancelProjectForm}
                        readOnly={auth.readOnlyDepartment}
                        isSaving={draftState.isSavingProject}
                        onDraftChange={draftState.setProjectDraft}
                        dialogApi={notify.dialogApi}
                        pushNotification={notify.pushNotification}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <ProjectList
                    projects={projects}
                    selectedProjectIds={filtersState.selectedProjectIds}
                    onSelectedProjectIdsChange={filtersState.setSelectedProjectIds}
                    onEditProject={handleEditProject}
                    onDeleteProject={handleDeleteProject}
                    onExportJSON={handleExportProjects}
                    onImportJSON={handleImportJSON}
                    validationErrors={validationErrors}
                    readOnly={auth.readOnlyDepartment}
                    isSaving={draftState.isSavingProject}
                    focusedProjectId={draftState.focusedProjectId}
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

        {notify.notifications.length > 0 && (
          <div className="notification-container" role="status" aria-live="polite">
            {notify.notifications.map(item => (
              <div key={item.id} className={`notification notification-${item.type}`}>
                {item.title && <div className="notification-title">{item.title}</div>}
                <div>{item.message}</div>
                <button
                  type="button"
                  className="notification-close"
                  onClick={() => notify.removeNotification(item.id)}
                  aria-label="Chiudi notifica"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <DialogHost dialog={notify.dialogState} onResolve={notify.resolveDialog} />
      </div>
    </ErrorBoundary>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.App = App;
}

export default App;
