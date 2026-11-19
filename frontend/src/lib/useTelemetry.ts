import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type TelemetrySnapshot, type GovernorStatus, type HealthInfo } from './api';

export function useTelemetry(pollIntervalMs = 2500) {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [governor, setGovernor] = useState<GovernorStatus | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const fallbackTimerRef = useRef<any>(null);

  const fetchFullSnapshot = useCallback(async () => {
    try {
      const [h, s, g] = await Promise.all([
        api.getHealth(),
        api.getSnapshot(),
        api.getGovernorStatus(),
      ]);
      if (h) setHealth(h);
      if (s) setSnapshot(s);
      if (g) setGovernor(g);
      setIsConnected(true);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setIsConnected(false);
      setError(err?.message || 'Connection lost');
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchFullSnapshot();

    // Setup SSE Live Stream
    let isMounted = true;
    try {
      const es = new EventSource('/api/stream/telemetry?rate=1000');
      esRef.current = es;

      es.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        setError(null);
      };

      es.addEventListener('telemetry', (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          if (data.host) {
            setSnapshot((prev) => {
              if (!prev) return data as TelemetrySnapshot;
              return {
                ...prev,
                host: data.host,
                sessions: (data.sessions && data.sessions.length > 0) ? data.sessions : prev.sessions,
                processes: (data.processes && data.processes.length > 0) ? data.processes : prev.processes,
                services: (data.services && data.services.length > 0) ? data.services : prev.services,
              };
            });
          }
          if (data.governor) setGovernor(data.governor);
          setLastUpdated(new Date());
          setIsConnected(true);
        } catch {
          setError('Invalid telemetry payload');
        }
      });

      es.onerror = () => {
        if (!isMounted) return;
        // On SSE error, close and rely on fallback interval
        if (es.readyState === EventSource.CLOSED) {
          setIsConnected(false);
        }
      };
    } catch {
      setError('Live telemetry stream unavailable; polling remains active');
    }

    // Polling fallback
    fallbackTimerRef.current = setInterval(fetchFullSnapshot, pollIntervalMs);

    return () => {
      isMounted = false;
      if (esRef.current) {
        esRef.current.close();
      }
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
      }
    };
  }, [fetchFullSnapshot, pollIntervalMs]);

  return {
    snapshot,
    governor,
    health,
    isConnected,
    lastUpdated,
    error,
    refresh: fetchFullSnapshot,
  };
}
