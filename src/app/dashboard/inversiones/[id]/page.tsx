'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, CheckCircle, XCircle, FileText, FileSpreadsheet, Loader2, Save, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
import api from '@/lib/axios';
import type { Investment, InvestmentCoupon } from '@/lib/data';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const fmt = (amount: number, currency: 'CRC' | 'USD') =>
  new Intl.NumberFormat('es-CR', { style: 'currency', currency }).format(amount);

export default function InvestmentDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [investment, setInvestment] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [form, setForm] = useState({
    monto_capital: '',
    plazo_meses: '',
    fecha_inicio: '',
    fecha_vencimiento: '',
    tasa_anual: '',
    forma_pago: '',
    estado: '',
    es_capitalizable: false,
    notas: '',
  });

  const fetchInvestment = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/investments/${id}`);
      const inv = res.data;
      setInvestment(inv);
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

  const handleMarkCouponPaid = async (couponId: number) => {
    try {
      await api.patch(`/api/investment-coupons/${couponId}/pay`);
      fetchInvestment();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLiquidate = async () => {
    if (!investment || !confirm('¿Liquidar anticipadamente esta inversión?')) return;
    try {
      await api.post(`/api/investments/${investment.id}/liquidate`);
      fetchInvestment();
    } catch (err) {
      console.error(err);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/inversiones"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="text-2xl font-semibold">Inversión: {investment.numero_desembolso}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/pdf`, '_blank')}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/api/investments/${investment.id}/export/excel`, '_blank')}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          {investment.estado === 'Activa' && (
            <Button variant="destructive" size="sm" onClick={handleLiquidate}>Liquidar</Button>
          )}
        </div>
      </div>

      {/* Editable Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{investment.investor?.name ?? '—'}</CardTitle>
              <CardDescription>Inversionista ID: {investment.investor_id}</CardDescription>
            </div>
            <Button onClick={handleSave} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-1" /> {saving ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1">
            <Label>Monto Capital</Label>
            <Input type="number" step="0.01" value={form.monto_capital} onChange={e => setForm(f => ({ ...f, monto_capital: e.target.value }))} className="font-mono" />
          </div>
          <div className="grid gap-1">
            <Label>Tasa Anual (%)</Label>
            <Input type="number" step="0.01" value={form.tasa_anual} onChange={e => setForm(f => ({ ...f, tasa_anual: e.target.value }))} className="font-mono" />
          </div>
          <div className="grid gap-1">
            <Label>Plazo (meses)</Label>
            <Input type="number" value={form.plazo_meses} onChange={e => setForm(f => ({ ...f, plazo_meses: e.target.value }))} />
          </div>
          <div className="grid gap-1">
            <Label>Forma de Pago</Label>
            <Select value={form.forma_pago} onValueChange={v => setForm(f => ({ ...f, forma_pago: v }))}>
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
            <Input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
          </div>
          <div className="grid gap-1">
            <Label>Fecha Vencimiento</Label>
            <Input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
          </div>
          <div className="grid gap-1">
            <Label>Estado</Label>
            <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Activa">Activa</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Liquidada">Liquidada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1 items-end">
            <div className="flex items-center gap-2">
              <Switch checked={form.es_capitalizable} onCheckedChange={v => setForm(f => ({ ...f, es_capitalizable: v }))} />
              <Label>Capitalizable</Label>
            </div>
          </div>
        </CardContent>
        <CardContent>
          <Label>Notas</Label>
          <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={3} className="mt-1" />
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
            <p className="text-sm text-muted-foreground">Retención 15%</p>
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
                  <TableHead className="text-right">Retención 15%</TableHead>
                  <TableHead className="text-right">Interés Neto</TableHead>
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
                        <TableCell>
                          <Badge variant={coupon.estado === 'Pagado' ? 'default' : coupon.estado === 'Reservado' ? 'secondary' : 'outline'}>
                            {coupon.estado}
                          </Badge>
                        </TableCell>
                        <TableCell>{coupon.fecha_pago ? new Date(coupon.fecha_pago).toLocaleDateString('es-CR') : '—'}</TableCell>
                        <TableCell>
                          {coupon.estado === 'Pendiente' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={hasPriorUnpaid}
                              title={hasPriorUnpaid ? 'Debe pagar los cupones anteriores primero' : undefined}
                              onClick={() => handleMarkCouponPaid(coupon.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Pagar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
                {coupons.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin cupones generados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
