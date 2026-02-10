'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import api from '@/lib/axios';

const formatCurrency = (value: number, currency: string = 'CRC'): string => {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

interface CreditForRefundicion {
  id: number;
  reference: string;
  monto_credito: number;
  saldo: number;
  cuota: number;
  plazo: number;
  tasa_anual: number;
  status: string;
  tipo_credito?: string;
  category?: string;
  lead_id: number;
  opportunity_id?: string;
  assigned_to?: string;
  deductora_id?: number;
  poliza?: boolean;
  lead?: {
    id: number;
    name: string;
    cedula?: string;
  };
}

interface RefundicionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credit: CreditForRefundicion;
  onSuccess: () => void;
}

export function RefundicionModal({ open, onOpenChange, credit, onSuccess }: RefundicionModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [montoNuevo, setMontoNuevo] = useState('');
  const [plazo, setPlazo] = useState('');
  const [poliza, setPoliza] = useState(false);
  const [comision, setComision] = useState('');
  const [transporte, setTransporte] = useState('10000');
  const [respaldoDeudor, setRespaldoDeudor] = useState('4950');
  const [descuentoFactura, setDescuentoFactura] = useState('0');

  // Calculated values
  const saldoActual = credit.saldo ?? 0;
  const montoNum = parseFloat(montoNuevo) || 0;
  const comisionNum = parseFloat(comision) || 0;
  const transporteNum = parseFloat(transporte) || 0;
  const respaldoNum = parseFloat(respaldoDeudor) || 0;
  const descuentoNum = parseFloat(descuentoFactura) || 0;
  const totalCargos = comisionNum + transporteNum + respaldoNum + descuentoNum;
  const montoEntregado = montoNum - saldoActual - totalCargos;
  const isValid = montoNum >= saldoActual && montoEntregado >= 0 && parseFloat(plazo) >= 1;

  // PMT estimation
  const tasaMensual = (credit.tasa_anual || 0) / 100 / 12;
  const plazoNum = parseInt(plazo) || 0;
  const montoNeto = montoNum - totalCargos;
  let cuotaEstimada = 0;
  if (montoNeto > 0 && plazoNum > 0 && tasaMensual > 0) {
    const potencia = Math.pow(1 + tasaMensual, plazoNum);
    cuotaEstimada = montoNeto * (tasaMensual * potencia) / (potencia - 1);
  } else if (montoNeto > 0 && plazoNum > 0) {
    cuotaEstimada = montoNeto / plazoNum;
  }

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setMontoNuevo('');
      setPlazo('');
      setPoliza(credit.poliza ?? false);
      const defaultComision = '0';
      setComision(defaultComision);
      setTransporte('10000');
      setRespaldoDeudor(credit.tipo_credito === 'microcredito' ? '0' : '4950');
      setDescuentoFactura('0');
    }
  }, [open, credit]);

  // Auto-calculate comision at 3%
  useEffect(() => {
    if (montoNum > 0) {
      setComision(String(Math.round(montoNum * 0.03)));
    }
  }, [montoNum]);

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const body = {
        title: `Refundición - ${credit.lead?.name || 'Cliente'}`,
        monto_credito: montoNum,
        plazo: plazoNum,
        tipo_credito: credit.tipo_credito || 'regular',
        category: credit.category,
        poliza,
        cargos_adicionales: {
          comision: comisionNum,
          transporte: transporteNum,
          respaldo_deudor: respaldoNum,
          descuento_factura: descuentoNum,
        },
      };

      const res = await api.post(`/api/credits/${credit.id}/refundicion`, body);

      toast({
        title: 'Refundicion exitosa',
        description: `Credito viejo cerrado. Nuevo credito: ${res.data.new_credit.reference}`,
      });

      onOpenChange(false);
      onSuccess();

      // Navigate to the new credit
      if (res.data.new_credit?.id) {
        router.push(`/dashboard/creditos/${res.data.new_credit.id}`);
      }
    } catch (error: any) {
      console.error('Error en refundicion:', error);
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo completar la refundicion.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Refundicion de Credito
          </DialogTitle>
          <DialogDescription>
            El saldo pendiente del credito actual sera absorbido por el nuevo credito.
          </DialogDescription>
        </DialogHeader>

        {/* Resumen del credito viejo */}
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">Credito Actual - {credit.reference}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Monto Original</span>
                <span className="font-semibold">{formatCurrency(credit.monto_credito)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Saldo Pendiente</span>
                <span className="font-semibold text-orange-600">{formatCurrency(saldoActual)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Cuota Actual</span>
                <span className="font-semibold">{formatCurrency(credit.cuota)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Parametros del nuevo credito */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm">Nuevo Credito</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monto_nuevo">Monto del nuevo credito *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                <Input
                  id="monto_nuevo"
                  type="number"
                  className="pl-7"
                  placeholder="Ej: 1000000"
                  value={montoNuevo}
                  onChange={(e) => setMontoNuevo(e.target.value)}
                  min={saldoActual}
                />
              </div>
              {montoNum > 0 && montoNum < saldoActual && (
                <p className="text-xs text-red-500">El monto debe ser mayor o igual al saldo pendiente ({formatCurrency(saldoActual)})</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plazo_nuevo">Plazo (meses) *</Label>
              <Input
                id="plazo_nuevo"
                type="number"
                placeholder="Ej: 36"
                value={plazo}
                onChange={(e) => setPlazo(e.target.value)}
                min={1}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={poliza} onCheckedChange={setPoliza} />
            <Label>Poliza de seguro</Label>
          </div>

          {/* Cargos adicionales */}
          <details className="border rounded-md p-3">
            <summary className="cursor-pointer text-sm font-medium">Cargos Adicionales ({formatCurrency(totalCargos)})</summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">Comision (3%)</Label>
                <Input type="number" value={comision} onChange={(e) => setComision(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Transporte</Label>
                <Input type="number" value={transporte} onChange={(e) => setTransporte(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Respaldo Deudor</Label>
                <Input type="number" value={respaldoDeudor} onChange={(e) => setRespaldoDeudor(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descuento Factura</Label>
                <Input type="number" value={descuentoFactura} onChange={(e) => setDescuentoFactura(e.target.value)} />
              </div>
            </div>
          </details>
        </div>

        <Separator />

        {/* Resumen financiero */}
        {montoNum > 0 && (
          <Card className={montoEntregado >= 0 ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resumen de Refundicion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Monto nuevo credito</span>
                <span className="font-medium">{formatCurrency(montoNum)}</span>
              </div>
              <div className="flex justify-between text-orange-600">
                <span>(-) Saldo absorbido del credito viejo</span>
                <span className="font-medium">-{formatCurrency(saldoActual)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>(-) Cargos adicionales</span>
                <span className="font-medium">-{formatCurrency(totalCargos)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Monto entregado al cliente</span>
                <span className={montoEntregado >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(montoEntregado)}
                </span>
              </div>
              {cuotaEstimada > 0 && (
                <div className="flex justify-between text-muted-foreground pt-1">
                  <span>Cuota mensual estimada</span>
                  <span className="font-medium">{formatCurrency(cuotaEstimada)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {montoEntregado < 0 && montoNum > 0 && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>El monto no es suficiente para cubrir el saldo pendiente mas los cargos.</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Ejecutar Refundicion
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
