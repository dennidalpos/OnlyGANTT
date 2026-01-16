(function() {
  'use strict';

  const { useState, useEffect, useRef, useCallback } = React;

  window.OnlyGantt = window.OnlyGantt || {};
  window.OnlyGantt.hooks = window.OnlyGantt.hooks || {};

  const api = window.OnlyGantt.api;
  const config = window.AppConfig;

  function useDepartmentLock(department, userName, enabled) {
    const [lockInfo, setLockInfo] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [error, setError] = useState(null);

    const abortControllerRef = useRef(null);
    const debounceTimerRef = useRef(null);
    const heartbeatTimeoutRef = useRef(null);
    const statusPollTimeoutRef = useRef(null);
    const statusAbortControllerRef = useRef(null);
    const previousLockRef = useRef(null);

    const stopHeartbeat = useCallback(() => {
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
        heartbeatTimeoutRef.current = null;
      }
    }, []);

    const startHeartbeat = useCallback(() => {
      stopHeartbeat();

      const scheduleHeartbeat = async () => {
        const baseMs = config.lock.heartbeatMinutes * 60 * 1000;
        const jitterMs = config.lock.heartbeatJitterMs || 0;
        const delay = baseMs + Math.floor(Math.random() * jitterMs);

        heartbeatTimeoutRef.current = setTimeout(async () => {
          if (!department || !userName) {
            scheduleHeartbeat();
            return;
          }

          try {
            await api.heartbeatLock(department, userName);
            scheduleHeartbeat();
          } catch (err) {
            setIsLocked(false);
            setError({ message: 'Lost lock connection' });
            stopHeartbeat();
          }
        }, delay);
      };

      scheduleHeartbeat();
    }, [department, userName, stopHeartbeat]);

    const acquireLock = useCallback((force = false) => {
      if (!department || !userName || (!enabled && !force)) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      debounceTimerRef.current = setTimeout(async () => {
        abortControllerRef.current = new AbortController();

        try {
          const clientHost = window.location.hostname;
          const result = await api.acquireLock(department, userName, clientHost, abortControllerRef.current.signal);
          setLockInfo(result);
          setIsLocked(true);
          setError(null);
          startHeartbeat();
        } catch (err) {
          if (err.name === 'AbortError') return;

          if (err.status === 423) {
            setLockInfo(err.lockInfo);
            setIsLocked(false);
            setError(err.lockInfo);
          } else {
            setIsLocked(false);
            setError({ message: err.message });
          }
        }
      }, config.lock.acquireDebounceMs);
    }, [department, userName, enabled, startHeartbeat]);

    const releaseLockFor = useCallback(async (targetDepartment, targetUserName) => {
      if (!targetDepartment || !targetUserName) return;
      stopHeartbeat();
      try {
        await api.releaseLock(targetDepartment, targetUserName);
      } catch (err) {}
    }, [stopHeartbeat]);

    const releaseLock = useCallback(async () => {
      if (!department || !userName) return;
      try {
        await releaseLockFor(department, userName);
        previousLockRef.current = null;
        setLockInfo(null);
        setIsLocked(false);
        setError(null);
      } catch (err) {}
    }, [department, userName, releaseLockFor]);

    useEffect(() => {
      const previous = previousLockRef.current;
      const hasChanged = previous && (previous.department !== department || previous.userName !== userName || !enabled);
      if (hasChanged) {
        releaseLockFor(previous.department, previous.userName);
        setLockInfo(null);
        setIsLocked(false);
      }

      if (enabled && department && userName) {
        previousLockRef.current = { department, userName };
      } else if (!enabled) {
        previousLockRef.current = null;
      }

      if (enabled) {
        acquireLock();
      } else {
        releaseLock();
      }

      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        stopHeartbeat();
      };
    }, [department, userName, enabled, acquireLock, releaseLock, releaseLockFor, stopHeartbeat]);

    useEffect(() => {
      if (!department) {
        setLockInfo(null);
        return;
      }

      let isActive = true;

      const pollStatus = async () => {
        if (!isActive) return;

        if (statusAbortControllerRef.current) {
          statusAbortControllerRef.current.abort();
        }

        const controller = new AbortController();
        statusAbortControllerRef.current = controller;

        try {
          const status = await api.getLockStatus(department, controller.signal);
          if (!isActive) return;
          setLockInfo(status);
          setError(null);
          if (enabled) {
            setIsLocked(status.locked && status.lockedBy === userName);
          } else {
            setIsLocked(false);
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            setError({ message: 'Impossibile sincronizzare lo stato del lock' });
          }
        } finally {
          if (isActive) {
            statusPollTimeoutRef.current = setTimeout(pollStatus, config.lock.statusPollMs);
          }
        }
      };

      pollStatus();

      return () => {
        isActive = false;
        if (statusPollTimeoutRef.current) {
          clearTimeout(statusPollTimeoutRef.current);
          statusPollTimeoutRef.current = null;
        }
        if (statusAbortControllerRef.current) {
          statusAbortControllerRef.current.abort();
          statusAbortControllerRef.current = null;
        }
      };
    }, [department, userName, enabled]);

    useEffect(() => {
      const handleUnload = () => {
        if (isLocked && department && userName) {
          const url = `/api/lock/${encodeURIComponent(department)}/release`;
          const userToken = api.getUserToken();
          const payload = userToken ? { userName, userToken } : { userName };
          const data = JSON.stringify(payload);
          navigator.sendBeacon(url, new Blob([data], { type: 'application/json' }));
        }
      };

      window.addEventListener('beforeunload', handleUnload);
      window.addEventListener('pagehide', handleUnload);

      return () => {
        window.removeEventListener('beforeunload', handleUnload);
        window.removeEventListener('pagehide', handleUnload);
      };
    }, [isLocked, department, userName]);

    return {
      lockInfo,
      isLocked,
      error,
      releaseLock,
      refreshLock: () => acquireLock(true)
    };
  }

  window.OnlyGantt.hooks.useDepartmentLock = useDepartmentLock;
})();
