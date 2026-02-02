'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import api from '@/lib/axios';

// Funciones para formateo de moneda
const formatCurrency = (value: string | number): string => {
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

const parseCurrencyToNumber = (value: string): string => {
  let cleaned = value.replace(/[₡$]/g, '');
  cleaned = cleaned.replace(/\s/g, '');
  cleaned = cleaned.replace(',', '.');
  cleaned = cleaned.replace(/[^\d.]/g, '');
  return cleaned;
};

interface CreditFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    reference?: string;
    title?: string;
    monto_credito?: string | number;
    leadId?: string;
    clientName?: string;
    category?: string;
    divisa?: string;
    plazo?: string;
    description?: string;
  };
  products: Array<{ id: number; name: string; }>;
  leads: Array<{ id: number; name?: string; deductora_id?: number; }>;
  onSuccess?: () => void;
}

export function CreditFormModal({
  open,
  onOpenChange,
  initialData = {},
  products,
  leads,
  onSuccess
}: CreditFormModalProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [creditForm, setCreditForm] = useState({
    reference: initialData.reference || '',
    title: initialData.title || '',
    status: 'Por firmar',
    category: initialData.category || 'Crédito',
    monto_credito: initialData.monto_credito ? String(initialData.monto_credito) : '',
    leadId: initialData.leadId || '',
    clientName: initialData.clientName || '',
    description: initialData.description || '',
    divisa: initialData.divisa || 'CRC',
    plazo: initialData.plazo || '36',
    poliza: false,
    conCargosAdicionales: false,
  });

  // Configuración de cargos adicionales por defecto
  const CARGOS_CONFIG = {
    comision: { porcentaje: 0.03, fijo: null },
    transporte: { porcentaje: null, fijo: 10000 },
    respaldo_deudor: { porcentaje: null, fijo: 4950, soloRegular: true },
    descuento_factura: { porcentaje: null, fijo: 0 },
  };

  const calcularCargosDefault = (monto: number, category: string) => {
    const esRegular = category === 'Regular' || category === 'Personal (Diferentes usos)' || category === 'Refundición (Pagar deudas actuales)';
    return {
      comision: Math.round(monto * (CARGOS_CONFIG.comision.porcentaje || 0) * 100) / 100,
      transporte: CARGOS_CONFIG.transporte.fijo || 0,
      respaldo_deudor: esRegular ? (CARGOS_CONFIG.respaldo_deudor.fijo || 0) : 0,
      descuento_factura: CARGOS_CONFIG.descuento_factura.fijo || 0,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const montoNumerico = parseFloat(parseCurrencyToNumber(creditForm.monto_credito));
    const leadIdNumerico = parseInt(creditForm.leadId);
    const plazoNumerico = parseInt(creditForm.plazo);

    if (!creditForm.leadId || isNaN(leadIdNumerico)) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "No hay un cliente asociado al análisis",
      });
      return;
    }

    // Validar que el cliente tenga deductora asignada - fetch directo del cliente
    try {
      const clientResponse = await api.get(`/api/clients/${leadIdNumerico}`);
      if (!clientResponse.data.deductora_id) {
        toast({
          variant: "destructive",
          title: "Error de validación",
          description: "El cliente seleccionado no tiene deductora asignada. Por favor, asigna una deductora al cliente antes de crear el crédito.",
        });
        return;
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "No se pudo verificar los datos del cliente",
      });
      return;
    }

    if (isNaN(montoNumerico) || montoNumerico < 2) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "El monto debe ser un número mayor a 2",
      });
      return;
    }

    if (isNaN(plazoNumerico) || plazoNumerico < 1 || plazoNumerico > 120) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "El plazo debe ser un número entre 1 y 120",
      });
      return;
    }

    setIsSaving(true);

    const cargosAdicionales = creditForm.conCargosAdicionales
      ? calcularCargosDefault(montoNumerico, creditForm.category)
      : undefined;

    const payload: Record<string, any> = {
      reference: creditForm.reference,
      title: creditForm.title,
      status: creditForm.status,
      category: creditForm.category,
      monto_credito: montoNumerico,
      lead_id: leadIdNumerico,
      description: creditForm.description,
      divisa: creditForm.divisa,
      plazo: plazoNumerico,
      poliza: creditForm.poliza,
    };

    if (cargosAdicionales) {
      payload.cargos_adicionales = cargosAdicionales;
    }

    try {
      const response = await api.post('/api/credits', payload);
      onOpenChange(false);
      toast({
        title: "Crédito creado",
        description: `El crédito ${response.data.reference} se ha creado exitosamente.`,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      let mensaje = 'Error al crear crédito';
      if (err?.response?.data?.message) {
        mensaje = err.response.data.message;
      } else if (err?.response?.data?.errors) {
        mensaje = Object.values(err.response.data.errors).flat().join(', ');
      } else if (err?.message) {
        mensaje = err.message;
      }
      toast({
        variant: "destructive",
        title: "Error al crear crédito",
        description: mensaje,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo Crédito</DialogTitle>
          <DialogDescription>Completa la información del crédito.</DialogDescription>
        </DialogHeader>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reference">Referencia</Label>
              <Input
                id="reference"
                placeholder="Se genera automáticamente (YY-XXXXX-CR)"
                value={creditForm.reference}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                placeholder="Crédito Hipotecario..."
                value={creditForm.title}
                onChange={e => setCreditForm(f => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={creditForm.status} onValueChange={v => setCreditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger id="status"><SelectValue placeholder="Selecciona el estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Por firmar">Por firmar</SelectItem>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Mora">Mora</SelectItem>
                  <SelectItem value="Cerrado">Cerrado</SelectItem>
                  <SelectItem value="Legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={creditForm.category} onValueChange={v => {
                if (v === 'Micro Crédito') {
                  setCreditForm(f => ({ ...f, category: v, poliza: false }));
                } else {
                  setCreditForm(f => ({ ...f, category: v }));
                }
              }}>
                <SelectTrigger id="category"><SelectValue placeholder="Selecciona la categoría" /></SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.name}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="divisa">Divisa</Label>
              <Select value={creditForm.divisa} onValueChange={v => setCreditForm(f => ({ ...f, divisa: v }))}>
                <SelectTrigger id="divisa"><SelectValue placeholder="Selecciona la divisa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRC">CRC - Colón Costarricense</SelectItem>
                  <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto">Monto</Label>
              <Input
                id="monto"
                type="text"
                placeholder="₡0.00"
                value={creditForm.monto_credito || ''}
                onChange={e => {
                  const rawValue = parseCurrencyToNumber(e.target.value);
                  setCreditForm(f => ({ ...f, monto_credito: rawValue }));
                }}
                onBlur={() => {
                  if (creditForm.monto_credito) {
                    setCreditForm(f => ({ ...f, monto_credito: formatCurrency(f.monto_credito) }));
                  }
                }}
                onFocus={(e) => {
                  if (creditForm.monto_credito) {
                    const numValue = parseCurrencyToNumber(String(creditForm.monto_credito));
                    setCreditForm(f => ({ ...f, monto_credito: numValue }));
                    setTimeout(() => e.target.select(), 0);
                  }
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plazo">Plazo (Meses)</Label>
              <Input
                id="plazo"
                type="number"
                min="1"
                max="120"
                placeholder="1 - 120"
                value={creditForm.plazo}
                onChange={e => setCreditForm(f => ({ ...f, plazo: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
                value={creditForm.clientName}
                disabled
                className="bg-gray-50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Describe el contexto del crédito..."
              value={creditForm.description}
              onChange={e => setCreditForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="poliza"
              checked={creditForm.poliza}
              onCheckedChange={(checked) => setCreditForm(f => ({ ...f, poliza: checked }))}
              disabled={creditForm.category === 'Micro Crédito'}
            />
            <Label htmlFor="poliza" className="cursor-pointer">
              {creditForm.poliza ? 'Sí posee póliza' : 'No posee póliza'}
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="cargos"
              checked={creditForm.conCargosAdicionales}
              onCheckedChange={(checked) => setCreditForm(f => ({ ...f, conCargosAdicionales: checked }))}
            />
            <Label htmlFor="cargos" className="cursor-pointer">
              Aplicar cargos (editable en detalle)
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Crédito'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
