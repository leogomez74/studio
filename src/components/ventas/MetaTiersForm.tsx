'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TierFormItem {
  creditos_minimos: number;
  porcentaje: number;   // valor entre 0 y 1, ej: 0.025
  puntos_reward: number;
  descripcion: string;
}

interface MetaTiersFormProps {
  tiers: TierFormItem[];
  onChange: (tiers: TierFormItem[]) => void;
}

const TIERS_DEFAULT: TierFormItem[] = [
  { creditos_minimos: 0,  porcentaje: 0.025, puntos_reward: 100, descripcion: 'Meta básica' },
  { creditos_minimos: 20, porcentaje: 0.030, puntos_reward: 250, descripcion: '20 créditos' },
  { creditos_minimos: 30, porcentaje: 0.035, puntos_reward: 500, descripcion: '30 créditos' },
];

export { TIERS_DEFAULT };

export function MetaTiersForm({ tiers, onChange }: MetaTiersFormProps) {
  const addTier = () => {
    onChange([...tiers, { creditos_minimos: 0, porcentaje: 0, puntos_reward: 0, descripcion: '' }]);
  };

  const removeTier = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof TierFormItem, value: string | number) => {
    const updated = tiers.map((t, i) =>
      i === index ? { ...t, [field]: value } : t
    );
    onChange(updated);
  };

  const loadDefaults = () => onChange(TIERS_DEFAULT);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">Tiers de bonificación</Label>
        </div>
        <div className="flex gap-2">
          {tiers.length === 0 && (
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={loadDefaults}>
              Cargar defaults
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addTier}>
            <PlusCircle className="h-3.5 w-3.5" />
            Agregar tier
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 flex items-start gap-2">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          El porcentaje del tier <strong>reemplaza</strong> la comisión base cuando el vendedor
          alcanza el umbral de créditos en el mes.
        </p>
      </div>

      {tiers.length === 0 && (
        <p className="text-xs text-center text-muted-foreground py-2">
          Sin tiers — se aplicará la comisión base por rango de monto.
        </p>
      )}

      {tiers.map((tier, i) => (
        <div key={i} className={cn('rounded-lg border p-3 space-y-2', i === 0 && 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10')}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              Tier {i + 1} {i === 0 && '(base)'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => removeTier(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Créditos mínimos</Label>
              <Input
                type="number"
                min={0}
                value={tier.creditos_minimos}
                onChange={e => updateTier(i, 'creditos_minimos', Number(e.target.value))}
                className="h-8 text-sm"
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% comisión</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={(tier.porcentaje * 100).toFixed(1)}
                  onChange={e => updateTier(i, 'porcentaje', Number(e.target.value) / 100)}
                  className="h-8 text-sm pr-6"
                  placeholder="2.5"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Puntos reward</Label>
              <Input
                type="number"
                min={0}
                value={tier.puntos_reward}
                onChange={e => updateTier(i, 'puntos_reward', Number(e.target.value))}
                className="h-8 text-sm"
                placeholder="100"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descripción</Label>
              <Input
                value={tier.descripcion}
                onChange={e => updateTier(i, 'descripcion', e.target.value)}
                className="h-8 text-sm"
                placeholder="Meta básica"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
