'use client';

import React, { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Pencil, Plus, Users } from 'lucide-react';
import { type ModuleConfig } from './module-event-map';
import { type TaskAutomation, useTaskAutomations } from '@/hooks/use-task-automations';
import { AutoTaskFormDialog } from './AutoTaskFormDialog';

interface AutoTasksSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: ModuleConfig;
}

export function AutoTasksSheet({ open, onOpenChange, module }: AutoTasksSheetProps) {
  const eventTypeKeys = module.eventTypes.map((e) => e.key);
  const { automations, isLoading, upsert, refetch } = useTaskAutomations(eventTypeKeys);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<TaskAutomation | null>(null);
  const [preselectedEvent, setPreselectedEvent] = useState<string | undefined>();

  const openEdit = (automation: TaskAutomation) => {
    setSelectedAutomation(automation);
    setPreselectedEvent(undefined);
    setDialogOpen(true);
  };

  const openCreate = (eventKey?: string) => {
    setSelectedAutomation(null);
    setPreselectedEvent(eventKey);
    setDialogOpen(true);
  };

  const handleToggleActive = async (automation: TaskAutomation) => {
    await upsert({
      event_type: automation.event_type,
      title: automation.title,
      assigned_to_ids: automation.assigned_to_ids,
      priority: automation.priority,
      due_days_offset: automation.due_days_offset,
      is_active: !automation.is_active,
      checklist_items: automation.checklist_items,
    });
  };

  // Construye la lista de tarjetas: una por cada event_type del módulo,
  // mostrando los datos si ya existe configuración, o estado vacío si no.
  const cards = module.eventTypes.map((eventDef) => {
    const automation = automations.find((a) => a.event_type === eventDef.key);
    return { eventDef, automation };
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Auto-tareas — {module.name}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              cards.map(({ eventDef, automation }) => (
                <div
                  key={eventDef.key}
                  className="rounded-lg border p-4 space-y-3"
                >
                  {/* Header de la tarjeta */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{eventDef.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                        {eventDef.description}
                      </p>
                    </div>
                    {automation ? (
                      <Switch
                        checked={automation.is_active}
                        onCheckedChange={() => handleToggleActive(automation)}
                      />
                    ) : (
                      <Badge variant="outline" className="text-xs shrink-0">Sin configurar</Badge>
                    )}
                  </div>

                  {/* Estado de la automatización */}
                  {automation ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {automation.assignees.length > 0
                          ? automation.assignees.map((u) => u.name).join(', ')
                          : 'Sin responsables'}
                        {automation.due_days_offset != null && (
                          <span className="ml-1">· {automation.due_days_offset}d plazo</span>
                        )}
                        {automation.priority && (
                          <Badge variant="secondary" className="text-xs py-0 px-1.5">
                            {automation.priority}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0"
                        onClick={() => openEdit(automation)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() => openCreate(eventDef.key)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Configurar
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AutoTaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={selectedAutomation}
        availableEventTypes={module.eventTypes}
        preselectedEventType={preselectedEvent}
        onSaved={() => refetch()}
      />
    </>
  );
}
