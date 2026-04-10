'use client';

import { useState, useCallback, useEffect } from 'react';
import api from '@/lib/axios';

export interface ConditionRule {
  field: string;
  operator: string;
  value: string | number | boolean | string[] | null;
}

export interface ConditionJson {
  logic: 'AND' | 'OR';
  rules: ConditionRule[];
}

export interface ChecklistItem {
  title: string;
}

export interface AutomationEventHook {
  key: string;
  label: string;
  description: string;
}

export interface AutomationEventHookGroup {
  module: string;
  label: string;
  events: AutomationEventHook[];
}

export interface AutomationTemplate {
  id: number;
  name: string;
  module: string;
  trigger_type: 'scheduled' | 'event';
  cron_expression: string | null;
  event_key: string | null;
  condition_json: ConditionJson | null;
  default_title: string;
  description: string | null;
  priority: 'alta' | 'media' | 'baja';
  due_days_offset: number;
  workflow_id: number | null;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
  assignees: { id: number; name: string }[];
  checklist_items: { id: number; title: string; sort_order: number }[];
}

export interface AutomationVariableField {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'date' | 'enum';
  operators: { value: string; label: string }[];
  options?: string[];
}

export interface AutomationVariableModule {
  key: string;
  label: string;
  fields: AutomationVariableField[];
}

export function useAutomationTemplates() {
  const [templates, setTemplates] = useState<AutomationTemplate[]>([]);
  const [variables, setVariables] = useState<AutomationVariableModule[]>([]);
  const [eventHooks, setEventHooks] = useState<AutomationEventHookGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/automation-templates');
      setTemplates(res.data);
    } catch (e) {
      console.error('Error fetching automation templates:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVariables = useCallback(async () => {
    try {
      const res = await api.get('/api/automation-templates/variables');
      setVariables(res.data);
    } catch (e) {
      console.error('Error fetching automation variables:', e);
    }
  }, []);

  const fetchEventHooks = useCallback(async () => {
    try {
      const res = await api.get('/api/automation-templates/event-hooks');
      setEventHooks(res.data);
    } catch (e) {
      console.error('Error fetching event hooks:', e);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchVariables();
    fetchEventHooks();
  }, [fetchTemplates, fetchVariables, fetchEventHooks]);

  const createTemplate = async (payload: Partial<AutomationTemplate> & {
    assignee_ids?: number[];
    checklist_items?: ChecklistItem[];
  }): Promise<AutomationTemplate> => {
    setSaving(true);
    try {
      const res = await api.post('/api/automation-templates', payload);
      setTemplates(prev => [...prev, res.data]);
      return res.data;
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = async (
    id: number,
    payload: Partial<AutomationTemplate> & {
      assignee_ids?: number[];
      checklist_items?: ChecklistItem[];
    }
  ): Promise<AutomationTemplate> => {
    setSaving(true);
    try {
      const res = await api.put(`/api/automation-templates/${id}`, payload);
      setTemplates(prev => prev.map(t => (t.id === id ? res.data : t)));
      return res.data;
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: number): Promise<void> => {
    await api.delete(`/api/automation-templates/${id}`);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const evaluateTemplate = async (id: number): Promise<{ count: number; records: { id: number; label: string }[] }> => {
    const res = await api.post(`/api/automation-templates/${id}/evaluate`);
    return res.data;
  };

  const executeTemplate = async (
    id: number,
    recordIds?: number[]
  ): Promise<{ created: number; skipped: number }> => {
    const res = await api.post(`/api/automation-templates/${id}/execute`, {
      record_ids: recordIds ?? null,
    });
    return res.data;
  };

  return {
    templates,
    variables,
    eventHooks,
    loading,
    saving,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    evaluateTemplate,
    executeTemplate,
  };
}
