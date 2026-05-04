"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import api from "@/lib/axios";
import Link from "next/link";

interface Deductora { id: number; nombre: string; }

interface SaldoAsignado {
  id: number;
  credit_reference: string;
  credit_id: number;
  lead_name: string;
  cedula: string;
  deductora: string;
  monto: number;
  origen: string;
  fecha_origen: string;
  asignado_at: string | null;
  estado: string;
  notas: string | null;
  planilla_id: number | null;
  credit_payment: {
    id: number;
    numero_cuota: number;
    source: string;
    monto: number;
    fecha_pago: string | null;
    estado_reverso: string;
  } | null;
}

interface Props {
  deductoras?: Deductora[];
  annulledPayments?: any[];
  creditId?: number;   // filtrar por crédito específico
  cedula?: string;     // filtrar por cédula específica
  compact?: boolean;   // modo compacto sin filtros de deductora/fechas
}

const fmt = (v?: number | null) =>
  new Intl.NumberFormat('es-CR', { style: 'decimal', minimumFractionDigits: 2 }).format(v || 0);

const fmtDate = (d?: string | null) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('es-CR');
};

const estadoBadge = (estado: string) => {
  switch (estado) {
    case 'asignado_cuota':   return <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Cuota</Badge>;
    case 'asignado_capital': return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Capital</Badge>;
    case 'reintegrado':      return <Badge className="bg-gray-100 text-gray-700 border-gray-200 text-xs">Reintegro</Badge>;
    default:                 return <Badge variant="outline" className="text-xs">{estado}</Badge>;
  }
};

