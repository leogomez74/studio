import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';

export interface AutomationAssignee {
  id: number;
  name: string;
}

export interface ChecklistItem {
  id?: number;
  title: string;
}

export interface TaskAutomation {
  id?: number;
  event_type: string;
  title: string;
  assigned_to: number | null;
  assigned_to_ids: number[];
  assignees: AutomationAssignee[];
  priority: 'alta' | 'media' | 'baja';
  due_days_offset: number;
  is_active: boolean;
  workflow_id: number | null;
  checklist_items: ChecklistItem[];
}

export interface UpsertAutomationPayload {
  event_type: string;
  title: string;
  assigned_to_ids: number[];
  priority: 'alta' | 'media' | 'baja';
  due_days_offset: number;
  is_active: boolean;
  workflow_id?: number | null;
  checklist_items?: { title: string }[];
}

/**
 * Hook centralizado para leer y mutar automatizaciones de tareas.
 * Filtra por los event_types del módulo actual si se proveen.
 */
export function useTaskAutomations(eventTypeFilter?: string[]) {
  const [allAutomations, setAllAutomations] = useState<TaskAutomation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAutomations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<TaskAutomation[]>('/api/task-automations');
      const data = Array.isArray(res.data) ? res.data : [];
      // Normaliza: asegura que assigned_to_ids venga del pivote o fallback legacy
      const normalized = data.map((item) => {
        const ids =
          Array.isArray(item.assignees) && item.assignees.length > 0
            ? item.assignees.map((u) => u.id)
            : item.assigned_to
            ? [item.assigned_to]
            : [];
        return { ...item, assigned_to_ids: ids };
      });
      setAllAutomations(normalized);
    } catch {
      // silencioso — no interrumpir la UI si falla
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  const automations = eventTypeFilter
    ? allAutomations.filter((a) => eventTypeFilter.includes(a.event_type))
    : allAutomations;

  const upsert = useCallback(async (payload: UpsertAutomationPayload): Promise<TaskAutomation> => {
    const res = await api.post<TaskAutomation>('/api/task-automations', payload);
    await fetchAutomations();
    return res.data;
  }, [fetchAutomations]);

  return { automations, isLoading, upsert, refetch: fetchAutomations };
}
