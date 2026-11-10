import logic from '../../domain/projectLogic.js';

const { useState, useCallback } = React;

export function useProjectDraft() {
  const [editingProject, setEditingProject] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectDraft, setProjectDraft] = useState(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [focusedProjectId, setFocusedProjectId] = useState(null);
  const [initialFormTab, setInitialFormTab] = useState('general');
  const [initialPhaseId, setInitialPhaseId] = useState(null);

  const openNewProjectForm = useCallback(() => {
    const newProj = logic.createNewProject();
    setEditingProject(null);
    setProjectDraft(newProj);
    setInitialFormTab('general');
    setInitialPhaseId(null);
    setShowProjectForm(true);
    setHasDraftChanges(false);
  }, []);

  const openEditProjectForm = useCallback((project, options = {}) => {
    setEditingProject(project);
    setProjectDraft(JSON.parse(JSON.stringify(project)));
    setInitialFormTab(options.tab || (options.phaseId ? 'phases' : 'general'));
    setInitialPhaseId(options.phaseId || null);
    setShowProjectForm(true);
    setHasDraftChanges(false);
  }, []);

  const closeProjectForm = useCallback(() => {
    setShowProjectForm(false);
    setEditingProject(null);
    setProjectDraft(null);
    setInitialFormTab('general');
    setInitialPhaseId(null);
    setHasDraftChanges(false);
  }, []);

  return {
    editingProject,
    setEditingProject,
    showProjectForm,
    setShowProjectForm,
    projectDraft,
    setProjectDraft,
    isSavingProject,
    setIsSavingProject,
    hasDraftChanges,
    setHasDraftChanges,
    focusedProjectId,
    setFocusedProjectId,
    initialFormTab,
    initialPhaseId,
    openNewProjectForm,
    openEditProjectForm,
    closeProjectForm
  };
}

export default useProjectDraft;
