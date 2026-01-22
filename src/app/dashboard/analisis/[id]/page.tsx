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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, FileText, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import api from '@/lib/axios';
import { Lead } from '@/lib/data';

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

interface PersonDocument {
  id: number;
  name: string;
  url: string;
  created_at: string;
}

export default function AnalisisDetailPage() {
  const params = useParams();
  const router = useRouter();
  const analisisId = params.id as string;

  const [analisis, setAnalisis] = useState<AnalisisItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('resumen');
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [documents, setDocuments] = useState<PersonDocument[]>([]);
  const [saving, setSaving] = useState(false);

  // Form states
  const [ingresoBruto, setIngresoBruto] = useState<string>('');
  const [ingresoNeto, setIngresoNeto] = useState<string>('');
  const [propuesta, setPropuesta] = useState<string>('');

  // File upload state
  const [uploading, setUploading] = useState(false);

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

        if (data.lead?.id) {
          fetchDocuments(data.lead.id);
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

  const fetchDocuments = async (personId: string | number) => {
    try {
      setLoadingDocs(true);
      const res = await api.get(`/api/person-documents?person_id=${personId}`);
      setDocuments(res.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoadingDocs(false);
    }
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !analisis?.lead?.id) return;

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('person_id', String(analisis.lead.id));

    try {
      setUploading(true);
      await api.post('/api/person-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchDocuments(analisis.lead.id);
      alert('Documento subido exitosamente.');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el documento.');
    } finally {
      setUploading(false);
      e.target.value = '';
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

  // Helper to find specific documents
  const findDoc = (keyword: string) => documents.find(d => d.name.toLowerCase().includes(keyword.toLowerCase()));
  const colillaDoc = findDoc('colilla');
  const constanciaDoc = findDoc('constancia');
  const recordDoc = findDoc('record') || findDoc('crediticio');

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Checklist de Documentos Requeridos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Verificacion de Documentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Colilla de Pago</span>
                  </div>
                  {colillaDoc ? (
                    <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Recibido</Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1" /> Pendiente</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Constancia Salarial</span>
                  </div>
                  {constanciaDoc ? (
                    <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Recibido</Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1" /> Pendiente</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Record Crediticio</span>
                  </div>
                  {recordDoc ? (
                    <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Recibido</Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1" /> Pendiente</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Subida de Archivos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Subir Documento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors">
                  <Upload className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500 mb-4 text-center">
                    Seleccione un archivo para subir (PDF, Imagen)
                  </p>
                  <Input
                    type="file"
                    className="hidden"
                    id="file-upload"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <Label htmlFor="file-upload">
                    <Button variant="outline" asChild disabled={uploading}>
                      <span>{uploading ? 'Subiendo...' : 'Seleccionar Archivo'}</span>
                    </Button>
                  </Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista Completa de Documentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Todos los Documentos</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {loadingDocs ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                ) : documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-gray-100 rounded border text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {doc.name}
                          </a>
                        </div>
                        <span className="text-xs text-gray-400">{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No hay documentos registrados.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
