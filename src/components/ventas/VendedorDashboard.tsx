'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { TierProgressCard } from './TierProgressCard';
import { RankingStrip, type RankingEntry } from './RankingStrip';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Target, Banknote, Star, CalendarClock, Loader2,
  Clock, MapPin, ChevronRight,
} from 'lucide-react';

interface ComisionesMes {
  pendientes_monto: number;
  aprobadas_monto: number;
  pagadas_monto: number;
}

interface MetaMes {
  creditos_objetivo: number;
  creditos_alcanzados: number;
  monto_objetivo: number;
  monto_alcanzado: number;
  alcance_pct: number;
}

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

interface Visita {
  id: number;
  institucion_nombre: string | null;
  institucion?: { nombre: string } | null;
  fecha_planificada: string;
  status: string;
}

interface VendedorDashboardData {
  vendedor: { id: number; name: string };
  meta_mes: MetaMes | null;
  tier_activo: Tier | null;
  proximo_tier: ProximoTier | null;
  comisiones_mes: ComisionesMes;
  reward_points: number;
  reward_level: number;
  ranking: number;
}

interface VendedorDashboardProps {
  data: VendedorDashboardData | null;
  loading: boolean;
  ranking: RankingEntry[];
  rankingLoading: boolean;
  visitas: Visita[];
  mes: string;
  anio: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

export function VendedorDashboard({
  data, loading, ranking, rankingLoading, visitas, mes, anio,
}: VendedorDashboardProps) {
  const router = useRouter();

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { meta_mes, tier_activo, proximo_tier, comisiones_mes, reward_points, reward_level } = data;

  const hoy = new Date().toDateString();
  const visitasHoy    = visitas.filter(v => new Date(v.fecha_planificada).toDateString() === hoy);
  const visitasProximas = visitas.filter(v => new Date(v.fecha_planificada).toDateString() !== hoy);

  return (
    <div className="space-y-5">
      {/* Franja de ranking */}
      <RankingStrip ranking={ranking} mes={mes} anio={anio} loading={rankingLoading} />

      {/* ── Fila 1: Visitas (operacional, lo más importante) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Mis visitas planificadas</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {visitas.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <CalendarClock className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No tienes visitas planificadas por tu supervisor.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Visitas de hoy */}
              {visitasHoy.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Hoy
                  </p>
                  <div className="space-y-2">
                    {visitasHoy.map(v => (
                      <div key={v.id} className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{v.institucion?.nombre ?? v.institucion_nombre ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(v.fecha_planificada).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </div>
                        <Badge className="text-xs bg-primary/10 text-primary border-primary/30">{v.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Próximas */}
              {visitasProximas.length > 0 && (
                <div>
                  {visitasHoy.length > 0 && <Separator className="my-2" />}
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <ChevronRight className="h-3 w-3" /> Próximas
                  </p>
                  <div className="space-y-2">
                    {visitasProximas.slice(0, 3).map(v => (
                      <div key={v.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{v.institucion?.nombre ?? v.institucion_nombre ?? '—'}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(v.fecha_planificada).toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">{v.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {visitas.length > 4 && (
                <p className="text-xs text-center text-muted-foreground pt-1">
                  +{visitas.length - 4} visitas más en "Mis visitas"
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Fila 2: Meta + Tier ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Mi meta — {mes} {anio}</CardTitle>
              </div>
              {data.ranking && (
                <Badge variant="outline" className="text-xs">Posición #{data.ranking}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!meta_mes ? (
              <p className="text-sm text-muted-foreground">Sin meta asignada para este período.</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Créditos formalizados</span>
                    <span className="font-semibold">{meta_mes.creditos_alcanzados} / {meta_mes.creditos_objetivo}</span>
                  </div>
                  <Progress
                    value={Math.min(meta_mes.alcance_pct, 100)}
                    className={meta_mes.alcance_pct >= 100 ? '[&>div]:bg-green-500' : ''}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{meta_mes.alcance_pct.toFixed(1)}% alcanzado</span>
                    {meta_mes.creditos_alcanzados < meta_mes.creditos_objetivo && (
                      <span className="font-medium text-orange-600">
                        Faltan {meta_mes.creditos_objetivo - meta_mes.creditos_alcanzados} crédito{meta_mes.creditos_objetivo - meta_mes.creditos_alcanzados !== 1 ? 's' : ''} para tu meta
                      </span>
                    )}
                    {meta_mes.creditos_alcanzados >= meta_mes.creditos_objetivo && (
                      <span className="font-medium text-green-600">¡Meta alcanzada!</span>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Monto colocado</p>
                    <p className="font-semibold">{fmt(meta_mes.monto_alcanzado)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Meta de monto</p>
                    <p className="font-semibold">{fmt(meta_mes.monto_objetivo)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <TierProgressCard
          tierActivo={tier_activo}
          proximoTier={proximo_tier}
          creditosAlcanzados={meta_mes?.creditos_alcanzados ?? 0}
        />
      </div>

      {/* ── Fila 3: Comisiones + Recompensas ── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Mis comisiones — {mes} {anio}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">Pendientes</p>
                <p className="text-lg font-bold text-yellow-600">{fmt(comisiones_mes.pendientes_monto)}</p>
                <Badge variant="secondary" className="text-xs">Por aprobar</Badge>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">Aprobadas</p>
                <p className="text-lg font-bold text-blue-600">{fmt(comisiones_mes.aprobadas_monto)}</p>
                <Badge variant="outline" className="text-xs">Aprobadas</Badge>
              </div>
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground">Pagadas</p>
                <p className="text-lg font-bold text-green-600">{fmt(comisiones_mes.pagadas_monto)}</p>
                <Badge className="text-xs">Pagadas</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Mis recompensas</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Puntos totales</span>
              <span className="text-lg font-bold text-primary">{reward_points.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Nivel actual</span>
              <Badge className="text-xs">Nivel {reward_level}</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs mt-1"
              onClick={() => router.push('/dashboard/rewards')}
            >
              Ver mis recompensas <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
