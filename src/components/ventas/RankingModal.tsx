'use client';

import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RankingEntry } from './RankingStrip';

interface RankingModalProps {
  open: boolean;
  onClose: () => void;
  ranking: RankingEntry[];
  mes: string;
  anio: number;
}

export function RankingModal({ open, onClose, ranking, mes, anio }: RankingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Ranking — {mes} {anio}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {ranking.map((entry) => (
            <div
              key={entry.user_id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                entry.es_propio && 'border-primary/40 bg-primary/5',
                entry.posicion === 1 && 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20',
                entry.posicion === 2 && 'border-slate-300 bg-slate-50 dark:bg-slate-950/20',
                entry.posicion === 3 && 'border-amber-300 bg-amber-50 dark:bg-amber-950/20',
              )}
            >
              {/* Posición */}
              <div className="w-8 text-center shrink-0">
                {entry.posicion === 1 && <span className="text-xl">🥇</span>}
                {entry.posicion === 2 && <span className="text-xl">🥈</span>}
                {entry.posicion === 3 && <span className="text-xl">🥉</span>}
                {entry.posicion > 3 && (
                  <span className="text-sm font-bold text-muted-foreground">#{entry.posicion}</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn('text-sm font-semibold truncate', entry.es_propio && 'text-primary')}>
                    {entry.es_propio ? `${entry.name} (Tú)` : entry.name}
                  </span>
                  {entry.tier_activo_nombre && entry.tier_activo_nombre !== 'Sin tier' && (
                    <Badge variant="outline" className="text-xs h-5 px-1.5 shrink-0">
                      {entry.tier_activo_nombre}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(entry.alcance_pct, 100)} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {entry.creditos_mes} / {entry.meta_cantidad} créditos
                  </span>
                </div>
              </div>

              {/* Porcentaje */}
              <div className="shrink-0 text-right">
                <span className={cn(
                  'text-sm font-bold',
                  entry.alcance_pct >= 100 ? 'text-green-600' :
                  entry.alcance_pct >= 50 ? 'text-yellow-600' : 'text-muted-foreground'
                )}>
                  {entry.alcance_pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
