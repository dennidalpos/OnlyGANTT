// Custom hook for department lock lifecycle
// Exposed on window.OnlyGantt.hooks.useDepartmentLock

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
    const heartbeatIntervalRef = useRef(null);
    const previousLockRef = useRef(null);

    const stopHeartbeat = useCallback(() => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }, []);

    // Heartbeat
    const startHeartbeat = useCallback(() => {
      stopHeartbeat();

      heartbeatIntervalRef.current = setInterval(async () => {
        if (!department || !userName) return;

        try {
          await api.heartbeatLock(department, userName);
        } catch (err) {
          // If heartbeat fails, consider lock lost
          setIsLocked(false);
          setError({ message: 'Lost lock connection' });
          stopHeartbeat();
        }
      }, config.lock.heartbeatMinutes * 60 * 1000);
    }, [department, userName, stopHeartbeat]);

    // Acquire lock with debounce
    const acquireLock = useCallback(() => {
      if (!department || !userName || !enabled) return;

      // Clear existing debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Abort previous request
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

          // Start heartbeat
          startHeartbeat();
        } catch (err) {
          if (err.name === 'AbortError') return;

          if (err.status === 423) {
            // Lock conflict
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
      } catch (err) {
        // Ignore errors on release
      }
    }, [stopHeartbeat]);

    // Release lock
    const releaseLock = useCallback(async () => {
      if (!department || !userName) return;

      try {
        await releaseLockFor(department, userName);
        previousLockRef.current = null;
        setLockInfo(null);
        setIsLocked(false);
        setError(null);
      } catch (err) {
        // Ignore errors on release
      }
    }, [department, userName, releaseLockFor]);

    // Effect: acquire lock when department/user changes
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

      // Cleanup
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

    // Effect: release lock on unload (sendBeacon)
    useEffect(() => {
      const handleUnload = () => {
        if (isLocked && department && userName) {
          const url = `/api/lock/${encodeURIComponent(department)}/release`;
          const data = JSON.stringify({ userName });
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
      refreshLock: acquireLock
    };
  }

  window.OnlyGantt.hooks.useDepartmentLock = useDepartmentLock;
})();
