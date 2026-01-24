'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, CheckCircle, AlertCircle, ArrowLeft, File, Image as ImageIcon, FileSpreadsheet, FolderInput } from 'lucide-react';
import api from '@/lib/axios';
import { Lead } from '@/lib/data';
import {
  findEmpresaByName,
  getFileExtension,
  matchesRequirement,
  Requirement,
  Empresa
} from '@/lib/empresas-mock';

interface DeduccionItem {
  nombre: string;
  monto: number;
}

interface AnalisisItem {
  id: number;
  reference: string;
  monto_credito: number;
  created_at: string;
  opportunity_id?: string;
  lead_id?: string;
  lead?: Lead;
  ingreso_bruto?: number;
  ingreso_neto?: number;
  deducciones?: DeduccionItem[];
  propuesta?: string;
  estado_pep?: string;
  estado_cliente?: string | null;
}

// Tipo para archivos del filesystem
interface AnalisisFile {
  name: string;
  path: string;
  url: string;
  size: number;
  last_modified: number;
}

export default function AnalisisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const analisisId = params.id as string;

  const [analisis, setAnalisis] = useState<AnalisisItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('resumen');

  // Estados para estado_pep y estado_cliente
  const [estadoPep, setEstadoPep] = useState<string | null>('Pendiente');
  const [estadoCliente, setEstadoCliente] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Estados para archivos del filesystem
  const [heredados, setHeredados] = useState<AnalisisFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Verificación manual de documentos (key: requirement name, value: boolean)
  const [manualVerifications, setManualVerifications] = useState<Record<string, boolean>>({});

  // Empresa encontrada basada en institucion_labora del lead
  const [empresaMatch, setEmpresaMatch] = useState<Empresa | undefined>(undefined);

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
  }, [analisisId]);

  // Cargar archivos del filesystem
  const fetchAnalisisFiles = async () => {
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
  };

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

  // Helper para obtener info del tipo de archivo
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

  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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

  const lead = analisis.lead;

  // Verificar si un requisito está cumplido (auto o manual)
  const allFiles = heredados;

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
            <Select value={estadoPep || 'Pendiente'} onValueChange={(v) => handleEstadoChange('estado_pep', v)} disabled={updatingStatus}>
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
                disabled={updatingStatus}
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

      {/* Tabs Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="resumen">Resumen General</TabsTrigger>
          <TabsTrigger value="financiero">Datos Financieros</TabsTrigger>
          <TabsTrigger value="documentos">Documentacion</TabsTrigger>
        </TabsList>

        {/* TAB: RESUMEN GENERAL */}
        <TabsContent value="resumen" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <span className="text-base">{lead?.nombramientos || 'N/A'}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Propuesta de Analisis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[100px] p-3 bg-gray-50 rounded border text-sm">
                {analisis.propuesta || <span className="text-muted-foreground italic">Sin propuesta definida</span>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DATOS FINANCIEROS */}
        <TabsContent value="financiero" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Monto Solicitado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(analisis.monto_credito)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Ingreso Bruto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(analisis.ingreso_bruto || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Ingreso Neto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(analisis.ingreso_neto || 0)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Deducciones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(
                    (analisis.ingreso_bruto || 0) - (analisis.ingreso_neto || 0)
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Bruto - Neto</p>
              </CardContent>
            </Card>
          </div>

          {/* Módulo de Deducciones Detalladas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Desglose de Deducciones</CardTitle>
            </CardHeader>
            <CardContent>
              {analisis.deducciones && analisis.deducciones.length > 0 ? (
                <div className="space-y-2">
                  {analisis.deducciones.map((deduccion, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                      <span className="text-sm font-medium">{deduccion.nombre}</span>
                      <span className="text-sm font-bold text-red-600">
                        {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(deduccion.monto)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200 mt-3">
                    <span className="text-sm font-bold">Total Deducciones Registradas</span>
                    <span className="text-lg font-bold text-red-600">
                      {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(
                        analisis.deducciones.reduce((sum, d) => sum + d.monto, 0)
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No se han registrado deducciones específicas</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DOCUMENTACION */}
        <TabsContent value="documentos" className="space-y-4">
          {/* Info de empresa detectada */}
          {empresaMatch ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700">
                <strong>Empresa detectada:</strong> {empresaMatch.business_name} - Se verificarán los requisitos específicos de esta institución.
              </p>
            </div>
          ) : lead?.institucion_labora ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-700">
                <strong>Institución:</strong> {lead.institucion_labora} - No se encontraron requisitos específicos, usando requisitos por defecto.
              </p>
            </div>
          ) : null}

          {/* Layout principal: 2 columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Columna izquierda: Verificación de Documentos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verificacion de Documentos</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Los documentos se verifican automáticamente por nombre. Si no coinciden, puede marcarlos manualmente.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {requirements.map((req, idx) => {
                  const { fulfilled, autoMatch, matchedFiles } = isRequirementFulfilled(req);

                  return (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">{req.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] uppercase bg-secondary px-1.5 py-0.5 rounded">{req.file_extension}</span>
                          <span className="text-xs text-muted-foreground">x{req.quantity}</span>
                          {matchedFiles.length > 0 && (
                            <span className="text-xs text-green-600">({matchedFiles.length} encontrado{matchedFiles.length > 1 ? 's' : ''})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {fulfilled ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            {autoMatch ? 'Auto' : 'Manual'}
                          </Badge>
                        ) : (
                          <>
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              <AlertCircle className="h-3 w-3 mr-1" /> Pendiente
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => toggleManualVerification(req.name)}
                            >
                              Verificar
                            </Button>
                          </>
                        )}
                        {fulfilled && !autoMatch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-red-500 hover:text-red-700"
                            onClick={() => toggleManualVerification(req.name)}
                          >
                            Desmarcar
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Columna derecha: Documentos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderInput className="h-4 w-4 text-blue-500" />
                  Documentos
                  <Badge variant="secondary" className="ml-auto">{heredados.length}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Archivos asociados al análisis</p>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
                {loadingFiles ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                ) : heredados.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin documentos</p>
                ) : (
                  heredados.map((file) => {
                    const { icon: FileIcon, color } = getFileTypeInfo(file.name);
                    return (
                      <div key={file.path} className="flex items-center gap-2 p-2 rounded border hover:bg-muted/50">
                        <FileIcon className={`h-4 w-4 ${color} flex-shrink-0`} />
                        <div className="min-w-0 flex-1">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium hover:underline truncate block"
                          >
                            {file.name}
                          </a>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
