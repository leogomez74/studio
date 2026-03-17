'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '@/components/auth-guard';
import { API_BASE_URL } from '@/lib/env';
import api from '@/lib/axios';

interface ChecklistTemplate {
  id?: number;
  title: string;
}

interface AutomationConfig {
  assigned_to_ids: number[];
  due_days_offset: number;
  is_active: boolean;
  checklist_items: ChecklistTemplate[];
}

const AUTOMATION_EVENTS = [
  { key: 'lead_created', title: 'Nuevo Lead Creado', description: 'Al registrar un nuevo lead, se crea automáticamente una tarea por cada responsable seleccionado.', defaultTitle: 'Nuevo lead creado' },
  { key: 'opportunity_created', title: 'Nueva Oportunidad Creada', description: 'Al generar una oportunidad, se crea tarea para realizar análisis, solicitar colillas y verificarlas.', defaultTitle: 'Realizar análisis, solicitar colillas y verificarlas' },
  { key: 'analisis_created', title: 'Análisis Creado', description: 'Al crear un análisis, se asigna tarea para enviar propuesta al equipo PEP, dar seguimiento y verificar estado.', defaultTitle: 'Enviar propuesta al equipo PEP, dar seguimiento y verificar estado' },
  { key: 'pep_aceptado', title: 'PEP Acepta Análisis', description: 'Al aceptar el análisis o aprobar una propuesta, se asigna tarea para informar al cliente la propuesta aceptada.', defaultTitle: 'Informar al cliente la propuesta aceptada' },
  { key: 'pep_rechazado', title: 'PEP Rechaza Análisis', description: 'Al marcar estado PEP como "Rechazado", se asigna tarea para informar al cliente que no califica para el crédito.', defaultTitle: 'Informar al cliente que no califica para el crédito' },
  { key: 'credit_created', title: 'Nuevo Crédito Creado', description: 'Al crearse un nuevo crédito, se asigna tarea para realizar entrega de pagaré, formalización, entrega de hoja de cierre.', defaultTitle: 'Nuevo crédito creado' },
  { key: 'payment_verification', title: 'Verificación de Abonos', description: 'Al solicitar un abono manual (ventanilla, adelanto, extraordinario, cancelación anticipada), se crea una tarea de verificación bancaria asignada al usuario seleccionado. Este debe confirmar el depósito antes de que se aplique el abono.', defaultTitle: 'Verificar depósito bancario' },
  { key: 'payment_reversal_request', title: 'Solicitud de Anulación de Abono', description: 'Cuando un usuario solicita anular un abono, se crea una tarea para que el responsable autorizado revise y apruebe o rechace la anulación.', defaultTitle: 'Revisar solicitud de anulación de abono' },
  { key: 'saldo_reintegro_request', title: 'Solicitud de Reintegro de Saldo', description: 'Cuando un usuario solicita reintegrar un saldo pendiente, se crea una tarea para que el responsable autorizado apruebe el reintegro.', defaultTitle: 'Revisar solicitud de reintegro de saldo' },
  { key: 'reward_redemption_request', title: 'Canje de Recompensa', description: 'Cuando un usuario canjea puntos por una recompensa del catálogo, se crea una tarea para que el responsable apruebe y gestione la entrega.', defaultTitle: 'Aprobar canje de recompensa' },
];

