const { useEffect, useRef, useState } = React;

export function DialogHost({ dialog, onResolve }) {
  const [values, setValues] = useState({});
  const [validationError, setValidationError] = useState('');
  const submitButtonRef = useRef(null);

  useEffect(() => {
    if (!dialog) return;
    const nextValues = {};
    (dialog.fields || []).forEach((field) => {
      const initialValue = dialog.initialValues && Object.prototype.hasOwnProperty.call(dialog.initialValues, field.name)
        ? dialog.initialValues[field.name]
        : (field.defaultValue !== undefined ? field.defaultValue : (field.type === 'checkbox' ? false : ''));
      nextValues[field.name] = initialValue;
    });
    setValues(nextValues);
    setValidationError('');
  }, [dialog?.id]);

  useEffect(() => {
    if (!dialog) return undefined;

    const handleEscape = (event) => {
      if (event.key !== 'Escape' || dialog.disableEscape) return;
      event.preventDefault();
      onResolve({ action: 'cancel', values });
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [dialog, onResolve, values]);

  if (!dialog) return null;

  const titleId = `dialog-title-${dialog.id}`;

  const handleSubmit = (e) => {
    e.preventDefault();
    for (const field of dialog.fields || []) {
      const rawValue = values[field.name];
      const stringValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

      if (field.required && (!stringValue || (typeof stringValue === 'string' && !stringValue.trim()))) {
        setValidationError(`Il campo "${field.label || field.name}" è obbligatorio.`);
        return;
      }

      if (field.minLength && typeof stringValue === 'string' && stringValue.length < field.minLength) {
        setValidationError(field.minLengthMessage || `Il campo "${field.label || field.name}" deve contenere almeno ${field.minLength} caratteri.`);
        return;
      }
    }

    setValidationError('');
    onResolve({ action: 'submit', values });
  };

  const isForm = dialog.type === 'form';
  const isDanger = dialog.confirmTone === 'danger';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem'
      }}
      role="presentation"
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="card-title" style={{ marginTop: 0 }}>
          {dialog.title}
        </h2>

        {dialog.message && (
          <p className="text-muted" style={{ marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
            {dialog.message}
          </p>
        )}

        {validationError && (
          <div className="alert-item error" style={{ marginBottom: '1rem' }}>
            {validationError}
          </div>
        )}

        {isForm ? (
          <form onSubmit={handleSubmit}>
            {(dialog.fields || []).map((field) => {
              const fieldId = `dialog-${dialog.id}-${field.name}`;
              return (
                <div key={field.name} className="form-group" style={{ marginBottom: '1rem' }}>
                  {field.type !== 'checkbox' && (
                    <label htmlFor={fieldId}>
                      {field.label} {field.required ? '*' : ''}
                    </label>
                  )}

                  {field.type === 'select' ? (
                    <select
                      id={fieldId}
                      value={values[field.name] || ''}
                      onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                      autoFocus={field.autoFocus}
                    >
                      {(field.options || []).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label className="checkbox-label" htmlFor={fieldId}>
                      <input
                        id={fieldId}
                        type="checkbox"
                        checked={!!values[field.name]}
                        onChange={(e) => setValues({ ...values, [field.name]: e.target.checked })}
                        autoFocus={field.autoFocus}
                      />
                      {field.label}
                    </label>
                  ) : (
                    <input
                      id={fieldId}
                      type={field.type || 'text'}
                      value={values[field.name] || ''}
                      onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      autoFocus={field.autoFocus}
                    />
                  )}

                  {field.helperText && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      {field.helperText}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="button-group" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button
                ref={submitButtonRef}
                type="submit"
                className={isDanger ? 'btn-danger' : 'btn-success'}
              >
                {dialog.submitLabel || 'Conferma'}
              </button>
              {!dialog.hideCancel && (
                <button
                  type="button"
                  onClick={() => onResolve({ action: 'cancel', values })}
                  className="btn-secondary"
                >
                  {dialog.cancelLabel || 'Annulla'}
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="button-group" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => onResolve({ action: 'confirm', values })}
              className={isDanger ? 'btn-danger' : 'btn-success'}
              autoFocus
            >
              {dialog.confirmLabel || 'OK'}
            </button>
            {!dialog.hideCancel && (
              <button
                type="button"
                onClick={() => onResolve({ action: 'cancel', values })}
                className="btn-secondary"
              >
                {dialog.cancelLabel || 'Annulla'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

if (typeof window !== 'undefined') {
  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};
  window.OnlyGantt.components.DialogHost = DialogHost;
}

export default DialogHost;