export function HistorialPagosAsignados({ deductoras = [], annulledPayments = [], creditId, cedula, compact = false }: Props) {
  const [data, setData] = useState<SaldoAsignado[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterDeductora, setFilterDeductora] = useState('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [annulledPage, setAnnulledPage] = useState(1);
  const annulledPerPage = 10;
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const perPage = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const estados = filterTipo === 'todos'
        ? 'asignado_cuota,asignado_capital,reintegrado'
        : filterTipo;

      const params: Record<string, string> = {
        estado: estados,
        per_page: String(perPage),
        page: String(page),
      };
      if (search) params.search = search;
      if (filterDeductora !== 'all') params.deductora_id = filterDeductora;
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;
      if (cedula) params.cedula = cedula;

      const res = await api.get('/api/saldos-pendientes', { params });
      setData(res.data.data || []);
      setTotal(res.data.total || 0);
      setLastPage(res.data.last_page || 1);
    } catch (e) {
      console.error('Error fetching historial:', e);
    } finally {
      setLoading(false);
    }
  }, [search, filterTipo, filterDeductora, fechaDesde, fechaHasta, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => { setPage(1); }, [search, filterTipo, filterDeductora, fechaDesde, fechaHasta]);

  return (
    <Card>
      <CardHeader className="pt-4 pb-2">
        <CardTitle>Historial de Pagos Asignados</CardTitle>
        <CardDescription>Sobrantes de planilla aplicados como cuota, capital o reintegrados.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          {!compact && (
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cédula, nombre, crédito..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
          )}
          <div className="w-40">
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                <SelectItem value="asignado_cuota">Cuota</SelectItem>
                <SelectItem value="asignado_capital">Capital</SelectItem>
                <SelectItem value="reintegrado">Reintegro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {deductoras.length > 0 && (
            <div className="w-44">
              <Select value={filterDeductora} onValueChange={setFilterDeductora}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Deductora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las deductoras</SelectItem>
                  {deductoras.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Desde</Label>
            <Input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="h-9 text-sm w-36" />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Hasta</Label>
            <Input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} className="h-9 text-sm w-36" />
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No hay registros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {!compact && <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Cliente</th>}
                  {!compact && <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Crédito</th>}
                  <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Monto Sobrante</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Deductora</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Planilla</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">F. Origen</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">F. Aplicado</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Tipo</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Detalle</th>
                  <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Aplicado por</th>
                  <th className="text-center py-2 px-3 font-medium text-xs text-muted-foreground">Estado Pago</th>
                </tr>
              </thead>
              <tbody>
                {data.map(s => (
                  <tr key={s.id} className="border-b hover:bg-muted/20">
                    {!compact && (
                      <td className="py-2 px-3">
                        <p className="font-medium text-sm">{s.lead_name}</p>
                        <p className="text-xs text-muted-foreground">{s.cedula}</p>
                      </td>
                    )}
                    {!compact && (
                      <td className="py-2 px-3">
                        <Link href={`/dashboard/creditos/${s.credit_id}`} className="text-primary hover:underline text-xs font-mono">
                          {s.credit_reference}
                        </Link>
                      </td>
                    )}
                    <td className="py-2 px-3 text-right font-mono text-sm font-semibold text-orange-600">
                      ₡{fmt(s.monto)}
                    </td>
                    <td className="py-2 px-3 text-xs">{s.deductora}</td>
                    <td className="py-2 px-3 text-center">
                      {s.planilla_id ? (
                        <Badge variant="outline" className="text-xs font-mono">#{s.planilla_id}</Badge>
                      ) : '-'}
                    </td>
                    <td className="py-2 px-3 text-center text-xs">{fmtDate(s.fecha_origen)}</td>
                    <td className="py-2 px-3 text-center text-xs">{fmtDate(s.asignado_at)}</td>
                    <td className="py-2 px-3 text-center">{estadoBadge(s.estado)}</td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {s.estado === 'asignado_cuota' && s.credit_payment
                        ? `Cuota #${s.credit_payment.numero_cuota}`
                        : s.estado === 'asignado_capital'
                        ? 'Abono a Capital'
                        : s.estado === 'reintegrado'
                        ? (s.notas || 'Reintegrado')
                        : '-'}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted-foreground">
                      {(s as any).aplicado_por || '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {s.credit_payment ? (
                        s.credit_payment.estado_reverso === 'Anulado'
                          ? <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Anulado</Badge>
                          : <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Vigente</Badge>
                      ) : (
                        s.estado === 'reintegrado'
                          ? <Badge className="bg-gray-100 text-gray-600 text-xs">N/A</Badge>
                          : '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagos de saldo anulados */}
        {annulledPayments.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-400" /> Pagos de saldo anulados ({annulledPayments.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {annulledPayments.slice((annulledPage-1)*annulledPerPage, annulledPage*annulledPerPage).map((p: any) => (
                    <tr key={p.id} className="border-b bg-red-50/40 hover:bg-red-50/60">
                      <td className="py-2 px-3">
                        <p className="font-medium text-sm">{p.credit?.lead?.name} {p.credit?.lead?.apellido1}</p>
                        <p className="text-xs text-muted-foreground">{p.cedula}</p>
                      </td>
                      <td className="py-2 px-3">
                        <Link href={`/dashboard/creditos/${p.credit?.id}`} className="text-primary hover:underline text-xs font-mono">
                          {p.credit?.reference}
                        </Link>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-sm font-semibold text-muted-foreground">
                        ₡{fmt(p.monto)}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{p.credit?.deductora?.nombre || '-'}</td>
                      <td className="py-2 px-3 text-center text-xs">{fmtDate(p.fecha_pago)}</td>
                      <td className="py-2 px-3 text-center text-xs">{fmtDate(p.fecha_anulacion)}</td>
                      <td className="py-2 px-3 text-center">
                        {p.source?.includes('Abono a Capital')
                          ? <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Capital</Badge>
                          : <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">Cuota</Badge>}
                      </td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">
                        {p.source?.includes('Abono a Capital') ? 'Abono a Capital' : `Cuota #${p.numero_cuota}`}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Anulado</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {annulledPayments.length > annulledPerPage && (
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>{annulledPayments.length} registros</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAnnulledPage(p => Math.max(1, p-1))} disabled={annulledPage === 1} className="p-1 rounded hover:bg-muted disabled:opacity-40">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span>{annulledPage} / {Math.ceil(annulledPayments.length/annulledPerPage)}</span>
                  <button onClick={() => setAnnulledPage(p => Math.min(Math.ceil(annulledPayments.length/annulledPerPage), p+1))} disabled={annulledPage >= Math.ceil(annulledPayments.length/annulledPerPage)} className="p-1 rounded hover:bg-muted disabled:opacity-40">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Paginación */}
        {total > perPage && (
          <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
            <span>{total} registros</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>{page} / {lastPage}</span>
              <button
                onClick={() => setPage(p => Math.min(lastPage, p + 1))}
                disabled={page === lastPage}
                className="p-1 rounded hover:bg-muted disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
