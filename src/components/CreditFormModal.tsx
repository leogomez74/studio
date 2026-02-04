'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ChevronLeft, ChevronRight, Check } from 'lucide-react';
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
  const [currentStep, setCurrentStep] = useState(1);

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

  // Estado para cargos adicionales editables
  const [cargosAdicionales, setCargosAdicionales] = useState({
    comision: 0,
    transporte: 10000,
    respaldo_deudor: 4950,
    descuento_factura: 0,
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

  // Actualizar cargos automáticamente cuando se activa el switch o cambia el monto/categoría
  useEffect(() => {
    if (creditForm.conCargosAdicionales && creditForm.monto_credito) {
      const montoNumerico = parseFloat(parseCurrencyToNumber(creditForm.monto_credito));
      if (!isNaN(montoNumerico) && montoNumerico > 0) {
        const cargosCalculados = calcularCargosDefault(montoNumerico, creditForm.category);
        setCargosAdicionales(cargosCalculados);
      }
    }
  }, [creditForm.conCargosAdicionales, creditForm.monto_credito, creditForm.category]);

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

    const cargosParaEnviar = creditForm.conCargosAdicionales
      ? cargosAdicionales
      : undefined;

    // Calcular monto neto restando los cargos si están habilitados
    const montoConCargos = creditForm.conCargosAdicionales
      ? montoNumerico -
        cargosAdicionales.comision -
        cargosAdicionales.transporte -
        cargosAdicionales.respaldo_deudor -
        cargosAdicionales.descuento_factura
      : montoNumerico;

    const payload: Record<string, any> = {
      reference: creditForm.reference,
      title: creditForm.title,
      status: creditForm.status,
      category: creditForm.category,
      monto_credito: montoConCargos, // Enviar monto con cargos si están habilitados
      lead_id: leadIdNumerico,
      description: creditForm.description,
      divisa: creditForm.divisa,
      plazo: plazoNumerico,
      poliza: creditForm.poliza,
    };

    if (cargosParaEnviar) {
      payload.cargos_adicionales = cargosParaEnviar;
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
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) setCurrentStep(1); // Resetear paso al cerrar
      }}
    >
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nuevo Crédito - Paso {currentStep} de {creditForm.conCargosAdicionales ? 2 : 1}</DialogTitle>
          <DialogDescription>Completa la información del crédito.</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {creditForm.conCargosAdicionales && (
          <div className="flex items-center justify-between mb-4 px-8">
            {[1, 2].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step === currentStep
                      ? 'bg-blue-600 text-white'
                      : step < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < currentStep ? <Check className="w-5 h-5" /> : step}
                </div>
                {step < 2 && (
                  <div
                    className={`h-1 w-32 mx-2 ${
                      step < currentStep ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <form className="space-y-6 overflow-y-auto flex-1 pr-2" onSubmit={handleSubmit}>
          {/* Paso 1: Información Básica */}
          {currentStep === 1 && (
            <>
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

              {/* Póliza y Cargos en la misma fila */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="poliza">Póliza</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="poliza"
                      checked={creditForm.poliza}
                      onCheckedChange={(checked) => setCreditForm(f => ({ ...f, poliza: checked }))}
                      disabled={creditForm.category === 'Micro Crédito'}
                    />
                    <Label htmlFor="poliza" className="text-sm text-muted-foreground">
                      {creditForm.category === 'Micro Crédito'
                        ? 'No disponible para Micro Crédito'
                        : (creditForm.poliza ? 'Sí posee póliza' : 'No posee póliza')}
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargos">Cargos Adicionales</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="cargos"
                      checked={creditForm.conCargosAdicionales}
                      onCheckedChange={(checked) => {
                        setCreditForm(f => ({ ...f, conCargosAdicionales: checked }));
                        if (!checked) setCurrentStep(1);
                      }}
                    />
                    <Label htmlFor="cargos" className="text-sm text-muted-foreground">
                      {creditForm.conCargosAdicionales
                        ? 'Aplicar cargos adicionales'
                        : 'Sin cargos adicionales'}
                    </Label>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Paso 2: Cargos Adicionales */}
          {currentStep === 2 && creditForm.conCargosAdicionales && (
            <>
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold text-lg">Cargos Adicionales (Editables)</h4>
                <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="comision">Comisión</Label>
                  <Input
                    id="comision"
                    type="text"
                    value={formatCurrency(cargosAdicionales.comision)}
                    onChange={(e) => {
                      const valor = parseCurrencyToNumber(e.target.value);
                      setCargosAdicionales(prev => ({ ...prev, comision: parseFloat(valor) || 0 }));
                    }}
                    placeholder="₡0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="transporte">Transporte</Label>
                  <Input
                    id="transporte"
                    type="text"
                    value={formatCurrency(cargosAdicionales.transporte)}
                    onChange={(e) => {
                      const valor = parseCurrencyToNumber(e.target.value);
                      setCargosAdicionales(prev => ({ ...prev, transporte: parseFloat(valor) || 0 }));
                    }}
                    placeholder="₡0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="respaldo_deudor">Respaldo Deudor</Label>
                  <Input
                    id="respaldo_deudor"
                    type="text"
                    value={formatCurrency(cargosAdicionales.respaldo_deudor)}
                    onChange={(e) => {
                      const valor = parseCurrencyToNumber(e.target.value);
                      setCargosAdicionales(prev => ({ ...prev, respaldo_deudor: parseFloat(valor) || 0 }));
                    }}
                    placeholder="₡0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="descuento_factura">Descuento de Factura</Label>
                  <Input
                    id="descuento_factura"
                    type="text"
                    value={formatCurrency(cargosAdicionales.descuento_factura)}
                    onChange={(e) => {
                      const valor = parseCurrencyToNumber(e.target.value);
                      setCargosAdicionales(prev => ({ ...prev, descuento_factura: parseFloat(valor) || 0 }));
                    }}
                    placeholder="₡0.00"
                  />
                </div>
              </div>
            </div>

            {/* Monto Total después de cargos */}
            <div className="p-4 border-2 rounded-lg bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monto Original</p>
                  <p className="text-lg font-semibold">{formatCurrency(creditForm.monto_credito || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Monto Neto a Desembolsar</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(
                      parseFloat(parseCurrencyToNumber(String(creditForm.monto_credito) || '0')) -
                      cargosAdicionales.comision -
                      cargosAdicionales.transporte -
                      cargosAdicionales.respaldo_deudor -
                      cargosAdicionales.descuento_factura
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <p className="text-xs text-muted-foreground mb-2">Desglose de cargos:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span>Comisión:</span>
                    <span className="font-medium">{formatCurrency(cargosAdicionales.comision)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transporte:</span>
                    <span className="font-medium">{formatCurrency(cargosAdicionales.transporte)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Respaldo Deudor:</span>
                    <span className="font-medium">{formatCurrency(cargosAdicionales.respaldo_deudor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Descuento Factura:</span>
                    <span className="font-medium">{formatCurrency(cargosAdicionales.descuento_factura)}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
          )}

          {/* Botones de navegación */}
          <div className="flex justify-between pt-4 border-t">
            {currentStep === 2 ? (
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentStep(1);
                }}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
            )}

            {currentStep === 1 && !creditForm.conCargosAdicionales ? (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Generar crédito'
                )}
              </Button>
            ) : currentStep === 1 && creditForm.conCargosAdicionales ? (
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCurrentStep(2);
                }}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  'Generar crédito'
                )}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