const TareasAutomationTab: React.FC = () => {
  const { toast } = useToast();
  const { token } = useAuth();
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [automationsLoading, setAutomationsLoading] = useState(false);
  const [configs, setConfigs] = useState<Record<string, AutomationConfig>>({});
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      if (res.ok) setUsers(await res.json());
    } catch (error) { console.error('Error fetching users:', error); }
  };

  const fetchAutomations = useCallback(async () => {
    setAutomationsLoading(true);
    try {
      const res = await api.get('/api/task-automations');
      const data = Array.isArray(res.data) ? res.data : [];
      const newConfigs: Record<string, AutomationConfig> = {};
      AUTOMATION_EVENTS.forEach(event => {
        const auto = data.find((a: Record<string, unknown>) => a.event_type === event.key);
        const checklistItems = Array.isArray(auto?.checklist_items)
          ? (auto.checklist_items as { id: number; title: string }[]).map((item) => ({ id: item.id, title: item.title }))
          : [];

        // Leer assignees del pivote; fallback a assigned_to legacy
        let assignedIds: number[] = [];
        if (Array.isArray(auto?.assignees) && auto.assignees.length > 0) {
          assignedIds = (auto.assignees as { id: number }[]).map(u => u.id);
        } else if (auto?.assigned_to) {
          assignedIds = [Number(auto.assigned_to)];
        }

        newConfigs[event.key] = {
          assigned_to_ids: assignedIds,
          due_days_offset: (auto?.due_days_offset as number) ?? 3,
          is_active: (auto?.is_active as boolean) ?? false,
          checklist_items: checklistItems,
        };
      });
      setConfigs(newConfigs);
    } catch (error) { console.error('Error fetching automations:', error); }
    finally { setAutomationsLoading(false); }
  }, []);

  useEffect(() => {
    if (token) { fetchUsers(); fetchAutomations(); }
  }, [token, fetchAutomations]);

  const saveAutomation = async (eventType: string, title: string, assignedToIds: number[], dueDaysOffset?: number, checklistItems?: ChecklistTemplate[]) => {
    try {
      await api.post('/api/task-automations', {
        event_type: eventType,
        title,
        assigned_to_ids: assignedToIds,
        priority: 'media',
        due_days_offset: dueDaysOffset ?? configs[eventType]?.due_days_offset ?? 3,
        is_active: assignedToIds.length > 0,
        checklist_items: checklistItems ?? configs[eventType]?.checklist_items ?? [],
      });
      toast({ title: 'Guardado', description: 'Configuración actualizada.' });
    } catch (error) {
      console.error('Error saving automation:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la configuración.' });
    }
  };

  const debouncedSave = (eventKey: string, ids: number[]) => {
    if (saveTimeoutRef.current[eventKey]) {
      clearTimeout(saveTimeoutRef.current[eventKey]);
    }
    saveTimeoutRef.current[eventKey] = setTimeout(() => {
      const event = AUTOMATION_EVENTS.find(e => e.key === eventKey);
      if (event) {
        saveAutomation(eventKey, event.defaultTitle, ids);
      }
    }, 600);
  };

  const toggleAssignee = (eventKey: string, userId: number) => {
    setConfigs(prev => {
      const current = prev[eventKey]?.assigned_to_ids || [];
      const updated = current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId];
      debouncedSave(eventKey, updated);
      return { ...prev, [eventKey]: { ...prev[eventKey], assigned_to_ids: updated, is_active: updated.length > 0 } };
    });
  };

  const addChecklistItem = (eventKey: string) => {
    setConfigs(prev => ({
      ...prev,
      [eventKey]: {
        ...prev[eventKey],
        checklist_items: [...(prev[eventKey]?.checklist_items || []), { title: '' }],
      },
    }));
  };

  const updateChecklistItem = (eventKey: string, index: number, title: string) => {
    setConfigs(prev => {
      const items = [...(prev[eventKey]?.checklist_items || [])];
      items[index] = { ...items[index], title };
      return { ...prev, [eventKey]: { ...prev[eventKey], checklist_items: items } };
    });
  };

  const removeChecklistItem = (eventKey: string, index: number) => {
    setConfigs(prev => {
      const items = [...(prev[eventKey]?.checklist_items || [])];
      items.splice(index, 1);
      return { ...prev, [eventKey]: { ...prev[eventKey], checklist_items: items } };
    });
  };

  const saveChecklist = (eventKey: string) => {
    const config = configs[eventKey];
    if (config?.assigned_to_ids.length > 0) {
      const validItems = config.checklist_items.filter(i => i.title.trim());
      saveAutomation(eventKey, AUTOMATION_EVENTS.find(e => e.key === eventKey)?.defaultTitle || '', config.assigned_to_ids, config.due_days_offset, validItems);
    }
  };

  const getAssigneeNames = (eventKey: string): string => {
    const ids = configs[eventKey]?.assigned_to_ids || [];
    if (ids.length === 0) return 'Ninguno (desactivado)';
    const names = ids.map(id => users.find(u => u.id === id)?.name || `#${id}`);
    if (names.length <= 2) return names.join(', ');
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tareas Automáticas</CardTitle>
        <CardDescription>
          Configura las tareas que se crean automáticamente al ocurrir ciertos eventos. Se crea una tarea por cada responsable seleccionado. Deja sin responsables para desactivar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {automationsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {AUTOMATION_EVENTS.map((event) => (
              <div key={event.key} className="rounded-lg border p-4">
                <h4 className="font-medium">{event.title}</h4>
                <p className="text-sm text-muted-foreground mb-3">{event.description}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Responsables</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between text-left font-normal h-auto min-h-[36px] py-1.5">
                          <span className="truncate text-sm">
                            {getAssigneeNames(event.key)}
                          </span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[260px] p-2" align="start">
                        <div className="max-h-[200px] overflow-y-auto space-y-1">
                          {users.map((user) => {
                            const isChecked = (configs[event.key]?.assigned_to_ids || []).includes(user.id);
                            return (
                              <label
                                key={user.id}
                                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm"
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={() => toggleAssignee(event.key, user.id)}
                                />
                                {user.name}
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Días de plazo</Label>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={configs[event.key]?.due_days_offset ?? 3}
                      onChange={(e) => {
                        const days = Math.max(0, Math.min(365, Number(e.target.value) || 0));
                        setConfigs(prev => ({ ...prev, [event.key]: { ...prev[event.key], due_days_offset: days } }));
                      }}
                      onBlur={() => {
                        const config = configs[event.key];
                        if (config?.assigned_to_ids.length > 0) {
                          saveAutomation(event.key, event.defaultTitle, config.assigned_to_ids, config.due_days_offset);
                        }
                      }}
                      disabled={(configs[event.key]?.assigned_to_ids || []).length === 0}
                    />
                  </div>
                </div>

                {/* Selected assignees badges */}
                {(configs[event.key]?.assigned_to_ids || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(configs[event.key]?.assigned_to_ids || []).map(id => {
                      const user = users.find(u => u.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs">
                          {user?.name || `#${id}`}
                          <button
                            onClick={() => toggleAssignee(event.key, id)}
                            className="hover:opacity-70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Checklist template */}
                {(configs[event.key]?.assigned_to_ids || []).length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs text-muted-foreground">Subtareas predefinidas</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addChecklistItem(event.key)}
                        className="h-6 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" /> Agregar
                      </Button>
                    </div>
                    {(configs[event.key]?.checklist_items || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Sin subtareas configuradas</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(configs[event.key]?.checklist_items || []).map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                            <Input
                              value={item.title}
                              onChange={(e) => updateChecklistItem(event.key, idx, e.target.value)}
                              onBlur={() => saveChecklist(event.key)}
                              placeholder="Nombre de la subtarea"
                              className="h-7 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                removeChecklistItem(event.key, idx);
                                setTimeout(() => saveChecklist(event.key), 100);
                              }}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TareasAutomationTab;
