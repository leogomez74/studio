'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '@/lib/axios';
import type { Investment, Investor } from '@/lib/data';

type PreviewCoupon = {
  numero: number;
  fecha_cupon: string;
  interes_bruto: number;
  retencion: number;
  interes_neto: number;
  capital_acumulado: number | null;
};

function calculatePreviewCoupons(
  montoCapital: number, tasaAnual: number, plazoMeses: number,
  fechaInicio: string, formaPago: string, esCapitalizable: boolean,
  tasaRetencion: number,
): PreviewCoupon[] {
  if (!montoCapital || !tasaAnual || !plazoMeses || !fechaInicio) return [];
  const mesesIntervalo: Record<string, number> = { MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12, RESERVA: 1 };
  const intervalo = mesesIntervalo[formaPago] ?? 1;
  const start = new Date(fechaInicio + 'T00:00:00');
  const end = new Date(fechaInicio + 'T00:00:00');
  end.setMonth(end.getMonth() + plazoMeses);

  const coupons: PreviewCoupon[] = [];
  let capital = montoCapital;
  let num = 1;
  const cursor = new Date(start);
  cursor.setMonth(cursor.getMonth() + intervalo);

  while (cursor <= end) {
    const intMensual = Math.round(capital * tasaAnual / 12 * 100) / 100;
    const intCupon = Math.round(intMensual * intervalo * 100) / 100;
    const ret = Math.round(intCupon * tasaRetencion * 100) / 100;
    const neto = Math.round((intCupon - ret) * 100) / 100;
    if (esCapitalizable) capital = Math.round((capital + neto) * 100) / 100;
    coupons.push({
      numero: num++,
      fecha_cupon: cursor.toISOString().split('T')[0],
      interes_bruto: intCupon,
      retencion: ret,
      interes_neto: neto,
      capital_acumulado: esCapitalizable ? capital : null,
    });
    cursor.setMonth(cursor.getMonth() + intervalo);
  }
  return coupons;
}

const fmtP = (n: number) => new Intl.NumberFormat('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment?: Investment | null;
  investors: Investor[];
  onSuccess: () => void;
  defaultInvestorId?: number;
};

