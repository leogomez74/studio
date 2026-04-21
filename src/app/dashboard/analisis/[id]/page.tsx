'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, ThumbsUp, ThumbsDown, ArrowLeft, File, Image as ImageIcon, FileSpreadsheet, FolderInput, Pencil, Download, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, CheckCircle, ChevronDown, ChevronUp, AlertTriangle, Plus } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import { usePermissions } from '@/contexts/PermissionsContext';
import { TareasTab } from '@/components/TareasTab';
import {
  findEmpresaByName,
  getFileExtension,
  matchesRequirement,
  Requirement,
  Empresa
} from '@/lib/empresas-mock';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { CreditFormModal } from '@/components/CreditFormModal';
import {
  AnalisisItem,
  AnalisisFile,
  Propuesta,
  formatCurrency,
  formatFileSize,
} from '@/lib/analisis';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Helper functions for currency
const parseCurrencyToNumber = (value: string): string => {
  let cleaned = value.replace(/[₡$]/g, '');
  cleaned = cleaned.replace(/\s/g, '');
  cleaned = cleaned.replace(/,/g, '');
  cleaned = cleaned.replace(/[^\d.]/g, '');
  return cleaned;
};

export default function AnalisisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const analisisId = params.id as string;

  const [analisis, setAnalisis] = useState<AnalisisItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para estado_pep y estado_cliente
  const [estadoPep, setEstadoPep] = useState<string | null>('Pendiente');
  const [estadoCliente, setEstadoCliente] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Estados editables (solo cuando estado_pep === 'Pendiente de cambios')
  const [editMontoCredito, setEditMontoCredito] = useState<number>(0);
  const [editPlazo, setEditPlazo] = useState<number>(36);
  const [saving, setSaving] = useState(false);

  // Loan configurations para validación de montos
  const [loanConfigs, setLoanConfigs] = useState<Record<string, { nombre: string; monto_minimo: number; monto_maximo: number }>>({});

  // Propuestas state
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [loadingPropuestas, setLoadingPropuestas] = useState(false);
  const [propuestaForm, setPropuestaForm] = useState({
    monto: '',
    plazo: '',
    // cuota: '',
    // interes: '',
    // categoria: '',
  });
  const [savingPropuesta, setSavingPropuesta] = useState(false);
  const [editingPropuesta, setEditingPropuesta] = useState<Propuesta | null>(null);

  // Estado para modal de rechazo de propuesta
  const [propuestaToReject, setPropuestaToReject] = useState<Propuesta | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [rejectingPropuesta, setRejectingPropuesta] = useState(false);

  // Estados para archivos del filesystem
  const [heredados, setHeredados] = useState<AnalisisFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Verificación manual de documentos (key: requirement name, value: boolean)
  const [manualVerifications, setManualVerifications] = useState<Record<string, boolean>>({});

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  // Empresa encontrada basada en institucion_labora del lead
  const [empresaMatch, setEmpresaMatch] = useState<Empresa | undefined>(undefined);

  // Estado del modal de crédito
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
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
    deductora_id: undefined as number | undefined,
    opportunity_id: undefined as number | undefined,
  });
  const [products, setProducts] = useState<Array<{ id: number; name: string; }>>([]);
  const [leads, setLeads] = useState<Array<{ id: number; name?: string; deductora_id?: number; }>>([]);
  const [isSaving, setIsSaving] = useState(false);

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
      descuento_factura: 0,
    };
  };

  // Estados para collapsibles de historial crediticio
  const [manchasOpen, setManchasOpen] = useState(false);
  const [juiciosOpen, setJuiciosOpen] = useState(false);
  const [embargosOpen, setEmbargosOpen] = useState(false);

  // Estados para agregar embargo manual
  const [embargoDialogOpen, setEmbargoDialogOpen] = useState(false);
  const [newEmbargo, setNewEmbargo] = useState({ fecha_inicio: '', motivo: '', monto: '' });
  const [savingEmbargo, setSavingEmbargo] = useState(false);

  const handleAddEmbargo = async () => {
    if (!newEmbargo.fecha_inicio || !newEmbargo.motivo.trim()) {
      toast({ title: 'Error', description: 'La fecha y el motivo son requeridos.', variant: 'destructive' });
      return;
    }
    try {
      setSavingEmbargo(true);
      const embargoNuevo = {
        fecha_inicio: newEmbargo.fecha_inicio,
        motivo: newEmbargo.motivo.trim(),
        monto: parseFloat(newEmbargo.monto) || 0,
      };
      const detallesActuales = analisis?.embargo_detalles ?? [];
      const nuevosDetalles = [...detallesActuales, embargoNuevo];
      await api.put(`/api/analisis/${analisisId}`, {
        embargos_detalle: nuevosDetalles,
        numero_embargos: nuevosDetalles.length,
      });
      setAnalisis(prev => prev ? {
        ...prev,
        embargo_detalles: nuevosDetalles,
        numero_embargos: nuevosDetalles.length,
      } : null);
      setEmbargoDialogOpen(false);
      setNewEmbargo({ fecha_inicio: '', motivo: '', monto: '' });
      toast({ title: 'Embargo registrado', description: 'El embargo se agregó correctamente.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar el embargo.', variant: 'destructive' });
    } finally {
      setSavingEmbargo(false);
    }
  };

  // Estados para consulta Credid
  const [credidLoading, setCredidLoading] = useState(false);
  const [credidData, setCredidData] = useState<any>(null);
  const [credidDialogOpen, setCredidDialogOpen] = useState(false);
  const [credidApplying, setCredidApplying] = useState(false);

  // Consultar Credid API
  const handleConsultarCredid = async () => {
    const cedula = lead?.cedula;
    if (!cedula) {
      toast({ title: 'Error', description: 'No se encontró la cédula del lead.', variant: 'destructive' });
      return;
    }
    try {
      setCredidLoading(true);
      const res = await api.get('/api/credid/reporte', { params: { cedula } });
      if (res.data.success) {
        setCredidData(res.data.datos_analisis);
        setCredidDialogOpen(true);
      } else {
        toast({ title: 'Error', description: res.data.message || 'No se pudo obtener el reporte.', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al consultar Credid.', variant: 'destructive' });
    } finally {
      setCredidLoading(false);
    }
  };

  // Aplicar datos de Credid al análisis
  const handleAplicarCredid = async () => {
    if (!credidData || !analisis) return;
    try {
      setCredidApplying(true);
      const payload: any = {
        numero_manchas: credidData.numero_manchas,
        numero_juicios: credidData.numero_juicios,
        numero_embargos: credidData.numero_embargos,
        manchas_detalle: credidData.manchas_detalle,
        juicios_detalle: credidData.juicios_detalle,
        embargos_detalle: credidData.embargos_detalle,
      };
      if (credidData.cargo) payload.cargo = credidData.cargo;
      if (credidData.nombramiento) payload.nombramiento = credidData.nombramiento;

      await api.put(`/api/analisis/${analisisId}`, payload);
      toast({ title: 'Datos aplicados', description: 'Los datos de Credid se aplicaron al análisis.' });
      setCredidDialogOpen(false);
      setCredidData(null);
      // Refrescar análisis
      const res = await api.get(`/api/analisis/${analisisId}`);
      setAnalisis(res.data as AnalisisItem);
    } catch (err: any) {
      toast({ title: 'Error', description: err.response?.data?.message || 'Error al aplicar datos.', variant: 'destructive' });
    } finally {
      setCredidApplying(false);
    }
  };

  // Cargar archivos del filesystem
  const fetchAnalisisFiles = useCallback(async () => {
    try {
      setLoadingFiles(true);
      const res = await api.get(`/api/analisis/${analisisId}/files`);
      // Combinar heredados y específicos en una sola lista
      const allFiles = [...(res.data.heredados || []), ...(res.data.especificos || [])];
      setHeredados(allFiles);
    } catch (error) {
      console.error('Error fetching analisis files:', error);
    } finally {
      setLoadingFiles(false);
    }
  }, [analisisId]);

  // Lightbox helper functions - DEBEN estar ANTES de los returns condicionales
  const getViewableFiles = useCallback(() => {
    return heredados.filter(file => {
      const name = file.name.toLowerCase();
      return name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/);
    });
  }, [heredados]);

  const openLightbox = useCallback((file: AnalisisFile) => {
    const viewableFiles = heredados.filter(f => {
      const name = f.name.toLowerCase();
      return name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/);
    });
    const index = viewableFiles.findIndex(f => f.path === file.path);
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxZoom(1);
      setLightboxOpen(true);
    }
  }, [heredados]);

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
    setLightboxZoom(1);
  }, []);

  const goToPrevious = useCallback(() => {
    const viewableFiles = heredados.filter(file => {
      const name = file.name.toLowerCase();
      return name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/);
    });
    setLightboxIndex((prev) => (prev > 0 ? prev - 1 : viewableFiles.length - 1));
    setLightboxZoom(1);
  }, [heredados]);

  const goToNext = useCallback(() => {
    const viewableFiles = heredados.filter(file => {
      const name = file.name.toLowerCase();
      return name.match(/\.(jpg|jpeg|png|gif|webp|pdf)$/);
    });
    setLightboxIndex((prev) => (prev < viewableFiles.length - 1 ? prev + 1 : 0));
    setLightboxZoom(1);
  }, [heredados]);

  useEffect(() => {
    const fetchAnalisis = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/analisis/${analisisId}`);
        const data = res.data as AnalisisItem;
        setAnalisis(data);

        // Inicializar estados
        setEstadoPep(data.estado_pep || 'Pendiente');
        setEstadoCliente(data.estado_cliente || null);

        // Inicializar campos editables
        setEditMontoCredito(data.monto_credito || 0);
        setEditPlazo(data.plazo || 36);

        // Inicializar propuestas desde eager loading
        if (data.propuestas) {
          setPropuestas(data.propuestas);
        }

        // Cargar configuraciones de préstamos para validación de propuestas
        api.get('/api/loan-configurations/rangos')
          .then(res => setLoanConfigs(res.data))
          .catch(() => {});

        // Cargar archivos del filesystem (heredados/específicos)
        fetchAnalisisFiles();

        // Buscar empresa por institucion_labora
        if (data.lead?.institucion_labora) {
          const empresa = findEmpresaByName(data.lead.institucion_labora);
          setEmpresaMatch(empresa);
        }
      } catch (err) {
        console.error('Error fetching analisis:', err);
        setError('No se pudo cargar el análisis.');
      } finally {
        setLoading(false);
      }
    };

    if (analisisId) {
      fetchAnalisis();
    }
  }, [analisisId, fetchAnalisisFiles]);

  // Cargar products y clients para el modal de crédito
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, clientsRes] = await Promise.all([
          api.get('/api/products'),
          api.get('/api/clients', { params: { per_page: 1000 } }) // Traer muchos clientes
        ]);
        setProducts(productsRes.data || []);
        const clientsData = clientsRes.data.data || clientsRes.data || [];
        setLeads(clientsData);
      } catch (error) {
        console.error('Error fetching products/clients:', error);
      }
    };
    fetchData();
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === '+' || e.key === '=') setLightboxZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setLightboxZoom(z => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, closeLightbox, goToPrevious, goToNext]);

  // Handler para actualizar estados
  const handleEstadoChange = async (field: 'estado_pep' | 'estado_cliente', value: string | null) => {
    try {
      setUpdatingStatus(true);
      const payload: Record<string, string | null> = { [field]: value };

      // Si estado_pep cambia a 'Aceptado', auto-setear estado_cliente a 'Pendiente'
      if (field === 'estado_pep' && value === 'Aceptado') {
        payload.estado_cliente = 'Pendiente';
      }

      // Si estado_pep cambia a algo diferente de 'Aceptado', limpiar estado_cliente
      if (field === 'estado_pep' && value !== 'Aceptado') {
        payload.estado_cliente = null;
      }

      await api.put(`/api/analisis/${analisisId}`, payload);

      // Actualizar estados locales juntos para que el render sea consistente
      if (field === 'estado_pep') {
        setEstadoPep(value);
        if (value === 'Aceptado') {
          setEstadoCliente('Pendiente');
          // Auto-aceptar la primera propuesta pendiente
          const propuestaPendiente = propuestas.find(p => p.estado === 'Pendiente');
          if (propuestaPendiente) {
            await handleAceptarPropuesta(propuestaPendiente.id);
          }
        } else {
          setEstadoCliente(null);
        }
      } else {
        setEstadoCliente(value);
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      const errorMessage = error?.response?.data?.message || 'Error al actualizar el estado';
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handler para guardar cambios cuando estado_pep === 'Pendiente de cambios'
  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      await api.put(`/api/analisis/${analisisId}`, {
        monto_credito: editMontoCredito,
        plazo: editPlazo,
      });
      setAnalisis(prev => prev ? {
        ...prev,
        monto_credito: editMontoCredito,
        plazo: editPlazo,
      } : null);
      toast({ title: 'Guardado', description: 'Los cambios se guardaron correctamente.' });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({ title: 'Error', description: 'No se pudieron guardar los cambios.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ===== Propuestas CRUD =====
  const fetchPropuestas = useCallback(async () => {
    if (!analisis?.reference) return;
    setLoadingPropuestas(true);
    try {
      const res = await api.get(`/api/analisis/${analisis.reference}/propuestas`);
      setPropuestas(res.data);
    } catch (err) {
      console.error('Error fetching propuestas:', err);
    } finally {
      setLoadingPropuestas(false);
    }
  }, [analisis?.reference]);

  const resetPropuestaForm = () => {
    setPropuestaForm({ monto: '', plazo: '' /*, cuota: '', interes: '', categoria: '' */ });
    setEditingPropuesta(null);
  };

  const handleSubmitPropuesta = async () => {
    if (!analisis?.reference) return;

    const monto = parseFloat(propuestaForm.monto);
    const plazo = parseInt(propuestaForm.plazo);
    // const cuota = parseFloat(propuestaForm.cuota);
    // const interes = parseFloat(propuestaForm.interes);

    if (!monto || !plazo) {
      toast({ title: 'Error', description: 'Monto y plazo son obligatorios.', variant: 'destructive' });
      return;
    }

    // Validación: Micro crédito requiere mínimo 6 meses de plazo
    if (analisis.category?.toLowerCase().includes('micro') && plazo < 6) {
      toast({
        title: 'Error',
        description: 'Para Micro crédito el plazo mínimo es de 6 meses.',
        variant: 'destructive'
      });
      return;
    }

    setSavingPropuesta(true);
    try {
      if (editingPropuesta) {
        await api.put(`/api/propuestas/${editingPropuesta.id}`, {
          monto, plazo,
          // cuota, interes,
          // categoria: propuestaForm.categoria || null,
        });
        toast({ title: 'Propuesta actualizada' });
      } else {
        await api.post(`/api/analisis/${analisis.reference}/propuestas`, {
          monto, plazo,
          // cuota, interes,
          // categoria: propuestaForm.categoria || null,
        });
        toast({ title: 'Propuesta creada' });
      }
      resetPropuestaForm();
      fetchPropuestas();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo guardar la propuesta.',
        variant: 'destructive',
      });
    } finally {
      setSavingPropuesta(false);
    }
  };

  const handleEditPropuesta = (p: Propuesta) => {
    setEditingPropuesta(p);
    setPropuestaForm({
      monto: String(p.monto),
      plazo: String(p.plazo),
      // cuota: String(p.cuota),
      // interes: String(p.interes),
      // categoria: p.categoria || '',
    });
  };

  const handleDeletePropuesta = async (id: number) => {
    try {
      await api.delete(`/api/propuestas/${id}`);
      toast({ title: 'Propuesta eliminada' });
      fetchPropuestas();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo eliminar.',
        variant: 'destructive',
      });
    }
  };

  const handleAceptarPropuesta = async (id: number) => {
    try {
      // Guardar monto de la propuesta ANTES de aceptar (el state puede cambiar después)
      const propuestaAceptada = propuestas.find(p => p.id === id);
      const montoPropuesta = propuestaAceptada?.monto || 0;

      await api.patch(`/api/propuestas/${id}/aceptar`);
      toast({ title: 'Propuesta aceptada', description: 'Las demás propuestas pendientes fueron denegadas automáticamente.' });
      fetchPropuestas();

      // Cargar loanConfigs fresh si no están disponibles
      let configs = loanConfigs;
      if (Object.keys(configs).length === 0) {
        const configRes = await api.get('/api/loan-configurations/rangos');
        configs = configRes.data;
        setLoanConfigs(configs);
      }

      // Refrescar el análisis para reflejar monto/plazo y estado_pep de la propuesta aceptada
      const resAnalisis = await api.get(`/api/analisis/${analisisId}`);
      const data = resAnalisis.data as AnalisisItem;

      // Cambio automático de categoría según monto de la propuesta aceptada
      const monto = parseFloat(String(montoPropuesta));
      if (monto > 0 && data.category && Object.keys(configs).length > 0) {
        const esMicro = data.category.toLowerCase().includes('micro');
        const tipoCredito = esMicro ? 'microcredito' : 'regular';
        const config = configs[tipoCredito];
        const configMin = parseFloat(String(config?.monto_minimo));
        const configMax = parseFloat(String(config?.monto_maximo));

        if (config) {
          let nuevoTipo: string | null = null;

          if (esMicro && monto > configMax) {
            const regularConfig = configs['regular'];
            const regMin = parseFloat(String(regularConfig?.monto_minimo));
            const regMax = parseFloat(String(regularConfig?.monto_maximo));
            if (regularConfig && monto >= regMin && monto <= regMax) {
              nuevoTipo = 'Crédito';
            }
          } else if (!esMicro && monto < configMin) {
            const microConfig = configs['microcredito'];
            const microMin = parseFloat(String(microConfig?.monto_minimo));
            const microMax = parseFloat(String(microConfig?.monto_maximo));
            if (microConfig && monto >= microMin && monto <= microMax) {
              nuevoTipo = 'Micro Crédito';
            }
          }

          if (nuevoTipo) {
            await api.put(`/api/analisis/${analisisId}`, { category: nuevoTipo });
            if (data.opportunity_id) {
              await api.put(`/api/opportunities/${data.opportunity_id}`, { opportunity_type: nuevoTipo });
            }
            data.category = nuevoTipo;
            if (data.opportunity) data.opportunity.opportunity_type = nuevoTipo;
            toast({ title: 'Tipo de crédito actualizado', description: `Se cambió automáticamente a ${nuevoTipo} según el monto de la propuesta.` });
          }
        }
      }

      setAnalisis(data);
      setEstadoPep(data.estado_pep || 'Aceptado');
      setEstadoCliente(data.estado_cliente || 'Pendiente');
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo aceptar.',
        variant: 'destructive',
      });
    }
  };

  const handleDenegarPropuesta = (propuesta: Propuesta) => {
    setPropuestaToReject(propuesta);
    setMotivoRechazo('');
  };

  const handleConfirmRechazo = async () => {
    if (!propuestaToReject) return;

    if (!motivoRechazo.trim()) {
      toast({ title: 'Error', description: 'Debe ingresar el motivo del rechazo.', variant: 'destructive' });
      return;
    }

    setRejectingPropuesta(true);
    try {
      await api.patch(`/api/propuestas/${propuestaToReject.id}/denegar`, {
        motivo_rechazo: motivoRechazo.trim()
      });
      toast({ title: 'Propuesta denegada' });
      setPropuestaToReject(null);
      setMotivoRechazo('');
      fetchPropuestas();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'No se pudo denegar.',
        variant: 'destructive',
      });
    } finally {
      setRejectingPropuesta(false);
    }
  };

  // Helper para obtener info del tipo de archivo (no depende de analisis)
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
    if (name.match(/\.(html|htm)$/)) {
      return { icon: FileText, label: 'HTML', color: 'text-orange-600' };
    }
    return { icon: File, label: 'Archivo', color: 'text-slate-600' };
  };

  const isRequirementFulfilled = (req: Requirement): { fulfilled: boolean; autoMatch: boolean; matchedFiles: AnalisisFile[] } => {
    // Buscar archivos que coincidan por nombre y extensión
    const matchedFiles = allFiles.filter(file => {
      const fileExt = getFileExtension(file.name);
      const extMatches = fileExt === req.file_extension.toLowerCase() ||
        (req.file_extension === 'jpg' && ['jpg', 'jpeg', 'png'].includes(fileExt)) ||
        (req.file_extension === 'pdf' && fileExt === 'pdf') ||
        (req.file_extension === 'html' && ['html', 'htm'].includes(fileExt));

      const nameMatches = matchesRequirement(file.name, req.name);

      return extMatches && nameMatches;
    });

    // Si hay match automático por nombre
    if (matchedFiles.length >= req.quantity) {
      return { fulfilled: true, autoMatch: true, matchedFiles };
    }

    // Si está verificado manualmente
    if (manualVerifications[req.name]) {
      return { fulfilled: true, autoMatch: false, matchedFiles };
    }

    return { fulfilled: false, autoMatch: false, matchedFiles };
  };

  // Toggle verificación manual
  const toggleManualVerification = (reqName: string) => {
    setManualVerifications(prev => ({
      ...prev,
      [reqName]: !prev[reqName]
    }));
  };

  // Requisitos por defecto si no hay empresa match
  const defaultRequirements: Requirement[] = [
    { name: 'Constancia Salarial', file_extension: 'pdf', quantity: 1 },
    { name: 'Comprobantes de Pago', file_extension: 'pdf', quantity: 6 },
  ];

  // Early returns movidos aquí para cumplir con reglas de hooks
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (error || !analisis) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-500">
          <p>{error || 'Análisis no encontrado'}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard/analisis')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver al listado
          </Button>
        </div>
      </div>
    );
  }

  // Después de los early returns, TypeScript sabe que analisis no es null
  const lead = analisis.lead;
  const allFiles = heredados;
  const isEditMode = estadoPep === 'Pendiente de cambios';
  const requirements = empresaMatch?.requirements || defaultRequirements;

  return (
    <div className="container mx-auto p-3 sm:p-6">
      {/* Header - Responsive */}
      <div className="mb-6">
        {/* Fila 1: Botón Volver + Título */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/analisis')}
            className="self-start"
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div className="flex-1">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Análisis: {analisis.reference}</h1>
            <p className="text-xs sm:text-sm text-gray-500">Revisión de datos financieros y laborales del cliente</p>
          </div>
        </div>

        {/* Fila 2: Botones de Estado - PEP izquierda, Cliente derecha */}
        {(analisis?.credit_status === 'Formalizado' || analisis?.has_credit || analisis?.credit_id) && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-700">
              {analisis?.credit_status === 'Formalizado'
                ? 'Crédito formalizado — los estados no pueden modificarse.'
                : 'Ya existe un crédito asociado a este análisis.'}
            </span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 flex-wrap">
          {/* Estado PEP - Izquierda */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Estado PEP:</span>
            {(() => {
              const transicionesPep: Record<string, string[]> = {
                'Pendiente': ['Pendiente de cambios', 'Aceptado', 'Rechazado'],
                'Pendiente de cambios': ['Aceptado', 'Rechazado'],
                'Aceptado': ['Pendiente de cambios', 'Rechazado'],
                'Rechazado': ['Pendiente de cambios'],
              };
              const currentEstado = estadoPep || 'Pendiente';
              const permitidos = transicionesPep[currentEstado] || [];
              return (['Pendiente', 'Pendiente de cambios', 'Aceptado', 'Rechazado'] as const).map((estado) => (
                <Button
                  key={estado}
                  size="sm"
                  variant={estadoPep === estado ? 'default' : 'outline'}
                  className={
                    estadoPep === estado
                      ? estado === 'Aceptado'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : estado === 'Rechazado'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : estado === 'Pendiente de cambios'
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                        : ''
                      : ''
                  }
                  disabled={updatingStatus || !hasPermission('analizados', 'delete') || analisis?.credit_status === 'Formalizado' || (estadoPep !== estado && !permitidos.includes(estado))}
                  onClick={() => handleEstadoChange('estado_pep', estado)}
                >
                  {estado}
                </Button>
              ));
            })()}
          </div>

          {/* Estado Cliente - Derecha */}
          {(estadoPep === 'Aceptado' || estadoPep === 'Pendiente de cambios') && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Estado Cliente:</span>
              {(['Pendiente', 'Aprobado', 'Rechazado'] as const).map((estado) => (
                <Button
                  key={estado}
                  size="sm"
                  variant={estadoCliente === estado ? 'default' : 'outline'}
                  className={
                    estadoCliente === estado
                      ? estado === 'Aprobado'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : estado === 'Rechazado'
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : ''
                      : ''
                  }
                  disabled={updatingStatus || !hasPermission('analizados', 'archive') || analisis?.credit_status === 'Formalizado'}
                  onClick={() => handleEstadoChange('estado_cliente', estado)}
                >
                  {estado}
                </Button>
              ))}

              {/* Botón de Crédito */}
              {estadoCliente === 'Aprobado' && (
                analisis.has_credit || analisis.credit_id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/dashboard/creditos/${analisis.credit_id}`)}
                    className="ml-2"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Ver Crédito
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={async () => {
                      try {
                        const refResponse = await api.get('/api/credits/next-reference');
                        const nextReference = refResponse.data.reference;
                        setCreditForm({
                          reference: nextReference,
                          title: [analisis.lead?.name, analisis.lead?.apellido1, analisis.lead?.apellido2].filter(Boolean).join(' ') || '',
                          status: 'Por firmar',
                          category: analisis.category || 'Regular',
                          monto_credito: analisis.monto_credito ? String(analisis.monto_credito) : '',
                          leadId: analisis.lead_id ? String(analisis.lead_id) : '',
                          clientName: [analisis.lead?.name, analisis.lead?.apellido1, analisis.lead?.apellido2].filter(Boolean).join(' ') || '',
                          description: `Crédito generado desde análisis ${analisis.reference}`,
                          divisa: analisis.divisa || 'CRC',
                          plazo: analisis.plazo ? String(analisis.plazo) : '36',
                          poliza: false,
                          conCargosAdicionales: true,
                          deductora_id: analisis.lead?.deductora_id ? Number(analisis.lead.deductora_id) : undefined,
                          opportunity_id: analisis.opportunity_id ? Number(analisis.opportunity_id) : undefined,
                        });
                        setIsCreditDialogOpen(true);
                      } catch (err) {
                        toast({
                          variant: "destructive",
                          title: "Error",
                          description: "No se pudo obtener la referencia del crédito",
                        });
                      }
                    }}
                    className="ml-2"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Generar crédito
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contenido Principal */}
      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="tareas">Tareas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="space-y-6">
            {/* Información Resumida del Análisis */}
        <Card>
          <CardContent className="pt-6">
            {/* Información del Cliente */}
            <div className="mb-4 pb-4 border-b">
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Información del Cliente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Nombre</p>
                  {lead?.id ? (
                    <Link href={`/dashboard/${lead.person_type_id === 2 ? 'clientes' : 'leads'}/${lead.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {[lead.name, lead.apellido1, lead.apellido2].filter(Boolean).join(' ')}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">N/A</span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Cédula</p>
                  <p className="text-sm font-medium">{lead?.cedula || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Estado Civil</p>
                  <p className="text-sm">{lead?.estado_civil || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Institución</p>
                  <p className="text-sm font-medium">{lead?.institucion_labora || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Puesto</p>
                  <p className="text-sm">{analisis.cargo || lead?.puesto || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Nombramiento</p>
                  <p className="text-sm">{analisis.nombramiento || lead?.estado_puesto || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Resumen Financiero */}
            <div>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Resumen Financiero</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Producto</p>
                  <Badge variant="outline" className="text-xs font-semibold">
                    {analisis.opportunity?.opportunity_type || 'No especificado'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Ingreso Neto</p>
                  <p className="text-lg font-bold text-green-600">
                    {(() => {
                      const vals = [
                        analisis.ingreso_neto, analisis.ingreso_neto_2, analisis.ingreso_neto_3,
                        analisis.ingreso_neto_4, analisis.ingreso_neto_5, analisis.ingreso_neto_6,
                        analisis.ingreso_neto_7, analisis.ingreso_neto_8, analisis.ingreso_neto_9,
                        analisis.ingreso_neto_10, analisis.ingreso_neto_11, analisis.ingreso_neto_12,
                      ].map(v => Number(v) || 0);
                      const numPeriodos = vals.filter(v => v > 0).length;
                      const esQ = numPeriodos === 6 || numPeriodos === 12;
                      const numMeses = esQ ? numPeriodos / 2 : numPeriodos;
                      const totalesMes = esQ
                        ? Array.from({ length: numMeses }, (_, mi) =>
                            (vals[mi * 2] || 0) + (vals[mi * 2 + 1] || 0)
                          ).filter(t => t > 0)
                        : vals.filter(v => v > 0);
                      const promedio = totalesMes.length > 0 ? totalesMes.reduce((a, b) => a + b, 0) / totalesMes.length : 0;
                      return '₡' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(promedio));
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground">Promedio mensual</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monto Crédito</p>
                  <p className="text-lg font-bold text-blue-600">
                    ₡{new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(analisis.monto_sugerido || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Plazo</p>
                  <p className="text-lg font-bold text-slate-700">{analisis.plazo || 36} <span className="text-sm font-normal">meses</span></p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fila 2: Manchas/Juicios/Embargos + Salarios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Resumen de Manchas/Juicios/Embargos con detalles expandibles */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Historial Crediticio</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConsultarCredid}
                disabled={credidLoading || !lead?.cedula}
                className="h-7 text-xs gap-1"
              >
                {credidLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
                Consultar Credid
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Score Interno de Riesgo */}
              {analisis.score_riesgo !== undefined && (
                <div className={`flex items-center justify-between p-3 rounded-lg border ${
                  analisis.score_riesgo_color === 'green' ? 'bg-green-50 border-green-200' :
                  analisis.score_riesgo_color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                  analisis.score_riesgo_color === 'orange' ? 'bg-orange-50 border-orange-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Score Riesgo</span>
                    <Badge variant={
                      analisis.score_riesgo_color === 'green' ? 'default' :
                      analisis.score_riesgo_color === 'red' ? 'destructive' :
                      'secondary'
                    } className={`text-sm font-bold ${
                      analisis.score_riesgo_color === 'yellow' ? 'bg-yellow-500 text-white hover:bg-yellow-600' :
                      analisis.score_riesgo_color === 'orange' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                      ''
                    }`}>
                      {analisis.score_riesgo}/100
                    </Badge>
                  </div>
                  <span className={`text-sm font-semibold ${
                    analisis.score_riesgo_color === 'green' ? 'text-green-700' :
                    analisis.score_riesgo_color === 'yellow' ? 'text-yellow-700' :
                    analisis.score_riesgo_color === 'orange' ? 'text-orange-700' :
                    'text-red-700'
                  }`}>
                    {analisis.score_riesgo_label}
                  </span>
                </div>
              )}

              {/* Manchas */}
              <Collapsible open={manchasOpen} onOpenChange={setManchasOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-2 bg-orange-50 rounded border border-orange-200 hover:bg-orange-100 transition-colors">
                    <span className="text-sm font-medium text-orange-900 flex items-center gap-2">
                      Manchas
                      {manchasOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                    <Badge variant={(analisis.numero_manchas ?? 0) > 0 ? "destructive" : "secondary"} className="text-base px-3">
                      {analisis.numero_manchas || 0}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {analisis.mancha_detalles && analisis.mancha_detalles.length > 0 ? (
                    <div className="mt-2 space-y-2 pl-4">
                      {analisis.mancha_detalles.map((mancha: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white rounded border border-orange-100 text-sm space-y-1">
                          <p className="font-medium text-gray-700">{mancha.descripcion || 'Sin descripción'}</p>
                          <p className="text-gray-600">Inicio: {new Date(mancha.fecha_inicio).toLocaleDateString('es-CR')}</p>
                          <p className="text-orange-700 font-semibold">
                            Monto: ₡{new Intl.NumberFormat('en-US').format(mancha.monto)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2 pl-4">Sin detalles</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Juicios */}
              <Collapsible open={juiciosOpen} onOpenChange={setJuiciosOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-2 bg-red-50 rounded border border-red-200 hover:bg-red-100 transition-colors">
                    <span className="text-sm font-medium text-red-900 flex items-center gap-2">
                      Juicios
                      {juiciosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                    <Badge variant={(analisis.numero_juicios ?? 0) > 0 ? "destructive" : "secondary"} className="text-base px-3">
                      {analisis.numero_juicios || 0}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {analisis.juicio_detalles && analisis.juicio_detalles.length > 0 ? (
                    <div className="mt-2 space-y-2 pl-4">
                      {analisis.juicio_detalles.map((juicio: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white rounded border border-red-100 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-700">Expediente: {juicio.expediente || '-'}</p>
                            <Badge variant={juicio.estado === 'En Trámite' ? 'destructive' : 'secondary'}>
                              {juicio.estado}
                            </Badge>
                          </div>
                          {juicio.acreedor && <p className="text-gray-800 font-medium">Acreedor: {juicio.acreedor}</p>}
                          <p className="text-gray-600">Inicio: {new Date(juicio.fecha_inicio).toLocaleDateString('es-CR')}</p>
                          <p className="text-red-700 font-semibold">
                            Monto: ₡{new Intl.NumberFormat('en-US').format(juicio.monto)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2 pl-4">Sin detalles</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Embargos */}
              <Collapsible open={embargosOpen} onOpenChange={setEmbargosOpen}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between p-2 bg-purple-50 rounded border border-purple-200 hover:bg-purple-100 transition-colors">
                    <span className="text-sm font-medium text-purple-900 flex items-center gap-2">
                      Embargos
                      {embargosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={(analisis.numero_embargos ?? 0) > 0 ? "destructive" : "secondary"} className="text-base px-3">
                        {analisis.numero_embargos || 0}
                      </Badge>
                      <span
                        role="button"
                        onClick={e => { e.stopPropagation(); setEmbargoDialogOpen(true); }}
                        className="p-1 rounded hover:bg-purple-200 text-purple-700 transition-colors"
                        title="Agregar embargo manual"
                      >
                        <Plus className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {analisis.embargo_detalles && analisis.embargo_detalles.length > 0 ? (
                    <div className="mt-2 space-y-2 pl-4">
                      {analisis.embargo_detalles.map((embargo: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white rounded border border-purple-100 text-sm space-y-1">
                          <p className="font-medium text-gray-700">{embargo.motivo || 'Sin motivo'}</p>
                          <p className="text-gray-600">Inicio: {new Date(embargo.fecha_inicio).toLocaleDateString('es-CR')}</p>
                          <p className="text-purple-700 font-semibold">
                            Monto: ₡{new Intl.NumberFormat('en-US').format(embargo.monto)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2 pl-4">Sin detalles</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Dialog: agregar embargo manual */}
              <Dialog open={embargoDialogOpen} onOpenChange={open => { setEmbargoDialogOpen(open); if (!open) setNewEmbargo({ fecha_inicio: '', motivo: '', monto: '' }); }}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Agregar embargo</DialogTitle>
                    <DialogDescription>Registra un embargo que no aparece en CREDID.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1">
                      <Label htmlFor="embargo-fecha">Fecha de inicio *</Label>
                      <Input
                        id="embargo-fecha"
                        type="date"
                        value={newEmbargo.fecha_inicio}
                        onChange={e => setNewEmbargo(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="embargo-motivo">Motivo / Acreedor *</Label>
                      <Input
                        id="embargo-motivo"
                        placeholder="Ej. Banco Nacional — Cobro judicial"
                        value={newEmbargo.motivo}
                        onChange={e => setNewEmbargo(prev => ({ ...prev, motivo: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="embargo-monto">Monto (₡)</Label>
                      <Input
                        id="embargo-monto"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={newEmbargo.monto}
                        onChange={e => setNewEmbargo(prev => ({ ...prev, monto: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEmbargoDialogOpen(false)} disabled={savingEmbargo}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddEmbargo} disabled={savingEmbargo}>
                      {savingEmbargo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Guardar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Ingresos Netos */}
          <Card>
            <CardContent className="px-4 pt-4 pb-3">
              {(() => {
                const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
                const raw = [
                  analisis.ingreso_neto, analisis.ingreso_neto_2, analisis.ingreso_neto_3,
                  analisis.ingreso_neto_4, analisis.ingreso_neto_5, analisis.ingreso_neto_6,
                  analisis.ingreso_neto_7, analisis.ingreso_neto_8, analisis.ingreso_neto_9,
                  analisis.ingreso_neto_10, analisis.ingreso_neto_11, analisis.ingreso_neto_12,
                ];
                const datos = raw.map((v, i) => ({ idx: i, val: Number(v) || 0 })).filter(p => p.val > 0);
                if (datos.length === 0) return (
                  <p className="text-sm text-gray-400 text-center py-4">No hay ingresos registrados</p>
                );

                const refDate = new Date(analisis.created_at || Date.now());
                const totalPeriodos = datos.length;

                // Regla simple: 6 o 12 periodos = quincenas (pares q1+q2 por mes)
                //               3 o 6 periodos impares = por mes (1 valor por mes)
                // Micro: 6=quincenas, 3=por mes | Regular: 12=quincenas, 6=por mes
                const esPerQuincena = totalPeriodos === 6 || totalPeriodos === 12;
                const totalMeses = esPerQuincena ? totalPeriodos / 2 : totalPeriodos;

                const getLabelFor = (idx: number): string => {
                  const d = new Date(refDate);
                  if (esPerQuincena) {
                    const mesIdx = Math.floor(idx / 2);
                    const quincena = (idx % 2) + 1;
                    d.setMonth(d.getMonth() - (totalMeses - mesIdx));
                    return `${MESES[d.getMonth()]} ${quincena}Q`;
                  } else {
                    // Por mes: solo mostrar el nombre del mes
                    d.setMonth(d.getMonth() - (totalMeses - idx));
                    return MESES[d.getMonth()];
                  }
                };

                // Promedio mensual adaptado al modo
                const valores = datos.map(p => p.val);
                const totalesMensuales = esPerQuincena
                  ? Array.from({ length: totalMeses }, (_, mi) =>
                      (datos[mi * 2]?.val || 0) + (datos[mi * 2 + 1]?.val || 0)
                    ).filter(t => t > 0)
                  : valores.filter(v => v > 0);
                const promedio = totalesMensuales.length > 0
                  ? totalesMensuales.reduce((a, b) => a + b, 0) / totalesMensuales.length
                  : 0;
                const minVal = Math.min(...valores);
                const maxVal = Math.max(...valores);
                const fmt = (n: number) => '₡' + new Intl.NumberFormat('en-US').format(Math.round(n));

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ingresos Netos</p>
                      <span className="text-[10px] text-muted-foreground">{totalPeriodos} período{totalPeriodos !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Promedio', val: promedio, cls: 'text-blue-700 bg-blue-50 border-blue-100' },
                        { label: 'Mínimo', val: minVal, cls: 'text-orange-700 bg-orange-50 border-orange-100' },
                        { label: 'Máximo', val: maxVal, cls: 'text-green-700 bg-green-50 border-green-100' },
                      ].map(s => (
                        <div key={s.label} className={`rounded-md border px-2 py-1.5 text-center ${s.cls}`}>
                          <p className="text-[10px] opacity-70 mb-0.5">{s.label}</p>
                          <p className="text-xs font-bold tabular-nums">{fmt(s.val)}</p>
                        </div>
                      ))}
                    </div>
                    {/* Barras con mes */}
                    <div className="space-y-1 max-h-[130px] overflow-y-auto pr-1">
                      {datos.map(p => {
                        const pct = maxVal > 0 ? (p.val / maxVal) * 100 : 0;
                        const isMin = p.val === minVal;
                        const isMax = p.val === maxVal;
                        return (
                          <div key={p.idx} className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-gray-500 w-14 shrink-0">{getLabelFor(p.idx)}</span>
                            <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                              <div
                                className={`h-full rounded ${isMin ? 'bg-orange-400' : isMax ? 'bg-emerald-500' : 'bg-blue-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-semibold tabular-nums w-[88px] text-right shrink-0 ${isMin ? 'text-orange-700' : isMax ? 'text-emerald-700' : 'text-gray-700'}`}>
                              {fmt(p.val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Hoja de Trabajo */}
        {analisis.hoja_trabajo_datos && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Hoja de Trabajo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {[
                { label: 'Salario Bruto', value: analisis.hoja_trabajo_datos.salario_bruto_manual ? `₡${new Intl.NumberFormat('en-US').format(Number(analisis.hoja_trabajo_datos.salario_bruto_manual))}` : null },
                { label: 'Pensión Alimentaria', value: analisis.hoja_trabajo_datos.pension_alimenticia ? `₡${new Intl.NumberFormat('en-US').format(Number(analisis.hoja_trabajo_datos.pension_alimenticia))}` : null },
                { label: 'Otro Embargo', value: analisis.hoja_trabajo_datos.otro_embargo ? `₡${new Intl.NumberFormat('en-US').format(Number(analisis.hoja_trabajo_datos.otro_embargo))}` : null },
                { label: 'Máx. Embargable', value: analisis.hoja_trabajo_datos.max_embargable != null ? `₡${new Intl.NumberFormat('en-US').format(analisis.hoja_trabajo_datos.max_embargable)}` : null, highlight: true },
                { label: 'Mín. Salario 3 Meses', value: analisis.hoja_trabajo_datos.min_salario_meses != null ? `₡${new Intl.NumberFormat('en-US').format(analisis.hoja_trabajo_datos.min_salario_meses)}` : null },
                { label: 'Salario Castigado', value: analisis.hoja_trabajo_datos.salario_castigado != null ? `₡${new Intl.NumberFormat('en-US').format(analisis.hoja_trabajo_datos.salario_castigado)}` : null },
                { label: '25% Capacidad Real', value: analisis.hoja_trabajo_datos.capacidad_real_25 != null ? `₡${new Intl.NumberFormat('en-US').format(analisis.hoja_trabajo_datos.capacidad_real_25)}` : null, highlight: true },
              ].filter(row => row.value !== null).map(row => (
                <div key={row.label} className={`flex items-center justify-between px-3 py-1.5 rounded text-xs ${row.highlight ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <span className="text-gray-600">{row.label}</span>
                  <span className={`font-semibold ${row.highlight ? 'text-blue-700' : 'text-gray-800'}`}>{row.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Fila 3: Propuestas de Crédito */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-500">Propuestas de Crédito</CardTitle>
              <Badge variant="outline" className="text-xs">
                {propuestas.length} propuesta{propuestas.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Formulario de creación/edición (solo en modo edición) */}
            {isEditMode && (
              <div className="border rounded-lg p-4 bg-slate-50 space-y-3">
                <p className="text-sm font-medium text-slate-700">
                  {editingPropuesta ? 'Editar Propuesta' : 'Nueva Propuesta'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Monto</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₡</span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        className="pl-7"
                        placeholder="0"
                        value={propuestaForm.monto ? Number(propuestaForm.monto).toLocaleString('en-US') : ''}
                        onChange={(e) => setPropuestaForm(prev => ({ ...prev, monto: e.target.value.replace(/[^\d]/g, '') }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Plazo (meses)</Label>
                    <Input
                      type="number"
                      placeholder="Agregar plazo"
                      value={propuestaForm.plazo}
                      onChange={(e) => setPropuestaForm(prev => ({ ...prev, plazo: e.target.value }))}
                    />
                  </div>
                  {/* Comentado temporalmente: cuota, interes, categoria
                  <div>
                    <Label className="text-xs">Cuota</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={propuestaForm.cuota}
                      onChange={(e) => setPropuestaForm(prev => ({ ...prev, cuota: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Interés (%)</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="33.50"
                      value={propuestaForm.interes}
                      onChange={(e) => setPropuestaForm(prev => ({ ...prev, interes: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Categoría</Label>
                    <Select
                      value={propuestaForm.categoria}
                      onValueChange={(v) => setPropuestaForm(prev => ({ ...prev, categoria: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Regular">Regular</SelectItem>
                        <SelectItem value="Micro-crédito">Micro-crédito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  */}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmitPropuesta} disabled={savingPropuesta}>
                    {savingPropuesta && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {editingPropuesta ? 'Actualizar' : 'Agregar Propuesta'}
                  </Button>
                  {editingPropuesta && (
                    <Button size="sm" variant="outline" onClick={resetPropuestaForm}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Propuestas - Vista móvil y desktop */}
            {propuestas.length > 0 ? (
              <>
                {/* Vista móvil - Cards */}
                <div className="md:hidden space-y-3">
                  {propuestas.map((p, index) => (
                    <div key={p.id} className="border rounded-lg p-4 bg-card">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {formatCurrency(p.monto)}
                          </div>
                          {p.cuota && (
                            <div className="text-xs font-medium text-blue-700 mt-0.5">
                              Cuota: {formatCurrency(p.cuota)}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {p.plazo} meses{p.cuota ? ` · ${formatCurrency(p.cuota)}/mes` : ''}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            p.estado === 'Aceptada'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : p.estado === 'Denegada'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          }
                        >
                          {p.estado}
                        </Badge>
                      </div>

                      {/* Motivo de rechazo */}
                      {p.estado === 'Denegada' && p.motivo_rechazo && (
                        <div className="text-xs text-red-600 bg-red-50 rounded p-2 mb-3">
                          <span className="font-medium">Motivo: </span>
                          {p.motivo_rechazo}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground mb-3">
                        {new Date(p.created_at).toLocaleDateString('es-CR')}
                      </div>

                      {/* Acciones */}
                      {p.estado === 'Pendiente' && (index === 0 || isEditMode) && (
                        <div className="flex gap-2 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleAceptarPropuesta(p.id)}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            Aceptar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDenegarPropuesta(p)}
                          >
                            <ThumbsDown className="h-4 w-4 mr-1" />
                            Denegar
                          </Button>
                          {isEditMode && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                              onClick={() => handleEditPropuesta(p)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}
                      {p.estado !== 'Pendiente' && p.aceptada_por_user && (
                        <div className="text-xs text-muted-foreground pt-3 border-t">
                          Procesado por {p.aceptada_por_user.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Vista desktop - Tabla */}
                <div className="hidden md:block border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Monto</TableHead>
                        <TableHead className="text-xs">Cuota</TableHead>
                        <TableHead className="text-xs">Plazo</TableHead>
                        <TableHead className="text-xs">Estado</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                        <TableHead className="text-xs">Fecha</TableHead>
                        <TableHead className="text-xs text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propuestas.map((p, index) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{formatCurrency(p.monto)}</TableCell>
                          <TableCell className="text-sm font-medium text-blue-700">{p.cuota ? formatCurrency(p.cuota) : '-'}</TableCell>
                          <TableCell className="text-sm">{p.plazo} meses</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                p.estado === 'Aceptada'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : p.estado === 'Denegada'
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              }
                            >
                              {p.estado}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            {p.estado === 'Denegada' && p.motivo_rechazo ? (
                              <span className="text-red-600 line-clamp-2" title={p.motivo_rechazo}>
                                {p.motivo_rechazo}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(p.created_at).toLocaleDateString('es-CR')}
                          </TableCell>
                          <TableCell className="text-right">
                            {p.estado === 'Pendiente' && (index === 0 || isEditMode) && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleAceptarPropuesta(p.id)}
                                  title="Aceptar"
                                >
                                  <ThumbsUp className="h-5 w-5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDenegarPropuesta(p)}
                                  title="Denegar"
                                >
                                  <ThumbsDown className="h-5 w-5" />
                                </Button>
                                {isEditMode && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-2 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                                    onClick={() => handleEditPropuesta(p)}
                                    title="Editar"
                                  >
                                    <Pencil className="h-5 w-5" />
                                  </Button>
                                )}
                              </div>
                            )}
                            {p.estado !== 'Pendiente' && p.aceptada_por_user && (
                              <span className="text-xs text-muted-foreground">
                                por {p.aceptada_por_user.name}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No hay propuestas registradas para este análisis.
              </div>
            )}
          </CardContent>
        </Card>


        {/* Fila 3: Documentos con Miniaturas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderInput className="h-4 w-4 text-blue-500" />
              Documentos
              <Badge variant="secondary" className="ml-2">{heredados.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingFiles ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : heredados.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin documentos</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {heredados.map((file) => {
                  const { icon: FileIcon, color } = getFileTypeInfo(file.name);
                  const isImage = file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
                  const isPdf = file.name.toLowerCase().endsWith('.pdf');

                  return (
                    <div
                      key={file.path}
                      className="rounded-lg border overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Miniatura más grande */}
                      <div className="h-36 bg-gray-100 flex items-center justify-center relative overflow-hidden">
                        {isImage ? (
                          <button
                            type="button"
                            onClick={() => openLightbox(file)}
                            className="w-full h-full relative group cursor-pointer"
                          >
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ) : isPdf ? (
                          <button
                            type="button"
                            onClick={() => openLightbox(file)}
                            className="w-full h-full relative bg-white group cursor-pointer"
                          >
                            <iframe
                              src={`${file.url}#toolbar=0&navpanes=0&scrollbar=0`}
                              className="absolute inset-0 w-full h-full pointer-events-none"
                              title={file.name}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                              <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FileIcon className={`h-12 w-12 ${color}`} />
                            <span className="text-[10px] uppercase font-medium text-gray-500">
                              {file.name.split('.').pop()}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Info y botón de descarga */}
                      <div className="p-3">
                        <p className="text-xs font-medium truncate mb-1" title={file.name}>
                          {file.name}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            asChild
                          >
                            <a href={file.url} download={file.name}>
                              <Download className="h-4 w-4 mr-1" />
                              <span className="text-xs">Descargar</span>
                            </a>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="tareas">
          <TareasTab projectCode={`ANA-${analisis.id}`} entityLabel="del Análisis" />
        </TabsContent>
      </Tabs>

      {/* Lightbox Dialog */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          {(() => {
            const viewableFiles = getViewableFiles();
            const currentFile = viewableFiles[lightboxIndex];
            if (!currentFile) return null;
            const isImage = currentFile.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/);
            const isPdf = currentFile.name.toLowerCase().endsWith('.pdf');

            return (
              <div className="relative w-full h-[90vh] flex flex-col">
                {/* Header con controles */}
                <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/70 to-transparent">
                  <div className="text-white">
                    <p className="text-sm font-medium truncate max-w-[300px]">{currentFile.name}</p>
                    <p className="text-xs text-white/70">{lightboxIndex + 1} de {viewableFiles.length}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isImage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:bg-white/20"
                          onClick={() => setLightboxZoom(z => Math.max(z - 0.25, 0.5))}
                        >
                          <ZoomOut className="h-5 w-5" />
                        </Button>
                        <span className="text-white text-sm min-w-[60px] text-center">{Math.round(lightboxZoom * 100)}%</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:bg-white/20"
                          onClick={() => setLightboxZoom(z => Math.min(z + 0.25, 3))}
                        >
                          <ZoomIn className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      asChild
                    >
                      <a href={currentFile.url} download={currentFile.name}>
                        <Download className="h-5 w-5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      onClick={closeLightbox}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Contenido principal */}
                <div className="flex-1 flex items-center justify-center overflow-auto p-4 pt-20">
                  {isImage ? (
                    <img
                      src={currentFile.url}
                      alt={currentFile.name}
                      className="max-w-full max-h-full object-contain transition-transform duration-200"
                      style={{ transform: `scale(${lightboxZoom})` }}
                    />
                  ) : isPdf ? (
                    <iframe
                      src={currentFile.url}
                      className="w-full h-full bg-white rounded"
                      title={currentFile.name}
                    />
                  ) : null}
                </div>

                {/* Navegación */}
                {viewableFiles.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                      onClick={goToPrevious}
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                      onClick={goToNext}
                    >
                      <ChevronRight className="h-8 w-8" />
                    </Button>
                  </>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <CreditFormModal
        open={isCreditDialogOpen}
        onOpenChange={setIsCreditDialogOpen}
        initialData={{
          reference: creditForm.reference,
          title: creditForm.title,
          monto_credito: creditForm.monto_credito,
          leadId: creditForm.leadId,
          clientName: creditForm.clientName,
          category: creditForm.category,
          divisa: creditForm.divisa,
          plazo: creditForm.plazo,
          description: creditForm.description,
          deductora_id: creditForm.deductora_id,
          opportunity_id: creditForm.opportunity_id,
        }}
        products={products}
        leads={leads}
        manchasDetalle={analisis?.mancha_detalles}
        analisisId={analisis?.id}
        onSuccess={async () => {
          // Refrescar análisis para actualizar has_credit y manchas
          const resAnalisis = await api.get(`/api/analisis/${analisisId}`);
          setAnalisis(resAnalisis.data);
        }}
      />

      {/* Modal de rechazo de propuesta */}
      <Dialog open={!!propuestaToReject} onOpenChange={(open) => !open && setPropuestaToReject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Denegar Propuesta</DialogTitle>
            <DialogDescription>
              Ingrese el motivo por el cual se rechaza esta propuesta de {propuestaToReject ? formatCurrency(propuestaToReject.monto) : ''} a {propuestaToReject?.plazo} meses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motivo-rechazo">Motivo del rechazo *</Label>
              <Textarea
                id="motivo-rechazo"
                placeholder="Escriba el motivo del rechazo..."
                value={motivoRechazo}
                onChange={(e) => setMotivoRechazo(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setPropuestaToReject(null);
                setMotivoRechazo('');
              }}
              disabled={rejectingPropuesta}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRechazo}
              disabled={rejectingPropuesta || !motivoRechazo.trim()}
            >
              {rejectingPropuesta && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barra inferior - Estado PEP izquierda, Estado Cliente derecha */}
      {(analisis?.credit_status === 'Formalizado' || analisis?.has_credit || analisis?.credit_id) && (
        <div className="flex items-center gap-2 px-3 py-1.5 mt-6 bg-amber-50 border border-amber-200 rounded-md">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span className="text-xs text-amber-700">
            {analisis?.credit_status === 'Formalizado'
              ? 'Crédito formalizado — los estados no pueden modificarse.'
              : 'Ya existe un crédito asociado a este análisis.'}
          </span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mt-6 pt-4 border-t flex-wrap">
        {/* Estado PEP - Izquierda */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Estado PEP:</span>
          {(() => {
            const transicionesPep: Record<string, string[]> = {
              'Pendiente': ['Pendiente de cambios', 'Aceptado', 'Rechazado'],
              'Pendiente de cambios': ['Aceptado', 'Rechazado'],
              'Aceptado': ['Pendiente de cambios', 'Rechazado'],
              'Rechazado': ['Pendiente de cambios'],
            };
            const currentEstado = estadoPep || 'Pendiente';
            const permitidos = transicionesPep[currentEstado] || [];
            return (['Pendiente', 'Pendiente de cambios', 'Aceptado', 'Rechazado'] as const).map((estado) => (
              <Button
                key={estado}
                size="sm"
                variant={estadoPep === estado ? 'default' : 'outline'}
                className={
                  estadoPep === estado
                    ? estado === 'Aceptado'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : estado === 'Rechazado'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : estado === 'Pendiente de cambios'
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : ''
                    : ''
                }
                disabled={updatingStatus || !hasPermission('analizados', 'delete') || analisis?.credit_status === 'Formalizado' || (estadoPep !== estado && !permitidos.includes(estado))}
                onClick={() => handleEstadoChange('estado_pep', estado)}
              >
                {estado}
              </Button>
            ));
          })()}
        </div>

        {/* Estado Cliente - Derecha */}
        {(estadoPep === 'Aceptado' || estadoPep === 'Pendiente de cambios') && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Estado Cliente:</span>
            {(['Pendiente', 'Aprobado', 'Rechazado'] as const).map((estado) => (
              <Button
                key={estado}
                size="sm"
                variant={estadoCliente === estado ? 'default' : 'outline'}
                className={
                  estadoCliente === estado
                    ? estado === 'Aprobado'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : estado === 'Rechazado'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : ''
                    : ''
                }
                disabled={updatingStatus || !hasPermission('analizados', 'archive') || analisis?.credit_status === 'Formalizado'}
                onClick={() => handleEstadoChange('estado_cliente', estado)}
              >
                {estado}
              </Button>
            ))}

            {/* Botón de Crédito */}
            {estadoCliente === 'Aprobado' && (
              analisis.has_credit || analisis.credit_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/dashboard/creditos/${analisis.credit_id}`)}
                  className="ml-2"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Ver Crédito
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="default"
                  onClick={async () => {
                    try {
                      const refResponse = await api.get('/api/credits/next-reference');
                      const nextReference = refResponse.data.reference;
                      setCreditForm({
                        reference: nextReference,
                        title: [analisis.lead?.name, analisis.lead?.apellido1, analisis.lead?.apellido2].filter(Boolean).join(' ') || '',
                        status: 'Por firmar',
                        category: analisis.category || 'Regular',
                        monto_credito: analisis.monto_credito ? String(analisis.monto_credito) : '',
                        leadId: analisis.lead_id ? String(analisis.lead_id) : '',
                        clientName: [analisis.lead?.name, analisis.lead?.apellido1, analisis.lead?.apellido2].filter(Boolean).join(' ') || '',
                        description: `Crédito generado desde análisis ${analisis.reference}`,
                        divisa: analisis.divisa || 'CRC',
                        plazo: analisis.plazo ? String(analisis.plazo) : '36',
                        poliza: false,
                        conCargosAdicionales: true,
                        deductora_id: analisis.lead?.deductora_id ? Number(analisis.lead.deductora_id) : undefined,
                        opportunity_id: analisis.opportunity_id ? Number(analisis.opportunity_id) : undefined,
                      });
                      setIsCreditDialogOpen(true);
                    } catch (err) {
                      toast({
                        variant: "destructive",
                        title: "Error",
                        description: "No se pudo obtener la referencia del crédito",
                      });
                    }
                  }}
                  className="ml-2"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Generar crédito
                </Button>
              )
            )}
          </div>
        )}
      </div>

      {/* Dialog de resultados Credid */}
      <Dialog open={credidDialogOpen} onOpenChange={setCredidDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultados Credid</DialogTitle>
            <DialogDescription>
              Revise los datos obtenidos antes de aplicarlos al análisis.
            </DialogDescription>
          </DialogHeader>

          {credidData && (
            <div className="space-y-4">
              {/* Info general */}
              <div className="grid grid-cols-2 gap-3">
                {credidData.cargo && (
                  <div>
                    <p className="text-xs text-muted-foreground">Cargo</p>
                    <p className="text-sm font-medium">{credidData.cargo}</p>
                  </div>
                )}
                {credidData.nombramiento && (
                  <div>
                    <p className="text-xs text-muted-foreground">Nombramiento</p>
                    <p className="text-sm font-medium">{credidData.nombramiento}</p>
                  </div>
                )}
                {credidData.ingreso_sugerido && !isNaN(Number(credidData.ingreso_sugerido)) && Number(credidData.ingreso_sugerido) > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground">Ingreso sugerido</p>
                    <p className="text-sm font-medium">₡{Number(credidData.ingreso_sugerido).toLocaleString()}</p>
                  </div>
                )}
                {credidData.score && (
                  <div>
                    <p className="text-xs text-muted-foreground">Score</p>
                    <Badge variant={credidData.score_color === 'Green' ? 'default' : credidData.score_color === 'Red' ? 'destructive' : 'secondary'}>
                      {credidData.score}
                    </Badge>
                  </div>
                )}
              </div>

              {/* PEP */}
              {credidData.es_pep && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm font-medium text-yellow-800 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Persona Políticamente Expuesta (PEP)
                  </p>
                  {credidData.pep_detalle && (
                    <p className="text-xs text-yellow-700 mt-1">{credidData.pep_detalle}</p>
                  )}
                </div>
              )}

              {/* Listas internacionales */}
              {credidData.listas_internacionales > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <p className="text-sm font-medium text-red-800 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Coincidencias en listas internacionales: {credidData.listas_internacionales}
                  </p>
                </div>
              )}

              {/* Resumen historial */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-orange-50 rounded border border-orange-200 text-center">
                  <p className="text-xs text-orange-700">Manchas</p>
                  <p className="text-2xl font-bold text-orange-900">{credidData.numero_manchas}</p>
                </div>
                <div className="p-3 bg-red-50 rounded border border-red-200 text-center">
                  <p className="text-xs text-red-700">Juicios</p>
                  <p className="text-2xl font-bold text-red-900">{credidData.numero_juicios}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded border border-purple-200 text-center">
                  <p className="text-xs text-purple-700">Embargos</p>
                  <p className="text-2xl font-bold text-purple-900">{credidData.numero_embargos}</p>
                </div>
              </div>

              {/* Detalle manchas */}
              {credidData.manchas_detalle?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Detalle de manchas</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {credidData.manchas_detalle.map((m: any, i: number) => (
                      <div key={i} className="text-xs p-2 bg-gray-50 rounded border">
                        <span className="font-medium">{m.descripcion}</span>
                        {m.monto > 0 && <span className="ml-2">₡{Number(m.monto).toLocaleString()}</span>}
                        <span className="ml-2 text-muted-foreground">{m.fecha_inicio}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalle juicios */}
              {credidData.juicios_detalle?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Detalle de juicios</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {credidData.juicios_detalle.map((j: any, i: number) => (
                      <div key={i} className="text-xs p-2 bg-gray-50 rounded border">
                        <span className="font-medium">{j.expediente}</span>
                        <Badge variant={j.estado === 'En Trámite' ? 'destructive' : 'secondary'} className="ml-2 text-[10px]">{j.estado}</Badge>
                        {j.monto > 0 && <span className="ml-2">₡{Number(j.monto).toLocaleString()}</span>}
                        {j.acreedor && <p className="mt-0.5 text-gray-700">{j.acreedor}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalle embargos */}
              {credidData.embargos_detalle?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Detalle de embargos</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {credidData.embargos_detalle.map((e: any, i: number) => (
                      <div key={i} className="text-xs p-2 bg-gray-50 rounded border">
                        <span className="font-medium">{e.motivo}</span>
                        {e.monto > 0 && <span className="ml-2">₡{Number(e.monto).toLocaleString()}</span>}
                        <span className="ml-2 text-muted-foreground">{e.fecha_inicio}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Referencias comerciales */}
              {credidData.referencias_comerciales?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Referencias comerciales</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {credidData.referencias_comerciales.map((r: any, i: number) => (
                      <div key={i} className="text-xs p-2 bg-gray-50 rounded border flex justify-between">
                        <span>{r.entidad}</span>
                        <span>{r.tipo} - ₡{Number(r.saldo).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCredidDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAplicarCredid} disabled={credidApplying}>
              {credidApplying && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Aplicar al análisis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
