'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, Loader2, Plus, X } from 'lucide-react';
import api from '@/lib/axios';
import { type ModuleEventType } from './module-event-map';
import { type TaskAutomation, type UpsertAutomationPayload } from '@/hooks/use-task-automations';

interface User {
  id: number;
  name: string;
}

interface AutoTaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Automation existente para editar, o null para crear nueva */
  automation: TaskAutomation | null;
  /** Event types disponibles para el módulo actual */
  availableEventTypes: ModuleEventType[];
  /** Event type preseleccionado (cuando se edita o se crea desde un evento específico) */
  preselectedEventType?: string;
  onSaved: (automation: TaskAutomation) => void;
}

export function AutoTaskFormDialog({
  open,
  onOpenChange,
  automation,
  availableEventTypes,
  preselectedEventType,
  onSaved,
}: AutoTaskFormDialogProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [eventType, setEventType] = useState('');
  const [title, setTitle] = useState('');
  const [assignedIds, setAssignedIds] = useState<number[]>([]);
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja'>('media');
  const [dueDays, setDueDays] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [checklistItems, setChecklistItems] = useState<{ title: string }[]>([]);

  // Cargar usuarios una vez al abrir
  useEffect(() => {
    if (!open) return;
    api.get<User[]>('/api/users').then((res) => setUsers(res.data)).catch(() => {});
  }, [open]);

  // Poblar form con los datos del automation a editar, o defaults para crear
  useEffect(() => {
    if (!open) return;
    if (automation) {
      setEventType(automation.event_type);
      setTitle(automation.title);
      setAssignedIds(automation.assigned_to_ids ?? []);
      setPriority(automation.priority ?? 'media');
      setDueDays(automation.due_days_offset ?? 3);
      setIsActive(automation.is_active ?? true);
      setChecklistItems(automation.checklist_items ?? []);
    } else {
      const defaultEvent = preselectedEventType ?? availableEventTypes[0]?.key ?? '';
      const eventDef = availableEventTypes.find((e) => e.key === defaultEvent);
      setEventType(defaultEvent);
      setTitle(eventDef?.defaultTitle ?? '');
      setAssignedIds([]);
      setPriority('media');
      setDueDays(3);
      setIsActive(true);
      setChecklistItems([]);
    }
  }, [open, automation, preselectedEventType, availableEventTypes]);

  const toggleAssignee = (userId: number) => {
    setAssignedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleEventTypeChange = (value: string) => {
    setEventType(value);
    if (!automation) {
      const eventDef = availableEventTypes.find((e) => e.key === value);
      if (eventDef) setTitle(eventDef.defaultTitle);
    }
  };

  const handleSave = async () => {
    if (!eventType || !title.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'El tipo de evento y el título son obligatorios.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload: UpsertAutomationPayload = {
        event_type: eventType,
        title: title.trim(),
        assigned_to_ids: assignedIds,
        priority,
        due_days_offset: dueDays,
        is_active: isActive && assignedIds.length > 0,
        checklist_items: checklistItems.filter((i) => i.title.trim()),
      };
      const res = await api.post<TaskAutomation>('/api/task-automations', payload);
      toast({ title: 'Guardado', description: 'Automatización actualizada correctamente.' });
      onSaved(res.data);
      onOpenChange(false);
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la automatización.' });
    } finally {
      setIsSaving(false);
    }
  };

  const getAssigneeLabel = () => {
    if (assignedIds.length === 0) return 'Seleccionar responsables';
    const names = assignedIds.map((id) => users.find((u) => u.id === id)?.name ?? `#${id}`);
    if (names.length <= 2) return names.join(', ');
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>
            {automation ? 'Editar automatización' : 'Nueva automatización'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de evento */}
          <div className="space-y-1.5">
            <Label>Evento disparador</Label>
            <Select
              value={eventType}
              onValueChange={handleEventTypeChange}
              disabled={!!automation} // no se puede cambiar si ya existe
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar evento..." />
              </SelectTrigger>
              <SelectContent>
                {availableEventTypes.map((evt) => (
                  <SelectItem key={evt.key} value={evt.key}>
                    {evt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eventType && (
              <p className="text-xs text-muted-foreground">
                {availableEventTypes.find((e) => e.key === eventType)?.description}
              </p>
            )}
          </div>

          {/* Título de la tarea */}
          <div className="space-y-1.5">
            <Label>Título de la tarea</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre que tendrá la tarea al crearse..."
            />
          </div>

          {/* Responsables */}
          <div className="space-y-1.5">
            <Label>Responsables</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left font-normal h-auto min-h-[36px] py-1.5">
                  <span className="truncate text-sm">{getAssigneeLabel()}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-2" align="start">
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {users.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={assignedIds.includes(user.id)}
                        onCheckedChange={() => toggleAssignee(user.id)}
                      />
                      {user.name}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {assignedIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {assignedIds.map((id) => {
                  const user = users.find((u) => u.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs"
                    >
                      {user?.name ?? `#${id}`}
                      <button onClick={() => toggleAssignee(id)} className="hover:opacity-70">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Prioridad + Días */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Días de plazo</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={dueDays}
                onChange={(e) => setDueDays(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
              />
            </div>
          </div>

          {/* Activa */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Activa</p>
              <p className="text-xs text-muted-foreground">Se creará tarea al ocurrir el evento</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Subtareas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Subtareas predefinidas</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setChecklistItems((prev) => [...prev, { title: '' }])}
              >
                <Plus className="h-3 w-3 mr-1" /> Agregar
              </Button>
            </div>
            {checklistItems.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin subtareas configuradas</p>
            ) : (
              <div className="space-y-1.5">
                {checklistItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                    <Input
                      value={item.title}
                      onChange={(e) =>
                        setChecklistItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, title: e.target.value } : it))
                        )
                      }
                      placeholder="Nombre de la subtarea"
                      className="h-7 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() =>
                        setChecklistItems((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
