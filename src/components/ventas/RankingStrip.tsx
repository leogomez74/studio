'use client';

import React, { useState } from 'react';
import { Trophy, Medal } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RankingModal } from './RankingModal';

export interface RankingEntry {
  user_id: number;
  name: string;
  creditos_mes: number;
  meta_cantidad: number;
  alcance_pct: number;
  tier_activo_nombre: string;
  posicion: number;
  es_propio: boolean;
}

interface RankingStripProps {
  ranking: RankingEntry[];
  mes: string;
  anio: number;
  loading?: boolean;
}

function MedalIcon({ posicion }: { posicion: number }) {
  if (posicion === 1) return <span className="text-yellow-500 text-base">🥇</span>;
  if (posicion === 2) return <span className="text-slate-400 text-base">🥈</span>;
  if (posicion === 3) return <span className="text-amber-600 text-base">🥉</span>;
  return <span className="text-muted-foreground text-xs font-bold w-5 text-center">#{posicion}</span>;
}

export function RankingStrip({ ranking, mes, anio, loading = false }: RankingStripProps) {
  const [showModal, setShowModal] = useState(false);

  const visibles = ranking.slice(0, 4);
  const resto = ranking.length - 4;
  const propio = ranking.find(r => r.es_propio);
  const propioVisible = visibles.some(r => r.es_propio);

  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/30 px-4 py-3 animate-pulse h-16" />
    );
  }

  if (ranking.length === 0) return null;

  return (
    <>
      <div className="rounded-lg border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {mes} {anio}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-1 flex-wrap min-w-0">
            {visibles.map((entry) => (
              <RankingCard key={entry.user_id} entry={entry} />
            ))}

            {/* Posición propia si está fuera del top 4 */}
            {!propioVisible && propio && (
              <>
                <span className="text-muted-foreground text-xs">·····</span>
                <RankingCard entry={propio} />
              </>
            )}
          </div>

          {resto > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 shrink-0"
              onClick={() => setShowModal(true)}
            >
              y {resto} más →
            </Button>
          )}
        </div>
      </div>

      <RankingModal
        open={showModal}
        onClose={() => setShowModal(false)}
        ranking={ranking}
        mes={mes}
        anio={anio}
      />
    </>
  );
}

function RankingCard({ entry }: { entry: RankingEntry }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1 min-w-[160px]',
        entry.es_propio ? 'bg-primary/10 border border-primary/20' : 'bg-background/60'
      )}
    >
      <MedalIcon posicion={entry.posicion} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-xs font-medium truncate', entry.es_propio && 'text-primary')}>
          {entry.es_propio ? 'Tú' : entry.name}
        </p>
        <div className="flex items-center gap-1.5">
          <Progress value={Math.min(entry.alcance_pct, 100)} className="h-1 flex-1" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {entry.creditos_mes}/{entry.meta_cantidad}
          </span>
        </div>
      </div>
    </div>
  );
}
