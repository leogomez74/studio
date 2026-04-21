'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Play, Search, Pencil, Trash2, Plus, Zap, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AutomationTemplate, AutomationVariableModule, AutomationEventHookGroup } from '@/hooks/use-automation-templates';
import { NuevaTareaDialog } from './NuevaTareaDialog';

interface Props {
  templates: AutomationTemplate[];
  variables: AutomationVariableModule[];
  eventHooks: AutomationEventHookGroup[];
  users: { id: number; name: string }[];
  loading: boolean;
  onSave: (payload: Record<string, unknown>, id?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onEvaluate: (id: number) => Promise<{ count: number; records: { id: number; label: string }[] }>;
  onExecute: (id: number, recordIds?: number[]) => Promise<{ created: number; skipped: number }>;
  onToggleActive: (id: number, value: boolean) => Promise<void>;
}

function RulesSummary({ template, variables }: { template: AutomationTemplate; variables: AutomationVariableModule[] }) {
  const rules = template.condition_json?.rules ?? [];
  const logic = template.condition_json?.logic ?? 'AND';
  const moduleVars = variables.find(m => m.key === template.module);

  if (rules.length === 0) return <span className="text-xs text-muted-foreground italic">Sin condición — aplica a todos</span>;

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {rules.map((r, i) => {
        const field = moduleVars?.fields.find(f => f.key === r.field);
        const op = field?.operators.find(o => o.value === r.operator);
        const label = `${field?.label ?? r.field} ${op?.label ?? r.operator} ${r.value ?? ''}`.trim();
        return (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-xs text-muted-foreground self-center">{logic}</span>}
            <Badge variant="outline" className="text-xs font-normal">{label}</Badge>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function EvaluatePreviewDialog({
  open,
  onOpenChange,
  template,
  onExecute,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: AutomationTemplate | null;
  onExecute: (ids: number[]) => Promise<void>;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ count: number; records: { id: number; label: string }[] } | null>(null);
  const [selected, setSelected] = useState<number[]>([]);

  React.useEffect(() => {
    if (!open || !template) return;
    setResult(null);
    setSelected([]);
  }, [open, template]);

  if (!template) return null;

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      // llamado desde el padre vía prop — usamos fetch directo aquí para no complicar props
      const { default: api } = await import('@/lib/axios');
      const res = await api.post(`/api/automation-templates/${template.id}/evaluate`);
      setResult(res.data);
      setSelected(res.data.records.map((r: { id: number }) => r.id));
    } catch {
      toast({ variant: 'destructive', title: 'Error al evaluar' });
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute(selected);
      onOpenChange(false);
    } finally {
      setExecuting(false);
    }
  };

  const toggleRecord = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Ejecutar: {template.name}</AlertDialogTitle>
          <AlertDialogDescription>
            Evalúa la condición y selecciona los registros sobre los que crear tareas.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!result ? (
          <Button onClick={handleEvaluate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Evaluar condición
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{result.count}</span> registro(s) cumplen la condición.
              {result.count > 50 && (
                <span className="text-muted-foreground ml-1">(mostrando 50 de {result.count})</span>
              )}
            </p>
            {result.records.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                {result.records.map(r => (
                  <label key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={() => toggleRecord(r.id)}
                      className="rounded"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            )}
            {result.records.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No hay registros que cumplan la condición en este momento.</p>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          {result && result.records.length > 0 && (
            <AlertDialogAction
              onClick={handleExecute}
              disabled={executing || selected.length === 0}
            >
              {executing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear tareas ({selected.length})
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function AutomationTemplatesSection({
  templates, variables, eventHooks, users, loading,
  onSave, onDelete, onEvaluate, onExecute, onToggleActive,
}: Props) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationTemplate | null>(null);
  const [executeTarget, setExecuteTarget] = useState<AutomationTemplate | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);

  const handleEdit = (t: AutomationTemplate) => {
    setEditing(t);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleSave = async (payload: Record<string, unknown>) => {
    await onSave(payload, editing?.id);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await onDelete(deleteTarget.id);
    setDeleteTarget(null);
    toast({ title: 'Plantilla eliminada' });
  };

  const handleExecute = async (ids: number[]) => {
    if (!executeTarget) return;
    const result = await onExecute(executeTarget.id, ids);
    toast({ title: `${result.created} tarea(s) creada(s), ${result.skipped} omitida(s)` });
    setExecuteTarget(null);
  };

  const handleToggle = async (t: AutomationTemplate, value: boolean) => {
    setToggling(t.id);
    try {
      await onToggleActive(t.id, value);
    } finally {
      setToggling(null);
    }
  };

  const moduleLabel = (key: string) => variables.find(v => v.key === key)?.label ?? key;
  const eventLabel = (key: string) => eventHooks.flatMap(g => g.events).find(e => e.key === key)?.label ?? key;
  const cronLabel = (cron: string | null) => {
    if (!cron) return '—';
    if (cron.startsWith('after_days:')) {
      const [, days, field] = cron.split(':');
      return `${days}d desde ${field}`;
    }
    return cron;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Plantillas personalizadas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define tus propias automatizaciones con condiciones reales sobre los datos.
          </p>
        </div>
        <Button size="sm" onClick={handleNew}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva plantilla
        </Button>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No hay plantillas personalizadas.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear primera plantilla
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const expanded = expandedId === t.id;
            return (
              <div key={t.id} className={`rounded-lg border transition-colors ${t.is_active ? 'bg-background' : 'bg-muted/30 opacity-75'}`}>
                {/* Row principal */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    {t.trigger_type === 'scheduled'
                      ? <Clock className="h-4 w-4 text-muted-foreground" />
                      : <Zap className="h-4 w-4 text-amber-500" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{t.name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{moduleLabel(t.module)}</Badge>
                      <Badge
                        variant={t.trigger_type === 'scheduled' ? 'secondary' : 'outline'}
                        className="text-xs shrink-0"
                      >
                        {t.trigger_type === 'scheduled'
                          ? `⏱ ${cronLabel(t.cron_expression)}`
                          : `⚡ ${t.event_key ? eventLabel(t.event_key) : 'Sin evento'}`}
                      </Badge>
                    </div>
                    {!expanded && <RulesSummary template={t} variables={variables} />}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle activo */}
                    {toggling === t.id
                      ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      : <Switch checked={t.is_active} onCheckedChange={v => handleToggle(t, v)} />}

                    {/* Ejecutar */}
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Ejecutar"
                      className="h-8 w-8 p-0"
                      onClick={() => setExecuteTarget(t)}
                    >
                      <Play className="h-3.5 w-3.5 text-green-600" />
                    </Button>

                    {/* Editar */}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>

                    {/* Eliminar */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>

                    {/* Expandir */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                    >
                      {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* Detalle expandido */}
                {expanded && (
                  <div className="border-t px-4 py-3 space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Condición</p>
                      <RulesSummary template={t} variables={variables} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tarea generada</p>
                      <p className="font-medium">{t.default_title}</p>
                      <p className="text-xs text-muted-foreground">
                        Prioridad: {t.priority} · Plazo: {t.due_days_offset} día(s)
                      </p>
                    </div>
                    {t.assignees.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Responsables</p>
                        <div className="flex flex-wrap gap-1">
                          {t.assignees.map(a => <Badge key={a.id} variant="secondary" className="text-xs">{a.name}</Badge>)}
                        </div>
                      </div>
                    )}
                    {t.checklist_items.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Subtareas</p>
                        <ul className="space-y-0.5">
                          {t.checklist_items.map((item, i) => (
                            <li key={item.id} className="text-xs flex gap-1.5">
                              <span className="text-muted-foreground">{i + 1}.</span>{item.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {t.last_run_at && (
                      <p className="text-xs text-muted-foreground">
                        Última ejecución: {new Date(t.last_run_at).toLocaleString('es-CR')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog nueva/editar */}
      <NuevaTareaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        variables={variables}
        eventHooks={eventHooks}
        users={users}
        editing={editing}
        onSave={handleSave}
      />

      {/* Preview + execute dialog */}
      <EvaluatePreviewDialog
        open={!!executeTarget}
        onOpenChange={v => !v && setExecuteTarget(null)}
        template={executeTarget}
        onExecute={handleExecute}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.name}</strong> y su historial de ejecuciones. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
