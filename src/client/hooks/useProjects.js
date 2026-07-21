import api from '../api.js';
import logic from '../../domain/projectLogic.js';

const { useState, useEffect, useCallback } = React;
const generateId = logic.generateUUID;

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossibile leggere il file'));
    reader.readAsText(file);
  });
}

function ensureIds(projects) {
  return (projects || []).map(project => {
    const projectId = project.id || generateId();
    const phases = Array.isArray(project.fasi)
      ? project.fasi.map(phase => ({
          ...phase,
          id: phase.id || generateId()
        }))
      : [];
    return {
      ...project,
      id: projectId,
      fasi: phases
    };
  });
}

export function useProjects(department, readOnly, options = {}) {
  const { requestProjectFixConfirmation } = options;
  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);

  const validateProjects = useCallback(async (rawProjects, contextLabel) => {
    const { errors, projects: fixedProjects } = logic.validateAndFixProjects(rawProjects);
    if (errors.length === 0) {
      return { projects: fixedProjects, fixed: false, errors };
    }

    const confirmFix = requestProjectFixConfirmation
      ? await requestProjectFixConfirmation({ contextLabel, errors })
      : false;

    if (!confirmFix) {
      throw new Error('Operazione annullata: dati non corretti.');
    }

    return { projects: fixedProjects, fixed: true, errors };
  }, [requestProjectFixConfirmation]);

  const loadProjects = useCallback(async () => {
    if (!department) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.getProjects(department);
      const { projects: fixedProjects, fixed, errors: fixErrors } = await validateProjects(data.projects || [], 'Caricamento progetti');
      const serverErrors = Array.isArray(data.validationErrors) ? data.validationErrors : [];
      setValidationErrors([...serverErrors, ...fixErrors]);
      setProjects(ensureIds(fixedProjects));
      setMeta(data.meta);
      setIsDirty(fixed);
    } catch (err) {
      setError(err.message);
      setProjects([]);
      setMeta(null);
      setValidationErrors([]);
    } finally {
      setIsLoading(false);
    }
  }, [department, validateProjects]);

  const saveProjects = useCallback(async (userName, projectsOverride = null) => {
    if (!department || readOnly) {
      throw new Error('Cannot save in read-only mode');
    }

    if (!meta || meta.revision === undefined) {
      throw new Error('Missing revision information');
    }

    try {
      const projectsToSave = projectsOverride || projects;
      const result = await api.saveProjects(department, projectsToSave, meta.revision, userName);
      setMeta(result.meta);
      setIsDirty(false);
      return result;
    } catch (err) {
      if (err.status === 409) {
        await loadProjects();
        throw new Error('Data was updated by another user. Your changes were not saved. Please try again.');
      }
      throw err;
    }
  }, [department, readOnly, projects, meta, loadProjects]);

  const updateProjects = useCallback((newProjects) => {
    if (readOnly) return;
    setProjects(newProjects);
    setIsDirty(true);
  }, [readOnly]);

  const uploadJSON = useCallback(async (file, userName) => {
    if (!department || readOnly) {
      throw new Error('Cannot upload in read-only mode');
    }

    const rawText = await readFileAsText(file);
    let parsedData;
    try {
      parsedData = JSON.parse(rawText);
    } catch (err) {
      throw new Error('JSON non valido');
    }

    const { projects: fixedProjects, errors: fixErrors } = await validateProjects(parsedData.projects || [], 'Import JSON');
    const payload = {
      ...parsedData,
      projects: ensureIds(fixedProjects)
    };

    const fixedFile = new File([JSON.stringify(payload, null, 2)], file.name, { type: 'application/json' });

    const result = await api.uploadJSON(department, fixedFile, userName);
    setMeta(result.meta);
    await loadProjects();
    setValidationErrors((previousErrors) => {
      const existing = Array.isArray(previousErrors) ? previousErrors : [];
      return Array.from(new Set([...existing, ...fixErrors]));
    });
    return result;
  }, [department, readOnly, loadProjects, validateProjects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const [remoteNotice, setRemoteNotice] = useState(null);

  const clearRemoteNotice = useCallback(() => {
    setRemoteNotice(null);
  }, []);

  useEffect(() => {
    if (!department) return;

    const eventSource = new EventSource(`/api/projects/${encodeURIComponent(department)}/events`);

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'update') {
          setRemoteNotice({
            updatedBy: message.updatedBy || 'Un utente',
            changes: Array.isArray(message.changes) ? message.changes : [],
            revision: message.revision,
            updatedAt: message.updatedAt || new Date().toISOString()
          });

          if (readOnly || !isDirty) {
            loadProjects();
          }
        }
      } catch (err) {
        console.error('[SSE] Error parsing update event:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [department, readOnly, isDirty, loadProjects]);

  return {
    projects,
    meta,
    isDirty,
    isLoading,
    validationErrors,
    error,
    remoteNotice,
    clearRemoteNotice,
    loadProjects,
    saveProjects,
    updateProjects,
    uploadJSON
  };
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.hooks = window.OnlyGantt.hooks || {};
  window.OnlyGantt.hooks.useProjects = useProjects;
}

export default useProjects;
