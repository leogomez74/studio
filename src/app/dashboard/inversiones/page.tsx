'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { MoreHorizontal, PlusCircle, FileText, FileSpreadsheet, Loader2, CalendarClock, ChevronDown, AlertTriangle, Landmark } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ProtectedPage } from "@/components/ProtectedPage";
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/axios';
import type { Investor, Investment, InvestmentPayment } from '@/lib/data';
import { InvestmentFormDialog } from '@/components/investment-form-dialog';
import { InvestorFormDialog } from '@/components/investor-form-dialog';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const fmt = (amount: number, currency: 'CRC' | 'USD') =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency }).format(amount);

// --- Inversionistas Table ---
const InvestorTableRow = React.memo(function InvestorTableRow({ investor, onDelete }: { investor: Investor; onDelete: (id: number) => void }) {
  return (
    <TableRow>
      <TableCell>
        <Link href={`/dashboard/inversiones/inversionista/${investor.id}`} className="flex items-center gap-3 hover:opacity-80">
          <Avatar className="h-9 w-9">
            <AvatarFallback>{investor.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="font-medium hover:underline">{investor.name}</div>
        </Link>
      </TableCell>
      <TableCell>{investor.cedula}</TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="text-sm text-muted-foreground">{investor.email}</div>
        <div className="text-sm text-muted-foreground">{investor.phone}</div>
      </TableCell>
      <TableCell className="hidden md:table-cell">{investor.tipo_persona}</TableCell>
      <TableCell>
        <Button variant="link" asChild>
          <Link href={`/dashboard/inversiones/inversionista/${investor.id}`}>
            <Badge variant="default">{investor.active_investments_count ?? 0}</Badge>
          </Link>
        </Button>
      </TableCell>
      <TableCell>
        <Badge variant={investor.status === 'Activo' ? 'default' : 'secondary'}>{investor.status}</Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href={`/dashboard/inversiones/inversionista/${investor.id}`}>Ver Inversiones</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investors/${investor.id}/export/pdf`, '_blank')}>Exportar PDF</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(investor.id)}>Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

// --- Inversiones Table ---
const InvestmentTableRow = React.memo(function InvestmentTableRow({ investment, onDelete }: { investment: Investment; onDelete: (id: number) => void }) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <Link href={`/dashboard/inversiones/${investment.id}`} className="font-medium hover:underline">
          {investment.investor?.name ?? '—'}
        </Link>
        <div className="text-sm text-muted-foreground">{investment.numero_desembolso}</div>
      </TableCell>
      <TableCell className="text-right font-mono">{fmt(investment.monto_capital, investment.moneda)}</TableCell>
      <TableCell className="text-center font-mono">{(Number(investment.tasa_anual) * 100).toFixed(2)}%</TableCell>
      <TableCell>{investment.forma_pago}</TableCell>
      <TableCell className="text-right font-mono">{fmt(investment.interes_del_cupon ?? 0, investment.moneda)}</TableCell>
      <TableCell className="text-right font-mono text-destructive">- {fmt(investment.retencion_del_cupon ?? 0, investment.moneda)}</TableCell>
      <TableCell className="text-right font-mono font-semibold text-primary">{fmt(investment.interes_neto_del_cupon ?? 0, investment.moneda)}</TableCell>
      <TableCell><Badge variant={investment.estado === 'Activa' ? 'default' : investment.estado === 'Finalizada' ? 'secondary' : 'outline'}>{investment.estado}</Badge></TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href={`/dashboard/inversiones/${investment.id}`}>Ver Detalles</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/pdf`, '_blank')}>Exportar PDF</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(investment.id)}>Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

// --- Tabla General ---
function TablaGeneralSection({ data }: { data: any }) {
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const renderSection = (title: string, section: any, currency: 'CRC' | 'USD') => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2 bg-primary text-primary-foreground px-3 py-1.5 rounded">{title}</h3>
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Desembolso</TableHead>
            <TableHead>Inversionista</TableHead>
            <TableHead className="text-right">Monto Capital</TableHead>
            <TableHead className="text-center">Plazo</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead className="text-center">Tasa</TableHead>
            <TableHead className="text-right">Int. Mensual</TableHead>
            <TableHead className="text-right">Retención 15%</TableHead>
            <TableHead className="text-right">Int. Neto</TableHead>
            <TableHead>Forma Pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {section.inversiones.map((inv: any) => (
            <TableRow key={inv.id}>
              <TableCell>
                <Link href={`/dashboard/inversiones/${inv.id}`} className="font-medium hover:underline">
                  {inv.numero_desembolso}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/dashboard/inversiones/${inv.id}`} className="hover:underline">
                  {inv.investor?.name ?? '—'}
                </Link>
              </TableCell>
              <TableCell className="text-right font-mono">{fmt(inv.monto_capital, currency)}</TableCell>
              <TableCell className="text-center">{inv.plazo_meses}m</TableCell>
              <TableCell>{new Date(inv.fecha_inicio).toLocaleDateString('es-CR')}</TableCell>
              <TableCell>{new Date(inv.fecha_vencimiento).toLocaleDateString('es-CR')}</TableCell>
              <TableCell className="text-center">{(Number(inv.tasa_anual) * 100).toFixed(2)}%</TableCell>
              <TableCell className="text-right font-mono">{fmt(inv.interes_mensual, currency)}</TableCell>
              <TableCell className="text-right font-mono">{fmt(inv.retencion_mensual, currency)}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{fmt(inv.interes_neto_mensual, currency)}</TableCell>
              <TableCell>{inv.forma_pago}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted font-bold">
            <TableCell colSpan={2}>TOTALES</TableCell>
            <TableCell className="text-right font-mono">{fmt(section.total_capital, currency)}</TableCell>
            <TableCell colSpan={4}></TableCell>
            <TableCell className="text-right font-mono">{fmt(section.total_interes_mensual, currency)}</TableCell>
            <TableCell className="text-right font-mono">{fmt(section.total_retencion, currency)}</TableCell>
            <TableCell className="text-right font-mono">{fmt(section.total_neto, currency)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {renderSection('DÓLARES (USD)', data.dolares, 'USD')}
      {renderSection('COLONES (CRC)', data.colones, 'CRC')}

      {/* Consolidado */}
      {data.consolidado_crc && (
        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Total Consolidado en Colones</CardTitle>
            <CardDescription>Tipo de cambio: ₡{data.tipo_cambio} por dólar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Capital Total</p>
                <p className="text-2xl font-mono font-bold text-primary">{fmt(data.consolidado_crc.total_capital, 'CRC')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interés Neto Mensual Total</p>
                <p className="text-2xl font-mono font-bold text-primary">{fmt(data.consolidado_crc.total_neto, 'CRC')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// --- Pagos Próximos ---
function PagosProximosSection({ data }: { data: any }) {
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const meses: any[] = data.meses ?? [];

  if (meses.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No hay pagos próximos pendientes.</p>;
  }

  // Global summary
  const globalCrc = { interes_bruto: 0, retencion: 0, interes_neto: 0, cantidad: 0 };
  const globalUsd = { interes_bruto: 0, retencion: 0, interes_neto: 0, cantidad: 0 };
  let totalInversiones = new Set<number>();

  meses.forEach((m: any) => {
    globalCrc.interes_neto += m.resumen.crc.interes_neto;
    globalCrc.cantidad += m.resumen.crc.cantidad;
    globalUsd.interes_neto += m.resumen.usd.interes_neto;
    globalUsd.cantidad += m.resumen.usd.cantidad;
    m.cupones.forEach((c: any) => { if (c.investment) totalInversiones.add(c.investment.id); });
  });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Pendiente CRC</CardDescription>
            <CardTitle className="text-2xl font-mono">{fmt(globalCrc.interes_neto, 'CRC')}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{globalCrc.cantidad} cupones</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Pendiente USD</CardDescription>
            <CardTitle className="text-2xl font-mono">{fmt(globalUsd.interes_neto, 'USD')}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{globalUsd.cantidad} cupones</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inversiones con Pagos Pendientes</CardDescription>
            <CardTitle className="text-2xl">{totalInversiones.size}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{meses.length} meses con vencimientos</p></CardContent>
        </Card>
      </div>

      {/* Monthly sections */}
      {meses.map((mes: any, idx: number) => {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const isOverdue = mes.mes < currentYM;

        return (
        <Collapsible key={mes.mes} defaultOpen={idx === 0 || isOverdue}>
          <CollapsibleTrigger asChild>
            <button className={`w-full text-lg font-semibold px-3 py-2 rounded flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity ${isOverdue ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>
              {isOverdue ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CalendarClock className="h-5 w-5 shrink-0" />}
              {mes.label}
              {isOverdue && (
                <span className="flex items-center gap-1 bg-destructive-foreground/20 text-destructive-foreground px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                  <AlertTriangle className="h-3 w-3" /> Pago Atrasado
                </span>
              )}
              <span className="ml-auto text-sm font-normal opacity-80 flex items-center gap-3">
                {mes.resumen.crc.cantidad > 0 && <span className="font-mono">CRC: {fmt(mes.resumen.crc.interes_neto, 'CRC')}</span>}
                {mes.resumen.usd.cantidad > 0 && <span className="font-mono">USD: {fmt(mes.resumen.usd.interes_neto, 'USD')}</span>}
                <span>{mes.resumen.total_cupones} cupones — {mes.resumen.total_inversiones} inversiones</span>
                <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desembolso</TableHead>
                    <TableHead>Inversionista</TableHead>
                    <TableHead className="text-right">Monto Capital</TableHead>
                    <TableHead>Periodicidad</TableHead>
                    <TableHead>Fecha Cupón</TableHead>
                    <TableHead className="text-right">Int. Bruto</TableHead>
                    <TableHead className="text-right">Retención 15%</TableHead>
                    <TableHead className="text-right">Int. Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mes.cupones.map((c: any) => {
                    const inv = c.investment;
                    const moneda = inv?.moneda ?? 'CRC';
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          {inv ? (
                            <Link href={`/dashboard/inversiones/${inv.id}`} className="font-medium hover:underline">{inv.numero_desembolso}</Link>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {inv ? (
                            <Link href={`/dashboard/inversiones/${inv.id}`} className="hover:underline">{inv.investor?.name ?? '—'}</Link>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">{inv ? fmt(inv.monto_capital, moneda) : '—'}</TableCell>
                        <TableCell>{inv?.forma_pago ?? '—'}</TableCell>
                        <TableCell>{new Date(c.fecha_cupon).toLocaleDateString('es-CR')}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(c.interes_bruto, moneda)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">- {fmt(c.retencion, moneda)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary">{fmt(c.interes_neto, moneda)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
        );
      })}
    </div>
  );
}

// --- Reservas de Capital ---
function ReservasSection({ data }: { data: any }) {
  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const inversores: any[] = data.inversores ?? [];
  const gt = data.gran_total;

  if (inversores.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No hay inversiones activas para calcular reservas.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reserva Mensual CRC</CardDescription>
            <CardTitle className="text-2xl font-mono">{fmt(gt.crc.reserva_mensual, 'CRC')}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reserva Mensual USD</CardDescription>
            <CardTitle className="text-2xl font-mono">{fmt(gt.usd.reserva_mensual, 'USD')}</CardTitle>
          </CardHeader>
        </Card>
        {data.consolidado_crc && (
          <Card className="border-primary">
            <CardHeader className="pb-2">
              <CardDescription>Consolidado Mensual (₡{data.tipo_cambio}/USD)</CardDescription>
              <CardTitle className="text-2xl font-mono text-primary">{fmt(data.consolidado_crc.reserva_mensual, 'CRC')}</CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>

      {/* Per-investor sections */}
      {inversores.map((inv: any) => (
        <Collapsible key={inv.investor.id} defaultOpen>
          <CollapsibleTrigger asChild>
            <button className="w-full text-lg font-semibold px-3 py-2 rounded flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity bg-primary text-primary-foreground">
              <Landmark className="h-5 w-5 shrink-0" />
              {inv.investor.name}
              <span className="ml-auto text-sm font-normal opacity-80 flex items-center gap-3">
                {inv.totales.crc.reserva_mensual > 0 && <span className="font-mono">CRC: {fmt(inv.totales.crc.reserva_mensual, 'CRC')}/mes</span>}
                {inv.totales.usd.reserva_mensual > 0 && <span className="font-mono">USD: {fmt(inv.totales.usd.reserva_mensual, 'USD')}/mes</span>}
                <span>{inv.inversiones.length} inversiones</span>
                <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desembolso</TableHead>
                    <TableHead className="text-right">Capital</TableHead>
                    <TableHead className="text-center">Tasa</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Int. Adeudados</TableHead>
                    <TableHead className="text-right">Cap + Int</TableHead>
                    <TableHead className="text-center">Plazo Rest.</TableHead>
                    <TableHead className="text-right">Reserva Mensual</TableHead>
                    <TableHead className="text-right">Reserva Capital</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inv.inversiones.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link href={`/dashboard/inversiones/${i.id}`} className="font-medium hover:underline">{i.numero_desembolso}</Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(i.monto_capital, i.moneda)}</TableCell>
                      <TableCell className="text-center">{(Number(i.tasa_anual) * 100).toFixed(2)}%</TableCell>
                      <TableCell>{new Date(i.fecha_vencimiento).toLocaleDateString('es-CR')}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(i.reserva.intereses_adeudados, i.moneda)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(i.reserva.capital_mas_intereses, i.moneda)}</TableCell>
                      <TableCell className="text-center">{i.reserva.plazo_restante_meses}m</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">{fmt(i.reserva.reserva_mensual, i.moneda)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{fmt(i.reserva.reserva_capital, i.moneda)}</TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted font-bold">
                    <TableCell colSpan={7}>TOTALES</TableCell>
                    <TableCell className="text-right font-mono">
                      {inv.totales.crc.reserva_mensual > 0 && <div>{fmt(inv.totales.crc.reserva_mensual, 'CRC')}</div>}
                      {inv.totales.usd.reserva_mensual > 0 && <div>{fmt(inv.totales.usd.reserva_mensual, 'USD')}</div>}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {inv.totales.crc.reserva_capital > 0 && <div>{fmt(inv.totales.crc.reserva_capital, 'CRC')}</div>}
                      {inv.totales.usd.reserva_capital > 0 && <div>{fmt(inv.totales.usd.reserva_capital, 'USD')}</div>}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

// --- Main Page ---
export default function InversionesPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'inversionistas';

  const [investors, setInvestors] = useState<Investor[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [payments, setPayments] = useState<InvestmentPayment[]>([]);
  const [tablaGeneral, setTablaGeneral] = useState<any>(null);
  const [pagosProximos, setPagosProximos] = useState<any>(null);
  const [reservas, setReservas] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [showInvestorForm, setShowInvestorForm] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, investRes, payRes] = await Promise.all([
        api.get('/api/investors?all=true'),
        api.get('/api/investments?all=true'),
        api.get('/api/investment-payments?all=true'),
      ]);
      setInvestors(invRes.data);
      setInvestments(investRes.data);
      setPayments(payRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTablaGeneral = useCallback(async () => {
    try {
      const res = await api.get('/api/investments/tabla-general');
      setTablaGeneral(res.data);
    } catch (err) {
      console.error('Error fetching tabla general:', err);
    }
  }, []);

  const fetchPagosProximos = useCallback(async () => {
    try {
      const res = await api.get('/api/investments/pagos-proximos');
      setPagosProximos(res.data);
    } catch (err) {
      console.error('Error fetching pagos proximos:', err);
    }
  }, []);

  const fetchReservas = useCallback(async () => {
    try {
      const res = await api.get('/api/investments/reservas');
      setReservas(res.data);
    } catch (err) {
      console.error('Error fetching reservas:', err);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteInvestor = async (id: number) => {
    if (!confirm('¿Eliminar este inversionista y todas sus inversiones?')) return;
    try {
      await api.delete(`/api/investors/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteInvestment = async (id: number) => {
    if (!confirm('¿Eliminar esta inversión?')) return;
    try {
      await api.delete(`/api/investments/${id}`);
      fetchData();
    } catch (err) { console.error(err); }
  };

  const filteredInvestors = investors;

  if (loading) {
    return (
      <ProtectedPage module="inversiones">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage module="inversiones">
      <Tabs defaultValue={defaultTab} onValueChange={(v) => { setActiveTab(v); if (v === 'tabla-general') fetchTablaGeneral(); if (v === 'pagos-proximos') fetchPagosProximos(); if (v === 'reservas') fetchReservas(); }}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="inversionistas">Inversionistas</TabsTrigger>
            <TabsTrigger value="inversiones">Inversiones</TabsTrigger>
            <TabsTrigger value="tabla-general">Tabla General</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="pagos-proximos">Pagos Próximos</TabsTrigger>
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="retenciones">Retenciones</TabsTrigger>
          </TabsList>
          {activeTab === 'inversionistas' && (
            <Button size="sm" className="gap-1" onClick={() => setShowInvestorForm(true)}>
              <PlusCircle className="h-4 w-4" /> Nuevo Inversionista
            </Button>
          )}
          {activeTab === 'inversiones' && (
            <Button size="sm" className="gap-1" onClick={() => { setEditingInvestment(null); setShowForm(true); }}>
              <PlusCircle className="h-4 w-4" /> Nueva Inversión
            </Button>
          )}
        </div>

        {/* Inversionistas */}
        <TabsContent value="inversionistas">
          <Card>
            <CardHeader>
              <CardTitle>Inversionistas</CardTitle>
              <CardDescription>Gestiona los inversionistas de Credipep.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inversionista</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead className="hidden md:table-cell">Contacto</TableHead>
                    <TableHead className="hidden md:table-cell">Tipo</TableHead>
                    <TableHead>Inversiones Activas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestors.map(investor => (
                    <InvestorTableRow key={investor.id} investor={investor} onDelete={handleDeleteInvestor} />
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inversiones */}
        <TabsContent value="inversiones">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inversiones</CardTitle>
                  <CardDescription>Gestiona todas las inversiones de capital.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-pdf`, '_blank')}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-excel`, '_blank')}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inversionista</TableHead>
                    <TableHead className="text-right">Monto Capital</TableHead>
                    <TableHead className="text-center">Tasa</TableHead>
                    <TableHead>Forma Pago</TableHead>
                    <TableHead className="text-right">Int. Mensual</TableHead>
                    <TableHead className="text-right">Retención 15%</TableHead>
                    <TableHead className="text-right">Int. Neto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map(investment => (
                    <InvestmentTableRow key={investment.id} investment={investment} onDelete={handleDeleteInvestment} />
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tabla General */}
        <TabsContent value="tabla-general">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tabla General de Inversiones</CardTitle>
                  <CardDescription>Resumen agrupado por moneda con totales.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-pdf`, '_blank')}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-excel`, '_blank')}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TablaGeneralSection data={tablaGeneral} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pagos */}
        <TabsContent value="pagos">
          <Card>
            <CardHeader>
              <CardTitle>Pago a Inversionistas</CardTitle>
              <CardDescription>Historial de pagos registrados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inversión</TableHead>
                    <TableHead>Inversionista</TableHead>
                    <TableHead>Fecha de Pago</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Comentarios</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.investment_id ? (
                          <Link href={`/dashboard/inversiones/${p.investment_id}`} className="hover:underline">{p.investment?.numero_desembolso ?? '—'}</Link>
                        ) : '—'}
                      </TableCell>
                      <TableCell>
                        {p.investment_id ? (
                          <Link href={`/dashboard/inversiones/${p.investment_id}`} className="hover:underline">{p.investor?.name ?? '—'}</Link>
                        ) : (p.investor?.name ?? '—')}
                      </TableCell>
                      <TableCell>{new Date(p.fecha_pago).toLocaleDateString('es-CR')}</TableCell>
                      <TableCell><Badge variant="outline">{p.tipo}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{fmt(p.monto, p.moneda)}</TableCell>
                      <TableCell>{p.moneda}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.comentarios}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin pagos registrados</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pagos Próximos */}
        <TabsContent value="pagos-proximos">
          <Card>
            <CardHeader>
              <CardTitle>Pagos Próximos</CardTitle>
              <CardDescription>Cupones de interés pendientes agrupados por mes.</CardDescription>
            </CardHeader>
            <CardContent>
              <PagosProximosSection data={pagosProximos} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reservas de Capital */}
        <TabsContent value="reservas">
          <Card>
            <CardHeader>
              <CardTitle>Reservas de Capital</CardTitle>
              <CardDescription>Monto mensual a provisionar por inversión para cubrir capital + intereses futuros.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReservasSection data={reservas} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retenciones */}
        <TabsContent value="retenciones">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Reporte de Retenciones</CardTitle>
                  <CardDescription>Retenciones aplicadas a los cupones de intereses.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/retenciones-pdf`, '_blank')}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/retenciones-excel`, '_blank')}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Inversión</TableHead>
                    <TableHead className="text-right">Monto Invertido</TableHead>
                    <TableHead className="text-center">Tasa</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Periodicidad</TableHead>
                    <TableHead className="text-right">Retención Mensual (15%)</TableHead>
                    <TableHead className="text-right">Interés Neto Mensual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.filter(inv => inv.estado === 'Activa').map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <Link href={`/dashboard/inversiones/${inv.id}`} className="font-medium hover:underline">{inv.numero_desembolso}</Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(inv.monto_capital, inv.moneda)}</TableCell>
                      <TableCell className="text-center font-mono">{(Number(inv.tasa_anual) * 100).toFixed(2)}%</TableCell>
                      <TableCell>{inv.moneda}</TableCell>
                      <TableCell>{inv.forma_pago}</TableCell>
                      <TableCell className="text-right font-mono text-destructive">- {fmt(inv.retencion_mensual ?? 0, inv.moneda)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">{fmt(inv.interes_neto_mensual ?? 0, inv.moneda)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InvestmentFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        investment={editingInvestment}
        investors={investors}
        onSuccess={fetchData}
      />

      <InvestorFormDialog
        open={showInvestorForm}
        onOpenChange={setShowInvestorForm}
        onSuccess={fetchData}
      />
    </ProtectedPage>
  );
}