export function InvestmentFormDialog({ open, onOpenChange, investment, investors, onSuccess, defaultInvestorId }: Props) {
  const isEditing = !!investment;

  const [loading, setLoading] = useState(false);
  const [investorOpen, setInvestorOpen] = useState(false);
  const [investorSearch, setInvestorSearch] = useState('');
  const [form, setForm] = useState({
    investor_id: '',
    monto_capital: '',
    plazo_meses: '',
    fecha_inicio: '',
    fecha_vencimiento: '',
    tasa_anual: '',
    tasa_retencion: '7.05',
    moneda: 'CRC' as 'CRC' | 'USD',
    forma_pago: 'MENSUAL' as string,
    es_capitalizable: false,
    estado: 'Activa' as string,
    notas: '',
  });

  useEffect(() => {
    if (investment) {
      setForm({
        investor_id: String(investment.investor_id),
        monto_capital: String(investment.monto_capital),
        plazo_meses: String(investment.plazo_meses),
        fecha_inicio: investment.fecha_inicio?.split('T')[0] ?? '',
        fecha_vencimiento: investment.fecha_vencimiento?.split('T')[0] ?? '',
        tasa_anual: String(Number(investment.tasa_anual) * 100),
        tasa_retencion: String(Number(investment.tasa_retencion) * 100),
        moneda: investment.moneda,
        forma_pago: investment.forma_pago,
        es_capitalizable: investment.es_capitalizable,
        estado: investment.estado,
        notas: investment.notas || '',
      });
    } else {
      setForm({
        investor_id: defaultInvestorId ? String(defaultInvestorId) : '', monto_capital: '', plazo_meses: '',
        fecha_inicio: '', fecha_vencimiento: '', tasa_anual: '', tasa_retencion: '7.05', moneda: 'CRC',
        forma_pago: 'MENSUAL', es_capitalizable: false, estado: 'Activa', notas: '',
      });
    }
  }, [investment, open]);

  // Auto-calculate fecha_vencimiento
  useEffect(() => {
    if (form.fecha_inicio && form.plazo_meses) {
      const start = new Date(form.fecha_inicio + 'T00:00:00');
      const targetMonth = start.getMonth() + parseInt(form.plazo_meses);
      start.setDate(1);
      start.setMonth(targetMonth);
      setForm(prev => ({ ...prev, fecha_vencimiento: start.toISOString().split('T')[0] }));
    }
  }, [form.fecha_inicio, form.plazo_meses]);

  // Preview coupons calculation
  const previewCoupons = useMemo(() => calculatePreviewCoupons(
    Number(form.monto_capital), Number(form.tasa_anual) / 100,
    Number(form.plazo_meses), form.fecha_inicio, form.forma_pago, form.es_capitalizable,
    Number(form.tasa_retencion) / 100,
  ), [form.monto_capital, form.tasa_anual, form.plazo_meses, form.fecha_inicio, form.forma_pago, form.es_capitalizable, form.tasa_retencion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      investor_id: Number(form.investor_id),
      monto_capital: Number(form.monto_capital),
      plazo_meses: Number(form.plazo_meses),
      tasa_anual: Number(form.tasa_anual) / 100,
      tasa_retencion: Number(form.tasa_retencion) / 100,
    };

    try {
      if (isEditing) {
        await api.put(`/api/investments/${investment!.id}`, payload);
        onSuccess();
        onOpenChange(false);
      } else {
        const res = await api.post('/api/investments', payload);
        const newId = res.data?.id;
        onSuccess();
        onOpenChange(false);

        // Descargar contratos automáticamente en ambos idiomas
        if (newId) {
          const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace('/api', '') || '';
          setTimeout(() => { window.open(`${base}/api/investments/${newId}/export/contrato/es`, '_blank'); }, 300);
          setTimeout(() => { window.open(`${base}/api/investments/${newId}/export/contrato/en`, '_blank'); }, 800);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Inversión' : 'Nueva Inversión'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los campos necesarios.' : 'Complete los datos de la nueva inversión.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="investor_id">Inversionista</Label>
              <Popover open={investorOpen} onOpenChange={setInvestorOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={investorOpen} className="justify-between font-normal">
                    {form.investor_id ? investors.find(i => String(i.id) === form.investor_id)?.name : 'Seleccionar...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Buscar inversionista..."
                      value={investorSearch}
                      onChange={e => setInvestorSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-1">
                    {investors
                      .filter(inv => inv.name.toLowerCase().includes(investorSearch.toLowerCase()))
                      .map(inv => (
                        <button
                          key={inv.id}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer',
                            form.investor_id === String(inv.id) && 'bg-accent'
                          )}
                          onClick={() => {
                            setForm(f => ({ ...f, investor_id: String(inv.id) }));
                            setInvestorOpen(false);
                            setInvestorSearch('');
                          }}
                        >
                          <Check className={cn('h-4 w-4', form.investor_id === String(inv.id) ? 'opacity-100' : 'opacity-0')} />
                          {inv.name}
                        </button>
                      ))}
                    {investors.filter(inv => inv.name.toLowerCase().includes(investorSearch.toLowerCase())).length === 0 && (
                      <div className="py-4 text-center text-sm text-muted-foreground">Sin resultados</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="monto_capital">Monto Capital</Label>
              <Input
                id="monto_capital"
                type="text"
                inputMode="decimal"
                value={(() => {
                  if (!form.monto_capital) return '';
                  const [int, dec] = form.monto_capital.split('.');
                  const formatted = Number(int).toLocaleString('en-US');
                  return dec !== undefined ? `${formatted}.${dec}` : formatted;
                })()}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d.]/g, '');
                  const parts = raw.split('.');
                  const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
                  setForm(f => ({ ...f, monto_capital: cleaned }));
                }}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="moneda">Moneda</Label>
              <Select value={form.moneda} onValueChange={v => setForm(f => ({ ...f, moneda: v as 'CRC' | 'USD' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC (Colones)</SelectItem>
                  <SelectItem value="USD">USD (Dólares)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tasa_anual">Tasa Anual (%)</Label>
              <Input id="tasa_anual" type="number" step="0.01" value={form.tasa_anual} onChange={e => setForm(f => ({ ...f, tasa_anual: e.target.value }))} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tasa_retencion">Retención (%)</Label>
              <Input id="tasa_retencion" type="number" step="0.01" value={form.tasa_retencion} onChange={e => setForm(f => ({ ...f, tasa_retencion: e.target.value }))} required />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="plazo_meses">Plazo (meses)</Label>
              <Input id="plazo_meses" type="number" value={form.plazo_meses} onChange={e => setForm(f => ({ ...f, plazo_meses: e.target.value }))} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fecha_inicio">Fecha Inicio</Label>
              <Input id="fecha_inicio" type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fecha_vencimiento">Fecha Vencimiento</Label>
              <Input id="fecha_vencimiento" type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="forma_pago">Forma de Pago</Label>
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
            <div className="grid gap-2 items-end">
              <div className="flex items-center gap-2">
                <Switch checked={form.es_capitalizable} onCheckedChange={v => setForm(f => ({ ...f, es_capitalizable: v }))} />
                <Label>Capitalizable</Label>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2} />
          </div>

          {/* Preview de amortización */}
          {previewCoupons.length > 0 && (
            <div className="border rounded-lg p-3">
              <p className="text-sm font-semibold mb-2">Preview de Cupones ({previewCoupons.length})</p>
              <div className="max-h-[200px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs text-right">Int. Bruto</TableHead>
                      <TableHead className="text-xs text-right">Ret. {form.tasa_retencion}%</TableHead>
                      <TableHead className="text-xs text-right">Int. Neto</TableHead>
                      {form.es_capitalizable && <TableHead className="text-xs text-right">Cap. Acum.</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewCoupons.map(c => (
                      <TableRow key={c.numero}>
                        <TableCell className="text-xs py-1">{c.numero}</TableCell>
                        <TableCell className="text-xs py-1">{new Date(c.fecha_cupon).toLocaleDateString('es-CR')}</TableCell>
                        <TableCell className="text-xs py-1 text-right font-mono">{fmtP(c.interes_bruto)}</TableCell>
                        <TableCell className="text-xs py-1 text-right font-mono ">-{fmtP(c.retencion)}</TableCell>
                        <TableCell className="text-xs py-1 text-right font-mono font-semibold">{fmtP(c.interes_neto)}</TableCell>
                        {form.es_capitalizable && <TableCell className="text-xs py-1 text-right font-mono text-primary">{c.capital_acumulado ? fmtP(c.capital_acumulado) : '—'}</TableCell>}
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-bold">
                      <TableCell colSpan={2} className="text-xs py-1">TOTALES</TableCell>
                      <TableCell className="text-xs py-1 text-right font-mono">{fmtP(previewCoupons.reduce((s, c) => s + c.interes_bruto, 0))}</TableCell>
                      <TableCell className="text-xs py-1 text-right font-mono">{fmtP(previewCoupons.reduce((s, c) => s + c.retencion, 0))}</TableCell>
                      <TableCell className="text-xs py-1 text-right font-mono">{fmtP(previewCoupons.reduce((s, c) => s + c.interes_neto, 0))}</TableCell>
                      {form.es_capitalizable && <TableCell />}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear Inversión')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
