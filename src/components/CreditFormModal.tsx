'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
    deductora_id?: number;
  };
  products: Array<{ id: number; name: string; }>;
  leads: Array<{ id: number; name?: string; deductora_id?: number; }>;
  onSuccess?: () => void;
  manchasDetalle?: Array<{ id: number; fecha_inicio: string; fecha_fin?: string; descripcion: string; monto: number }>;
  analisisId?: number;
}

export function CreditFormModal({
  open,
  onOpenChange,
  initialData = {},
  products,
  leads,
  onSuccess,
  manchasDetalle,
  analisisId,
}: CreditFormModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Estado para deductoras
  const [deductoras, setDeductoras] = useState<{ id: number; nombre: string; codigo: string }[]>([]);
  const [selectedDeductora, setSelectedDeductora] = useState<string>('');

  const [creditForm, setCreditForm] = useState({
    reference: '',
    title: '',
    status: 'Por firmar',
    category: 'Crédito',
    monto_credito: '',
    leadId: '',
    clientName: '',
    description: '',
    divisa: 'CRC',
    plazo: '36',
    poliza: false,
    conCargosAdicionales: false,
  });

  // Cargar deductoras al abrir el modal
  useEffect(() => {
    if (open && deductoras.length === 0) {
      api.get('/api/deductoras')
        .then(res => setDeductoras(res.data))
        .catch(err => console.error('Error cargando deductoras:', err));
    }
  }, [open, deductoras.length]);

  // Sincronizar estado interno solo cuando el modal se ABRE (transición false → true)
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setCreditForm({
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
      // Auto-llenar deductora desde initialData o desde el lead en el array
      if (initialData.deductora_id) {
        // Prioridad 1: usar deductora_id directamente si viene en initialData
        setSelectedDeductora(String(initialData.deductora_id));
      } else {
        // Prioridad 2: buscar en el array de leads
        const leadId = initialData.leadId || '';
        const lead = leads.find(l => String(l.id) === leadId);
        setSelectedDeductora(lead?.deductora_id ? String(lead.deductora_id) : 'sin_deductora');
      }
      setSelectedManchas([]);
      setCurrentStep(1);
    }
    prevOpenRef.current = open;
  }, [open]);

  // Manchas seleccionadas para cancelación
  const [selectedManchas, setSelectedManchas] = useState<number[]>([]);

  // Campo de cargo actualmente en edición (para mostrar valor raw vs formateado)
  const [editingCargo, setEditingCargo] = useState<string | null>(null);

  // Estado para cargos adicionales editables
  const [cargosAdicionales, setCargosAdicionales] = useState({
    comision: 0,
    transporte: 10000,
    respaldo_deudor: 4950,
    descuento_factura: 0,
    cancelacion_manchas: 0,
  });

  // Configuración de cargos adicionales por defecto
  const CARGOS_CONFIG = {
    comision: { porcentaje: 0.03, fijo: null },
    transporte: { porcentaje: null, fijo: 10000 },
    respaldo_deudor: { porcentaje: null, fijo: 4950, soloRegular: true },
    descuento_factura: { porcentaje: null, fijo: 0 },
    cancelacion_manchas: { porcentaje: null, fijo: 0 },
  };

  const calcularCargosDefault = (monto: number, category: string) => {
    const esRegular = category === 'Regular' || category === 'Personal (Diferentes usos)' || category === 'Refundición (Pagar deudas actuales)';
    return {
      comision: Math.round(monto * (CARGOS_CONFIG.comision.porcentaje || 0) * 100) / 100,
      transporte: CARGOS_CONFIG.transporte.fijo || 0,
      respaldo_deudor: esRegular ? (CARGOS_CONFIG.respaldo_deudor.fijo || 0) : 0,
      descuento_factura: CARGOS_CONFIG.descuento_factura.fijo || 0,
      cancelacion_manchas: CARGOS_CONFIG.cancelacion_manchas.fijo || 0,
    };
  };

  // Calcular cargos por defecto solo al activar el switch (no al editar manualmente)
  const prevCargosActivosRef = useRef(false);
  useEffect(() => {
    if (creditForm.conCargosAdicionales && !prevCargosActivosRef.current && creditForm.monto_credito) {
      const montoNumerico = parseFloat(parseCurrencyToNumber(creditForm.monto_credito));
      if (!isNaN(montoNumerico) && montoNumerico > 0) {
        const cargosCalculados = calcularCargosDefault(montoNumerico, creditForm.category);
        setCargosAdicionales(cargosCalculados);
      }
    }
    prevCargosActivosRef.current = creditForm.conCargosAdicionales;
  }, [creditForm.conCargosAdicionales]);

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

    // El monto_credito siempre debe ser el monto ORIGINAL (sin restar deducciones)
    // Las deducciones se guardan en cargos_adicionales y se calculan después

    const payload: Record<string, any> = {
      reference: creditForm.reference,
      title: creditForm.title,
      status: creditForm.status,
      category: creditForm.category,
      monto_credito: montoNumerico, // Enviar monto ORIGINAL sin restar deducciones
      lead_id: leadIdNumerico,
      description: creditForm.description,
      divisa: creditForm.divisa,
      plazo: plazoNumerico,
      poliza: creditForm.poliza,
      deductora_id: selectedDeductora !== 'sin_deductora' ? parseInt(selectedDeductora) : null,
    };

    if (cargosParaEnviar) {
      payload.cargos_adicionales = cargosParaEnviar;
    }

    if (selectedManchas.length > 0) {
      payload.manchas_canceladas = selectedManchas;
    }

    try {
      const response = await api.post('/api/credits', payload);
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      }

      const createdId = response.data?.data?.id || response.data?.id;
      toast({
        title: "Crédito creado",
        description: `El crédito ${response.data?.data?.reference || response.data?.reference || ''} se ha creado. Redirigiendo...`,
        duration: 1500,
      });
      if (createdId) {
        setTimeout(() => router.push(`/dashboard/creditos/${createdId}`), 1500);
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
      <DialogContent className={`max-w-5xl ${creditForm.conCargosAdicionales ? 'max-h-[97vh]' : 'max-h-[95vh]'} overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle>Nuevo Crédito - Paso {currentStep} de {creditForm.conCargosAdicionales ? 2 : 1}</DialogTitle>
          <DialogDescription>Completa la información del crédito.</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        {creditForm.conCargosAdicionales && (
          <div className="flex items-center justify-between mb-2 px-8">
            {[1, 2].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    step === currentStep
                      ? 'bg-blue-600 text-white'
                      : step < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < currentStep ? <Check className="w-4 h-4" /> : step}
                </div>
                {step < 2 && (
                  <div
                    className={`h-1 w-24 mx-2 ${
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
                disabled={!!initialData.title}
                className={initialData.title ? 'bg-gray-50' : ''}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Input
                id="status"
                value={creditForm.status}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              {initialData.category ? (
                <Input
                  id="category"
                  value={creditForm.category}
                  disabled
                  className="bg-gray-50"
                />
              ) : (
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
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="divisa">Divisa</Label>
              <Input
                id="divisa"
                value={creditForm.divisa}
                disabled
                className="bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monto">Monto</Label>
              <Input
                id="monto"
                type="text"
                placeholder="₡0.00"
                value={initialData.monto_credito ? formatCurrency(creditForm.monto_credito) : (creditForm.monto_credito || '')}
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
                disabled={!!initialData.monto_credito}
                className={initialData.monto_credito ? 'bg-gray-50' : ''}
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
                disabled={!!initialData.plazo}
                className={initialData.plazo ? 'bg-gray-50' : ''}
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Deductora</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedDeductora === 'sin_deductora' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDeductora('sin_deductora')}
                >
                  Sin deductora
                </Button>
                {deductoras.map((d) => (
                  <Button
                    key={d.id}
                    type="button"
                    variant={selectedDeductora === String(d.id) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedDeductora(String(d.id))}
                  >
                    {d.nombre}
                  </Button>
                ))}
              </div>
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
                      disabled={creditForm.category !== 'Regular'}
                    />
                    <Label htmlFor="poliza" className="text-sm text-muted-foreground">
                      {creditForm.category !== 'Regular'
                        ? 'Solo disponible para crédito Regular'
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
                {(['comision', 'transporte', 'respaldo_deudor', 'descuento_factura'] as const).map((campo) => {
                  const labels: Record<string, string> = {
                    comision: 'Comisión',
                    transporte: 'Transporte',
                    respaldo_deudor: 'Respaldo Deudor',
                    descuento_factura: 'Descuento de Factura',
                  };
                  const val = cargosAdicionales[campo];
                  const displayValue = editingCargo === campo
                    ? (val || '')
                    : (val ? val.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
                  return (
                    <div key={campo}>
                      <Label htmlFor={campo}>{labels[campo]}</Label>
                      <Input
                        id={campo}
                        type="text"
                        value={displayValue}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d.]/g, '');
                          setCargosAdicionales(prev => ({ ...prev, [campo]: raw === '' ? 0 : parseFloat(raw) }));
                        }}
                        onFocus={() => setEditingCargo(campo)}
                        onBlur={() => setEditingCargo(null)}
                        placeholder="0.00"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Cancelación de Manchas */}
              <div className="mt-4 pt-4 border-t">
                <Label className="text-sm font-semibold">Cancelación de Manchas</Label>
                {manchasDetalle && manchasDetalle.filter(m => Number(m.monto) > 0).length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {manchasDetalle.map((mancha) => {
                      if (Number(mancha.monto) <= 0) return null;
                      const isSelected = selectedManchas.includes(mancha.id);
                      return (
                        <label
                          key={mancha.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-orange-50 border-orange-300'
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              const newSelected = isSelected
                                ? selectedManchas.filter(i => i !== mancha.id)
                                : [...selectedManchas, mancha.id];
                              setSelectedManchas(newSelected);
                              const total = manchasDetalle
                                .filter(m => newSelected.includes(m.id))
                                .reduce((sum, m) => sum + Number(m.monto), 0);
                              setCargosAdicionales(prev => ({ ...prev, cancelacion_manchas: total }));
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{mancha.descripcion}</p>
                          </div>
                          <span className="text-sm font-semibold text-orange-700">
                            {formatCurrency(mancha.monto)}
                          </span>
                        </label>
                      );
                    })}
                    <div className="flex justify-between items-center pt-2 text-sm">
                      <span className="text-muted-foreground">Total manchas seleccionadas:</span>
                      <span className="font-bold text-orange-700">{formatCurrency(cargosAdicionales.cancelacion_manchas)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Input
                      id="cancelacion_manchas"
                      type="text"
                      value={editingCargo === 'cancelacion_manchas'
                        ? (cargosAdicionales.cancelacion_manchas || '')
                        : (cargosAdicionales.cancelacion_manchas ? cargosAdicionales.cancelacion_manchas.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^\d.]/g, '');
                        setCargosAdicionales(prev => ({ ...prev, cancelacion_manchas: raw === '' ? 0 : parseFloat(raw) }));
                      }}
                      onFocus={() => setEditingCargo('cancelacion_manchas')}
                      onBlur={() => setEditingCargo(null)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">No hay manchas registradas en el análisis. Ingrese el monto manualmente.</p>
                  </div>
                )}
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
                      cargosAdicionales.descuento_factura -
                      cargosAdicionales.cancelacion_manchas
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
                  <div className="flex justify-between">
                    <span>Cancelación de Manchas:</span>
                    <span className="font-medium">{formatCurrency(cargosAdicionales.cancelacion_manchas)}</span>
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
