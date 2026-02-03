'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '@/lib/axios';
import { Lead } from '@/lib/data';

// Define types locally or import if available
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
  category?: string;
}

interface AnalisisDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analisis: AnalisisItem | null;
  onUpdate: () => void; // Callback to refresh parent list
}

export function AnalisisDetailsDialog({ open, onOpenChange, analisis, onUpdate }: AnalisisDetailsDialogProps) {
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
    if (analisis) {
      setIngresoBruto(analisis.ingreso_bruto?.toString() || '');
      setIngresoNeto(analisis.ingreso_neto?.toString() || '');
      setPropuesta(analisis.propuesta || '');
      
      if (analisis.lead?.id) {
        fetchDocuments(analisis.lead.id);
      }
    }
  }, [analisis]);

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
      onUpdate();
      onOpenChange(false);
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

    // Determinar categoría automática basada en el orden de subida
    let autoCategory = 'otro';
    const docCount = documents.length;

    if (docCount === 0) {
      autoCategory = 'cedula';
    } else if (docCount === 1) {
      autoCategory = 'recibo_servicio';
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('person_id', String(analisis.lead.id));
    formData.append('category', autoCategory);
    formData.append('name', file.name); // Use actual filename
    formData.append('notes', 'Subido desde Análisis');

    try {
      setUploading(true);
      await api.post('/api/person-documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchDocuments(analisis.lead.id); // Refresh list
      alert('Documento subido exitosamente.');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error al subir el documento.');
    } finally {
      setUploading(false);
    }
  };

  if (!analisis) return null;

  const lead = analisis.lead;

  // Helper to find specific documents by category
  const findDocByCategory = (category: string) => documents.find(d => d.category === category);
  const cedulaDoc = findDocByCategory('cedula');
  const reciboDoc = findDocByCategory('recibo_servicio');
  const comprobanteDoc = findDocByCategory('comprobante_ingresos');
  const constanciaDoc = findDocByCategory('constancia_trabajo');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de Análisis: {analisis.reference}</DialogTitle>
          <DialogDescription>
            Revisión de datos financieros y laborales del cliente.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="resumen">Resumen General</TabsTrigger>
            <TabsTrigger value="financiero">Datos Financieros</TabsTrigger>
            <TabsTrigger value="documentos">Documentación</TabsTrigger>
          </TabsList>

          {/* TAB: RESUMEN GENERAL */}
          <TabsContent value="resumen" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Información Personal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="font-semibold text-xs uppercase text-gray-500 block">Nombre</span>
                    <span className="text-base">{lead?.name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-xs uppercase text-gray-500 block">Cédula</span>
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
                  <CardTitle className="text-sm font-medium text-gray-500">Información Laboral</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <span className="font-semibold text-xs uppercase text-gray-500 block">Institución</span>
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
                <CardTitle className="text-sm font-medium text-gray-500">Propuesta de Análisis</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea 
                  placeholder="Escriba aquí la propuesta o conclusiones del análisis..." 
                  className="min-h-[100px]"
                  value={propuesta}
                  onChange={(e) => setPropuesta(e.target.value)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: DATOS FINANCIEROS */}
          <TabsContent value="financiero" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

          {/* TAB: DOCUMENTACIÓN */}
          <TabsContent value="documentos" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Checklist de Documentos Requeridos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Verificación de Documentos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Cédula</span>
                    </div>
                    {cedulaDoc ? (
                      <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Recibido</Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1" /> Pendiente</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Recibo de Servicio</span>
                    </div>
                    {reciboDoc ? (
                      <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Recibido</Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1" /> Pendiente</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Comprobante de Ingresos</span>
                    </div>
                    {comprobanteDoc ? (
                      <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Recibido</Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600 border-yellow-600"><AlertCircle className="h-3 w-3 mr-1" /> Pendiente</Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 border rounded bg-gray-50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Constancia de Trabajo</span>
                    </div>
                    {constanciaDoc ? (
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
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2">Todos los Documentos</h4>
              <ScrollArea className="h-[200px] border rounded-md p-4">
                {loadingDocs ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
                ) : documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 hover:bg-gray-100 rounded text-sm">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                            {doc.name}
                          </a>
                          {doc.category && doc.category !== 'otro' && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal flex-shrink-0">
                              {{
                                cedula: '📄 Cédula',
                                recibo_servicio: '💡 Recibo',
                                comprobante_ingresos: '💰 Ingresos',
                                constancia_trabajo: '💼 Trabajo'
                              }[doc.category] || doc.category}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No hay documentos registrados.</p>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
