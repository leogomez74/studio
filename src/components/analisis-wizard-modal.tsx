'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Check, Plus, X, FolderOpen, Loader2, FileText, File, Image as ImageIcon, FileSpreadsheet, Trash } from 'lucide-react';
import { formatCurrency } from '@/lib/analisis';
import api from '@/lib/axios';
import { useToast } from '@/hooks/use-toast';
import type {
  DeduccionMensual,
  ManchaDetalle,
  JuicioDetalle,
  EmbargoDetalle
} from '@/lib/analisis';

// Tipo para archivos del filesystem
interface OpportunityFile {
  name: string;
  path: string;
  url: string;
  size: number;
  last_modified: number;
}

interface AnalisisWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  monto_solicitado?: number;
  producto?: string;
  divisa?: string;
  onSuccess: () => void;
  onTipoChange?: (newTipo: string) => void;
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
  plazo: '',
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
  onSuccess,
  onTipoChange
}: AnalisisWizardModalProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extraMonths, setExtraMonths] = useState(0);
  const [users, setUsers] = useState<Array<{ id: number; name: string }>>([]);
  const [leadData, setLeadData] = useState<{ profesion?: string; puesto?: string; estado_puesto?: string } | null>(null);
  const [loanConfigs, setLoanConfigs] = useState<Record<string, { nombre: string; monto_minimo: number; monto_maximo: number }>>({});
  const [montoError, setMontoError] = useState<string>('');

  // Estados para archivos (Paso 4)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Estados para validación de cambio de tipo de crédito
  const [currentProducto, setCurrentProducto] = useState<string>(producto || 'Micro Crédito');

  // Sincronizar currentProducto con prop producto
  useEffect(() => {
    if (producto) {
      console.log('[PRODUCTO RECIBIDO]', { producto });
      setCurrentProducto(producto);
    }
  }, [producto]);

  // Cargar usuarios y datos del lead al abrir el modal
  useEffect(() => {
    if (open && opportunityId) {
      // Cargar usuarios y luego configurar responsable por defecto desde automatizaciones
      Promise.all([
        api.get('/api/agents'),
        api.get('/api/task-automations'),
      ]).then(([usersRes, autoRes]) => {
        setUsers(usersRes.data);
        const automations = Array.isArray(autoRes.data) ? autoRes.data : [];
        const analisisAuto = automations.find((a: any) => a.event_type === 'analisis_created');
        if (analisisAuto?.assigned_to) {
          setFormData(prev => ({ ...prev, assigned_to: String(analisisAuto.assigned_to) }));
        }
      }).catch(err => console.error('Error loading users/automations:', err));

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

      // Cargar configuraciones de préstamos para validación
      api.get('/api/loan-configurations/rangos')
        .then(res => {
          console.log('[LOAN CONFIGS LOADED]', res.data);
          setLoanConfigs(res.data);
        })
        .catch(err => console.error('Error loading loan configs:', err));
    }
  }, [open, opportunityId]);

  // Validar monto sugerido según tipo de crédito
  useEffect(() => {
    const monto = parseFloat(formData.monto_sugerido) || 0;
    if (!monto || !currentProducto || Object.keys(loanConfigs).length === 0) {
      setMontoError('');
      return;
    }

    console.log('[Validación Monto]', { monto, currentProducto, loanConfigs });

    // Determinar el tipo de crédito actual
    const esMicroCredito = currentProducto.toLowerCase().includes('micro');
    const tipoCredito = esMicroCredito ? 'microcredito' : 'regular';
    const config = loanConfigs[tipoCredito];

    if (!config) {
      console.warn('[Validación Monto] Configuración no encontrada para tipo:', tipoCredito);
      return;
    }

    console.log('[Validación Monto]', { esMicroCredito, tipoCredito, config });

    // Cambio automático: Si es Micro Crédito y monto sobrepasa el máximo → cambiar a Crédito
    if (esMicroCredito && monto > config.monto_maximo) {
      console.log('[CAMBIO AUTOMÁTICO] Micro Crédito → Crédito', { monto, max: config.monto_maximo });
      const regularConfig = loanConfigs['regular'];

      if (regularConfig && monto >= regularConfig.monto_minimo && monto <= regularConfig.monto_maximo) {
        // El monto cabe en el rango de Crédito → cambio automático
        setCurrentProducto('Crédito');
        setMontoError('');
        toast({
          title: "Tipo de crédito actualizado",
          description: `El monto ingresado excede el límite de Micro Crédito. Se cambió automáticamente a Crédito.`,
        });
      } else {
        // Monto demasiado alto incluso para crédito regular
        const maxFormatted = formatCurrency(config.monto_maximo);
        setMontoError(`El monto debe estar entre ${formatCurrency(config.monto_minimo)} y ${maxFormatted} para ${config.nombre}.`);
      }
    }
    // Cambio automático: Si es Crédito y monto es menor al mínimo → cambiar a Micro Crédito
    else if (!esMicroCredito && monto < config.monto_minimo) {
      console.log('[CAMBIO AUTOMÁTICO] Crédito → Micro Crédito', { monto, min: config.monto_minimo });
      const microConfig = loanConfigs['microcredito'];

      if (microConfig && monto >= microConfig.monto_minimo && monto <= microConfig.monto_maximo) {
        // El monto cabe en el rango de Micro Crédito → cambio automático
        setCurrentProducto('Micro Crédito');
        setMontoError('');
        toast({
          title: "Tipo de crédito actualizado",
          description: `El monto ingresado está por debajo del mínimo de Crédito. Se cambió automáticamente a Micro Crédito.`,
        });
      } else {
        // Monto demasiado bajo incluso para micro crédito
        const minFormatted = formatCurrency(config.monto_minimo);
        setMontoError(`El monto debe estar entre ${minFormatted} y ${formatCurrency(config.monto_maximo)} para ${config.nombre}.`);
      }
    }
    // Validación normal si no hay cambio de tipo
    else if (monto < config.monto_minimo || monto > config.monto_maximo) {
      const minFormatted = formatCurrency(config.monto_minimo);
      const maxFormatted = formatCurrency(config.monto_maximo);
      setMontoError(`El monto debe estar entre ${minFormatted} y ${maxFormatted} para ${config.nombre}.`);
    } else {
      setMontoError('');
    }
  }, [formData.monto_sugerido, currentProducto, loanConfigs, toast]);

  // Actualizar opportunity_type cuando cambia currentProducto automáticamente
  useEffect(() => {
    // Solo actualizar si currentProducto es diferente del producto original
    // y si ya se han cargado los loan configs (para evitar updates en mount inicial)
    if (!producto || !currentProducto || Object.keys(loanConfigs).length === 0) {
      return;
    }

    if (currentProducto !== producto) {
      console.log('[UPDATE OPPORTUNITY TYPE]', { from: producto, to: currentProducto, opportunityId });

      // Actualizar la oportunidad con el nuevo tipo
      api.put(`/api/opportunities/${opportunityId}`, { opportunity_type: currentProducto })
        .then(() => {
          console.log('[OPPORTUNITY TYPE UPDATED]', currentProducto);
          // Notificar al padre que el tipo cambió
          if (onTipoChange) {
            onTipoChange(currentProducto);
          }
        })
        .catch(err => {
          console.error('[ERROR UPDATING OPPORTUNITY TYPE]', err);
        });
    }
  }, [currentProducto, producto, opportunityId, loanConfigs, onTipoChange]);

  // Calcular cuota automáticamente cuando cambian monto_sugerido o plazo
  useEffect(() => {
    const monto = parseFloat(formData.monto_sugerido) || 0;
    const plazoMeses = parseInt(formData.plazo) || 0;

    if (monto > 0 && plazoMeses > 0) {
      // Determinar la tasa de interés según el tipo de producto actual
      const esMicroCredito = currentProducto?.toLowerCase().includes('micro') || false;
      const tasaAnual = esMicroCredito ? 54 : 36; // 54% para micro, 36% para regular

      // Fórmula del sistema de amortización francés (PMT)
      const tasaMensual = (tasaAnual / 100) / 12;
      const power = Math.pow(1 + tasaMensual, plazoMeses);
      const cuotaCalculada = monto * ((tasaMensual * power) / (power - 1));

      setFormData(prev => ({ ...prev, cuota: cuotaCalculada.toFixed(2) }));
    } else {
      setFormData(prev => ({ ...prev, cuota: '' }));
    }
  }, [formData.monto_sugerido, formData.plazo, currentProducto]);

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

  // Helper functions para archivos
  const isImageFile = (fileName: string) => {
    return fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
  };

  const isPdfFile = (fileName: string) => {
    return fileName.toLowerCase().endsWith('.pdf');
  };

  const getFileTypeInfo = (fileName: string) => {
    const name = fileName.toLowerCase();
    if (name.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      return { icon: ImageIcon, label: 'Imagen', color: 'text-purple-600' };
    }
    if (name.endsWith('.pdf')) {
      return { icon: FileText, label: 'PDF', color: 'text-red-600' };
    }
    if (name.match(/\.(xls|xlsx|csv)$/)) {
      return { icon: FileSpreadsheet, label: 'Excel', color: 'text-green-600' };
    }
    if (name.match(/\.(doc|docx)$/)) {
      return { icon: FileText, label: 'Word', color: 'text-blue-600' };
    }
    return { icon: File, label: 'Archivo', color: 'text-slate-600' };
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Manejar selección de archivos (solo guardar en estado, no subir)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles = Array.from(files);
    setSelectedFiles(prev => [...prev, ...newFiles]);

    toast({
      title: "Archivos seleccionados",
      description: `${newFiles.length} archivo(s) agregado(s). Se subirán al crear el análisis.`
    });

    // Reset input
    e.target.value = '';
  };

  // Eliminar archivo de la lista (antes de subir)
  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Subir todos los archivos seleccionados
  const uploadSelectedFiles = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append('file', file);

        try {
          await api.post(`/api/opportunities/${opportunityId}/files`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          successCount++;
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        throw new Error(`${errorCount} archivo(s) no se pudieron subir`);
      }
    } finally {
      setUploading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    // Validar plazo obligatorio en paso 1
    if (currentStep === 1) {
      const plazoValue = parseInt(formData.plazo);
      if (!formData.plazo || isNaN(plazoValue) || plazoValue < 1) {
        return;
      }
      // Validar que no haya errores de monto
      if (montoError) {
        return;
      }
    }
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    // Validar plazo obligatorio
    const plazoValue = parseInt(formData.plazo);
    if (!formData.plazo || isNaN(plazoValue) || plazoValue < 1) {
      setCurrentStep(1);
      return;
    }

    // Validar que haya archivos seleccionados
    if (selectedFiles.length === 0) {
      toast({
        title: "Archivos requeridos",
        description: "Debe agregar al menos un documento específico de la oportunidad.",
        variant: "destructive"
      });
      setCurrentStep(4);
      return;
    }

    setIsSubmitting(true);
    try {
      // Primero subir los archivos
      await uploadSelectedFiles();
      // Construir payload con todos los datos
      const payload: any = {
        opportunity_id: opportunityId,
        title: `Análisis ${opportunityId}`,
        category: currentProducto || 'Micro Crédito',
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
      setExtraMonths(0);
      setSelectedFiles([]);

      const createdId = response.data?.data?.id || response.data?.id;
      toast({
        title: "Análisis creado",
        description: "Redirigiendo al análisis...",
        duration: 1500,
      });
      if (createdId) {
        setTimeout(() => router.push(`/dashboard/analisis/${createdId}`), 1500);
      }
    } catch (error: any) {
      console.error('Error completo:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Error al crear análisis';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subir Análisis - Paso {currentStep} de 4</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((step) => (
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
              {step < 4 && (
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
                  <div className="flex items-center gap-2">
                    <Input
                      id="producto"
                      value={currentProducto || 'Micro Crédito'}
                      readOnly
                      className="bg-muted"
                    />
                    {currentProducto !== producto && (
                      <Badge variant="default" className="whitespace-nowrap">
                        Tipo cambiado
                      </Badge>
                    )}
                  </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="monto_sugerido">Monto Sugerido *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                    <Input
                      id="monto_sugerido"
                      type="text"
                      inputMode="numeric"
                      className={`pl-7 ${montoError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      value={formatNumber(formData.monto_sugerido)}
                      onChange={(e) => updateFormData('monto_sugerido', parseNumber(e.target.value))}
                      placeholder="Ingresar monto sugerido"
                      required
                    />
                  </div>
                  {montoError && (
                    <p className="text-sm text-red-500 mt-1">{montoError}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="plazo">Plazo (Meses) *</Label>
                  <Input
                    id="plazo"
                    type="number"
                    min="1"
                    max="120"
                    value={formData.plazo}
                    onChange={(e) => updateFormData('plazo', e.target.value)}
                    placeholder="Ingresar plazo"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
        {currentStep === 2 && (() => {
          // Determinar meses según tipo de crédito
          const esMicroCredito = currentProducto?.toLowerCase().includes('micro') || false;
          const fixedMonths = esMicroCredito ? 3 : 6;
          const maxExtra = 0; // No permitir agregar meses adicionales
          const totalMonths = fixedMonths + extraMonths;

          const removeExtraMonth = (mes: number) => {
            // Clear data for the removed month
            const brutoProp = `ingreso_bruto${mes > 1 ? `_${mes}` : ''}`;
            updateFormData(brutoProp, '');
            const newDeducciones = formData.deducciones_mensuales.filter(d => d.mes !== mes);
            updateFormData('deducciones_mensuales', newDeducciones);
            setExtraMonths(prev => Math.max(0, prev - 1));
          };

          return (
            <Card>
              <CardHeader>
                <CardTitle>Ingresos Mensuales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {Array.from({ length: totalMonths }, (_, i) => i + 1).map((mes) => {
                  const brutoProp = `ingreso_bruto${mes > 1 ? `_${mes}` : ''}` as keyof FormData;
                  const bruto = parseFloat(formData[brutoProp] as string) || 0;
                  const deduccion = formData.deducciones_mensuales.find(d => d.mes === mes);
                  const ingresoNeto = bruto - (deduccion?.monto || 0);
                  const isExtra = mes > fixedMonths;

                  return (
                    <div key={mes} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm text-gray-700">Mes {mes}</h4>
                        {isExtra && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-500"
                            onClick={() => removeExtraMonth(mes)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

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
                              onChange={(e) => {
                                const value = parseNumber(e.target.value);
                                updateFormData(brutoProp as string, value);

                                // Si es el Mes 1, auto-llenar los demás meses según el tipo de crédito
                                if (mes === 1) {
                                  updateFormData('ingreso_bruto_2', value);
                                  updateFormData('ingreso_bruto_3', value);
                                  if (!esMicroCredito) {
                                    updateFormData('ingreso_bruto_4', value);
                                    updateFormData('ingreso_bruto_5', value);
                                    updateFormData('ingreso_bruto_6', value);
                                  }
                                }
                              }}
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

                {maxExtra > 0 && extraMonths < maxExtra && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setExtraMonths(prev => prev + 1)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar mes ({extraMonths + fixedMonths + 1} de {fixedMonths + maxExtra})
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })()}

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
                          fecha: '',
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
                          <Label htmlFor={`mancha_fecha_${index}`}>Fecha</Label>
                          <Input
                            id={`mancha_fecha_${index}`}
                            type="date"
                            value={mancha.fecha}
                            onChange={(e) => {
                              const newManchas = [...formData.manchas_detalle];
                              newManchas[index].fecha = e.target.value;
                              updateFormData('manchas_detalle', newManchas);
                            }}
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
                          <Label htmlFor={`juicio_fecha_${index}`}>
                            {juicio.estado === 'cerrado' ? 'Fecha de Cierre' : 'Fecha de Inicio'}
                          </Label>
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

        {/* Step 4: Documentos Específicos */}
        {currentStep === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-green-500" />
                Específicos de Oportunidad
                <Badge variant="secondary" className="ml-auto">{selectedFiles.length}</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">Archivos que se subirán al crear el análisis</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload para documentos específicos */}
              <div className="flex items-center gap-4 pb-3 border-b">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="file-upload">Agregar documento específico a esta oportunidad *</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              {/* Lista de archivos seleccionados */}
              {selectedFiles.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <FolderOpen className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">Sin archivos seleccionados</p>
                  <p className="text-xs text-muted-foreground mt-1">Debe agregar al menos un documento</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {selectedFiles.map((file, index) => {
                    const { icon: FileIcon, color } = getFileTypeInfo(file.name);
                    return (
                      <div key={index} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileIcon className={`h-8 w-8 flex-shrink-0 ${color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => handleRemoveFile(index)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
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

          {currentStep < 4 ? (
            <Button
              onClick={nextStep}
              disabled={currentStep === 1 && montoError !== ''}
            >
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
