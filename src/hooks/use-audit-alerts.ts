import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';

interface AuditAlerts {
  has_alerts: boolean;
  eliminaciones_24h: number;
  logins_fallidos_24h: number;
}

/**
 * Hook que consulta las alertas de auditoría cada 5 minutos.
 * Solo hace la petición si el usuario tiene acceso al módulo.
 */
export function useAuditAlerts(enabled = true) {
  const [alerts, setAlerts] = useState<AuditAlerts | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await api.get<AuditAlerts>('/activity-logs/alerts');
      setAlerts(res.data);
    } catch {
      // silencioso — no interrumpir el sidebar si falla
    }
  }, [enabled]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000); // cada 5 min
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return alerts;
}
