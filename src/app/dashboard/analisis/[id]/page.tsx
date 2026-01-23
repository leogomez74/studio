'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, File, Image as ImageIcon, FileSpreadsheet, Trash, FolderOpen, FolderInput } from 'lucide-react';
import api from '@/lib/axios';
import { Lead } from '@/lib/data';
import {
  findEmpresaByName,
  getFileExtension,
  matchesRequirement,
  Requirement,
  Empresa
} from '@/lib/empresas-mock';

interface AnalisisItem {
  id: number;
  reference: string;
  monto_credito: number;
  status: string;
  created_at: string;
  opportunity_id?: string;
  lead_id?: string;
  lead?: Lead;
  ingreso_bruto?: number;
  ingreso_neto?: number;
  propuesta?: string;
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
  const [saving, setSaving] = useState(false);

  // Form states
  const [ingresoBruto, setIngresoBruto] = useState<string>('');
  const [ingresoNeto, setIngresoNeto] = useState<string>('');
  const [propuesta, setPropuesta] = useState<string>('');

  // File upload state
  const [uploading, setUploading] = useState(false);

  // Estados para archivos del filesystem (heredados/específicos)
  const [heredados, setHeredados] = useState<AnalisisFile[]>([]);
  const [especificos, setEspecificos] = useState<AnalisisFile[]>([]);
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
        setIngresoBruto(data.ingreso_bruto?.toString() || '');
        setIngresoNeto(data.ingreso_neto?.toString() || '');
        setPropuesta(data.propuesta || '');

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

  // Cargar archivos del filesystem (heredados/específicos)
  const fetchAnalisisFiles = async () => {
    try {
      setLoadingFiles(true);
      const res = await api.get(`/api/analisis/${analisisId}/files`);
      setHeredados(res.data.heredados || []);
      setEspecificos(res.data.especificos || []);
    } catch (error) {
      console.error('Error fetching analisis files:', error);
    } finally {
      setLoadingFiles(false);
    }
  };

  // Subir archivo específico al análisis
  const handleSpecificFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      await api.post(`/api/analisis/${analisisId}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchAnalisisFiles();
      alert('Documento subido exitosamente.');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el documento.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Eliminar archivo del análisis
  const handleDeleteAnalisisFile = async (filename: string) => {
    if (!confirm(`¿Eliminar el archivo "${filename}"?`)) return;

    try {
      await api.delete(`/api/analisis/${analisisId}/files/${encodeURIComponent(filename)}`);
      await fetchAnalisisFiles();
      alert('Archivo eliminado.');
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Error al eliminar el archivo.');
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

  const handleSave = async () => {
    if (!analisis) return;
    try {
      setSaving(true);
      await api.put(`/api/analisis/${analisis.id}`, {
        ingreso_bruto: parseFloat(ingresoBruto) || 0,
        ingreso_neto: parseFloat(ingresoNeto) || 0,
        propuesta: propuesta,
      });
      alert('Cambios guardados exitosamente.');
    } catch (error) {
      console.error('Error updating analisis:', error);
      alert('Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
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
  // Combina archivos heredados y específicos del análisis
  const allFiles = [...heredados, ...especificos];

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
        <div className="flex items-center gap-2">
          <Badge className={
            analisis.status === 'Aprobado' ? 'bg-green-500' :
            analisis.status === 'Rechazado' ? 'bg-red-500' : 'bg-yellow-500'
          }>
            {analisis.status}
          </Badge>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Cambios
          </Button>
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
              <Textarea
                placeholder="Escriba aqui la propuesta o conclusiones del analisis..."
                className="min-h-[150px]"
                value={propuesta}
                onChange={(e) => setPropuesta(e.target.value)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DATOS FINANCIEROS */}
        <TabsContent value="financiero" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Monto Solicitado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(analisis.monto_credito)}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ingreso_bruto">Ingreso Bruto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">₡</span>
                  <Input
                    id="ingreso_bruto"
                    type="number"
                    className="pl-8"
                    placeholder="0.00"
                    value={ingresoBruto}
                    onChange={(e) => setIngresoBruto(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ingreso_neto">Ingreso Neto</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">₡</span>
                  <Input
                    id="ingreso_neto"
                    type="number"
                    className="pl-8"
                    placeholder="0.00"
                    value={ingresoNeto}
                    onChange={(e) => setIngresoNeto(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Deducciones (Calculado)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(
                    (parseFloat(ingresoBruto) || 0) - (parseFloat(ingresoNeto) || 0)
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Diferencia entre Bruto y Neto</p>
              </CardContent>
            </Card>
          </div>
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
            {/* Columna izquierda: Verificación + Heredados */}
            <div className="space-y-4 flex flex-col">
              {/* Checklist de Documentos Requeridos */}
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

              {/* Archivos Heredados (de la Oportunidad) */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FolderInput className="h-4 w-4 text-blue-500" />
                    Heredados de Oportunidad
                    <Badge variant="secondary" className="ml-auto">{heredados.length}</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">Documentos copiados de la oportunidad</p>
                </CardHeader>
                <CardContent className="space-y-2 max-h-[250px] overflow-y-auto">
                  {loadingFiles ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                  ) : heredados.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin archivos heredados</p>
                  ) : (
                    heredados.map((file) => {
                      const { icon: FileIcon, color } = getFileTypeInfo(file.name);
                      return (
                        <div key={file.path} className="flex items-center justify-between p-2 rounded border hover:bg-muted/50">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileIcon className={`h-4 w-4 ${color} flex-shrink-0`} />
                            <div className="min-w-0">
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
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteAnalisisFile(file.name)}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Columna derecha: Específicos del Análisis (altura completa) */}
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-green-500" />
                  Específicos del Análisis
                  <Badge variant="secondary" className="ml-auto">{especificos.length}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Documentos subidos directamente aquí</p>
              </CardHeader>
              <CardContent className="space-y-2 flex-1 flex flex-col">
                {/* Subir archivo específico */}
                <div className="flex items-center gap-2 p-2 border-2 border-dashed rounded mb-2">
                  <Upload className="h-4 w-4 text-gray-400" />
                  <Input
                    type="file"
                    className="text-xs h-8"
                    onChange={handleSpecificFileUpload}
                    disabled={uploading}
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {loadingFiles ? (
                    <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                  ) : especificos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin archivos específicos</p>
                  ) : (
                    especificos.map((file) => {
                      const { icon: FileIcon, color } = getFileTypeInfo(file.name);
                      return (
                        <div key={file.path} className="flex items-center justify-between p-2 rounded border hover:bg-muted/50">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileIcon className={`h-4 w-4 ${color} flex-shrink-0`} />
                            <div className="min-w-0">
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
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteAnalisisFile(file.name)}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
