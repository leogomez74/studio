'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2, Upload, FileText, CheckCircle2, AlertTriangle, XCircle,
  Users, Landmark, Eye, X,
} from 'lucide-react';
import api from '@/lib/axios';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/contexts/PermissionsContext';

interface PreviewField {
  field: string;
  label: string;
  value: string | null;
}

interface ExistingPerson {
  id: number;
  cedula: string | null;
  nombre_completo: string;
  person_type_id: number;
  tipo: 'Cliente' | 'Lead';
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

interface RecordPreview {
  source_file: string;
  row_number?: number;
  extracted: Record<string, string | null>;
  filled: PreviewField[];
  missing: PreviewField[];
  filled_count: number;
  missing_count: number;
  already_exists: boolean;
  existing: ExistingPerson | null;
  error: string | null;
}

interface PreviewSummary {
  total: number;
  new: number;
  already_exists: number;
  no_cedula: number;
  parse_errors: number;
}

interface PreviewResponse {
  success: boolean;
  summary: PreviewSummary;
  records: RecordPreview[];
}

export default function ImportacionPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const [activeTab, setActiveTab] = useState<'clientes' | 'creditos'>('clientes');

  return (
    <div className="container max-w-6xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sube archivos Excel, CSV o PDF para previsualizar y crear registros en lote.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'clientes' | 'creditos')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="clientes" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="creditos" className="flex items-center gap-2">
            <Landmark className="h-4 w-4" />
            Créditos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-6 mt-4">
          <ImportarClientesTab hasPermission={hasPermission} toast={toast} />
        </TabsContent>

        <TabsContent value="creditos" className="mt-4">
          <Card>
            <CardContent className="py-12 text-center">
              <Landmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Importación de Créditos</h3>
              <p className="text-sm text-muted-foreground">
                Próximamente. Aquí podrás subir archivos con información de créditos para crearlos en lote.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Clientes
// ---------------------------------------------------------------------------
type HasPermissionFn = ReturnType<typeof usePermissions>['hasPermission'];
type ToastFn = ReturnType<typeof useToast>['toast'];

function ImportarClientesTab({ hasPermission, toast }: { hasPermission: HasPermissionFn; toast: ToastFn }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [detailRecord, setDetailRecord] = useState<RecordPreview | null>(null);

  const canCreate = hasPermission('importacion', 'create');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    // Si hay un Excel/CSV no se pueden mezclar con otros archivos
    const exts = selected.map(f => f.name.split('.').pop()?.toLowerCase() ?? '');
    const hasSheet = exts.some(x => ['xlsx', 'xls', 'csv'].includes(x));
    if (hasSheet && selected.length > 1) {
      toast({
        title: 'Solo un archivo Excel/CSV',
        description: 'Para Excel/CSV usa un solo archivo. Las filas adicionales se procesan como records distintos.',
        variant: 'destructive',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setFiles(selected);
    setPreview(null);
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    const formData = new FormData();
    files.forEach(f => formData.append('files[]', f));

    try {
      setUploading(true);
      setPreview(null);
      const res = await api.post<PreviewResponse>('/api/importacion/preview-cliente', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'No se pudo procesar los archivos.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      {/* Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Subir archivos
          </CardTitle>
          <CardDescription>
            <strong>Excel/CSV</strong>: un solo archivo con todas las filas (cada fila = 1 cliente).{' '}
            <strong>PDF</strong>: uno o varios archivos (cada PDF = 1 cliente). Máx. 10 MB por archivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={handleFileSelect}
            disabled={uploading}
          />

          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Aún no has seleccionado archivos
              </p>
              <Button
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Seleccionar archivos
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {files.map((f, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.name}</p>
                        <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(idx)}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Agregar más
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading || files.length === 0}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? 'Procesando...' : `Previsualizar (${files.length})`}
                </Button>
                {preview && (
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Limpiar
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Resultados del preview */}
      {preview && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{preview.summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Nuevos</p>
                <p className="text-2xl font-bold text-green-600">{preview.summary.new}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Ya existen</p>
                <p className="text-2xl font-bold text-red-600">{preview.summary.already_exists}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs text-muted-foreground">Sin cédula / Errores</p>
                <p className="text-2xl font-bold text-amber-600">
                  {preview.summary.no_cedula + preview.summary.parse_errors}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registros detectados</CardTitle>
              <CardDescription>
                Haz clic en cualquier registro para ver el detalle de campos extraídos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-center">Campos</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.records.map((r, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium truncate max-w-[200px]" title={r.source_file}>
                          {r.source_file}
                        </div>
                        {r.row_number && r.row_number > 1 && (
                          <div className="text-muted-foreground">Fila {r.row_number}</div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.extracted.cedula || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {[r.extracted.name, r.extracted.apellido1, r.extracted.apellido2]
                          .filter(Boolean).join(' ') || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <span className="text-green-600 font-medium">{r.filled_count}</span>
                        <span className="text-muted-foreground"> / {r.filled_count + r.missing_count}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <RecordStatusBadge record={r} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailRecord(r)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Acción bulk */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleReset}>
              Cancelar
            </Button>
            <Button
              disabled={!canCreate || preview.summary.new === 0}
              title={
                !canCreate ? 'No tienes permiso para crear clientes' :
                preview.summary.new === 0 ? 'No hay registros nuevos para crear' : ''
              }
            >
              Crear {preview.summary.new} cliente{preview.summary.new !== 1 ? 's' : ''}
            </Button>
          </div>
        </>
      )}

      {/* Modal de detalle */}
      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del registro</DialogTitle>
            <DialogDescription>
              {detailRecord?.source_file}
              {detailRecord?.row_number && detailRecord.row_number > 1 && ` · Fila ${detailRecord.row_number}`}
            </DialogDescription>
          </DialogHeader>

          {detailRecord && (
            <div className="space-y-4">
              {/* Alerta */}
              {detailRecord.error ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Error al leer el archivo</AlertTitle>
                  <AlertDescription>{detailRecord.error}</AlertDescription>
                </Alert>
              ) : detailRecord.already_exists && detailRecord.existing ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Ya existe una persona con esta cédula</AlertTitle>
                  <AlertDescription className="text-sm space-y-1 mt-2">
                    <div><strong>Cédula:</strong> {detailRecord.existing.cedula}</div>
                    <div><strong>Nombre:</strong> {detailRecord.existing.nombre_completo}</div>
                    <div><strong>Tipo:</strong> {detailRecord.existing.tipo}</div>
                    {detailRecord.existing.email && <div><strong>Email:</strong> {detailRecord.existing.email}</div>}
                    {detailRecord.existing.phone && <div><strong>Teléfono:</strong> {detailRecord.existing.phone}</div>}
                  </AlertDescription>
                </Alert>
              ) : detailRecord.extracted.cedula ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Cédula disponible</AlertTitle>
                  <AlertDescription>
                    No se encontró ninguna persona con la cédula <strong>{detailRecord.extracted.cedula}</strong>.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No se detectó cédula</AlertTitle>
                  <AlertDescription>El archivo no contiene un campo de cédula reconocible.</AlertDescription>
                </Alert>
              )}

              {/* Encontrados / faltantes */}
              {!detailRecord.error && (
                <div className="grid md:grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Encontrados
                        <Badge variant="secondary">{detailRecord.filled_count}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {detailRecord.filled.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Sin datos</p>
                      ) : (
                        <div className="space-y-2">
                          {detailRecord.filled.map(f => (
                            <div key={f.field} className="flex justify-between text-sm border-b pb-2 last:border-0 last:pb-0 gap-3">
                              <span className="text-muted-foreground">{f.label}</span>
                              <span className="font-medium text-right max-w-[60%] break-words">{f.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Faltantes
                        <Badge variant="secondary">{detailRecord.missing_count}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {detailRecord.missing.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Todos los campos están completos</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {detailRecord.missing.map(f => (
                            <Badge key={f.field} variant="outline" className="text-xs">{f.label}</Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RecordStatusBadge({ record }: { record: RecordPreview }) {
  if (record.error) {
    return <Badge variant="destructive" className="text-xs">Error</Badge>;
  }
  if (record.already_exists) {
    return <Badge variant="destructive" className="text-xs">Ya existe</Badge>;
  }
  if (!record.extracted.cedula) {
    return <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">Sin cédula</Badge>;
  }
  return <Badge className="text-xs bg-green-100 text-green-800 border-green-300 hover:bg-green-100">Nuevo</Badge>;
}
