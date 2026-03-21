(function() {
  'use strict';

  const { useEffect, useRef, useState } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.components = window.OnlyGantt.components || {};

  function DialogHost({ dialog, onResolve }) {
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

    useEffect(() => {
      if (!dialog) return undefined;
      const timeoutId = window.setTimeout(() => {
        const autoFocusField = dialog.fields?.find((field) => field.autoFocus);
        if (autoFocusField) {
          const element = document.getElementById(`dialog-field-${dialog.id}-${autoFocusField.name}`);
          element?.focus();
          return;
        }
        submitButtonRef.current?.focus();
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }, [dialog]);

    if (!dialog) {
      return null;
    }

    const actions = Array.isArray(dialog.actions) && dialog.actions.length > 0
      ? dialog.actions
      : [{ key: 'close', label: 'Chiudi', className: 'btn-secondary' }];

    const renderMessage = (message) => {
      if (!message) return null;
      return String(message).split('\n').map((line, index) => (
        <p key={`${dialog.id}-line-${index}`} className="dialog-message-line">
          {line}
        </p>
      ));
    };

    const handleFieldChange = (field, nextValue) => {
      setValues((prev) => ({
        ...prev,
        [field.name]: nextValue
      }));
      if (validationError) {
        setValidationError('');
      }
    };

    const validateValues = () => {
      if (!Array.isArray(dialog.fields) || dialog.fields.length === 0) {
        return null;
      }

      for (const field of dialog.fields) {
        const rawValue = values[field.name];
        const value = field.type === 'checkbox'
          ? !!rawValue
          : String(rawValue === undefined || rawValue === null ? '' : rawValue).trim();

        if (field.required && (field.type === 'checkbox' ? !value : !value.length)) {
          return field.requiredMessage || `${field.label} obbligatorio`;
        }

        if (field.minLength && value.length > 0 && value.length < field.minLength) {
          return field.minLengthMessage || `${field.label} deve contenere almeno ${field.minLength} caratteri`;
        }
      }

      return null;
    };

    const handleAction = (action) => {
      if (action.submits) {
        const error = validateValues();
        if (error) {
          setValidationError(error);
          return;
        }
      }

      onResolve({
        action: action.key,
        values
      });
    };

    return (
      <div
        className="dialog-overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !dialog.disableBackdropClose) {
            onResolve({ action: 'cancel', values });
          }
        }}
      >
        <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby={`dialog-title-${dialog.id}`}>
          <div className="dialog-header">
            <h2 id={`dialog-title-${dialog.id}`} className="dialog-title">
              {dialog.title || 'Conferma'}
            </h2>
            {dialog.badge && (
              <span className={`badge badge-${dialog.badge.type || 'info'}`}>
                {dialog.badge.label}
              </span>
            )}
          </div>

          {dialog.message && (
            <div className="dialog-message">
              {renderMessage(dialog.message)}
            </div>
          )}

          {dialog.details && (
            <pre className="dialog-details">{dialog.details}</pre>
          )}

          {Array.isArray(dialog.fields) && dialog.fields.length > 0 && (
            <div className="dialog-fields">
              {dialog.fields.map((field) => {
                const fieldId = `dialog-field-${dialog.id}-${field.name}`;
                if (field.type === 'checkbox') {
                  return (
                    <label key={field.name} className="checkbox-label dialog-checkbox">
                      <input
                        id={fieldId}
                        type="checkbox"
                        checked={!!values[field.name]}
                        onChange={(event) => handleFieldChange(field, event.target.checked)}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }

                const InputTag = field.multiline ? 'textarea' : 'input';
                return (
                  <div key={field.name} className="form-group dialog-field">
                    <label htmlFor={fieldId}>{field.label}</label>
                    <InputTag
                      id={fieldId}
                      type={field.multiline ? undefined : (field.type || 'text')}
                      value={values[field.name] ?? ''}
                      onChange={(event) => handleFieldChange(field, event.target.value)}
                      placeholder={field.placeholder || ''}
                      autoComplete={field.autoComplete || 'off'}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      rows={field.multiline ? (field.rows || 4) : undefined}
                    />
                    {field.helperText && (
                      <div className="input-hint">{field.helperText}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {validationError && (
            <div className="alert-item warning dialog-validation">
              {validationError}
            </div>
          )}

          <div className="dialog-actions">
            {actions.map((action, index) => (
              <button
                key={action.key}
                ref={action.submits && index === actions.length - 1 ? submitButtonRef : undefined}
                type="button"
                className={action.className || 'btn-secondary'}
                onClick={() => handleAction(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  window.OnlyGantt.components.DialogHost = DialogHost;
})();
