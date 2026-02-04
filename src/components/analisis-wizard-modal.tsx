'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/analisis';
import api from '@/lib/axios';
import type {
  DeduccionMensual,
  ManchaDetalle,
  JuicioDetalle,
  EmbargoDetalle
} from '@/lib/analisis';

interface AnalisisWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  monto_solicitado?: number;
  producto?: string;
  divisa?: string;
  onSuccess: () => void;
}

interface FormData {
  // Paso 1
  monto_sugerido: string;
  cuota: string;
  plazo: string;
  assigned_to: string;

  // Paso 2
  ingreso_bruto: string;
  ingreso_bruto_2: string;
  ingreso_bruto_3: string;
  ingreso_bruto_4: string;
  ingreso_bruto_5: string;
  ingreso_bruto_6: string;
  deducciones_mensuales: DeduccionMensual[];

  // Paso 3
  numero_manchas: number;
  numero_juicios: number;
  numero_embargos: number;
  manchas_detalle: ManchaDetalle[];
  juicios_detalle: JuicioDetalle[];
  embargos_detalle: EmbargoDetalle[];
}

const initialFormData: FormData = {
  monto_sugerido: '',
  cuota: '',
  plazo: '36',
  assigned_to: '',
  ingreso_bruto: '',
  ingreso_bruto_2: '',
  ingreso_bruto_3: '',
  ingreso_bruto_4: '',
  ingreso_bruto_5: '',
  ingreso_bruto_6: '',
  deducciones_mensuales: [],
  numero_manchas: 0,
  numero_juicios: 0,
  numero_embargos: 0,
  manchas_detalle: [],
  juicios_detalle: [],
  embargos_detalle: [],
};

