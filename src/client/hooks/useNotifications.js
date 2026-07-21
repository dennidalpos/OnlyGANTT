const { useState, useCallback, useRef, useMemo } = React;

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [dialogState, setDialogState] = useState(null);
  const dialogResolverRef = useRef(null);

  const pushNotification = useCallback(({ type = 'info', title = '', message = '', duration = 4000 }) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, type, title, message }]);
    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(item => item.id !== id));
      }, duration);
    }
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(item => item.id !== id));
  }, []);

  const showDialog = useCallback((configOptions) => {
    return new Promise((resolve) => {
      dialogResolverRef.current = resolve;
      setDialogState({
        id: Date.now() + Math.random(),
        ...configOptions
      });
    });
  }, []);

  const resolveDialog = useCallback((result) => {
    setDialogState(null);
    if (dialogResolverRef.current) {
      const resolver = dialogResolverRef.current;
      dialogResolverRef.current = null;
      resolver(result);
    }
  }, []);

  const dialogApi = useMemo(() => ({
    confirm: ({ title, message, confirmLabel, cancelLabel, confirmTone }) =>
      showDialog({
        type: 'confirm',
        title,
        message,
        confirmLabel,
        cancelLabel,
        confirmTone
      }).then(r => r.action === 'confirm'),

    form: ({ title, message, submitLabel, cancelLabel, fields, initialValues }) =>
      showDialog({
        type: 'form',
        title,
        message,
        submitLabel,
        cancelLabel,
        fields,
        initialValues
      }).then(r => (r.action === 'submit' ? r.values : null))
  }), [showDialog]);

  return {
    notifications,
    pushNotification,
    removeNotification,
    dialogState,
    resolveDialog,
    dialogApi
  };
}

export default useNotifications;
