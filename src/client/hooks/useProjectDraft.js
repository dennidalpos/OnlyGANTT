import logic from '../../domain/projectLogic.js';

const { useState, useCallback } = React;

export function useProjectDraft() {
  const [editingProject, setEditingProject] = useState(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectDraft, setProjectDraft] = useState(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [focusedProjectId, setFocusedProjectId] = useState(null);

  const openNewProjectForm = useCallback(() => {
    const newProj = logic.createNewProject();
    setEditingProject(null);
    setProjectDraft(newProj);
    setShowProjectForm(true);
    setHasDraftChanges(false);
  }, []);

  const openEditProjectForm = useCallback((project) => {
    setEditingProject(project);
    setProjectDraft(JSON.parse(JSON.stringify(project)));
    setShowProjectForm(true);
    setHasDraftChanges(false);
  }, []);

  const closeProjectForm = useCallback(() => {
    setShowProjectForm(false);
    setEditingProject(null);
    setProjectDraft(null);
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
    openNewProjectForm,
    openEditProjectForm,
    closeProjectForm
  };
}

export default useProjectDraft;