export function AnalisisWizardModal({
  open,
  onOpenChange,
  opportunityId,
  monto_solicitado,
  producto,
  divisa = 'CRC',
  onSuccess
}: AnalisisWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [leadData, setLeadData] = useState<{ profesion?: string; puesto?: string; estado_puesto?: string } | null>(null);

  // Cargar usuarios y datos del lead al abrir el modal
  useEffect(() => {
    if (open && opportunityId) {
      // Cargar usuarios
      api.get('/api/agents')
        .then(res => setUsers(res.data))
        .catch(err => console.error('Error loading users:', err));

      // Cargar oportunidad con lead para obtener profesion, puesto y nombramiento
      api.get(`/api/opportunities/${opportunityId}`)
        .then(res => {
          const lead = res.data.lead;
          if (lead) {
            setLeadData({
              profesion: lead.profesion,
              puesto: lead.puesto,
              estado_puesto: lead.estado_puesto
            });
          }
        })
        .catch(err => console.error('Error loading opportunity:', err));
    }
  }, [open, opportunityId]);

  // Calcular cuota automáticamente cuando cambian monto_sugerido o plazo
  useEffect(() => {
    const monto = parseFloat(formData.monto_sugerido) || 0;
    const plazoMeses = parseInt(formData.plazo) || 0;

    if (monto > 0 && plazoMeses > 0) {
      // Determinar la tasa de interés según el tipo de producto
      const esMicroCredito = producto?.toLowerCase().includes('micro') || false;
      const tasaAnual = esMicroCredito ? 54 : 36; // 54% para micro, 36% para regular

      // Fórmula del sistema de amortización francés (PMT)
      const tasaMensual = (tasaAnual / 100) / 12;
      const power = Math.pow(1 + tasaMensual, plazoMeses);
      const cuotaCalculada = monto * ((tasaMensual * power) / (power - 1));

      setFormData(prev => ({ ...prev, cuota: cuotaCalculada.toFixed(2) }));
    } else {
      setFormData(prev => ({ ...prev, cuota: '' }));
    }
  }, [formData.monto_sugerido, formData.plazo, producto]);

  // Calcular ingreso neto para cada mes
  const calcularIngresoNeto = (mes: number): number => {
    const brutoProp = `ingreso_bruto${mes > 1 ? `_${mes}` : ''}` as keyof FormData;
    const bruto = parseFloat(formData[brutoProp] as string) || 0;
    const deduccion = formData.deducciones_mensuales.find(d => d.mes === mes)?.monto || 0;
    return bruto - deduccion;
  };

  // Formatear número con separadores de miles
  const formatNumber = (value: string | number): string => {
    if (!value && value !== 0) return '';
    const num = typeof value === 'number' ? value : parseFloat(value.toString().replace(/,/g, '')) || 0;
    return num.toLocaleString('en-US');
  };

  // Parsear número formateado
  const parseNumber = (value: string): string => {
    return value.replace(/,/g, '');
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Construir payload con todos los datos
      const payload: any = {
        opportunity_id: opportunityId,
        title: `Análisis ${opportunityId}`,
        category: producto || 'Micro Crédito',
        divisa: divisa,
        monto_solicitado: monto_solicitado || null,
        monto_sugerido: parseFloat(formData.monto_sugerido),
        plazo: parseInt(formData.plazo),
        assigned_to: formData.assigned_to,
        ingreso_bruto: parseFloat(formData.ingreso_bruto) || null,
        ingreso_neto: calcularIngresoNeto(1) || null,
        ingreso_bruto_2: parseFloat(formData.ingreso_bruto_2) || null,
        ingreso_neto_2: calcularIngresoNeto(2) || null,
        ingreso_bruto_3: parseFloat(formData.ingreso_bruto_3) || null,
        ingreso_neto_3: calcularIngresoNeto(3) || null,
        ingreso_bruto_4: parseFloat(formData.ingreso_bruto_4) || null,
        ingreso_neto_4: calcularIngresoNeto(4) || null,
        ingreso_bruto_5: parseFloat(formData.ingreso_bruto_5) || null,
        ingreso_neto_5: calcularIngresoNeto(5) || null,
        ingreso_bruto_6: parseFloat(formData.ingreso_bruto_6) || null,
        ingreso_neto_6: calcularIngresoNeto(6) || null,
        deducciones_mensuales: formData.deducciones_mensuales,
        numero_manchas: formData.numero_manchas,
        numero_juicios: formData.numero_juicios,
        numero_embargos: formData.numero_embargos,
        manchas_detalle: formData.manchas_detalle,
        juicios_detalle: formData.juicios_detalle,
        embargos_detalle: formData.embargos_detalle,
      };

      // Agregar cargo y nombramiento desde los datos del lead
      if (leadData) {
        payload.cargo = leadData.puesto || null;
        payload.nombramiento = leadData.estado_puesto || null;
      }

      const response = await api.post('/api/analisis', payload);

      onSuccess();
      onOpenChange(false);
      setFormData(initialFormData);
      setCurrentStep(1);
    } catch (error: any) {
      console.error('Error completo:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error al crear análisis';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo Análisis - Paso {currentStep} de 3</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3].map((step) => (
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
              {step < 3 && (
                <div
                  className={`h-1 w-20 mx-2 ${
                    step < currentStep ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Información Básica */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Información Básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b">
                <div>
                  <Label htmlFor="reference">Referencia</Label>
                  <Input
                    id="reference"
                    value={opportunityId}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="producto">Producto</Label>
                  <Input
                    id="producto"
                    value={producto || 'Micro Crédito'}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="divisa">Divisa</Label>
                  <Input
                    id="divisa"
                    value={divisa}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label htmlFor="monto_solicitado_display">Monto Solicitado</Label>
                  <Input
                    id="monto_solicitado_display"
                    value={monto_solicitado ? formatCurrency(monto_solicitado) : 'N/A'}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="monto_sugerido">Monto Sugerido *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                  <Input
                    id="monto_sugerido"
                    type="text"
                    inputMode="numeric"
                    className="pl-7"
                    value={formatNumber(formData.monto_sugerido)}
                    onChange={(e) => updateFormData('monto_sugerido', parseNumber(e.target.value))}
                    placeholder="420,000"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="cuota">Cuota (Calculada)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                  <Input
                    id="cuota"
                    type="text"
                    className="pl-7 bg-muted"
                    value={formData.cuota ? formatNumber(formData.cuota) : 'N/A'}
                    readOnly
                    disabled
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plazo">Plazo (Meses) *</Label>
                  <Input
                    id="plazo"
                    type="number"
                    value={formData.plazo}
                    onChange={(e) => updateFormData('plazo', e.target.value)}
                    placeholder="Ingresar plazo"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="assigned_to">Responsable *</Label>
                  <Select
                    value={formData.assigned_to}
                    onValueChange={(value) => updateFormData('assigned_to', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Ingresos Mensuales */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Ingresos Mensuales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {Array.from({ length: producto?.toLowerCase().includes('micro') ? 3 : 6 }, (_, i) => i + 1).map((mes) => {
                const brutoProp = `ingreso_bruto${mes > 1 ? `_${mes}` : ''}` as keyof FormData;
                const bruto = parseFloat(formData[brutoProp] as string) || 0;
                const deduccion = formData.deducciones_mensuales.find(d => d.mes === mes);
                const ingresoNeto = bruto - (deduccion?.monto || 0);

                return (
                  <div key={mes} className="border rounded-lg p-4 space-y-3">
                    <h4 className="font-semibold text-sm text-gray-700">Mes {mes}</h4>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label htmlFor={`bruto_${mes}`}>Ingreso Bruto</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                          <Input
                            id={`bruto_${mes}`}
                            type="text"
                            inputMode="numeric"
                            className="pl-7"
                            value={formatNumber(formData[brutoProp] as string)}
                            onChange={(e) => updateFormData(brutoProp as string, parseNumber(e.target.value))}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`deduccion_${mes}`}>Deducción</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                          <Input
                            id={`deduccion_${mes}`}
                            type="text"
                            inputMode="numeric"
                            className="pl-7"
                            value={formatNumber(deduccion?.monto || '')}
                            onChange={(e) => {
                              const newMonto = parseFloat(parseNumber(e.target.value)) || 0;
                              const newDeducciones = formData.deducciones_mensuales.filter(d => d.mes !== mes);
                              if (newMonto > 0) {
                                newDeducciones.push({ mes, monto: newMonto });
                              }
                              updateFormData('deducciones_mensuales', newDeducciones);
                            }}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Ingreso Neto</Label>
                        <div className="h-10 px-3 py-2 bg-gray-100 border rounded-md flex items-center">
                          <span className="font-medium text-green-700">
                            {formatCurrency(ingresoNeto)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Historial Crediticio */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Historial Crediticio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contadores */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <Label htmlFor="numero_manchas">Número de Manchas</Label>
                  <Input
                    id="numero_manchas"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData.numero_manchas}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                      updateFormData('numero_manchas', num);
                      // Ajustar array de detalles
                      const current = formData.manchas_detalle.length;
                      if (num > current) {
                        const newItems = Array(num - current).fill(null).map(() => ({
                          descripcion: '',
                          monto: 0
                        }));
                        updateFormData('manchas_detalle', [...formData.manchas_detalle, ...newItems]);
                      } else if (num < current) {
                        updateFormData('manchas_detalle', formData.manchas_detalle.slice(0, num));
                      }
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="numero_juicios">Número de Juicios</Label>
                  <Input
                    id="numero_juicios"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData.numero_juicios}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                      updateFormData('numero_juicios', num);
                      const current = formData.juicios_detalle.length;
                      if (num > current) {
                        const newItems = Array(num - current).fill(null).map(() => ({
                          fecha: '',
                          estado: 'activo' as const,
                          expediente: '',
                          monto: 0
                        }));
                        updateFormData('juicios_detalle', [...formData.juicios_detalle, ...newItems]);
                      } else if (num < current) {
                        updateFormData('juicios_detalle', formData.juicios_detalle.slice(0, num));
                      }
                    }}
                  />
                </div>

                <div>
                  <Label htmlFor="numero_embargos">Número de Embargos</Label>
                  <Input
                    id="numero_embargos"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData.numero_embargos}
                    onChange={(e) => {
                      const num = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                      updateFormData('numero_embargos', num);
                      const current = formData.embargos_detalle.length;
                      if (num > current) {
                        const newItems = Array(num - current).fill(null).map(() => ({
                          fecha: '',
                          motivo: '',
                          monto: 0
                        }));
                        updateFormData('embargos_detalle', [...formData.embargos_detalle, ...newItems]);
                      } else if (num < current) {
                        updateFormData('embargos_detalle', formData.embargos_detalle.slice(0, num));
                      }
                    }}
                  />
                </div>
              </div>

              {/* Detalles de Manchas */}
              {formData.numero_manchas > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Detalles de Manchas</h4>
                  {formData.manchas_detalle.map((mancha, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <Badge variant="destructive">Mancha {index + 1}</Badge>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`mancha_desc_${index}`}>Descripción</Label>
                          <Input
                            id={`mancha_desc_${index}`}
                            value={mancha.descripcion}
                            onChange={(e) => {
                              const newManchas = [...formData.manchas_detalle];
                              newManchas[index].descripcion = e.target.value;
                              updateFormData('manchas_detalle', newManchas);
                            }}
                            placeholder="Descripción de la mancha"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`mancha_monto_${index}`}>Monto</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                            <Input
                              id={`mancha_monto_${index}`}
                              type="text"
                              inputMode="numeric"
                              className="pl-7"
                              value={formatNumber(mancha.monto)}
                              onChange={(e) => {
                                const newManchas = [...formData.manchas_detalle];
                                newManchas[index].monto = parseFloat(parseNumber(e.target.value)) || 0;
                                updateFormData('manchas_detalle', newManchas);
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Detalles de Juicios */}
              {formData.numero_juicios > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Detalles de Juicios</h4>
                  {formData.juicios_detalle.map((juicio, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <Badge variant="destructive">Juicio {index + 1}</Badge>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`juicio_fecha_${index}`}>Fecha</Label>
                          <Input
                            id={`juicio_fecha_${index}`}
                            type="date"
                            value={juicio.fecha}
                            onChange={(e) => {
                              const newJuicios = [...formData.juicios_detalle];
                              newJuicios[index].fecha = e.target.value;
                              updateFormData('juicios_detalle', newJuicios);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`juicio_estado_${index}`}>Estado</Label>
                          <Select
                            value={juicio.estado}
                            onValueChange={(value: 'activo' | 'cerrado') => {
                              const newJuicios = [...formData.juicios_detalle];
                              newJuicios[index].estado = value;
                              updateFormData('juicios_detalle', newJuicios);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="activo">Activo</SelectItem>
                              <SelectItem value="cerrado">Cerrado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor={`juicio_expediente_${index}`}>Número de Expediente</Label>
                          <Input
                            id={`juicio_expediente_${index}`}
                            value={juicio.expediente}
                            onChange={(e) => {
                              const newJuicios = [...formData.juicios_detalle];
                              newJuicios[index].expediente = e.target.value;
                              updateFormData('juicios_detalle', newJuicios);
                            }}
                            placeholder="Ej: EXP-2024-001"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`juicio_monto_${index}`}>Monto</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                            <Input
                              id={`juicio_monto_${index}`}
                              type="text"
                              inputMode="numeric"
                              className="pl-7"
                              value={formatNumber(juicio.monto)}
                              onChange={(e) => {
                                const newJuicios = [...formData.juicios_detalle];
                                newJuicios[index].monto = parseFloat(parseNumber(e.target.value)) || 0;
                                updateFormData('juicios_detalle', newJuicios);
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Detalles de Embargos */}
              {formData.numero_embargos > 0 && (
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Detalles de Embargos</h4>
                  {formData.embargos_detalle.map((embargo, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <Badge variant="destructive">Embargo {index + 1}</Badge>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`embargo_fecha_${index}`}>Fecha</Label>
                          <Input
                            id={`embargo_fecha_${index}`}
                            type="date"
                            value={embargo.fecha}
                            onChange={(e) => {
                              const newEmbargos = [...formData.embargos_detalle];
                              newEmbargos[index].fecha = e.target.value;
                              updateFormData('embargos_detalle', newEmbargos);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`embargo_monto_${index}`}>Monto</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                            <Input
                              id={`embargo_monto_${index}`}
                              type="text"
                              inputMode="numeric"
                              className="pl-7"
                              value={formatNumber(embargo.monto)}
                              onChange={(e) => {
                                const newEmbargos = [...formData.embargos_detalle];
                                newEmbargos[index].monto = parseFloat(parseNumber(e.target.value)) || 0;
                                updateFormData('embargos_detalle', newEmbargos);
                              }}
                              placeholder="0"
                            />
                          </div>
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor={`embargo_motivo_${index}`}>Motivo</Label>
                          <Input
                            id={`embargo_motivo_${index}`}
                            value={embargo.motivo}
                            onChange={(e) => {
                              const newEmbargos = [...formData.embargos_detalle];
                              newEmbargos[index].motivo = e.target.value;
                              updateFormData('embargos_detalle', newEmbargos);
                            }}
                            placeholder="Motivo del embargo"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>

          {currentStep < 3 ? (
            <Button onClick={nextStep}>
              Siguiente
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Análisis'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
