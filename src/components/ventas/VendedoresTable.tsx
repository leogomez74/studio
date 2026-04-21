'use client';

import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal, User, Target, Layers, Banknote,
  Eye, ArrowUpDown, UserX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export interface VendedorRow {
  user_id: number;
  name: string;
  role_name: string;
  creditos_mes: number;
  meta_cantidad: number;
  alcance_pct: number;
  monto_colocado: number;
  ticket_promedio: number;
  tasa_cierre: number | null;
  comision_acumulada: number;
  tier_activo_nombre: string;
  tier_porcentaje: number | null;
  ultima_actividad: string | null;
  posicion: number | null;
}

interface VendedoresTableProps {
  vendedores: VendedorRow[];
  loading: boolean;
  onVerComisiones: (userId: number) => void;
  onVerVisitas: (userId: number) => void;
  onGestionarMeta: (userId: number) => void;
  onDesactivar: (userId: number, name: string) => void;
}

type SortKey = 'posicion' | 'creditos_mes' | 'monto_colocado' | 'alcance_pct' | 'comision_acumulada';

const fmt = (n: number) =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(n);

function MedalBadge({ posicion }: { posicion: number | null }) {
  if (posicion === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (posicion === 1) return <span className="text-lg">🥇</span>;
  if (posicion === 2) return <span className="text-lg">🥈</span>;
  if (posicion === 3) return <span className="text-lg">🥉</span>;
  return <span className="text-sm font-bold text-muted-foreground">#{posicion}</span>;
}

function TierBadge({ nombre, porcentaje }: { nombre: string; porcentaje: number | null }) {
  if (!nombre || nombre === 'Sin tier') return <span className="text-xs text-muted-foreground">—</span>;
  const color =
    (porcentaje ?? 0) >= 0.035 ? 'border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/30' :
    (porcentaje ?? 0) >= 0.030 ? 'border-yellow-300 text-yellow-700 bg-yellow-50 dark:bg-yellow-950/30' :
    (porcentaje ?? 0) >= 0.025 ? 'border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30' :
    'border-slate-300 text-slate-600';
  return (
    <Badge variant="outline" className={cn('text-xs font-medium', color)}>
      {nombre} {porcentaje !== null && `· ${(porcentaje * 100).toFixed(1)}%`}
    </Badge>
  );
}

export function VendedoresTable({
  vendedores, loading, onVerComisiones, onVerVisitas, onGestionarMeta, onDesactivar,
}: VendedoresTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('posicion');
  const [sortAsc, setSortAsc] = useState(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...vendedores].sort((a, b) => {
    const diff = (a[sortKey] ?? 0) > (b[sortKey] ?? 0) ? 1 : -1;
    return sortAsc ? diff : -diff;
  });

  const SortBtn = ({ col }: { col: SortKey }) => (
    <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => toggleSort(col)}>
      <ArrowUpDown className={cn('h-3 w-3', sortKey === col ? 'text-primary' : 'text-muted-foreground')} />
    </Button>
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (vendedores.length === 0) {
    return (
      <p className="text-center py-12 text-muted-foreground text-sm">
        No hay vendedores con meta activa este mes.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"># <SortBtn col="posicion" /></TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead>Créditos mes <SortBtn col="creditos_mes" /></TableHead>
            <TableHead>Monto colocado <SortBtn col="monto_colocado" /></TableHead>
            <TableHead>Ticket prom.</TableHead>
            <TableHead>Cierre</TableHead>
            <TableHead>Comisión <SortBtn col="comision_acumulada" /></TableHead>
            <TableHead>Tier activo</TableHead>
            <TableHead>Últ. actividad</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((v) => (
            <TableRow
              key={v.user_id}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => router.push(`/dashboard/ventas/${v.user_id}`)}
            >
              <TableCell>
                <MedalBadge posicion={v.posicion} />
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{v.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <span className="font-medium text-sm">{v.name}</span>
                    <div>
                      <Badge
                        variant="outline"
                        className={cn('text-xs h-4 px-1', v.role_name === 'Vendedor Interno'
                          ? 'border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-950/20'
                          : 'border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-950/20'
                        )}
                      >
                        {v.role_name === 'Vendedor Interno' ? 'Interno' : 'Externo'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <div className="space-y-1 min-w-[120px]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{v.creditos_mes}</span>
                    <span className="text-muted-foreground">/ {v.meta_cantidad}</span>
                  </div>
                  <Progress
                    value={Math.min(v.alcance_pct, 100)}
                    className={cn('h-1.5', v.alcance_pct >= 100 ? '[&>div]:bg-green-500' : '')}
                  />
                </div>
              </TableCell>

              <TableCell className="font-medium text-sm">
                {fmt(v.monto_colocado)}
              </TableCell>

              <TableCell className="text-sm text-muted-foreground">
                {v.ticket_promedio > 0 ? fmt(v.ticket_promedio) : '—'}
              </TableCell>

              <TableCell>
                {v.tasa_cierre !== null ? (
                  <Badge variant={v.tasa_cierre >= 50 ? 'default' : 'secondary'} className="text-xs">
                    {v.tasa_cierre.toFixed(0)}%
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell className="text-sm font-semibold">
                {fmt(v.comision_acumulada)}
              </TableCell>

              <TableCell onClick={e => e.stopPropagation()}>
                <TierBadge nombre={v.tier_activo_nombre} porcentaje={v.tier_porcentaje} />
              </TableCell>

              <TableCell className="text-xs text-muted-foreground">
                {v.ultima_actividad
                  ? new Date(v.ultima_actividad).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })
                  : '—'}
              </TableCell>

              <TableCell onClick={e => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/ventas/${v.user_id}`)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Ver perfil completo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onGestionarMeta(v.user_id)}>
                      <Target className="mr-2 h-4 w-4" />
                      Gestionar meta
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onVerComisiones(v.user_id)}>
                      <Banknote className="mr-2 h-4 w-4" />
                      Ver comisiones
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onVerVisitas(v.user_id)}>
                      <Layers className="mr-2 h-4 w-4" />
                      Ver visitas
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onDesactivar(v.user_id, v.name)}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      Desactivar vendedor
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
