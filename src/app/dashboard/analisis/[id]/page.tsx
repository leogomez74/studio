'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, CheckCircle, AlertCircle, ArrowLeft, File, Image as ImageIcon, FileSpreadsheet, FolderInput, Save, Download, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/axios';
import { usePermissions } from '@/contexts/PermissionsContext';
import {
  findEmpresaByName,
  getFileExtension,
  matchesRequirement,
  Requirement,
  Empresa
} from '@/lib/empresas-mock';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  AnalisisItem,
  AnalisisFile,
  formatCurrency,
  formatFileSize,
} from '@/lib/analisis';

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
  const [editIngresoBruto, setEditIngresoBruto] = useState<number>(0);
  const [editIngresoNeto, setEditIngresoNeto] = useState<number>(0);
  const [editPropuesta, setEditPropuesta] = useState<string>('');
  const [saving, setSaving] = useState(false);

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
        setEditIngresoBruto(data.ingreso_bruto || 0);
        setEditIngresoNeto(data.ingreso_neto || 0);
        setEditPropuesta(data.propuesta || '');

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

      // Si estado_pep cambia a algo diferente de 'Aceptado', limpiar estado_cliente
      if (field === 'estado_pep' && value !== 'Aceptado') {
        payload.estado_cliente = null;
        setEstadoCliente(null);
      }

      await api.put(`/api/analisis/${analisisId}`, payload);

      if (field === 'estado_pep') {
        setEstadoPep(value);
      } else {
        setEstadoCliente(value);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error al actualizar el estado');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Handler para guardar cambios cuando estado_pep === 'Pendiente de cambios'
  const handleSaveChanges = async () => {
    try {
      setSaving(true);

      const payload = {
        monto_credito: editMontoCredito,
        ingreso_bruto: editIngresoBruto,
        ingreso_neto: editIngresoNeto,
        propuesta: editPropuesta,
      };

      await api.put(`/api/analisis/${analisisId}`, payload);

      // Actualizar el estado local
      setAnalisis(prev => prev ? {
        ...prev,
        monto_credito: editMontoCredito,
        ingreso_bruto: editIngresoBruto,
        ingreso_neto: editIngresoNeto,
        propuesta: editPropuesta,
      } : null);

      toast({ title: 'Guardado', description: 'Los cambios se guardaron correctamente.' });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast({ title: 'Error', description: 'No se pudieron guardar los cambios.', variant: 'destructive' });
    } finally {
      setSaving(false);
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
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/analisis')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Análisis: {analisis.reference}</h1>
            <p className="text-sm text-gray-500">Revisión de datos financieros y laborales del cliente</p>
          </div>
        </div>

        {/* Selectores de Estado */}
        <div className="flex items-center gap-4">
          {/* Estado PEP */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Estado PEP</Label>
            <Select
              value={estadoPep || 'Pendiente'}
              onValueChange={(v) => handleEstadoChange('estado_pep', v)}
              disabled={updatingStatus || !hasPermission('analizados', 'delete')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
                <SelectItem value="Aceptado">Aceptado</SelectItem>
                <SelectItem value="Pendiente de cambios">Pendiente de cambios</SelectItem>
                <SelectItem value="Rechazado">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Estado Cliente - Solo visible si estado_pep === 'Aceptado' */}
          {estadoPep === 'Aceptado' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Estado Cliente</Label>
              <Select
                value={estadoCliente || ''}
                onValueChange={(v) => handleEstadoChange('estado_cliente', v)}
                disabled={updatingStatus || !hasPermission('analizados', 'archive')}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sin definir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aprobado">Aprobado</SelectItem>
                  <SelectItem value="Rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Contenido Principal - Todo en una sola vista */}
      <div className="space-y-6">
        {/* Fila 1: Info Personal + Info Laboral + Datos Financieros */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Info Personal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Informacion Personal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-semibold text-xs uppercase text-gray-500 block">Nombre</span>
                <span className="text-base">{lead?.name || 'N/A'}</span>
              </div>
              <div>
                <span className="font-semibold text-xs uppercase text-gray-500 block">Cedula</span>
                <span className="text-base">{lead?.cedula || 'N/A'}</span>
              </div>
              <div>
                <span className="font-semibold text-xs uppercase text-gray-500 block">Estado Civil</span>
                <span className="text-base">{lead?.estado_civil || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Info Laboral */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Informacion Laboral</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-semibold text-xs uppercase text-gray-500 block">Institucion</span>
                <span className="text-base">{lead?.institucion_labora || 'N/A'}</span>
              </div>
              <div>
                <span className="font-semibold text-xs uppercase text-gray-500 block">Puesto</span>
                <span className="text-base">{lead?.puesto || 'N/A'}</span>
              </div>
              <div>
                <span className="font-semibold text-xs uppercase text-gray-500 block">Nombramiento</span>
                <span className="text-base">{lead?.estado_puesto || 'N/A'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Monto Solicitado */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Monto Solicitado</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditMode ? (
                <Input
                  type="number"
                  step="0.01"
                  value={editMontoCredito}
                  onChange={(e) => setEditMontoCredito(parseFloat(e.target.value) || 0)}
                  className="text-lg font-bold"
                />
              ) : (
                <div className="text-2xl font-bold text-blue-600">
                  ₡{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(analisis.monto_credito || 0)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ingreso Neto */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Ingreso Neto</CardTitle>
            </CardHeader>
            <CardContent>
              {isEditMode ? (
                <Input
                  type="number"
                  step="0.01"
                  value={editIngresoNeto}
                  onChange={(e) => setEditIngresoNeto(parseFloat(e.target.value) || 0)}
                  className="text-lg font-bold"
                />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  ₡{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(analisis.ingreso_neto || 0)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fila 2: Propuesta de Análisis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Propuesta de Analisis</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              <Textarea
                value={editPropuesta}
                onChange={(e) => setEditPropuesta(e.target.value)}
                className="min-h-[80px] text-sm"
                placeholder="Escriba la propuesta de análisis..."
              />
            ) : (
              <div className="min-h-[60px] p-3 bg-gray-50 rounded border text-sm">
                {analisis.propuesta || <span className="text-muted-foreground italic">Sin propuesta definida</span>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Indicador de modo edición */}
        {isEditMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-amber-700">
                <strong>Modo Edición:</strong> Los campos son editables. Guarda los cambios cuando termines.
              </p>
              <Button onClick={handleSaveChanges} disabled={saving} size="sm">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar Cambios
              </Button>
            </div>
          </div>
        )}

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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
    </div>
  );
}
