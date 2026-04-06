'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Tier {
  id: number;
  creditos_minimos: number;
  porcentaje: number;
  puntos_reward: number;
  descripcion: string | null;
}

interface ProximoTier extends Tier {
  faltan_creditos: number;
}

interface TierProgressCardProps {
  tierActivo: Tier | null;
  proximoTier: ProximoTier | null;
  creditosAlcanzados: number;
}

function tierColor(porcentaje: number): string {
  if (porcentaje >= 0.035) return 'text-purple-600 border-purple-300 bg-purple-50 dark:bg-purple-950/30';
  if (porcentaje >= 0.030) return 'text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30';
  if (porcentaje >= 0.025) return 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30';
  return 'text-slate-600 border-slate-300 bg-slate-50 dark:bg-slate-950/30';
}

function tierLabel(porcentaje: number): string {
  if (porcentaje >= 0.035) return 'Platino';
  if (porcentaje >= 0.030) return 'Oro';
  if (porcentaje >= 0.025) return 'Plata';
  return 'Bronce';
}

export function TierProgressCard({ tierActivo, proximoTier, creditosAlcanzados }: TierProgressCardProps) {
  const progressToNext = proximoTier
    ? Math.min(
        ((creditosAlcanzados - (tierActivo?.creditos_minimos ?? 0)) /
          (proximoTier.creditos_minimos - (tierActivo?.creditos_minimos ?? 0))) * 100,
        100
      )
    : 100;

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* Tier activo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Comisión actual</span>
          </div>
          {tierActivo ? (
            <Badge
              variant="outline"
              className={cn('font-semibold', tierColor(tierActivo.porcentaje))}
            >
              {tierLabel(tierActivo.porcentaje)} — {(tierActivo.porcentaje * 100).toFixed(1)}%
            </Badge>
          ) : (
            <Badge variant="secondary">Sin tier asignado</Badge>
          )}
        </div>

        {tierActivo && (
          <p className="text-xs text-muted-foreground">
            {tierActivo.descripcion ?? `A partir de ${tierActivo.creditos_minimos} créditos`}
          </p>
        )}

        {/* Próximo tier */}
        {proximoTier && (
          <div className="space-y-2 pt-1 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Próximo tier</span>
              </div>
              <span className={cn('text-sm font-semibold', tierColor(proximoTier.porcentaje))}>
                {(proximoTier.porcentaje * 100).toFixed(1)}%
              </span>
            </div>

            <Progress value={progressToNext} className="h-2" />

            <p className="text-xs text-muted-foreground">
              Faltan{' '}
              <span className="font-semibold text-foreground">
                {proximoTier.faltan_creditos} crédito{proximoTier.faltan_creditos !== 1 ? 's' : ''}
              </span>{' '}
              para llegar a {proximoTier.descripcion ?? `${proximoTier.creditos_minimos} créditos`}
              {proximoTier.puntos_reward > 0 && (
                <span className="text-primary"> (+{proximoTier.puntos_reward} pts)</span>
              )}
            </p>
          </div>
        )}

        {!proximoTier && tierActivo && (
          <div className="pt-1 border-t">
            <p className="text-xs text-green-600 font-medium flex items-center gap-1">
              <Award className="h-3 w-3" />
              Nivel máximo alcanzado
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
