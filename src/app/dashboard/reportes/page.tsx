'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import { downloadExport } from '@/lib/download-export';
import { ProtectedPage } from '@/components/ProtectedPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow, ScrollableTableContainer,
} from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
  AreaChart, Area, Tooltip,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, FileText, RefreshCw, AlertTriangle, CheckCircle, XCircle, ArrowLeftRight, Loader2, ChevronLeft, ChevronRight, Search } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '₡' + n.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TODAY = new Date().toISOString().split('T')[0];
const FIRST_OF_MONTH = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString().split('T')[0];

const CHART_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
const ROWS_PER_PAGE = 25;
const PIE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Deductora { id: number; nombre: string }

interface CarteraRow {
  id: number; referencia: string; cliente: string; cedula: string; deductora: string;
  monto_credito: number; saldo: number; cuota: number;
  cuotas_atrasadas: number; proxima_fecha: string | null; status: string;
}

interface MoraRow {
  id: number; referencia: string; cliente: string; cedula: string; deductora: string;
  saldo: number; cuota: number; cuotas_atrasadas: number; dias_mora: number;
  rango_mora: string; status: string;
}

interface DeductoraRow {
  deductora_id: number | null; deductora: string; total_creditos: number;
  monto_total: number; saldo_total: number; cuota_total: number; porcentaje: number;
}

interface NovItem {
  tipo: string; id: number; referencia: string; cliente: string; cedula: string; detalle: string;
  cuota?: number; fecha?: string; motivo?: string;
  cuota_anterior?: number; cuota_nueva?: number; diferencia?: number;
}

interface CobroRow {
  id: number; fecha_pago: string; referencia: string; cliente: string; cedula: string;
  deductora: string; numero_cuota: number; monto: number; amortizacion: number;
  interes_corriente: number; interes_moratorio: number; source: string;
}


// ─── Componente principal ────────────────────────────────────────────────────

export default function ReportesPage() {
  const [deductoras, setDeductoras] = useState<Deductora[]>([]);

  useEffect(() => {
    api.get('/api/deductoras').then(r => setDeductoras(r.data?.data ?? r.data ?? []));
  }, []);

  return (
    <ProtectedPage module="reportes">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground text-sm">Análisis de cartera, cobros, novedades de planilla e inversiones</p>
        </div>

        <Tabs defaultValue="cartera">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="cartera">Cartera Activa</TabsTrigger>
            <TabsTrigger value="mora">Cartera en Mora</TabsTrigger>
            <TabsTrigger value="deductora">Por Deductora</TabsTrigger>
            <TabsTrigger value="novedades">Novedades de Planilla</TabsTrigger>
            <TabsTrigger value="cobros">Cobros</TabsTrigger>
          </TabsList>

          <TabsContent value="cartera">
            <CarteraTab deductoras={deductoras} />
          </TabsContent>
          <TabsContent value="mora">
            <MoraTab deductoras={deductoras} />
          </TabsContent>
          <TabsContent value="deductora">
            <DeductoraTab />
          </TabsContent>
          <TabsContent value="novedades">
            <NovedadesTab deductoras={deductoras} />
          </TabsContent>
          <TabsContent value="cobros">
            <CobrosTab deductoras={deductoras} />
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedPage>
  );
}

// ─── Tarjeta resumen ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Barra de filtros ─────────────────────────────────────────────────────────

function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-3 items-end mb-4">{children}</div>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 min-w-[140px]">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ExportButtons({ onExcel, onPdf, loadingExcel, loadingPdf, noPdf }: {
  onExcel: () => void; onPdf?: () => void;
  loadingExcel?: boolean; loadingPdf?: boolean; noPdf?: boolean;
}) {
  return (
    <div className="flex gap-2 ml-auto">
      <Button variant="outline" size="sm" onClick={onExcel} disabled={loadingExcel}>
        <FileSpreadsheet className="h-4 w-4 mr-1" />
        {loadingExcel ? 'Generando…' : 'Excel'}
      </Button>
      {!noPdf && (
        <Button variant="outline" size="sm" onClick={onPdf} disabled={loadingPdf}>
          <FileText className="h-4 w-4 mr-1" />
          {loadingPdf ? 'Generando…' : 'PDF'}
        </Button>
      )}
    </div>
  );
}

