'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Plus, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AutomationTemplate,
  AutomationVariableModule,
  AutomationEventHookGroup,
  ConditionRule,
  ChecklistItem,
} from '@/hooks/use-automation-templates';

// ─────────────────────────────────────────────────────────────────────────────
//  Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variables: AutomationVariableModule[];
  eventHooks: AutomationEventHookGroup[];
  users: { id: number; name: string }[];
  editing?: AutomationTemplate | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}

// ─── Helpers para el constructor de frecuencia ───────────────────────────────

const WEEKDAYS = [
  { value: '0', label: 'Domingo' },
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: `${String(i).padStart(2, '0')}:00`,
}));

type FreqType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'after_days';

interface FreqConfig {
  type: FreqType;
  hour: string;        // 0-23
  weekday: string;     // 0-6 (solo weekly)
  monthDay: string;    // 1-28 (solo monthly)
  daysAfter: number;   // solo after_days
  dateField: string;   // campo de fecha de referencia (after_days)
}

const DEFAULT_FREQ: FreqConfig = {
  type: 'daily', hour: '8', weekday: '1', monthDay: '1', daysAfter: 7, dateField: 'created_at',
};

// after_days se ejecuta diariamente a las 8am; la condición real la maneja el motor
function buildCron(f: FreqConfig): string {
  switch (f.type) {
    case 'hourly':     return '0 * * * *';
    case 'daily':      return `0 ${f.hour} * * *`;
    case 'weekly':     return `0 ${f.hour} * * ${f.weekday}`;
    case 'monthly':    return `0 ${f.hour} ${f.monthDay} * *`;
    case 'after_days': return '0 8 * * *';
  }
}

// Encode daysAfter info as a special cron comment so cronToFreq puede recuperarlo
// Usamos un prefijo especial en cron_expression: "after_days:<N>:<field>"
function buildCronExpression(f: FreqConfig): string {
  if (f.type === 'after_days') return `after_days:${f.daysAfter}:${f.dateField}`;
  return buildCron(f);
}

function cronToFreq(cron: string): FreqConfig {
  if (cron.startsWith('after_days:')) {
    const [, days, field] = cron.split(':');
    return { ...DEFAULT_FREQ, type: 'after_days', daysAfter: Number(days) || 7, dateField: field || 'created_at' };
  }
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return DEFAULT_FREQ;
  const [, h, dom, , dow] = parts;
  if (h === '*') return { ...DEFAULT_FREQ, type: 'hourly', hour: '8' };
  if (dow !== '*') return { ...DEFAULT_FREQ, type: 'weekly', hour: h, weekday: dow };
  if (dom !== '*') return { ...DEFAULT_FREQ, type: 'monthly', hour: h, monthDay: dom };
  return { ...DEFAULT_FREQ, type: 'daily', hour: h };
}

