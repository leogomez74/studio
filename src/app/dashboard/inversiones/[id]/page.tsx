'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, CheckCircle, XCircle, FileText, FileSpreadsheet, Loader2, Save, AlertTriangle, RefreshCw, Ban, History, Paperclip, Pencil, Calculator, Banknote } from 'lucide-react';
import { toastSuccess, toastError } from '@/hooks/use-toast';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import api from '@/lib/axios';
import type { Investment, InvestmentCoupon } from '@/lib/data';

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000').replace(/\/api\/?$/, '');

const fmt = (amount: number, currency: 'CRC' | 'USD') =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency }).format(amount);

export default function InvestmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [investment, setInvestment] = useState<Investment | null>(null);
  const [reserva, setReserva] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Renew modal
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewForm, setRenewForm] = useState({ plazo_meses: '', fecha_inicio: '', fecha_vencimiento: '', tasa_anual: '', monto_capital: '', forma_pago: '' });
  const [renewing, setRenewing] = useState(false);

  // Coupon pay modal
  const [payingCoupon, setPayingCoupon] = useState<InvestmentCoupon | null>(null);
  const [payDate, setPayDate] = useState('');
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payingLoading, setPayingLoading] = useState(false);

  // Correction modal
  const [correctingCoupon, setCorrectingCoupon] = useState<InvestmentCoupon | null>(null);
  const [correctAmount, setCorrectAmount] = useState('');
  const [correctMotivo, setCorrectMotivo] = useState('');
  const [correctingLoading, setCorrectingLoading] = useState(false);

  // Cancelacion total modal
  const [showCancelacionTotal, setShowCancelacionTotal] = useState(false);
  const [tipoCancelacion, setTipoCancelacion] = useState<'con_intereses' | 'sin_intereses'>('con_intereses');
  const [cancelacionLoading, setCancelacionLoading] = useState(false);
  const [showEstadoCuentaPrompt, setShowEstadoCuentaPrompt] = useState(false);

  // Interest calculator
  const [calcDesde, setCalcDesde] = useState('');
  const [calcHasta, setCalcHasta] = useState('');

  // Editable fields
  const [form, setForm] = useState({
    monto_capital: '', plazo_meses: '', fecha_inicio: '', fecha_vencimiento: '',
    tasa_anual: '', forma_pago: '', estado: '', es_capitalizable: false, notas: '',
  });

  const fetchInvestment = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/investments/${id}`);
      const inv = res.data;
      setInvestment(inv);
      try {
        const resReserva = await api.get(`/api/investments/${id}/reserva`);
        setReserva(resReserva.data);
      } catch { setReserva(null); }

      setForm({
        monto_capital: String(inv.monto_capital),
        plazo_meses: String(inv.plazo_meses),
        fecha_inicio: inv.fecha_inicio?.split('T')[0] ?? '',
        fecha_vencimiento: inv.fecha_vencimiento?.split('T')[0] ?? '',
        tasa_anual: String(Number(inv.tasa_anual) * 100),
        forma_pago: inv.forma_pago,
        estado: inv.estado,
        es_capitalizable: inv.es_capitalizable,
        notas: inv.notas || '',
      });
    } catch {
      setInvestment(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvestment(); }, [fetchInvestment]);

  const calcResult = useMemo(() => {
    if (!investment || !calcDesde || !calcHasta) return null;
    const desde = new Date(calcDesde + 'T00:00:00');
    const hasta = new Date(calcHasta + 'T00:00:00');
    const diffMs = hasta.getTime() - desde.getTime();
    if (diffMs <= 0) return null;
    const dias = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const tasaAnual = Number(investment.tasa_anual);
    const capital = Number(investment.monto_capital);
    // Convención Actual/Actual: usar 366 si el período incluye un 29 de febrero
    const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const incluyeBisiesto = (() => {
      for (let y = desde.getFullYear(); y <= hasta.getFullYear(); y++) {
        if (isLeapYear(y)) {
          const feb29 = new Date(y, 1, 29);
          if (feb29 >= desde && feb29 <= hasta) return true;
        }
      }
      return false;
    })();
    const diasEnAnio = incluyeBisiesto ? 366 : 365;
    const interesBruto = capital * tasaAnual * dias / diasEnAnio;
    const tasaRetencion = Number(investment.tasa_retencion) || 0;
    const retencion = interesBruto * tasaRetencion;
    const interesNeto = interesBruto - retencion;
    return {
      dias,
      diasEnAnio,
      incluyeBisiesto,
      interes_bruto: Math.round(interesBruto * 100) / 100,
      retencion: Math.round(retencion * 100) / 100,
      interes_neto: Math.round(interesNeto * 100) / 100,
    };
  }, [investment, calcDesde, calcHasta]);

  // Auto-open modal from query param (?action=renew or ?action=cancel)
  useEffect(() => {
    if (!investment || loading) return;
    const action = searchParams.get('action');
    if (action === 'renew' && investment.estado === 'Activa') {
      setShowRenewModal(true);
    } else if (action === 'cancel' && investment.estado === 'Activa') {
      setShowCancelModal(true);
    }
  }, [investment, loading, searchParams]);

  const handleSave = async () => {
    if (!investment) return;
    setSaving(true);
    try {
      await api.put(`/api/investments/${investment.id}`, {
        monto_capital: Number(form.monto_capital),
        plazo_meses: Number(form.plazo_meses),
        fecha_inicio: form.fecha_inicio,
        fecha_vencimiento: form.fecha_vencimiento,
        tasa_anual: Number(form.tasa_anual) / 100,
        forma_pago: form.forma_pago,
        estado: form.estado,
        es_capitalizable: form.es_capitalizable,
        notas: form.notas,
      });
      fetchInvestment();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handlePayCoupon = async () => {
    if (!payingCoupon) return;
    setPayingLoading(true);
    try {
      const formData = new FormData();
      if (payDate) formData.append('fecha_pago', payDate);
      if (payFile) formData.append('comprobante', payFile);
      await api.patch(`/api/investment-coupons/${payingCoupon.id}/pay`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPayingCoupon(null);
      setPayDate('');
      setPayFile(null);
      fetchInvestment();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al pagar cupón');
    } finally {
      setPayingLoading(false);
    }
  };

  const handleCorrectCoupon = async () => {
    if (!correctingCoupon || !correctAmount || !correctMotivo.trim()) return;
    setCorrectingLoading(true);
    try {
      await api.patch(`/api/investment-coupons/${correctingCoupon.id}/correct`, {
        monto_pagado_real: Number(correctAmount),
        motivo_correccion: correctMotivo,
      });
      setCorrectingCoupon(null);
      setCorrectAmount('');
      setCorrectMotivo('');
      fetchInvestment();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al corregir cupón');
    } finally {
      setCorrectingLoading(false);
    }
  };

  const handleLiquidate = async () => {
    if (!investment || !confirm('¿Liquidar anticipadamente esta inversión? Se marcarán todos los cupones pendientes como pagados.')) return;
    try {
      await api.post(`/api/investments/${investment.id}/liquidate`);
      fetchInvestment();
    } catch (err) { console.error(err); }
  };

  const handleCancel = async () => {
    if (!investment || !cancelMotivo.trim()) return;
    setCancelling(true);
    try {
      await api.post(`/api/investments/${investment.id}/cancel`, { motivo: cancelMotivo });
      setShowCancelModal(false);
      setCancelMotivo('');
      fetchInvestment();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al cancelar');
    } finally {
      setCancelling(false);
    }
  };

  const handleCancelacionTotal = async () => {
    if (!investment) return;
    setCancelacionLoading(true);
    try {
      await api.post(`/api/investments/${investment.id}/cancelacion-total`, { tipo: tipoCancelacion });
      setShowCancelacionTotal(false);
      toastSuccess('Abono realizado exitosamente.');
      setShowEstadoCuentaPrompt(true);
      fetchInvestment();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Error al procesar el abono');
    } finally {
      setCancelacionLoading(false);
    }
  };

  const openRenewModal = () => {
    if (!investment) return;
    setRenewForm({
      plazo_meses: String(investment.plazo_meses),
      fecha_inicio: investment.fecha_vencimiento?.split('T')[0] ?? '',
      fecha_vencimiento: '',
      tasa_anual: String(Number(investment.tasa_anual) * 100),
      monto_capital: String(investment.monto_capital),
      forma_pago: investment.forma_pago,
    });
    setShowRenewModal(true);
  };

  // Auto-calculate fecha_vencimiento for renew
  useEffect(() => {
    if (renewForm.fecha_inicio && renewForm.plazo_meses) {
      const start = new Date(renewForm.fecha_inicio + 'T00:00:00');
      start.setDate(1);
      start.setMonth(start.getMonth() + parseInt(renewForm.plazo_meses));
      setRenewForm(prev => ({ ...prev, fecha_vencimiento: start.toISOString().split('T')[0] }));
    }
  }, [renewForm.fecha_inicio, renewForm.plazo_meses]);

  const handleRenew = async () => {
    if (!investment) return;
    setRenewing(true);
    try {
      const res = await api.post(`/api/investments/${investment.id}/renew`, {
        plazo_meses: Number(renewForm.plazo_meses),
        fecha_inicio: renewForm.fecha_inicio,
        fecha_vencimiento: renewForm.fecha_vencimiento,
        tasa_anual: Number(renewForm.tasa_anual) / 100,
        monto_capital: Number(renewForm.monto_capital),
        forma_pago: renewForm.forma_pago,
      });
      setShowRenewModal(false);
      router.push(`/dashboard/inversiones/${res.data.id}`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al renovar');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!investment) {
    return (
      <div className="text-center py-12">
        <p className="text-lg">Inversión no encontrada</p>
        <Button asChild className="mt-4"><Link href="/dashboard/inversiones">Volver</Link></Button>
      </div>
    );
  }

  const coupons: InvestmentCoupon[] = investment.coupons || [];
  const rateHistory = investment.rate_history || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/inversiones"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold">Inversión: {investment.numero_desembolso}</h1>
          <Badge variant={investment.estado === 'Activa' ? 'default' : investment.estado === 'Cancelada' ? 'destructive' : 'secondary'}>
            {investment.estado}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/pdf`, '_blank')}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/excel`, '_blank')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-1" /> Estado de Cuenta
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/estado-cuenta?lang=es`, '_blank')}>
                Descargar en Español
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/estado-cuenta?lang=en`, '_blank')}>
                Download in English
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {investment.estado === 'Activa' && (
            <>
              <Button variant="outline" size="sm" onClick={openRenewModal}>
                <RefreshCw className="h-4 w-4 mr-1" /> Renovar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCancelacionTotal(true)}>
                <Banknote className="h-4 w-4 mr-1" /> Abono
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setShowCancelModal(true)}>
                <Ban className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button variant="destructive" size="sm" onClick={handleLiquidate}>Liquidar</Button>
            </>
          )}
        </div>
      </div>

      {/* Editable Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{investment.investor?.name ?? '—'}</CardTitle>
              <CardDescription>Cédula: {investment.investor?.cedula ?? '—'}</CardDescription>
            </div>
            {investment.estado === 'Activa' && (
              <Button onClick={handleSave} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-1" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1">
            <Label>Monto Capital</Label>
            <Input type="number" step="0.01" value={form.monto_capital} onChange={e => setForm(f => ({ ...f, monto_capital: e.target.value }))} className="font-mono" disabled={investment.estado !== 'Activa'} />
          </div>
          <div className="grid gap-1">
            <Label>Tasa Anual (%)</Label>
            <Input type="number" step="0.01" value={form.tasa_anual} onChange={e => setForm(f => ({ ...f, tasa_anual: e.target.value }))} className="font-mono" disabled={investment.estado !== 'Activa'} />
          </div>
          <div className="grid gap-1">
            <Label>Plazo (meses)</Label>
            <Input type="number" value={form.plazo_meses} onChange={e => setForm(f => ({ ...f, plazo_meses: e.target.value }))} disabled={investment.estado !== 'Activa'} />
          </div>
          <div className="grid gap-1">
            <Label>Forma de Pago</Label>
            <Select value={form.forma_pago} onValueChange={v => setForm(f => ({ ...f, forma_pago: v }))} disabled={investment.estado !== 'Activa'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MENSUAL">Mensual</SelectItem>
                <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                <SelectItem value="ANUAL">Anual</SelectItem>
                <SelectItem value="RESERVA">Reserva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Fecha Inicio</Label>
            <Input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} disabled={investment.estado !== 'Activa'} />
          </div>
          <div className="grid gap-1">
            <Label>Fecha Vencimiento</Label>
            <Input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} disabled={investment.estado !== 'Activa'} />
          </div>
          <div className="grid gap-1">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))} disabled={investment.estado !== 'Activa'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activa">Activa</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Liquidada">Liquidada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
                <SelectItem value="Renovada">Renovada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1 items-end">
            <div className="flex items-center gap-2">
              <Switch checked={form.es_capitalizable} onCheckedChange={v => setForm(f => ({ ...f, es_capitalizable: v }))} disabled={investment.estado !== 'Activa'} />
              <Label>Capitalizable</Label>
            </div>
          </div>
        </CardContent>
        <CardContent>
          <Label>Notas</Label>
          <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={3} className="mt-1" disabled={investment.estado !== 'Activa'} />
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Monto Capital</p>
            <p className="text-xl font-mono font-bold text-primary">{fmt(investment.monto_capital, investment.moneda)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Interés Mensual</p>
            <p className="text-xl font-mono font-bold">{fmt(investment.interes_mensual ?? 0, investment.moneda)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Retención {((Number(investment.tasa_retencion) || 0.15) * 100).toFixed(0)}%</p>
            <p className="text-xl font-mono font-bold text-destructive">- {fmt(investment.retencion_mensual ?? 0, investment.moneda)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Interés Neto</p>
            <p className="text-xl font-mono font-bold text-primary">{fmt(investment.interes_neto_mensual ?? 0, investment.moneda)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Interest Calculator */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Calculadora de Interés por Días
          </CardTitle>
          <CardDescription>Seleccione un rango de fechas para calcular el interés bruto proporcional.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
            <div className="grid gap-1">
              <Label>Fecha Desde</Label>
              <Input type="date" value={calcDesde} onChange={e => setCalcDesde(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label>Fecha Hasta</Label>
              <Input type="date" value={calcHasta} onChange={e => setCalcHasta(e.target.value)} />
            </div>
            {calcResult && (
              <>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Días</p>
                  <p className="text-2xl font-bold">{calcResult.dias}</p>
                  <p className="text-xs text-muted-foreground">base {calcResult.diasEnAnio}{calcResult.incluyeBisiesto ? ' (bisiesto)' : ''}</p>
                </div>
                <div />
              </>
            )}
          </div>
          {calcResult && (
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Interés Bruto</p>
                <p className="text-xl font-mono font-bold">{fmt(calcResult.interes_bruto, investment.moneda)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Retención {((Number(investment.tasa_retencion) || 0) * 100).toFixed(0)}%</p>
                <p className="text-xl font-mono font-bold text-destructive">- {fmt(calcResult.retencion, investment.moneda)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interés Neto</p>
                <p className="text-xl font-mono font-bold text-primary">{fmt(calcResult.interes_neto, investment.moneda)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reserve Calculation */}
      {reserva && investment.estado === 'Activa' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cálculo de Reserva</CardTitle>
            <CardDescription>Provisión mensual requerida para esta inversión.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Int. Adeudados</p>
                <p className="text-lg font-mono font-semibold">{fmt(reserva.intereses_adeudados, investment.moneda)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Capital + Intereses</p>
                <p className="text-lg font-mono font-semibold">{fmt(reserva.capital_mas_intereses, investment.moneda)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plazo Restante</p>
                <p className="text-lg font-semibold">{reserva.plazo_restante_meses} meses</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reserva Mensual</p>
                <p className="text-lg font-mono font-bold text-primary">{fmt(reserva.reserva_mensual, investment.moneda)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reserva Capital</p>
                <p className="text-lg font-mono font-bold">{fmt(reserva.reserva_capital, investment.moneda)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Summary */}
      {(() => {
        const paidCoupons = coupons.filter(c => c.estado === 'Pagado');
        const totalIntereses = paidCoupons.reduce((sum, c) => sum + (c.monto_pagado_real != null ? Number(c.monto_pagado_real) : Number(c.interes_neto)), 0);
        const capitalPayments = (investment.payments || []).filter(p => p.tipo === 'Capital' || p.tipo === 'Liquidación');
        const totalCapital = capitalPayments.reduce((sum, p) => sum + Number(p.monto), 0);
        const totalGeneral = totalIntereses + totalCapital;

        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen de Pagos</CardTitle>
              <CardDescription>Totales abonados a la fecha.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cupones Pagados</p>
                  <p className="text-lg font-mono font-semibold">{paidCoupons.length} de {coupons.length}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Intereses Pagados</p>
                  <p className="text-lg font-mono font-bold text-primary">{fmt(totalIntereses, investment.moneda)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Abonado a Capital</p>
                  <p className="text-lg font-mono font-bold text-primary">{fmt(totalCapital, investment.moneda)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total General</p>
                  <p className="text-lg font-mono font-bold text-primary">{fmt(totalGeneral, investment.moneda)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cupones de Intereses ({coupons.length})</CardTitle>
          <CardDescription>Cronograma de pagos de intereses para esta inversión.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Fecha Cupón</TableHead>
                  <TableHead className="text-right">Interés Bruto</TableHead>
                  <TableHead className="text-right">Retención {((Number(investment.tasa_retencion) || 0.15) * 100).toFixed(0)}%</TableHead>
                  <TableHead className="text-right">Interés Neto</TableHead>
                  <TableHead className="text-right">Monto Pagado</TableHead>
                  {investment.es_capitalizable && <TableHead className="text-right">Capital Acumulado</TableHead>}
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Pago</TableHead>
                  <TableHead><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const sorted = [...coupons].sort((a, b) => a.fecha_cupon.localeCompare(b.fecha_cupon));
                  return sorted.map((coupon, i) => {
                    const hasPriorUnpaid = sorted.slice(0, i).some(c => c.estado === 'Pendiente');
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            {new Date(coupon.fecha_cupon).toLocaleDateString('es-CR')}
                            {coupon.estado === 'Pendiente' && new Date(coupon.fecha_cupon) < new Date() && (
                              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" title="Cupón atrasado" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(coupon.interes_bruto, investment.moneda)}</TableCell>
                        <TableCell className="text-right font-mono text-destructive">- {fmt(coupon.retencion, investment.moneda)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{fmt(coupon.interes_neto, investment.moneda)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {coupon.estado === 'Pagado' ? (
                            <span className={coupon.monto_pagado_real != null && Number(coupon.monto_pagado_real) !== Number(coupon.interes_neto) ? 'text-amber-600 font-semibold' : ''}>
                              {fmt(coupon.monto_pagado_real != null ? Number(coupon.monto_pagado_real) : Number(coupon.interes_neto), investment.moneda)}
                              {coupon.motivo_correccion && (
                                <span className="block text-xs text-muted-foreground truncate max-w-[120px]" title={coupon.motivo_correccion}>
                                  {coupon.motivo_correccion}
                                </span>
                              )}
                            </span>
                          ) : '—'}
                        </TableCell>
                        {investment.es_capitalizable && (
                          <TableCell className="text-right font-mono text-primary">{coupon.capital_acumulado ? fmt(coupon.capital_acumulado, investment.moneda) : '—'}</TableCell>
                        )}
                        <TableCell>
                          <span className="flex items-center gap-1">
                            <Badge variant={coupon.estado === 'Pagado' ? 'default' : coupon.estado === 'Reservado' ? 'secondary' : 'outline'}>
                              {coupon.estado}
                            </Badge>
                            {coupon.comprobante && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" title="Tiene comprobante" />}
                          </span>
                        </TableCell>
                        <TableCell>{coupon.fecha_pago ? new Date(coupon.fecha_pago).toLocaleDateString('es-CR') : '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {coupon.estado === 'Pendiente' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={hasPriorUnpaid}
                                title={hasPriorUnpaid ? 'Debe pagar los cupones anteriores primero' : undefined}
                                onClick={() => { setPayingCoupon(coupon); setPayDate(new Date().toISOString().split('T')[0]); setPayFile(null); }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" /> Pagar
                              </Button>
                            )}
                            {coupon.estado === 'Pagado' && investment.estado === 'Activa' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600 border-amber-300 hover:bg-amber-50"
                                onClick={() => {
                                  setCorrectingCoupon(coupon);
                                  setCorrectAmount(String(coupon.monto_pagado_real ?? coupon.interes_neto));
                                  setCorrectMotivo(coupon.motivo_correccion ?? '');
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-1" /> Corregir
                              </Button>
                            )}
                            {coupon.comprobante && (
                              <Button size="sm" variant="ghost" onClick={() => window.open(`${API_BASE}/storage/${coupon.comprobante}`, '_blank')}>
                                <Paperclip className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
                {coupons.length === 0 && (
                  <TableRow><TableCell colSpan={investment.es_capitalizable ? 10 : 9} className="text-center text-muted-foreground py-8">Sin cupones generados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rate History */}
      {rateHistory.length > 0 && (
        <Collapsible>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4" /> Historial de Cambios de Tasa ({rateHistory.length})
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Tasa Anterior</TableHead>
                      <TableHead className="text-right">Tasa Nueva</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateHistory.map((rh: any) => (
                      <TableRow key={rh.id}>
                        <TableCell>{new Date(rh.created_at).toLocaleDateString('es-CR')}</TableCell>
                        <TableCell className="text-right font-mono">{(Number(rh.tasa_anterior) * 100).toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{(Number(rh.tasa_nueva) * 100).toFixed(2)}%</TableCell>
                        <TableCell>{rh.changed_by?.name ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{rh.motivo ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Cancel Modal */}
      <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Inversión</DialogTitle>
            <DialogDescription>Esta acción marcará la inversión como cancelada. Los cupones pendientes no serán pagados.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Motivo de cancelación *</Label>
              <Textarea value={cancelMotivo} onChange={e => setCancelMotivo(e.target.value)} rows={3} placeholder="Ingrese el motivo..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelModal(false)}>Cerrar</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !cancelMotivo.trim()}>
              {cancelling ? 'Cancelando...' : 'Confirmar Cancelación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Modal */}
      <Dialog open={showRenewModal} onOpenChange={setShowRenewModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Renovar Inversión</DialogTitle>
            <DialogDescription>Se creará una nueva inversión con los siguientes términos. La inversión actual será marcada como renovada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Monto Capital</Label>
                <Input type="number" step="0.01" value={renewForm.monto_capital} onChange={e => setRenewForm(f => ({ ...f, monto_capital: e.target.value }))} className="font-mono" />
              </div>
              <div className="grid gap-2">
                <Label>Tasa Anual (%)</Label>
                <Input type="number" step="0.01" value={renewForm.tasa_anual} onChange={e => setRenewForm(f => ({ ...f, tasa_anual: e.target.value }))} className="font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Plazo (meses)</Label>
                <Input type="number" value={renewForm.plazo_meses} onChange={e => setRenewForm(f => ({ ...f, plazo_meses: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Forma de Pago</Label>
                <Select value={renewForm.forma_pago} onValueChange={v => setRenewForm(f => ({ ...f, forma_pago: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSUAL">Mensual</SelectItem>
                    <SelectItem value="TRIMESTRAL">Trimestral</SelectItem>
                    <SelectItem value="SEMESTRAL">Semestral</SelectItem>
                    <SelectItem value="ANUAL">Anual</SelectItem>
                    <SelectItem value="RESERVA">Reserva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Fecha Inicio</Label>
                <Input type="date" value={renewForm.fecha_inicio} onChange={e => setRenewForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Fecha Vencimiento</Label>
                <Input type="date" value={renewForm.fecha_vencimiento} onChange={e => setRenewForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenewModal(false)}>Cancelar</Button>
            <Button onClick={handleRenew} disabled={renewing}>{renewing ? 'Renovando...' : 'Renovar Inversión'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Coupon Modal */}
      <Dialog open={!!payingCoupon} onOpenChange={open => { if (!open) setPayingCoupon(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Registrar Pago de Cupón</DialogTitle>
            <DialogDescription>
              Cupón #{payingCoupon ? [...coupons].sort((a, b) => a.fecha_cupon.localeCompare(b.fecha_cupon)).findIndex(c => c.id === payingCoupon.id) + 1 : ''} — {payingCoupon ? fmt(payingCoupon.interes_neto, investment.moneda) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Fecha de Pago</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Comprobante (opcional)</Label>
              <Input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setPayFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingCoupon(null)}>Cancelar</Button>
            <Button onClick={handlePayCoupon} disabled={payingLoading}>{payingLoading ? 'Procesando...' : 'Confirmar Pago'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correct Coupon Modal */}
      <Dialog open={!!correctingCoupon} onOpenChange={open => { if (!open) setCorrectingCoupon(null); }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Corregir Monto de Cupón</DialogTitle>
            <DialogDescription>
              {correctingCoupon && (
                <>
                  Cupón #{[...coupons].sort((a, b) => a.fecha_cupon.localeCompare(b.fecha_cupon)).findIndex(c => c.id === correctingCoupon.id) + 1}
                  {' — '}Monto calculado: {fmt(correctingCoupon.interes_neto, investment.moneda)}
                  {investment.es_capitalizable && (
                    <span className="block text-xs mt-1 text-amber-600">Esta inversión es capitalizable. Al corregir el monto, se recalcularán los cupones futuros.</span>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Monto Real Pagado ({investment.moneda})</Label>
              <Input
                type="number"
                step="0.01"
                value={correctAmount}
                onChange={e => setCorrectAmount(e.target.value)}
                className="font-mono"
              />
              {correctingCoupon && correctAmount && Number(correctAmount) !== Number(correctingCoupon.interes_neto) && (
                <p className="text-sm text-amber-600">
                  Diferencia: {fmt(Number(correctAmount) - Number(correctingCoupon.interes_neto), investment.moneda)}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Motivo de la corrección *</Label>
              <Textarea
                value={correctMotivo}
                onChange={e => setCorrectMotivo(e.target.value)}
                rows={3}
                placeholder="Ej: Por orden de Leo se pagó un monto diferente..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectingCoupon(null)}>Cancelar</Button>
            <Button
              onClick={handleCorrectCoupon}
              disabled={correctingLoading || !correctAmount || !correctMotivo.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {correctingLoading ? 'Guardando...' : 'Guardar Corrección'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelacion Total Modal */}
      <Dialog open={showCancelacionTotal} onOpenChange={setShowCancelacionTotal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Abono de Inversión</DialogTitle>
            <DialogDescription>Se devolverá el capital completo al inversionista y la inversión pasará a estado Finalizada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Capital</p>
                <p className="text-lg font-mono font-bold">{fmt(investment.monto_capital, investment.moneda)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Intereses Pendientes</p>
                <p className="text-lg font-mono font-bold">
                  {fmt(
                    (investment.coupons || [])
                      .filter(c => c.estado === 'Pendiente' || c.estado === 'Reservado')
                      .reduce((sum, c) => sum + Number(c.interes_neto), 0),
                    investment.moneda
                  )}
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <p className="font-medium text-sm">¿Cómo desea realizar la cancelación?</p>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${tipoCancelacion === 'con_intereses' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <input
                    type="radio"
                    name="tipoCancelacion"
                    checked={tipoCancelacion === 'con_intereses'}
                    onChange={() => setTipoCancelacion('con_intereses')}
                    className="accent-primary"
                  />
                  <div>
                    <p className="font-medium text-sm">Con intereses</p>
                    <p className="text-xs text-muted-foreground">Se pagan todos los cupones pendientes + devolución de capital</p>
                    <p className="text-sm font-mono font-semibold mt-1 text-primary">
                      Total: {fmt(
                        Number(investment.monto_capital) +
                        (investment.coupons || [])
                          .filter(c => c.estado === 'Pendiente' || c.estado === 'Reservado')
                          .reduce((sum, c) => sum + Number(c.interes_neto), 0),
                        investment.moneda
                      )}
                    </p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${tipoCancelacion === 'sin_intereses' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <input
                    type="radio"
                    name="tipoCancelacion"
                    checked={tipoCancelacion === 'sin_intereses'}
                    onChange={() => setTipoCancelacion('sin_intereses')}
                    className="accent-primary"
                  />
                  <div>
                    <p className="font-medium text-sm">Sin intereses</p>
                    <p className="text-xs text-muted-foreground">Solo devolución de capital, sin pagar intereses pendientes</p>
                    <p className="text-sm font-mono font-semibold mt-1 text-primary">
                      Total: {fmt(Number(investment.monto_capital), investment.moneda)}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelacionTotal(false)}>Cerrar</Button>
            <Button onClick={handleCancelacionTotal} disabled={cancelacionLoading}>
              {cancelacionLoading ? 'Procesando...' : 'Confirmar Abono'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Estado de Cuenta Prompt after Cancelacion Total */}
      <Dialog open={showEstadoCuentaPrompt} onOpenChange={setShowEstadoCuentaPrompt}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Inversión Finalizada</DialogTitle>
            <DialogDescription>El abono se ha procesado exitosamente. ¿Desea generar el estado de cuenta?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setShowEstadoCuentaPrompt(false)}>No, cerrar</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <FileText className="h-4 w-4 mr-1" /> Generar Estado de Cuenta
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { window.open(`${API_BASE}/api/investments/${investment.id}/export/estado-cuenta?lang=es`, '_blank'); setShowEstadoCuentaPrompt(false); }}>
                  Descargar en Español
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { window.open(`${API_BASE}/api/investments/${investment.id}/export/estado-cuenta?lang=en`, '_blank'); setShowEstadoCuentaPrompt(false); }}>
                  Download in English
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