function TablePagination({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / ROWS_PER_PAGE);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-2 border-t text-sm text-muted-foreground">
      <span>{(page - 1) * ROWS_PER_PAGE + 1}–{Math.min(page * ROWS_PER_PAGE, total)} de {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onChange(page - 1)} disabled={page === 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2">Página {page} de {totalPages}</span>
        <Button variant="ghost" size="sm" onClick={() => onChange(page + 1)} disabled={page === totalPages}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── TAB 1: Cartera Activa ────────────────────────────────────────────────────

function CarteraTab({ deductoras }: { deductoras: Deductora[] }) {
  const [deductoraId, setDeductoraId] = useState('all');
  const [estado, setEstado] = useState('all');
  const [data, setData] = useState<{ data: CarteraRow[]; totales: Record<string, number>; por_estado: Record<string, { count: number; saldo: number }> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingXls, setLoadingXls] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams();
      if (deductoraId !== 'all') p.set('deductora_id', deductoraId);
      if (estado !== 'all') p.set('estado', estado);
      const r = await api.get('/api/reportes/cartera?' + p.toString());
      setData(r.data);
      setPage(1);
      setSearch('');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al cargar la cartera.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [deductoraId, estado]);

  useEffect(() => { fetch(); }, [fetch]);

  const chartData = data ? Object.entries(data.por_estado).map(([estado, v]) => ({
    estado, saldo: v.saldo, count: v.count,
  })) : [];

  const chartConfig = { saldo: { label: 'Saldo', color: 'hsl(var(--chart-1))' } };

  const filteredCartera = data ? data.data.filter(r =>
    !search || [r.cliente, r.cedula, r.referencia].join(' ').toLowerCase().includes(search.toLowerCase())
  ) : [];

  const doExcel = async () => {
    setLoadingXls(true);
    const p = new URLSearchParams();
    if (deductoraId !== 'all') p.set('deductora_id', deductoraId);
    if (estado !== 'all') p.set('estado', estado);
    await downloadExport('/api/reportes/cartera/excel?' + p.toString(), 'cartera_activa.xlsx');
    setLoadingXls(false);
  };

  const doPdf = async () => {
    setLoadingPdf(true);
    const p = new URLSearchParams();
    if (deductoraId !== 'all') p.set('deductora_id', deductoraId);
    if (estado !== 'all') p.set('estado', estado);
    await downloadExport('/api/reportes/cartera/pdf?' + p.toString(), 'cartera_activa.pdf');
    setLoadingPdf(false);
  };

  return (
    <div className="space-y-4 mt-2">
      <FilterRow>
        <FilterField label="Deductora">
          <Select value={deductoraId} onValueChange={setDeductoraId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {deductoras.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Estado">
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Activo">Activo</SelectItem>
              <SelectItem value="En Mora">En Mora</SelectItem>
              <SelectItem value="Formalizado">Formalizado</SelectItem>
              <SelectItem value="Legal">Legal</SelectItem>
              <SelectItem value="En Progreso">En Progreso</SelectItem>
              <SelectItem value="Aprobado">Aprobado</SelectItem>
              <SelectItem value="Por firmar">Por firmar</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
        <FilterField label="Buscar">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cliente, cédula, referencia…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-7 w-[220px]"
            />
          </div>
        </FilterField>
        <ExportButtons onExcel={doExcel} onPdf={doPdf} loadingExcel={loadingXls} loadingPdf={loadingPdf} />
      </FilterRow>

      {loading && !data && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando cartera…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Total créditos" value={String(data.totales.creditos)} />
            <SummaryCard label="Saldo total" value={fmt(data.totales.saldo_total)} />
            <SummaryCard label="Monto desembolsado" value={fmt(data.totales.monto_total)} />
            <SummaryCard label="Cuota mensual total" value={fmt(data.totales.cuota_total)} />
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Saldo por Estado</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[220px]">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="estado" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => '₡' + (v / 1e6).toFixed(1) + 'M'} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
                    <Bar dataKey="saldo" fill="var(--color-saldo)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm">Detalle — {filteredCartera.length}{search ? ` de ${data.data.length}` : ''} créditos</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollableTableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Deductora</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Cuota</TableHead>
                      <TableHead className="text-center">C.Atrasadas</TableHead>
                      <TableHead>Próx. Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                    ) : filteredCartera.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{search ? 'Sin resultados para la búsqueda' : 'Sin resultados'}</TableCell></TableRow>
                    ) : filteredCartera.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE).map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.referencia}</TableCell>
                        <TableCell>{r.cliente}</TableCell>
                        <TableCell className="text-xs">{r.cedula}</TableCell>
                        <TableCell className="text-xs">{r.deductora}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.monto_credito)}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmt(r.saldo)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.cuota)}</TableCell>
                        <TableCell className="text-center">
                          {r.cuotas_atrasadas > 0 ? <Badge variant="destructive">{r.cuotas_atrasadas}</Badge> : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{r.proxima_fecha ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'En Mora' ? 'destructive' : r.status === 'Activo' ? 'default' : 'secondary'}>
                            {r.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
              <TablePagination page={page} total={data.data.length} onChange={setPage} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── TAB 2: Cartera en Mora ───────────────────────────────────────────────────

const RANGOS = ['1-30 días', '31-60 días', '61-90 días', 'Más de 90 días'];

function MoraTab({ deductoras }: { deductoras: Deductora[] }) {
  const [deductoraId, setDeductoraId] = useState('all');
  const [data, setData] = useState<{ data: MoraRow[]; totales: Record<string, number>; por_rango: Record<string, { count: number; saldo: number }> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingXls, setLoadingXls] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    setSearch('');
    setPage(1);
    try {
      const p = new URLSearchParams();
      if (deductoraId !== 'all') p.set('deductora_id', deductoraId);
      const r = await api.get('/api/reportes/cartera-mora?' + p.toString());
      setData(r.data);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al cargar mora.');
    } finally { setLoading(false); }
  }, [deductoraId]);

  useEffect(() => { fetch(); }, [fetch]);

  const filteredMora = data ? data.data.filter(r =>
    !search || [r.cliente, r.cedula, r.referencia].join(' ').toLowerCase().includes(search.toLowerCase())
  ) : [];

  const chartData = RANGOS.map(r => ({
    rango: r.replace(' días', ''), saldo: data?.por_rango?.[r]?.saldo ?? 0, count: data?.por_rango?.[r]?.count ?? 0,
  }));

  const chartConfig = { saldo: { label: 'Saldo en mora', color: 'hsl(var(--chart-2))' } };

  const doExcel = async () => {
    setLoadingXls(true);
    const p = new URLSearchParams();
    if (deductoraId !== 'all') p.set('deductora_id', deductoraId);
    await downloadExport('/api/reportes/cartera-mora/excel?' + p.toString(), 'cartera_mora.xlsx');
    setLoadingXls(false);
  };
  const doPdf = async () => {
    setLoadingPdf(true);
    const p = new URLSearchParams();
    if (deductoraId !== 'all') p.set('deductora_id', deductoraId);
    await downloadExport('/api/reportes/cartera-mora/pdf?' + p.toString(), 'cartera_mora.pdf');
    setLoadingPdf(false);
  };

  return (
    <div className="space-y-4 mt-2">
      <FilterRow>
        <FilterField label="Deductora">
          <Select value={deductoraId} onValueChange={setDeductoraId}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {deductoras.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Buscar">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cliente, cédula, ref…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-7 w-[200px] h-8 text-sm"
            />
          </div>
        </FilterField>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
        <ExportButtons onExcel={doExcel} onPdf={doPdf} loadingExcel={loadingXls} loadingPdf={loadingPdf} />
      </FilterRow>

      {loading && !data && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando mora…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SummaryCard label="Créditos en mora" value={String(data.totales.creditos)} />
            <SummaryCard label="Saldo en mora" value={fmt(data.totales.saldo_mora)} />
            <SummaryCard label="Cuota total en mora" value={fmt(data.totales.cuota_mora)} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Saldo en Mora por Rango de Días</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[200px]">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="rango" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => '₡' + (v / 1e6).toFixed(1) + 'M'} tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
                  <Bar dataKey="saldo" fill="var(--color-saldo)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Detalle — {search ? `${filteredMora.length} de ${data.data.length}` : data.data.length} créditos en mora
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Deductora</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead className="text-right">Cuota</TableHead>
                      <TableHead className="text-center">C.Atrasadas</TableHead>
                      <TableHead className="text-center">Días Mora</TableHead>
                      <TableHead>Rango</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                    ) : filteredMora.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">{search ? 'Sin resultados para la búsqueda' : 'Sin créditos en mora'}</TableCell></TableRow>
                    ) : filteredMora.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE).map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.referencia}</TableCell>
                        <TableCell>{r.cliente}</TableCell>
                        <TableCell className="text-xs">{r.cedula}</TableCell>
                        <TableCell className="text-xs">{r.deductora}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmt(r.saldo)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.cuota)}</TableCell>
                        <TableCell className="text-center"><Badge variant="destructive">{r.cuotas_atrasadas}</Badge></TableCell>
                        <TableCell className="text-center font-medium text-red-600">{r.dias_mora}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.rango_mora}</Badge></TableCell>
                        <TableCell><Badge variant="destructive">{r.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
              <TablePagination page={page} total={filteredMora.length} onChange={setPage} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── TAB 3: Por Deductora ─────────────────────────────────────────────────────

function DeductoraTab() {
  const [estado, setEstado] = useState('all');
  const [data, setData] = useState<{ data: DeductoraRow[]; totales: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingXls, setLoadingXls] = useState(false);
  const [loadingPdfId, setLoadingPdfId] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams();
      if (estado !== 'all') p.set('estado', estado);
      const r = await api.get('/api/reportes/cartera-deductora?' + p.toString());
      setData(r.data);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al cargar deductoras.');
    } finally { setLoading(false); }
  }, [estado]);

  useEffect(() => { fetch(); }, [fetch]);

  const pieData = (data?.data ?? []).map(r => ({ name: r.deductora, value: r.saldo_total }));

  const doExcel = async () => {
    setLoadingXls(true);
    const p = new URLSearchParams();
    if (estado !== 'all') p.set('estado', estado);
    await downloadExport('/api/reportes/cartera-deductora/excel?' + p.toString(), 'cartera_por_deductora.xlsx');
    setLoadingXls(false);
  };

  const doPlanillaPdf = async (deductoraId: number, nombre: string) => {
    setLoadingPdfId(deductoraId);
    await downloadExport(
      `/api/reportes/planilla-cobro/${deductoraId}/pdf`,
      `planilla_cobro_${nombre.replace(/\s+/g, '_')}.pdf`
    );
    setLoadingPdfId(null);
  };

  return (
    <div className="space-y-4 mt-2">
      <FilterRow>
        <FilterField label="Estado">
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Activo">Activo</SelectItem>
              <SelectItem value="En Mora">En Mora</SelectItem>
              <SelectItem value="Formalizado">Formalizado</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={doExcel} disabled={loadingXls}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />{loadingXls ? 'Generando…' : 'Excel resumen'}
          </Button>
        </div>
      </FilterRow>

      {loading && !data && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Deductoras activas" value={String(data.data.length)} />
            <SummaryCard label="Total créditos" value={String(data.totales.creditos)} />
            <SummaryCard label="Saldo total" value={fmt(data.totales.saldo_total)} />
            <SummaryCard label="Cuota mensual total" value={fmt(data.totales.cuota_total)} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribución de Saldo</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                <PieChart width={280} height={220}>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine fontSize={10}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                </PieChart>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Planillas de Cobro por Cooperativa</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deductora</TableHead>
                      <TableHead className="text-center"># Créd.</TableHead>
                      <TableHead className="text-right">Cuota / mes</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-center">Planilla</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Cargando…</TableCell></TableRow>
                    ) : (data.data.map((r, i) => (
                      <TableRow key={r.deductora_id ?? 'null'}>
                        <TableCell className="flex items-center gap-2 text-sm">
                          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          {r.deductora}
                        </TableCell>
                        <TableCell className="text-center">{r.total_creditos}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmt(r.cuota_total)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{r.porcentaje}%</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {r.deductora_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => doPlanillaPdf(r.deductora_id!, r.deductora)}
                              disabled={loadingPdfId === r.deductora_id}
                            >
                              {loadingPdfId === r.deductora_id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <FileText className="h-3 w-3" />}
                              PDF
                            </Button>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    )))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ─── TAB 4: Novedades de Planilla ─────────────────────────────────────────────

function NovedadesTab({ deductoras }: { deductoras: Deductora[] }) {
  const [deductoraId, setDeductoraId] = useState('');
  const [desde, setDesde] = useState(FIRST_OF_MONTH);
  const [hasta, setHasta] = useState(TODAY);
  const [data, setData] = useState<{ inclusiones: NovItem[]; exclusiones: NovItem[]; modificaciones: NovItem[]; resumen: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Auto-fetch cuando cambia deductora o fechas — sin botón manual
  const doFetch = useCallback(async (did: string, d: string, h: string) => {
    if (!did) return;
    setError('');
    setLoading(true);
    setData(null);
    try {
      const p = new URLSearchParams({ deductora_id: did, desde: d, hasta: h });
      const r = await api.get('/api/reportes/novedades-planilla?' + p.toString());
      setData(r.data);
    } catch {
      setError('Error al cargar las novedades.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    doFetch(deductoraId, desde, hasta);
  }, [deductoraId, desde, hasta, doFetch]);

  // Auto-seleccionar la primera deductora disponible
  useEffect(() => {
    if (deductoras.length > 0 && !deductoraId) {
      setDeductoraId(String(deductoras[0].id));
    }
  }, [deductoras, deductoraId]);

  const deductoraName = deductoras.find(d => String(d.id) === deductoraId)?.nombre ?? '';

  const doPdf = async () => {
    if (!deductoraId) return;
    setLoadingPdf(true);
    const p = new URLSearchParams({ deductora_id: deductoraId, desde, hasta });
    await downloadExport(
      '/api/reportes/novedades-planilla/pdf?' + p.toString(),
      `novedades_${deductoraName.replace(/\s+/g, '_')}.pdf`
    );
    setLoadingPdf(false);
  };

  return (
    <div className="space-y-4 mt-2">
      <FilterRow>
        <FilterField label="Cooperativa">
          <Select value={deductoraId} onValueChange={setDeductoraId}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
            <SelectContent>
              {deductoras.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Desde">
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-[145px]" />
        </FilterField>
        <FilterField label="Hasta">
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-[145px]" />
        </FilterField>
        {loading && <Loader2 className="h-4 w-4 animate-spin self-end mb-2 text-muted-foreground" />}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={doPdf} disabled={loadingPdf || !data || !deductoraId}>
            {loadingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
            PDF Novedades
          </Button>
        </div>
      </FilterRow>

      {error && (
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />{error}
        </div>
      )}

      {!deductoraId && (
        <p className="text-center text-muted-foreground py-8">Selecciona una cooperativa para ver las novedades.</p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-xs text-green-700">Inclusiones</p>
                    <p className="text-2xl font-bold text-green-800">{data.resumen.inclusiones}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-xs text-red-700">Exclusiones</p>
                    <p className="text-2xl font-bold text-red-800">{data.resumen.exclusiones}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-yellow-600" />
                  <div>
                    <p className="text-xs text-yellow-700">Cambios de cuota</p>
                    <p className="text-2xl font-bold text-yellow-800">{data.resumen.modificaciones}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {data.resumen.total === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No hay novedades para <b>{deductoraName}</b> en el período seleccionado.
            </p>
          )}

          {data.inclusiones.length > 0 && (
            <NovedadSection title="Inclusiones — Nuevos en planilla" items={data.inclusiones} color="green" />
          )}
          {data.exclusiones.length > 0 && (
            <NovedadSection title="Exclusiones — Retirar de planilla" items={data.exclusiones} color="red" />
          )}
          {data.modificaciones.length > 0 && (
            <NovedadSection title="Modificaciones de cuota" items={data.modificaciones} color="yellow" />
          )}
        </>
      )}
    </div>
  );
}

function NovedadSection({ title, items, color }: { title: string; items: NovItem[]; color: 'green' | 'red' | 'yellow' }) {
  const borderColor = { green: 'border-green-200', red: 'border-red-200', yellow: 'border-yellow-200' }[color];
  const bgColor = { green: 'bg-green-50', red: 'bg-red-50', yellow: 'bg-yellow-50' }[color];
  const textColor = { green: 'text-green-800', red: 'text-red-800', yellow: 'text-yellow-800' }[color];

  return (
    <Card className={`${borderColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm ${textColor}`}>{title} ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className={bgColor}>
              <TableHead>Referencia</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cédula</TableHead>
              <TableHead>Detalle</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={`${item.tipo}-${item.id}`}>
                <TableCell className="font-mono text-xs">{item.referencia}</TableCell>
                <TableCell className="text-sm">{item.cliente}</TableCell>
                <TableCell className="text-xs">{item.cedula}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{item.detalle}</TableCell>
                <TableCell className="text-xs">{item.fecha ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── TAB 5: Cobros ───────────────────────────────────────────────────────────

const SOURCES = ['Ventanilla', 'Planilla', 'Transferencia', 'SINPE', 'Otro'];

function CobrosTab({ deductoras }: { deductoras: Deductora[] }) {
  const [desde, setDesde] = useState(FIRST_OF_MONTH);
  const [hasta, setHasta] = useState(TODAY);
  const [source, setSource] = useState('all');
  const [deductoraId, setDeductoraId] = useState('all');
  const [data, setData] = useState<{ data: CobroRow[]; totales: Record<string, number>; por_fecha: Record<string, number>; por_fuente: Record<string, { count: number; total: number }> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingXls, setLoadingXls] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    setError('');
    setSearch('');
    setPage(1);
    try {
      const p = new URLSearchParams({ desde, hasta });
      if (source !== 'all') p.set('source', source);
      if (deductoraId !== 'all') p.set('deductora_id', deductoraId);
      const r = await api.get('/api/reportes/cobros?' + p.toString());
      setData(r.data);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al cargar cobros.');
    } finally { setLoading(false); }
  }, [desde, hasta, source, deductoraId]);

  useEffect(() => { fetch(); }, [fetch]);

  const filteredCobros = data ? data.data.filter(r =>
    !search || [r.cliente, r.cedula, r.referencia].join(' ').toLowerCase().includes(search.toLowerCase())
  ) : [];

  const areaData = data ? Object.entries(data.por_fecha).map(([fecha, monto]) => ({ fecha: fecha.substring(5), monto })) : [];
  const areaConfig = { monto: { label: 'Cobrado', color: 'hsl(var(--chart-1))' } };

  const buildParams = () => {
    const p = new URLSearchParams({ desde, hasta });
    if (source !== 'all') p.set('source', source);
    if (deductoraId !== 'all') p.set('deductora_id', deductoraId);
    return p.toString();
  };

  const doExcel = async () => { setLoadingXls(true); await downloadExport('/api/reportes/cobros/excel?' + buildParams(), 'cobros.xlsx'); setLoadingXls(false); };
  const doPdf  = async () => { setLoadingPdf(true);  await downloadExport('/api/reportes/cobros/pdf?' + buildParams(),   'cobros.pdf');  setLoadingPdf(false); };

  return (
    <div className="space-y-4 mt-2">
      <FilterRow>
        <FilterField label="Desde">
          <Input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="w-[145px]" />
        </FilterField>
        <FilterField label="Hasta">
          <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="w-[145px]" />
        </FilterField>
        <FilterField label="Fuente">
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Deductora">
          <Select value={deductoraId} onValueChange={setDeductoraId}>
            <SelectTrigger className="w-[170px]"><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {deductoras.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Buscar">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cliente, cédula, ref…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-7 w-[200px] h-8 text-sm"
            />
          </div>
        </FilterField>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
        <ExportButtons onExcel={doExcel} onPdf={doPdf} loadingExcel={loadingXls} loadingPdf={loadingPdf} />
      </FilterRow>

      {loading && !data && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando cobros…
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/30 rounded-lg bg-destructive/5">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Total pagos" value={String(data.totales.pagos)} />
            <SummaryCard label="Monto recaudado" value={fmt(data.totales.monto_total)} />
            <SummaryCard label="Amortización" value={fmt(data.totales.amortizacion)} />
            <SummaryCard label="Intereses" value={fmt(data.totales.interes_total)} />
          </div>

          {areaData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Cobros en el Período</CardTitle></CardHeader>
              <CardContent>
                <ChartContainer config={areaConfig} className="h-[200px]">
                  <AreaChart data={areaData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={v => '₡' + (v / 1e6).toFixed(1) + 'M'} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(v) => fmt(Number(v))} />} />
                    <Area dataKey="monto" fill="var(--color-monto)" stroke="var(--color-monto)" fillOpacity={0.2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {data.por_fuente && Object.keys(data.por_fuente).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribución por Fuente de Cobro</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 items-center">
                  <div className="flex justify-center">
                    <PieChart width={260} height={200}>
                      <Pie
                        data={Object.entries(data.por_fuente).map(([name, v]) => ({ name, value: v.total, count: v.count }))}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine fontSize={10}
                      >
                        {Object.keys(data.por_fuente).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(Number(v))} />
                    </PieChart>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(data.por_fuente).map(([name, v], i) => (
                      <div key={name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full inline-block flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span>{name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-xs">{fmt(v.total)}</span>
                          <span className="text-muted-foreground text-xs ml-2">({v.count} pagos)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Detalle — {search ? `${filteredCobros.length} de ${data.data.length}` : data.data.length} pagos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollableTableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Deductora</TableHead>
                      <TableHead className="text-center">Cuota #</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Amort.</TableHead>
                      <TableHead className="text-right">Interés</TableHead>
                      <TableHead className="text-right">Mora</TableHead>
                      <TableHead>Fuente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Cargando…</TableCell></TableRow>
                    ) : filteredCobros.length === 0 ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">{search ? 'Sin resultados para la búsqueda' : 'Sin cobros en el período'}</TableCell></TableRow>
                    ) : filteredCobros.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE).map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{r.fecha_pago}</TableCell>
                        <TableCell className="font-mono text-xs">{r.referencia}</TableCell>
                        <TableCell className="text-sm">{r.cliente}</TableCell>
                        <TableCell className="text-xs">{r.cedula}</TableCell>
                        <TableCell className="text-xs">{r.deductora}</TableCell>
                        <TableCell className="text-center text-xs">{r.numero_cuota}</TableCell>
                        <TableCell className="text-right text-xs font-medium">{fmt(r.monto)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.amortizacion)}</TableCell>
                        <TableCell className="text-right text-xs">{fmt(r.interes_corriente)}</TableCell>
                        <TableCell className="text-right text-xs">{r.interes_moratorio > 0 ? fmt(r.interes_moratorio) : '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{r.source}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
              <TablePagination page={page} total={filteredCobros.length} onChange={setPage} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

