import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';

interface OverdueTask {
  id: number;
  title: string;
  due_date: string;
  priority: string;
  assignee: string | null;
  days_overdue: number;
}

interface OverdueTasksData {
  count: number;
  tasks: OverdueTask[];
}

/**
 * Hook que consulta las tareas vencidas cada 5 minutos.
 */
export function useOverdueTasks() {
  const [data, setData] = useState<OverdueTasksData | null>(null);

  const fetchOverdue = useCallback(async () => {
    try {
      const res = await api.get<OverdueTasksData>('/api/tareas/overdue-count');
      setData(res.data);
    } catch {
      // silencioso — no interrumpir el sidebar si falla
    }
  }, []);

  useEffect(() => {
    fetchOverdue();
    const interval = setInterval(fetchOverdue, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchOverdue]);

  return data;
}
