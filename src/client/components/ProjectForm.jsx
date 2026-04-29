(function() {
  'use strict';

  const { useState, useEffect } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  const logic = window.OnlyGantt.logic;
  const config = window.AppConfig;

  function ProjectForm({
    project,
    onSave,
    onDelete,
    onCancel,
    readOnly,
    isSaving,
    onDraftChange,
    dialogApi,
    pushNotification
  }) {
    const [formData, setFormData] = useState(null);
    const [formStatus, setFormStatus] = useState(null);

    useEffect(() => {
      if (project) {
        const cloned = JSON.parse(JSON.stringify(project));
        setFormData(cloned);
        setFormStatus(null);
        if (onDraftChange) {
          onDraftChange(cloned);
        }
      } else {
        const newProject = logic.createNewProject();
        setFormData(newProject);
        setFormStatus(null);
        if (onDraftChange) {
          onDraftChange(newProject);
        }
      }
    }, [project, onDraftChange]);

    if (!formData) return null;

    const projectFormId = `project-form-${formData.id || 'new'}`;

    const updateFormData = (nextData) => {
      setFormData(nextData);
      if (formStatus) {
        setFormStatus(null);
      }
      if (onDraftChange) {
        onDraftChange(nextData);
      }
    };

    const handleProjectChange = (field, value) => {
      updateFormData({
        ...formData,
        [field]: value
      });
    };

    const handlePhaseChange = (index, field, value) => {
      const newFasi = [...formData.fasi];
      newFasi[index] = {
        ...newFasi[index],
        [field]: value
      };

      if (field === 'nome') {
        const allPhaseNames = logic.getAllPhaseNames([formData]);
        newFasi[index].colore = logic.getPhaseColor(value, allPhaseNames);
      }

      updateFormData({
        ...formData,
        fasi: newFasi
      });
    };

    const addPresetPhase = (preset) => {
      const presetName = preset.colore ? preset.nome : '';
      const newPhase = logic.createNewPhase(presetName, { colore: preset.colore });
      updateFormData({
        ...formData,
        fasi: [...formData.fasi, newPhase]
      });
    };

    const insertPhaseAtIndex = (index, preset = null) => {
      const presetName = preset && preset.colore ? preset.nome : '';
      const newPhase = logic.createNewPhase(presetName, preset ? { colore: preset.colore } : {});
      const newFasi = [...formData.fasi];
      newFasi.splice(index, 0, newPhase);
      updateFormData({
        ...formData,
        fasi: newFasi
      });
    };

    const removePhase = async (index) => {
      if (!dialogApi) return;
      const shouldDelete = await dialogApi.confirm({
        title: 'Elimina fase',
        message: 'Eliminare questa fase dal progetto corrente?',
        confirmLabel: 'Elimina fase',
        cancelLabel: 'Mantieni fase',
        confirmTone: 'danger'
      });
      if (!shouldDelete) return;

      const newFasi = formData.fasi.filter((_, i) => i !== index);
      updateFormData({
        ...formData,
        fasi: newFasi
      });
    };

    const handleSave = (keepEditing = false) => {
      if (!formData.nome || !formData.nome.trim()) {
        setFormStatus({ type: 'warning', message: 'Nome progetto obbligatorio' });
        if (pushNotification) {
          pushNotification({ type: 'warning', message: 'Nome progetto obbligatorio' });
        }
        return;
      }

      onSave(formData, { keepEditing });
    };

    const handleDelete = () => {
      if (!project || !onDelete) return;
      onDelete(project.id);
    };

    return (
      <div className="card">
        <h2 className="card-title">
          {project ? 'Modifica Progetto' : 'Nuovo Progetto'}
        </h2>

        {formStatus && (
          <div className={`alert-item ${formStatus.type}`} style={{ marginBottom: '1rem' }}>
            {formStatus.message}
          </div>
        )}

        <div className="form-group">
          <label htmlFor={`${projectFormId}-nome`}>Nome Progetto *</label>
          <input
            id={`${projectFormId}-nome`}
            type="text"
            value={formData.nome}
            onChange={(e) => handleProjectChange('nome', e.target.value)}
            disabled={readOnly}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${projectFormId}-colore`}>Colore</label>
            <input
              id={`${projectFormId}-colore`}
              type="color"
              value={formData.colore}
              onChange={(e) => handleProjectChange('colore', e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${projectFormId}-stato`}>Stato</label>
            <select
              id={`${projectFormId}-stato`}
              value={formData.stato}
              onChange={(e) => handleProjectChange('stato', e.target.value)}
              disabled={readOnly}
            >
              {config.states.map(state => (
                <option key={state} value={state}>
                  {config.stateLabels[state]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${projectFormId}-data-inizio`}>Data Inizio</label>
            <input
              id={`${projectFormId}-data-inizio`}
              type="date"
              value={formData.dataInizio || ''}
              onChange={(e) => handleProjectChange('dataInizio', e.target.value || null)}
              disabled={readOnly}
            />
          </div>

          <div className="form-group">
            <label htmlFor={`${projectFormId}-data-fine`}>Data Fine</label>
            <input
              id={`${projectFormId}-data-fine`}
              type="date"
              value={formData.dataFine || ''}
              onChange={(e) => handleProjectChange('dataFine', e.target.value || null)}
              onFocus={() => {
                if (!formData.dataFine && formData.dataInizio) {
                  handleProjectChange('dataFine', formData.dataInizio);
                }
              }}
              min={formData.dataInizio || undefined}
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor={`${projectFormId}-percentuale`}>Percentuale Completamento</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              id={`${projectFormId}-percentuale`}
              type="number"
              min="0"
              max="100"
              value={formData.percentualeCompletamento === null ? '' : formData.percentualeCompletamento}
              onChange={(e) => handleProjectChange('percentualeCompletamento', e.target.value === '' ? null : parseInt(e.target.value, 10))}
              placeholder="Auto (media fasi)"
              disabled={readOnly || formData.percentualeCompletamento === null}
            />
            <label className="checkbox-label" htmlFor={`${projectFormId}-percentuale-auto`}>
              <input
                id={`${projectFormId}-percentuale-auto`}
                type="checkbox"
                checked={formData.percentualeCompletamento === null}
                onChange={(e) => handleProjectChange('percentualeCompletamento', e.target.checked ? null : 0)}
                disabled={readOnly}
              />
              Auto
            </label>
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
          Fasi
        </h3>

        {!readOnly && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Fasi Preset:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {config.phasePresets.map(preset => (
                <button
                  key={preset.nome}
                  onClick={() => addPresetPhase(preset)}
                  className="btn-small"
                  style={{
                    backgroundColor: preset.colore || 'var(--bg-secondary)',
                    color: '#ffffff',
                    border: preset.colore ? 'none' : '1px dashed #64748b',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  + {preset.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {formData.fasi.map((fase, index) => {
          const phaseFormId = `${projectFormId}-phase-${fase.id || index}`;

          return (
          <React.Fragment key={fase.id}>
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong>Fase {index + 1}</strong>
                {!readOnly && (
                  <div className="button-group">
                    <button
                      onClick={() => handleSave(true)}
                      className="btn-success btn-small"
                      disabled={isSaving}
                    >
                      {isSaving ? 'Salvataggio...' : 'Salva'}
                    </button>
                    <button
                      onClick={() => removePhase(index)}
                      className="btn-danger btn-small"
                      disabled={isSaving}
                    >
                      Elimina
                    </button>
                  </div>
                )}
              </div>

            <div className="form-group">
              <label htmlFor={`${phaseFormId}-nome`}>Nome Fase *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: fase.colore || '#64748b',
                    borderRadius: '4px',
                    border: '1px solid #475569',
                    flexShrink: 0
                  }}
                  title={`Colore: ${fase.colore || '#64748b'}`}
                />
                <input
                  id={`${phaseFormId}-nome`}
                  type="text"
                  value={fase.nome}
                  onChange={(e) => handlePhaseChange(index, 'nome', e.target.value)}
                  disabled={readOnly}
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor={`${phaseFormId}-data-inizio`}>Data Inizio</label>
                <input
                  id={`${phaseFormId}-data-inizio`}
                  type="date"
                  value={fase.dataInizio || ''}
                  onChange={(e) => handlePhaseChange(index, 'dataInizio', e.target.value || null)}
                  disabled={readOnly}
                />
              </div>

              <div className="form-group">
                <label htmlFor={`${phaseFormId}-data-fine`}>Data Fine</label>
                <input
                  id={`${phaseFormId}-data-fine`}
                  type="date"
                  value={fase.dataFine || ''}
                  onChange={(e) => handlePhaseChange(index, 'dataFine', e.target.value || null)}
                  onFocus={() => {
                    if (!fase.dataFine && fase.dataInizio) {
                      handlePhaseChange(index, 'dataFine', fase.dataInizio);
                    }
                  }}
                  min={fase.dataInizio || undefined}
                  disabled={readOnly}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor={`${phaseFormId}-stato`}>Stato</label>
                <select
                  id={`${phaseFormId}-stato`}
                  value={fase.stato}
                  onChange={(e) => handlePhaseChange(index, 'stato', e.target.value)}
                  disabled={readOnly}
                >
                  {config.states.map(state => (
                    <option key={state} value={state}>
                      {config.stateLabels[state]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor={`${phaseFormId}-percentuale`}>Completamento (%)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    id={`${phaseFormId}-percentuale`}
                    type="number"
                    min="0"
                    max="100"
                    value={fase.percentualeCompletamento === null ? '' : fase.percentualeCompletamento}
                    onChange={(e) => handlePhaseChange(index, 'percentualeCompletamento', e.target.value === '' ? null : parseInt(e.target.value, 10) || 0)}
                    disabled={readOnly || fase.percentualeCompletamento === null}
                  />
                  <label className="checkbox-label" htmlFor={`${phaseFormId}-percentuale-auto`}>
                    <input
                      id={`${phaseFormId}-percentuale-auto`}
                      type="checkbox"
                      checked={fase.percentualeCompletamento === null}
                      onChange={(e) => handlePhaseChange(index, 'percentualeCompletamento', e.target.checked ? null : 0)}
                      disabled={readOnly}
                    />
                    Auto
                  </label>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label" htmlFor={`${phaseFormId}-milestone`}>
                <input
                  id={`${phaseFormId}-milestone`}
                  type="checkbox"
                  checked={fase.milestone}
                  onChange={(e) => handlePhaseChange(index, 'milestone', e.target.checked)}
                  disabled={readOnly}
                />
                Milestone
              </label>
            </div>

            <div className="form-group">
              <label className="checkbox-label" htmlFor={`${phaseFormId}-include-festivi`}>
                <input
                  id={`${phaseFormId}-include-festivi`}
                  type="checkbox"
                  checked={fase.includeFestivi}
                  onChange={(e) => handlePhaseChange(index, 'includeFestivi', e.target.checked)}
                  disabled={readOnly}
                />
                Include festività e weekend
              </label>
            </div>

            <div className="form-group">
              <label htmlFor={`${phaseFormId}-note`}>Note</label>
              <textarea
                id={`${phaseFormId}-note`}
                value={fase.note}
                onChange={(e) => handlePhaseChange(index, 'note', e.target.value)}
                disabled={readOnly}
              />
            </div>
            </div>

            {!readOnly && index < formData.fasi.length - 1 && (
              <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', border: '1px dashed #475569', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Inserisci fase tra {index + 1} e {index + 2}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {config.phasePresets.map(preset => (
                    <button
                      key={`${preset.nome}-${fase.id}-insert`}
                      onClick={() => insertPhaseAtIndex(index + 1, preset)}
                      className="btn-small"
                      style={{
                        backgroundColor: preset.colore || 'var(--bg-secondary)',
                        color: '#ffffff',
                        border: preset.colore ? 'none' : '1px dashed #64748b',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem'
                      }}
                    >
                      + {preset.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </React.Fragment>
          );
        })}

        {!readOnly && formData.fasi.length > 0 && (
          <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px dashed #475569', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
              Inserisci fase
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {config.phasePresets.map(preset => (
                <button
                  key={`${preset.nome}-insert-end`}
                  onClick={() => insertPhaseAtIndex(formData.fasi.length, preset)}
                  className="btn-small"
                  style={{
                    backgroundColor: preset.colore || 'var(--bg-secondary)',
                    color: '#ffffff',
                    border: preset.colore ? 'none' : '1px dashed #64748b',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  + {preset.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="button-group">
          <button onClick={() => handleSave(false)} className="btn-success" disabled={readOnly || isSaving}>
            {isSaving ? 'Salvataggio...' : 'Salva progetto e chiudi'}
          </button>
          {project && !readOnly && (
            <button onClick={handleDelete} className="btn-danger" disabled={isSaving}>
              Elimina progetto
            </button>
          )}
          <button onClick={onCancel} className="btn-secondary" disabled={isSaving}>
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  window.OnlyGantt.components.ProjectForm = ProjectForm;
})();
