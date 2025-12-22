// Custom hook for projects data management
// Exposed on window.OnlyGantt.hooks.useProjects

(function() {
  'use strict';

  const { useState, useEffect, useCallback } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.hooks = window.OnlyGantt.hooks || {};

  const api = window.OnlyGantt.api;
  const logic = window.OnlyGantt.logic;

  function generateId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  function useProjects(department, readOnly) {
    const [projects, setProjects] = useState([]);
    const [meta, setMeta] = useState(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);

    const readFileAsText = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Impossibile leggere il file'));
      reader.readAsText(file);
    });

    const validateProjects = (rawProjects, contextLabel) => {
      const { errors, projects: fixedProjects } = logic.validateAndFixProjects(rawProjects);
      if (errors.length === 0) {
        return { projects: fixedProjects, fixed: false, errors };
      }

      const confirmFix = confirm(
        `${contextLabel}: rilevati ${errors.length} errori nei dati. Vuoi applicare il fix automatico per continuare?`
      );

      if (!confirmFix) {
        throw new Error('Operazione annullata: dati non corretti.');
      }

      return { projects: fixedProjects, fixed: true, errors };
    };

    // Load projects
    const loadProjects = useCallback(async () => {
      if (!department) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await api.getProjects(department);
        const { projects: fixedProjects, fixed, errors: fixErrors } = validateProjects(data.projects || [], 'Caricamento progetti');
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
    }, [department]);

    // Save projects
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
          // Revision mismatch: reload
          await loadProjects();
          throw new Error('Data was updated by another user. Your changes were not saved. Please try again.');
        }
        throw err;
      }
    }, [department, readOnly, projects, meta, loadProjects]);

    // Update projects (marks dirty)
    const updateProjects = useCallback((newProjects) => {
      if (readOnly) return;
      setProjects(newProjects);
      setIsDirty(true);
    }, [readOnly]);

    // Upload JSON
    const uploadJSON = useCallback(async (file, userName) => {
      if (!department || readOnly) {
        throw new Error('Cannot upload in read-only mode');
      }

      try {
        const rawText = await readFileAsText(file);
        let parsedData;
        try {
          parsedData = JSON.parse(rawText);
        } catch (err) {
          throw new Error('JSON non valido');
        }

        const { projects: fixedProjects, errors: fixErrors } = validateProjects(parsedData.projects || [], 'Import JSON');
        const payload = {
          ...parsedData,
          projects: ensureIds(fixedProjects)
        };

        const fixedFile = new File([JSON.stringify(payload, null, 2)], file.name, { type: 'application/json' });

        const result = await api.uploadJSON(department, fixedFile, userName);
        setMeta(result.meta);
        await loadProjects();
        setValidationErrors(fixErrors);
        return result;
      } catch (err) {
        throw err;
      }
    }, [department, readOnly, loadProjects]);

    // Effect: load projects when department changes
    useEffect(() => {
      loadProjects();
    }, [loadProjects]);

    return {
      projects,
      meta,
      isDirty,
      isLoading,
      validationErrors,
      error,
      loadProjects,
      saveProjects,
      updateProjects,
      uploadJSON
    };
  }

  window.OnlyGantt.hooks.useProjects = useProjects;
})();
