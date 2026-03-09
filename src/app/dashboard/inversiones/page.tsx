'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { MoreHorizontal, PlusCircle, FileText, FileSpreadsheet, Loader2, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, Landmark, Search, Clock, RefreshCw, XCircle, Eye, CheckCircle2, Trash2, DollarSign } from 'lucide-react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ProtectedPage } from "@/components/ProtectedPage";
import { useAuth } from '@/components/auth-guard';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import api from '@/lib/axios';
import { toastSuccess, toastError } from '@/hooks/use-toast';
import type { Investor, Investment, InvestmentPayment, User } from '@/lib/data';
import { InvestmentFormDialog } from '@/components/investment-form-dialog';
import { InvestorFormDialog } from '@/components/investor-form-dialog';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/api\/?$/, '');

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
  const isActive = investment.estado === 'Activa';
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
      <TableCell><Badge variant={investment.estado === 'Activa' ? 'default' : investment.estado === 'Cancelada' ? 'destructive' : 'secondary'}>{investment.estado}</Badge></TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem asChild><Link href={`/dashboard/inversiones/${investment.id}`}>Ver Detalles</Link></DropdownMenuItem>
            {isActive && (
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/inversiones/${investment.id}?action=renew`}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Renovar
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/pdf`, '_blank')}>Exportar PDF</DropdownMenuItem>
            {isActive && (
              <DropdownMenuItem asChild className="text-destructive">
                <Link href={`/dashboard/inversiones/${investment.id}?action=cancel`}>
                  <XCircle className="h-4 w-4 mr-2" /> Cancelar
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(investment.id)}>Eliminar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

// --- Tabla General ---
function TablaGeneralSection({ data }: { data: any }) {
  const [search, setSearch] = useState('');
  const [formaPagoFilter, setFormaPagoFilter] = useState('');

  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const filterInversiones = (inversiones: any[]) =>
    inversiones.filter((inv: any) => {
      if (search && !(inv.investor?.name ?? '').toLowerCase().includes(search.toLowerCase()) && !(inv.numero_desembolso ?? '').toLowerCase().includes(search.toLowerCase())) return false;
      if (formaPagoFilter && inv.forma_pago !== formaPagoFilter) return false;
      return true;
    });

  const renderSection = (title: string, section: any, currency: 'CRC' | 'USD') => {
    const filtered = filterInversiones(section.inversiones);
    return (
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
            <TableHead className="text-right">Retención</TableHead>
            <TableHead className="text-right">Int. Neto</TableHead>
            <TableHead>Forma Pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((inv: any) => (
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
            <TableCell className="text-right font-mono">{fmt(filtered.reduce((s: number, i: any) => s + Number(i.monto_capital), 0), currency)}</TableCell>
            <TableCell colSpan={4}></TableCell>
            <TableCell className="text-right font-mono">{fmt(filtered.reduce((s: number, i: any) => s + Number(i.interes_mensual), 0), currency)}</TableCell>
            <TableCell className="text-right font-mono">{fmt(filtered.reduce((s: number, i: any) => s + Number(i.retencion_mensual), 0), currency)}</TableCell>
            <TableCell className="text-right font-mono">{fmt(filtered.reduce((s: number, i: any) => s + Number(i.interes_neto_mensual), 0), currency)}</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      </div>
    </div>
    );
  };

  const allInversiones = [...(data.dolares?.inversiones ?? []), ...(data.colones?.inversiones ?? [])];
  const formasPago = [...new Set(allInversiones.map((i: any) => i.forma_pago).filter(Boolean))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar inversionista o desembolso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={formaPagoFilter} onValueChange={v => setFormaPagoFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Forma de Pago" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {formasPago.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {renderSection('DÓLARES (USD)', data.dolares, 'USD')}
      {renderSection('COLONES (CRC)', data.colones, 'CRC')}

      {/* Totales por moneda */}
      <Card className="border-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Totales Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Colones (CRC)</p>
              <div>
                <p className="text-xs text-muted-foreground">Capital</p>
                <p className="text-2xl font-mono font-bold text-primary">{fmt(data.colones?.total_capital ?? 0, 'CRC')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interés Neto Mensual</p>
                <p className="text-lg font-mono font-semibold">{fmt(data.colones?.total_neto ?? 0, 'CRC')}</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Dólares (USD)</p>
              <div>
                <p className="text-xs text-muted-foreground">Capital</p>
                <p className="text-2xl font-mono font-bold text-primary">{fmt(data.dolares?.total_capital ?? 0, 'USD')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interés Neto Mensual</p>
                <p className="text-lg font-mono font-semibold">{fmt(data.dolares?.total_neto ?? 0, 'USD')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Pagos Próximos ---
function PagosProximosSection({ data, onRefresh, onPaymentsChange }: { data: any; onRefresh: () => void; onPaymentsChange: () => void }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [paying, setPaying] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; coupon: any | null }>({ open: false, coupon: null });
  const [paymentForm, setPaymentForm] = useState({ fecha_pago: '', monto: '', tipo: 'Interés' as string, comentarios: '' });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [monthPages, setMonthPages] = useState<Record<string, number>>({});
  const CUPONES_PER_PAGE = 15;

  const openPaymentDialog = (coupon: any) => {
    const inv = coupon.investment;
    const today = new Date().toISOString().split('T')[0];
    setPaymentForm({
      fecha_pago: today,
      monto: String(coupon.interes_neto ?? 0),
      tipo: 'Interés',
      comentarios: `Pago cupón ${new Date(coupon.fecha_cupon).toLocaleDateString('es-CR')} - ${inv?.numero_desembolso ?? ''}`,
    });
    setPaymentDialog({ open: true, coupon });
  };

  const handleSubmitPayment = async () => {
    const coupon = paymentDialog.coupon;
    if (!coupon) return;
    const inv = coupon.investment;
    setSubmittingPayment(true);
    try {
      await api.post('/api/investment-payments', {
        investor_id: inv?.investor_id ?? inv?.investor?.id,
        investment_id: inv?.id,
        fecha_pago: paymentForm.fecha_pago,
        monto: Number(paymentForm.monto),
        tipo: paymentForm.tipo,
        moneda: inv?.moneda ?? 'CRC',
        comentarios: paymentForm.comentarios || null,
        registered_by: user?.id,
      });
      toastSuccess('Pago registrado correctamente.');
      setPaymentDialog({ open: false, coupon: null });
      onPaymentsChange();
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Error al registrar el pago.');
    } finally {
      setSubmittingPayment(false);
    }
  };

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

  const toggleCoupon = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleMonth = (cupones: any[]) => {
    const ids = cupones.map((c: any) => c.id);
    const allSelected = ids.every((id: number) => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      ids.forEach((id: number) => { if (allSelected) next.delete(id); else next.add(id); });
      return next;
    });
  };

  const selectAllOverdue = () => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const overdueIds = meses
      .filter((m: any) => m.mes < currentYM)
      .flatMap((m: any) => m.cupones.map((c: any) => c.id));
    setSelected(new Set(overdueIds));
  };

  const handleBulkPay = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Marcar ${selected.size} cupón(es) como pagado(s)?`)) return;
    setPaying(true);
    try {
      await api.patch('/api/investment-coupons/bulk-pay', { coupon_ids: Array.from(selected) });
      toastSuccess(`${selected.size} cupón(es) marcado(s) como pagado(s).`);
      setSelected(new Set());
      onRefresh();
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Error al marcar cupones como pagados.');
    } finally {
      setPaying(false);
    }
  };

  const handlePayMonth = async (cupones: any[]) => {
    const ids = cupones.map((c: any) => c.id);
    if (!confirm(`¿Marcar los ${ids.length} cupón(es) de este mes como pagado(s)?`)) return;
    setPaying(true);
    try {
      await api.patch('/api/investment-coupons/bulk-pay', { coupon_ids: ids });
      toastSuccess(`${ids.length} cupón(es) marcado(s) como pagado(s).`);
      setSelected(prev => {
        const next = new Set(prev);
        ids.forEach((id: number) => next.delete(id));
        return next;
      });
      onRefresh();
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Error al marcar cupones como pagados.');
    } finally {
      setPaying(false);
    }
  };

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar inversionista o desembolso..." value={search} onChange={e => { setSearch(e.target.value); setMonthPages({}); }} className="pl-8 h-9" />
        </div>
        <Button variant="outline" size="sm" onClick={selectAllOverdue} disabled={paying}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Seleccionar todos los atrasados
        </Button>
        {selected.size > 0 && (
          <>
            <span className="text-sm text-muted-foreground">{selected.size} seleccionado(s)</span>
            <Button size="sm" onClick={handleBulkPay} disabled={paying}>
              {paying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Marcar seleccionados como Pagado
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={paying}>
              <XCircle className="h-4 w-4 mr-1" /> Limpiar selección
            </Button>
          </>
        )}
      </div>

      {/* Monthly sections */}
      {meses.map((mes: any, idx: number) => {
        const now = new Date();
        const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const isOverdue = mes.mes < currentYM;
        const filteredCupones = search
          ? mes.cupones.filter((c: any) => {
              const inv = c.investment;
              return (inv?.investor?.name ?? '').toLowerCase().includes(search.toLowerCase()) || (inv?.numero_desembolso ?? '').toLowerCase().includes(search.toLowerCase());
            })
          : mes.cupones;
        if (search && filteredCupones.length === 0) return null;

        const monthIds = filteredCupones.map((c: any) => c.id);
        const allMonthSelected = monthIds.length > 0 && monthIds.every((id: number) => selected.has(id));
        const someMonthSelected = monthIds.some((id: number) => selected.has(id));

        // Pagination per month
        const currentPage = monthPages[mes.mes] || 1;
        const totalPages = Math.ceil(filteredCupones.length / CUPONES_PER_PAGE);
        const paginatedCupones = filteredCupones.slice((currentPage - 1) * CUPONES_PER_PAGE, currentPage * CUPONES_PER_PAGE);

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
            <div className="flex items-center gap-2 mt-2 mb-1 px-1">
              <Button variant="outline" size="sm" onClick={() => toggleMonth(filteredCupones)} disabled={paying}>
                {allMonthSelected ? 'Deseleccionar mes' : 'Seleccionar mes'}
              </Button>
              <Button size="sm" variant="default" onClick={() => handlePayMonth(filteredCupones)} disabled={paying}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Marcar mes como Pagado
              </Button>
              {someMonthSelected && (
                <span className="text-xs text-muted-foreground">{monthIds.filter((id: number) => selected.has(id)).length} de {monthIds.length} seleccionados</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allMonthSelected}
                        onCheckedChange={() => toggleMonth(filteredCupones)}
                        aria-label="Seleccionar todos"
                      />
                    </TableHead>
                    <TableHead>Desembolso</TableHead>
                    <TableHead>Inversionista</TableHead>
                    <TableHead className="text-right">Monto Capital</TableHead>
                    <TableHead>Periodicidad</TableHead>
                    <TableHead>Fecha Cupón</TableHead>
                    <TableHead className="text-right">Int. Bruto</TableHead>
                    <TableHead className="text-right">Retención</TableHead>
                    <TableHead className="text-right">Int. Neto</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCupones.map((c: any) => {
                    const inv = c.investment;
                    const moneda = inv?.moneda ?? 'CRC';
                    return (
                      <TableRow key={c.id} className={selected.has(c.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(c.id)}
                            onCheckedChange={() => toggleCoupon(c.id)}
                            aria-label={`Seleccionar cupón ${c.id}`}
                          />
                        </TableCell>
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
                        <TableCell className="text-center">
                          <Button variant="outline" size="sm" onClick={() => openPaymentDialog(c)}>
                            <DollarSign className="h-4 w-4 mr-1" /> Registrar Pago
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-3">
                <p className="text-sm text-muted-foreground">
                  Mostrando {(currentPage - 1) * CUPONES_PER_PAGE + 1}–{Math.min(currentPage * CUPONES_PER_PAGE, filteredCupones.length)} de {filteredCupones.length} cupones
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setMonthPages(prev => ({ ...prev, [mes.mes]: currentPage - 1 }))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setMonthPages(prev => ({ ...prev, [mes.mes]: currentPage + 1 }))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
        );
      })}

      {/* Payment Registration Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => { if (!open) setPaymentDialog({ open: false, coupon: null }); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {paymentDialog.coupon?.investment?.investor?.name ?? '—'} — {paymentDialog.coupon?.investment?.numero_desembolso ?? '—'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Fecha de Pago</Label>
              <Input
                type="date"
                className="col-span-3"
                value={paymentForm.fecha_pago}
                onChange={e => setPaymentForm(f => ({ ...f, fecha_pago: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Monto</Label>
              <Input
                type="number"
                step="0.01"
                className="col-span-3"
                value={paymentForm.monto}
                onChange={e => setPaymentForm(f => ({ ...f, monto: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Moneda</Label>
              <Input className="col-span-3" value={paymentDialog.coupon?.investment?.moneda ?? 'CRC'} disabled />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tipo</Label>
              <Select value={paymentForm.tipo} onValueChange={v => setPaymentForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Interés">Interés</SelectItem>
                  <SelectItem value="Capital">Capital</SelectItem>
                  <SelectItem value="Adelanto">Adelanto</SelectItem>
                  <SelectItem value="Liquidación">Liquidación</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Comentarios</Label>
              <Textarea
                className="col-span-3"
                rows={2}
                value={paymentForm.comentarios}
                onChange={e => setPaymentForm(f => ({ ...f, comentarios: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, coupon: null })} disabled={submittingPayment}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitPayment} disabled={submittingPayment || !paymentForm.fecha_pago || !paymentForm.monto}>
              {submittingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <DollarSign className="h-4 w-4 mr-1" />}
              Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Reservas de Capital ---
function ReservasSection({ data }: { data: any }) {
  const [search, setSearch] = useState('');

  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const inversores: any[] = (data.inversores ?? []).filter((inv: any) =>
    !search || inv.investor.name.toLowerCase().includes(search.toLowerCase())
  );
  const gt = data.gran_total;

  if (inversores.length === 0) {
    return <p className="text-center text-muted-foreground py-8">No hay inversiones activas para calcular reservas.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar inversionista..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
      </div>

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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reserva Capital CRC</CardDescription>
            <CardTitle className="text-2xl font-mono">{fmt(gt.crc.reserva_capital, 'CRC')}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reserva Capital USD</CardDescription>
            <CardTitle className="text-2xl font-mono">{fmt(gt.usd.reserva_capital, 'USD')}</CardTitle>
          </CardHeader>
        </Card>
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

// --- Vencimientos ---
function VencimientosSection({ data }: { data: any }) {
  const [search, setSearch] = useState('');

  if (!data) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const filterVenc = (items: any[]) => items.filter((inv: any) =>
    !search || (inv.investor?.name ?? '').toLowerCase().includes(search.toLowerCase()) || (inv.numero_desembolso ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const sections = [
    { key: 'vencidas', label: 'Vencidas', icon: AlertTriangle, color: 'bg-destructive text-destructive-foreground', data: filterVenc(data.vencidas ?? []) },
    { key: '0_30', label: 'Vencen en 0–30 días', icon: Clock, color: 'bg-orange-500 text-white', data: filterVenc(data['0_30'] ?? []) },
    { key: '31_60', label: 'Vencen en 31–60 días', icon: Clock, color: 'bg-yellow-500 text-white', data: filterVenc(data['31_60'] ?? []) },
    { key: '61_90', label: 'Vencen en 61–90 días', icon: CalendarClock, color: 'bg-primary text-primary-foreground', data: filterVenc(data['61_90'] ?? []) },
  ];

  const totalCount = data.total ?? 0;

  if (totalCount === 0) {
    return <p className="text-center text-muted-foreground py-8">No hay inversiones próximas a vencer en los próximos 90 días.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar inversionista o desembolso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sections.map(s => (
          <Card key={s.key}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-2xl">{s.data.length}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {sections.map(s => {
        if (s.data.length === 0) return null;
        const Icon = s.icon;
        return (
          <Collapsible key={s.key} defaultOpen={s.key === 'vencidas' || s.key === '0_30'}>
            <CollapsibleTrigger asChild>
              <button className={`w-full text-lg font-semibold px-3 py-2 rounded flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity ${s.color}`}>
                <Icon className="h-5 w-5 shrink-0" />
                {s.label}
                <span className="ml-auto text-sm font-normal opacity-80 flex items-center gap-2">
                  {s.data.length} inversiones
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
                      <TableHead className="text-center">Tasa</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead className="text-center">Plazo</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.data.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <Link href={`/dashboard/inversiones/${inv.id}`} className="font-medium hover:underline">{inv.numero_desembolso}</Link>
                        </TableCell>
                        <TableCell>{inv.investor?.name ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(inv.monto_capital, inv.moneda)}</TableCell>
                        <TableCell className="text-center font-mono">{(Number(inv.tasa_anual) * 100).toFixed(2)}%</TableCell>
                        <TableCell>{new Date(inv.fecha_vencimiento).toLocaleDateString('es-CR')}</TableCell>
                        <TableCell className="text-center">{inv.plazo_meses}m</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/inversiones/${inv.id}`}><Eye className="h-4 w-4 mr-1" /> Ver</Link>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/dashboard/inversiones/${inv.id}?action=renew`}><RefreshCw className="h-4 w-4 mr-1" /> Renovar</Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
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
  const [vencimientos, setVencimientos] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [showInvestorForm, setShowInvestorForm] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [investorSearch, setInvestorSearch] = useState('');
  const [filters, setFilters] = useState({ investor_id: '', moneda: '', estado: '' });
  const [pagosSearch, setPagosSearch] = useState('');
  const [pagosMoneda, setPagosMoneda] = useState('');
  const [pagosTipo, setPagosTipo] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ investor_id: '', investment_id: '', fecha_pago: new Date().toISOString().split('T')[0], monto: '', tipo: 'Interés', moneda: 'CRC', comentarios: '', registered_by: '' });
  const [savingPayment, setSavingPayment] = useState(false);
  const [retencionesMoneda, setRetencionesMoneda] = useState('');
  const [pagadas, setPagadas] = useState<Investment[]>([]);
  const [pagadasLoading, setPagadasLoading] = useState(false);
  const [pagadasMoneda, setPagadasMoneda] = useState('');
  const [tipoCambio, setTipoCambio] = useState<{ compra: number | null; venta: number | null; fecha: string | null; fuente: string } | null>(null);
  const [refreshingTC, setRefreshingTC] = useState(false);

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
      // Users requiere middleware admin — cargar por separado para no bloquear datos principales
      try {
        const usersRes = await api.get('/api/users?all=true');
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.data ?? []);
      } catch { /* usuario sin acceso admin — lista de usuarios vacía */ }
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

  const fetchVencimientos = useCallback(async () => {
    try {
      const res = await api.get('/api/investments/vencimientos');
      setVencimientos(res.data);
    } catch (err) {
      console.error('Error fetching vencimientos:', err);
    }
  }, []);

  const fetchPagadas = useCallback(async () => {
    setPagadasLoading(true);
    try {
      const res = await api.get('/api/investments/pagadas');
      setPagadas(res.data);
    } catch (err) {
      console.error('Error fetching pagadas:', err);
    } finally {
      setPagadasLoading(false);
    }
  }, []);

  const fetchTipoCambio = useCallback(async () => {
    try {
      const res = await api.get('/api/exchange-rates/current');
      setTipoCambio(res.data);
    } catch (err) {
      console.error('Error fetching tipo de cambio:', err);
    }
  }, []);

  const handleRefreshTC = async () => {
    setRefreshingTC(true);
    try {
      const res = await api.post('/api/exchange-rates/refresh');
      setTipoCambio(res.data);
      toastSuccess('Tipo de cambio actualizado desde BCCR.');
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'No se pudo actualizar el tipo de cambio.');
    } finally {
      setRefreshingTC(false);
    }
  };

  useEffect(() => { fetchData(); fetchTipoCambio(); }, [fetchData, fetchTipoCambio]);

  const handleDeleteInvestor = async (id: number) => {
    if (!confirm('¿Eliminar este inversionista y todas sus inversiones?')) return;
    try {
      await api.delete(`/api/investors/${id}`);
      toastSuccess('Inversionista eliminado correctamente.');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toastError(err?.response?.data?.message || 'Error al eliminar el inversionista.');
    }
  };

  const handleDeleteInvestment = async (id: number) => {
    if (!confirm('¿Eliminar esta inversión?')) return;
    try {
      await api.delete(`/api/investments/${id}`);
      toastSuccess('Inversión eliminada correctamente.');
      fetchData();
    } catch (err: any) {
      console.error(err);
      toastError(err?.response?.data?.message || 'Error al eliminar la inversión.');
    }
  };

  const handleCreatePayment = async () => {
    if (!paymentForm.investor_id || !paymentForm.monto || !paymentForm.registered_by) return;
    setSavingPayment(true);
    try {
      await api.post('/api/investment-payments', {
        investor_id: Number(paymentForm.investor_id),
        investment_id: paymentForm.investment_id ? Number(paymentForm.investment_id) : null,
        fecha_pago: paymentForm.fecha_pago,
        monto: Number(paymentForm.monto),
        tipo: paymentForm.tipo,
        moneda: paymentForm.moneda,
        comentarios: paymentForm.comentarios || null,
        registered_by: Number(paymentForm.registered_by),
      });
      toastSuccess('Pago registrado correctamente.');
      setShowPaymentForm(false);
      setPaymentForm({ investor_id: '', investment_id: '', fecha_pago: new Date().toISOString().split('T')[0], monto: '', tipo: 'Interés', moneda: 'CRC', comentarios: '', registered_by: '' });
      fetchData();
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Error al registrar el pago.');
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDeletePayment = async (id: number) => {
    if (!confirm('¿Eliminar este pago?')) return;
    try {
      await api.delete(`/api/investment-payments/${id}`);
      toastSuccess('Pago eliminado.');
      fetchData();
    } catch (err: any) {
      toastError(err?.response?.data?.message || 'Error al eliminar el pago.');
    }
  };

  const investorInvestments = paymentForm.investor_id
    ? investments.filter(inv => inv.investor_id === Number(paymentForm.investor_id))
    : [];

  const filteredInvestors = investors.filter(inv =>
    !investorSearch || inv.name.toLowerCase().includes(investorSearch.toLowerCase()) || inv.cedula?.toLowerCase().includes(investorSearch.toLowerCase())
  );

  const filteredPayments = payments.filter(p => {
    if (pagosSearch && !(p.investor?.name ?? '').toLowerCase().includes(pagosSearch.toLowerCase()) && !(p.investment?.numero_desembolso ?? '').toLowerCase().includes(pagosSearch.toLowerCase())) return false;
    if (pagosMoneda && p.moneda !== pagosMoneda) return false;
    if (pagosTipo && p.tipo !== pagosTipo) return false;
    return true;
  });

  const filteredRetenciones = investments.filter(inv => {
    if (inv.estado !== 'Activa') return false;
    if (retencionesMoneda && inv.moneda !== retencionesMoneda) return false;
    return true;
  });

  const filteredInvestments = investments.filter(inv => {
    if (filters.investor_id && inv.investor_id !== Number(filters.investor_id)) return false;
    if (filters.moneda && inv.moneda !== filters.moneda) return false;
    if (filters.estado && inv.estado !== filters.estado) return false;
    return true;
  });

  if (loading) {
    return (
      <ProtectedPage module="inversiones">
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </ProtectedPage>
    );
  }

  return (
    <ProtectedPage module="inversiones">
      {/* Tipo de Cambio */}
      {tipoCambio && (
        <Card className="mb-4 border-blue-200 bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-sm text-blue-800 dark:text-blue-300">Tipo de Cambio</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Venta BCCR:</span>{' '}
                  <span className="font-mono font-bold text-primary">₡{Number(tipoCambio.venta).toFixed(2)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {tipoCambio.fecha && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(tipoCambio.fecha + 'T12:00:00').toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {tipoCambio.fuente !== 'BCCR' && ` (${tipoCambio.fuente})`}
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={handleRefreshTC} disabled={refreshingTC} className="h-7 px-2">
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingTC ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={defaultTab} onValueChange={(v) => { setActiveTab(v); if (v === 'tabla-general') fetchTablaGeneral(); if (v === 'pagos-proximos') fetchPagosProximos(); if (v === 'reservas') fetchReservas(); if (v === 'vencimientos') fetchVencimientos(); if (v === 'pagadas') fetchPagadas(); }}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="inversionistas">Inversionistas</TabsTrigger>
            <TabsTrigger value="inversiones">Inversiones</TabsTrigger>
            <TabsTrigger value="tabla-general">Tabla General</TabsTrigger>
            <TabsTrigger value="pagos">Pagos</TabsTrigger>
            <TabsTrigger value="pagos-proximos">Pagos Próximos</TabsTrigger>
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="vencimientos">Vencimientos</TabsTrigger>
            <TabsTrigger value="retenciones">Retenciones</TabsTrigger>
            <TabsTrigger value="pagadas">Inversiones Pagadas</TabsTrigger>
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inversionistas</CardTitle>
                  <CardDescription>Gestiona los inversionistas de Credipep.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por nombre o cédula..." value={investorSearch} onChange={e => setInvestorSearch(e.target.value)} className="pl-8 h-9" />
                </div>
              </div>
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
                  <Button variant="outline" size="sm" disabled={recalculating} onClick={async () => {
                    if (!confirm('¿Recalcular los cupones de TODAS las inversiones? Esto regenerará todos los cupones.')) return;
                    setRecalculating(true);
                    try {
                      const res = await api.post('/api/investments/recalculate-all');
                      toastSuccess(res.data.message);
                      fetchData();
                    } catch (err: any) {
                      toastError(err?.response?.data?.message || 'Error al recalcular cupones.');
                    } finally {
                      setRecalculating(false);
                    }
                  }}>
                    {recalculating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                    Recalcular Cupones
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-pdf`, '_blank')}>
                    <FileText className="h-4 w-4 mr-1" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/export/tabla-general-excel`, '_blank')}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <Select value={filters.investor_id} onValueChange={v => setFilters(f => ({ ...f, investor_id: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Inversionista" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {investors.map(inv => <SelectItem key={inv.id} value={String(inv.id)}>{inv.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filters.moneda} onValueChange={v => setFilters(f => ({ ...f, moneda: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Moneda" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="CRC">CRC</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.estado} onValueChange={v => setFilters(f => ({ ...f, estado: v === 'all' ? '' : v }))}>
                  <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="Activa">Activa</SelectItem>
                    <SelectItem value="Finalizada">Finalizada</SelectItem>
                    <SelectItem value="Liquidada">Liquidada</SelectItem>
                    <SelectItem value="Cancelada">Cancelada</SelectItem>
                    <SelectItem value="Renovada">Renovada</SelectItem>
                  </SelectContent>
                </Select>
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
                    <TableHead className="text-right">Retención</TableHead>
                    <TableHead className="text-right">Int. Neto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestments.map(investment => (
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Pago a Inversionistas</CardTitle>
                  <CardDescription>Historial de pagos registrados.</CardDescription>
                </div>
                <Button size="sm" className="gap-1" onClick={() => setShowPaymentForm(true)}>
                  <PlusCircle className="h-4 w-4" /> Registrar Pago
                </Button>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar inversionista o inversión..." value={pagosSearch} onChange={e => setPagosSearch(e.target.value)} className="pl-8 h-9" />
                </div>
                <Select value={pagosMoneda} onValueChange={v => setPagosMoneda(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Moneda" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="CRC">CRC</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={pagosTipo} onValueChange={v => setPagosTipo(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {[...new Set(payments.map(p => p.tipo).filter(Boolean))].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                    <TableHead>Responsable</TableHead>
                    <TableHead>Comentarios</TableHead>
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(p => (
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
                      <TableCell>{p.registered_by_user?.name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.comentarios}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleDeletePayment(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredPayments.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin pagos registrados</TableCell></TableRow>
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
              <PagosProximosSection data={pagosProximos} onRefresh={fetchPagosProximos} onPaymentsChange={() => { fetchData(); fetchPagosProximos(); }} />
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

        {/* Vencimientos */}
        <TabsContent value="vencimientos">
          <Card>
            <CardHeader>
              <CardTitle>Vencimientos Próximos</CardTitle>
              <CardDescription>Inversiones activas que vencen en los próximos 90 días.</CardDescription>
            </CardHeader>
            <CardContent>
              <VencimientosSection data={vencimientos} />
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
              <div className="flex flex-wrap gap-3 pt-2">
                <Select value={retencionesMoneda} onValueChange={v => setRetencionesMoneda(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Moneda" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="CRC">CRC</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
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
                    <TableHead className="text-right">Retención Mensual</TableHead>
                    <TableHead className="text-right">Interés Neto Mensual</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRetenciones.map(inv => (
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

        {/* Inversiones Pagadas */}
        <TabsContent value="pagadas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Inversiones Pagadas</CardTitle>
                  <CardDescription>Inversiones que han sido canceladas totalmente (capital devuelto).</CardDescription>
                </div>
                <Select value={pagadasMoneda} onValueChange={v => setPagadasMoneda(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Moneda" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="CRC">CRC</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {pagadasLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>N° Desembolso</TableHead>
                        <TableHead>Inversionista</TableHead>
                        <TableHead className="text-right">Monto Capital</TableHead>
                        <TableHead>Moneda</TableHead>
                        <TableHead>Fecha Inicio</TableHead>
                        <TableHead>Fecha Pago Total</TableHead>
                        <TableHead>Tipo Cancelación</TableHead>
                        <TableHead><span className="sr-only">Acciones</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagadas.filter(p => !pagadasMoneda || p.moneda === pagadasMoneda).map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <Link href={`/dashboard/inversiones/${inv.id}`} className="font-medium hover:underline">{inv.numero_desembolso}</Link>
                          </TableCell>
                          <TableCell>{inv.investor?.name ?? '—'}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(inv.monto_capital, inv.moneda)}</TableCell>
                          <TableCell><Badge variant="outline">{inv.moneda}</Badge></TableCell>
                          <TableCell>{inv.fecha_inicio ? new Date(inv.fecha_inicio).toLocaleDateString('es-CR') : '—'}</TableCell>
                          <TableCell>{inv.fecha_pago_total ? new Date(inv.fecha_pago_total).toLocaleDateString('es-CR') : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={inv.tipo_cancelacion_total === 'con_intereses' ? 'default' : 'secondary'}>
                              {inv.tipo_cancelacion_total === 'con_intereses' ? 'Con intereses' : 'Sin intereses'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild><Link href={`/dashboard/inversiones/${inv.id}`}>Ver Detalle</Link></DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investments/${inv.id}/export/estado-cuenta?lang=es`, '_blank')}>Estado de Cuenta (ES)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investments/${inv.id}/export/estado-cuenta?lang=en`, '_blank')}>Account Statement (EN)</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {pagadas.filter(p => !pagadasMoneda || p.moneda === pagadasMoneda).length === 0 && (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay inversiones pagadas.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
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

      {/* Payment Registration Dialog */}
      <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>Registre un nuevo pago a un inversionista.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Inversionista *</Label>
              <Select value={paymentForm.investor_id} onValueChange={v => setPaymentForm(f => ({ ...f, investor_id: v, investment_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar inversionista" /></SelectTrigger>
                <SelectContent>
                  {investors.map(inv => <SelectItem key={inv.id} value={String(inv.id)}>{inv.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Inversión (opcional)</Label>
              <Select value={paymentForm.investment_id} onValueChange={v => setPaymentForm(f => ({ ...f, investment_id: v === 'none' ? '' : v }))} disabled={!paymentForm.investor_id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar inversión" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin inversión específica</SelectItem>
                  {investorInvestments.map(inv => <SelectItem key={inv.id} value={String(inv.id)}>{inv.numero_desembolso} — {fmt(inv.monto_capital, inv.moneda)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha de Pago *</Label>
                <Input type="date" value={paymentForm.fecha_pago} onChange={e => setPaymentForm(f => ({ ...f, fecha_pago: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Monto *</Label>
                <Input type="number" step="0.01" value={paymentForm.monto} onChange={e => setPaymentForm(f => ({ ...f, monto: e.target.value }))} className="font-mono" placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo *</Label>
                <Select value={paymentForm.tipo} onValueChange={v => setPaymentForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interés">Interés</SelectItem>
                    <SelectItem value="Capital">Capital</SelectItem>
                    <SelectItem value="Adelanto">Adelanto</SelectItem>
                    <SelectItem value="Liquidación">Liquidación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Moneda *</Label>
                <Select value={paymentForm.moneda} onValueChange={v => setPaymentForm(f => ({ ...f, moneda: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRC">CRC</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Responsable *</Label>
              <Select value={paymentForm.registered_by} onValueChange={v => setPaymentForm(f => ({ ...f, registered_by: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar responsable" /></SelectTrigger>
                <SelectContent>
                  {users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Comentarios</Label>
              <Textarea value={paymentForm.comentarios} onChange={e => setPaymentForm(f => ({ ...f, comentarios: e.target.value }))} rows={2} placeholder="Observaciones del pago..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentForm(false)}>Cancelar</Button>
            <Button onClick={handleCreatePayment} disabled={savingPayment || !paymentForm.investor_id || !paymentForm.monto || !paymentForm.registered_by}>
              {savingPayment ? 'Guardando...' : 'Registrar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedPage>
  );
}