function freqSummary(f: FreqConfig): string {
  const hourLabel = `${String(f.hour).padStart(2, '0')}:00`;
  switch (f.type) {
    case 'hourly':     return 'Cada hora';
    case 'daily':      return `Todos los días a las ${hourLabel}`;
    case 'weekly':     return `Cada ${WEEKDAYS.find(w => w.value === f.weekday)?.label ?? ''} a las ${hourLabel}`;
    case 'monthly':    return `El día ${f.monthDay} de cada mes a las ${hourLabel}`;
    case 'after_days': return `Al pasar ${f.daysAfter} día${f.daysAfter === 1 ? '' : 's'} desde "${f.dateField}"`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div
            className={`h-2 flex-1 rounded-full transition-colors ${
              i < current ? 'bg-primary' : i === current ? 'bg-primary/60' : 'bg-muted'
            }`}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

function ConditionRuleRow({
  rule,
  index,
  module,
  variables,
  onChange,
  onRemove,
}: {
  rule: ConditionRule;
  index: number;
  module: string;
  variables: AutomationVariableModule[];
  onChange: (r: ConditionRule) => void;
  onRemove: () => void;
}) {
  const moduleConfig = variables.find(m => m.key === module);
  const fieldConfig = moduleConfig?.fields.find(f => f.key === rule.field);

  return (
    <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Campo */}
        <Select
          value={rule.field || ''}
          onValueChange={field => onChange({ ...rule, field, operator: '', value: null })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Campo..." />
          </SelectTrigger>
          <SelectContent>
            {moduleConfig?.fields.map(f => (
              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operador */}
        <Select
          value={rule.operator || ''}
          onValueChange={operator => onChange({ ...rule, operator, value: null })}
          disabled={!rule.field}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Condición..." />
          </SelectTrigger>
          <SelectContent>
            {fieldConfig?.operators.map(op => (
              <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Valor — se adapta al tipo */}
        {rule.operator && !['is_null', 'is_not_null'].includes(rule.operator) && (
          <>
            {fieldConfig?.type === 'enum' && (
              <Select
                value={Array.isArray(rule.value) ? '' : String(rule.value ?? '')}
                onValueChange={v => onChange({ ...rule, value: v })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Valor..." />
                </SelectTrigger>
                <SelectContent>
                  {fieldConfig.options?.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {fieldConfig?.type === 'boolean' && (
              <Select
                value={rule.value === null ? '' : String(rule.value)}
                onValueChange={v => onChange({ ...rule, value: v === 'true' })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Valor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            )}

            {(fieldConfig?.type === 'number' || fieldConfig?.type === 'date') && (
              <Input
                className="h-8 text-sm"
                type="number"
                min={0}
                placeholder={fieldConfig.type === 'date' ? 'Días...' : 'Valor...'}
                value={rule.value === null ? '' : String(rule.value)}
                onChange={e => onChange({ ...rule, value: e.target.value === '' ? null : Number(e.target.value) })}
              />
            )}

            {fieldConfig?.type === 'string' && (
              <Input
                className="h-8 text-sm"
                placeholder="Valor..."
                value={String(rule.value ?? '')}
                onChange={e => onChange({ ...rule, value: e.target.value })}
              />
            )}
          </>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="h-8 w-8 p-0 text-destructive hover:text-destructive shrink-0 mt-0"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dialog principal
// ─────────────────────────────────────────────────────────────────────────────

export function NuevaTareaDialog({ open, onOpenChange, variables, eventHooks, users, editing, onSave }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // ── Step 1: Definición básica ──
  const [name, setName] = useState('');
  const [module, setModule] = useState('');
  const [triggerType, setTriggerType] = useState<'scheduled' | 'event'>('event');
  const [freqConfig, setFreqConfig] = useState<FreqConfig>(DEFAULT_FREQ);
  const [eventKey, setEventKey] = useState('');
  const [isActive, setIsActive] = useState(true);

  // ── Step 2: Condición ──
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>('AND');
  const [rules, setRules] = useState<ConditionRule[]>([]);

  // ── Step 3: Tarea generada ──
  const [defaultTitle, setDefaultTitle] = useState('');
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja'>('media');
  const [dueDaysOffset, setDueDaysOffset] = useState(3);
  const [assigneeIds, setAssigneeIds] = useState<number[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  // Prellenar si estamos editando
  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setModule(editing.module);
      setTriggerType(editing.trigger_type);
      if (editing.trigger_type === 'scheduled' && editing.cron_expression) {
        setFreqConfig(cronToFreq(editing.cron_expression));
      }
      setEventKey(editing.event_key ?? '');
      setIsActive(editing.is_active);
      setConditionLogic(editing.condition_json?.logic ?? 'AND');
      setRules(editing.condition_json?.rules ?? []);
      setDefaultTitle(editing.default_title);
      setPriority(editing.priority);
      setDueDaysOffset(editing.due_days_offset);
      setAssigneeIds(editing.assignees.map(a => a.id));
      setChecklistItems(editing.checklist_items.map(i => ({ title: i.title })));
    } else {
      resetForm();
    }
  }, [editing, open]);

  const resetForm = () => {
    setStep(0);
    setName('');
    setModule('');
    setTriggerType('event');
    setFreqConfig(DEFAULT_FREQ);
    setEventKey('');
    setIsActive(true);
    setConditionLogic('AND');
    setRules([]);
    setDefaultTitle('');
    setPriority('media');
    setDueDaysOffset(3);
    setAssigneeIds([]);
    setChecklistItems([]);
  };

  const canNextStep1 = name.trim() && module &&
    (triggerType === 'scheduled' ? true : eventKey.trim());
  const canNextStep2 = true; // condición es opcional
  const canSave = defaultTitle.trim() && assigneeIds.length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        module,
        trigger_type: triggerType,
        cron_expression: triggerType === 'scheduled' ? buildCronExpression(freqConfig) : null,
        event_key: triggerType === 'event' ? eventKey : null,
        condition_json: rules.length > 0 ? { logic: conditionLogic, rules } : null,
        default_title: defaultTitle,
        priority,
        due_days_offset: dueDaysOffset,
        is_active: isActive,
        assignee_ids: assigneeIds,
        checklist_items: checklistItems.filter(i => i.title.trim()),
      });
      toast({ title: editing ? 'Plantilla actualizada' : 'Plantilla creada' });
      onOpenChange(false);
      resetForm();
    } catch {
      toast({ variant: 'destructive', title: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  const toggleAssignee = (id: number) => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addRule = () => {
    setRules(prev => [...prev, { field: '', operator: '', value: null }]);
  };

  const updateRule = (i: number, r: ConditionRule) => {
    setRules(prev => prev.map((x, idx) => idx === i ? r : x));
  };

  const removeRule = (i: number) => {
    setRules(prev => prev.filter((_, idx) => idx !== i));
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar plantilla' : 'Nueva plantilla de tarea'}</DialogTitle>
        </DialogHeader>

        <StepIndicator current={step} total={3} />

        {/* ── STEP 0: Definición básica ─────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Define el nombre, módulo y cómo se activa esta plantilla.</p>

            <div className="space-y-2">
              <Label>Nombre de la plantilla <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ej: Recordar pagaré pendiente"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Módulo <span className="text-destructive">*</span></Label>
              <Select value={module} onValueChange={setModule}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar módulo..." />
                </SelectTrigger>
                <SelectContent>
                  {variables.map(v => (
                    <SelectItem key={v.key} value={v.key}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de activación</Label>
              <div className="flex gap-3">
                {([
                  { value: 'event',     title: 'Por evento',   desc: 'Se dispara desde el código cuando ocurre una acción específica' },
                  { value: 'scheduled', title: 'Programado',   desc: 'Se evalúa automáticamente según un horario configurado' },
                ] as const).map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTriggerType(t.value)}
                    className={`flex-1 rounded-lg border p-3 text-sm text-left transition-colors ${
                      triggerType === t.value ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-muted'
                    }`}
                  >
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de evento de código */}
            {triggerType === 'event' && (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <Label>Evento <span className="text-destructive">*</span></Label>
                <Select value={eventKey} onValueChange={setEventKey}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar evento..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {eventHooks
                      .filter(g => !module || g.module === module)
                      .map(group => (
                        <React.Fragment key={group.module}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {group.label}
                          </div>
                          {group.events.map(e => (
                            <SelectItem key={e.key} value={e.key}>
                              <span className="font-medium">{e.label}</span>
                            </SelectItem>
                          ))}
                        </React.Fragment>
                      ))}
                  </SelectContent>
                </Select>
                {eventKey && (() => {
                  const desc = eventHooks.flatMap(g => g.events).find(e => e.key === eventKey)?.description;
                  return desc ? <p className="text-xs text-muted-foreground">{desc}</p> : null;
                })()}
                <p className="text-xs text-muted-foreground/60">
                  Para añadir nuevos eventos, registrarlos en <code className="font-mono">config/automation_event_hooks.php</code> e invocar <code className="font-mono">AutomationEventDispatcher::dispatch()</code> en el código.
                </p>
              </div>
            )}

            {/* Constructor de frecuencia en lenguaje natural */}
            {triggerType === 'scheduled' && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                <Label>Frecuencia</Label>

                {/* Tipo */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {([
                    { value: 'hourly',     label: 'Cada hora' },
                    { value: 'daily',      label: 'Diario' },
                    { value: 'weekly',     label: 'Semanal' },
                    { value: 'monthly',    label: 'Mensual' },
                    { value: 'after_days', label: 'Al pasar X días' },
                  ] as { value: FreqType; label: string }[]).map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFreqConfig(f => ({ ...f, type: opt.value }))}
                      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                        freqConfig.type === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Hora (no aplica en hourly) */}
                {freqConfig.type !== 'hourly' && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-sm shrink-0">A las</Label>
                    <Select
                      value={freqConfig.hour}
                      onValueChange={h => setFreqConfig(f => ({ ...f, hour: h }))}
                    >
                      <SelectTrigger className="w-28 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {HOURS.map(h => (
                          <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Día de la semana */}
                {freqConfig.type === 'weekly' && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-sm shrink-0">El día</Label>
                    <Select
                      value={freqConfig.weekday}
                      onValueChange={d => setFreqConfig(f => ({ ...f, weekday: d }))}
                    >
                      <SelectTrigger className="w-36 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {WEEKDAYS.map(d => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Día del mes */}
                {freqConfig.type === 'monthly' && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <Label className="text-sm shrink-0">El día</Label>
                    <Select
                      value={freqConfig.monthDay}
                      onValueChange={d => setFreqConfig(f => ({ ...f, monthDay: d }))}
                    >
                      <SelectTrigger className="w-24 h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {Array.from({ length: 28 }, (_, i) => String(i + 1)).map(d => (
                          <SelectItem key={d} value={d}>Día {d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">de cada mes</span>
                  </div>
                )}

                {/* Al pasar X días desde un campo de fecha */}
                {freqConfig.type === 'after_days' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Label className="text-sm shrink-0">Al pasar</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        className="w-20 h-8 text-sm"
                        value={freqConfig.daysAfter}
                        onChange={e => setFreqConfig(f => ({ ...f, daysAfter: Math.max(1, Number(e.target.value)) }))}
                      />
                      <span className="text-sm text-muted-foreground">día(s) desde</span>
                      <Select
                        value={freqConfig.dateField}
                        onValueChange={field => setFreqConfig(f => ({ ...f, dateField: field }))}
                      >
                        <SelectTrigger className="w-52 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {(variables.find(v => v.key === module)?.fields ?? [])
                            .filter(f => f.type === 'date')
                            .map(f => (
                              <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                            ))}
                          {/* fallback si aún no hay módulo seleccionado */}
                          {!module && (
                            <SelectItem value="created_at">Fecha de creación</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Se evalúa diariamente. La tarea se crea cuando exactamente <strong>{freqConfig.daysAfter} día(s)</strong> han pasado desde el campo seleccionado.
                    </p>
                  </div>
                )}

                {/* Resumen en lenguaje natural */}
                <div className="rounded-md bg-background border px-3 py-2">
                  <p className="text-sm font-medium">{freqSummary(freqConfig)}</p>
                  {freqConfig.type !== 'after_days' && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{buildCron(freqConfig)}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Activa</Label>
            </div>
          </div>
        )}

        {/* ── STEP 1: Constructor de condición ─────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Define cuándo aplica esta plantilla. Sin condición, aplica a todos los registros del módulo.
              </p>
            </div>

            {rules.length > 1 && (
              <div className="flex items-center gap-3">
                <Label className="text-sm shrink-0">Lógica entre condiciones</Label>
                <div className="flex gap-2">
                  {(['AND', 'OR'] as const).map(l => (
                    <button
                      key={l}
                      onClick={() => setConditionLogic(l)}
                      className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                        conditionLogic === l ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
                      }`}
                    >
                      {l === 'AND' ? 'Todas se cumplen' : 'Al menos una'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {rules.length === 0 && (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">Sin condiciones — aplica a todos los registros</p>
                </div>
              )}
              {rules.map((rule, i) => (
                <div key={i}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 my-1">
                      <Separator className="flex-1" />
                      <span className="text-xs text-muted-foreground font-medium">{conditionLogic}</span>
                      <Separator className="flex-1" />
                    </div>
                  )}
                  <ConditionRuleRow
                    rule={rule}
                    index={i}
                    module={module}
                    variables={variables}
                    onChange={r => updateRule(i, r)}
                    onRemove={() => removeRule(i)}
                  />
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addRule} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Agregar condición
            </Button>
          </div>
        )}

        {/* ── STEP 2: Tarea generada ────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define la tarea que se creará al ejecutar esta plantilla.{' '}
              <span className="text-xs">Usa {'{{campo}}'} para interpolar valores del registro.</span>
            </p>

            <div className="space-y-2">
              <Label>Título de la tarea <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ej: Contactar a {{name}} por pagaré pendiente"
                value={defaultTitle}
                onChange={e => setDefaultTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <Select value={priority} onValueChange={(v: 'alta' | 'media' | 'baja') => setPriority(v)}>
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
              <div className="space-y-2">
                <Label>Días de plazo</Label>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={dueDaysOffset}
                  onChange={e => setDueDaysOffset(Math.max(0, Number(e.target.value)))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Responsables <span className="text-destructive">*</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between h-auto min-h-[36px] py-1.5">
                    <span className="text-sm truncate">
                      {assigneeIds.length === 0
                        ? 'Seleccionar responsables...'
                        : assigneeIds.map(id => users.find(u => u.id === id)?.name ?? `#${id}`).join(', ')}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {users.map(user => (
                      <label key={user.id} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted cursor-pointer text-sm">
                        <Checkbox
                          checked={assigneeIds.includes(user.id)}
                          onCheckedChange={() => toggleAssignee(user.id)}
                        />
                        {user.name}
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              {assigneeIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assigneeIds.map(id => (
                    <Badge
                      key={id}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => toggleAssignee(id)}
                    >
                      {users.find(u => u.id === id)?.name ?? `#${id}`} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Subtareas predefinidas</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setChecklistItems(prev => [...prev, { title: '' }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Agregar
                </Button>
              </div>
              {checklistItems.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sin subtareas configuradas</p>
              ) : (
                <div className="space-y-1.5">
                  {checklistItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <Input
                        value={item.title}
                        onChange={e => setChecklistItems(prev => prev.map((x, idx) => idx === i ? { title: e.target.value } : x))}
                        placeholder="Nombre de la subtarea"
                        className="h-7 text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChecklistItems(prev => prev.filter((_, idx) => idx !== i))}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => step === 0 ? onOpenChange(false) : setStep(s => s - 1)}
            >
              {step === 0 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4 mr-1" /> Anterior</>}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{step + 1} / 3</span>
              {step < 2 ? (
                <Button
                  onClick={() => setStep(s => s + 1)}
                  disabled={step === 0 ? !canNextStep1 : !canNextStep2}
                >
                  Siguiente <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={!canSave || saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editing ? 'Guardar cambios' : 'Crear plantilla'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
